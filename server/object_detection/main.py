import io
import logging
import os
import time
import uuid
from datetime import datetime
from typing import Dict

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel
from ultralytics import YOLO

# Configure logging
logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Vehicle Detection API",
    description="API for detecting and counting vehicles in road images using YOLO",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for traffic frames
script_dir = os.path.dirname(os.path.abspath(__file__))
frames_dir = os.path.join(script_dir, "../../data/final/ip_camera")
app.mount("/frames", StaticFiles(directory=frames_dir), name="frames")


# Response models
class VehicleCounts(BaseModel):
    total_vehicles: int
    cars: int
    trucks: int
    buses: int
    motorcycles: int
    bicycles: int
    pedestrians: int


class TrafficLightTiming(BaseModel):
    green_light_sec: int
    red_light_sec: int


class DetectionMetadata(BaseModel):
    confidence_score: float
    processing_time_ms: int
    model_version: str
    image_dimensions: Dict[str, int]


class DetectionResponse(BaseModel):
    detection_id: str
    camera_id: str
    timestamp: str
    vehicle_counts: VehicleCounts
    traffic_light_timing: TrafficLightTiming
    detection_metadata: DetectionMetadata


# YOLO model initialization
try:
    # Load YOLOv8 model (downloads automatically on first run)
    model = YOLO("yolov8n.pt")  # Using nano version for faster inference
    logger.info("YOLO model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load YOLO model: {e}")
    model = None

# Vehicle class mappings (COCO dataset classes)
VEHICLE_CLASSES = {
    "cars": [2],  # car
    "trucks": [7],  # truck
    "buses": [5],  # bus
    "motorcycles": [3],  # motorcycle
    "bicycles": [1],  # bicycle
    "pedestrians": [0],  # person
}


def process_image_from_upload(upload_file: UploadFile) -> np.ndarray:
    """Convert uploaded file to OpenCV image format"""
    try:
        # Read file content
        contents = upload_file.file.read()

        # Convert to PIL Image
        pil_image = Image.open(io.BytesIO(contents))

        # Convert PIL to OpenCV format
        opencv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

        return opencv_image
    except Exception as e:
        logger.error(f"Error processing image {upload_file.filename}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error processing image: {str(e)}")


def count_vehicles(results) -> Dict[str, int]:
    """Count vehicles by category from YOLO results"""
    counts = {
        "cars": 0,
        "trucks": 0,
        "buses": 0,
        "motorcycles": 0,
        "bicycles": 0,
        "pedestrians": 0,
    }

    if results and len(results) > 0:
        # Get detected classes
        detected_classes = (
            results[0].boxes.cls.cpu().numpy() if results[0].boxes is not None else []
        )

        # Count each vehicle type
        for cls in detected_classes:
            cls_int = int(cls)
            for vehicle_type, class_ids in VEHICLE_CLASSES.items():
                if cls_int in class_ids:
                    counts[vehicle_type] += 1

    return counts


def calculate_average_confidence(results) -> float:
    """Calculate average confidence score from detections"""
    if not results or len(results) == 0 or results[0].boxes is None:
        return 0.0

    confidences = results[0].boxes.conf.cpu().numpy()
    avg_conf = float(np.mean(confidences)) if len(confidences) > 0 else 0.0
    return avg_conf


def calculate_traffic_lights(total_vehicles: int) -> dict:
    if 1 <= total_vehicles <= 3:
        return {"green": 10, "red": 20}
    elif 4 <= total_vehicles <= 7:
        return {"green": 15, "red": 15}
    elif total_vehicles >= 8:
        return {"green": 20, "red": 10}
    else:
        return {"green": 0, "red": 30}  # Default for 0 vehicles


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Vehicle Detection API is running",
        "model_loaded": model is not None,
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    model_status = model is not None
    status = "healthy" if model_status else "unhealthy"

    return {
        "status": status,
        "model_loaded": model_status,
        "model_version": "YOLOv8n" if model_status else None,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/detect-vehicles", response_model=DetectionResponse)
async def detect_vehicles(
    file: UploadFile = File(...), camera_id: str = "default-camera"
):
    """
    Detect and count vehicles in an uploaded road image

    Args:
        file: Image file (JPEG, PNG, etc.)
        camera_id: Optional camera identifier

    Returns:
        Detection results with vehicle counts and metadata
    """

    # Check if model is loaded
    if model is None:
        logger.error("YOLO model not loaded")
        raise HTTPException(
            status_code=500, detail="YOLO model not loaded. Please check server logs."
        )

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400, detail="File must be an image (JPEG, PNG, etc.)"
        )

    try:
        start_time = time.time()

        # Process uploaded image
        image = process_image_from_upload(file)
        height, width = image.shape[:2]

        # Run YOLO inference
        results = model(image, conf=0.25, iou=0.45)  # Confidence and IoU thresholds

        # Count vehicles
        vehicle_counts = count_vehicles(results)
        total_vehicles = (
            sum(vehicle_counts.values()) - vehicle_counts["pedestrians"]
        )  # Exclude pedestrians from vehicle count

        # Calculate metrics
        avg_confidence = calculate_average_confidence(results)
        processing_time = int(
            (time.time() - start_time) * 1000
        )  # Convert to milliseconds

        traffic_timing = calculate_traffic_lights(total_vehicles)

        # Create response
        response = DetectionResponse(
            detection_id=str(uuid.uuid4()),
            camera_id=camera_id,
            timestamp=datetime.now().isoformat(),
            vehicle_counts=VehicleCounts(
                total_vehicles=total_vehicles,
                cars=vehicle_counts["cars"],
                trucks=vehicle_counts["trucks"],
                buses=vehicle_counts["buses"],
                motorcycles=vehicle_counts["motorcycles"],
                bicycles=vehicle_counts["bicycles"],
                pedestrians=vehicle_counts["pedestrians"],
            ),
            traffic_light_timing=TrafficLightTiming(
                green_light_sec=traffic_timing["green"],
                red_light_sec=traffic_timing["red"],
            ),
            detection_metadata=DetectionMetadata(
                confidence_score=round(avg_confidence, 3),
                processing_time_ms=processing_time,
                model_version="YOLOv8n",
                image_dimensions={"width": width, "height": height},
            ),
        )

        return response

    except Exception as e:
        logger.error(f"Error during vehicle detection: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


@app.post("/batch-detect")
async def batch_detect_vehicles(files: list[UploadFile] = File(...)):
    """
    Process multiple images in batch

    Args:
        files: List of image files

    Returns:
        List of detection results
    """

    if len(files) > 10:  # Limit batch size
        raise HTTPException(
            status_code=400, detail="Maximum 10 files allowed per batch"
        )

    results = []
    for i, file in enumerate(files):
        try:
            result = await detect_vehicles(file, camera_id=f"batch-camera-{i}")
            results.append(result)
        except Exception as e:
            results.append({"error": str(e), "filename": file.filename})

    return {"batch_results": results}


@app.get("/model-info")
async def get_model_info():
    """Get information about the loaded YOLO model"""
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")

    model_info = {
        "model_name": "YOLOv8n",
        "model_type": "object_detection",
        "supported_classes": list(VEHICLE_CLASSES.keys()),
        "class_mappings": VEHICLE_CLASSES,
        "model_loaded": True,
    }

    return model_info


if __name__ == "__main__":
    # Run the application
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
