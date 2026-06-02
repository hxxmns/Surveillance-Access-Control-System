/* ─────────────────────────────────────────────────────────────
   CYBER WATCH  —  dashboard.js
   Features:
     • Live clock (sidebar)
     • System-status rotator
     • Inactivity session lock (30 min)
     • Server-Sent Events live updates (logs, stat counters)
     • Threat alert sound / notification
     • Camera feed status watcher
     • Threat-logs filter + search
───────────────────────────────────────────────────────────── */

/* ── LIVE CLOCK ──────────────────────────────────────────── */
function updateClock() {
    const clock = document.getElementById("live-clock");
    if (!clock) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    clock.innerHTML = `${dateStr}<br>${timeStr}`;
}
setInterval(updateClock, 1000);
updateClock();

/* ── SYSTEM STATUS ROTATOR ───────────────────────────────── */
const statuses = [
    "All systems nominal — no active threats detected",
    "AI Surveillance Active — Monitoring CCTV Channels",
    "Firewall Protection Enabled — Scanning Networks",
    "Threat Detection Running — Analyzing Traffic"
];
let statusIndex = 0;
function rotateStatus() {
    const el = document.querySelector(".system-nominal-banner span");
    if (el) {
        statusIndex = (statusIndex + 1) % statuses.length;
        el.textContent = statuses[statusIndex];
    }
}
setInterval(rotateStatus, 5000);

/* ── INACTIVITY SESSION LOCK ─────────────────────────────── */
(function () {
    const TIMEOUT_MS = 30 * 60 * 1000;   // 30 minutes
    const WARNING_MS = 60 * 1000;         // warn 1 minute before

    let idleTimer, warnTimer;
    let lockOverlay = null;

    function createLockOverlay() {
        if (lockOverlay) return;
        lockOverlay = document.createElement("div");
        lockOverlay.id = "idle-lock-overlay";
        lockOverlay.style.cssText = `
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(10,10,10,0.96);
            backdrop-filter: blur(12px);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 20px; font-family: 'Inter', sans-serif;
        `;
        lockOverlay.innerHTML = `
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none"
                 stroke="#888" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <div style="color:#e0e0e0;font-size:22px;font-weight:700;letter-spacing:0.5px;">
                Session Locked
            </div>
            <div style="color:#888;font-size:14px;max-width:300px;text-align:center;line-height:1.6;">
                You were inactive for 30 minutes.<br>
                Redirecting to login…
            </div>
            <div id="idle-countdown" style="color:#3fb950;font-size:13px;font-weight:600;"></div>
        `;
        document.body.appendChild(lockOverlay);
    }

    function showWarning() {
        let existing = document.getElementById("idle-warning-toast");
        if (existing) return;
        const toast = document.createElement("div");
        toast.id = "idle-warning-toast";
        toast.style.cssText = `
            position: fixed; bottom: 30px; right: 30px; z-index: 9998;
            background: rgba(20,20,20,0.95); border: 1px solid rgba(210,153,34,0.5);
            color: #d29922; padding: 14px 20px; border-radius: 10px;
            font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
            box-shadow: 0 4px 20px rgba(0,0,0,0.6);
            animation: slideInToast 0.3s ease;
        `;
        toast.textContent = "⚠  Session will lock in 1 minute due to inactivity.";
        document.body.appendChild(toast);
    }

    function dismissWarning() {
        const t = document.getElementById("idle-warning-toast");
        if (t) t.remove();
    }

    function lockSession() {
        dismissWarning();
        createLockOverlay();
        // Countdown then redirect
        let secs = 5;
        const countdown = document.getElementById("idle-countdown");
        function tick() {
            if (countdown) countdown.textContent = `Redirecting in ${secs}s…`;
            if (secs <= 0) {
                // Log out server-side via beacon, then redirect
                if (navigator.sendBeacon) navigator.sendBeacon('/logout-beacon');
                window.location.href = "/";
                return;
            }
            secs--;
            setTimeout(tick, 1000);
        }
        tick();
    }

    function resetIdleTimer() {
        clearTimeout(idleTimer);
        clearTimeout(warnTimer);
        dismissWarning();
        warnTimer = setTimeout(showWarning, TIMEOUT_MS - WARNING_MS);
        idleTimer  = setTimeout(lockSession, TIMEOUT_MS);
    }

    // Start + reset on any user activity
    const activityEvents = ['mousemove','mousedown','keydown','touchstart','scroll','click'];
    activityEvents.forEach(evt => document.addEventListener(evt, resetIdleTimer, { passive: true }));
    resetIdleTimer();   // kick off on page load
})();

