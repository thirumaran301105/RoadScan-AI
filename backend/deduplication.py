"""
Deduplication Module
-----------------------
Unlike RoadGuard AI's one-shot batch clustering, this system ingests data
incrementally (one driving pass at a time), so deduplication works as an
incremental nearest-match: for each new raw detection, check whether it
falls within DEDUP_RADIUS_METERS of an already-known pothole. If so, merge
into that record (update severity/confidence/last_seen). If not, it's a
newly discovered pothole.
"""
import math
import uuid

import config


def haversine_meters(lat1, lon1, lat2, lon2) -> float:
    r = config.EARTH_RADIUS_M
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(min(1, math.sqrt(a)))


SEVERITY_RANK = {"minor": 1, "moderate": 2, "severe": 3}


def find_matching_pothole(potholes: dict, lat: float, lon: float, radius_m: float = None):
    """Returns the pothole_id of the nearest existing pothole within radius,
    or None if this is a new location."""
    radius_m = radius_m or config.DEDUP_RADIUS_METERS
    best_id, best_dist = None, radius_m
    for pid, record in potholes.items():
        d = haversine_meters(lat, lon, record["latitude"], record["longitude"])
        if d <= best_dist:
            best_id, best_dist = pid, d
    return best_id


def merge_detection_into_pothole(potholes: dict, pid: str, detection: dict):
    """Merges a new sighting into an existing record. After calling this,
    check potholes[pid]['status'] - it's only 'active'/'reopened' (i.e.
    confirmed and alert-worthy) once enough sightings have accumulated;
    'candidate' means still awaiting confirmation, not yet alert-worthy."""
    record = potholes[pid]
    record["last_seen"] = max(record["last_seen"], detection["timestamp"])
    record["first_seen"] = min(record["first_seen"], detection["timestamp"])
    record["sighting_count"] += 1
    # Take the worse (higher) severity ever observed - a pothole that's ever
    # been "severe" shouldn't get downgraded just because one pass saw it
    # from a shallower angle.
    if SEVERITY_RANK[detection["severity"]] > SEVERITY_RANK[record["severity"]]:
        record["severity"] = detection["severity"]
    record["confidence"] = max(record["confidence"], detection["confidence"])

    if record["status"] == "candidate" and record["sighting_count"] >= config.MIN_SIGHTINGS_BEFORE_CONFIRMED:
        record["status"] = "active"
    elif record["status"] in ("likely_repaired", "confirmed_repaired"):
        # A confirmed re-sighting after being marked repaired means it's
        # back - reopen it and resets any "likely repaired" progress.
        record["status"] = "reopened"

    record["clean_pass_streak"] = 0


def create_new_pothole(detection: dict, road_type: str = "unknown") -> dict:
    # If confirmation requires more than one sighting, a brand-new location
    # starts as an unconfirmed "candidate" - not yet alerted on, not yet in
    # the official priority list - until it's been seen enough times.
    # Setting the threshold to 1 restores the old immediate-alert behavior.
    initial_status = "candidate" if config.MIN_SIGHTINGS_BEFORE_CONFIRMED > 1 else "active"
    return {
        "pothole_id": str(uuid.uuid4())[:8],
        "latitude": detection["latitude"],
        "longitude": detection["longitude"],
        "severity": detection["severity"],
        "confidence": detection["confidence"],
        "first_seen": detection["timestamp"],
        "last_seen": detection["timestamp"],
        "sighting_count": 1,
        "road_type": road_type,
        "status": initial_status,
        "clean_pass_streak": 0,
        "priority_score": None,
        "estimated_repair_cost_inr": None,
    }
