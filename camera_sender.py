import cv2
import socketio
import time

# ---- CHANGE THIS TO YOUR RAILWAY URL ----
SERVER_URL = "https://surveillance-access-control-system-production.up.railway.app"
# When testing locally, use:
# SERVER_URL = "http://localhost:5000"

# ---- CHANGE THIS TO YOUR CAMERA ----
# Webcam:       0
# IP Camera:    "rtsp://username:password@192.168.1.64/stream"
CAMERA_SOURCE = 0

sio = socketio.Client()

@sio.event
def connect():
    print("✅ Connected to server!")

@sio.event
def disconnect():
    print("❌ Disconnected from server.")

print(f"📡 Connecting to {SERVER_URL}...")
sio.connect(SERVER_URL)

cap = cv2.VideoCapture(CAMERA_SOURCE)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

print("🎥 Sending camera feed... Press Ctrl+C to stop.")

try:
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Camera read failed, retrying...")
            time.sleep(1)
            continue

        frame = cv2.resize(frame, (640, 360))
        _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 50])

        sio.emit('frame', jpeg.tobytes())
        time.sleep(0.033)  # ~30 FPS

except KeyboardInterrupt:
    print("\nStopping...")

finally:
    cap.release()
    sio.disconnect()
    print("Done.")
