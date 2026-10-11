// Checks specific to storeys-in-3d: the counts the chart draws, the storey
// order, how the federated model's drawn objects split between storeys, and
// how far the explode lifts each storey.

import { beforeAll, describe, expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LoadedModel } from '@bim-open-viewer/formats';
import type { Row } from '../../src/chart';
import { loadTable } from '../../src/data';
import { loadModelHeadless } from '../../src/scene';
import { assignStoreys, countsPerStorey, elementsByStoreyAndClass, storeysByElevation, type Storey } from './storeys';
import { explodeOffsets } from './scene-storeys';
import { demo } from './main';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '../../public');

describe('demo storeys-in-3d: data', () => {
  let elements: Row[];
  let storeys: Storey[];
  let loaded: LoadedModel;
  beforeAll(async () => {
    elements = await loadTable(`${site}/data/duplex/elements.json`);
    storeys = storeysByElevation(elements, await loadTable(`${site}/data/duplex/parameters.json`));
    loaded = await loadModelHeadless(`${site}/models/duplex-federated.bos`);
  });

  it('orders the four storeys by Ifc:Elevation', () => {
    expect(storeys.map((s) => [s.name, s.elevation])).toEqual([
      ['T/FDN', -1.25],
      ['Level 1', 0],
      ['Level 2', 3.1],
      ['Roof', 6],
    ]);
    expect(new Set(storeys.map((s) => s.color)).size).toBe(4);
  });

  it('counts the architecture elements per storey from the extracts, rooms left out', () => {
    const perStorey = new Map<string, number>();
    for (const r of elementsByStoreyAndClass(elements)) perStorey.set(String(r.storey), (perStorey.get(String(r.storey)) ?? 0) + Number(r.count));
    expect(Object.fromEntries(perStorey)).toEqual({ 'T/FDN': 14, 'Level 1': 103, 'Level 2': 93, Roof: 8 });
    const walls = elementsByStoreyAndClass(elements).find((r) => r.storey === 'Level 2' && r.cls === 'Wall');
    expect(walls?.count, 'IFCWALL and IFCWALLSTANDARDCASE count as one class').toBe(25);
  });

  it('places every drawn object of the federated model on a storey, faded, or hidden', () => {
    expect(loaded.data.objects.length).toBeGreaterThan(200);
    const drawn = loaded.data.objects.filter((o) => o.representation !== undefined).length;
    const a = assignStoreys(loaded, elements);
    expect(a.byKey.size + a.unassigned.length + a.rooms.length).toBe(drawn);
    // 218 extract elements carry a storey; 3 of them draw nothing of their own.
    expect(a.sourceCounts.extract, 'drawn architecture elements joined by EntityIndex and STEP id').toBe(215);
    expect(a.sourceCounts.containment).toBeGreaterThan(1000);
    expect(countsPerStorey(a, storeys).map((c) => c.name)).toEqual(['T/FDN', 'Level 1', 'Level 2', 'Roof']);
  });

  it('lifts storey i by i x 1.5 average storey heights and leaves the lowest in place', () => {
    const a = assignStoreys(loaded, elements);
    const offsets = explodeOffsets(storeys, a, 'z');
    const lifts = new Map<string, number>();
    for (const [key, name] of a.byKey) lifts.set(name, offsets.get(key)?.[2] ?? 0);
    const step = ((6 + 1.25) / 3) * 1.5;
    expect(lifts.get('T/FDN')).toBe(0);
    expect(lifts.get('Level 1')).toBeCloseTo(step);
    expect(lifts.get('Roof')).toBeCloseTo(3 * step);
  });

  it('describes the scene headlessly with one layer per storey', async () => {
    const views = await demo.headless({ dataRoot: here, siteRoot: site });
    const scene = views.find((v) => v.kind === 'scene3d');
    expect((scene?.description?.layers as { name: string }[]).map((l) => l.name)).toEqual(['T/FDN', 'Level 1', 'Level 2', 'Roof']);
  });
});
