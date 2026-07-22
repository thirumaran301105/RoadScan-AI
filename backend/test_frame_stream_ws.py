import asyncio
import base64
import json
import cv2
import websockets


async def main():
    frame = cv2.imread("../sample_data/real_pothole_test_image.png")
    ok, buf = cv2.imencode(".jpg", frame)
    b64 = base64.b64encode(buf.tobytes()).decode("utf-8")
    data_url = "data:image/jpeg;base64," + b64

    async with websockets.connect("ws://127.0.0.1:8000/ws/frame_stream") as ws:
        await ws.send(json.dumps({
            "frame": data_url,
            "latitude": 12.9716,
            "longitude": 77.5946,
            "road_type": "arterial_road",
        }))
        response = await asyncio.wait_for(ws.recv(), timeout=15)
        print("SERVER RESPONSE:", response)


if __name__ == "__main__":
    asyncio.run(main())
