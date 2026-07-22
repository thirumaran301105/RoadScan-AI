# RoadScan AI — Pothole & Road Damage Intelligence

**New here? See `QUICKSTART.md` for the fastest path to a running app, and
run `backend/check_setup.py` first if you hit any errors — it diagnoses
common setup problems with a clear message instead of a cryptic
traceback.** Everything below is the fuller reference.

MoRTH's own data, tabled in Parliament, shows 9,438 pothole-related deaths
in India between 2020-2024 — a 53% rise in five years, averaging nearly 5
deaths a day. In October 2025, the Bombay High Court imposed strict
liability on civic bodies for pothole deaths (₹6 lakh compensation per
death). RoadScan AI uses **your own device's camera and GPS** — a laptop
or a phone, right there in the vehicle — to detect potholes continuously,
**warn the driver immediately**, and log each one as a geotagged map
location for repair prioritization. Built on a real, tested
YOLOv8-segmentation model with a React frontend, not a placeholder.

## 1. How input actually works now

**The driver's own device is the camera and the GPS** — not the server:
- Open the app in a browser on the laptop or phone mounted in the vehicle.
- The browser's own camera (`getUserMedia`) captures the road continuously.
- The browser's own location (`navigator.geolocation.watchPosition`) tracks
  the device's real GPS fix continuously.
- Frames + the device's live coordinates stream to the backend over a
  WebSocket; detection runs there and results come straight back.
- The moment a pothole is detected, the driver sees an on-screen warning
  and hears an audio alert — immediately, not after the drive is reviewed.
- The same detection is geotagged with the device's real coordinates and
  logged into the municipal priority list.

This is a deliberate correction from an earlier version of this project
that had the *server* open a camera device directly (`cv2.VideoCapture`) -
that only works if a camera is physically wired to whatever machine runs
the Python backend, which isn't true for "use my laptop or my phone in the
car." The browser-driven design fixes that: the device that's actually in
the vehicle is the one supplying both the camera and the GPS.

**Two other paths still exist, for different situations:**
- **Alternate**: a dedicated in-vehicle unit with its own physically wired
  camera (e.g. a Raspberry Pi bolted into a municipal fleet vehicle) —
  `live_capture.py`, unchanged from before.
- **Secondary (batch)**: processing already-recorded dashcam footage after
  the fact — `upload_pass`, unchanged from before.

## 2. What's real vs. what's illustrative

- **The detection model is real and MIT-licensed** — verified to detect a
  real pothole photo at 81% confidence, classified "severe."
- **Road type is now detected automatically from GPS** — no more manual
  dropdown. `road_classifier.py` reverse-geocodes the device's coordinates
  against OpenStreetMap's own road classification (`highway=motorway` →
  National Highway, `highway=residential` → Residential Road, etc.), with
  caching so normal driving doesn't hammer the API.
  - **Important limitation**: my sandboxed development environment's
    network access is restricted to a fixed allowlist that does NOT
    include `nominatim.openstreetmap.org` (confirmed directly - the
    request came back `host_not_allowed`). The mapping/caching/fallback
    logic was fully tested with a mocked response and works correctly,
    and the live server was confirmed to call this endpoint without
    crashing (gracefully falling back to `"unknown"` when the network
    call fails) - but **the actual live OSM lookup itself needs testing
    from your own machine**, which has normal internet access.
- **Fixed: "No GPS fix yet" no longer means nothing happens.** Previously,
  detections without a GPS fix were silently dropped. Now detection still
  runs and the driver still gets warned (visual + audio) even before GPS
  locks on - it just isn't logged to the map until a location is
  available. This was the actual cause of the error message you hit, and
  it's now a real fallback path rather than a dead end. See the GPS
  troubleshooting note below for why laptops in particular can take a
  while (or fail) to get a fix at all.
