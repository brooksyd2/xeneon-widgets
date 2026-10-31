(function (root) {
  var D = typeof require === 'function' ? require('../../shared/dates.js') : root.EdgeDates;
  var iso = D.iso, fmtDate = D.fmtDate, daysBetween = D.daysBetween;

  var TASK_RE = /^(\s*)[-*+] \[ \] (.+)$/;
  var DATE_FIELDS = { due: '\u{1F4C5}', scheduled: '⏳', start: '\u{1F6EB}' };
  var PRIO = { '\u{1F53A}': 'high', '⏫': 'high', '\u{1F53C}': 'med', '\u{1F53D}': 'low', '⏬': 'low' };
  var FIELD_STRIP = /(?:\u{1F4C5}|⏳|\u{1F6EB}|➕|✅|❌)️?\s*\d{4}-\d{2}-\d{2}/gu;
  var RECUR_STRIP = /\u{1F501}️?[^\u{1F4C5}⏳\u{1F6EB}➕✅❌\u{1F53A}⏫\u{1F53C}\u{1F53D}⏬]*/gu;
  var PRIO_STRIP = /[\u{1F53A}⏫\u{1F53C}\u{1F53D}⏬]️?/gu;

  function shortName(full) {
    var parts = full.trim().split(/\s+/);
    if (parts.length < 2) return full.trim();
    var last = parts.slice(1).join(' ');
    var initials = last.split('-').map(function (p) { return p.charAt(0).toUpperCase(); }).join('-');
    return parts[0] + ' ' + initials;
  }
  function noteLabel(path, today) {
    var segs = path.replace(/\.md$/i, '').split('/');
    var base = segs.pop();
    var folder = segs.length ? segs[segs.length - 1] : '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(base)) return (folder ? folder + ' · ' : '') + fmtDate(base, today);
    var m = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(base);
    var mi = m ? D.MONTHS.map(function (x) { return x.toLowerCase(); }).indexOf(m[2].slice(0, 3).toLowerCase()) : -1;
    if (mi !== -1) return (segs[0] ? segs[0] + ' · ' : '') + fmtDate(m[3] + '-' + D.pad(mi + 1) + '-' + D.pad(+m[1]), today);
    return base;
  }

  function parseTask(raw, path, line, people, today, peopleFolder) {
    var m = TASK_RE.exec(raw); if (!m) return null;
    var body = m[2];
    var t = { id: path + '#' + line, path: path, line: line, raw: raw, priority: 'none', due: null, scheduled: null, people: [], recurring: /\u{1F501}/u.test(body) };
    Object.keys(DATE_FIELDS).forEach(function (k) {
      var r = new RegExp(DATE_FIELDS[k] + '\\uFE0F?\\s*(\\d{4}-\\d{2}-\\d{2})', 'u').exec(body);
      if (r) t[k] = r[1];
    });
    for (var e in PRIO) if (body.indexOf(e) !== -1) { t.priority = PRIO[e]; break; }
    var text = body.replace(FIELD_STRIP, '').replace(RECUR_STRIP, '').replace(PRIO_STRIP, '');
    text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (all, target, alias) {
      var name = target.split('/').pop().replace(/\.md$/i, '');
      if (people[name.toLowerCase()] || target.indexOf(peopleFolder + '/') === 0) { t.people.push(shortName(alias || name)); return ''; }
      return alias || name;
    });
    text = text.replace(/(^|\s)@([A-Z][\w'-]*(?:\s[A-Z][\w'-]*)?)/g, function (all, sp, name) { t.people.push(shortName(name)); return sp; });
    text = text.replace(/\s#[\w/-]+/g, '').replace(/\s\^[\w-]+\s*$/, '')
      .replace(/\s+[-–—,]\s*(?=[-–—,]|$)/g, '').replace(/\s{2,}/g, ' ').trim()
      .replace(/[\s\-–—,]+$/, '');
    t.text = text;
    t.note = noteLabel(path, today);
    t.overdue = !!(t.due && t.due < iso(today));
    t.dueToday = t.due === iso(today);
    t.overdueDays = t.overdue ? daysBetween(t.due, iso(today)) : 0;
    return t;
  }

  function selectAndSort(tasks) {
    var rank = { high: 0, med: 1 };
    return tasks.filter(function (t) { return t.overdue || t.priority === 'high' || t.priority === 'med'; })
      .sort(function (a, b) {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        var ad = a.due || '9999', bd = b.due || '9999';
        if (ad !== bd) return ad < bd ? -1 : 1;
        var ar = rank[a.priority] != null ? rank[a.priority] : 2, br = rank[b.priority] != null ? rank[b.priority] : 2;
        if (ar !== br) return ar - br;
        return a.id < b.id ? -1 : 1;
      });
  }

  function flattenDataview(values) {
    var out = [];
    (function walk(list) { (list || []).forEach(function (v) { out.push({ text: v.text, line: v.line, path: v.path }); walk(v.children); }); })(values);
    return out;
  }

  function tasksFromDataview(values, people, today, peopleFolder) {
    var out = [];
    flattenDataview(values).forEach(function (v) {
      var t = parseTask('- [ ] ' + v.text, v.path, v.line, people, today, peopleFolder);
      if (t) { t.body = v.text; out.push(t); }
    });
    return selectAndSort(out);
  }

  var OPEN_RE = /^(\s*)[-*+] \[ \] (.*)$/;
  function findTaskLine(lines, line, text) {
    var want = text.trimEnd();
    function hit(i) { var m = OPEN_RE.exec(lines[i] || ''); return !!m && m[2].trimEnd() === want; }
    if (hit(line)) return line;
    var found = [];
    for (var i = 0; i < lines.length; i++) if (hit(i)) found.push(i);
    return found.length === 1 ? found[0] : -1;
  }

  function completeLine(line, isoDate) {
    var s = line.trimEnd().replace('[ ]', '[x]');
    var m = /^(.*?)( \^[\w-]+)?$/.exec(s);
    return m[1] + ' ✅ ' + isoDate + (m[2] || '');
  }

  var api = { shortName: shortName, noteLabel: noteLabel, parseTask: parseTask, selectAndSort: selectAndSort,
    flattenDataview: flattenDataview, tasksFromDataview: tasksFromDataview, findTaskLine: findTaskLine, completeLine: completeLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ObsidianLib = api;
})(this);
