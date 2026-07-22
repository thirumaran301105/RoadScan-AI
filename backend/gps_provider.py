"""
GPS Provider
--------------
Abstracts "where is the vehicle right now" so live_capture.py doesn't care
whether that comes from real hardware, a phone's browser, or a simulated
route for demo purposes.

Three modes:
  - SimulatedRouteGPS: advances along a fixed route over wall-clock time.
    Use this to demo/test the live pipeline without any real GPS hardware.
  - PushedGPS: a phone or laptop browser pushes its own location via
    POST /api/gps_update (uses the standard browser Geolocation API) -
    the realistic option for an actual driver-facing deployment.
  - SerialGPS: reads NMEA sentences from a real GPS module over serial
    (e.g. a u-blox NEO-6M on a Raspberry Pi / Arduino rig in the vehicle).
"""
import time
import threading
from typing import Optional, Tuple, List


class GPSProvider:
    def get_current_position(self) -> Optional[Tuple[float, float]]:
        raise NotImplementedError

    def start(self):
        pass

    def stop(self):
        pass


class SimulatedRouteGPS(GPSProvider):
    """Moves along a fixed list of (lat, lon) waypoints at a constant pace,
    looping once it reaches the end. For demo/testing only - clearly not a
    real vehicle's position."""

    def __init__(self, route: List[Tuple[float, float]], seconds_per_waypoint: float = 3.0):
        self.route = route
        self.seconds_per_waypoint = seconds_per_waypoint
        self._start_time = time.time()

    def get_current_position(self) -> Tuple[float, float]:
        elapsed = time.time() - self._start_time
        idx = int(elapsed / self.seconds_per_waypoint) % len(self.route)
        return self.route[idx]


class PushedGPS(GPSProvider):
    """Latest position pushed from a client (e.g. a phone's browser using
    navigator.geolocation) via POST /api/gps_update. This is the realistic
    mode for an actual in-vehicle deployment - no special GPS hardware
    needed beyond the phone already mounted for the camera."""

    def __init__(self):
        self._lock = threading.Lock()
        self._position: Optional[Tuple[float, float]] = None
        self._last_update = 0.0

    def push_position(self, latitude: float, longitude: float):
        with self._lock:
            self._position = (latitude, longitude)
            self._last_update = time.time()

    def get_current_position(self) -> Optional[Tuple[float, float]]:
        with self._lock:
            if self._position is None:
                return None
            # Stale-data guard: if no update in 30s, position is unreliable
            if time.time() - self._last_update > 30:
                return None
            return self._position


class SerialGPS(GPSProvider):
    """Reads standard NMEA GPGGA sentences from a real GPS module over
    serial. Requires pyserial and a connected GPS receiver."""

    def __init__(self, port: str, baud: int = 9600):
        self.port = port
        self.baud = baud
        self._lock = threading.Lock()
        self._position: Optional[Tuple[float, float]] = None
        self._running = False
        self._ser = None

    def start(self):
        import serial
        try:
            self._ser = serial.Serial(self.port, self.baud, timeout=2)
        except Exception as e:
            print(f"[gps_provider] Could not open serial GPS on {self.port}: {e}")
            return
        self._running = True
        threading.Thread(target=self._loop, daemon=True).start()

    def stop(self):
        self._running = False
        if self._ser:
            self._ser.close()

    def _loop(self):
        while self._running:
            try:
                line = self._ser.readline().decode("ascii", errors="ignore").strip()
                if line.startswith("$GPGGA") or line.startswith("$GNGGA"):
                    parsed = self._parse_gpgga(line)
                    if parsed:
                        with self._lock:
                            self._position = parsed
            except Exception as e:
                print(f"[gps_provider] serial read error: {e}")
                time.sleep(1)

    @staticmethod
    def _parse_gpgga(sentence: str) -> Optional[Tuple[float, float]]:
        parts = sentence.split(",")
        if len(parts) < 6 or not parts[2] or not parts[4]:
            return None
        try:
            lat_raw, lat_dir = parts[2], parts[3]
            lon_raw, lon_dir = parts[4], parts[5]
            lat = int(float(lat_raw) / 100) + (float(lat_raw) % 100) / 60
            lon = int(float(lon_raw) / 100) + (float(lon_raw) % 100) / 60
            if lat_dir == "S":
                lat = -lat
            if lon_dir == "W":
                lon = -lon
            return (lat, lon)
        except (ValueError, IndexError):
            return None

    def get_current_position(self) -> Optional[Tuple[float, float]]:
        with self._lock:
            return self._position
