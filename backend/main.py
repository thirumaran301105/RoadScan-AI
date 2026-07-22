"""
RoadScan AI - Main API server
--------------------------------
Run with: uvicorn main:app --reload --port 8000

PRIMARY workflow - the driver's own device (laptop or phone) streams its
own camera + its own GPS live over a WebSocket. The backend has no camera
or GPS hardware of its own in this path - see frame_stream.py.
  1. WS   /ws/frame_stream   - browser sends {frame, latitude, longitude};
                                  backend replies with detections + alerts
  2. GET  /api/potholes       - ranked list of active potholes (for the map)
  3. GET  /api/stats          - summary counts

ALTERNATE workflow - a dedicated in-vehicle unit with its OWN attached
camera (e.g. a Raspberry Pi bolted into a fleet vehicle), not a browser:
  POST /api/live/start / /api/live/stop - see live_capture.py

SECONDARY workflow - batch processing of already-recorded footage:
  POST /api/upload_pass - upload a video/images + GPS CSV covering a past drive

All three feed the same pothole database. Everything is held in memory for
this prototype (single process, resets on restart) - swap in
Postgres/PostGIS for production, noted in README.
"""
import os
import shutil
import uuid
import asyncio
from typing import List, Optional

import cv2
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

import config
import detection_module
import geotagging
import deduplication
import repair_tracker
import prioritization
import live_capture
import frame_stream
import road_classifier
import database
import gps_provider as gps_provider_module
from alert_manager import AlertManager

app = FastAPI(title="RoadScan AI - Pothole & Road Damage Intelligence")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# In-memory state
_potholes: dict = {}   # pothole_id -> record dict
_passes: list = []     # metadata about each uploaded pass
_alert_manager = AlertManager()
_pushed_gps = gps_provider_module.PushedGPS()
_live_manager = live_capture.LiveCaptureManager(_potholes, _alert_manager)


@app.on_event("startup")
def startup():
    detection_module.get_model()  # warm-load the model
    os.makedirs("uploaded", exist_ok=True)
    database.init_db()
    loaded = database.load_all_potholes()
    _potholes.update(loaded)
    print(f"[main] RoadScan AI backend started. Loaded {len(loaded)} potholes from disk.")


def _save_upload(upload: UploadFile, dest_dir: str) -> str:
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, upload.filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(upload.file, f)
    return dest


# ============================================================
# SECONDARY: batch processing of already-recorded footage
# ============================================================

