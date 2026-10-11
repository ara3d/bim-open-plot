// The Duplex has 237 boxes: 21 spaces and the roof assembly (whose slab
// carries the same box) are left out, so 215 solids are tested. Their boxes
// give 287 candidates and 43 hosted overlaps (21 door × wall, 22 window ×
// wall). Furniture × Slab leads with 57; Level 1 holds 172 candidates.

import { describe, expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { busiestStorey, candidatesOf, demo, loadClashes, pairCounts, storeyCounts } from './main';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '../../public');
const sources = {
  elements: `${site}/data/duplex/elements.json`,
  bounds: `${site}/data/duplex/bounds.json`,
  relations: `${site}/data/duplex/relations.json`,
};

describe('demo clash-candidate-matrix: the overlaps themselves', async () => {
  const data = await loadClashes(sources);
  const candidates = candidatesOf(data);

  it('tests 215 solids: spaces and the roof assembly are left out', () => {
    expect(data.solids).toHaveLength(215);
    expect(data.notSolid.map((e) => e.type)).toEqual(Array(21).fill('IFCSPACE'));
    expect(data.assemblies.map((e) => e.type)).toEqual(['IFCROOF']);
    expect(data.solids.some((e) => e.type === 'IFCSPACE' || e.type === 'IFCOPENINGELEMENT')).toBe(false);
  });

  it('finds 287 candidates and 43 hosted door and window overlaps', () => {
    expect(candidates).toHaveLength(287);
    expect(pairCounts(data.overlaps.filter((o) => o.kind === 'hosted'))).toEqual([
      { name: 'Wall × Window', count: 22 },
      { name: 'Door × Wall', count: 21 },
    ]);
  });

  it('counts no pair twice and pairs no element with itself', () => {
    const keys = data.overlaps.map((o) => [o.a.id, o.b.id].sort((p, q) => p - q).join('-'));
    expect(new Set(keys).size).toBe(data.overlaps.length);
    expect(data.overlaps.every((o) => o.a.id < o.b.id)).toBe(true);
    expect(data.overlaps.every((o) => o.volume > 0.001)).toBe(true);
  });

  it('puts Furniture × Slab first with 57, and Level 1 first among storeys with 172', () => {
    expect(pairCounts(candidates)[0]).toEqual({ name: 'Furniture × Slab', count: 57 });
    expect(pairCounts(candidates).reduce((n, p) => n + p.count, 0)).toBe(287);
    expect(busiestStorey(candidates)).toBe('Level 1');
    expect(storeyCounts(candidates)[0]).toEqual({ name: 'Level 1', count: 172 });
  });

  it('draws the heat map, the storey bar, and the Level 1 plan with every candidate there', async () => {
    const views = await demo.headless({ dataRoot: here, siteRoot: site });
    expect(views.map((v) => v.kind)).toEqual(['chart', 'chart', 'drawing']);
    expect(views[0]!.svg).toContain('Furniture');
    expect(views[1]!.rows).toBe(287);
    expect(views[2]!.rows).toBe(172);
    expect(views[2]!.svg).toContain('Level 1');
  });
});
