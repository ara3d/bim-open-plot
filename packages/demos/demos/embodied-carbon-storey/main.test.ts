// The Duplex has 218 built elements; 105 carry a PSet_Revit_Dimensions
// Volume, and 92 of those match a material family. The 13 left out are the
// 7 bearing footings (no material named) and the 6 ceramic tile floors (no
// family for tile). Level 1 carries the most carbon, brick the most of any family.

import { describe, expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDataPath } from '../../src/demo';
import { demo, loadCarbon } from './main';

const here = dirname(fileURLToPath(import.meta.url));
const paths = { dataRoot: here, siteRoot: resolve(here, '../../public') };

describe('demo embodied-carbon-storey: the carbon arithmetic', () => {
  it('counts elements with a volume and with a factor, and leaves the rest out', async () => {
    const data = await loadCarbon((f) => resolveDataPath(f, paths));
    expect(data.elements).toHaveLength(218);
    expect(data.elements.filter((e) => e.volume !== null)).toHaveLength(105);
    expect(data.elements.filter((e) => e.carbon !== null)).toHaveLength(92);
    const noFactor = data.elements.filter((e) => e.volume !== null && e.family === null);
    expect(noFactor.map((e) => e.category).sort()).toEqual([...Array(7).fill('IFCFOOTING'), ...Array(6).fill('IFCSLAB')]);
  });

  it('puts Level 1 on top among storeys and brick on top among families', async () => {
    const data = await loadCarbon((f) => resolveDataPath(f, paths));
    expect(data.order).toEqual(['Roof', 'Level 2', 'Level 1', 'T/FDN']);
    const top = [...data.tallies].sort((a, b) => b.carbon - a.carbon)[0]!;
    expect(top.storey).toBe('Level 1');
    expect(top.carbon).toBeCloseTo(38829.6, 0);
    expect(data.byFamily[0]).toMatchObject({ family: 'Brick', elements: 12 });
    expect(Number(data.byFamily[0]!.carbon)).toBeCloseTo(44562.7, 0);
  });

  it('colours every counted element in the 3D model', async () => {
    const views = await demo.headless(paths);
    const scene = views.find((v) => v.kind === 'scene3d')!;
    expect(scene.rows).toBe(92);
    expect(views.find((v) => v.title.startsWith('Embodied carbon by storey'))!.svg).toContain('Level 1');
  });
});
