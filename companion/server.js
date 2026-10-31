const http = require('node:http');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');

const PORT = 8817;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

class HttpError extends Error {
  constructor(status, kind) { super(kind); this.status = status; this.kind = kind; }
}

function tokenOk(header, token) {
  const given = Buffer.from((header || '').replace(/^Bearer /, ''));
  const want = Buffer.from(token);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

// Returns params object if the pattern matches, else null.
function match(pattern, path) {
  const a = pattern.split('/'), b = path.split('/');
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] === ':') {
      try { params[a[i].slice(1)] = decodeURIComponent(b[i]); } catch { return null; }
    } else if (a[i] !== b[i]) return null;
  }
  return params;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'bad_request'); }
}

function createServer({ token, routes }) {
  return http.createServer(async (req, res) => {
    const send = (status, json) => {
      res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(json));
    };
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableFinished) ac.abort(); });
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const path = url.pathname.startsWith('/v1/') ? url.pathname.slice(3) : null;
      let route = null, params = null;
      for (const r of routes) {
        params = path !== null && r.method === req.method && match(r.path, path);
        if (params) { route = r; break; }
      }
      const given = req.headers.authorization || (route && route.queryToken ? url.searchParams.get('token') : '');
      if (!tokenOk(given, token)) throw new HttpError(401, 'unauthorized');
      if (!route) throw new HttpError(404, 'not_found');
      const body = req.method === 'POST' ? await readBody(req) : undefined;
      const out = await route.handler(req, { params, body, query: url.searchParams, signal: ac.signal });
      if (!out.stream) return send(out.status || 200, out.json);
      res.writeHead(200, { ...CORS, 'Content-Type': out.contentType, 'Cache-Control': 'no-store' });
      Readable.fromWeb(out.stream).on('error', () => res.destroy()).pipe(res);
    } catch (e) {
      if (e && e.status && e.kind) return send(e.status, { error: e.kind });
      console.error(e && e.message);
      send(502, { error: 'google' });
    }
  });
}

function listen(server, port = PORT) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

module.exports = { createServer, listen, HttpError, PORT };
