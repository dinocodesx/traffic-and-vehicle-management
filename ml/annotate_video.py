"""
annotate_video.py
─────────────────
Processes data/raw/video.mp4 with YOLOv8 + ByteTrack to:
  • Detect and annotate all vehicles (car, motorcycle, bus, truck, bicycle)
  • Count unique vehicles crossing a virtual line per direction:
      - LEFT  carriageway  → vehicles travelling AWAY  (North)
      - RIGHT carriageway  → vehicles travelling TOWARDS (South)
  • Overlay counts + counting lines on every frame
  • Save the annotated video to data/processed/annotated_video.mp4

The video is a highway overpass shot (640×360, 25 fps).
The road divider sits near x=320 (centre), so:
  left_side  = x < 290    (away-direction lanes)
  right_side = x > 350    (towards-direction lanes)
Each side has an independent horizontal counting line at y=200.
A vehicle is counted when its centroid crosses that line (once per track ID).
"""

import os
import sys
import time
from collections import defaultdict

import cv2
from ultralytics import YOLO

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT   = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
INPUT_PATH  = os.path.join(REPO_ROOT, "data", "raw", "video.mp4")
OUTPUT_DIR  = os.path.join(REPO_ROOT, "data", "processed")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "annotated_video.mp4")
MODEL_PATH  = os.path.join(REPO_ROOT, "server", "object_detection", "yolov8n.pt")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── YOLO classes we care about (COCO) ─────────────────────────────────────────
VEHICLE_CLASS_IDS = {1, 2, 3, 5, 7}          # bicycle, car, motorcycle, bus, truck
VEHICLE_NAMES     = {1:"bicycle", 2:"car", 3:"motorcycle", 5:"bus", 7:"truck"}

# ── Video geometry (640×360) ───────────────────────────────────────────────────
FRAME_W, FRAME_H = 640, 360
DIVIDER_LEFT     = 290    # x pixel: left edge of central reservation
DIVIDER_RIGHT    = 350    # x pixel: right edge of central reservation
COUNT_LINE_Y     = 210    # y pixel: horizontal counting line (same for both sides)
COUNT_LINE_MARGIN = 8     # ±px hysteresis to avoid double-counts at the line

# ── Visual style ───────────────────────────────────────────────────────────────
# Per-class colours  (BGR)
CLASS_COLORS = {
    1: (255, 178,  50),   # bicycle  – orange
    2: ( 56, 188, 255),   # car      – sky blue
    3: (255,  56, 200),   # motorcycle – pink
    5: ( 50, 255, 205),   # bus      – teal
    7: ( 56,  56, 255),   # truck    – red-ish
}
DEFAULT_COLOR = (200, 200, 200)

LINE_COLOR        = (  0, 255, 255)   # yellow-cyan counting line
OVERLAY_BG_COLOR  = (  0,   0,   0)   # overlay background
TEXT_COLOR        = (255, 255, 255)

FONT              = cv2.FONT_HERSHEY_DUPLEX
FONT_SCALE_BOX    = 0.45
FONT_SCALE_OVERLAY= 0.65
THICKNESS_BOX     = 2
THICKNESS_LINE    = 2


def draw_rounded_rect(img, x1, y1, x2, y2, color, alpha=0.55, radius=6):
    """Draw a semi-transparent filled rounded rectangle."""
    overlay = img.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)
    cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)


