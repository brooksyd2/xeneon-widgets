const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', '..', 'widgets', 'gmail');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

test('manifest identifies the widget and needs no plugins', () => {
  assert.equal(manifest.id, 'com.damianbrooks.edge.gmail');
  assert.equal(manifest.interactive, true);
  assert.equal('required_plugins' in manifest, false);
});
test('manifest permits the companion on localhost and 127.0.0.1', () => {
  for (const domain of ['localhost', '127.0.0.1']) {
    assert.ok(manifest.permissions.some(p => p.type === 'url' && p.domain === domain && p.port === 8817), domain);
  }
});
test('boot does not wait for onICUEInitialized', () => {
  assert.ok(!html.includes('if (window.iCUE_initialized || !window.iCUE) start()'));
  assert.ok(html.includes('onICUEInitialized = start'));
});
