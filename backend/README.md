# Presage Brain Backend

Node HTTP API for the Helper Guy UI. Accepts camera frames from the frontend and returns emotion/vitals—either from a **mock** or by proxying to a **Presage SmartSpectra** service.

## Run

```bash
npm start
```

Listens on `http://localhost:5000` (or `PORT` env var).

## Endpoints

- **GET /health** – Service health; reports whether a Presage service URL is configured.
- **POST /analyze-frame** – Expects JSON: `{ image_base64, request_id?, client_tag? }`. Returns analysis (mock or from Presage).

## Using real Presage SmartSpectra

The [SmartSpectra SDK](https://github.com/Presage-Security/SmartSpectra) is C++ for **Mac/Linux** (no official Windows SDK). On Windows, use **WSL2** and run your Presage service there.

### 1. Set the service URL

Point this backend at your Presage/SmartSpectra service:

```bash
# Windows (PowerShell)
$env:PRESAGE_SERVICE_URL = "http://localhost:6000"
node server.js

# Or
set PRESAGE_SERVICE_URL=http://localhost:6000
npm start
```

Optional: `PRESAGE_TIMEOUT_MS` (default 15000), `SMARTSPECTRA_SERVICE_URL` (alias for `PRESAGE_SERVICE_URL`).

### 2. Contract your Presage service must implement

Your service (e.g. a small C++ HTTP server using the SmartSpectra SDK, or a bridge in another language) should:

- **Accept** `POST` with JSON body: `{ image_base64: "<base64 JPEG>", request_id?, client_tag? }`.
- **Return** JSON with the same shape the frontend expects:

```json
{
  "request_id": "<optional>",
  "analysis": {
    "emotion": "neutral|happy|stressed|focused|tired",
    "engagement": 0.0–1.0,
    "stress_level": 0.0–1.0,
    "heart_rate_bpm": number,
    "breathing_rate_bpm": number,
    "timestamp": "ISO8601"
  },
  "source": { "kind": "single_frame", "client_tag": "<optional>" }
}
```

- Decode `image_base64` to a frame, feed it into the SmartSpectra SDK (e.g. via [custom stream](https://docs.physiology.presagetech.com/cpp/) or file-based path), map SDK outputs (pulse, breathing, myofacial/expression) into `analysis`, and return the JSON.

### 3. SmartSpectra C++ setup (Mac/Linux / WSL)

- Docs: [SmartSpectra C++ SDK](https://docs.physiology.presagetech.com/cpp/docs_index.html)
- Repo: [Presage-Security/SmartSpectra](https://github.com/Presage-Security/SmartSpectra#maclinux) (see **Mac/Linux** section)
- Install the SDK (e.g. `libsmartspectra-dev` on Linux), build an HTTP server or use their samples, and expose an endpoint that implements the contract above. Run that service (e.g. on port 6000 inside WSL), then set `PRESAGE_SERVICE_URL=http://localhost:6000` when starting this Node server.

If the Presage service is unreachable or returns an error, this backend **falls back to mock** analysis and logs a warning.
