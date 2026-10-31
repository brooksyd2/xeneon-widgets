const test = require('node:test');
const assert = require('node:assert');
const { mapState, homeRoutes, createHa } = require('../../companion/home');
const states = require('./fixtures/ha-states.json');

const reply = (json, status = 200) => ({ ok: status < 400, status, json: async () => json });

function setup(fetch) {
  const calls = [];
  const wrapped = async (u, init = {}) => { calls.push([u, init]); return fetch(u, init); };
  const routes = homeRoutes({ ha: createHa({ url: 'http://ha:8123', token: 'hatok', fetch: wrapped }) });
  const call = (method, path, params = {}, body, signal) => routes.find((r) => r.method === method && r.path === path).handler({}, { params, body, signal });
  return { call, calls };
}

test('mapState maps the fixture', () => {
  const m = mapState(states);
  assert.deepStrictEqual(m.cameras.map((c) => [c.id, c.online]), [['garden', true], ['front', false], ['door', true]]);
  assert.strictEqual(m.cameras[1].last, '2026-10-31T09:12:00+00:00');
  assert.strictEqual(m.ac.length, 8);
  assert.deepStrictEqual(m.ac[0], { id: 'office', name: 'Damian’s Office', big: true, on: true, mode: 'cool', room: 23.5, target: 21 });
  assert.ok(m.ac[1].on === false && m.ac[1].mode === null);
  assert.deepStrictEqual(m.heat, { mode: 'heat', room: 19.2, target: 17.9, action: 'idle', min: 10, max: 32 });
  assert.deepStrictEqual(m.coffee, { on: true, since: '2026-10-31T14:20:00+00:00' });
});

test('mapState tolerates a missing entity', () => {
  const snug = mapState(states.filter((s) => s.entity_id !== 'climate.snug')).ac.find((a) => a.id === 'snug');
  assert.strictEqual(snug.on, false);
  assert.strictEqual(snug.room, null);
  assert.strictEqual(snug.target, null);
});

test('fan_only and heat_cool map to fan and auto', () => {
  const mode = (state) => mapState(states.map((s) => (s.entity_id === 'climate.snug' ? { ...s, state } : s))).ac.find((a) => a.id === 'snug').mode;
  assert.strictEqual(mode('fan_only'), 'fan');
  assert.strictEqual(mode('heat_cool'), 'auto');
});

test('toggle calls climate.turn_on with the whitelisted entity', async () => {
  const s = setup(async () => reply([]));
  assert.deepStrictEqual((await s.call('POST', '/home/ac/:id/toggle', { id: 'bed' }, { on: true })).json, { ok: true });
  const [url, init] = s.calls[0];
  assert.ok(url.endsWith('/api/services/climate/turn_on'));
  assert.strictEqual(init.body, '{"entity_id":"climate.damian_s_bedroom"}');
  assert.strictEqual(init.headers.Authorization, 'Bearer hatok');
});

test('toggle rejects an unknown id without calling Home Assistant', async () => {
  const s = setup(async () => reply([]));
  await assert.rejects(s.call('POST', '/home/ac/:id/toggle', { id: 'hallway' }, { on: true }), { status: 404, kind: 'not_found' });
  assert.strictEqual(s.calls.length, 0);
});

test('toggle rejects a non-boolean on', async () => {
  const s = setup(async () => reply([]));
  await assert.rejects(s.call('POST', '/home/ac/:id/toggle', { id: 'bed' }, { on: 'yes' }), { status: 400, kind: 'bad_request' });
});

const hallway = (state = 'heat') => async (u) => reply(u.includes('/api/states/') ? { state, attributes: { min_temp: 10, max_temp: 32 } } : []);

test("heating target is validated against the entity's limits", async () => {
  const s = setup(hallway());
  assert.deepStrictEqual((await s.call('POST', '/home/heating/target', {}, { target: 18.5 })).json, { ok: true });
  for (const target of [18.4, 9.5, 32.5, '20', NaN]) {
    await assert.rejects(s.call('POST', '/home/heating/target', {}, { target }), { status: 400, kind: 'bad_request' });
  }
});

test('heating target adds hvac_mode heat only when off', async () => {
  const body = async (state) => {
    const s = setup(hallway(state));
    await s.call('POST', '/home/heating/target', {}, { target: 18 });
    return s.calls[1][1].body;
  };
  assert.strictEqual(await body('heat'), '{"entity_id":"climate.hallway","temperature":18}');
  assert.strictEqual(await body('off'), '{"entity_id":"climate.hallway","temperature":18,"hvac_mode":"heat"}');
});