- **The new browser-streaming path was tested against the actual running
  server**: a real pothole photo, base64-encoded exactly as a browser's
  `canvas.toDataURL()` would produce it, sent over a real WebSocket to the
  real FastAPI backend, ran through real YOLO-seg inference in a thread
  executor, and came back with the correct detection, correct geotagging,
  and a correctly-fired driver alert. This is an actual server response
  captured during testing, not a mocked example:
  ```json
  {"type":"frame_result","detections":[{"confidence":0.808,"severity":"severe","bbox":[14,0,1448,579],"pothole_id":"aba1c8c7"}],
   "alerts":[{"type":"pothole_alert","severity":"severe","message":"SEVERE POTHOLE AHEAD - SLOW DOWN","urgent":true}]}
  ```
- **The React build was verified to compile and to be served correctly**
  by the actual backend (confirmed via a real HTTP request returning the
  rendered page).
- **What I could NOT test in this sandboxed environment**: an actual
  laptop webcam or phone camera through a real browser, a real GPS fix
  from real hardware, and the live OpenStreetMap road lookup - this
  sandbox has none of these. The code paths are standard, well-supported
  APIs, but verify camera/GPS permission prompts and the road-type lookup
  on your actual target device before a demo.
- **Severity thresholds, road-type traffic weights, and repair cost tiers
  are planning-level assumptions**, not verified municipal costings.

## 2b. Troubleshooting "no GPS fix" / GPS taking a long time

This is genuinely common, especially on laptops, and it's worth
understanding why rather than just waiting blindly:

- **Laptops usually don't have a real GPS chip.** Browsers instead use
  WiFi-based positioning (matching nearby WiFi networks against a location
  database) or fall back to IP-based location, both far less precise and
  sometimes unavailable entirely if location services are off at the OS
  level.
- **The browser's own permission prompt is not enough on desktop OSes.**
  Windows and macOS both have a separate, OS-level location services
  toggle that the browser also depends on:
  - **Windows**: Settings → Privacy & Security → Location → make sure
    it's turned on, and that your browser is allowed under "Let apps
    access your location."
  - **Mac**: System Settings → Privacy & Security → Location Services →
    turn it on, and enable it for your browser specifically.
- **Phones are far more reliable** for this - a real GPS chip usually
  gets a fix within a few seconds outdoors.
- The updated `useGeolocation` hook now surfaces which of these is likely
  the problem (permission denied vs. position unavailable vs. timeout)
  instead of one generic error message.

## 2c. "My location is off by thousands of km" (e.g. ±20,000 km)

This is a different, more specific problem than ordinary GPS imprecision,
and it has a specific likely cause. Ordinary WiFi/IP-based fallback is
imprecise (hundreds of meters to a few km) - it does not normally put you
on the wrong side of the planet. An error in the **thousands of km**
almost always means one thing:

**You're loading this app over plain HTTP on your phone, not HTTPS.**

Browsers treat unencrypted pages (anything except `https://` or
`localhost`) as untrusted for sensitive APIs. On an insecure origin,
`navigator.geolocation` either gets blocked outright or silently falls
back to a low-quality/broken estimate instead of asking the OS for a real
GPS fix - which is exactly why a **native app** like Google Maps (which
isn't bound by browser security rules) shows your correct location on the
same phone, while this web app gets something nonsensical.

**The fix: serve the app over HTTPS when testing from a phone.**
The simplest way is a tunnel:

```bash
# Install once: https://ngrok.com/download
ngrok http 8000
```
This gives you an `https://something.ngrok-free.app` URL - open **that**
URL on your phone instead of `http://<your-laptop-ip>:8000`. Location and
camera permissions will then work exactly as they should, because the
origin is now secure.

(`localtunnel` and Cloudflare Tunnel `cloudflared` are equivalent free
alternatives if you'd rather not use ngrok.)

**After switching to HTTPS, if accuracy is still not what you expect**,
that's the point where it becomes a genuine hardware/OS-permission
question rather than a code problem - see section 2b above and section 4
below for what's actually within reach (Android's separate "Precise
location" permission toggle is the other common culprit specifically on
phones, distinct from the general browser permission prompt).

## 3. Detection accuracy and speed - what's fixable and what's a hard limit

Two different problems came up during testing, worth separating clearly:

### "It doesn't detect potholes even walking"
This is almost certainly the bundled model's real accuracy ceiling, not a
bug. It's a community-trained YOLOv8 model on roughly 2,800 labeled
images (see section 9) - it may simply not recognize potholes that look
different from what it was trained on (different lighting, road surface,
country, camera angle). I verified the pipeline itself works correctly
end-to-end using the model's own training-adjacent test photo (81%
confidence, correctly classified) - so the code path is sound. What
would genuinely fix this: fine-tuning the model further on real photos
from your own roads (this needs a labeled dataset of your own conditions,
which is a real undertaking, not something I can generate for you), or
lowering `CONF_THRESHOLD` in `config.py` (currently 0.25) to catch
lower-confidence detections - at the cost of more false positives.

