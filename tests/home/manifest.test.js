const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', '..', 'widgets', 'home');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

test('manifest identifies the widget and needs no plugins', () => {
  assert.equal(manifest.id, 'com.damianbrooks.edge.home');
  assert.equal(manifest.name, 'Home');
  assert.equal(manifest.interactive, true);
  assert.equal('required_plugins' in manifest, false);
});
test('manifest permits only the companion on localhost and 127.0.0.1', () => {
  assert.deepEqual(
    manifest.permissions.map(p => [p.type, p.domain, p.port]).sort(),
    [['url', '127.0.0.1', 8817], ['url', 'localhost', 8817]]
  );
});
test('nothing loads from the internet and the title is quoted', () => {
  assert.ok(!html.includes('googleapis'));
  assert.ok(!html.includes('gstatic'));
  assert.ok(html.includes("<title>'Home'</title>"));
});
test('boot does not wait for onICUEInitialized', () => {
  assert.ok(!html.includes('if (window.iCUE_initialized || !window.iCUE) start()'));
  assert.ok(html.includes('onICUEInitialized = start'));
  assert.match(html, /^\s*start\(\);/m);
});
test('the companion token setting exists', () => {
  assert.ok(html.includes('content="companionToken"'));
});
test('no templated src/href in markup (icuewidget validate treats them as local assets)', () => {
  assert.ok(!/(src|href)="\$\{/.test(html));
});
