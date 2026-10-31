process.env.TZ = 'Europe/London'; // must precede any Date use
const test = require('node:test');
const assert = require('node:assert');
const { dayRange, toEvent, keepEvent, listEvents } = require('../../companion/calendar');

const base = { id: 'e1', summary: 'Standup', start: { dateTime: '2026-10-31T09:00:00Z' }, end: { dateTime: '2026-10-31T09:15:00Z' } };

test('keepEvent drops declined, cancelled and non-meeting types, keeps plain events', () => {
  assert.strictEqual(keepEvent({ ...base, status: 'cancelled' }), false);
  for (const eventType of ['focusTime', 'outOfOffice', 'workingLocation']) assert.strictEqual(keepEvent({ ...base, eventType }), false);
  assert.strictEqual(keepEvent({ ...base, attendees: [{ self: true, responseStatus: 'declined' }] }), false);
  assert.strictEqual(keepEvent({ ...base, eventType: 'default', attendees: [{ self: true, responseStatus: 'accepted' }] }), true);
});

test('toEvent takes Meet from conferenceData and ignores non-Meet video', () => {
  const conf = (uri) => ({ conferenceData: { entryPoints: [{ entryPointType: 'phone', uri: 'tel:1' }, { entryPointType: 'video', uri }] } });
  assert.strictEqual(toEvent({ ...base, ...conf('https://meet.google.com/abc-defg-hij') }).meetUrl, 'https://meet.google.com/abc-defg-hij');
  assert.strictEqual('meetUrl' in toEvent({ ...base, ...conf('https://zoom.us/j/1') }), false);
  assert.strictEqual(toEvent({ ...base, hangoutLink: 'https://meet.google.com/x', ...conf('https://zoom.us/j/1') }).meetUrl, 'https://meet.google.com/x');
});

test('toEvent defaults title, counts guests, converts all-day dates', () => {
  const e = toEvent({ id: 'a', start: { date: '2026-10-25' }, end: { date: '2026-10-26' }, location: 'HQ',
    attendees: [{ self: true }, { email: 'r@x', resource: true }, { email: 'p@x' }, { email: 'q@x' }] });
  assert.deepStrictEqual(e, { id: 'a', title: '(no title)', start: '2026-10-25T00:00:00+01:00', end: '2026-10-26T00:00:00+00:00', allDay: true, guests: 2, location: 'HQ' });
});

test('dayRange on 2026-10-25 (clocks go back) spans 25 hours between local midnights', () => {
  const r = dayRange(Date.parse('2026-10-25T12:00:00Z'), 0);
  assert.deepStrictEqual(r, { timeMin: '2026-10-25T00:00:00+01:00', timeMax: '2026-10-26T00:00:00+00:00' });
  assert.strictEqual((Date.parse(r.timeMax) - Date.parse(r.timeMin)) / 36e5, 25);
  assert.strictEqual(dayRange(Date.parse('2026-10-24T12:00:00Z'), 1).timeMin, '2026-10-25T00:00:00+01:00');
});

test('listEvents follows nextPageToken and filters', async () => {
  const urls = [];
  const pages = [{ items: [base], nextPageToken: 'n2' }, { items: [{ ...base, id: 'e2', status: 'cancelled' }, { ...base, id: 'e3' }] }];
  const fetch = async (u, init) => { urls.push(u); assert.strictEqual(init.headers.Authorization, 'Bearer tk'); return { ok: true, status: 200, json: async () => pages.shift() }; };
  const out = await listEvents({ token: 'tk', fetch, range: { timeMin: 'a', timeMax: 'b' } });
  assert.deepStrictEqual(out.map((e) => e.id), ['e1', 'e3']);
  const q = new URL(urls[1]).searchParams;
  assert.strictEqual(q.get('pageToken'), 'n2');
  assert.strictEqual(q.get('singleEvents'), 'true');
  assert.strictEqual(q.get('orderBy'), 'startTime');
  assert.ok(urls[0].includes('/calendars/primary/events'));
});
