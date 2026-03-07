const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 5000;
/** When set, forward /analyze-frame to this Presage/SmartSpectra service (e.g. WSL C++ or local proxy). */
const PRESAGE_SERVICE_URL = process.env.PRESAGE_SERVICE_URL || process.env.SMARTSPECTRA_SERVICE_URL || '';
const PRESAGE_TIMEOUT_MS = Number(process.env.PRESAGE_TIMEOUT_MS) || 15000;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve(null);
        return;
      }
      try {
        const json = JSON.parse(data);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function buildMockAnalysis() {
  const emotions = ['neutral', 'happy', 'stressed', 'focused', 'tired'];
  const emotion = emotions[Math.floor(Math.random() * emotions.length)];

  return {
    emotion,
    engagement: Number((0.4 + Math.random() * 0.6).toFixed(2)),
    stress_level: Number((Math.random()).toFixed(2)),
    heart_rate_bpm: Math.floor(65 + Math.random() * 25),
    breathing_rate_bpm: Math.floor(10 + Math.random() * 8),
    timestamp: new Date().toISOString()
  };
}

/**
 * Forward analyze-frame request to Presage/SmartSpectra service.
 * Expects the service to return JSON: { request_id?, analysis: { emotion?, engagement?, stress_level?, heart_rate_bpm?, breathing_rate_bpm?, ... }, source? }.
 */
function forwardToPresageService(body) {
  return new Promise((resolve, reject) => {
    if (!PRESAGE_SERVICE_URL) {
      resolve(null);
      return;
    }
    const parsed = url.parse(PRESAGE_SERVICE_URL);
    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;
    const payload = JSON.stringify(body);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.path || '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload, 'utf8')
      }
    };
    const req = client.request(opts, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Presage service returned ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(PRESAGE_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('Presage service timeout'));
    });
    req.write(payload);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  const parsedUrl = url.parse(req.url, true);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      message: PRESAGE_SERVICE_URL ? 'Presage brain proxy + fallback' : 'Presage brain stub (mock)',
      presage_service: PRESAGE_SERVICE_URL || null
    }));
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/analyze-frame') {
    try {
      const body = await parseJsonBody(req);

      if (!body || typeof body.image_base64 !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'image_base64 field (string) is required' }));
        return;
      }

      let response = null;
      if (PRESAGE_SERVICE_URL) {
        try {
          response = await forwardToPresageService(body);
        } catch (err) {
          console.warn('Presage service error, using mock:', err.message);
        }
      }
      if (!response || typeof response.analysis !== 'object') {
        const analysis = buildMockAnalysis();
        response = {
          request_id: body.request_id || null,
          analysis,
          source: { kind: 'single_frame', client_tag: body.client_tag || null, mock: true }
        };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON or request body', details: err.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Presage brain listening on http://localhost:${PORT}`);
  if (PRESAGE_SERVICE_URL) {
    console.log(`  -> forwarding /analyze-frame to: ${PRESAGE_SERVICE_URL}`);
  } else {
    console.log('  -> using mock analysis (set PRESAGE_SERVICE_URL for SmartSpectra)');
  }
});

