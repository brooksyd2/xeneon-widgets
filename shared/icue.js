(function (root) {
  function setting(name, fallback) {
    try { var v = root[name]; return (typeof v === 'string' && v.trim()) ? v.trim() : fallback; } catch (e) { return fallback; }
  }
  /* Runs fn once iCUE is ready (or at once outside iCUE), then again on every onDataUpdated. */
  function onReady(fn) {
    root.icueEvents = { onICUEInitialized: fn, onDataUpdated: function () { fn(); } };
    if (root.iCUE_initialized || !root.iCUE) fn();
  }
  var api = { setting: setting, onReady: onReady };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EdgeIcue = api;
})(this);
