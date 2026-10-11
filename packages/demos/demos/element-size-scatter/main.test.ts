// The Duplex has 237 elements with a box: 21 rooms (not drawn) and 216 built
// elements, of which 105 carry a modelled Volume and 111 fall back to the
// box. None has a zero or missing size. The largest is the flat roof, by box
// volume, and it appears twice: the IFCROOF and the IFCSLAB inside it.

import { describe, expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demo, largest, loadElementSizes } from './main';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '../../public');
const sources = {
  elements: `${site}/data/duplex/elements.json`,
  parameters: `${site}/data/duplex/parameters.json`,
  bounds: `${site}/data/duplex/bounds.json`,
};
const ROOF = 'Basic Roof:Live Roof over Wood Joist Flat Roof:184483';

// Named so the chunk's filter, -t "demo element-size-scatter", runs these too.
describe('demo element-size-scatter: sizes', () => {
  it('sizes 216 built elements: 105 modelled, 111 from the box, none left out, 21 rooms skipped', async () => {
    const data = await loadElementSizes(sources);
    expect(data.points).toHaveLength(216);
    expect(data.points.filter((p) => p.source === 'modelled')).toHaveLength(105);
    expect(data.points.filter((p) => p.source === 'box')).toHaveLength(111);
    expect(data.leftOut).toHaveLength(0);
    expect(data.spaces).toBe(21);
    for (const p of data.points) expect(p.volume).toBeGreaterThan(0);
  });

  it('ranks the roof first by box volume, and flags it as an assembly drawn twice', async () => {
    const data = await loadElementSizes(sources);
    const top = largest(data.points);
    expect(top).toHaveLength(10);
    expect(top[0]!.name).toBe(ROOF);
    expect(top[0]!.source).toBe('box');
    expect(top[0]!.volume).toBeCloseTo(61.76, 1);
    expect(data.sharedBoxes.map((p) => p.ifcClass).sort()).toEqual(['IFCROOF', 'IFCSLAB']);
    const firstModelled = top.find((p) => p.source === 'modelled')!;
    expect(firstModelled.ifcClass).toBe('IFCWALL');
    expect(firstModelled.volume).toBeCloseTo(25.83, 2);
  });

  it('draws every point in the scatter and ten bars in the ranking', async () => {
    const views = await demo.headless({ dataRoot: here, siteRoot: site });
    expect(views.map((v) => [v.kind, v.rows])).toEqual([
      ['chart', 216],
      ['chart', 10],
    ]);
    expect(views[0]!.svg).toContain('Volume (m³, log scale)');
    expect(views[1]!.svg).toContain('1. Live Roof over Wood Joist Flat Roof (184483)');
  });
});
