"""
Generates sample test data for RoadScan AI:
  - Pass 1: uses the REAL pothole photo (from the model's own repo) at one
    GPS point along a short synthetic route - tests real detection.
  - Pass 2 & 3: same route, but the pothole location now shows a synthetic
    plain road patch instead - tests the repair-verification logic (this
    only tests the PIPELINE's logic, not real-world "does it look repaired"
    accuracy, since the clean-road image is synthetic, not a real photo).

Each pass gets its own GPS CSV (timestamp, latitude, longitude) and a
matching folder of images, one per GPS point, in order.
"""
import os
import numpy as np
from PIL import Image, ImageDraw
import pandas as pd

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
REAL_POTHOLE_IMG = os.path.join(OUT_DIR, "real_pothole_test_image.png")

# A short synthetic route: 5 GPS points, ~15m apart, pothole at point index 2
ROUTE = [
    (12.9716, 77.5946),
    (12.97165, 77.59465),
    (12.9717, 77.5947),   # <- pothole location
    (12.97175, 77.59475),
    (12.9718, 77.5948),
]


def make_clean_road_image(path, size=(640, 480)):
    """Synthetic plain asphalt-colored image - NOT a real photo, only for
    testing the repair-verification pipeline logic."""
    img = Image.new("RGB", size, (70, 68, 66))
    draw = ImageDraw.Draw(img)
    rng = np.random.default_rng(0)
    # light texture noise so it's not a flat solid color
    for _ in range(4000):
        x, y = rng.integers(0, size[0]), rng.integers(0, size[1])
        shade = int(rng.integers(-10, 10))
        draw.point((x, y), fill=(70 + shade, 68 + shade, 66 + shade))
    # lane marking
    draw.rectangle([size[0]//2 - 4, 0, size[0]//2 + 4, size[1]], fill=(210, 200, 180))
    img.save(path)


def build_pass(pass_name: str, pothole_present: bool):
    pass_dir = os.path.join(OUT_DIR, pass_name)
    os.makedirs(pass_dir, exist_ok=True)

    rows = []
    for i, (lat, lon) in enumerate(ROUTE):
        img_path = os.path.join(pass_dir, f"frame_{i}.jpg")
        if i == 2 and pothole_present:
            Image.open(REAL_POTHOLE_IMG).convert("RGB").save(img_path)
        else:
            make_clean_road_image(img_path)
        rows.append({"timestamp": i * 2.0, "latitude": lat, "longitude": lon})

    gps_df = pd.DataFrame(rows)
    gps_csv_path = os.path.join(OUT_DIR, f"{pass_name}_gps.csv")
    gps_df.to_csv(gps_csv_path, index=False)
    print(f"Built {pass_name}: {len(rows)} frames -> {pass_dir}, GPS -> {gps_csv_path}")


if __name__ == "__main__":
    build_pass("pass1_pothole_present", pothole_present=True)
    build_pass("pass2_after_repair", pothole_present=False)
    build_pass("pass3_confirm_repair", pothole_present=False)
