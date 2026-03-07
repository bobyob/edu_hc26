"""
Raspberry Pi emotion display server.

Run this on the Pi, then send a POST request containing
{"emotion": "happy" | "sad" | "frustrated" | "neutral"}.
The first valid request locks the display until you restart the program.
"""
from __future__ import annotations

import os
import signal
import threading
from pathlib import Path
from typing import Dict

from flask import Flask, jsonify, request
import pygame

EMOTIONS = ("sad", "frustrated", "neutral", "happy")
ASSET_DIR = Path(os.environ.get("EMOTION_ASSET_DIR", "assets")).resolve()
PORT = int(os.environ.get("PORT", "5000"))
FULLSCREEN = os.environ.get("PI_FULLSCREEN", "1").lower() not in {"0", "false", "no"}
WINDOW_SIZE = tuple(int(v) for v in os.environ.get("PI_WINDOW_SIZE", "800x480").split("x"))

app = Flask(__name__)

state_lock = threading.Lock()
_state = {
    "emotion": None,
    "locked": False,
    "message": "awaiting selection",
}


def _resolve_assets() -> Dict[str, Path]:
    assets = {}
    for mood in EMOTIONS:
        path = ASSET_DIR / f"{mood}.png"
        assets[mood] = path
        if not path.exists():
            print(f"[WARN] Expected image missing: {path}")
    return assets


EMOTION_FILES = _resolve_assets()


@app.post("/emotion")
def choose_emotion():
    payload = request.get_json(force=True, silent=True) or {}
    requested = (payload.get("emotion") or "").strip().lower()
    if requested not in EMOTIONS:
        return (
            jsonify({"ok": False, "message": "Provide one of sad, frustrated, neutral, or happy."}),
            400,
        )

    with state_lock:
        if _state["locked"]:
            return jsonify({"ok": False, "message": "Emotion already chosen"}), 409
        _state["emotion"] = requested
        _state["locked"] = True
        _state["message"] = f"showing {requested}"
    return jsonify({"ok": True, "message": f"Locked on {requested}"})


@app.get("/status")
def status():
    with state_lock:
        body = {"emotion": _state["emotion"], "locked": _state["locked"], "message": _state["message"]}
    return jsonify(body)


def _display_loop():
    pygame.init()
    flags = pygame.FULLSCREEN if FULLSCREEN else 0
    if FULLSCREEN:
        screen = pygame.display.set_mode((0, 0), flags)
    else:
        screen = pygame.display.set_mode(WINDOW_SIZE)
    pygame.display.set_caption("Emotion Display")
    pygame.mouse.set_visible(False)
    screen.fill((0, 0, 0))
    pygame.display.flip()

    clock = pygame.time.Clock()
    last_emotion = None
    cached_surfaces = {}

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                return
        with state_lock:
            current = _state["emotion"]
        if current and current != last_emotion:
            surface = cached_surfaces.get(current)
            if surface is None:
                path = EMOTION_FILES[current]
                if not path.exists():
                    print(f"[ERROR] Missing image for {current}: {path}")
                    cached_surfaces[current] = None
                else:
                    loaded = pygame.image.load(str(path)).convert()
                    surface = pygame.transform.smoothscale(loaded, screen.get_size())
                    cached_surfaces[current] = surface
            if surface is not None:
                screen.blit(surface, (0, 0))
                pygame.display.flip()
                last_emotion = current
        clock.tick(30)


def _run_api():
    app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)


def _handle_exit(signum, frame):  # noqa: ARG001
    pygame.quit()
    raise SystemExit(0)


if __name__ == "__main__":
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, _handle_exit)

    api_thread = threading.Thread(target=_run_api, daemon=True)
    api_thread.start()
    _display_loop()
