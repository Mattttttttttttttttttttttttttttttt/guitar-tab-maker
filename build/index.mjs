import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('../tabs/', import.meta.url));
const files = (await readdir(dir)).filter(f => f.endsWith('.json') && f !== 'index.json');

const entries = [];
for (const file of files) {
  const tab = JSON.parse(await readFile(join(dir, file), 'utf8'));
  entries.push({ id: file.slice(0, -'.json'.length), title: tab.title || '', artist: tab.artist || '' });
}
entries.sort((a, b) => a.title.localeCompare(b.title));

await writeFile(join(dir, 'index.json'), `${JSON.stringify(entries, null, 2)}\n`);
console.log(`tabs/index.json: ${entries.length} tab(s)`);
