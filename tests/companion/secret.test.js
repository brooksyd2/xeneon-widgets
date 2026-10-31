const test = require('node:test');
const assert = require('node:assert');
const { protect, unprotect } = require('../../companion/secret');

test('protect and unprotect pass the secret on stdin, never in the script', async () => {
  const calls = [];
  const run = async (script, stdin) => {
    calls.push({ script, stdin });
    return script.includes('::Protect') ? 'QUJD\r\n' : 'hello\r\n';
  };
  assert.strictEqual(await protect('hello', { run }), 'QUJD');
  assert.strictEqual(await unprotect('QUJD', { run }), 'hello');
  assert.match(calls[0].script, /ProtectedData\]::Protect/);
  assert.match(calls[1].script, /ProtectedData\]::Unprotect/);
  assert.match(calls[0].script, /CurrentUser/);
  assert.strictEqual(calls[0].stdin, 'hello');
  assert.strictEqual(calls[1].stdin, 'QUJD');
  for (const c of calls) assert.ok(!c.script.includes(c.stdin));
});
