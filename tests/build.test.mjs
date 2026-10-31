import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'xw-'));
  const w = join(root, 'widgets', 'demo');
  mkdirSync(join(w, 'designs'), { recursive: true });
  mkdirSync(join(root, 'shared'));
  writeFileSync(join(w, 'manifest.json'), '{}');
  writeFileSync(join(w, 'index.html'), '<html/>');
  writeFileSync(join(w, 'designs', 'x.png'), 'x');
  writeFileSync(join(root, 'shared', 'a.js'), '//');
  return { root, out: join(root, 'out') };
}

test('build copies widget and shared', () => {
  const { root, out } = fixture();
  build('demo', { root, out });
  assert.ok(existsSync(join(out, 'demo', 'index.html')));
  assert.ok(existsSync(join(out, 'demo', 'shared', 'a.js')));
  assert.ok(!existsSync(join(out, 'demo', 'designs')));
});

test('build replaces stale output', () => {
  const { root, out } = fixture();
  mkdirSync(join(out, 'demo'), { recursive: true });
  writeFileSync(join(out, 'demo', 'old.txt'), 'old');
  build('demo', { root, out });
  assert.ok(!existsSync(join(out, 'demo', 'old.txt')));
});

test('build rejects a folder without manifest', () => {
  const { root, out } = fixture();
  assert.throws(() => build('nope', { root, out }));
});
