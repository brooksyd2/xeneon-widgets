const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { HttpError } = require('./server');
const { loadConfig } = require('./config');
const realSecret = require('./secret');

const SCOPES = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';

function authUrl({ clientId, redirectUri, challenge, state }) {
  const q = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES,
    access_type: 'offline', prompt: 'consent', code_challenge: challenge, code_challenge_method: 'S256', state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

function pkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') };
}

// Network failures reject fetch with a raw TypeError; report them as Google being unreachable.
const safeFetch = (fetch, ...args) => fetch(...args).catch(() => { throw new HttpError(502, 'google'); });

async function tokenRequest(fetch, params) {
  const res = await safeFetch(fetch, TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (json.error === 'invalid_grant') throw new HttpError(503, 'signed_out');
    throw new HttpError(502, 'google');
  }
  return json;
}

async function exchangeCode({ code, verifier, redirectUri, clientId, clientSecret, fetch = globalThis.fetch, now = Date.now }) {
  const t = await tokenRequest(fetch, {
    grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri,
    client_id: clientId, client_secret: clientSecret,
  });
  const res = await safeFetch(fetch, PROFILE_URL, { headers: { Authorization: `Bearer ${t.access_token}` } });
  if (!res.ok) throw new HttpError(502, 'google');
  const { emailAddress } = await res.json();
  return { refreshToken: t.refresh_token, accessToken: t.access_token, expiresAt: now() + t.expires_in * 1000, email: emailAddress };
}

const accountsFile = (dir) => path.join(dir, 'accounts.json');
function readAccount(dir) {
  try { return JSON.parse(fs.readFileSync(accountsFile(dir), 'utf8')).default || null; } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

function createAuth({ dir, fetch = globalThis.fetch, now = Date.now, secret = realSecret }) {
  let cached = null; // { token, expiresAt }
  const needAccount = () => { const a = readAccount(dir); if (!a) throw new HttpError(503, 'signed_out'); return a; };
  return {
    async getAccessToken() {
      if (cached && now() < cached.expiresAt - 60e3) return cached.token;
      const account = needAccount();
      const { clientId, clientSecret } = loadConfig(dir);
      const t = await tokenRequest(fetch, {
        grant_type: 'refresh_token', refresh_token: await secret.unprotect(account.refreshToken).catch(() => { throw new HttpError(503, 'signed_out'); }),
        client_id: clientId, client_secret: clientSecret,
      });
      cached = { token: t.access_token, expiresAt: now() + t.expires_in * 1000 };
      return cached.token;
    },
    invalidate() { cached = null; },
    async signedIn() { return readAccount(dir) !== null; },
    email() { return readAccount(dir)?.email; },
  };
}

function openUrl(url, spawnFn = spawn) {
  const child = spawnFn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' });
  child.on('error', () => {}); // missing binary arrives as an async event; the printed URL is the fallback
  child.unref();
}

async function signin({ dir, openBrowser = openUrl, fetch = globalThis.fetch, secret = realSecret, log = console.log }) {
  const { clientId, clientSecret } = loadConfig(dir);
  if (!clientId || !clientSecret) throw new Error('Set clientId and clientSecret in config.json first (see the README).');
  const { verifier, challenge } = pkce();
  const state = crypto.randomBytes(16).toString('hex');
  let finish;
  const done = new Promise((resolve, reject) => { finish = { resolve, reject }; });
  done.catch(() => {}); // rejection may land before it is awaited
  const server = http.createServer((req, res) => {
    const q = new URL(req.url, 'http://127.0.0.1').searchParams;
    if (!req.url.startsWith('/callback')) { res.writeHead(404); return res.end(); }
    const ok = q.get('state') === state && q.get('code');
    res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/plain' });
    res.end(ok ? 'Signed in. You can close this tab.' : 'Sign-in failed.');
    if (ok) finish.resolve(q.get('code'));
    else finish.reject(new Error(q.get('error') || 'Sign-in failed: state mismatch'));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
    const url = authUrl({ clientId, redirectUri, challenge, state });
    log(`Opening Google sign-in. If nothing opens, visit:\n${url}`);
    try { await openBrowser(url); } catch (e) { log(`Could not open the browser: ${e.message}`); }
    const code = await done;
    const r = await exchangeCode({ code, verifier, redirectUri, clientId, clientSecret, fetch });
    if (!r.refreshToken) throw new Error('Google returned no refresh token; remove the app at myaccount.google.com/permissions and retry.');
    fs.writeFileSync(accountsFile(dir), JSON.stringify({ default: { email: r.email, refreshToken: await secret.protect(r.refreshToken) } }, null, 2));
    log(`Signed in as ${r.email}`);
    return r.email;
  } finally {
    server.close();
    server.closeAllConnections();
  }
}

module.exports = { authUrl, pkce, exchangeCode, createAuth, signin, openUrl };
