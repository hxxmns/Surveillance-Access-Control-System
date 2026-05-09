from flask import Flask, render_template, request, redirect, session, Response
from database import get_connection
from datetime import datetime, timedelta
import cv2
import blocker
import detector
import atexit

app = Flask(__name__)
app.secret_key = "Group7_netad"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(minutes=30)

CCTV_STREAM = "rtsp://username:password@192.168.1.100:554/stream1"

camera = None


def try_open_stream(url):
    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    if cap.isOpened():
        return cap
    cap.release()
    return None


def init_camera():
    global camera

    camera = try_open_stream(CCTV_STREAM)

    if camera is None:
        camera = cv2.VideoCapture(0)

    if camera:
        camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)


init_camera()


def save_log(ip, event_type, status):
    conn = get_connection()
    cursor = conn.cursor()

    philippines_time = datetime.utcnow() + timedelta(hours=8)

    try:
        cursor.execute("""
            INSERT INTO security_logs (ip, event_type, status, created_at)
            VALUES (%s, %s, %s, %s)
        """, (ip, event_type, status, philippines_time))
        conn.commit()
    except:
        conn.rollback()
    finally:
        conn.close()


@app.route("/", methods=["GET", "POST"])
def login():
    ip = request.remote_addr

    if blocker.is_blocked(ip):
        return "Access Denied: Your IP is permanently blocked.", 403

    if request.method == "POST":
        username = request.form["username"].strip()
        password = request.form["password"].strip()

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT username, password FROM users WHERE username=%s", (username,))
        user = cursor.fetchone()
        conn.close()

        if user and user[1] == password:
            session.permanent = True
            session["user"] = username
            detector.clear_failed_attempts(ip)
            save_log(ip, f"Login Success: {username}", "SUCCESS")
            return redirect("/dashboard")
        else:
            save_log(ip, f"Login Failed: {username}", "FAILED")
            detector.register_failed_attempt(ip)

            if detector.detect_attack(ip):
                blocker.block_ip(ip, "Brute force detected")
                save_log(ip, "Brute Force Detected", "ALERT")
                save_log(ip, "IP BLOCKED", "BLOCKED")
                return "Security Alert: IP Blocked.", 403

            return "Invalid login"

    return render_template("login.html")


@app.route("/dashboard")
def dashboard():
    if "user" not in session:
        return redirect("/")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM security_logs WHERE status='SUCCESS' AND created_at >= CURRENT_DATE")
    today_access = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM security_logs WHERE status='FAILED' AND created_at >= CURRENT_DATE")
    unauthorized = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM blocked_ips")
    unique_attackers = cursor.fetchone()[0]

    cursor.execute("""
        SELECT ip, event_type, status, created_at
        FROM security_logs
        ORDER BY created_at DESC
        LIMIT 7
    """)
    recent_alerts = cursor.fetchall()

    conn.close()

    return render_template(
        "dashboard.html",
        user=session["user"],
        today_access=today_access,
        unauthorized=unauthorized,
        unique_attackers=unique_attackers,
        recent_alerts=recent_alerts
    )


@app.route("/live-cctv")
def live_cctv():
    if "user" not in session:
        return redirect("/")
    return render_template("live_cctv.html", user=session["user"])


@app.route("/threat-logs")
def threat_logs():
    if "user" not in session:
        return redirect("/")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT ip, event_type, status, created_at
        FROM security_logs
        ORDER BY created_at DESC
        LIMIT 50
    """)

    logs = cursor.fetchall()
    conn.close()

    return render_template("threat_logs.html", user=session["user"], logs=logs)


@app.route("/analytics")
def analytics():
    if "user" not in session:
        return redirect("/")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM security_logs WHERE status='SUCCESS'")
    success_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM security_logs WHERE status='FAILED'")
    failed_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM blocked_ips")
    blocked_count = cursor.fetchone()[0]

    conn.close()

    return render_template(
        "analytics.html",
        user=session["user"],
        success_count=success_count,
        failed_count=failed_count,
        blocked_count=blocked_count
    )


def generate_frames():
    global camera

    while True:
        try:
            if camera is None or not camera.isOpened():
                init_camera()

            success, frame = camera.read()

            if not success:
                camera.release()
                camera = None
                continue

            _, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' +
                   frame_bytes +
                   b'\r\n')

        except:
            camera = None
            continue


@app.route("/video_feed")
def video_feed():
    if "user" not in session:
        return "Unauthorized", 403

    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")


@atexit.register
def release_camera():
    global camera
    if camera:
        camera.release()


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
