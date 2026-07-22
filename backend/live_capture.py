"""
Live Capture Manager
----------------------
This is the core of the new real-time flow: a background thread that
continuously reads frames from a camera signal, runs pothole detection on
a sampled subset of frames, geotags each detection against the current GPS
position, deduplicates against known potholes, and fires driver alerts -
all while the vehicle is moving, not after the fact.

Camera source can be:
  - An integer (webcam device index, e.g. 0)
  - A URL string (RTSP/IP camera / phone streaming app)
  - The literal string "simulated" - loops a bundled test image as a stand-in
    continuous feed, so the real-time loop's LOGIC (continuous capture ->
    detect -> geotag -> dedup -> alert, running as a background thread
    rather than one-shot batch calls) can be tested without a physical
    camera. This does NOT simulate real driving footage or prove real-world
    camera performance - see README.
"""
import os
import time
import threading
from typing import Optional

import cv2

import config
import detection_module
import deduplication
import road_classifier
import alert_manager as alert_manager_module

SIMULATED_TEST_IMAGE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "sample_data", "real_pothole_test_image.png"
)


class SimulatedCameraSource:
    """Loops a single real pothole test image as a stand-in for a live
    camera - see module docstring. Yields frames at roughly 15fps."""

    def __init__(self, image_path: str = SIMULATED_TEST_IMAGE, fps: float = 15.0):
        self.frame = cv2.imread(image_path)
        if self.frame is None:
            raise RuntimeError(f"Could not load simulated test image: {image_path}")
        self._delay = 1.0 / fps
        self._opened = True

    def isOpened(self):
        return self._opened

    def read(self):
        time.sleep(self._delay)
        return True, self.frame.copy()

    def release(self):
        self._opened = False


def _open_camera_source(source):
    if source == "simulated":
        return SimulatedCameraSource()
    cap = cv2.VideoCapture(source)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.LIVE_FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.LIVE_FRAME_HEIGHT)
    return cap


class LiveCaptureManager:
    def __init__(self, potholes: dict, alert_mgr: "alert_manager_module.AlertManager"):
        self._potholes = potholes
        self._alert_mgr = alert_mgr
        self._cap = None
        self._gps_provider = None
        self._road_type = "unknown"
        self._running = False
        self._thread = None
        self._lock = threading.Lock()
        self._latest_annotated_frame = None
        self._frame_count = 0
        self._stats = {"frames_processed": 0, "detections_this_session": 0, "started_at": None}

    def start(self, source, gps_provider, road_type: str = "unknown"):
        if self._running:
            raise RuntimeError("Live capture is already running. Stop it first.")

        self._cap = _open_camera_source(source)
        if not self._cap.isOpened():
            raise RuntimeError(
                f"Could not open camera source '{source}'. If this is a webcam index, "
                f"check it's connected and not in use by another app. If it's a URL, "
                f"check the stream is reachable."
            )

        self._gps_provider = gps_provider
        self._gps_provider.start()
        self._road_type = road_type
        self._running = True
        self._frame_count = 0
        self._stats = {"frames_processed": 0, "detections_this_session": 0, "started_at": time.time()}
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)
        if self._cap:
            self._cap.release()
        if self._gps_provider:
            self._gps_provider.stop()

    def is_running(self) -> bool:
        return self._running

    def get_stats(self) -> dict:
        return dict(self._stats)

    def get_latest_jpeg(self) -> Optional[bytes]:
        with self._lock:
            frame = self._latest_annotated_frame
        if frame is None:
            return None
        ok, buf = cv2.imencode(".jpg", frame)
        return buf.tobytes() if ok else None

    def _loop(self):
        while self._running:
            ok, frame = self._cap.read()
            if not ok:
                time.sleep(0.1)
                continue

            self._frame_count += 1
            self._stats["frames_processed"] += 1
            annotated = frame.copy()

            if self._frame_count % config.LIVE_DETECT_EVERY_N_FRAMES == 0:
                self._process_frame(frame, annotated)

            with self._lock:
                self._latest_annotated_frame = annotated

    def _process_frame(self, frame, annotated):
        detections = detection_module.detect_frame(frame)
        if not detections:
            return

        position = self._gps_provider.get_current_position()
        if position is None:
            # No GPS fix yet - still draw the box so the driver sees it
            # detected something, but we can't log/alert without a location.
            for d in detections:
                x1, y1, x2, y2 = d["bbox"]
                cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 165, 255), 2)
                cv2.putText(annotated, "no GPS fix", (x1, y1 - 8),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 165, 255), 2)
            return

        lat, lon = position
        self._stats["detections_this_session"] += len(detections)

        for d in detections:
            x1, y1, x2, y2 = d["bbox"]
            color = {"minor": (76, 201, 242), "moderate": (0, 169, 242), "severe": (57, 40, 214)}[d["severity"]]
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            cv2.putText(annotated, f"{d['severity']} {d['confidence']:.2f}", (x1, y1 - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

            detection_record = {
                "pass_id": "live", "timestamp": time.time(),
                "latitude": lat, "longitude": lon,
                "confidence": d["confidence"], "severity": d["severity"],
                "mask_area_fraction": d["mask_area_fraction"],
            }

            match_id = deduplication.find_matching_pothole(self._potholes, lat, lon)
            if match_id:
                deduplication.merge_detection_into_pothole(self._potholes, match_id, detection_record)
                pothole_id = match_id
            else:
                # Road type is determined automatically from GPS - not the
                # fixed value passed in at session start.
                road_type = road_classifier.classify_road_type(lat, lon)
                new_record = deduplication.create_new_pothole(detection_record, road_type=road_type)
                self._potholes[new_record["pothole_id"]] = new_record
                pothole_id = new_record["pothole_id"]

            # Alert the driver on every detection, immediately - see the
            # matching comment in frame_stream.py for why confirmation-
            # gating only applies to the repair queue, not driver warnings.
            self._alert_mgr.maybe_alert(pothole_id, d["severity"], lat, lon, d["confidence"])
