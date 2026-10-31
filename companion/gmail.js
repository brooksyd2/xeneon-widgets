const { gcall } = require('./google-api');

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const BODY_CAP = 20000;
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', ndash: '–', mdash: '—', pound: '£', euro: '€', copy: '©' };

function decodeEntities(s) {
  return s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, d, h, n) => {
    if (n) return NAMED[n.toLowerCase()] ?? m;
    try { return String.fromCodePoint(d ? +d : parseInt(h, 16)); } catch { return m; }
  });
}

function htmlToText(html) {
  return decodeEntities(html
    .replace(/<head[\s\S]*?<\/head>|<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '')
    .replace(/<a\b[^>]*?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, inner) => {
      const y = inner.replace(/<[^>]+>/g, '').trim();
      return decodeEntities(y) === decodeEntities(href) ? y : `${y} (${href})`;
    })
    .replace(/<br\s*\/?>|<\/(?:p|div|tr|li)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseFrom(h = '') {
  const m = h.match(/^\s*(?:"?(.*?)"?\s*)?<([^>]+)>\s*$/);
  if (!m) return { name: '', email: h.trim() };
  return { name: (m[1] || '').replace(/\\"/g, '"').trim(), email: m[2].trim() };
}

const header = (p, n) => ((p.headers || []).find((h) => h.name.toLowerCase() === n) || {}).value || '';

function toMessage(m) {
  return {
    id: m.id,
    threadId: m.threadId,
    from: parseFrom(header(m.payload, 'from')),
    subject: header(m.payload, 'subject'),
    snippet: decodeEntities(m.snippet || ''),
    date: new Date(Number(m.internalDate)).toISOString(),
    unread: (m.labelIds || []).includes('UNREAD'),
  };
}

async function listInbox({ token, fetch, max = 25 }) {
  const q = new URLSearchParams({ q: 'in:inbox category:primary', maxResults: String(max) });
  const list = await gcall(fetch, token, `${API}/messages?${q}`);
  const msgs = await Promise.all((list.messages || []).map((x) => {
    const p = new URLSearchParams({ format: 'metadata' });
    for (const h of ['From', 'Subject', 'Date']) p.append('metadataHeaders', h);
    return gcall(fetch, token, `${API}/messages/${encodeURIComponent(x.id)}?${p}`);
  }));
  return msgs.map(toMessage);
}

function decodePart(part) {
  const bytes = Buffer.from(part.body.data, 'base64url');
  const cs = ((header(part, 'content-type').match(/charset="?([^";\s]+)/i)) || [])[1];
  try { return new TextDecoder(cs || 'utf-8').decode(bytes); } catch { return new TextDecoder('utf-8').decode(bytes); }
}

function findPart(part, type) {
  if (part.mimeType === type && part.body && part.body.data) return part;
  for (const c of part.parts || []) { const f = findPart(c, type); if (f) return f; }
  return null;
}

async function getBody({ token, fetch, id }) {
  const m = await gcall(fetch, token, `${API}/messages/${encodeURIComponent(id)}?format=full`);
  const plain = findPart(m.payload, 'text/plain'), html = plain ? null : findPart(m.payload, 'text/html');
  const text = plain ? decodePart(plain) : html ? htmlToText(decodePart(html)) : '';
  return text.length > BODY_CAP ? text.slice(0, BODY_CAP) + '…' : text;
}

async function modifyThread({ token, fetch, messageId, removeLabelIds }) {
  const m = await gcall(fetch, token, `${API}/messages/${encodeURIComponent(messageId)}?format=minimal`);
  await gcall(fetch, token, `${API}/threads/${encodeURIComponent(m.threadId)}/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeLabelIds }),
  });
}

module.exports = { listInbox, toMessage, parseFrom, getBody, htmlToText, modifyThread };