/* ── SERVER-SENT EVENTS  (live updates) ──────────────────── */
(function () {
    if (!window.EventSource) return;          // old browser fallback
    if (!document.querySelector('.dashboard')) return;  // only on authed pages

    const source = new EventSource('/events');

    source.onmessage = function (e) {
        let data;
        try { data = JSON.parse(e.data); } catch { return; }
        if (data.type === 'log') {
            injectLogRow(data);
            refreshStatCounters();
        }
    };

    source.onerror = function () {
        // SSE will auto-reconnect; nothing to do
    };

    /* ── inject a new row into the threat-logs table (if visible) ── */
    function injectLogRow(d) {
        const tbody = document.getElementById('logsTableBody');
        if (!tbody) return;   // not on threat-logs page

        const statusClass = d.status === 'SUCCESS' ? 'ok' : 'critical';
        const badgeHtml = d.status === 'RED_LOGOUT'
            ? `<span class="badge critical" style="min-width:15px;height:15px;padding:0;border-radius:50%;"></span>`
            : `<span class="badge ${statusClass}">${d.status}</span>`;

        const tr = document.createElement('tr');
        tr.className = 'log-row';
        tr.setAttribute('data-status', d.status);
        tr.innerHTML = `
            <td class="text-clip" style="color:var(--text-muted);">${d.device_id}</td>
            <td>${d.event_type}</td>
            <td>${badgeHtml}</td>
            <td>${d.created_at}</td>
        `;
        tr.style.animation = 'motion-log-slide-in 0.3s ease-out';
        tbody.insertBefore(tr, tbody.firstChild);

        // keep max 50 rows
        while (tbody.children.length > 50) tbody.removeChild(tbody.lastChild);

        // update results count
        const countEl = document.querySelector('.results-count');
        if (countEl) {
            const visible = [...tbody.querySelectorAll('.log-row')].filter(r => r.style.display !== 'none').length;
            countEl.textContent = `${visible} results`;
        }
    }

    /* ── refresh dashboard stat cards + alerts list ── */
    function refreshStatCounters() {
        fetch('/api/stats')
            .then(r => r.json())
            .then(stats => {
                // dashboard stat cards
                const cards = document.querySelectorAll('.stat-card h1');
                if (cards.length >= 3) {
                    cards[0].textContent = stats.today_access;
                    cards[1].textContent = stats.unauthorized;
                    cards[2].textContent = stats.blocked;
                }
                // analytics stat cards (same layout, all-time numbers)
                const analyticsCards = document.querySelectorAll('.analytics-stats-grid .stat-card h1');
                if (analyticsCards.length >= 3) {
                    analyticsCards[0].textContent = stats.success_total;
                    analyticsCards[1].textContent = stats.failed_total;
                    analyticsCards[2].textContent = stats.blocked;
                }

                // threat monitor widget — play alert if new failure
                monitorThreatsLive(stats.unauthorized);
            })
            .catch(() => {});

        // also refresh dashboard alerts list
        refreshAlertsList();
    }

    function refreshAlertsList() {
        const alertsList = document.querySelector('.alerts-list');
        if (!alertsList) return;
        fetch(window.location.href)
            .then(r => r.text())
            .then(html => {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const fresh = doc.querySelector('.alerts-list');
                if (fresh) alertsList.innerHTML = fresh.innerHTML;
            })
            .catch(() => {});
    }

    /* track unauthorized count for audio alert */
    let _prevUnauthorized = null;
    function monitorThreatsLive(current) {
        if (_prevUnauthorized !== null && current > _prevUnauthorized) {
            playThreatAlert();
            showNotification("Unauthorized access attempt detected!");
        }
        _prevUnauthorized = current;
    }
})();