### "It can't keep up at 40 km/h or above"
This one has a fixable part, a corrected-mistake part, and a hard-limit part.

**Fixed**: frame sampling used to be a flat time interval (every 1.2s
regardless of speed) - at 40 km/h that let ~13 meters pass between each
photo taken, so a pothole entirely within that gap was never seen at all.
It's now **distance-based**: a new frame is captured roughly every 8
meters of actual travel, so faster movement automatically triggers more
frequent captures instead of leaving bigger blind spots.

**A mistake I made and corrected**: I had previously told you CPU
inference takes ~1 second per frame, and used that to argue highway speed
"won't work" without a GPU. That number was wrong - it came from a single
un-warmed, cold-start measurement (the very first time the model was ever
loaded), not steady-state performance. I re-benchmarked the actual
production `detect_frame()` function directly, averaged over 8 runs after
a warm-up call, and measured **~70ms per frame**, not 1000ms - about 14x
faster than I'd said. At 80 km/h (22.2 m/s), that's ~1.5 meters of travel
during inference, not ~22 meters. This is a meaningfully better starting
point than what I described earlier, and the frame-interval floor in
`useFrameStreamSocket.js` has been updated from 800ms down to 200ms to
reflect this.

**What's honestly still a real cost, and can't be measured from my
sandbox**: the end-to-end delay the driver actually experiences is photo
→ JPEG-encode on the phone → network round-trip (through your ngrok
tunnel) → ~70ms inference → JSON response → back over the network. The
70ms is now the *smallest* part of that chain, not the bottleneck - your
actual network latency is likely dominant. I don't have a way to measure
your specific network conditions from here.