@app.post("/api/upload_pass")
async def upload_pass(
    gps_csv: UploadFile = File(...),
    video: Optional[UploadFile] = File(None),
    images: Optional[List[UploadFile]] = File(None),
):
    if video is None and not images:
        raise HTTPException(status_code=400, detail="Provide either a video file or a list of images.")

    pass_id = str(uuid.uuid4())[:8]
    work_dir = os.path.join("uploaded", pass_id)
    os.makedirs(work_dir, exist_ok=True)

    gps_path = _save_upload(gps_csv, work_dir)
    try:
        gps_track = geotagging.load_gps_track(gps_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    raw_detections = []
    warnings = []
    n_frames_processed = 0

    if video is not None:
        video_path = _save_upload(video, work_dir)
        for frame_idx, timestamp, frame in detection_module.extract_video_frames(video_path):
            n_frames_processed += 1
            dets = detection_module.detect_frame(frame)
            lat, lon = geotagging.nearest_gps_point(gps_track, timestamp)
            for d in dets:
                raw_detections.append({
                    "pass_id": pass_id, "timestamp": timestamp,
                    "latitude": lat, "longitude": lon,
                    "confidence": d["confidence"], "severity": d["severity"],
                    "mask_area_fraction": d["mask_area_fraction"],
                })
    else:
        # Image-sequence mode: match images to GPS rows by upload order
        if len(images) > len(gps_track):
            warnings.append(f"{len(images)} images but only {len(gps_track)} GPS points - "
                             f"extra images beyond the GPS track were skipped.")
        for i, img_upload in enumerate(images[:len(gps_track)]):
            img_path = _save_upload(img_upload, work_dir)
            frame = cv2.imread(img_path)
            if frame is None:
                warnings.append(f"Could not read image: {img_upload.filename}")
                continue
            n_frames_processed += 1
            dets = detection_module.detect_frame(frame)
            gps_row = gps_track.iloc[i]
            lat, lon, timestamp = float(gps_row["latitude"]), float(gps_row["longitude"]), float(gps_row["timestamp"])
            for d in dets:
                raw_detections.append({
                    "pass_id": pass_id, "timestamp": timestamp,
                    "latitude": lat, "longitude": lon,
                    "confidence": d["confidence"], "severity": d["severity"],
                    "mask_area_fraction": d["mask_area_fraction"],
                })

    # Deduplicate against existing known potholes
    n_new, n_updated = 0, 0
    for det in raw_detections:
        match_id = deduplication.find_matching_pothole(_potholes, det["latitude"], det["longitude"])
        if match_id:
            deduplication.merge_detection_into_pothole(_potholes, match_id, det)
            n_updated += 1
        else:
            # Road type is determined automatically from GPS, same as the
            # live browser path - not passed in manually.
            road_type = road_classifier.classify_road_type(det["latitude"], det["longitude"])
            new_record = deduplication.create_new_pothole(det, road_type=road_type)
            _potholes[new_record["pothole_id"]] = new_record
            n_new += 1

    # Repair verification against this pass's full route
    newly_repaired = repair_tracker.check_repairs_against_pass(_potholes, gps_track, raw_detections)

    _passes.append({"pass_id": pass_id, "n_frames_processed": n_frames_processed,
                     "n_raw_detections": len(raw_detections)})

    database.save_all_potholes(_potholes)

    return {
        "pass_id": pass_id,
        "n_frames_processed": n_frames_processed,
        "n_raw_detections": len(raw_detections),
        "n_new_potholes": n_new,
        "n_updated_potholes": n_updated,
        "n_marked_likely_repaired": len(newly_repaired),
        "warnings": warnings,
    }


# ============================================================
# PRIMARY: driver's own device (laptop/phone) streams its own
# camera + its own GPS live over a WebSocket
# ============================================================

@app.websocket("/ws/frame_stream")
async def ws_frame_stream(websocket: WebSocket):
    """
    Expects JSON messages from the browser shaped like:
        {"frame": "<base64 jpeg>", "latitude": .., "longitude": ..,
         "road_type": "arterial_road"}

    Replies with:
        {"type": "frame_result", "detections": [...], "alerts": [...]}

    Detection runs in a thread executor, not directly in this async
    handler - YOLO inference is CPU-bound and would otherwise block the
    event loop for every other connected client while it runs.
    """
    await websocket.accept()
    loop = asyncio.get_event_loop()
    try:
        while True:
            data = await websocket.receive_json()

            b64_frame = data.get("frame")
            latitude = data.get("latitude")
            longitude = data.get("longitude")

            if not b64_frame:
                await websocket.send_json({"type": "error", "message": "No frame data received."})
                continue
            if latitude is None or longitude is None:
                await websocket.send_json({
                    "type": "frame_result", "detections": [], "alerts": [],
                    "warning": "No GPS fix yet from this device - detections can't be logged without a location.",
                })
                continue

            frame = frame_stream.decode_base64_frame(b64_frame)
            if frame is None:
                await websocket.send_json({"type": "error", "message": "Could not decode frame."})
                continue

            if latitude is None or longitude is None:
                # No GPS fix yet (common for the first several seconds,
                # especially on a laptop relying on WiFi-based positioning
                # rather than a real GPS chip). Detection still runs and
                # still warns the driver - it just isn't logged to the map.
                detections, alerts = await loop.run_in_executor(
                    None, frame_stream.process_frame_without_location, frame,
                )
                await websocket.send_json({
                    "type": "frame_result",
                    "detections": detections,
                    "alerts": alerts,
                    "warning": "No GPS fix yet from this device - detections are shown live but not logged to the map until location is found.",
                })
                continue

            detections, alerts = await loop.run_in_executor(
                None, frame_stream.process_incoming_frame,
                frame, float(latitude), float(longitude), _potholes, _alert_manager,
            )

            if detections:
                # Only persist when something actually changed - saving on
                # every single frame regardless would add needless I/O to
                # the ~5 frames/sec this can realistically process.
                await loop.run_in_executor(None, database.save_all_potholes, _potholes)

            await websocket.send_json({
                "type": "frame_result",
                "detections": detections,
                "alerts": alerts,
            })
    except WebSocketDisconnect:
        pass


@app.get("/api/road_type")
def get_road_type(latitude: float, longitude: float):
    """Lets the frontend show a live 'detected road type' readout for the
    device's current position, independent of whether a pothole has
    actually been found there yet."""
    return {"road_type": road_classifier.classify_road_type(latitude, longitude)}


# ============================================================
# ALTERNATE: a dedicated in-vehicle unit with its OWN attached
# camera (not a browser) - e.g. a Raspberry Pi bolted into a
# municipal fleet vehicle with a physically wired camera.
# ============================================================

# Demo route used only when gps_mode="simulated" - a short loop near a
# fixed point, purely so the live pipeline has *some* moving position to
# geotag detections against when no real GPS is available.
_DEMO_ROUTE = [
    (12.9716, 77.5946), (12.97165, 77.59465), (12.9717, 77.5947),
    (12.97175, 77.59475), (12.9718, 77.5948),
]


@app.post("/api/live/start")
def start_live(
    source: str = Form("simulated"),
    gps_mode: str = Form("simulated"),
    road_type: str = Form("unknown"),
    gps_serial_port: Optional[str] = Form(None),
):
    """
    source: "simulated" (test mode, no camera needed), a webcam index as a
        string (e.g. "0"), or an RTSP/IP camera URL.
    gps_mode: "simulated" (demo route), "pushed" (phone/browser sends its
        own location via /api/gps_update), or "serial" (real GPS hardware).
    """
    if _live_manager.is_running():
        raise HTTPException(status_code=400, detail="Live capture is already running. Stop it first.")

    if gps_mode == "simulated":
        provider = gps_provider_module.SimulatedRouteGPS(_DEMO_ROUTE, seconds_per_waypoint=3.0)
    elif gps_mode == "pushed":
        provider = _pushed_gps
    elif gps_mode == "serial":
        if not gps_serial_port:
            raise HTTPException(status_code=400, detail="gps_serial_port is required for gps_mode='serial'.")
        provider = gps_provider_module.SerialGPS(gps_serial_port)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown gps_mode: {gps_mode}")

    # Webcam index comes in as a string from the form - convert if numeric
    cam_source = int(source) if source.isdigit() else source

    try:
        _live_manager.start(cam_source, provider, road_type=road_type)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"status": "started", "source": source, "gps_mode": gps_mode}


