# edu_hc26

Helper Guy – Presage Emotion Prototype.

This project is a small prototype that splits your idea into two pieces:

- A **backend \"brain\" stub** that simulates Presage analysis.
- A **React-based camera moderator + helper UI** that runs in the browser.

> Important: this repo does **not** include the real Presage SmartSpectra SDK. The backend currently returns mock metrics. Later, you will replace the stub logic with calls into the actual Presage C++ SDK running in WSL2.

## Project layout

- `backend/`
  - `package.json` – Node metadata.
  - `server.js` – simple HTTP server exposing the brain API stub.
- `frontend/`
  - `index.html` – React UI (loaded from CDN) with camera access and helper avatar.

## Backend – brain API stub

The backend is a tiny Node.js HTTP server using only core modules (no external dependencies).

- **Health check**
  - `GET /health`
  - Returns `{ \"status\": \"ok\", \"message\": \"Presage brain stub running\" }` (or proxy info when configured).

- **Analyze frame**
  - `POST /analyze-frame`
  - Request body (JSON):
    - `image_base64` – **required**, base64-encoded JPEG frame captured from the webcam.
    - `request_id` – optional string, echoed back for tracking.
    - `client_tag` – optional string to identify the caller (e.g. `\"helper-ui\"`).
  - Response body (JSON):
    - `request_id`
    - `analysis`:
      - `emotion` – `\"neutral\" | \"happy\" | \"stressed\" | \"focused\" | \"tired\"` (mocked unless Presage is wired in).
      - `engagement` – number between 0–1.
      - `stress_level` – number between 0–1.
      - `heart_rate_bpm` – integer.
      - `breathing_rate_bpm` – integer.
      - `timestamp` – ISO string.
    - `source`:
      - `kind` – currently `\"single_frame\"`.
      - `client_tag` – echoed from the request.

### Running the backend locally

1. Install Node.js (any current LTS is fine) so that `node` and `npm` work in your terminal.
2. Open a terminal at the `backend` folder:

   ```bash
   cd backend
   npm start
   ```

3. The server will listen on `http://localhost:5000`.

Later, when you have WSL2 + Ubuntu + Presage SDK:

- Point `PRESAGE_SERVICE_URL` at your SmartSpectra-powered service so `/analyze-frame` can return real metrics instead of mocks.

## Frontend – React camera moderator + helper UI

The frontend is a single HTML file that:

- Uses `getUserMedia` to open the webcam.
- Every 2 seconds, captures a frame into a hidden `<canvas>`.
- Sends the frame as base64 JPEG to `POST http://localhost:5000/analyze-frame`.
- Displays:
  - A **live camera preview**.
  - A **helper avatar** whose emoji and text react to the latest `emotion`.
  - A **metrics grid** showing engagement, stress, heart rate, and breathing rate.

Because React is loaded via CDN, you do **not** need any build tooling to try the UI.

### Using the frontend

1. Make sure the backend is running on `http://localhost:5000`.
2. Open `frontend/index.html` in a modern browser (Chrome/Edge).
3. Grant camera permission when prompted.
4. You should see:
   - Your camera feed on the left.
   - The helper avatar and metrics on the right, updating every ~2 seconds based on data from the backend.

If the brain API is not running, you will see a message like:

- “Problem talking to brain API on localhost:5000.”

## Where Presage fits later

This prototype isolates the contracts so you can drop in Presage later:

- **React side (eyes + UI)** will stay almost the same.
- **Backend side (brain)** will change:
  - Instead of the mock analysis, call into a WSL2/Ubuntu service that uses the Presage SmartSpectra C++ SDK to analyze frames.
  - Keep the same JSON shape for the response so the frontend does not care whether the data is mocked or real.

That way, your helper app can start with fake emotion and then “go live” with Presage once your Linux environment and SDK integration are ready.