**Where a GPU/edge device still genuinely helps**: not because CPU
inference is slow (it isn't, at ~70ms) but because on-device inference
(see section 4 below) eliminates the network round-trip entirely, which
is now the more significant remaining delay.

I also tested exporting the model to ONNX format, expecting a speedup -
the actual benchmark showed ONNX running *slower* (~258ms vs ~72ms) on
this specific CPU, which is the opposite of the general expectation. This
is a good example of why "should be faster" claims need testing on your
actual target hardware rather than trusting general defaults - results
vary a lot by platform, and I'm reporting what I actually measured rather
than what's commonly assumed.

### What "good" actually looks like, quantitatively
I looked for a better pretrained alternative to the bundled model. The
most credible one found publishes real, independently measured metrics on
9,300 combined images (over 3x the bundled model's training set): **mAP@50
66.4%, Precision 77.4%, Recall 59.4%**. A recall of 59.4% means even this
larger, better-documented model misses roughly 4 in 10 real potholes. This
isn't a knock on that model - it's the honest current ceiling for this
problem at real-time speed, and useful context for what "accurate" means
in practice right now, not "detects everything." I didn't wire this model
in - it's hosted through Roboflow's own API (needs your own account/key)
rather than a plain downloadable file, and I don't want to integrate
something I haven't personally verified the way I tested the bundled one.

### Multi-frame confirmation (implemented) - what it does and doesn't gate
A single detected frame can be a false positive - motion blur, a shadow,
an oil stain, one bad-lighting moment. **Important distinction, since I
found and fixed a real inconsistency here**: this does **not** delay the
driver alert. A brand-new detection fires the driver warning immediately,
the very first time it's seen - a real hazard needs a warning the moment
it's detected, not after you've driven past it twice (a normal single
drive-past only ever sees a given pothole once, so gating the *alert*
behind re-confirmation would mean it almost never actually warns anyone).

What confirmation *does* gate: whether a pothole counts as **confirmed**
and joins the official municipal repair-priority queue, versus staying an
unconfirmed **candidate** (visible on the map as a smaller, dimmer marker,
but not yet repair-queue-worthy) until it's seen again
(`config.MIN_SIGHTINGS_BEFORE_CONFIRMED`, default 2). That's a sensible
place to filter single-frame false positives, since the repair queue is
evaluated over repeated passes (e.g. a fleet driving the same route over
several days), not a single drive.

**Tested directly, and this specific test caught a real bug** (see
below): first sighting → status `candidate`, alert fires immediately;
second sighting at the same spot → status promotes to `active`
(repair-queue-worthy), and the alert is correctly suppressed by the
*separate* 45-second cooldown, not by confirmation status; after manually
expiring the cooldown, a further sighting correctly re-alerts. Database
persistence was confirmed correct at every step.

**The bug this caught**: `config.py` had `MIN_SIGHTINGS_BEFORE_CONFIRMED`
mistakenly set to `1` (which disables the candidate stage entirely - every
detection instantly counts as "confirmed") alongside a comment that
inaccurately described alerts as being gated by confirmation, which they
never actually were in the code. Both are now fixed and consistent:
the config default is `2`, and the comment correctly explains that only
repair-queue status is gated, not the alert.

I also found and fixed a related bug while re-verifying this:
`database.load_all_potholes()` would crash on a completely fresh
install (no table created yet) instead of creating its schema
defensively first - now fixed.

Set `MIN_SIGHTINGS_BEFORE_CONFIRMED = 1` in `config.py` if you'd rather
have every single detection immediately count as repair-queue-worthy too
(no candidate stage at all).


Worth being direct about this distinction: I'm a general-purpose language
model, not the vision system doing the detecting. The pothole detector is
a completely separate, specialized computer vision model (YOLOv8) that
works nothing like how I process information - there's no way to transfer
"how I reason" into it. If you wanted an actual multimodal AI model
analyzing each frame instead of YOLO, that's a real alternative
architecture, but it would trade away the one thing this needs to work at
driving speed at all: YOLO-style detectors exist specifically because
they're fast; general vision-language models are considerably slower and
more expensive per frame, which would make the highway-speed problem
above worse, not better.

## 4. Edge AI hardware, and persistent storage

### Is dedicated edge AI hardware possible here?
Yes - this is exactly what real ADAS/driver-assist systems use, and the
codebase already has a path for it: `live_capture.py` (the "alternate:
dedicated in-vehicle unit" flow) is designed for a device with its own
physically-attached camera, which is exactly the shape of a Jetson-class
board. Concretely, a device like an **NVIDIA Jetson Orin Nano** running
this same YOLOv8-seg model with TensorRT optimization would:
- Eliminate the network round-trip entirely (inference happens right
  where the camera is, in the vehicle)
- Run at real GPU speed rather than CPU speed
- Pair with a real GPS module over serial (`gps_provider.SerialGPS` is
  already built for this) instead of relying on a phone's location

**I could not test actual Jetson hardware from this sandboxed
environment** - I don't have one. What I did verify: the existing
`live_capture.py` code path is structured correctly to accept this kind
of dedicated hardware (camera + GPS device both physically attached to
one board, no browser involved), so this is a matter of buying/wiring the
hardware and pointing `POTHOLE_MODEL_PATH` at the same model file, not a
code rewrite. If you want to pursue this, TensorRT export
(`model.export(format='engine')`) is the next real step, and would need
testing on the actual target device, not here.

### Persistent database storage (implemented)
Previously, every detected pothole lived only in memory and vanished on
every server restart - a real gap. This is now backed by **SQLite**
(`backend/database.py`), which is built into Python and needs no separate
database server to install or run:
- Every new detection, status change (repaired/reopened), and batch
  upload is persisted to `backend/data/roadscan.db`
- On server startup, all previously-known potholes are loaded back in
  automatically
- **Tested directly**: I detected a pothole, saved it, then loaded it in
  a completely separate, freshly-started Python process (simulating a
  real server restart) and confirmed the record - including its status -
  came back correctly.

This is intentionally a lightweight, file-based database appropriate for
a single-server prototype. For a multi-server production deployment,
PostGIS (a geospatial-aware Postgres extension) would be the natural next
step - noted in section 10.



## 5. Map provider: Google Maps

The live map now uses the Google Maps JavaScript API instead of
OpenStreetMap/Leaflet.

**Getting a key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/), create
   a project (or use an existing one).
2. Enable billing on the project (Google requires this even for free-tier
   usage - Maps Platform gives a recurring monthly credit that covers
   normal development use).
3. Enable the **"Maps JavaScript API"** under APIs & Services.
4. Create an API key under Credentials, and (recommended) restrict it to
   your domain/localhost and to the Maps JavaScript API specifically.
5. Copy `frontend-react/.env.example` to `frontend-react/.env` and set
   `VITE_GOOGLE_MAPS_API_KEY=your_key_here`, then rebuild
   (`npm run build`).

Without a key set, the map area shows a clear setup notice instead of
silently failing or crashing - I couldn't generate or test a real key
myself in this environment, so verify the actual rendering on your end.

## 6. Important: the map provider and location accuracy are two different things

This is worth being direct about, since it's a common mix-up: **switching
from Leaflet to Google Maps changes how the map is drawn - it has no
effect on how accurate your device's reported location is.**

Here's why. Two completely separate systems are involved:
- **The map library** (Leaflet or Google Maps) only draws tiles and
  markers on screen. It receives a latitude/longitude and renders it -
  it has no way to make that latitude/longitude itself more precise.
- **The location itself** comes from `navigator.geolocation`, a browser
  API that asks the operating system for the device's best available
  position. The OS uses, in order of precision: a real GPS chip (phones)
  → WiFi-based positioning (matching nearby networks against a location
  database - most laptops) → IP-based geolocation (worst, sometimes
  city-level only, if nothing else is available).

No JavaScript library - Google Maps included - can bypass this. The
browser is already asking for the best position the device is capable of
(`enableHighAccuracy: true` is set in `useGeolocation.js`). If a laptop
has no GPS chip, no amount of software can manufacture GPS-chip-level
precision from WiFi signal strength alone - that's a hardware ceiling.

**What I did improve, honestly:**
- `maximumAge: 0` - every reading is fresh, never a stale cached one.
- The hook now keeps the **best** (lowest accuracy-radius) reading seen in
  a rolling ~8 second window instead of just whatever arrived most
  recently, since consecutive readings can jitter even on the same
  device. This reduces noise; it does not raise the hardware ceiling.
- The map now draws an **accuracy circle** around your device's position
  showing the browser's actual reported uncertainty radius - so instead
  of a pin implying false precision, you can see exactly how precise (or
  imprecise) the current fix really is.
- The status bar labels the accuracy in plain terms (Excellent / Good /
  Fair / Poor) instead of just a raw meter number nobody has real
  intuition for.

**What would actually fix low accuracy, if it matters for your use case:**
- **Test on a phone, not a laptop** (over HTTPS - see 2c above). This was
  the original design intent - a real GPS chip outdoors typically gets
  5-20m accuracy within seconds, vastly better than a laptop's WiFi-based
  estimate.
- **On Android specifically, check "Precise location" is ON for your
  browser app**: Settings → Apps → [your browser] → Permissions →
  Location → there are two toggles, "Precise" and "Approximate" (Android
  12+). If only Approximate is granted, you can get accuracy in the
  multi-km range even with a perfectly good GPS chip and a secure HTTPS
  connection - the OS is deliberately withholding precision.
- **A dedicated external GPS receiver** for a permanent in-vehicle
  install - the codebase already supports this via `gps_provider.SerialGPS`
  in the alternate (non-browser) hardware path, reading real NMEA
  sentences from a proper GPS module over serial.
- I deliberately did **not** wire up Google's separate Geolocation API
  (a different product from Maps JavaScript API, used for server-side
  position estimation) as a "fix" here, because for a browser page it
  would only have IP-based data to work with (browsers don't expose raw
  WiFi/cell scan data to web pages for privacy reasons) - which is
  typically less accurate than a laptop's own OS-level WiFi positioning,
  not more. Recommending it would have made accuracy worse while sounding
  like an upgrade.

CPU-only YOLO-seg inference took roughly 1 second per frame in testing.
The frontend deliberately sends frames at a fixed interval
(`FRAME_INTERVAL_MS` in `useFrameStreamSocket.js`, default 1200ms) rather
than every camera frame, so the backend never falls behind a flood of
requests. For a real deployment, run on a GPU or an edge AI device to
safely lower that interval and get closer to real-time warning lead time
at highway speed.

## 7. Setup

```bash
cd roadscan-ai
python3 -m venv venv && source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set up your Google Maps API key (see section 3 above)
cd frontend-react
cp .env.example .env
# edit .env and paste your real key in

# Build the React dashboard (one-time, or whenever you change frontend-react/src)
npm install
npm run build
cd ..

cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Open **http://localhost:8000** on the device you want to use as the
in-vehicle unit (your laptop, or your phone's browser) — you'll land on
the **Driver View** tab.

### Important: camera/GPS permissions need HTTPS (except on localhost)
Browsers only allow `getUserMedia`/`navigator.geolocation` on secure
origins. Testing on the same machine via `localhost:8000` works fine. To
test from a **phone** on your network, you'll need HTTPS (a reverse proxy
with a certificate, or a tool like `ngrok`/`localtunnel`) — plain
`http://<your-laptop-ip>:8000` from a phone will be blocked from using the
camera/GPS by the phone's browser.

### Trying it
1. Click **Start Watching** — your browser will prompt for camera and
   location permission.
2. Point the camera at some road footage (even a photo/video playing on
   another screen works for a demo) — detections stream back with
   bounding box overlays and alerts fire immediately for anything found.
3. Switch to **Management Dashboard** to see it appear on the live map
   (with your device's own current position also marked) and in the
   priority repair list.

### Iterating on the UI
```bash
# terminal 1: backend as usual
cd backend && uvicorn main:app --reload

# terminal 2: React dev server with hot reload
cd frontend-react && npm run dev
```
Work at the URL Vite prints (usually **http://localhost:5173**) instead of
port 8000 - it proxies API/WebSocket calls to your running backend.

### If you don't want Node/npm at all
The backend automatically falls back to the plain HTML/JS dashboard in
`frontend/` (no build step) if it doesn't find a `frontend-react/dist`
folder - though that version doesn't have the new camera/GPS-driven
Driver View; it's the older upload-based interface.

## 8. Trying the batch/repair-verification demo sequence

```bash
cd sample_data
python3 generate_sample_pass_data.py   # regenerates the 3 test passes if needed
```

Then, under the Management Dashboard's Batch Upload panel, upload in order:
1. `pass1_pothole_present_gps.csv` + `pass1_pothole_present/*.jpg` — detects
   a **real** pothole photo, creates an active record
2. `pass2_after_repair_gps.csv` + `pass2_after_repair/*.jpg` — first clean
   pass, pothole stays active with `clean_pass_streak: 1`
3. `pass3_confirm_repair_gps.csv` + `pass3_confirm_repair/*.jpg` — second
   clean pass, pothole automatically flips to `likely_repaired`

## 9. Project layout

```
roadscan-ai/
├── backend/
│   ├── config.py              Severity thresholds, dedup radius, cost tiers, alert cooldown
│   ├── detection_module.py     Real YOLOv8-seg pothole detection
│   ├── frame_stream.py           Processes browser-streamed frames (PRIMARY path)
│   ├── database.py                 SQLite persistence - potholes survive restarts
│   ├── gps_provider.py            Simulated route / phone-pushed / serial GPS (alternate path only)
│   ├── alert_manager.py            Driver alert firing + per-pothole cooldown
│   ├── live_capture.py              Server-attached camera loop (alternate path)
│   ├── geotagging.py                 Flexible GPS CSV loading (batch mode)
│   ├── deduplication.py               Haversine-based incremental pothole matching
│   ├── repair_tracker.py               Closed-loop "likely repaired" verification (batch mode)
│   ├── prioritization.py                Severity x road-type x persistence ranking
│   ├── models.py                         Pydantic schemas
│   ├── test_frame_stream_ws.py             WebSocket test for the primary path
│   ├── test_live_pipeline.py                 Test for the alternate server-camera path
│   └── main.py                                FastAPI app - all three paths
├── frontend-react/               React dashboard (Vite) - Driver View + Management Dashboard
│   ├── .env.example                 Copy to .env, add your Google Maps API key
│   └── src/
│       ├── hooks/useCamera.js       getUserMedia capture
│       ├── hooks/useGeolocation.js   navigator.geolocation tracking + best-of-window accuracy
│       ├── hooks/useFrameStreamSocket.js   WebSocket streaming to the backend
│       ├── hooks/useRoadType.js       Polls auto-detected road type
│       └── components/                       CameraFeed, AlertBanner, LiveMap (Google Maps), etc.
├── frontend/                    Plain HTML/JS fallback (older upload-based interface)
├── models/
│   ├── pothole_yolov8_seg.pt    Real, MIT-licensed, verified-working model
│   └── POTHOLE_MODEL_LICENSE.txt
├── sample_data/
│   ├── generate_sample_pass_data.py
│   ├── real_pothole_test_image.png   Real photo, used across all test paths
│   └── pass1/2/3_*                    Generated batch-mode test passes
└── requirements.txt
```

## 10. Why segmentation (not just bounding boxes)

The model outputs pixel-level masks, not just rectangles. Severity is
classified from the mask's actual pixel area as a fraction of the frame —
a meaningfully better size proxy than a bounding box, which can be much
larger than the actual pothole if the shape is irregular.

## 11. What I'd build next with more time

- **Faster inference** — export to ONNX/TensorRT or run on edge AI hardware
  so the frame-send interval can drop well below 1.2s even at highway speed.
- **Real repair cost and traffic volume data**, replacing the placeholder
  assumptions in `config.py`.
- **Distance/depth estimation** so alert timing can account for how far
  ahead the pothole actually is, not just that it's been seen.
- **Offline/PWA support** so the driver view keeps capturing frames and
  queues them for upload even through brief connectivity gaps - common on
  Indian highways.
- **PostGIS-backed storage** instead of in-memory state, so the system
  persists across restarts and scales beyond a single process.
- **Physical buzzer/LED alert** for a more permanent in-vehicle install
  without a screen the driver can safely glance at - the same serial-
  command pattern from the Industrial Guardian project's ESP32 firmware
  would drop in easily here.