def draw_counter_overlay(frame, counts: dict[str, int], fps_val: float, frame_idx: int):
    """
    Draw the vehicle-count panel in the top-left corner.
    counts = {"Away (North)": N, "Towards (South)": N}
    """
    pad  = 10
    line_h = 28
    panel_w = 230
    panel_h = pad * 2 + line_h * (len(counts) + 2)

    # Semi-transparent dark background
    draw_rounded_rect(frame, pad, pad, pad + panel_w, pad + panel_h,
                      (20, 20, 20), alpha=0.70)

    # Title
    cv2.putText(frame, "Vehicle Counter", (pad + 10, pad + 22),
                FONT, 0.58, (100, 220, 255), 1, cv2.LINE_AA)

    y = pad + line_h + 10
    for label, count in counts.items():
        # coloured bullet
        bullet_color = (80, 220, 80) if "Away" in label else (80, 120, 255)
        cv2.circle(frame, (pad + 18, y - 5), 5, bullet_color, -1)
        cv2.putText(frame, f"{label}", (pad + 32, y),
                    FONT, FONT_SCALE_OVERLAY, TEXT_COLOR, 1, cv2.LINE_AA)
        cv2.putText(frame, str(count), (pad + panel_w - 30, y),
                    FONT, FONT_SCALE_OVERLAY, (255, 220, 50), 1, cv2.LINE_AA)
        y += line_h

    # Divider
    cv2.line(frame, (pad + 8, y - 6), (pad + panel_w - 8, y - 6), (60, 60, 60), 1)
    # FPS
    cv2.putText(frame, f"FPS: {fps_val:.1f}   Frame: {frame_idx}",
                (pad + 10, y + 14), FONT, 0.40, (120, 120, 120), 1, cv2.LINE_AA)


