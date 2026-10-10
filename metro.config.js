const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Dev-only proxy for the web build: the API server doesn't send CORS headers for
// browser origins, so the web app calls `/__api/...` on the dev server and it is
// forwarded server-side. Native builds call the API directly and never hit this.
const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL ?? 'https://65-1-30-38.nip.io/api/v1').replace(
  /\/api\/v1\/?$/,
  '',
);
const PREFIX = '/__api';

config.server.enhanceMiddleware = (metroMiddleware) => async (req, res, next) => {
  if (!req.url.startsWith(PREFIX + '/')) return metroMiddleware(req, res, next);

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    const headers = {};
    for (const name of ['content-type', 'accept', 'authorization']) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }

    const upstream = await fetch(API_ORIGIN + req.url.slice(PREFIX.length), {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });

    res.statusCode = upstream.status;
    for (const name of ['content-type', 'retry-after', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: { code: 'PROXY_ERROR', message: String(e) } }));
  }
};

module.exports = config;
