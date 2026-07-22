"""
Frame Stream Module
----------------------
This is the realistic primary path: the DRIVER'S OWN DEVICE (laptop webcam
or phone camera, running the React app in a browser) captures its camera
feed and its own GPS locally, then streams frames to this backend over a
WebSocket. The backend never needs its own camera or its own GPS hardware
at all - it just receives what the device in the vehicle already has.

This deliberately replaces the earlier "server opens a camera device"
design for the primary flow: a server-side cv2.VideoCapture(0) only makes
sense if a camera is physically wired to the same machine running this
backend, which isn't true for "use my laptop or phone in the car." The
old device-index/RTSP path is kept in live_capture.py as an alternate mode
for a dedicated in-vehicle unit with its own attached camera (e.g. a
Raspberry Pi bolted into a municipal fleet vehicle) - see README.
"""
import base64
import time
from typing import Optional, Tuple, List, Dict, Any

import cv2
import numpy as np

import detection_module
import deduplication
import road_classifier
from alert_manager import AlertManager, ALERT_MESSAGES


def decode_base64_frame(b64_str: str) -> Optional[np.ndarray]:
    """Accepts a base64 JPEG/PNG string (with or without a data: URL prefix)
    and returns a decoded BGR numpy frame, or None if it couldn't be read."""
    try:
        if "," in b64_str and b64_str.strip().startswith("data:"):
            b64_str = b64_str.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_str)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return frame
    except Exception:
        return None


def process_incoming_frame(
    frame: np.ndarray,
    latitude: float,
    longitude: float,
    potholes: Dict[str, dict],
    alert_mgr: AlertManager,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Runs detection on one frame from the device's own camera, geotags it
    against the device's own GPS position (passed in directly - no server-
    side GPS provider involved in this path), deduplicates, and fires
    driver alerts as needed. Road type is determined automatically from
    the GPS position via road_classifier - not chosen manually.

    Returns (detections_with_pothole_ids, alerts_fired_this_frame).
    """
    detections = detection_module.detect_frame(frame)
    results = []
    fired_alerts = []

    for d in detections:
        detection_record = {
            "pass_id": "live_browser", "timestamp": time.time(),
            "latitude": latitude, "longitude": longitude,
            "confidence": d["confidence"], "severity": d["severity"],
            "mask_area_fraction": d["mask_area_fraction"],
        }

        match_id = deduplication.find_matching_pothole(potholes, latitude, longitude)
        if match_id:
            deduplication.merge_detection_into_pothole(potholes, match_id, detection_record)
            pothole_id = match_id
        else:
            # Only classify road type for NEWLY discovered potholes, not on
            # every re-sighting - this keeps the OSM lookup rate low (see
            # road_classifier.py's caching too) instead of calling it once
            # per frame regardless of whether anything new was found.
            road_type = road_classifier.classify_road_type(latitude, longitude)
            new_record = deduplication.create_new_pothole(detection_record, road_type=road_type)
            potholes[new_record["pothole_id"]] = new_record
            pothole_id = new_record["pothole_id"]

        results.append({**d, "pothole_id": pothole_id})

        # Alert the driver on every detection, immediately - safety
        # warnings shouldn't wait for multi-sighting confirmation, since a
        # normal single drive-past only sees any given pothole ONCE. The
        # confirmation gate (see deduplication.py) only affects whether it
        # counts as "confirmed" for the municipal repair queue, not
        # whether the driver gets warned right now.
        alert = alert_mgr.maybe_alert(pothole_id, d["severity"], latitude, longitude, d["confidence"])
        if alert:
            fired_alerts.append(alert)

    return results, fired_alerts


def process_frame_without_location(frame: np.ndarray) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Used when no GPS fix is available yet (common for the first several
    seconds after starting, especially on a laptop relying on WiFi-based
    positioning rather than a real GPS chip). Detection still runs and the
    driver still gets warned - a hazard directly ahead matters even before
    we can pin down exactly where it is - but nothing is logged to the
    pothole database, since that requires real coordinates.
    """
    detections = detection_module.detect_frame(frame)
    results = []
    alerts = []
    for d in detections:
        results.append({**d, "pothole_id": None})
        alerts.append({
            "type": "pothole_alert",
            "pothole_id": None,
            "severity": d["severity"],
            "message": ALERT_MESSAGES.get(d["severity"], "Road damage ahead") + " (location not logged - no GPS fix yet)",
            "latitude": None,
            "longitude": None,
            "confidence": round(d["confidence"], 2),
            "timestamp": time.time(),
            "urgent": d["severity"] == "severe",
        })
    return results, alerts
