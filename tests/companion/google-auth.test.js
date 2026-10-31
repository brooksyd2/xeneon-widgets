const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { authUrl, pkce, exchangeCode, createAuth } = require('../../companion/google-auth');

const SCOPES = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.readonly';
const secret = { protect: async (t) => 'P:' + t, unprotect: async (t) => t.slice(2) };
const reply = (status, json) => ({ ok: status < 400, status, json: async () => json });

function setup(accounts = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ token: 't', clientId: 'cid', clientSecret: 'csec' }));
  if (accounts) fs.writeFileSync(path.join(dir, 'accounts.json'), JSON.stringify({ default: { email: 'a@b.c', refreshToken: 'P:rt' } }));
  return dir;
}

test('authUrl carries offline access, consent, PKCE and both scopes', () => {
  const u = new URL(authUrl({ clientId: 'cid', redirectUri: 'http://127.0.0.1:1/callback', challenge: 'ch', state: 'st' }));
  const p = u.searchParams;
  assert.strictEqual(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.strictEqual(p.get('access_type'), 'offline');
  assert.strictEqual(p.get('prompt'), 'consent');
  assert.strictEqual(p.get('code_challenge_method'), 'S256');
  assert.strictEqual(p.get('code_challenge'), 'ch');
  assert.strictEqual(p.get('scope'), SCOPES);
  assert.strictEqual(p.get('response_type'), 'code');
  assert.strictEqual(p.get('redirect_uri'), 'http://127.0.0.1:1/callback');
  assert.strictEqual(p.get('state'), 'st');
  assert.strictEqual(p.get('client_id'), 'cid');
});

test('pkce challenge is base64url sha256 of the verifier', () => {
  const { verifier, challenge } = pkce();
  assert.strictEqual(challenge, crypto.createHash('sha256').update(verifier).digest('base64url'));
});

test('exchangeCode posts the code with verifier and reads the email from the Gmail profile', async () => {
  const seen = [];
  const fetch = async (url, opts) => {
    seen.push({ url, opts });
    if (url === 'https://oauth2.googleapis.com/token') return reply(200, { access_token: 'at', refresh_token: 'rt', expires_in: 3600 });
    return reply(200, { emailAddress: 'me@x.y' });
  };
  const out = await exchangeCode({ code: 'c', verifier: 'v', redirectUri: 'r', clientId: 'cid', clientSecret: 'csec', fetch, now: () => 1000 });
  assert.deepStrictEqual(out, { refreshToken: 'rt', accessToken: 'at', expiresAt: 1000 + 3600e3, email: 'me@x.y' });
  const body = new URLSearchParams(seen[0].opts.body);
  assert.strictEqual(body.get('grant_type'), 'authorization_code');
  assert.strictEqual(body.get('code_verifier'), 'v');
  assert.strictEqual(body.get('code'), 'c');
  assert.strictEqual(seen[1].url, 'https://gmail.googleapis.com/gmail/v1/users/me/profile');
  assert.strictEqual(seen[1].opts.headers.Authorization, 'Bearer at');
});

test('getAccessToken refreshes once, caches until 60s before expiry, then refreshes again', async () => {
  let n = 0, t = 0;
  const bodies = [];
  const fetch = async (url, opts) => {
    bodies.push(new URLSearchParams(opts.body));
    return reply(200, { access_token: 'at' + ++n, expires_in: 3600 });
  };
  const auth = createAuth({ dir: setup(), fetch, now: () => t, secret });
  assert.strictEqual(await auth.getAccessToken(), 'at1');
  assert.strictEqual(bodies[0].get('grant_type'), 'refresh_token');
  assert.strictEqual(bodies[0].get('refresh_token'), 'rt');
  t = 3600e3 - 61e3;
  assert.strictEqual(await auth.getAccessToken(), 'at1');
  t = 3600e3 - 60e3;
  assert.strictEqual(await auth.getAccessToken(), 'at2');
  auth.invalidate();
  assert.strictEqual(await auth.getAccessToken(), 'at3');
  assert.strictEqual(n, 3);
});

test('invalid_grant rejects with 503 signed_out', async () => {
  const fetch = async () => reply(400, { error: 'invalid_grant' });
  const auth = createAuth({ dir: setup(), fetch, now: () => 0, secret });
  await assert.rejects(auth.getAccessToken(), { status: 503, kind: 'signed_out' });
});

test('other Google failures reject with 502 google', async () => {
  const auth = createAuth({ dir: setup(), fetch: async () => reply(500, {}), now: () => 0, secret });
  await assert.rejects(auth.getAccessToken(), { status: 502, kind: 'google' });
});

test('no accounts.json is signed out', async () => {
  const auth = createAuth({ dir: setup(false), fetch: async () => assert.fail('no fetch'), now: () => 0, secret });
  await assert.rejects(auth.getAccessToken(), { status: 503, kind: 'signed_out' });
  assert.strictEqual(await auth.signedIn(), false);
  assert.strictEqual(auth.email(), undefined);
});

test('signedIn and email reflect accounts.json', async () => {
  const auth = createAuth({ dir: setup(), fetch: async () => {}, now: () => 0, secret });
  assert.strictEqual(await auth.signedIn(), true);
  assert.strictEqual(auth.email(), 'a@b.c');
});
