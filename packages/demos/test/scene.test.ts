// The model side of the 3D helper runs in Node: duplex.bos loads, its
// objects carry STEP ids that match the extracts, and counts come out.

import { expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countsByCategory, keysByStepId, loadModelHeadless } from '../src/scene';
import { loadTable } from '../src/data';

const here = dirname(fileURLToPath(import.meta.url));
const models = resolve(here, '../public/models');
const data = resolve(here, '../public/data/duplex');

it('duplex.bos loads headlessly and its objects match the extracts by STEP id', async () => {
  const loaded = await loadModelHeadless(`${models}/duplex-federated.bos`);
  const counts = countsByCategory(loaded);
  expect(loaded.data.objects.length).toBeGreaterThan(200);
  const keys = keysByStepId(loaded);
  const elements = await loadTable(`${data}/elements.json`);
  const doors = elements.filter((e) => e.Category === 'IFCDOOR');
  const matched = doors.filter((d) => keys.has(Number(d.StepId)));
  expect(matched.length, `doors matched by STEP id; categories seen: ${[...counts.keys()].slice(0, 8).join(', ')}`).toBe(doors.length);
});
