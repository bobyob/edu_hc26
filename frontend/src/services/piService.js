// piService.js
// Handles all communication with the Raspberry Pi Flask backend.
// The Pi is exposed via Tailscale Serve at a private .ts.net URL.
// During development, falls back to localhost:5000.

// -------------------------------------------------------------------
// ⚙️  CONFIGURATION
// Replace PI_BASE_URL with your actual Tailscale machine URL once set up.
// Format: https://<machine-name>.<tailnet-name>.ts.net
// Example: https://raspberrypi.tail1a2b3c.ts.net
// -------------------------------------------------------------------
const PI_BASE_URL =
  import.meta.env.VITE_PI_URL || "http://localhost:5000";

/**
 * Send an emotion reading to the Pi during a quiz session.
 * The Pi will update its display screen based on the emotion received.
 *
 * @param {string} emotion - "happy" | "sad" | "frustrated" | "neutral"
 * @param {string} module  - current module being studied
 * @returns {Promise<boolean>} - true if successful, false if Pi unreachable
 */
export async function sendEmotionToPi(emotion, module) {
  try {
    const response = await fetch(`${PI_BASE_URL}/api/emotion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emotion,
        module,
        timestamp: Date.now(),
      }),
      // Short timeout — don't block the UI if Pi is unreachable
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.warn(`Pi responded with status ${response.status}`);
      return false;
    }

    return true;
  } catch (err) {
    // Pi is offline or unreachable — fail silently so quiz continues
    console.warn("Pi unreachable, emotion not sent:", err.message);
    return false;
  }
}

/**
 * Send a completed session summary to the Pi for storage.
 * This is what the parent/tutor accesses via the Tailscale URL.
 *
 * @param {object} sessionData - the completed session object from sessionService
 * @returns {Promise<boolean>}
 */
export async function sendSessionToPi(sessionData) {
  try {
    const response = await fetch(`${PI_BASE_URL}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionData),
      signal: AbortSignal.timeout(3000),
    });

    return response.ok;
  } catch (err) {
    console.warn("Could not send session to Pi:", err.message);
    return false;
  }
}

/**
 * Fetch the parent/tutor summary from the Pi.
 * Only accessible to devices on the Tailscale private network.
 *
 * @returns {Promise<object|null>}
 */
export async function fetchParentSummaryFromPi() {
  try {
    const response = await fetch(`${PI_BASE_URL}/api/parent-summary`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.warn("Could not fetch parent summary from Pi:", err.message);
    return null;
  }
}

/**
 * Check if the Pi backend is reachable.
 * @returns {Promise<boolean>}
 */
export async function checkPiConnection() {
  try {
    const response = await fetch(`${PI_BASE_URL}/api/ping`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
