// The model side of the 3D helper runs in Node: duplex.bos loads, its
// objects carry STEP ids that match the extracts, and counts come out.

import { expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countsByCategory, keysByStepId, loadModelHeadless } from '../src/scene';
import { objectKey } from '@bim-open-viewer/model';
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

it('a STEP id shared by several source documents resolves to the architecture document', async () => {
  const loaded = await loadModelHeadless(`${models}/duplex-federated.bos`);
  const docs = loaded.documents;
  expect(docs, 'the federated model names its documents').toBeDefined();
  const byKey = new Map(loaded.data.objects.map((o, i) => [objectKey(o.ref), i] as const));
  const keys = keysByStepId(loaded);
  const elements = await loadTable(`${data}/elements.json`);
  const products = elements.filter((e) => String(e.Category).startsWith('IFC') && !['IFCPROJECT', 'IFCSITE', 'IFCBUILDING'].includes(String(e.Category)));
  const wrongDocument = products.filter((e) => {
    const key = keys.get(Number(e.StepId));
    const index = key === undefined ? undefined : byKey.get(key);
    return index !== undefined && !/Duplex_A_/.test(docs!.title[docs!.ofObject[index] ?? -1] ?? '');
  });
  expect(wrongDocument.map((e) => `${e.Category} #${e.StepId}`)).toEqual([]);
  const electrical = keysByStepId(loaded, /Electrical/);
  expect(electrical.size).toBeGreaterThan(0);
});
