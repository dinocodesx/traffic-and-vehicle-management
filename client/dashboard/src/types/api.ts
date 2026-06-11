export interface DetectionMetadata {
  confidence_score: number;
  processing_time_ms: number;
  model_version: string;
}

export interface TrafficLightTiming {
  green_light_sec: number;
  red_light_sec: number;
}

export interface VehicleCounts {
  total_vehicles: number;
  cars: number;
  trucks: number;
  buses: number;
  motorcycles: number;
  bicycles: number;
  pedestrians: number;
}

export interface LatestDetectionResponse {
  detection_id: string;
  camera_id: string;
  timestamp: string;
  source_image: string; // Base64 encoded image
  vehicle_counts: VehicleCounts;
  traffic_light_timing: TrafficLightTiming;
  detection_metadata: DetectionMetadata;
}
