"""
Road Type Classifier
-----------------------
Determines road type automatically from GPS coordinates using
OpenStreetMap's road network data (via the Nominatim reverse-geocoding
API), instead of requiring the driver to manually pick a road type.

Why GPS-based, not camera-based: reliably classifying road type (highway
vs. residential street) from a dashcam image alone is a separate, hard
computer-vision problem needing its own trained classifier. Unlike the
pothole model, there's no verified real pretrained model for this being
bundled here, so rather than fake a CV heuristic and present it as
reliable, this uses OpenStreetMap's actual road classification tags -
data that already exists for the vast majority of roads worldwide, and is
what OSM contributors have already surveyed and classified.

IMPORTANT - network limitation during development: this network egress in
my sandboxed development environment is restricted to a fixed domain
allowlist that does NOT include nominatim.openstreetmap.org (confirmed via
a direct test - the request was rejected with "host_not_allowed"). This
code follows Nominatim's publicly documented reverse-geocoding API
exactly, and the parsing/caching/mapping logic below was tested against a
realistic mocked response - but the live network call itself has not been
verified end-to-end. Test it against the real API from your own machine
before a demo. Nominatim's usage policy also caps free usage at roughly 1
request/second with a required User-Agent - the caching here keeps normal
driving well under that.
"""
import time
from typing import Dict, Optional, Tuple

import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "RoadScanAI-Prototype/1.0 (hackathon project; contact: set-your-email@example.com)"
REQUEST_TIMEOUT_SECONDS = 3.0

# Maps OpenStreetMap's `highway` way-tag values to our internal categories.
# See https://wiki.openstreetmap.org/wiki/Key:highway for the full tag list.
OSM_HIGHWAY_TO_ROAD_TYPE = {
    "motorway": "national_highway",
    "motorway_link": "national_highway",
    "trunk": "national_highway",
    "trunk_link": "national_highway",
    "primary": "state_highway",
    "primary_link": "state_highway",
    "secondary": "arterial_road",
    "secondary_link": "arterial_road",
    "tertiary": "arterial_road",
    "tertiary_link": "arterial_road",
    "residential": "residential_road",
    "living_street": "residential_road",
    "unclassified": "residential_road",
    "service": "residential_road",
    "road": "residential_road",
}

# Rounding lat/lon to ~11m grid cells means nearby detections along the same
# stretch reuse one lookup instead of hitting the API on every frame.
CACHE_GRID_DECIMALS = 4
CACHE_TTL_SECONDS = 300

_cache: Dict[Tuple[float, float], Tuple[str, float]] = {}


def _cache_key(latitude: float, longitude: float) -> Tuple[float, float]:
    return (round(latitude, CACHE_GRID_DECIMALS), round(longitude, CACHE_GRID_DECIMALS))


def classify_road_type(latitude: float, longitude: float) -> str:
    """Returns one of our internal road_type categories - falls back to
    'unknown' if the lookup fails, times out, or the tag isn't recognized.
    Never raises - a road-classification hiccup should never break the
    pothole detection pipeline around it."""
    key = _cache_key(latitude, longitude)
    cached = _cache.get(key)
    if cached and (time.time() - cached[1]) < CACHE_TTL_SECONDS:
        return cached[0]

    road_type = "unknown"
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={"lat": latitude, "lon": longitude, "format": "jsonv2", "zoom": 17},
            headers={"User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        data = resp.json()
        road_type = _map_osm_response(data)
    except Exception as e:
        print(f"[road_classifier] Lookup failed for ({latitude}, {longitude}): {e}")

    _cache[key] = (road_type, time.time())
    return road_type


def _map_osm_response(data: dict) -> str:
    """Pulled out separately so the mapping logic itself can be unit
    tested with a fake response, without needing a real network call."""
    if data.get("category") != "highway":
        return "unknown"
    osm_type = data.get("type", "")
    return OSM_HIGHWAY_TO_ROAD_TYPE.get(osm_type, "unknown")
