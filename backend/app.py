"""
app.py — MyFocusFriend Flask Backend
Runs on the Raspberry Pi 5.
Exposed privately via Tailscale Serve at https://<pi-name>.<tailnet>.ts.net

Endpoints:
  GET  /api/ping              — health check
  POST /api/emotion           — receive emotion from frontend, update Pi screen
  POST /api/session           — store completed session data
  GET  /api/session-summary   — get aggregated stats (for frontend popups)
  GET  /api/parent-summary    — parent/tutor view (Tailscale-secured)
"""

import json
import os
from datetime import datetime
from collections import Counter
from flask import Flask, request, jsonify
from flask_cors import CORS

# ── Try to import RPi display libraries (only available on actual Pi) ──
try:
    from luma.core.interface.serial import i2c
    from luma.oled.device import ssd1306
    from luma.core.render import canvas
    from PIL import ImageFont
    PI_DISPLAY_AVAILABLE = True
    serial = i2c(port=1, address=0x3C)
    device = ssd1306(serial)
    print("✅ Pi OLED display initialized")
except Exception as e:
    PI_DISPLAY_AVAILABLE = False
    print(f"⚠️  Pi display not available (running in dev mode): {e}")

app = Flask(__name__)
CORS(app, origins=["*"])  # Restrict to your Tailscale subnet in production

# ── Data storage (JSON file on Pi) ────────────────────────────────────
DATA_FILE = os.path.join(os.path.dirname(__file__), "sessions.json")

def load_data():
    if not os.path.exists(DATA_FILE):
        return {"sessions": [], "emotion_log": []}
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

# ── Pi Display Logic ──────────────────────────────────────────────────

EMOTION_FACES = {
    "happy":     "^_^  Keep it up!",
    "neutral":   "-_-  Stay focused",
    "sad":       "v_v  You've got this!",
    "frustrated":"@_@  Take a breath!",
}

def update_pi_display(emotion):
    """Update the OLED screen on the Pi based on detected emotion."""
    if not PI_DISPLAY_AVAILABLE:
        print(f"[DISPLAY MOCK] Emotion: {emotion} → {EMOTION_FACES.get(emotion, '?')}")
        return

    message = EMOTION_FACES.get(emotion, "-_-  Stay focused")
    try:
        with canvas(device) as draw:
            draw.rectangle(device.bounding_box, outline="white", fill="black")
            draw.text((10, 10), "Pebble says:", fill="white")
            draw.text((10, 30), message, fill="white")
    except Exception as e:
        print(f"Display error: {e}")

# ── Routes ────────────────────────────────────────────────────────────

@app.route("/api/ping", methods=["GET"])
def ping():
    """Health check — frontend calls this to confirm Pi is reachable."""
    return jsonify({
        "status": "ok",
        "display": PI_DISPLAY_AVAILABLE,
        "timestamp": datetime.now().isoformat()
    })


@app.route("/api/emotion", methods=["POST"])
def receive_emotion():
    """
    Receive an emotion reading from the frontend during a quiz session.
    Updates the Pi's OLED display immediately.

    Body: { emotion: string, module: string, timestamp: number }
    """
    data = request.get_json()
    emotion = data.get("emotion", "neutral")
    module = data.get("module", "unknown")

    # Update the physical Pi screen
    update_pi_display(emotion)

    # Log it
    db = load_data()
    db["emotion_log"].append({
        "emotion": emotion,
        "module": module,
        "timestamp": data.get("timestamp", datetime.now().isoformat()),
        "received_at": datetime.now().isoformat()
    })
    save_data(db)

    print(f"[EMOTION] {emotion.upper()} during {module}")
    return jsonify({"status": "ok", "emotion": emotion})


@app.route("/api/session", methods=["POST"])
def store_session():
    """
    Store a completed quiz session sent from the frontend.

    Body: session object from sessionService.endSession()
    """
    session_data = request.get_json()
    session_data["stored_at"] = datetime.now().isoformat()

    db = load_data()
    db["sessions"].append(session_data)
    save_data(db)

    print(f"[SESSION] Stored: {session_data.get('module')} — {session_data.get('score')}%")
    return jsonify({"status": "ok"})


