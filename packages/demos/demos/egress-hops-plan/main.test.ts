// The egress-hops demo's numbers on the Duplex: two exits, every room on the
// living storeys reached, the hop counts per room, and the Roof space shown
// as unreached rather than 0. The describe name matches the shared test's
// "demo egress-hops-plan" filter.

import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDataPath } from '../../src/demo';
import { LIVING_STOREYS, chartRows, demo, loadEgress } from './main';

const dataRoot = dirname(fileURLToPath(import.meta.url));
const paths = { dataRoot, siteRoot: resolve(dataRoot, '../../public') };

describe('demo egress-hops-plan: hop counts', async () => {
  const egress = await loadEgress(resolveDataPath('/data/duplex/elements.json', paths), resolveDataPath('/data/duplex/bounds.json', paths));

  it('finds two exits, both on Level 1, each opening from one room', () => {
    expect(egress.exits).toHaveLength(2);
    for (const e of egress.exits) {
      expect(e.door.storey).toBe('Level 1');
      expect(e.spaces.map((s) => s.name)).toEqual(['Foyer']);
    }
  });

  it('reaches every room on Level 1 and Level 2, at most 2 connections from an exit', () => {
    const living = egress.spaces.filter((s) => (LIVING_STOREYS as readonly (string | null)[]).includes(s.storey));
    expect(living).toHaveLength(20);
    expect(living.filter((s) => !egress.hops.has(s.id)).map((s) => s.name)).toEqual([]);
    expect(egress.maxHops).toBe(2);
  });

  it('counts 2 rooms at 0, 12 at 1, 6 at 2, and the Roof space unreached', () => {
    const counts: Record<string, number> = {};
    for (const r of chartRows(egress)) counts[String(r.hops)] = (counts[String(r.hops)] ?? 0) + 1;
    expect(counts).toEqual({ '0': 2, '1': 12, '2': 6, unreached: 1 });
    expect(chartRows(egress).filter((r) => r.hops === 'unreached').map((r) => r.space)).toEqual(['Roof']);
  });

  it('draws both storey plans with exits, stairs, and a legend, and the chart with an unreached bar', async () => {
    const views = await demo.headless(paths);
    expect(views.map((v) => v.kind)).toEqual(['drawing', 'drawing', 'chart']);
    const [level1, level2, chart] = views;
    expect(level1!.svg).toContain('>Exit<');
    expect(level1!.svg).toContain('>Stair<');
    expect(level1!.svg).toContain('0 (exit room)');
    expect(level2!.svg).not.toContain('>Exit<');
    expect(level2!.svg).toContain('>Stair<');
    expect(level1!.rows + level2!.rows).toBe(20);
    expect(chart!.svg).toContain('unreached');
    expect(chart!.rows).toBe(21);
  });
});
