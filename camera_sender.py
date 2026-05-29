import cv2
import requests
import time

SERVER_URL = "https://surveillance-access-control-system-production.up.railway.app/upload_frame"

cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

print("📡 Sending camera feed to server...")

while True:
    try:
        ret, frame = cap.read()
        if not ret:
            print("Camera read failed, retrying...")
            time.sleep(1)
            continue

        frame = cv2.resize(frame, (640, 360))
        _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 30])

        r = requests.post(
            SERVER_URL,
            data=jpeg.tobytes(),
            headers={"Content-Type": "image/jpeg"},
            timeout=10
        )
        print(f"Frame sent: {r.status_code}", end="\r")

    except KeyboardInterrupt:
        print("\nStopping...")
        cap.release()
        break

    except Exception as e:
        print(f"Send error: {e} — retrying in 3 seconds...")
        time.sleep(3)
