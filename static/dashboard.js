/* --- LIVE CLOCK --- */
function updateClock() {
    const clock = document.getElementById("live-clock");
    if (clock) {
        const now = new Date();
        const date = now.toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
        });
        const time = now.toLocaleTimeString();
        clock.innerHTML = `${date} | ${time}`;
    }
}
setInterval(updateClock, 1000);
updateClock();

/* --- SYSTEM STATUS ROTATOR --- */
const statuses = [
    "All systems nominal — no active threats detected",
    "AI Surveillance Active — Monitoring CCTV Channels",
    "Firewall Protection Enabled — Scanning Networks",
    "Threat Detection Running — Analyzing Traffic"
];
let statusIndex = 0;

function rotateStatus() {
    const statusSpan = document.querySelector(".system-nominal-banner span");
    if (statusSpan) {
        statusIndex = (statusIndex + 1) % statuses.length;
        statusSpan.textContent = statuses[statusIndex];
    }
}
setInterval(rotateStatus, 5000);


/* --- AUTO REFRESH ALERTS --- */
setInterval(() => {
    fetch(window.location.href)
        .then(response => response.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const newAlerts = doc.querySelector('.alerts-list');
            const currentAlerts = document.querySelector('.alerts-list');

            if (newAlerts && currentAlerts) {
                currentAlerts.innerHTML = newAlerts.innerHTML;
            }
        })
        .catch(err => console.error("Error fetching alerts:", err));
}, 5000);


/* --- LIVE CAMERA STATUS --- */
function checkCameraFeed() {
    const camera = document.querySelector(".camera-feed");
    const statusText = document.querySelector(".header-left .status-text");
    const statusDot = document.querySelector(".header-left .status-dot");

    if (!camera || !statusText || !statusDot) return;

    camera.onload = () => {
        statusText.textContent = "Camera online";
        statusText.className = "status-text green-text";
        statusDot.className = "status-dot green";
    };

    camera.onerror = () => {
        statusText.textContent = "Camera offline";
        statusText.className = "status-text red-text";
        statusDot.className = "status-dot red";
    };
}
checkCameraFeed();

/* --- CAMERA THUMBNAIL SWITCHER (UI Polish) --- */
document.querySelectorAll('.thumb').forEach(thumb => {
    thumb.addEventListener('click', function() {
        document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        const camName = this.querySelector('p').textContent;
        const label = document.querySelector('.feed-label');
        if(label) label.textContent = camName;
    });
});


/* --- THREAT ALERT SOUND & NOTIFICATION --- */
let previousFailedCount = 0;

function playThreatAlert() {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audio.volume = 0.3;
    audio.play().catch(e => console.log("Audio play blocked by browser interaction policy"));
}

function showNotification(message) {
    const notification = document.createElement("div");
    notification.className = "cyber-notification";
    notification.innerHTML = `⚠ ${message}`;
    document.body.appendChild(notification);

    setTimeout(() => { notification.classList.add("show"); }, 100);
    setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => { notification.remove(); }, 500);
    }, 4000);
}

function monitorThreats() {
    // Looks for the red stat card's h1 specifically
    const failedCard = document.querySelector(".stat-card.border-red h1");
    if (!failedCard) return;

    const currentFailed = parseInt(failedCard.innerText) || 0;

    if (currentFailed > previousFailedCount && previousFailedCount !== 0) {
        playThreatAlert();
        showNotification("Unauthorized access attempt detected!");
    }
    previousFailedCount = currentFailed;
}
setInterval(monitorThreats, 4000);
