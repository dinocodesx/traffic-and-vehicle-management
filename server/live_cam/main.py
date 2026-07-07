import io
import logging
import logging.config
import os
import time
from datetime import datetime

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from PIL import Image
from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    create_engine,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from ultralytics import YOLO

# ──────────────────────────────────────────────────────────────────────────────
# Logging  (timestamps on every line, including uvicorn access logs)
# ──────────────────────────────────────────────────────────────────────────────
LOG_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s  %(levelname)-8s  %(name)s  —  %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "access": {
            "format": "%(asctime)s  %(levelname)-8s  %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
            "stream": "ext://sys.stdout",
        },
        "access_console": {
            "class": "logging.StreamHandler",
            "formatter": "access",
            "stream": "ext://sys.stdout",
        },
    },
    "loggers": {
        "": {"handlers": ["console"], "level": "INFO"},
        "uvicorn": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "uvicorn.error": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "uvicorn.access": {
            "handlers": ["access_console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

logging.config.dictConfig(LOG_CONFIG)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_HTML = os.path.join(SCRIPT_DIR, "index.html")

MODEL_PATH = os.path.join(SCRIPT_DIR, "yolov8n.pt")
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = os.path.join(SCRIPT_DIR, "..", "object_detection", "yolov8n.pt")

DB_PATH = os.path.join(SCRIPT_DIR, "detections.db")

# ──────────────────────────────────────────────────────────────────────────────
# Database  (SQLite via SQLAlchemy)
# ──────────────────────────────────────────────────────────────────────────────
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},  # required for SQLite + FastAPI
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class DetectionLog(Base):
    """One row per /detect request."""

    __tablename__ = "detection_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    client_ip = Column(String(64), nullable=True)
    confidence_threshold = Column(Float, nullable=False)
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)
    inference_ms = Column(Integer, nullable=False)
    object_count = Column(Integer, nullable=False, default=0)
    # Store the full detections list as JSON
    detections = Column(JSON, nullable=False, default=list)


# Create tables on startup (no-op if they already exist)
Base.metadata.create_all(bind=engine)
logger.info(f"SQLite database ready at: {DB_PATH}")


def get_db() -> Session:
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise


def save_detection_log(
    db: Session,
    *,
    client_ip: str | None,
    confidence_threshold: float,
    image_width: int,
    image_height: int,
    inference_ms: int,
    detections: list,
) -> DetectionLog:
    row = DetectionLog(
        timestamp=datetime.utcnow(),
        client_ip=client_ip,
        confidence_threshold=confidence_threshold,
        image_width=image_width,
        image_height=image_height,
        inference_ms=inference_ms,
        object_count=len(detections),
        detections=detections,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


# ──────────────────────────────────────────────────────────────────────────────
# YOLO Model
# ──────────────────────────────────────────────────────────────────────────────
try:
    model = YOLO(MODEL_PATH)
    logger.info(f"YOLO model loaded from: {MODEL_PATH}")
except Exception as e:
    logger.error(f"Failed to load YOLO model: {e}")
    model = None

# ──────────────────────────────────────────────────────────────────────────────
# COCO class names (80 classes)
# ──────────────────────────────────────────────────────────────────────────────
COCO_CLASSES = [
    "person",
    "bicycle",
    "car",
    "motorcycle",
    "airplane",
    "bus",
    "train",
    "truck",
    "boat",
    "traffic light",
    "fire hydrant",
    "stop sign",
    "parking meter",
    "bench",
    "bird",
    "cat",
    "dog",
    "horse",
    "sheep",
    "cow",
    "elephant",
    "bear",
    "zebra",
    "giraffe",
    "backpack",
    "umbrella",
    "handbag",
    "tie",
    "suitcase",
    "frisbee",
    "skis",
    "snowboard",
    "sports ball",
    "kite",
    "baseball bat",
    "baseball glove",
    "skateboard",
    "surfboard",
    "tennis racket",
    "bottle",
    "wine glass",
    "cup",
    "fork",
    "knife",
    "spoon",
    "bowl",
    "banana",
    "apple",
    "sandwich",
    "orange",
    "broccoli",
    "carrot",
    "hot dog",
    "pizza",
    "donut",
    "cake",
    "chair",
    "couch",
    "potted plant",
    "bed",
    "dining table",
    "toilet",
    "tv",
    "laptop",
    "mouse",
    "remote",
    "keyboard",
    "cell phone",
    "microwave",
    "oven",
    "toaster",
    "sink",
    "refrigerator",
    "book",
    "clock",
    "vase",
    "scissors",
    "teddy bear",
    "hair drier",
    "toothbrush",
]

# ──────────────────────────────────────────────────────────────────────────────
# FastAPI App
# ──────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="Live YOLO Object Detection Demo", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/")
async def serve_frontend():
    """Serve the main frontend HTML page."""
    if not os.path.exists(FRONTEND_HTML):
        raise HTTPException(status_code=404, detail="Frontend not found.")
    return FileResponse(FRONTEND_HTML, media_type="text/html")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "model_path": MODEL_PATH,
        "database": DB_PATH,
    }


@app.post("/detect")
async def detect(
    request: Request,
    file: UploadFile = File(...),
    confidence: float = Form(default=0.35),
):
    """
    Accept a JPEG/PNG image frame, run YOLOv8 inference, save the result to
    the database, and return detections as JSON.
    """
    if model is None:
        raise HTTPException(status_code=500, detail="YOLO model not loaded.")

    # ── Decode image ────────────────────────────
    try:
        contents = await file.read()
        pil_img = Image.open(io.BytesIO(contents)).convert("RGB")
        img_w, img_h = pil_img.size
        cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not decode image: {e}")

    # ── Run inference ───────────────────────────
    t0 = time.perf_counter()
    try:
        results = model(cv_img, conf=confidence, iou=0.45, verbose=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")
    inference_ms = int((time.perf_counter() - t0) * 1000)

    # ── Parse detections ────────────────────────
    detections = []
    if results and results[0].boxes is not None:
        boxes = results[0].boxes
        for i in range(len(boxes)):
            cls_id = int(boxes.cls[i].item())
            conf = float(boxes.conf[i].item())
            x1, y1, x2, y2 = boxes.xyxy[i].tolist()
            detections.append(
                {
                    "class_id": cls_id,
                    "class_name": COCO_CLASSES[cls_id]
                    if cls_id < len(COCO_CLASSES)
                    else f"class_{cls_id}",
                    "confidence": round(conf, 3),
                    "box": {
                        "x1": round(x1 / img_w, 5),
                        "y1": round(y1 / img_h, 5),
                        "x2": round(x2 / img_w, 5),
                        "y2": round(y2 / img_h, 5),
                    },
                }
            )

    # ── Persist to database ─────────────────────
    try:
        db = get_db()
        save_detection_log(
            db,
            client_ip=request.client.host if request.client else None,
            confidence_threshold=confidence,
            image_width=img_w,
            image_height=img_h,
            inference_ms=inference_ms,
            detections=detections,
        )
        db.close()
    except Exception as e:
        logger.warning(f"Could not save detection log to DB: {e}")

    logger.info(
        f"Detected {len(detections)} object(s) in {inference_ms}ms "
        f"[conf≥{confidence:.0%}  {img_w}×{img_h}]"
    )

    return JSONResponse(
        {
            "detections": detections,
            "inference_ms": inference_ms,
            "count": len(detections),
        }
    )


@app.get("/logs")
async def get_logs(
    limit: int = Query(default=50, ge=1, le=500, description="Max rows to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    min_objects: int = Query(
        default=0, ge=0, description="Filter: minimum objects detected"
    ),
):
    """
    Return recent detection log entries (newest first).

    Query params:
      - limit        Max rows (1–500, default 50)
      - offset       Pagination offset (default 0)
      - min_objects  Only return frames where at least N objects were detected
    """
    db = get_db()
    try:
        q = db.query(DetectionLog)
        if min_objects > 0:
            q = q.filter(DetectionLog.object_count >= min_objects)
        total = q.count()
        rows = (
            q.order_by(DetectionLog.timestamp.desc()).offset(offset).limit(limit).all()
        )

        return JSONResponse(
            {
                "total": total,
                "offset": offset,
                "limit": limit,
                "logs": [
                    {
                        "id": row.id,
                        "timestamp": row.timestamp.isoformat() + "Z",
                        "client_ip": row.client_ip,
                        "confidence_threshold": row.confidence_threshold,
                        "image_width": row.image_width,
                        "image_height": row.image_height,
                        "inference_ms": row.inference_ms,
                        "object_count": row.object_count,
                        "detections": row.detections,
                    }
                    for row in rows
                ],
            }
        )
    finally:
        db.close()


@app.get("/logs/stats")
async def get_log_stats():
    """Return aggregate statistics across all logged detections."""
    db = get_db()
    try:
        total_frames = db.query(func.count(DetectionLog.id)).scalar() or 0
        total_objects = db.query(func.sum(DetectionLog.object_count)).scalar() or 0
        avg_inference = db.query(func.avg(DetectionLog.inference_ms)).scalar()
        avg_objects = db.query(func.avg(DetectionLog.object_count)).scalar()
        max_objects = db.query(func.max(DetectionLog.object_count)).scalar() or 0

        # Most detected class across all frames
        class_counts: dict[str, int] = {}
        for row in db.query(DetectionLog).all():
            for det in row.detections or []:
                name = det.get("class_name", "unknown")
                class_counts[name] = class_counts.get(name, 0) + 1

        top_classes = sorted(class_counts.items(), key=lambda x: x[1], reverse=True)[
            :10
        ]

        return JSONResponse(
            {
                "total_frames": total_frames,
                "total_objects": int(total_objects),
                "avg_inference_ms": round(avg_inference, 1) if avg_inference else None,
                "avg_objects_per_frame": round(avg_objects, 2) if avg_objects else None,
                "max_objects_in_frame": max_objects,
                "top_classes": [{"class": k, "count": v} for k, v in top_classes],
            }
        )
    finally:
        db.close()


@app.delete("/logs")
async def clear_logs():
    """Delete all detection logs from the database."""
    db = get_db()
    try:
        deleted = db.query(DetectionLog).delete()
        db.commit()
        logger.info(f"Cleared {deleted} detection log(s) from DB")
        return JSONResponse({"deleted": deleted, "message": "All logs cleared."})
    finally:
        db.close()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=False, log_config=LOG_CONFIG)