@app.route("/api/session-summary", methods=["GET"])
def session_summary():
    """Return aggregated stats for a given module (optional ?module= param)."""
    module = request.args.get("module")
    db = load_data()
    sessions = db.get("sessions", [])

    if module:
        sessions = [s for s in sessions if s.get("module") == module]

    if not sessions:
        return jsonify({"timesAttempted": 0, "averageScore": 0, "averageEmotion": "neutral"})

    avg_score = round(sum(s.get("score", 0) for s in sessions) / len(sessions))
    all_emotions = [e for s in sessions for e in s.get("emotions", [])]
    avg_emotion = Counter(all_emotions).most_common(1)[0][0] if all_emotions else "neutral"

    return jsonify({
        "timesAttempted": len(sessions),
        "averageScore": avg_score,
        "averageEmotion": avg_emotion,
        "sessions": sessions[-5:]  # last 5 sessions
    })


@app.route("/api/parent-summary", methods=["GET"])
def parent_summary():
    """
    Parent/tutor summary endpoint.
    Accessible only via Tailscale private network.
    Returns full cross-module stats and next steps.
    """
    db = load_data()
    sessions = db.get("sessions", [])
    modules = ["math", "science", "english"]

    summary = {}
    total_sessions = 0
    total_score = 0
    scored = 0

    for mod in modules:
        mod_sessions = [s for s in sessions if s.get("module") == mod]
        if mod_sessions:
            avg = round(sum(s.get("score", 0) for s in mod_sessions) / len(mod_sessions))
            all_emotions = [e for s in mod_sessions for e in s.get("emotions", [])]
            emotion = Counter(all_emotions).most_common(1)[0][0] if all_emotions else "neutral"
            summary[mod] = {
                "timesAttempted": len(mod_sessions),
                "averageScore": avg,
                "averageEmotion": emotion,
                "lastScore": mod_sessions[-1].get("score", 0),
                "successLevel": get_success_level(avg),
                "nextSteps": generate_next_steps(mod, avg, len(mod_sessions))
            }
            total_sessions += len(mod_sessions)
            total_score += avg
            scored += 1
        else:
            summary[mod] = {
                "timesAttempted": 0,
                "averageScore": 0,
                "averageEmotion": "neutral",
                "successLevel": "N/A",
                "nextSteps": [f"No {mod} sessions yet."]
            }

    return jsonify({
        "byModule": summary,
        "totalSessions": total_sessions,
        "overallAverage": round(total_score / scored) if scored else 0,
        "generatedAt": datetime.now().isoformat()
    })


# ── Helpers ───────────────────────────────────────────────────────────

def get_success_level(score):
    if score >= 80: return "High Success"
    if score >= 60: return "Moderate Success"
    if score >= 40: return "Needs Practice"
    return "Needs Support"

def generate_next_steps(module, avg_score, attempts):
    if attempts == 0:
        return [f"Student has not attempted {module} yet."]
    steps = []
    if avg_score < 60:
        steps.append(f"Review core {module} concepts with the student.")
        steps.append("Consider additional tutoring sessions on this subject.")
    elif avg_score < 80:
        steps.append(f"Good progress in {module}. Encourage harder difficulty.")
        steps.append("Review missed questions together.")
    else:
        steps.append(f"Excellent {module} performance — student is excelling.")
        steps.append("Consider introducing advanced topics.")
    if attempts < 3:
        steps.append("Encourage more sessions for a clearer picture.")
    return steps


# ── Run ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("🚀 MyFocusFriend Pi backend starting...")
    print("   For Tailscale access, run: tailscale serve 5000")
    # Listen on all interfaces so Tailscale can reach it
    app.run(host="0.0.0.0", port=5000, debug=False)
