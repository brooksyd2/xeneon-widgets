const { loadConfig, dataDir } = require('./config');
const { signin, createAuth } = require('./google-auth');
const { makeRoutes } = require('./routes');
const { createServer, listen, PORT } = require('./server');

async function serve() {
  const config = loadConfig();
  const auth = createAuth({ dir: dataDir() });
  const server = createServer({ token: config.token, routes: makeRoutes({ auth, fetch, now: Date.now }) });
  await listen(server, PORT);
  console.log(`Companion token: ${config.token}`);
  console.log(`Listening on http://127.0.0.1:${PORT}`);
}

if (require.main === module) {
  const cmd = process.argv[2];
  if (!cmd) serve().catch((e) => { console.error(e.message); process.exit(1); });
  else if (cmd === 'signin') signin({ dir: dataDir() }).catch((e) => { console.error(e.message); process.exit(1); });
  else { console.error(`Unknown command: ${cmd}`); process.exit(1); }
}
