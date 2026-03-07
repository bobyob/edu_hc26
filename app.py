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
from typing import Dict, Tuple

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


def _lock_emotion(requested: str, origin: str) -> Tuple[bool, str]:
    """Attempt to lock the display on a given emotion."""
    with state_lock:
        if _state["locked"]:
            return False, "Emotion already chosen"
        _state["emotion"] = requested
        _state["locked"] = True
        _state["message"] = f"{origin} locked on {requested}"
    return True, f"Locked on {requested}"


def _build_button_rects(size: Tuple[int, int]) -> Dict[str, pygame.Rect]:
    """Return centered button rectangles for each emotion."""
    width, height = size
    button_width = max(min(width // 5, 220), 140)
    button_height = 80
    gap = 20
    total_width = len(EMOTIONS) * button_width + (len(EMOTIONS) - 1) * gap
    start_x = max((width - total_width) // 2, 10)
    y = (height // 2) + 20
    rects = {}
    for idx, mood in enumerate(EMOTIONS):
        x = start_x + idx * (button_width + gap)
        rects[mood] = pygame.Rect(x, y, button_width, button_height)
    return rects


def _render_waiting_screen(
    screen,
    header_font,
    body_font,
    button_font,
    button_rects: Dict[str, pygame.Rect],
    status_message: str,
) -> None:
    """Show clickable buttons so the operator can make a selection with the mouse."""
    screen.fill((10, 10, 15))
    width, _ = screen.get_size()
    header = status_message or "Tap a mood to begin"
    header_surface = header_font.render(header, True, (250, 250, 250))
    header_rect = header_surface.get_rect(center=(width // 2, 160))
    screen.blit(header_surface, header_rect)

    subtext = "Tap one of the buttons below or POST to /emotion"
    sub_surface = body_font.render(subtext, True, (200, 200, 200))
    sub_rect = sub_surface.get_rect(center=(width // 2, header_rect.bottom + 30))
    screen.blit(sub_surface, sub_rect)

    for mood, rect in button_rects.items():
        pygame.draw.rect(screen, (45, 85, 150), rect, border_radius=12)
        label = button_font.render(mood.title(), True, (255, 255, 255))
        label_rect = label.get_rect(center=rect.center)
        screen.blit(label, label_rect)

    pygame.display.flip()


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
    ok, message = _lock_emotion(requested, "API request")
    if not ok:
        return jsonify({"ok": False, "message": message}), 409
    return jsonify({"ok": True, "message": message})


@app.get("/status")
def status():
    with state_lock:
        body = {"emotion": _state["emotion"], "locked": _state["locked"], "message": _state["message"]}
    return jsonify(body)


def _display_loop():
    pygame.init()
    pygame.font.init()
    flags = pygame.FULLSCREEN if FULLSCREEN else 0
    if FULLSCREEN:
        screen = pygame.display.set_mode((0, 0), flags)
    else:
        screen = pygame.display.set_mode(WINDOW_SIZE)
    pygame.display.set_caption("Emotion Display")
    pygame.mouse.set_visible(False)
    screen.fill((0, 0, 0))
    pygame.display.flip()
    header_font = pygame.font.Font(None, 64)
    body_font = pygame.font.Font(None, 32)
    button_font = pygame.font.Font(None, 42)

    clock = pygame.time.Clock()
    last_emotion = None
    cached_surfaces = {}
    button_rects = _build_button_rects(screen.get_size())

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                return
            if event.type == pygame.VIDEORESIZE:
                screen = pygame.display.set_mode(event.size, flags)
                button_rects = _build_button_rects(event.size)
            if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                for mood, rect in button_rects.items():
                    if rect.collidepoint(event.pos):
                        ok, message = _lock_emotion(mood, "Touch input")
                        print(message)
                        break
        with state_lock:
            current = _state["emotion"]
            status_message = _state["message"]
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
        if not current:
            _render_waiting_screen(
                screen,
                header_font,
                body_font,
                button_font,
                button_rects,
                status_message,
            )
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
