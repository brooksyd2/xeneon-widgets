const test = require('node:test');
const assert = require('node:assert/strict');
const { ageText, stepTarget, heatingStatus, settle, connState, onFor } = require('../../widgets/home/lib.js');

test('ageText', () => {
  assert.equal(ageText(4), 'updated 4s ago');
  assert.equal(ageText(1620), 'updated 27m ago');
  assert.equal(ageText(3600), 'updated over 1h ago');
});
const r = { room: 19.2, min: 10, max: 32 };
test('stepTarget snaps an odd target first', () => {
  assert.equal(stepTarget(17.9, 1, r), 18);
  assert.equal(stepTarget(17.9, -1, r), 17.5);
  assert.equal(stepTarget(18, 1, r), 18.5);
});
test('stepTarget clamps', () => {
  assert.equal(stepTarget(32, 1, r), 32);
  assert.equal(stepTarget(10, -1, r), 10);
});
test('stepTarget from null starts at the room rounded', () => {
  assert.equal(stepTarget(null, 1, r), 19.5);
});
test('heatingStatus', () => {
  assert.deepEqual(heatingStatus({ mode: 'off', room: 19.2, target: 21, action: 'idle' }), { badge: 'Off', line: 'Off' });
  assert.deepEqual(heatingStatus({ mode: 'heat', room: 19.2, target: 21, action: 'heating' }), { badge: 'Heating', line: 'Heating to 21.0°' });
  assert.deepEqual(heatingStatus({ mode: 'heat', room: 19.2, target: 21, action: 'idle' }), { badge: 'Idle', line: 'Idle · set to 21.0°' });
  assert.deepEqual(heatingStatus({ mode: 'heat', room: 19.2, target: 18, action: 'idle' }), { badge: 'Idle', line: 'Idle · target below room' });
});
test('settle', () => {
  assert.equal(settle({ want: true, at: 0 }, true, 5), 'done');
  assert.equal(settle({ want: true, at: 0 }, false, 9999), 'pending');
  assert.equal(settle({ want: true, at: 0 }, false, 10000), 'failed');
});
test('connState', () => {
  assert.equal(connState(null), 'ok');
  assert.equal(connState({ status: 401 }), 'setup');
  assert.equal(connState({ status: 502, error: 'home_assistant' }), 'ha');
  assert.equal(connState({ status: 503, error: 'ha_not_configured' }), 'ha');
  assert.equal(connState(new TypeError('Failed to fetch')), 'companion');
});
test('onFor', () => {
  assert.equal(onFor('2026-10-31T14:20:00Z', Date.parse('2026-10-31T14:32:30Z')), 12);
});
