"""
End-to-end test of the live capture pipeline over real HTTP + WebSocket
requests. Note: total run time depends on your CPU's YOLO-seg inference
speed (config.LIVE_DETECT_EVERY_N_FRAMES controls how often detection
runs) - on a slow CPU, increase the listen window below if you don't see
an alert in time.
"""
import asyncio
import time
import requests
import websockets
import json

BASE = "http://127.0.0.1:8000"

def main():
    print("=== Starting live capture (simulated source, simulated GPS) ===")
    resp = requests.post(f"{BASE}/api/live/start", data={
        "source": "simulated", "gps_mode": "simulated", "road_type": "arterial_road"
    })
    print(resp.status_code, resp.json())

    print("=== Listening on /ws/live for alerts (15s window) ===")
    asyncio.run(listen_for_alerts(15))

    print("=== Live status ===")
    print(requests.get(f"{BASE}/api/live/status").json())

    print("=== Potholes detected so far ===")
    print(json.dumps(requests.get(f"{BASE}/api/potholes/all").json(), indent=2))

    print("=== Stopping live capture ===")
    print(requests.post(f"{BASE}/api/live/stop").json())


async def listen_for_alerts(duration):
    async with websockets.connect("ws://127.0.0.1:8000/ws/live") as ws:
        end_time = time.time() + duration
        count = 0
        while time.time() < end_time:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=end_time - time.time())
                alert = json.loads(msg)
                count += 1
                print(f"  ALERT #{count}: {alert['severity']} - {alert['message']} @ ({alert['latitude']:.5f}, {alert['longitude']:.5f})")
            except asyncio.TimeoutError:
                break
        print(f"  Total alerts received in this window: {count}")


if __name__ == "__main__":
    main()
