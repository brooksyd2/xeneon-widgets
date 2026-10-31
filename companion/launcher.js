const { spawn: realSpawn } = require('node:child_process');

function isAllowedUrl(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.username || u.password || u.port || /[\s"]/.test(u.href)) return false;
  return (u.protocol === 'https:' && u.hostname === 'meet.google.com') ||
    (u.protocol === 'granola:' && u.hostname === 'new-document');
}

// Windows only: rundll32 hands the URL to the default handler; args are an array, never a shell string.
function openUrl(url, { spawn = realSpawn } = {}) {
  if (!isAllowedUrl(url)) throw new Error('URL not allowed');
  // href is the WHATWG-normalised form: space, quote, <, > in the path are percent-encoded.
  const child = spawn('rundll32', ['url.dll,FileProtocolHandler', new URL(url).href], { detached: true, stdio: 'ignore' });
  child.on('error', (e) => console.error(`Open failed: ${e.message}`)); // e.g. ENOENT arrives async and would crash the process
  child.unref();
}

const granolaUrl = (eventId) => `granola://new-document?event=${encodeURIComponent(eventId)}&creation_source=xeneon-gmail`;

module.exports = { isAllowedUrl, openUrl, granolaUrl };
