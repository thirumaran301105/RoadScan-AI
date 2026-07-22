"""
RoadScan AI - Configuration
------------------------------
"""
import os

# ---------- Model ----------
POTHOLE_MODEL_PATH = os.getenv("POTHOLE_MODEL_PATH", "../models/pothole_yolov8_seg.pt")
CONF_THRESHOLD = 0.25

# ---------- Severity classification ----------
# Based on the detected pothole's mask area as a fraction of the total frame -
# a rough proxy for real-world size since we don't have depth/distance data.
# These thresholds are a reasonable starting assumption, NOT calibrated
# against verified real-world pothole dimensions - see README.
SEVERITY_THRESHOLDS = {
    "minor": 0.0,      # up to moderate threshold
    "moderate": 0.02,  # 2% of frame area
    "severe": 0.06,    # 6% of frame area
}

# ---------- Deduplication (grouping repeat sightings of the same pothole) ----------
DEDUP_RADIUS_METERS = 15  # sightings within this radius = same pothole
EARTH_RADIUS_M = 6_371_000

# ---------- Repair verification ----------
# If a later pass drives within this radius of a known pothole's location and
# does NOT detect it, that's evidence toward "likely repaired". Requires this
# many consecutive clean passes before auto-flagging (reduces false "repaired"
# calls from one pass where the camera view was just blocked).
REPAIR_CHECK_RADIUS_METERS = 20
REPAIR_CONSECUTIVE_CLEAN_PASSES_REQUIRED = 2

# ---------- Prioritization ----------
# Road-type traffic-weighting - planning-level assumption, not measured
# traffic volume. Replace with real traffic count data if available.
ROAD_TYPE_WEIGHT = {
    "national_highway": 3.0,
    "state_highway": 2.2,
    "arterial_road": 1.8,
    "residential_road": 1.0,
    "unknown": 1.3,
}
SEVERITY_WEIGHT = {"minor": 1.0, "moderate": 2.5, "severe": 5.0}

# Rough repair cost tiers (INR) - planning-level assumption, not verified
# municipal costings. See README.
REPAIR_COST_INR = {
    "minor": 3_000,      # simple patch
    "moderate": 25_000,  # resurfacing a section
    "severe": 120_000,   # major repair / drainage fix
}

# ---------- Video/frame sampling ----------
SAMPLE_EVERY_N_FRAMES = 10  # process every Nth frame from an uploaded video

# ---------- Live capture ----------
# How often (in processed frames, not raw frames) to run detection on the
# live feed. Segmentation inference is too slow to run on every single raw
# frame at full camera FPS, so we skip most frames and only run the model
# periodically - still frequent enough to catch a pothole with real warning
# lead time at normal driving speed.
# How often (in processed frames, not raw frames) to run detection on the
# live feed. Segmentation inference on CPU took ~1s/frame in testing - too
# slow to run on every frame at real camera FPS. Lower this (even to 1) if
# running on a GPU or a faster edge device; raise it if the feed lags.
LIVE_DETECT_EVERY_N_FRAMES = 3
LIVE_FRAME_WIDTH = 640
LIVE_FRAME_HEIGHT = 480

# ---------- Alerts ----------
# Minimum seconds between repeat alerts for the SAME pothole - prevents
# spamming the driver while slowly passing/idling near one.
ALERT_COOLDOWN_SECONDS = 45

# ---------- Multi-frame confirmation ----------
# A single-frame detection can be a false positive (motion blur, shadow,
# ---------- Multi-frame confirmation ----------
# A single-frame detection can be a false positive (motion blur, shadow,
# oil stain, a moment of bad lighting). This setting does NOT delay driver
# alerts - a real hazard needs a warning the first time it's seen, not the
# second (a normal single drive-past only ever sees a given pothole ONCE,
# so gating the alert behind re-confirmation would mean it almost never
# fires). What it DOES gate: whether a pothole counts as "confirmed" and
# joins the municipal repair-priority queue, versus staying an unconfirmed
# "candidate" (visible on the map, but not yet repair-queue-worthy) until
# it's been seen again - this reduces false-positive repair dispatches
# from a single noisy frame, evaluated over repeated passes (e.g. a
# municipal fleet driving the same route over multiple days), not within
# one drive.
#
#   1 = every sighting is immediately both alert-worthy AND repair-queue-worthy
#   2 = alerts fire immediately regardless; repair-queue status requires
#       one re-sighting (recommended default)
#   3+ = requires more re-sightings before repair-queue status - only
#        meaningful if you expect repeat passes over the same route
MIN_SIGHTINGS_BEFORE_CONFIRMED = 2

# ---------- Storage ----------
POTHOLES_DB_PATH = "data/potholes.json"
PASSES_DB_PATH = "data/passes.json"
