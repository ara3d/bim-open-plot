// Writes demos/index.json from every demos/<slug>/demo.json, for the index
// page, with `thumb` when public/thumbs/<slug>.png exists (`npm run demos:thumbs`).
// Run by the supervisor after demos land: `npm run demos:index`.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demosDir = resolve(root, 'demos');
const entries = readdirSync(demosDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(resolve(demosDir, d.name, 'demo.json')))
  .map((d) => {
    const entry = JSON.parse(readFileSync(resolve(demosDir, d.name, 'demo.json'), 'utf8'));
    // Site-relative, no leading slash, so it resolves under the Pages base path.
    const thumb = `thumbs/${d.name}.png`;
    return existsSync(resolve(root, 'public', thumb)) ? { ...entry, thumb } : entry;
  })
  .sort((a, b) => a.title.localeCompare(b.title));
writeFileSync(resolve(root, 'public/index.json'), JSON.stringify(entries, null, 2) + '\n');
console.log(`${entries.length} demos indexed`);
