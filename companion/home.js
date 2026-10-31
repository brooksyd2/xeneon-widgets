const { HttpError } = require('./server');

const ENTITIES = {
  cameras: [
    { id: 'garden', entity: 'camera.camera_back_garden_high_resolution_channel', name: 'Back Garden' },
    { id: 'front', entity: 'camera.camera_front_high_resolution_channel', name: 'Front' },
    { id: 'door', entity: 'camera.doorbell_front_high_resolution_channel', name: 'Doorbell' },
  ],
  ac: [
    { id: 'office', entity: 'climate.damian_s_office', name: 'Damian’s Office', big: true },
    { id: 'bed', entity: 'climate.damian_s_bedroom', name: 'Damian’s Bedroom', big: true },
    { id: 'down', entity: 'climate.downstairs_office', name: 'Downstairs Office', big: false },
    { id: 'kitchen', entity: 'climate.kitchen', name: 'Kitchen', big: false },
    { id: 'living', entity: 'climate.living_room', name: 'Living Room', big: false },
    { id: 'main', entity: 'climate.main_bedroom', name: 'Main Bedroom', big: false },
    { id: 'snug', entity: 'climate.snug', name: 'Snug', big: false },
    { id: 'spare', entity: 'climate.spare_bedroom', name: 'Spare Bedroom', big: false },
  ],
  heating: 'climate.hallway',
  coffee: 'switch.coffee_machine_plug',
};

const MODES = { cool: 'cool', heat: 'heat', dry: 'dry', fan_only: 'fan', heat_cool: 'auto' };

function mapState(states) {
  const by = new Map(states.map((s) => [s.entity_id, s]));
  const get = (entity) => by.get(entity) || { state: null, attributes: {}, last_changed: null };
  const num = (v) => (v === undefined ? null : v);
  return {
    cameras: ENTITIES.cameras.map(({ id, entity, name }) => {
      const s = get(entity);
      return { id, name, online: s.state !== null && s.state !== 'unavailable', last: s.last_changed };
    }),
    ac: ENTITIES.ac.map(({ id, entity, name, big }) => {
      const s = get(entity), a = s.attributes;
      const on = s.state !== null && s.state !== 'off';
      return { id, name, big, on, mode: on ? MODES[s.state] || null : null, room: num(a.current_temperature), target: num(a.temperature) };
    }),
    heat: (() => {
      const s = get(ENTITIES.heating), a = s.attributes;
      return { mode: s.state, room: num(a.current_temperature), target: num(a.temperature), action: num(a.hvac_action), min: num(a.min_temp), max: num(a.max_temp) };
    })(),
    coffee: (() => {
      const s = get(ENTITIES.coffee);
      return { on: s.state === 'on', since: s.last_changed };
    })(),
  };
}

function createHa({ url, token, fetch, timeoutMs = 5000 }) {
  async function raw(path, signal, init = {}) {
    const ctl = new AbortController();
    const abort = () => ctl.abort();
    if (signal) { if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true }); }
    const timer = setTimeout(abort, timeoutMs);
    let res;
    try {
      res = await fetch(url + path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` }, signal: ctl.signal });
    } catch (e) {
      throw new HttpError(502, 'home_assistant');
    } finally { clearTimeout(timer); }
    if (res.status === 401) throw new HttpError(503, 'ha_unauthorised');
    if (!res.ok) throw new HttpError(502, 'home_assistant');
    return res;
  }
  const json = async (path, init) => {
    const res = await raw(path, undefined, init);
    try { return await res.json(); } catch { throw new HttpError(502, 'home_assistant'); }
  };
  return {
    raw,
    get: (path) => json(path),
    call: (domain, service, data) => json(`/api/services/${domain}/${service}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }),
  };
}

function validateTarget(value, { min, max }) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || !Number.isInteger(value * 2)) {
    throw new HttpError(400, 'bad_request');
  }
  return value;
}

function homeRoutes({ ha }) {
  const route = (method, path, fn) => ({
    method, path, handler: async (req, ctx) => {
      if (!ha) throw new HttpError(503, 'ha_not_configured');
      return fn(ctx || {});
    },
  });
  const ok = { json: { ok: true } };
  return [
    route('GET', '/home/state', async () => ({ json: mapState(await ha.get('/api/states')) })),
    route('POST', '/home/ac/:id/toggle', async ({ params, body }) => {
      const unit = ENTITIES.ac.find((a) => a.id === params.id);
      if (!unit) throw new HttpError(404, 'not_found');
      if (!body || typeof body.on !== 'boolean') throw new HttpError(400, 'bad_request');
      await ha.call('climate', body.on ? 'turn_on' : 'turn_off', { entity_id: unit.entity });
      return ok;
    }),
    route('POST', '/home/heating/target', async ({ body }) => {
      const entity = ENTITIES.heating;
      const s = await ha.get(`/api/states/${entity}`);
      const temperature = validateTarget(body && body.target, { min: s.attributes.min_temp, max: s.attributes.max_temp });
      await ha.call('climate', 'set_temperature', { entity_id: entity, temperature, ...(s.state === 'off' && { hvac_mode: 'heat' }) });
      return ok;
    }),
    route('POST', '/home/coffee/on', async () => {
      await ha.call('switch', 'turn_on', { entity_id: ENTITIES.coffee });
      return ok;
    }),
  ];
}

module.exports = { ENTITIES, mapState, createHa, validateTarget, homeRoutes };
