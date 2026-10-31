(function (root) {
  function ageText(sec) {
    if (sec < 60) return 'updated ' + sec + 's ago';
    if (sec < 3600) return 'updated ' + Math.round(sec / 60) + 'm ago';
    return 'updated over 1h ago';
  }

  function stepTarget(target, dir, o) {
    var start = target != null ? target : Math.round(o.room * 2) / 2;
    var h = start * 2, v;
    if (Math.abs(h - Math.round(h)) > 1e-9) v = (dir > 0 ? Math.ceil(h) : Math.floor(h)) / 2;
    else v = start + 0.5 * dir;
    v = Math.min(o.max, Math.max(o.min, v));
    return Math.round(v * 10) / 10;
  }

  function heatingStatus(s) {
    if (s.mode === 'off') return { badge: 'Off', line: 'Off' };
    if (s.action === 'heating') return { badge: 'Heating', line: 'Heating to ' + s.target.toFixed(1) + '°' };
    if (s.target > s.room) return { badge: 'Idle', line: 'Idle · set to ' + s.target.toFixed(1) + '°' };
    return { badge: 'Idle', line: 'Idle · target below room' };
  }

  function settle(p, actualOn, now) {
    if (actualOn === p.want) return 'done';
    return now - p.at >= 10000 ? 'failed' : 'pending';
  }

  function connState(err) {
    if (!err) return 'ok';
    if (err.status === 401) return 'setup';
    if (['home_assistant', 'ha_unauthorised', 'ha_not_configured'].indexOf(err.error) !== -1) return 'ha';
    return 'companion';
  }

  function onFor(since, now) {
    return Math.floor((now - Date.parse(since)) / 60000);
  }

  var api = { ageText: ageText, stepTarget: stepTarget, heatingStatus: heatingStatus, settle: settle, connState: connState, onFor: onFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HomeLib = api;
})(typeof self !== 'undefined' ? self : this);
