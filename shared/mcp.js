(function (root) {
  function err(kind, msg) { var e = new Error(msg); e.kind = kind; return e; }

  function parseSse(body) {
    var lines = String(body || '').split(/\r?\n/), last = null;
    for (var i = 0; i < lines.length; i++) if (lines[i].indexOf('data:') === 0) last = lines[i].slice(5).trim();
    return JSON.parse(last !== null ? last : body);
  }

  function createMcp(o) {
    var sid = null, nextId = 1;

    async function post(payload) {
      var ctl = new AbortController();
      var timer = setTimeout(function () { ctl.abort(); }, o.timeoutMs);
      var headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer ' + o.key };
      if (sid) headers['mcp-session-id'] = sid;
      try {
        var r = await o.fetch(o.url, { method: 'POST', headers: headers, body: JSON.stringify(payload), signal: ctl.signal });
        return { status: r.status, headers: r.headers, body: await r.text() };
      } catch (e) {
        throw err('offline', e && e.message || 'offline');
      } finally { clearTimeout(timer); }
    }

    function check(r) {
      if (r.status === 401 || r.status === 403) throw err('auth', 'HTTP ' + r.status);
      if (r.status < 200 || r.status >= 300) throw err('http', 'HTTP ' + r.status);
    }

    async function init() {
      sid = null;
      var r = await post({ jsonrpc: '2.0', id: nextId++, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'xeneon-widget', version: '1' } } });
      check(r);
      sid = r.headers.get('mcp-session-id');
      check(await post({ jsonrpc: '2.0', method: 'notifications/initialized' }));
    }

    async function send(tool, args, retried) {
      if (!sid) await init();
      var r = await post({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: tool, arguments: args || {} } });
      if (r.status === 404 || (r.status === 400 && /session/i.test(r.body))) {
        sid = null;
        if (retried) throw err('http', 'HTTP ' + r.status);
        return send(tool, args, true);
      }
      check(r);
      var msg = parseSse(r.body);
      if (msg.error) throw err('tool', msg.error.message || 'tool error');
      var text = msg.result && msg.result.content && msg.result.content[0] ? msg.result.content[0].text : '';
      if (msg.result && msg.result.isError) throw err('tool', text || 'tool error');
      var val;
      try { val = JSON.parse(text); } catch (e) { return text; }
      if (val && typeof val === 'object' && val.error) throw err('tool', val.error.message || String(val.error));
      return val;
    }

    return { call: function (tool, args) { return send(tool, args, false); } };
  }

  var api = { createMcp: createMcp, parseSse: parseSse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ObsidianMcp = api;
})(this);
