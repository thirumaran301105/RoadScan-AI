"""
Geotagging Module
-------------------
Pairs each processed video frame (or image) with its GPS location, using a
companion GPS track CSV you provide alongside the video/images.

Expected CSV columns (flexible naming, see _find_column): timestamp (seconds
since the start of the recording, or unix time), latitude, longitude.

If you're recording with a phone/dashcam that logs GPS separately, export it
to this format first - most dashcam apps and GPS logger apps support CSV
export.
"""
import pandas as pd
import numpy as np


def _find_column(columns, candidates):
    lower_map = {c.lower().strip(): c for c in columns}
    for cand in candidates:
        if cand in lower_map:
            return lower_map[cand]
    for col_lower, original in lower_map.items():
        for cand in candidates:
            if cand in col_lower:
                return original
    return None


def load_gps_track(csv_path: str) -> pd.DataFrame:
    raw = pd.read_csv(csv_path)
    ts_col = _find_column(raw.columns, ["timestamp", "time", "time_s", "seconds"])
    lat_col = _find_column(raw.columns, ["latitude", "lat"])
    lon_col = _find_column(raw.columns, ["longitude", "lon", "lng"])

    if ts_col is None or lat_col is None or lon_col is None:
        raise ValueError(
            f"Could not detect timestamp/latitude/longitude columns in {csv_path}. "
            f"Found columns: {list(raw.columns)}. Rename them to include "
            f"'timestamp'/'lat'/'lon' or similar."
        )

    out = pd.DataFrame({
        "timestamp": pd.to_numeric(raw[ts_col], errors="coerce"),
        "latitude": pd.to_numeric(raw[lat_col], errors="coerce"),
        "longitude": pd.to_numeric(raw[lon_col], errors="coerce"),
    }).dropna().sort_values("timestamp").reset_index(drop=True)

    if out.empty:
        raise ValueError(f"GPS track {csv_path} had no usable rows after parsing.")

    return out


def nearest_gps_point(gps_track: pd.DataFrame, timestamp: float):
    """Finds the GPS point closest in time to the given timestamp."""
    idx = (gps_track["timestamp"] - timestamp).abs().idxmin()
    row = gps_track.loc[idx]
    return float(row["latitude"]), float(row["longitude"])
