import { cpSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function build(name, { root = here, out = join(root, 'dist') } = {}) {
  const src = join(root, 'widgets', name);
  if (!existsSync(join(src, 'manifest.json'))) throw new Error(`widgets/${name}/manifest.json not found`);
  const dest = join(out, name);
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true, filter: (p) => p !== join(src, 'designs') });
  cpSync(join(root, 'shared'), join(dest, 'shared'), { recursive: true });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: build.mjs <name>|--all'); process.exit(1); }
  try {
    const names = arg === '--all' ? readdirSync(join(here, 'widgets')) : [arg];
    for (const n of names) { build(n); console.log('built dist/' + n); }
  } catch (e) { console.error(e.message); process.exit(1); }
}
