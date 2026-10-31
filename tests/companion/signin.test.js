const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { signin } = require('../../companion/google-auth');

const secret = { protect: async (t) => 'P:' + t, unprotect: async (t) => t.slice(2) };
const reply = (json) => ({ ok: true, status: 200, json: async () => json });
const fakeGoogle = async (url) => url.includes('token')
  ? reply({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 })
  : reply({ emailAddress: 'me@x.y' });

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'signin-'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ token: 't', clientId: 'cid', clientSecret: 'csec' }));
  return dir;
}

test('signin stores the protected refresh token after a valid callback', async () => {
  const dir = setup();
  const email = await signin({
    dir, fetch: fakeGoogle, secret, log: () => {},
    openBrowser: async (url) => {
      const u = new URL(url);
      const cb = new URL(u.searchParams.get('redirect_uri'));
      cb.searchParams.set('code', 'c');
      cb.searchParams.set('state', u.searchParams.get('state'));
      await (await globalThis.fetch(cb)).text();
    },
  });
  assert.strictEqual(email, 'me@x.y');
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'accounts.json'), 'utf8'));
  assert.deepStrictEqual(saved, { default: { email: 'me@x.y', refreshToken: 'P:rt' } });
});

test('signin rejects a wrong state and stores nothing', async () => {
  const dir = setup();
  await assert.rejects(signin({
    dir, fetch: fakeGoogle, secret, log: () => {},
    openBrowser: async (url) => {
      const cb = new URL(new URL(url).searchParams.get('redirect_uri'));
      cb.searchParams.set('code', 'c');
      cb.searchParams.set('state', 'wrong');
      await (await globalThis.fetch(cb)).text();
    },
  }), /state/);
  assert.ok(!fs.existsSync(path.join(dir, 'accounts.json')));
});
