const { spawn } = require('node:child_process');

// The script reads the secret from stdin as UTF-8; it is never part of the script text.
const READ = '$in = [IO.StreamReader]::new([Console]::OpenStandardInput(), [Text.UTF8Encoding]::new($false)).ReadToEnd();';
const WRITE = '$o = [Console]::OpenStandardOutput(); $o.Write($r, 0, $r.Length); $o.Flush()';
const PROTECT = `Add-Type -AssemblyName System.Security; ${READ}
$b = [Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($in), $null, 'CurrentUser');
$r = [Text.Encoding]::ASCII.GetBytes([Convert]::ToBase64String($b)); ${WRITE}`;
const UNPROTECT = `Add-Type -AssemblyName System.Security; ${READ}
$b = [Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($in.Trim()), $null, 'CurrentUser');
$r = $b; ${WRITE}`;

// `-Command -` would read the script from stdin, leaving no channel for the data, so the script
// is passed as -EncodedCommand (script text only) and stdin carries the secret.
function defaultRun(script, stdin) {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    ps.stdout.setEncoding('utf8'); ps.stdout.on('data', (d) => { out += d; });
    ps.stderr.on('data', (d) => { err += d; });
    ps.on('error', reject);
    ps.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`DPAPI failed (${code}): ${err.trim().split('\n')[0]}`))));
    ps.stdin.end(stdin, 'utf8');
  });
}

const protect = async (text, { run = defaultRun } = {}) => (await run(PROTECT, text)).trim();
const unprotect = async (b64, { run = defaultRun } = {}) => (await run(UNPROTECT, b64)).replace(/\r?\n$/, '');

module.exports = { protect, unprotect };
