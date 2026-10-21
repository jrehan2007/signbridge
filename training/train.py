"""
Step 2 - Train the ISL gesture classifier and export it for TensorFlow.js.

Input : one or more landmark CSVs (from extract_landmarks.py and/or "Export CSV" in Model Studio)
Output: output/tfjs_model/{model.json, *.bin, labels.json}  -> upload in Admin > Models
        output/isl_classifier.keras, output/report.txt

Usage:
    python train.py --csv output/landmarks.csv
    python train.py --csv output/landmarks.csv studio-export.csv --epochs 80
    python train.py --csv output/landmarks.csv --labels A B C Hello   # fix the class order
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

import tensorflow as tf
import tensorflowjs as tfjs

from isl_features import FEATURE_SIZE


def build_model(num_classes: int) -> tf.keras.Model:
    """Same architecture as client/src/ml/classifier.js#buildModel"""
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(FEATURE_SIZE,)),
        tf.keras.layers.Dense(128, activation="relu", kernel_initializer="he_normal"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(64, activation="relu", kernel_initializer="he_normal"),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(num_classes, activation="softmax"),
    ])
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3),
                  loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return model


def augment(x: np.ndarray, y: np.ndarray, copies: int = 2, noise: float = 0.02, seed: int = 42):
    """Jitter + small scale change; zero (missing-hand) slots stay zero."""
    rng = np.random.default_rng(seed)
    xs, ys = [x], [y]
    mask = (x != 0).astype(np.float32)
    for _ in range(copies):
        scale = 1 + (rng.random((len(x), 1)) - 0.5) * 0.1
        jitter = (rng.random(x.shape) - 0.5) * 2 * noise
        xs.append((x * scale + jitter) * mask)
        ys.append(y)
    return np.concatenate(xs).astype(np.float32), np.concatenate(ys)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", nargs="+", required=True, type=Path)
    ap.add_argument("--out", default=Path("output"), type=Path)
    ap.add_argument("--labels", nargs="*", help="explicit class order (default: alphabetical)")
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--val-split", type=float, default=0.2)
    ap.add_argument("--min-samples", type=int, default=20)
    args = ap.parse_args()

    df = pd.concat([pd.read_csv(p) for p in args.csv], ignore_index=True)
    if df.shape[1] != FEATURE_SIZE + 1:
        print(f"Expected {FEATURE_SIZE + 1} columns, got {df.shape[1]}", file=sys.stderr)
        return 1
    df["label"] = df["label"].astype(str)

    counts = df["label"].value_counts()
    too_small = counts[counts < args.min_samples]
    if len(too_small):
        print(f"Dropping classes with < {args.min_samples} samples: {', '.join(too_small.index)}")
        df = df[~df["label"].isin(too_small.index)]

    labels = args.labels or sorted(df["label"].unique())
    missing = set(labels) - set(df["label"].unique())
    if missing:
        print(f"No samples for requested labels: {', '.join(sorted(missing))}", file=sys.stderr)
        return 1
    df = df[df["label"].isin(labels)]
    index = {l: i for i, l in enumerate(labels)}

    x = df.drop(columns="label").to_numpy(np.float32)
    y = df["label"].map(index).to_numpy(np.int64)
    x_tr, x_val, y_tr, y_val = train_test_split(x, y, test_size=args.val_split, stratify=y, random_state=42)
    x_tr, y_tr = augment(x_tr, y_tr)
    print(f"Classes: {len(labels)} | train {len(x_tr)} (augmented) | val {len(x_val)}")

    model = build_model(len(labels))
    model.fit(
        x_tr, y_tr,
        validation_data=(x_val, y_val),
        epochs=args.epochs, batch_size=args.batch_size, verbose=2,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=12, restore_best_weights=True),
            tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=5, min_lr=1e-5),
        ],
    )

    pred = model.predict(x_val, verbose=0).argmax(axis=1)
    val_acc = float((pred == y_val).mean())
    report = classification_report(y_val, pred, labels=list(range(len(labels))), target_names=labels, digits=3, zero_division=0)
    cm = confusion_matrix(y_val, pred, labels=list(range(len(labels))))
    print(f"\nValidation accuracy: {val_acc:.4f}\n\n{report}")

    args.out.mkdir(parents=True, exist_ok=True)
    model.save(args.out / "isl_classifier.keras")
    (args.out / "report.txt").write_text(
        f"Validation accuracy: {val_acc:.4f}\n\n{report}\nConfusion matrix (rows=true, cols=pred)\n"
        f"labels: {labels}\n{np.array2string(cm)}\n"
    )

    tfjs_dir = args.out / "tfjs_model"
    tfjs.converters.save_keras_model(model, str(tfjs_dir))
    (tfjs_dir / "labels.json").write_text(json.dumps({"classLabels": labels, "valAccuracy": round(val_acc, 4)}, indent=2))
    print(f"\nTF.js model written to {tfjs_dir}/  -> upload model.json, *.bin and labels.json in Admin > Models")
    return 0


if __name__ == "__main__":
    sys.exit(main())
