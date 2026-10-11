// The Duplex estimate an estimator can check by hand: which elements are
// priced, which stay unpriced and why, that the value-engineered rates cost
// less, and which storey costs most. The small case pins the absence rules.

import { describe, expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDataPath } from '../../src/demo';
import { captionHtml, demo, load } from './main';
import { estimate, storeyTotals, unpricedRows, type RateBook, type UnitRate } from './estimate';

const here = dirname(fileURLToPath(import.meta.url));
const paths = { dataRoot: here, siteRoot: resolve(here, '../../public') };
const duplex = () => load((f) => resolveDataPath(f, paths));

describe('demo cost-by-storey-class: estimate', () => {
  it('prices 198 Duplex elements, leaves 9 unpriced, and folds 11 parts into their assembly', async () => {
    const { est } = await duplex();
    expect(est.priced).toHaveLength(198);
    expect(est.unpriced).toHaveLength(9);
    expect(est.included).toHaveLength(11);
    expect(unpricedRows(est).map((r) => [r.class, r.reason, r.count])).toEqual([
      ['Roof', 'no rate', 1],
      ['Wall', 'no quantity', 1],
      ['Wall', 'no rate', 7],
    ]);
    expect(est.included.filter((p) => p.partOf === 'Stair')).toHaveLength(10);
  });

  it('costs less under the value-engineered rates than under the base rates', async () => {
    const { est } = await duplex();
    expect(est.base).toBeCloseTo(408872.33, 2);
    expect(est.ve).toBeCloseTo(335031.15, 2);
    expect(est.base).toBeGreaterThan(est.ve);
  });

  it('finds Level 1 the most expensive storey under the base rates', async () => {
    const { est } = await duplex();
    expect(est.storeys).toEqual(['Roof', 'Level 2', 'Level 1', 'T/FDN']);
    const totals = storeyTotals(est);
    const top = totals.reduce((a, b) => (b.base > a.base ? b : a));
    expect(top.storey).toBe('Level 1');
    expect(top.base).toBeCloseTo(210871.35, 2);
  });

  it('keeps an element without a rate or without its quantity out of the totals, never at 0', () => {
    const rate = (r: Partial<UnitRate>): UnitRate => ({
      item: 'x', ifcClasses: ['IFCWALL'], typePattern: '.*', measure: 'Area', unit: 'm²', base: 100, ve: 80, veChange: 'y', ...r,
    });
    const book: RateBook = {
      currency: 'USD', priceBase: 'test', note: 'test',
      rates: [rate({}), rate({ ifcClasses: ['IFCSTAIR'], measure: 'Count', unit: 'each', base: 1000, ve: 900 })],
    };
    const est = estimate(
      [
        { EntityIndex: 1, Category: 'IFCBUILDINGSTOREY', Name: 'Ground', StoreyName: null },
        { EntityIndex: 2, Category: 'IFCWALL', Name: 'Basic Wall:A:11', StoreyName: 'Ground' },
        { EntityIndex: 3, Category: 'IFCWALL', Name: 'Basic Wall:A:12', StoreyName: 'Ground' },
        { EntityIndex: 4, Category: 'IFCROOF', Name: 'Roof:R:13', StoreyName: null },
        { EntityIndex: 5, Category: 'IFCSTAIR', Name: 'Stair:S:14', StoreyName: 'Ground' },
        { EntityIndex: 6, Category: 'IFCRAILING', Name: 'Railing:G:15', StoreyName: 'Ground' },
      ],
      [
        { EntityIndex: 1, Name: 'Ifc:Elevation', ParameterGroup: 'IFCBUILDINGSTOREY', ValueType: 'Number', Value: '0' },
        { EntityIndex: 2, Name: 'Area', ParameterGroup: 'PSet_Revit_Dimensions', ValueType: 'Number', Value: '10' },
        { EntityIndex: 3, Name: 'Area', ParameterGroup: 'PSet_Revit_Type_Other', ValueType: 'String', Value: 'Area' },
      ],
      [{ EntityIndexA: 6, EntityIndexB: 5, RelationType: 'MemberOf' }],
      book,
    );
    expect(est.priced.map((p) => [p.id, p.base, p.ve])).toEqual([[2, 1000, 800], [5, 1000, 900]]);
    expect(est.unpriced.map((u) => [u.id, u.reason])).toEqual([[3, 'no quantity'], [4, 'no rate']]);
    expect(est.included.map((p) => [p.id, p.partOf])).toEqual([[6, 'Stair']]);
    expect(est.storeys).toEqual(['Ground', 'no storey']);
    expect([est.base, est.ve]).toEqual([2000, 1700]);
  });

  it('draws the three figures and names the measures and the unpriced elements in the caption', async () => {
    const views = await demo.headless(paths);
    expect(views.map((v) => v.title)).toEqual([
      'Cost per storey, Base and VE, by class',
      'Saving per class (Base − VE)',
      'Unpriced elements per class',
    ]);
    expect(views[0]!.svg).toContain('Level 1');
    expect(views[0]!.svg).toContain('210,871');
    expect(views[2]!.svg).toContain('no quantity');
    const { est, book } = await duplex();
    const caption = captionHtml(est, book);
    expect(caption).toContain('synthetic and illustrative');
    expect(caption).toContain('Footing by Volume (m³)');
    expect(caption).toContain('Beam by Length (m)');
    expect(caption).toContain('Unpriced, 9 elements');
  });
});
