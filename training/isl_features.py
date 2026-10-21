"""
Landmark -> 126-D feature vector.

MUST stay identical to client/src/ml/features.js so that models trained here
accept exactly the same input as the browser produces.

Layout: [left-hand 21x(x,y,z) | right-hand 21x(x,y,z)]
Each hand: translate so the wrist (landmark 0) is the origin, then divide by the
largest wrist-to-landmark distance. A missing hand is all zeros.
"""
from __future__ import annotations

import numpy as np

LANDMARKS_PER_HAND = 21
VALUES_PER_HAND = LANDMARKS_PER_HAND * 3  # 63
FEATURE_SIZE = VALUES_PER_HAND * 2        # 126
CSV_HEADER = ["label"] + [f"f{i}" for i in range(FEATURE_SIZE)]


def normalize_hand(points: np.ndarray) -> np.ndarray:
    """points: (21, 3) array of x, y, z -> (63,) float32"""
    pts = np.asarray(points, dtype=np.float32).reshape(LANDMARKS_PER_HAND, 3)
    rel = pts - pts[0]
    max_dist = float(np.max(np.linalg.norm(rel, axis=1)))
    if max_dist > 1e-6:
        rel = rel / max_dist
    return rel.reshape(-1)


def extract_features(hands: list[tuple[str, float, np.ndarray]]) -> np.ndarray | None:
    """
    hands: list of (handedness_label 'Left'|'Right', score, (21,3) points)
    Returns a (126,) vector or None when no hand is present.
    """
    if not hands:
        return None
    vec = np.zeros(FEATURE_SIZE, dtype=np.float32)
    used = [False, False]
    for label, _score, pts in sorted(hands, key=lambda h: h[1], reverse=True)[:2]:
        slot = 1 if label == "Right" else 0
        if used[slot]:
            slot = 1 - slot
        used[slot] = True
        vec[slot * VALUES_PER_HAND:(slot + 1) * VALUES_PER_HAND] = normalize_hand(pts)
    return vec


def from_mediapipe_result(result) -> np.ndarray | None:
    """Converts a mediapipe.tasks HandLandmarkerResult into the feature vector."""
    hands = []
    for lms, handed in zip(result.hand_landmarks, result.handedness):
        pts = np.array([[p.x, p.y, p.z] for p in lms], dtype=np.float32)
        hands.append((handed[0].category_name, handed[0].score, pts))
    return extract_features(hands)
