// Travel distances in the Duplex box model: every living room has a route,
// the longest is plausible for a two-storey duplex, the farthest room is an
// upper bedroom, the roof space stays absent, and the views draw.

import { describe, expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDataPath } from '../../src/demo';
import { LIMIT_M, LIVING_STOREYS, chartRows, demo, loadTravel } from './main';

const dataRoot = dirname(fileURLToPath(import.meta.url));
const paths = { dataRoot, siteRoot: resolve(dataRoot, '../../public') };

describe('demo travel-distance-heatmap: travel distances', async () => {
  const travel = await loadTravel(resolveDataPath('/data/duplex/elements.json', paths), resolveDataPath('/data/duplex/bounds.json', paths));
  const living = travel.rooms.filter((r) => (LIVING_STOREYS as readonly (string | null)[]).includes(r.space.storey));

  it('gives every Level 1 and Level 2 room a distance and a path ending at an exit', () => {
    expect(living).toHaveLength(20);
    const exitIds = new Set(travel.exits.map((e) => e.id));
    for (const r of living) {
      expect(r.distance, r.space.name).not.toBeNull();
      expect(exitIds.has(r.path[r.path.length - 1]!.id), r.space.name).toBe(true);
    }
    expect(travel.exits).toHaveLength(2);
  });

  it('finds the farthest room, Bedroom 1 on Level 2, between 5 and 40 m, under the illustrative limit', () => {
    const far = travel.rooms[0]!;
    expect(far.space.name).toBe('Bedroom 1');
    expect(far.space.storey).toBe('Level 2');
    expect(far.distance).toBeGreaterThan(5);
    expect(far.distance).toBeLessThan(40);
    expect(far.distance!).toBeCloseTo(12.8, 1);
    expect(far.distance!).toBeLessThan(LIMIT_M);
    expect(travel.hi).toBe(13);
  });

  it('keeps the roof space without a route as absent, not as 0', () => {
    const roof = travel.rooms.filter((r) => r.space.storey === 'Roof');
    expect(roof.length).toBeGreaterThan(0);
    for (const r of roof) expect(r.distance).toBeNull();
    expect(chartRows(travel)).toHaveLength(20);
  });

  it('draws both storey plans with exits only on Level 1, and the chart with the limit line', async () => {
    const views = await demo.headless(paths);
    const [l1, l2, chart] = views;
    expect(l1!.svg).toContain('Level 1');
    expect(l1!.svg).toContain('Exit');
    expect(l2!.svg).toContain('Level 2');
    expect(l2!.svg).not.toContain('>Exit<');
    expect(l2!.svg).toContain('stroke-dasharray');
    expect(chart!.rows).toBe(20);
    expect(chart!.svg).toContain(`Illustrative limit ${LIMIT_M} m`);
  });
});
