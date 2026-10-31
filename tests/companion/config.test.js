const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('../../companion/config');

test('loadConfig creates a token once and preserves existing fields', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-'));
  const first = loadConfig(dir);
  assert.match(first.token, /^[0-9a-f]{64}$/);
  assert.strictEqual(loadConfig(dir).token, first.token);
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file)), clientId: 'abc' }));
  const again = loadConfig(dir);
  assert.strictEqual(again.clientId, 'abc');
  assert.strictEqual(again.token, first.token);
});

test('loadConfig returns haUrl and haToken', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-'));
  assert.deepStrictEqual([loadConfig(dir).haUrl, loadConfig(dir).haToken], ['', '']);
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file)), haUrl: 'http://ha:8123', haToken: 'x' }));
  const c = loadConfig(dir);
  assert.deepStrictEqual([c.haUrl, c.haToken], ['http://ha:8123', 'x']);
});