/* ── LIVE CAMERA STATUS ──────────────────────────────────── */
function checkCameraFeed() {
    const camera    = document.querySelector(".camera-feed");
    const statusTxt = document.querySelector(".header-left .status-text");
    const statusDot = document.querySelector(".header-left .status-dot");
    if (!camera || !statusTxt || !statusDot) return;
    camera.onload  = () => { statusTxt.textContent = "Camera online";  statusTxt.className = "status-text green-text"; statusDot.className = "status-dot green"; };
    camera.onerror = () => { statusTxt.textContent = "Camera offline"; statusTxt.className = "status-text red-text";   statusDot.className = "status-dot red"; };
}
checkCameraFeed();

/* ── THREAT ALERT SOUND & NOTIFICATION ──────────────────── */
function playThreatAlert() {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audio.volume = 0.3;
    audio.play().catch(() => {});
}

function showNotification(message) {
    const n = document.createElement("div");
    n.className = "cyber-notification";
    n.innerHTML = `⚠ ${message}`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add("show"), 100);
    setTimeout(() => { n.classList.remove("show"); setTimeout(() => n.remove(), 500); }, 4000);
}

/* ── THREAT LOGS FILTER + SEARCH ─────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
    const filterPills  = document.querySelectorAll('.filter-pill');
    const logRows      = () => document.querySelectorAll('.log-row');  // live NodeList
    const searchInput  = document.getElementById('logSearch');
    const searchBtn    = document.getElementById('searchBtn');
    const countText    = document.querySelector('.results-count');

    if (!document.getElementById('logsTableBody')) return;

    let currentStatusFilter = 'all';
    let currentSearchQuery  = '';

    function applyFilters() {
        let visible = 0;
        logRows().forEach(row => {
            const matchStatus = currentStatusFilter === 'all' || row.getAttribute('data-status') === currentStatusFilter;
            const matchSearch = currentSearchQuery === '' || row.textContent.toLowerCase().includes(currentSearchQuery);
            if (matchStatus && matchSearch) { row.style.display = ''; visible++; }
            else row.style.display = 'none';
        });
        if (countText) countText.textContent = `${visible} results`;
    }

    // re-expose so the SSE injector can trigger it
    window._applyLogFilters = applyFilters;

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentStatusFilter = pill.getAttribute('data-filter');
            applyFilters();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input',  () => { currentSearchQuery = searchInput.value.toLowerCase().trim(); applyFilters(); });
        searchBtn   ?.addEventListener('click', () => { currentSearchQuery = searchInput.value.toLowerCase().trim(); applyFilters(); });
    }
});

/* ── BEACON LOGOUT ON TAB CLOSE ─────────────────────────── */
window.addEventListener('beforeunload', () => {
    if (navigator.sendBeacon) navigator.sendBeacon('/logout-beacon');
});

/* ── IDLE LOCK OVERLAY CSS (injected once) ───────────────── */
(function injectIdleCSS() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInToast {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .cyber-notification {
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(20px);
            background: rgba(20,20,20,0.95); border: 1px solid rgba(248,81,73,0.5);
            color: #f85149; padding: 12px 24px; border-radius: 10px;
            font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
            opacity: 0; transition: 0.3s; z-index: 9990;
            box-shadow: 0 4px 20px rgba(0,0,0,0.6);
        }
        .cyber-notification.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    `;
    document.head.appendChild(style);
})();
