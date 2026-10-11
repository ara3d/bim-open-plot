// Writes data/readings.json from the Duplex extracts and the rule in rule.ts.
// Run from the repository root:
//   npx vite-node packages/demos/demos/room-temperature/generate.ts

import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDataPath } from '../../src/demo';
import { MODEL_FILES, loadRoomModel } from './model';
import { syntheticReadings } from './rule';

const here = dirname(fileURLToPath(import.meta.url));
const paths = { dataRoot: here, siteRoot: resolve(here, '../../public') };

const { rooms } = await loadRoomModel({
  elements: resolveDataPath(MODEL_FILES.elements, paths),
  parameters: resolveDataPath(MODEL_FILES.parameters, paths),
  bounds: resolveDataPath(MODEL_FILES.bounds, paths),
});
const readings = syntheticReadings(rooms);
const out = resolve(here, 'data/readings.json');
await writeFile(out, `[\n${readings.map((r) => JSON.stringify(r)).join(',\n')}\n]\n`);
console.log(`${readings.length} readings for ${new Set(readings.map((r) => r.space)).size} rooms -> ${out}`);
