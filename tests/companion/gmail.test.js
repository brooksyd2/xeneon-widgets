const test = require('node:test');
const assert = require('node:assert');
const { parseFrom, htmlToText, toMessage, getBody, listInbox, modifyThread } = require('../../companion/gmail');

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const reply = (json, status = 200) => ({ ok: status < 400, status, json: async () => json });

test('parseFrom handles quoted name with comma and bare address', () => {
  assert.deepStrictEqual(parseFrom('"Shah, Priya" <priya@x.com>'), { name: 'Shah, Priya', email: 'priya@x.com' });
  assert.deepStrictEqual(parseFrom('priya@x.com'), { name: '', email: 'priya@x.com' });
  assert.deepStrictEqual(parseFrom('Priya <priya@x.com>'), { name: 'Priya', email: 'priya@x.com' });
});

test('htmlToText handles table, link, entities and style', () => {
  const html = '<html><head><title>t</title></head><body><style>p{color:red}</style><table><tr><td>A</td><td>B &amp; C</td></tr><tr><td>It&#8217;s</td></tr></table>' +
    '<p>See <a href="https://x.com/a">the page</a> or <a href="https://y.com">https://y.com</a></p><p>one</p><p></p><p></p><p>two</p></body></html>';
  const t = htmlToText(html);
  assert.ok(!t.includes('color') && !t.includes('title'));
  assert.ok(t.includes('A B & C\nIt’s'));
  assert.ok(t.includes('the page (https://x.com/a) or https://y.com'));
  assert.ok(!/\n{3}/.test(t));
});

test('toMessage maps fields and decodes snippet entities', () => {
  const m = toMessage({ id: 'm1', threadId: 'T1', snippet: 'Tom &amp; Jerry&#39;s', internalDate: '1761900000000', labelIds: ['INBOX', 'UNREAD'],
    payload: { headers: [{ name: 'From', value: 'A <a@x.com>' }, { name: 'Subject', value: 'Hi' }] } });
  assert.deepStrictEqual(m, { id: 'm1', threadId: 'T1', from: { name: 'A', email: 'a@x.com' }, subject: 'Hi', snippet: "Tom & Jerry's", date: '2025-10-31T08:40:00.000Z', unread: true });
});

test('getBody picks nested text/plain and decodes ISO-8859-1', async () => {
  const payload = { mimeType: 'multipart/mixed', parts: [
    { mimeType: 'multipart/alternative', parts: [
      { mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset="ISO-8859-1"' }], body: { data: b64(Buffer.from([0x63, 0x61, 0x66, 0xe9])) } },
      { mimeType: 'text/html', body: { data: b64('<p>html</p>') } } ] },
    { mimeType: 'application/pdf', body: { attachmentId: 'a' } } ] };
  const fetch = async (u) => { assert.ok(u.includes('format=full')); return reply({ payload }); };
  assert.strictEqual(await getBody({ token: 't', fetch, id: 'm1' }), 'café');
});

test('getBody falls back to html and caps long bodies', async () => {
  const fetch = async () => reply({ payload: { mimeType: 'text/html', body: { data: b64('<p>' + 'x'.repeat(50000) + '</p>') } } });
  const t = await getBody({ token: 't', fetch, id: 'm1' });
  assert.strictEqual(t.length, 20001);
  assert.ok(t.endsWith('…'));
});

test('listInbox queries Primary then fetches metadata per message', async () => {
  const urls = [];
  const fetch = async (u) => {
    urls.push(u);
    if (u.includes('/messages?')) return reply({ messages: [{ id: 'a' }, { id: 'b' }] });
    return reply({ id: u.includes('/a?') ? 'a' : 'b', threadId: 'T', internalDate: '0', payload: { headers: [] } });
  };
  const out = await listInbox({ token: 't', fetch });
  assert.deepStrictEqual(out.map((m) => m.id), ['a', 'b']);
  const q = new URL(urls[0]).searchParams;
  assert.strictEqual(q.get('q'), 'in:inbox category:personal');
  assert.strictEqual(q.get('maxResults'), '25');
  assert.deepStrictEqual(new URL(urls[1]).searchParams.getAll('metadataHeaders'), ['From', 'Subject', 'Date']);
});

test('modifyThread looks up the thread then modifies it', async () => {
  const calls = [];
  const fetch = async (u, init = {}) => { calls.push([u, init.body]); return reply({ threadId: 'T1' }); };
  await modifyThread({ token: 't', fetch, messageId: 'm1', removeLabelIds: ['INBOX'] });
  assert.ok(calls[1][0].endsWith('/threads/T1/modify'));
  assert.strictEqual(calls[1][1], '{"removeLabelIds":["INBOX"]}');
});

test('listInbox drops a message that 404s between list and get', async () => {
  const fetch = async (u) => {
    if (u.includes('/messages?')) return reply({ messages: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
    if (u.includes('/b?')) return reply({}, 404);
    return reply({ id: u.includes('/a?') ? 'a' : 'c', threadId: 'T', internalDate: '0', payload: { headers: [] } });
  };
  assert.deepStrictEqual((await listInbox({ token: 't', fetch })).map((m) => m.id), ['a', 'c']);
});
