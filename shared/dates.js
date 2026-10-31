(function (root) {
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseIso(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function fmtDate(s, today) {
    var d = parseIso(s); if (!d) return s;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== today.getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function daysBetween(a, b) { return Math.round((parseIso(b) - parseIso(a)) / 86400000); }
  function hhmm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  var api = { MONTHS: MONTHS, pad: pad, iso: iso, parseIso: parseIso, fmtDate: fmtDate, daysBetween: daysBetween, hhmm: hhmm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EdgeDates = api;
})(this);