test('coffee on calls switch.turn_on', async () => {
  const s = setup(async () => reply([]));
  await s.call('POST', '/home/coffee/on');
  assert.ok(s.calls[0][0].endsWith('/api/services/switch/turn_on'));
  assert.strictEqual(s.calls[0][1].body, '{"entity_id":"switch.coffee_machine_plug"}');
});

test('errors map to home_assistant, ha_unauthorised, ha_not_configured', async () => {
  const state = (fetch) => setup(fetch).call('GET', '/home/state');
  await assert.rejects(state(async () => { throw new Error('down'); }), { status: 502, kind: 'home_assistant' });
  await assert.rejects(state(async () => reply({}, 500)), { status: 502, kind: 'home_assistant' });
  await assert.rejects(state(async () => reply({}, 401)), { status: 503, kind: 'ha_unauthorised' });
  const none = homeRoutes({ ha: null }).find((r) => r.path === '/home/state');
  await assert.rejects(none.handler({}, {}), { status: 503, kind: 'ha_not_configured' });
});

test('timeout covers only the wait for headers', async () => {
  const ha = createHa({ url: 'http://ha', token: 't', timeoutMs: 20, fetch: (u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted')))) });
  await assert.rejects(ha.get('/x'), { status: 502, kind: 'home_assistant' });
  const slow = createHa({ url: 'http://ha', token: 't', timeoutMs: 20, fetch: async (u, { signal }) => ({ ok: true, status: 200, signal }) });
  const res = await slow.raw('/x');
  await new Promise((r) => setTimeout(r, 40));
  assert.strictEqual(res.signal.aborted, false);
});

const streamReply = (bytes, type = 'image/jpeg', status = 200) => ({
  ok: status < 400, status, headers: { get: (h) => (h.toLowerCase() === 'content-type' ? type : null) },
  body: new Response(bytes).body,
});
const camera = (fetch, id, kind, signal) => {
  const s = setup(fetch);
  return { ...s, result: s.call('GET', `/home/cameras/:id/${kind}`, { id }, undefined, signal) };
};

test('still proxies camera_proxy for the whitelisted camera', async () => {
  const c = camera(async () => streamReply('JPEG'), 'door', 'still');
  const r = await c.result;
  assert.ok(c.calls[0][0].endsWith('/api/camera_proxy/camera.doorbell_front_high_resolution_channel'));
  assert.strictEqual(r.contentType, 'image/jpeg');
  assert.strictEqual(await new Response(r.stream).text(), 'JPEG');
});

test('live passes the multipart content type and the request signal', async () => {
  const ctl = new AbortController();
  const type = 'multipart/x-mixed-replace; boundary=frame';
  const c = camera(async () => streamReply('x', type), 'garden', 'live', ctl.signal);
  const r = await c.result;
  assert.ok(c.calls[0][0].endsWith('/api/camera_proxy_stream/camera.camera_back_garden_high_resolution_channel'));
  assert.strictEqual(r.contentType, type);
  assert.strictEqual(c.calls[0][1].signal.aborted, false);
  ctl.abort();
  assert.strictEqual(c.calls[0][1].signal.aborted, true);
});

test('caller abort listener is removed once headers arrive', async () => {
  let added = 0, removed = 0;
  const signal = { aborted: false, addEventListener: () => added++, removeEventListener: () => removed++ };
  await createHa({ url: 'http://ha', token: 't', fetch: async () => ({ ok: true, status: 200 }) }).raw('/x', signal);
  assert.deepStrictEqual([added, removed], [1, 1]);
});

test('camera routes are flagged queryToken and others are not', () => {
  const routes = homeRoutes({ ha: null });
  assert.deepStrictEqual(routes.filter((r) => r.queryToken).map((r) => r.path), ['/home/cameras/:id/still', '/home/cameras/:id/live']);
});

test('unknown camera id is 404 without calling Home Assistant', async () => {
  const c = camera(async () => streamReply('x'), 'alley', 'still');
  await assert.rejects(c.result, { status: 404 });
  assert.strictEqual(c.calls.length, 0);
});

test('camera 500 from Home Assistant maps to home_assistant', async () => {
  await assert.rejects(camera(async () => streamReply('', 'text/plain', 500), 'door', 'live').result, { status: 502, kind: 'home_assistant' });
});