def main():
    print("=" * 60)
    print(" YOLO Vehicle Counter — Highway Dual Carriageway")
    print("=" * 60)
    print(f"  Input  : {INPUT_PATH}")
    print(f"  Output : {OUTPUT_PATH}")
    print(f"  Model  : {MODEL_PATH}")
    print()

    # ── Load model ────────────────────────────────────────────────────────────
    model = YOLO(MODEL_PATH)
    print("[✔] Model loaded")

    # ── Open video ────────────────────────────────────────────────────────────
    cap = cv2.VideoCapture(INPUT_PATH)
    if not cap.isOpened():
        print(f"[✘] Cannot open video: {INPUT_PATH}")
        sys.exit(1)

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps          = cap.get(cv2.CAP_PROP_FPS) or 25.0
    w            = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h            = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"[✔] Video: {w}×{h}  |  {fps} fps  |  {total_frames} frames  ({total_frames/fps:.0f}s)")

    # ── Writer ────────────────────────────────────────────────────────────────
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(OUTPUT_PATH, fourcc, fps, (w, h))
    print(f"[✔] Writer ready → {OUTPUT_PATH}")
    print()

    # ── Tracking state ────────────────────────────────────────────────────────
    # For each track ID we remember:
    #   prev_cy  : centroid y from previous frame (to detect line crossing)
    #   counted  : which side it was already counted on
    track_state: dict[int, dict] = {}  # track_id → {prev_cy, side_counted}

    # Cumulative counts
    counts = {"Away (North)": 0, "Towards (South)": 0}

    frame_idx = 0
    t_start   = time.time()

    print("Processing frames (this may take a while for a 34-min video)...")
    print("Progress will be shown every 500 frames.\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1

        # ── Run tracker ───────────────────────────────────────────────────────
        results = model.track(
            frame,
            persist=True,       # keep tracker state between frames
            tracker="bytetrack.yaml",
            conf=0.3,
            iou=0.45,
            classes=list(VEHICLE_CLASS_IDS),
            verbose=False,
        )

        # ── Draw counting lines ───────────────────────────────────────────────
        # Left carriageway line (Away)
        cv2.line(frame, (0, COUNT_LINE_Y), (DIVIDER_LEFT, COUNT_LINE_Y),
                 LINE_COLOR, THICKNESS_LINE)
        cv2.putText(frame, "Away", (4, COUNT_LINE_Y - 4),
                    FONT, 0.38, LINE_COLOR, 1, cv2.LINE_AA)

        # Right carriageway line (Towards)
        cv2.line(frame, (DIVIDER_RIGHT, COUNT_LINE_Y), (w, COUNT_LINE_Y),
                 (0, 165, 255), THICKNESS_LINE)
        cv2.putText(frame, "Towards", (DIVIDER_RIGHT + 4, COUNT_LINE_Y - 4),
                    FONT, 0.38, (0, 165, 255), 1, cv2.LINE_AA)

        # Central divider guide
        cv2.line(frame, (DIVIDER_LEFT, 0), (DIVIDER_LEFT, h), (60, 60, 60), 1)
        cv2.line(frame, (DIVIDER_RIGHT, 0), (DIVIDER_RIGHT, h), (60, 60, 60), 1)

        # ── Process detections ────────────────────────────────────────────────
        boxes = results[0].boxes if results[0].boxes is not None else []

        for box in boxes:
            cls_id  = int(box.cls[0].item())
            if cls_id not in VEHICLE_CLASS_IDS:
                continue

            track_id = int(box.id[0].item()) if box.id is not None else -1
            conf     = float(box.conf[0].item())
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2
            color    = CLASS_COLORS.get(cls_id, DEFAULT_COLOR)

            # ── Bounding box ──────────────────────────────────────────────────
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, THICKNESS_BOX)

            # Label: class + confidence + track id
            label = f"{VEHICLE_NAMES.get(cls_id,'vehicle')} {conf:.2f}"
            if track_id >= 0:
                label += f" #{track_id}"
            (tw, th), _ = cv2.getTextSize(label, FONT, FONT_SCALE_BOX, 1)
            lx = max(x1, 0)
            ly = max(y1 - th - 4, 0)
            cv2.rectangle(frame, (lx, ly), (lx + tw + 6, ly + th + 6), color, -1)
            cv2.putText(frame, label, (lx + 3, ly + th + 2),
                        FONT, FONT_SCALE_BOX, (0, 0, 0), 1, cv2.LINE_AA)

            # ── Centroid dot ──────────────────────────────────────────────────
            cv2.circle(frame, (cx, cy), 3, color, -1)

            # ── Line crossing logic ───────────────────────────────────────────
            if track_id < 0:
                continue

            # Determine which carriageway this vehicle is on
            if cx < DIVIDER_LEFT:
                side = "Away (North)"
            elif cx > DIVIDER_RIGHT:
                side = "Towards (South)"
            else:
                side = None   # in the divider gap — ignore

            if side is None:
                continue

            # Initialise state for new track IDs
            if track_id not in track_state:
                track_state[track_id] = {"prev_cy": cy, "counted": set()}

            state   = track_state[track_id]
            prev_cy = state["prev_cy"]

            # Check if centroid crossed COUNT_LINE_Y (either direction)
            crossed = (
                prev_cy < COUNT_LINE_Y <= cy or   # moving downward (towards cam)
                prev_cy > COUNT_LINE_Y >= cy       # moving upward (away from cam)
            )

            if crossed and side not in state["counted"]:
                counts[side] += 1
                state["counted"].add(side)

            state["prev_cy"] = cy

        # ── Elapsed FPS ───────────────────────────────────────────────────────
        elapsed = time.time() - t_start
        live_fps = frame_idx / elapsed if elapsed > 0 else 0

        # ── Draw overlay ──────────────────────────────────────────────────────
        draw_counter_overlay(frame, counts, live_fps, frame_idx)

        # ── Write frame ───────────────────────────────────────────────────────
        writer.write(frame)

        # ── Progress ──────────────────────────────────────────────────────────
        if frame_idx % 500 == 0 or frame_idx == total_frames:
            pct = frame_idx / total_frames * 100
            eta = (total_frames - frame_idx) / live_fps if live_fps > 0 else 0
            print(f"  [{pct:5.1f}%]  frame {frame_idx}/{total_frames}  "
                  f"|  {live_fps:.1f} fps  |  ETA {eta:.0f}s  "
                  f"|  Away={counts['Away (North)']}  Towards={counts['Towards (South)']}")

    cap.release()
    writer.release()

    total_time = time.time() - t_start
    print()
    print("=" * 60)
    print(" Done!")
    print(f"  Processed : {frame_idx} frames in {total_time:.1f}s ({frame_idx/total_time:.1f} fps avg)")
    print(f"  Away (North)    : {counts['Away (North)']} vehicles")
    print(f"  Towards (South) : {counts['Towards (South)']} vehicles")
    print(f"  Total           : {sum(counts.values())} vehicles")
    print(f"  Output saved to : {OUTPUT_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
