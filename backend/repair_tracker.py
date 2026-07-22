"""
Repair Tracker
----------------
Closed-loop verification: a pothole shouldn't stay "active" forever once
it's actually been fixed. This checks, for every currently-active pothole,
whether the CURRENT pass's GPS track drove close enough to that pothole's
location that the camera should have seen it again - and didn't.

Honesty note: this assumes the camera was actually pointed at the road
surface at that moment, which GPS proximity alone can't guarantee (a
vehicle could pass the right coordinates while the camera view is blocked,
looking sideways, etc). That's exactly why REPAIR_CONSECUTIVE_CLEAN_PASSES_
REQUIRED defaults to 2, not 1 - a single "didn't see it" pass is weak
evidence on its own.
"""
import config
from deduplication import haversine_meters


def check_repairs_against_pass(potholes: dict, pass_gps_track, detections_this_pass: list):
    """
    potholes: dict of pothole_id -> record
    pass_gps_track: DataFrame with latitude/longitude columns (full driven route)
    detections_this_pass: list of raw detections from this same pass (already
        merged into `potholes` before this is called)

    Returns list of pothole_ids newly marked "likely_repaired" this pass.
    """
    newly_repaired = []

    detected_locations_this_pass = [
        (d["latitude"], d["longitude"]) for d in detections_this_pass
    ]

    for pid, record in potholes.items():
        if record["status"] not in ("active", "reopened"):
            continue

        # Did this pass's route come within range of this pothole?
        drove_nearby = False
        for _, row in pass_gps_track.iterrows():
            if haversine_meters(row["latitude"], row["longitude"],
                                 record["latitude"], record["longitude"]) <= config.REPAIR_CHECK_RADIUS_METERS:
                drove_nearby = True
                break

        if not drove_nearby:
            continue  # this pass didn't go near this pothole - no evidence either way

        # Was it detected again on this pass?
        was_detected = any(
            haversine_meters(lat, lon, record["latitude"], record["longitude"]) <= config.DEDUP_RADIUS_METERS
            for lat, lon in detected_locations_this_pass
        )

        if was_detected:
            record["clean_pass_streak"] = 0
            continue

        # Drove nearby, camera should have seen it, but didn't -> clean pass
        record["clean_pass_streak"] += 1
        if record["clean_pass_streak"] >= config.REPAIR_CONSECUTIVE_CLEAN_PASSES_REQUIRED:
            record["status"] = "likely_repaired"
            newly_repaired.append(pid)

    return newly_repaired
