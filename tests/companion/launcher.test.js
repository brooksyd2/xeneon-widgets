const test = require('node:test');
const assert = require('node:assert');
const { isAllowedUrl, openUrl, granolaUrl } = require('../../companion/launcher');

test('isAllowedUrl accepts Meet and Granola new-document only', () => {
  for (const u of ['https://meet.google.com/abc-defg-hij', 'granola://new-document?event=x']) assert.strictEqual(isAllowedUrl(u), true, u);
  for (const u of ['http://meet.google.com/x', 'https://meet.google.com.evil.com/x', 'https://evil.com/?meet.google.com', 'file:///c:/x', 'granola://other', 'nonsense']) assert.strictEqual(isAllowedUrl(u), false, u);
});

test('openUrl passes the URL as one argument; refuses disallowed URLs', () => {
  const calls = [];
  const spawn = (...a) => { calls.push(a); return { unref() {} }; };
  openUrl('https://meet.google.com/a b', { spawn });
  assert.deepStrictEqual(calls[0][1], ['url.dll,FileProtocolHandler', 'https://meet.google.com/a b']);
  assert.throws(() => openUrl('https://evil.com/', { spawn }));
  assert.strictEqual(calls.length, 1);
});

test('granolaUrl encodes the event id', () => {
  assert.strictEqual(granolaUrl('a&b'), 'granola://new-document?event=a%26b&creation_source=xeneon-gmail');
  assert.strictEqual(isAllowedUrl(granolaUrl('a&b')), true);
});
