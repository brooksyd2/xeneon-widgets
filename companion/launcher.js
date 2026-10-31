const { spawn: realSpawn } = require('node:child_process');

function isAllowedUrl(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  return (u.protocol === 'https:' && u.hostname === 'meet.google.com') ||
    (u.protocol === 'granola:' && u.hostname === 'new-document');
}

// Windows only: rundll32 hands the URL to the default handler; args are an array, never a shell string.
function openUrl(url, { spawn = realSpawn } = {}) {
  if (!isAllowedUrl(url)) throw new Error('URL not allowed');
  spawn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' }).unref();
}

const granolaUrl = (eventId) => `granola://new-document?event=${encodeURIComponent(eventId)}&creation_source=xeneon-gmail`;

module.exports = { isAllowedUrl, openUrl, granolaUrl };
