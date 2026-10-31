const { HttpError } = require('./server');
const { dayRange, listEvents, toEvent } = require('./calendar');
const { gcall } = require('./google-api');
const realLauncher = require('./launcher');
const { listInbox, getBody, modifyThread } = require('./gmail');

function makeRoutes({ auth, fetch, now = Date.now, launcher = realLauncher }) {
  // Run fn(token); on a Google 401 refresh once, and treat a second 401 as signed out.
  async function withToken(fn) {
    try { return await fn(await auth.getAccessToken()); } catch (e) {
      if (e.kind !== 'google_401') throw e;
    }
    auth.invalidate();
    try { return await fn(await auth.getAccessToken()); } catch (e) {
      throw e.kind === 'google_401' ? new HttpError(503, 'signed_out') : e;
    }
  }

  const id = (params) => {
    if (!params.id) throw new HttpError(400, 'bad_request');
    return params.id;
  };
  const modify = (label) => async (req, { params }) => {
    const messageId = id(params);
    await withToken((token) => modifyThread({ token, fetch, messageId, removeLabelIds: [label] }));
    return { json: { ok: true } };
  };

  return [
    {
      method: 'GET', path: '/state', handler: async () => {
        const t = now();
        const [events, tomorrow, messages] = await withToken((token) => Promise.all([
          listEvents({ token, fetch, range: dayRange(t, 0) }),
          listEvents({ token, fetch, range: dayRange(t, 1) }),
          listInbox({ token, fetch }),
        ]));
        return { json: { account: auth.email(), events, tomorrowFirst: tomorrow.find((e) => !e.allDay) || null, messages } };
      },
    },
    {
      method: 'GET', path: '/messages/:id', handler: async (req, { params }) => {
        const mid = id(params);
        return { json: { body: await withToken((token) => getBody({ token, fetch, id: mid })) } };
      },
    },
    {
      method: 'POST', path: '/events/:id/join', handler: async (req, { params }) => {
        const eid = id(params);
        const event = toEvent(await withToken((token) => gcall(fetch, token, `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eid)}`)));
        if (!event.meetUrl || !realLauncher.isAllowedUrl(event.meetUrl) || Date.parse(event.end) <= now()) throw new HttpError(400, 'bad_request');
        launcher.openUrl(event.meetUrl);
        try { launcher.openUrl(launcher.granolaUrl(eid)); } catch (e) { console.error(`Granola open failed: ${e.message}`); }
        return { json: { ok: true } };
      },
    },
    { method: 'POST', path: '/messages/:id/archive', handler: modify('INBOX') },
    { method: 'POST', path: '/messages/:id/read', handler: modify('UNREAD') },
  ];
}

module.exports = { makeRoutes };
