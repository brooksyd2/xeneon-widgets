const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function dataDir() {
  if (process.env.XENEON_COMPANION_DIR) return process.env.XENEON_COMPANION_DIR;
  const base = process.env.APPDATA || path.join(require('node:os').homedir(), '.config');
  return path.join(base, 'xeneon-companion');
}

function loadConfig(dir = dataDir()) {
  const file = path.join(dir, 'config.json');
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const token = saved.token || crypto.randomBytes(32).toString('hex');
  const config = { clientId: '', clientSecret: '', haUrl: '', haToken: '', ...saved, token };
  if (!saved.token) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(config, null, 2));
  }
  return { dir, token, clientId: config.clientId, clientSecret: config.clientSecret, haUrl: config.haUrl, haToken: config.haToken };
}

module.exports = { loadConfig, dataDir };
