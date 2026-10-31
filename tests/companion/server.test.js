const test = require('node:test');
const assert = require('node:assert');
const { createServer, listen, HttpError } = require('../../companion/server');

const routes = [
  { method: 'GET', path: '/ping', handler: async () => ({ json: { pong: true } }) },
  { method: 'GET', path: '/item/:id', handler: async (req, { params }) => ({ json: params }) },
  { method: 'GET', path: '/signed-out', handler: async () => { throw new HttpError(503, 'signed_out'); } },
  { method: 'GET', path: '/duck', handler: async () => { throw Object.assign(new Error('x'), { status: 404, kind: 'not_found' }); } },
  { method: 'GET', path: '/boom', handler: async () => { throw new Error('secret detail'); } },
  { method: 'GET', path: '/img', queryToken: true, handler: async () => ({ json: { img: true } }) },
  { method: 'GET', path: '/pic', handler: async () => ({ contentType: 'image/jpeg', stream: new Blob([Buffer.from('JPEGDATA')]).stream() }) },
  { method: 'GET', path: '/endless', handler: async (req, { signal }) => {
    seenSignal = signal;
    let timer;
    const stream = new ReadableStream({
      start(c) { timer = setInterval(() => { if (signal.aborted) clearInterval(timer); else c.enqueue(Buffer.from('x')); }, 50); },
      cancel() { clearInterval(timer); },
    });
    return { contentType: 'image/jpeg', stream };
  } },
];
let seenSignal;

async function withServer(fn) {
  const server = createServer({ token: 'tok', routes });
  await listen(server, 0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base, server); } finally { server.close(); }
}
const auth = { headers: { Authorization: 'Bearer tok' } };

test('rejects missing and wrong tokens', () => withServer(async (base) => {
  for (const opts of [{}, { headers: { Authorization: 'Bearer nope' } }]) {
    const res = await fetch(`${base}/v1/ping`, opts);
    assert.strictEqual(res.status, 401);
    assert.deepStrictEqual(await res.json(), { error: 'unauthorized' });
  }
}));

test('OPTIONS answers 204 with CORS headers and no auth', () => withServer(async (base) => {
  const res = await fetch(`${base}/v1/state`, { method: 'OPTIONS' });
  assert.strictEqual(res.status, 204);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
  assert.strictEqual(res.headers.get('access-control-allow-headers'), 'Authorization, Content-Type, Accept');
  assert.strictEqual(res.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS');
}));

test('serves a registered route and decodes params', () => withServer(async (base) => {
  const res = await fetch(`${base}/v1/ping`, auth);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
  assert.deepStrictEqual(await res.json(), { pong: true });
  const p = await fetch(`${base}/v1/item/a%20b%2Fc`, auth);
  assert.deepStrictEqual(await p.json(), { id: 'a b/c' });
}));

test('unknown path is 404 not_found', () => withServer(async (base) => {
  const res = await fetch(`${base}/v1/nothing`, auth);
  assert.strictEqual(res.status, 404);
  assert.deepStrictEqual(await res.json(), { error: 'not_found' });
}));

test('HttpError maps to its status and kind; other errors to 502 google', () => withServer(async (base) => {
  const a = await fetch(`${base}/v1/signed-out`, auth);
  assert.strictEqual(a.status, 503);
  assert.deepStrictEqual(await a.json(), { error: 'signed_out' });
  const b = await fetch(`${base}/v1/boom`, auth);
  assert.strictEqual(b.status, 502);
  assert.deepStrictEqual(await b.json(), { error: 'google' });
}));

test('listen binds 127.0.0.1', () => withServer(async (base, server) => {
  assert.strictEqual(server.address().address, '127.0.0.1');
}));

test('any error with status and kind is mapped (duck-typed)', () => withServer(async (base) => {
  const res = await fetch(`${base}/v1/duck`, auth);
  assert.strictEqual(res.status, 404);
  assert.deepStrictEqual(await res.json(), { error: 'not_found' });
}));

test('queryToken route accepts ?token= and others do not', () => withServer(async (base) => {
  assert.strictEqual((await fetch(`${base}/v1/img?token=tok`)).status, 200);
  assert.strictEqual((await fetch(`${base}/v1/ping?token=tok`)).status, 401);
  assert.strictEqual((await fetch(`${base}/v1/img?token=nope`)).status, 401);
}));

test('stream result is piped with its content type', () => withServer(async (base) => {
  const res = await fetch(`${base}/v1/pic`, auth);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('content-type'), 'image/jpeg');
  assert.strictEqual(res.headers.get('cache-control'), 'no-store');
  assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
  assert.strictEqual(await res.text(), 'JPEGDATA');
}));

test('client disconnect aborts the handler signal', () => withServer(async (base) => {
  const ac = new AbortController();
  const res = await fetch(`${base}/v1/endless`, { ...auth, signal: ac.signal });
  await res.body.getReader().read();
  ac.abort();
  for (let i = 0; i < 20 && !seenSignal.aborted; i++) await new Promise((r) => setTimeout(r, 50));
  assert.strictEqual(seenSignal.aborted, true);
}));
