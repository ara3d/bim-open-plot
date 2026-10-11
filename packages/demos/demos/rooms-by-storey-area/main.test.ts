// The numbers behind the two charts, so a wrong join (a parameter read from
// the wrong property set, a space on the wrong storey, a unit mislabelled)
// fails here before it reaches the page.

import { describe, expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTable } from '../../src/data';
import { caption, demo, roomAreas } from './main';

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(here, '../../public');

describe('demo rooms-by-storey-area: numbers', () => {
  const load = async () =>
    roomAreas(
      await loadTable(`${siteRoot}/data/duplex/elements.json`),
      await loadTable(`${siteRoot}/data/duplex/parameters.json`),
    );

  it('reads an Area for all 21 spaces and totals each storey, top storey first', async () => {
    const a = await load();
    expect(a.rooms).toHaveLength(21);
    expect(a.rooms.filter((r) => r.area === null)).toEqual([]);
    expect(a.storeys.map((s) => s.name)).toEqual(['Roof', 'Level 2', 'Level 1', 'T/FDN']);
    const total = Object.fromEntries(a.storeys.map((s) => [s.name, s.total]));
    expect(total['Roof']).toBeCloseTo(145.72, 2);
    expect(total['Level 2']).toBeCloseTo(134.53, 2);
    expect(total['Level 1']).toBeCloseTo(141.79, 2);
    expect(total['T/FDN']).toBeNull();
  });

  it('puts ten spaces in each unit, and the unit agrees with the room number prefix', async () => {
    const a = await load();
    expect(a.rooms.filter((r) => r.unit === 'Unit A')).toHaveLength(10);
    expect(a.rooms.filter((r) => r.unit === 'Unit B')).toHaveLength(10);
    expect(a.rooms.filter((r) => r.unit === null).map((r) => r.number)).toEqual(['R301']);
    for (const r of a.rooms.filter((x) => x.unit !== null)) expect(r.unit, r.number ?? r.name).toBe(`Unit ${r.number?.[0]}`);
  });

  it('names the largest storey and its caveat in the caption, and draws the totals', async () => {
    const a = await load();
    const text = caption(a);
    expect(text).toContain('21 of 21 spaces have an Area');
    expect(text).toContain('Level 1 leads with 141.8 m²');
    const [byStorey] = await demo.headless({ dataRoot: here, siteRoot });
    expect(byStorey!.rows).toBe(21);
    expect(byStorey!.svg).toContain('145.7 m²');
    expect(byStorey!.svg).toContain('no spaces');
  });
});
