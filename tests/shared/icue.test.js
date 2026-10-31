const test = require('node:test');
const assert = require('node:assert/strict');

// icue.js attaches to the global it is loaded with; load it fresh against a fake window.
function load(win) {
  const src = require('fs').readFileSync(require.resolve('../../shared/icue.js'), 'utf8');
  new Function('module', src.replace(/\}\)\(this\);\s*$/, '})(arguments[1]);'))(undefined, win);
  return win.EdgeIcue;
}

test('onReady starts at once even when iCUE is present but has not signalled', () => {
  const win = { iCUE: {} };
  let calls = 0;
  load(win).onReady(() => calls++);
  assert.equal(calls, 1);
});

test('onReady re-runs on iCUE events', () => {
  const win = { iCUE: {} };
  let calls = 0;
  load(win).onReady(() => calls++);
  win.icueEvents.onICUEInitialized();
  win.icueEvents.onDataUpdated();
  assert.equal(calls, 3);
});
