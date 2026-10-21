"""
Step 1 - Extract hand landmarks from an image / video dataset into a CSV.

Expected layout (one folder per sign, folder name = class label):

    dataset/
      A/      img001.jpg  img002.png  clip01.mp4 ...
      B/      ...
      Hello/  ...

Usage:
    python extract_landmarks.py --data dataset --out output/landmarks.csv
    python extract_landmarks.py --data dataset --out output/landmarks.csv --mirror --video-stride 3

--mirror   flip frames horizontally first. Use it when the images were captured with a
           selfie/front camera that saved them mirrored, so handedness matches the browser
           (the portal processes the *un-mirrored* webcam frame).
"""
from __future__ import annotations

import argparse
import csv
import sys
import urllib.request
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

from isl_features import CSV_HEADER, from_mediapipe_result

MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
             "hand_landmarker/float16/1/hand_landmarker.task")
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_EXT = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


def ensure_model(path: Path) -> Path:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading hand landmarker model -> {path}")
        urllib.request.urlretrieve(MODEL_URL, path)
    return path


def make_landmarker(model_path: Path):
    options = vision.HandLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(model_path)),
        running_mode=vision.RunningMode.IMAGE,
        num_hands=2,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
    )
    return vision.HandLandmarker.create_from_options(options)


def frames_from(path: Path, stride: int):
    if path.suffix.lower() in IMAGE_EXT:
        img = cv2.imread(str(path))
        if img is not None:
            yield img
        return
    cap = cv2.VideoCapture(str(path))
    i = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i % stride == 0:
            yield frame
        i += 1
    cap.release()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", required=True, type=Path, help="dataset root (one sub-folder per sign)")
    ap.add_argument("--out", default=Path("output/landmarks.csv"), type=Path)
    ap.add_argument("--model", default=Path("models/hand_landmarker.task"), type=Path)
    ap.add_argument("--mirror", action="store_true", help="flip frames horizontally before detection")
    ap.add_argument("--video-stride", type=int, default=2, help="use every Nth video frame")
    args = ap.parse_args()

    classes = sorted(p for p in args.data.iterdir() if p.is_dir())
    if not classes:
        print(f"No class folders found in {args.data}", file=sys.stderr)
        return 1

    landmarker = make_landmarker(ensure_model(args.model))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    totals: dict[str, tuple[int, int]] = {}

    with args.out.open("w", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(CSV_HEADER)
        for cls in classes:
            kept = seen = 0
            files = sorted(f for f in cls.rglob("*") if f.suffix.lower() in IMAGE_EXT | VIDEO_EXT)
            for f in files:
                for frame in frames_from(f, args.video_stride):
                    seen += 1
                    if args.mirror:
                        frame = cv2.flip(frame, 1)
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    result = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
                    vec = from_mediapipe_result(result)
                    if vec is None:
                        continue
                    writer.writerow([cls.name] + [f"{v:.5f}" for v in vec])
                    kept += 1
            totals[cls.name] = (kept, seen)
            print(f"  {cls.name:<14} {kept:>6} samples  ({seen - kept} frames without hands skipped)")

    print(f"\nWrote {sum(k for k, _ in totals.values())} samples for {len(totals)} classes -> {args.out}")
    low = [c for c, (k, _) in totals.items() if k < 50]
    if low:
        print(f"Warning: fewer than 50 samples for: {', '.join(low)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
