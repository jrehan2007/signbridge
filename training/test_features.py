"""Parity checks for isl_features.py (mirrors client/src/ml/ml.test.js). Run: python -m pytest -q  or  python test_features.py"""
import numpy as np

from isl_features import FEATURE_SIZE, extract_features, normalize_hand


def hand(ox=0.0, oy=0.0, s=1.0):
    return np.array([[ox + s * 0.01 * i, oy + s * 0.02 * (i % 5), s * 0.001 * i] for i in range(21)], dtype=np.float32)


def test_normalize_invariance():
    a, b = normalize_hand(hand(0.1, 0.1, 1)), normalize_hand(hand(0.6, 0.4, 2.5))
    assert np.allclose(a, b, atol=1e-5)
    assert np.isclose(np.linalg.norm(a.reshape(21, 3), axis=1).max(), 1.0)


def test_slots():
    assert extract_features([]) is None
    one = extract_features([("Right", 0.9, hand())])
    assert one.shape == (FEATURE_SIZE,) and not one[:63].any() and one[63:].any()
    two = extract_features([("Left", 0.8, hand()), ("Left", 0.7, hand(0.5))])
    assert two[:63].any() and two[63:].any()


def test_matches_js_reference():
    # First values of normalizeHand(hand(0.1, 0.1, 1)) computed by the JS implementation
    v = normalize_hand(hand(0.1, 0.1, 1))
    assert np.allclose(v[:6], [0, 0, 0, 0.0483024, 0.0966048, 0.0048302], atol=1e-5)


if __name__ == "__main__":
    test_normalize_invariance(); test_slots(); test_matches_js_reference()
    print("all feature tests passed")
