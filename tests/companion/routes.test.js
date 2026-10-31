process.env.TZ = 'Europe/London';
const test = require('node:test');
const assert = require('node:assert');
const { makeRoutes } = require('../../companion/routes');
const { HttpError } = require('../../companion/server');

const reply = (json, status = 200) => ({ ok: status < 400, status, json: async () => json });
const NOW = Date.parse('2026-10-31T10:00:00Z');

function setup(fetch, authOver = {}) {
  let n = 0, invalidated = 0;
  const auth = { getAccessToken: async () => 'tok' + ++n, invalidate: () => invalidated++, email: () => 'me@x.com', ...authOver };
  const routes = makeRoutes({ auth, fetch, now: () => NOW });
  const call = (method, path, params = {}) => routes.find((r) => r.method === method && r.path === path).handler({}, { params });
  return { call, invalidated: () => invalidated };
}

const ev = (id, start, extra = {}) => ({ id, summary: id, start: { dateTime: start }, end: { dateTime: start }, ...extra });

test('GET /state returns account, today events, tomorrowFirst and messages', async () => {
  const fetch = async (u) => {
    if (u.includes('/calendar/')) {
      const tomorrow = new URL(u).searchParams.get('timeMin').startsWith('2026-11-01');
      return reply({ items: tomorrow ? [{ id: 'ad', summary: 'Holiday', start: { date: '2026-11-01' }, end: { date: '2026-11-02' } }, ev('t1', '2026-11-01T09:00:00Z')] : [ev('e1', '2026-10-31T11:00:00Z')] });
    }
    if (u.includes('/messages?')) return reply({ messages: [{ id: 'm1' }] });
    return reply({ id: 'm1', threadId: 'T1', internalDate: '0', labelIds: ['UNREAD'], payload: { headers: [{ name: 'From', value: 'a@x.com' }] } });
  };
  const { json } = await setup(fetch).call('GET', '/state');
  assert.strictEqual(json.account, 'me@x.com');
  assert.deepStrictEqual(json.events.map((e) => e.id), ['e1']);
  assert.strictEqual(json.tomorrowFirst.id, 't1');
  assert.strictEqual(json.messages[0].unread, true);
});

test('archive calls threads/T1/modify removing INBOX; read removes UNREAD', async () => {
  const calls = [];
  const fetch = async (u, init = {}) => { calls.push([u, init.body]); return reply({ threadId: 'T1' }); };
  const s = setup(fetch);
  await s.call('POST', '/messages/:id/archive', { id: 'm1' });
  await s.call('POST', '/messages/:id/read', { id: 'm1' });
  assert.ok(calls[1][0].endsWith('/threads/T1/modify'));
  assert.strictEqual(calls[1][1], '{"removeLabelIds":["INBOX"]}');
  assert.strictEqual(calls[3][1], '{"removeLabelIds":["UNREAD"]}');
});

test('archive of an id Gmail 404s gives 404 not_found', async () => {
  const s = setup(async () => reply({}, 404));
  await assert.rejects(s.call('POST', '/messages/:id/archive', { id: 'gone' }), { status: 404, kind: 'not_found' });
});

test('empty id is 400 bad_request', async () => {
  await assert.rejects(setup(async () => reply({})).call('GET', '/messages/:id', { id: '' }), { status: 400, kind: 'bad_request' });
});

test('Google 401 refreshes once and retries; second 401 is signed_out', async () => {
  let n = 0;
  const flaky = async () => (n++ === 0 ? reply({}, 401) : reply({ payload: { mimeType: 'text/plain', body: { data: Buffer.from('hi').toString('base64url') } } }));
  const s = setup(flaky);
  assert.deepStrictEqual((await s.call('GET', '/messages/:id', { id: 'm1' })).json, { body: 'hi' });
  assert.strictEqual(s.invalidated(), 1);
  const s2 = setup(async () => reply({}, 401));
  await assert.rejects(s2.call('GET', '/messages/:id', { id: 'm1' }), { status: 503, kind: 'signed_out' });
  assert.strictEqual(s2.invalidated(), 1);
});

test('invalid_grant from auth surfaces as 503 signed_out; other Google failures are 502 google', async () => {
  const out = setup(async () => reply({}), { getAccessToken: async () => { throw new HttpError(503, 'signed_out'); } });
  await assert.rejects(out.call('GET', '/state'), { status: 503, kind: 'signed_out' });
  await assert.rejects(setup(async () => reply({}, 500)).call('GET', '/state'), { status: 502, kind: 'google' });
});

function joinSetup(event, status = 200, failGranola = false) {
  const opened = [];
  const launcher = { granolaUrl: (id) => 'granola://new-document?event=' + id, openUrl: (u) => { if (failGranola && u.startsWith('granola')) throw new Error('boom'); opened.push(u); } };
  const routes = makeRoutes({ auth: { getAccessToken: async () => 't', invalidate() {} }, fetch: async () => reply(event, status), now: () => NOW, launcher });
  return { opened, join: (id = 'e1') => routes.find((r) => r.path === '/events/:id/join').handler({}, { params: { id } }) };
}
const meetEv = (end, extra = {}) => ({ id: 'e1', summary: 'S', start: { dateTime: '2026-10-31T09:00:00Z' }, end: { dateTime: end }, hangoutLink: 'https://meet.google.com/abc-defg-hij', ...extra });

test('join opens Meet then Granola', async () => {
  const s = joinSetup(meetEv('2026-10-31T11:00:00Z'));
  assert.deepStrictEqual((await s.join()).json, { ok: true });
  assert.deepStrictEqual(s.opened, ['https://meet.google.com/abc-defg-hij', 'granola://new-document?event=e1']);
});

test('join of an ended, Meet-less or non-Meet event is 400 and opens nothing; unknown is 404', async () => {
  for (const ev of [meetEv('2026-10-31T10:00:00Z'), meetEv('2026-10-31T11:00:00Z', { hangoutLink: undefined }), meetEv('2026-10-31T11:00:00Z', { hangoutLink: 'https://evil.com/x' })]) {
    const s = joinSetup(ev);
    await assert.rejects(s.join(), { status: 400, kind: 'bad_request' });
    assert.deepStrictEqual(s.opened, []);
  }
  const s = joinSetup({}, 404);
  await assert.rejects(s.join(), { status: 404, kind: 'not_found' });
  assert.deepStrictEqual(s.opened, []);
});

test('join still succeeds when the Granola open throws', async () => {
  const s = joinSetup(meetEv('2026-10-31T11:00:00Z'), 200, true);
  const err = console.error; console.error = () => {};
  try { assert.deepStrictEqual((await s.join()).json, { ok: true }); } finally { console.error = err; }
  assert.deepStrictEqual(s.opened, ['https://meet.google.com/abc-defg-hij']);
});
