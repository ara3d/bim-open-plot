// Numbers the parameter-completeness figures rest on, checked against the
// Duplex extracts so a change to the counting rules shows up here.

import { beforeAll, describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTable } from '../../src/data';
import { classRows, completeness, demo, heatRows, parameterKey, type Completeness } from './main';

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(here, '../../public');

describe('demo parameter-completeness numbers', () => {
  let r: Completeness;
  beforeAll(async () => {
    r = completeness(
      await loadTable(`${siteRoot}/data/duplex/elements.json`),
      await loadTable(`${siteRoot}/data/duplex/parameters.json`),
    );
  });

  const cell = (ifcClass: string, parameter: string) => r.cells.find((c) => c.ifcClass === ifcClass && c.parameter === parameter);

  it('reads 239 product elements in 15 classes and their 13,275 parameter rows', () => {
    expect(r.elementCount).toBe(239);
    expect(r.classes).toHaveLength(15);
    expect(r.parameterRows).toBe(13_275);
    expect(r.classes.map((c) => c.ifcClass)).not.toContain('IFCOPENINGELEMENT');
  });

  it('shows 52 parameters: the 25 most filled plus the curated ones', () => {
    expect(r.shown).toHaveLength(52);
    for (const p of ['Ifc:OverallWidth', 'Ifc:OverallHeight', 'Pset_*Common.IsExternal', 'Pset_*Common.LoadBearing', 'Pset_*Common.FireRating', 'PSet_Revit_Dimensions.Volume'])
      expect(r.shown).toContain(p);
  });

  it('fills IFCDOOR × Ifc:OverallWidth for 14 of 14 doors', () => {
    expect(cell('IFCDOOR', 'Ifc:OverallWidth')).toEqual({ ifcClass: 'IFCDOOR', parameter: 'Ifc:OverallWidth', filled: 14, elements: 14 });
  });

  it('leaves a parameter that never occurs on a class blank, not 0%', () => {
    expect(cell('IFCSPACE', 'Ifc:OverallWidth')).toBeUndefined();
    expect(heatRows(r).some((h) => String(h.ifcClass).startsWith('IFCSPACE') && h.parameter === 'Ifc:OverallWidth')).toBe(false);
  });

  it('counts a COBie placeholder (the value repeats the name) as unfilled', () => {
    // Pset_DoorCommon.FireRating is "Fire Rating" on every door.
    expect(cell('IFCDOOR', 'Pset_*Common.FireRating')).toMatchObject({ filled: 0, elements: 14 });
    expect(r.placeholderRows).toBe(7153);
    expect(r.emptyRows).toBe(464);
  });

  it('gives a class with no parameters no rate rather than 0%', () => {
    const roof = classRows(r).find((c) => c.ifcClass === 'IFCROOF (1)');
    expect(roof).toMatchObject({ rate: null, label: 'no parameters' });
  });

  it('never labels a partial fill as 100%', () => {
    for (const h of heatRows(r)) if (h.label === '100%') expect(h.rate).toBe(1);
  });

  it('draws both charts headlessly with one cell per heat-map row', async () => {
    const views = await demo.headless({ dataRoot: here, siteRoot });
    expect(views.map((v) => v.title)).toEqual(['Fill rate by class and parameter', 'Overall fill rate by class']);
    expect(views[0]!.rows).toBe(heatRows(r).length);
    expect(views[1]!.rows).toBe(15);
  });
});

describe('demo parameter-completeness keys', () => {
  it('names a column PropertySet.Name, an IFC attribute by its bare name, and merges class common sets', () => {
    expect(parameterKey('PSet_Revit_Dimensions', 'Area', 'IFCSLAB')).toBe('PSet_Revit_Dimensions.Area');
    expect(parameterKey('IFCDOOR', 'Ifc:OverallWidth', 'IFCDOOR')).toBe('Ifc:OverallWidth');
    expect(parameterKey('Pset_WallCommon', 'IsExternal', 'IFCWALLSTANDARDCASE')).toBe('Pset_*Common.IsExternal');
  });
});
