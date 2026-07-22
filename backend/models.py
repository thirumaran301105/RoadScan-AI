from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class GPSPoint(BaseModel):
    timestamp: float
    latitude: float
    longitude: float


class RawDetection(BaseModel):
    pass_id: str
    timestamp: float
    latitude: float
    longitude: float
    confidence: float
    mask_area_fraction: float
    severity: str
    frame_reference: Optional[str] = None


class PotholeRecord(BaseModel):
    pothole_id: str
    latitude: float
    longitude: float
    severity: str
    confidence: float
    first_seen: float
    last_seen: float
    sighting_count: int
    road_type: str = "unknown"
    status: str = "active"  # active | likely_repaired | confirmed_repaired | reopened
    clean_pass_streak: int = 0
    priority_score: Optional[float] = None
    estimated_repair_cost_inr: Optional[int] = None


class UploadPassResponse(BaseModel):
    pass_id: str
    n_frames_processed: int
    n_raw_detections: int
    n_new_potholes: int
    n_updated_potholes: int
    n_marked_likely_repaired: int
    warnings: List[str] = []
