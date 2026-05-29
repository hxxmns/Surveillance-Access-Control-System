import cv2
import requests
import time

SERVER_URL = "https://surveillance-access-control-system-production.up.railway.app//upload_frame"  # ← paste your Railway URL here

cap = cv2.VideoCapture(0)  # 0 = built-in webcam
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

print("📡 Sending camera feed to server...")

while True:
    ret, frame = cap.read()
    if not ret:
        print("Camera read failed, retrying...")
        time.sleep(1)
        continue

    _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])

    try:
        r = requests.post(
            SERVER_URL,
            data=jpeg.tobytes(),
            headers={"Content-Type": "image/jpeg"},
            timeout=3
        )
        print(f"Frame sent: {r.status_code}", end="\r")
    except Exception as e:
        print(f"Send error: {e}")

    time.sleep(0.05)  # ~20 FPS

cap.release()