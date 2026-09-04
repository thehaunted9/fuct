import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = await collect(path.join(root, 'js'));

for (const file of files.filter(file => file.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

console.log(`Syntax checked ${files.length} JavaScript modules.`);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const item = path.join(directory, entry.name);
    return entry.isDirectory() ? collect(item) : [item];
  }));
  return nested.flat();
}
