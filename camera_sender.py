import cv2
import socketio
import base64
import time

sio = socketio.Client()
SERVER_URL = "https://surveillance-access-control-system-production.up.railway.app"

sio.connect(SERVER_URL)
print("Connected!")

cap = cv2.VideoCapture(0)  # or your RTSP URL later

while True:
    ret, frame = cap.read()
    if not ret:
        time.sleep(1)
        continue

    frame = cv2.resize(frame, (640, 360))
    _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
    
    sio.emit('frame', jpeg.tobytes())
    time.sleep(0.033)  # ~30 FPS

cap.release()
sio.disconnect()