@app.post("/api/live/stop")
def stop_live():
    _live_manager.stop()
    return {"status": "stopped", **_live_manager.get_stats()}


@app.get("/api/live/status")
def live_status():
    return {"running": _live_manager.is_running(), **_live_manager.get_stats()}


@app.post("/api/gps_update")
def gps_update(latitude: float = Form(...), longitude: float = Form(...)):
    """A phone/browser (navigator.geolocation) pushes its current position
    here when running in gps_mode='pushed' - the realistic mode for an
    actual in-vehicle deployment."""
    _pushed_gps.push_position(latitude, longitude)
    return {"status": "ok"}


@app.get("/live_feed")
def live_feed():
    def _generator():
        while True:
            frame = _live_manager.get_latest_jpeg()
            if frame is not None:
                yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")
            import time as _t
            _t.sleep(0.05)
    return StreamingResponse(_generator(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    """Pushes driver alerts the moment a pothole is detected - this is the
    'insist the driver' channel. The dashboard/driver-view page listens
    here for messages to flash a warning and play an alert sound."""
    await websocket.accept()
    try:
        while True:
            alerts = _alert_manager.get_pending_alerts()
            for alert in alerts:
                await websocket.send_json(alert)
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        pass


@app.get("/api/potholes")
def get_potholes(status: Optional[str] = None):
    if status:
        filtered = {k: v for k, v in _potholes.items() if v["status"] == status}
        return prioritization.rank_potholes(filtered) if status in ("active", "reopened") else list(filtered.values())
    return prioritization.rank_potholes(_potholes)


@app.get("/api/potholes/all")
def get_all_potholes():
    """Includes repaired ones too - useful for the map view."""
    return list(_potholes.values())


@app.post("/api/potholes/{pothole_id}/mark_repaired")
def mark_repaired(pothole_id: str):
    if pothole_id not in _potholes:
        raise HTTPException(status_code=404, detail="Pothole not found.")
    _potholes[pothole_id]["status"] = "confirmed_repaired"
    database.save_all_potholes(_potholes)
    return _potholes[pothole_id]


@app.post("/api/potholes/{pothole_id}/reopen")
def reopen_pothole(pothole_id: str):
    if pothole_id not in _potholes:
        raise HTTPException(status_code=404, detail="Pothole not found.")
    _potholes[pothole_id]["status"] = "reopened"
    _potholes[pothole_id]["clean_pass_streak"] = 0
    database.save_all_potholes(_potholes)
    return _potholes[pothole_id]


@app.get("/api/stats")
def get_stats():
    statuses = {}
    for r in _potholes.values():
        statuses[r["status"]] = statuses.get(r["status"], 0) + 1
    severities = {}
    for r in _potholes.values():
        if r["status"] in ("active", "reopened"):
            severities[r["severity"]] = severities.get(r["severity"], 0) + 1
    total_est_cost = sum(
        prioritization.estimate_repair_cost(r) for r in _potholes.values()
        if r["status"] in ("active", "reopened")
    )
    return {
        "total_potholes_ever_seen": len(_potholes),
        "by_status": statuses,
        "active_by_severity": severities,
        "n_passes_uploaded": len(_passes),
        "total_estimated_active_repair_cost_inr": total_est_cost,
    }


# Serve the dashboard. Prefer the built React app (frontend-react/dist);
# fall back to the plain HTML dashboard (frontend/) if you haven't run
# `npm install && npm run build` yet, so the server doesn't crash on startup.
_react_dist = "../frontend-react/dist"
_static_dir = _react_dist if os.path.isdir(_react_dist) else "../frontend"
if _static_dir == "../frontend":
    print("[main] frontend-react/dist not found - serving the plain HTML dashboard "
          "instead. Run `cd frontend-react && npm install && npm run build` "
          "for the React version.")
app.mount("/", StaticFiles(directory=_static_dir, html=True), name="frontend")
