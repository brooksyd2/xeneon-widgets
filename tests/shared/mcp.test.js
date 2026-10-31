const test = require('node:test');
const assert = require('node:assert');
const { createMcp, parseSse } = require('../../shared/mcp.js');

const sse = (o) => 'event: message\ndata: ' + JSON.stringify(o);
const toolOk = (text) => sse({ jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text }] } });
const res = (status, body, headers) => ({ status, headers: new Headers(headers || {}), text: async () => body || '' });
const initRes = (sid) => res(200, sse({ jsonrpc: '2.0', id: 1, result: {} }), { 'mcp-session-id': sid });

function fake(responses) {
  const reqs = [];
  const f = async (url, opts) => {
    reqs.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return r;
  };
  f.reqs = reqs;
  return f;
}
const mk = (f, extra) => createMcp(Object.assign({ url: 'http://x/mcp', key: 'k', fetch: f, timeoutMs: 1000 }, extra));

test('parseSse reads last data line or plain JSON', () => {
  assert.deepStrictEqual(parseSse('data: {"a":1}\ndata: {"a":2}'), { a: 2 });
  assert.deepStrictEqual(parseSse('{"a":3}'), { a: 3 });
});

test('initialises once, then reuses the session', async () => {
  const f = fake([initRes('s1'), res(202), res(200, toolOk('1')), res(200, toolOk('2'))]);
  const m = mk(f);
  await m.call('t', {});
  await m.call('t', {});
  assert.deepStrictEqual(f.reqs.map((r) => r.body.method), ['initialize', 'notifications/initialized', 'tools/call', 'tools/call']);
  for (const r of f.reqs.slice(2)) {
    assert.strictEqual(r.headers['mcp-session-id'], 's1');
    assert.strictEqual(r.headers.Authorization, 'Bearer k');
  }
});

test('parses SSE tool results', async () => {
  const f = fake([initRes('s1'), res(202), res(200, toolOk('{"a":1}'))]);
  assert.deepStrictEqual(await mk(f).call('t', {}), { a: 1 });
});

test('falls back to raw string for non-JSON text', async () => {
  const f = fake([initRes('s1'), res(202), res(200, toolOk('# Edited'))]);
  assert.strictEqual(await mk(f).call('t', {}), '# Edited');
});

for (const [name, status, body] of [['404', 404, ''], ['400 session', 400, 'Bad session id']]) {
  test('re-initialises once on expired session (' + name + ')', async () => {
    const f = fake([initRes('s1'), res(202), res(status, body), initRes('s2'), res(202), res(200, toolOk('{"ok":true}'))]);
    assert.deepStrictEqual(await mk(f).call('t', {}), { ok: true });
    assert.strictEqual(f.reqs[5].headers['mcp-session-id'], 's2');
  });
}

test('second consecutive session failure rejects with http', async () => {
  const f = fake([initRes('s1'), res(202), res(404), initRes('s2'), res(202), res(404)]);
  await assert.rejects(mk(f).call('t', {}), (e) => e.kind === 'http');
  assert.strictEqual(f.reqs.length, 6);
});

test('maps 401 to auth', async () => {
  await assert.rejects(mk(fake([res(401)])).call('t', {}), (e) => e.kind === 'auth');
});

test('maps fetch rejection to offline', async () => {
  await assert.rejects(mk(fake([new Error('down')])).call('t', {}), (e) => e.kind === 'offline');
});

test('maps timeout to offline', async () => {
  const f = (url, opts) => new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(new Error('aborted'))));
  await assert.rejects(mk(f, { timeoutMs: 20 }).call('t', {}), (e) => e.kind === 'offline');
});

test('maps result.isError to tool', async () => {
  const body = sse({ jsonrpc: '2.0', id: 2, result: { isError: true, content: [{ type: 'text', text: 'boom' }] } });
  await assert.rejects(mk(fake([initRes('s1'), res(202), res(200, body)])).call('t', {}), (e) => e.kind === 'tool' && /boom/.test(e.message));
});

test('maps JSON-RPC error to tool', async () => {
  const body = sse({ jsonrpc: '2.0', id: 2, error: { code: -1, message: 'bad' } });
  await assert.rejects(mk(fake([initRes('s1'), res(202), res(200, body)])).call('t', {}), (e) => e.kind === 'tool' && e.message === 'bad');
});

test('maps an error object in tool text to tool', async () => {
  const text = JSON.stringify({ error: { code: 'UNKNOWN_ERROR', message: 'File already exists.' }, context: {} });
  await assert.rejects(mk(fake([initRes('s1'), res(202), res(200, toolOk(text))])).call('t', {}), (e) => e.kind === 'tool' && e.message === 'File already exists.');
});

test('maps other status to http', async () => {
  await assert.rejects(mk(fake([res(500)])).call('t', {}), (e) => e.kind === 'http');
});
