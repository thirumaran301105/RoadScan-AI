"""
Detection Module
------------------
Runs the real, MIT-licensed YOLOv8-segmentation pothole model (see
models/POTHOLE_MODEL_LICENSE.txt for the license, sourced from
github.com/FarzadNekouee/YOLOv8_Pothole_Segmentation_Road_Damage_Assessment)
against video frames or images.

Segmentation (not just bounding boxes) is used deliberately: the pixel mask
area is a much better proxy for a pothole's real size than a rectangular
box, which is what severity classification is based on.
"""
import cv2
import numpy as np
from ultralytics import YOLO

import config

_model = None


def get_model():
    global _model
    if _model is None:
        _model = YOLO(config.POTHOLE_MODEL_PATH)
    return _model


def classify_severity(mask_area_fraction: float) -> str:
    if mask_area_fraction >= config.SEVERITY_THRESHOLDS["severe"]:
        return "severe"
    elif mask_area_fraction >= config.SEVERITY_THRESHOLDS["moderate"]:
        return "moderate"
    else:
        return "minor"


def detect_frame(frame: np.ndarray):
    """Runs detection on a single frame (numpy BGR array).
    Returns a list of dicts: [{confidence, mask_area_fraction, severity, bbox}, ...]
    """
    model = get_model()
    results = model(frame, conf=config.CONF_THRESHOLD, verbose=False)[0]

    detections = []
    frame_area = frame.shape[0] * frame.shape[1]

    if results.boxes is None or len(results.boxes) == 0:
        return detections

    for i, box in enumerate(results.boxes):
        confidence = float(box.conf[0])

        # Prefer the actual segmentation mask area if available (more
        # accurate size proxy); fall back to bounding-box area otherwise.
        if results.masks is not None and i < len(results.masks.data):
            mask = results.masks.data[i].cpu().numpy()
            mask_pixels = int(np.count_nonzero(mask))
            # masks are often at a different resolution than the original
            # frame - normalize by the mask's own resolution, not the frame's
            mask_area_fraction = mask_pixels / (mask.shape[0] * mask.shape[1])
        else:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            mask_area_fraction = ((x2 - x1) * (y2 - y1)) / frame_area

        severity = classify_severity(mask_area_fraction)
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

        detections.append({
            "confidence": confidence,
            "mask_area_fraction": round(mask_area_fraction, 4),
            "severity": severity,
            "bbox": [x1, y1, x2, y2],
        })

    return detections


def extract_video_frames(video_path: str, sample_every_n: int = None):
    """Yields (frame_index, timestamp_seconds, frame) for every Nth frame."""
    sample_every_n = sample_every_n or config.SAMPLE_EVERY_N_FRAMES
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    frame_idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if frame_idx % sample_every_n == 0:
            timestamp = frame_idx / fps
            yield frame_idx, timestamp, frame
        frame_idx += 1
    cap.release()
