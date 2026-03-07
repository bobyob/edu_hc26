# Raspberry Pi Emotion Display

A tiny Flask + pygame API that lets you choose one of four emotions (`sad`, `frustrated`, `neutral`, or `happy`) **once**. There is no camera input or other sensors involved—just send the emotion you want. The first valid POST request locks the Raspberry Pi 5 touch display on that emotion's image until you restart the program.

## Prerequisites
- Raspberry Pi OS (Bookworm or newer recommended)
- Python 3.11+
- Touch display connected as the primary framebuffer (the script uses pygame fullscreen by default)

Install the Python dependencies:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Assets
Sample PNGs live in `assets/` so you can test immediately. Replace them with your own four images (one per emotion) while keeping the same filenames:
```
assets/
  happy.png
  neutral.png
  frustrated.png
  sad.png
```
You can also point the app to another directory by setting `EMOTION_ASSET_DIR=/path/to/assets` before launching.

## Run the server
```bash
source .venv/bin/activate
python app.py
```
The process opens a fullscreen pygame window (or `PI_FULLSCREEN=0` for a windowed mode sized by `PI_WINDOW_SIZE`, e.g. `PI_WINDOW_SIZE=1024x600`).

### API
Send a JSON body containing the desired emotion. The first successful request wins; subsequent calls return HTTP 409.
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"emotion": "happy"}' \
  http://<pi-address>:5000/emotion
```
Check what the Pi is showing:
```bash
curl http://<pi-address>:5000/status
```

### Environment variables
| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `5000` | HTTP port to bind |
| `EMOTION_ASSET_DIR` | `assets` | Directory that contains `<emotion>.png` images |
| `PI_FULLSCREEN` | `1` | `0` disables fullscreen so the window stays resizable |
| `PI_WINDOW_SIZE` | `800x480` | Used when fullscreen is disabled |

Restart the script to clear the lock and allow a new emotion selection.
