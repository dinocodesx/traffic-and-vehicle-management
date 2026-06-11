"""
annotate_images.py
──────────────────
Uses YOLOv8 to detect and annotate vehicles in every image inside
`data/final/ip_camera/`.

What it produces
────────────────
  data/final/ip_camera_annotated/
      frame_0000.jpg          ← annotated copy (bounding boxes drawn)
      frame_0001.jpg
      ...

  data/final/annotations.json ← structured metadata for every image

JSON schema
───────────
{
  "metadata": {
    "total_images":     60,
    "processed_at":     "2026-06-11T20:14:00",
    "model":            "yolov8n.pt",
    "confidence_threshold": 0.4
  },
  "images": [
    {
      "file_name":          "frame_0000.jpg",
      "source_path":        "/absolute/path/to/frame_0000.jpg",
      "annotated_path":     "/absolute/path/to/frame_0000_annotated.jpg",
      "image_width":        1920,
      "image_height":       1080,
      "total_vehicles":     12,
      "vehicle_counts": {
        "car":        9,
        "motorcycle": 1,
        "bus":        1,
        "truck":      1
      },
      "detections": [
        {
          "id":         0,
          "class_id":   2,
          "class_name": "car",
          "confidence": 0.91,
          "bbox": {
            "x1": 120, "y1": 340,
            "x2": 280, "y2": 420,
            "width": 160, "height": 80,
            "center_x": 200.0, "center_y": 380.0
          }
        },
        ...
      ]
    },
    ...
  ]
}

Usage
─────
  cd /Users/rishi/Developer/fyp/traffic-and-vehicle-management
  python ml/yolo/annotate_images.py

Optional flags
──────────────
  --input   PATH   source folder   (default: data/final/ip_camera)
  --output  PATH   annotated folder (default: data/final/ip_camera_annotated)
  --json    PATH   output JSON      (default: data/final/annotations.json)
  --model   PATH   YOLO model       (default: ml/yolo/yolov8n.pt)
  --conf    FLOAT  confidence thr.  (default: 0.4)
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import cv2
from ultralytics import YOLO


# ── COCO class IDs that count as "vehicles" ───────────────────────────────────
VEHICLE_CLASSES: dict[int, str] = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

# ── Per-class bounding-box colours (BGR) ──────────────────────────────────────
BOX_COLOURS: dict[str, tuple[int, int, int]] = {
    "car":        (0,  220,  50),   # vivid green
    "motorcycle": (255, 140,   0),  # orange
    "bus":        (50,  160, 255),  # sky blue
    "truck":      (180,   0, 255),  # purple
}
DEFAULT_COLOUR = (0, 200, 255)      # yellow-green fallback

SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


# ─────────────────────────────────────────────────────────────────────────────
def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[2]  # project root

    p = argparse.ArgumentParser(description="YOLO vehicle annotator")
    p.add_argument("--input",  default=str(root / "data/final/ip_camera"),
                   help="Folder containing source images")
    p.add_argument("--output", default=str(root / "data/final/ip_camera_annotated"),
                   help="Folder to save annotated images")
    p.add_argument("--json",   default=str(root / "data/final/annotations.json"),
                   help="Path for the output JSON annotation file")
    p.add_argument("--model",  default=str(root / "ml/yolo/yolov8n.pt"),
                   help="YOLOv8 model weights")
    p.add_argument("--conf",   type=float, default=0.4,
                   help="Confidence threshold (0–1)")
    return p.parse_args()


# ─────────────────────────────────────────────────────────────────────────────
def draw_annotations(
    image:      "cv2.Mat",
    detections: list[dict],
) -> "cv2.Mat":
    """
    Draw bounding boxes + labels onto a copy of `image`.

    Each detection dict must have:
        class_name, confidence, bbox (x1 y1 x2 y2)
    """
    out = image.copy()

    for det in detections:
        name  = det["class_name"]
        conf  = det["confidence"]
        b     = det["bbox"]
        x1, y1, x2, y2 = int(b["x1"]), int(b["y1"]), int(b["x2"]), int(b["y2"])
        colour = BOX_COLOURS.get(name, DEFAULT_COLOUR)

        # ── Bounding box ──────────────────────────────────────────────────
        cv2.rectangle(out, (x1, y1), (x2, y2), colour, 2)

        # ── Label background pill ─────────────────────────────────────────
        label  = f"{name}  {conf:.0%}"
        font   = cv2.FONT_HERSHEY_SIMPLEX
        scale  = 0.55
        thick  = 1
        (tw, th), baseline = cv2.getTextSize(label, font, scale, thick)

        pad    = 4
        lx1    = x1
        ly1    = max(0, y1 - th - pad * 2 - baseline)
        lx2    = x1 + tw + pad * 2
        ly2    = y1

        cv2.rectangle(out, (lx1, ly1), (lx2, ly2), colour, cv2.FILLED)

        # ── Label text ────────────────────────────────────────────────────
        text_colour = (0, 0, 0) if sum(colour) > 400 else (255, 255, 255)
        cv2.putText(
            out, label,
            (lx1 + pad, ly2 - baseline - 1),
            font, scale, text_colour, thick, cv2.LINE_AA,
        )

        # ── Corner ticks (makes boxes look crisp at small sizes) ──────────
        tick = 12
        for (cx, cy), (dx, dy) in [
            ((x1, y1), (1,  1)), ((x2, y1), (-1,  1)),
            ((x1, y2), (1, -1)), ((x2, y2), (-1, -1)),
        ]:
            cv2.line(out, (cx, cy), (cx + dx * tick, cy), colour, 3)
            cv2.line(out, (cx, cy), (cx, cy + dy * tick), colour, 3)

    return out


# ─────────────────────────────────────────────────────────────────────────────
def process_image(
    img_path:   Path,
    model:      YOLO,
    conf_thr:   float,
    output_dir: Path,
) -> dict:
    """
    Run YOLO on one image, draw boxes, save the annotated copy, return the
    annotation dict for that image.
    """
    # ── Load image ────────────────────────────────────────────────────────
    frame = cv2.imread(str(img_path))
    if frame is None:
        print(f"  [WARN] Could not read {img_path.name} — skipping")
        return {}

    h, w = frame.shape[:2]

    # ── YOLO inference ────────────────────────────────────────────────────
    results = model(img_path, conf=conf_thr, verbose=False)[0]

    detections: list[dict] = []
    vehicle_counts = {name: 0 for name in VEHICLE_CLASSES.values()}

    for idx, box in enumerate(results.boxes):
        class_id = int(box.cls[0].item())
        if class_id not in VEHICLE_CLASSES:
            continue

        class_name = VEHICLE_CLASSES[class_id]
        confidence = round(float(box.conf[0].item()), 4)
        x1, y1, x2, y2 = (float(v) for v in box.xyxy[0].tolist())

        vehicle_counts[class_name] += 1

        detections.append({
            "id":         idx,
            "class_id":   class_id,
            "class_name": class_name,
            "confidence": confidence,
            "bbox": {
                "x1":      round(x1, 1),
                "y1":      round(y1, 1),
                "x2":      round(x2, 1),
                "y2":      round(y2, 1),
                "width":   round(x2 - x1, 1),
                "height":  round(y2 - y1, 1),
                "center_x": round((x1 + x2) / 2, 1),
                "center_y": round((y1 + y2) / 2, 1),
            },
        })

    # ── Draw and save annotated image ─────────────────────────────────────
    annotated = draw_annotations(frame, detections)
    out_path  = output_dir / img_path.name
    cv2.imwrite(str(out_path), annotated)

    total = sum(vehicle_counts.values())
    print(
        f"  ✓  {img_path.name}  →  {total:>3} vehicle(s) detected  "
        f"[{vehicle_counts}]"
    )

    return {
        "file_name":       img_path.name,
        "source_path":     str(img_path.resolve()),
        "annotated_path":  str(out_path.resolve()),
        "image_width":     w,
        "image_height":    h,
        "total_vehicles":  total,
        "vehicle_counts":  vehicle_counts,
        "detections":      detections,
    }


# ─────────────────────────────────────────────────────────────────────────────
def main() -> None:
    args = parse_args()

    input_dir  = Path(args.input)
    output_dir = Path(args.output)
    json_path  = Path(args.json)
    model_path = Path(args.model)

    # ── Validate ──────────────────────────────────────────────────────────
    if not input_dir.exists():
        sys.exit(f"[ERROR] Input folder not found: {input_dir}")
    if not model_path.exists():
        sys.exit(f"[ERROR] YOLO model not found: {model_path}")

    output_dir.mkdir(parents=True, exist_ok=True)
    json_path.parent.mkdir(parents=True, exist_ok=True)

    # ── Gather images ─────────────────────────────────────────────────────
    image_files = sorted(
        f for f in input_dir.iterdir()
        if f.suffix.lower() in SUPPORTED_EXTS
    )
    if not image_files:
        sys.exit(f"[ERROR] No images found in {input_dir}")

    print(f"\n{'─'*60}")
    print(f"  YOLO Vehicle Annotator")
    print(f"{'─'*60}")
    print(f"  Input   : {input_dir}  ({len(image_files)} images)")
    print(f"  Output  : {output_dir}")
    print(f"  JSON    : {json_path}")
    print(f"  Model   : {model_path}")
    print(f"  Conf ≥  : {args.conf}")
    print(f"{'─'*60}\n")

    # ── Load model ────────────────────────────────────────────────────────
    print("Loading YOLO model …")
    model = YOLO(str(model_path))
    print("Model ready.\n")

    # ── Process each image ────────────────────────────────────────────────
    image_annotations: list[dict] = []

    for img_path in image_files:
        result = process_image(img_path, model, args.conf, output_dir)
        if result:
            image_annotations.append(result)

    # ── Write JSON ────────────────────────────────────────────────────────
    # Aggregate totals across all images
    grand_total = sum(r["total_vehicles"] for r in image_annotations)
    grand_counts: dict[str, int] = {name: 0 for name in VEHICLE_CLASSES.values()}
    for r in image_annotations:
        for cls, cnt in r["vehicle_counts"].items():
            grand_counts[cls] += cnt

    output_payload = {
        "metadata": {
            "total_images":          len(image_annotations),
            "processed_at":          datetime.now().isoformat(timespec="seconds"),
            "model":                 model_path.name,
            "confidence_threshold":  args.conf,
            "input_folder":          str(input_dir.resolve()),
            "annotated_folder":      str(output_dir.resolve()),
            "grand_total_vehicles":  grand_total,
            "grand_vehicle_counts":  grand_counts,
        },
        "images": image_annotations,
    }

    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(output_payload, fh, indent=2, ensure_ascii=False)

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n{'─'*60}")
    print(f"  Done!")
    print(f"  Images processed : {len(image_annotations)}")
    print(f"  Total vehicles   : {grand_total}")
    for cls, cnt in grand_counts.items():
        print(f"    {cls:<12} : {cnt}")
    print(f"  Annotated images → {output_dir}")
    print(f"  Annotations JSON → {json_path}")
    print(f"{'─'*60}\n")


if __name__ == "__main__":
    main()
