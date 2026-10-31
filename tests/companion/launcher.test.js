const test = require('node:test');
const assert = require('node:assert');
const { isAllowedUrl, openUrl, granolaUrl } = require('../../companion/launcher');

test('isAllowedUrl accepts Meet and Granola new-document only', () => {
  for (const u of ['https://meet.google.com/abc-defg-hij', 'granola://new-document?event=x']) assert.strictEqual(isAllowedUrl(u), true, u);
  for (const u of ['http://meet.google.com/x', 'https://meet.google.com.evil.com/x', 'https://evil.com/?meet.google.com', 'file:///c:/x', 'granola://other', 'nonsense', 'https://evil.com@meet.google.com/x', 'https://meet.google.com:8443/', 'granola://user@new-document/', 'https://user:pw@meet.google.com/']) assert.strictEqual(isAllowedUrl(u), false, u);
});

test('openUrl passes the URL as one argument; refuses disallowed URLs', () => {
  const calls = [];
  const spawn = (...a) => { calls.push(a); return { on() {}, unref() {} }; };
  openUrl('https://meet.google.com/abc-defg-hij', { spawn });
  assert.deepStrictEqual(calls[0][1], ['url.dll,FileProtocolHandler', 'https://meet.google.com/abc-defg-hij']);
  openUrl('https://meet.google.com/x" -arg', { spawn });
  openUrl('https://meet.google.com/a b"&calc', { spawn });
  assert.deepStrictEqual(calls[1][1][1], 'https://meet.google.com/x%22%20-arg');
  assert.deepStrictEqual(calls[2][1][1], 'https://meet.google.com/a%20b%22&calc');
  openUrl('https://meet.google.com/x\r\ny', { spawn });
  assert.strictEqual(calls[3][1][1], 'https://meet.google.com/xy'); // URL parser strips CR/LF
  assert.throws(() => openUrl('https://evil.com/', { spawn }));
  assert.strictEqual(calls.length, 4);
});

test('granolaUrl encodes the event id', () => {
  assert.strictEqual(granolaUrl('a&b'), 'granola://new-document?event=a%26b&creation_source=xeneon-gmail');
  assert.strictEqual(isAllowedUrl(granolaUrl('a&b')), true);
});

test('openUrl logs a child spawn error instead of crashing', () => {
  const { EventEmitter } = require('node:events');
  const child = Object.assign(new EventEmitter(), { unref() {} });
  const err = console.error; const logged = []; console.error = (m) => logged.push(m);
  try { openUrl('https://meet.google.com/a', { spawn: () => child }); child.emit('error', new Error('ENOENT')); } finally { console.error = err; }
  assert.deepStrictEqual(logged, ['Open failed: ENOENT']);
});
