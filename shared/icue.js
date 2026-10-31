(function (root) {
  function setting(name, fallback) {
    try { var v = root[name]; return (typeof v === 'string' && v.trim()) ? v.trim() : fallback; } catch (e) { return fallback; }
  }
  /* Runs fn at once, then again on each iCUE event. iCUE does not always send onICUEInitialized
     (seen on the Xeneon Edge), so never wait for it; Corsair's own widgets start immediately too. */
  function onReady(fn) {
    root.icueEvents = { onICUEInitialized: function () { fn(); }, onDataUpdated: function () { fn(); } };
    fn();
  }
  var api = { setting: setting, onReady: onReady };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EdgeIcue = api;
})(this);
