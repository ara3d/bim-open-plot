// The element mix of the Duplex: counts per class and storey that a BIM
// manager can check against the model, and the "no storey" row that keeps an
// unassigned element visible instead of dropping it.

import { describe, expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTable } from '../../src/data';
import { demo, elementMix, NO_STOREY, type ElementMix } from './main';

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(here, '../../public');

const duplex = async (): Promise<ElementMix> =>
  elementMix(await loadTable(`${siteRoot}/data/duplex/elements.json`), await loadTable(`${siteRoot}/data/duplex/parameters.json`));

const count = (mix: ElementMix, cls: string, storey?: string) =>
  mix.rows.filter((r) => r.class === cls && (storey === undefined || r.storey === storey)).reduce((s, r) => s + Number(r.count), 0);

describe('demo element-mix-by-storey: counts', () => {
  it('counts the Duplex classes per storey', async () => {
    const mix = await duplex();
    expect(count(mix, 'Wall')).toBe(56);
    expect(count(mix, 'Wall (other)')).toBe(1);
    expect(count(mix, 'Door')).toBe(14);
    expect(count(mix, 'Window')).toBe(24);
    expect([count(mix, 'Window', 'Level 1'), count(mix, 'Window', 'Level 2'), count(mix, 'Window', 'Roof')]).toEqual([4, 18, 2]);
    expect(count(mix, 'Furniture')).toBe(61);
    expect(count(mix, 'Space')).toBe(21);
    expect(count(mix, 'Opening')).toBe(0);
    expect(mix.total).toBe(239);
    expect(mix.openings).toBe(50);
    expect(mix.openingsWithoutStorey).toBe(50);
    expect(mix.noStorey).toBe(0);
  });

  it('orders storeys by elevation, highest first, and each storey\'s shares sum to one', async () => {
    const mix = await duplex();
    expect(mix.storeys).toEqual(['Roof', 'Level 2', 'Level 1', 'T/FDN']);
    for (const s of mix.storeys) {
      const sum = mix.rows.filter((r) => r.storey === s).reduce((t, r) => t + Number(r.share), 0);
      expect(sum).toBeCloseTo(1, 9);
    }
  });

  it('keeps an element with no storey as a "no storey" row, last', () => {
    const mix = elementMix(
      [
        { EntityIndex: 1, Category: 'IFCBUILDINGSTOREY', Name: 'Ground', StoreyName: null },
        { EntityIndex: 2, Category: 'IFCDOOR', Name: 'D1', StoreyName: 'Ground' },
        { EntityIndex: 3, Category: 'IFCDOOR', Name: 'D2', StoreyName: null },
        { EntityIndex: 4, Category: 'IFCPLATE', Name: 'P1', StoreyName: null },
      ],
      [{ EntityIndex: 1, Name: 'Ifc:Elevation', ValueType: 'Number', Value: '0.0' }],
    );
    expect(mix.storeys).toEqual(['Ground', NO_STOREY]);
    expect(mix.noStorey).toBe(2);
    expect(mix.total).toBe(3);
    expect(mix.rows.find((r) => r.ifcClass === 'IFCPLATE')).toMatchObject({ class: 'Plate', storey: NO_STOREY, elevation: null });
  });

  it('draws the count and the normalised chart with readable class names', async () => {
    const views = await demo.headless({ dataRoot: here, siteRoot });
    expect(views.map((v) => v.title)).toEqual(['Elements per storey, by class', 'Class mix per storey']);
    for (const v of views) {
      expect(v.svg).toContain('Furniture');
      expect(v.svg).toContain('T/FDN');
      expect(v.svg).toContain('Stair flight');
    }
  });
});
