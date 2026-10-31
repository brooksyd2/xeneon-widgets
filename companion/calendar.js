const { gcall } = require('./google-api');

const pad = (n) => String(n).padStart(2, '0');

function localIso(d) {
  const off = -d.getTimezoneOffset(), a = Math.abs(off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${off < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

// Local day boundaries in the host timezone; Date handles the 23/25-hour days.
function dayRange(nowMs, offsetDays = 0) {
  const n = new Date(nowMs);
  return {
    timeMin: localIso(new Date(n.getFullYear(), n.getMonth(), n.getDate() + offsetDays)),
    timeMax: localIso(new Date(n.getFullYear(), n.getMonth(), n.getDate() + offsetDays + 1)),
  };
}

const when = (t) => {
  if (t.dateTime) return t.dateTime;
  const [y, m, d] = t.date.split('-').map(Number);
  return localIso(new Date(y, m - 1, d));
};

function meetUrl(e) {
  if (e.hangoutLink) return e.hangoutLink;
  const p = ((e.conferenceData || {}).entryPoints || []).find((x) => x.entryPointType === 'video' && String(x.uri).startsWith('https://meet.google.com/'));
  return p ? p.uri : undefined;
}

function toEvent(e) {
  const out = {
    id: e.id,
    title: e.summary || '(no title)',
    start: when(e.start),
    end: when(e.end),
    allDay: !e.start.dateTime,
    guests: (e.attendees || []).filter((a) => !a.self && !a.resource).length,
  };
  const url = meetUrl(e);
  if (url) out.meetUrl = url;
  if (e.location) out.location = e.location;
  return out;
}

function keepEvent(e) {
  if (e.status === 'cancelled') return false;
  if (e.eventType && e.eventType !== 'default') return false;
  return !(e.attendees || []).some((a) => a.self && a.responseStatus === 'declined');
}

async function listEvents({ token, fetch, range }) {
  const events = [];
  let pageToken;
  do {
    const q = new URLSearchParams({ timeMin: range.timeMin, timeMax: range.timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
    if (pageToken) q.set('pageToken', pageToken);
    const j = await gcall(fetch, token, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`);
    events.push(...(j.items || []));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return events.filter(keepEvent).map(toEvent);
}

module.exports = { dayRange, toEvent, keepEvent, listEvents };
