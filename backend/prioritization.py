"""
Prioritization Module
------------------------
Ranks active potholes for repair crews - not just by severity, but by
severity x road-type traffic weight, since a severe pothole on a quiet
residential lane is lower-risk than a moderate one on a busy highway.
"""
import config


def compute_priority(record: dict) -> float:
    severity_w = config.SEVERITY_WEIGHT.get(record["severity"], 1.0)
    road_w = config.ROAD_TYPE_WEIGHT.get(record.get("road_type", "unknown"), 1.0)
    # Repeated sightings across multiple passes = more confirmed persistent risk
    persistence_w = min(1.0 + 0.1 * (record["sighting_count"] - 1), 2.0)
    return round(severity_w * road_w * persistence_w, 2)


def estimate_repair_cost(record: dict) -> int:
    return config.REPAIR_COST_INR.get(record["severity"], config.REPAIR_COST_INR["minor"])


def rank_potholes(potholes: dict) -> list:
    active = [r for r in potholes.values() if r["status"] in ("active", "reopened")]
    for r in active:
        r["priority_score"] = compute_priority(r)
        r["estimated_repair_cost_inr"] = estimate_repair_cost(r)
    return sorted(active, key=lambda r: r["priority_score"], reverse=True)
