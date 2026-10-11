// Embodied carbon per element of the Duplex: the model's volume times a
// synthetic factor for the element's material family. Pure functions over
// the extracts, so the page, the headless view, and the test share them.
// An element without a volume or without a family keeps a null carbon and
// is counted, never summed as zero.

import type { Row } from '../../src/chart';
import { parametersByElement } from '../../src/data';
import { storeys } from '../../src/building';

/** One material family in data/carbon-factors.json. */
export interface CarbonFamily {
  readonly family: string;
  readonly label: string;
  /** kgCO2e per m³. */
  readonly factor: number;
  readonly keywords: readonly string[];
  readonly note: string;
}

export interface CarbonFactors {
  readonly unit: string;
  readonly scope: string;
  readonly source: string;
  /** Material names with one of these words are cavities (air, stud layers) and never give the family. */
  readonly cavityKeywords: readonly string[];
  /** In match priority order. */
  readonly families: readonly CarbonFamily[];
}

/** One building element and what the factors make of it. */
export interface ElementCarbon {
  readonly stepId: number;
  readonly name: string;
  readonly typeName: string;
  readonly category: string;
  readonly storey: string;
  /** PSet_Revit_Dimensions Volume, m³; null when the model has none. */
  readonly volume: number | null;
  /** The family label; null when no keyword matched. */
  readonly family: string | null;
  /** kgCO2e per m³ for the family; null when no family matched. */
  readonly factor: number | null;
  /** The type or material name that matched the family. */
  readonly matchedOn: string | null;
  /** kgCO2e; null when the volume or the family is missing. */
  readonly carbon: number | null;
}

/** Entities that are places or holes, not built material: outside the takeoff. */
const NOT_BUILT: ReadonlySet<string> = new Set([
  'IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCSPACE', 'IFCOPENINGELEMENT',
]);

export const NO_STOREY = 'no storey';

/** "Basic Wall:Exterior - Brick on Block:138062" → "Basic Wall:Exterior - Brick on Block" (the trailing instance id dropped). */
export const typeNameOf = (name: string): string => name.replace(/:\d+$/, '');

/**
 * Material names per element (EntityIndex), in layer order: a layer's
 * material through HasLayer then the layer's HasMaterial, and any material
 * linked to the element directly.
 */
export const materialsByElement = (relations: readonly Row[]): Map<number, string[]> => {
  const layerMaterial = new Map<number, string>();
  for (const r of relations)
    if (r.RelationType === 'HasMaterial' && r.CategoryA === 'IFCMATERIALLAYER') layerMaterial.set(Number(r.EntityIndexA), String(r.NameB));
  const out = new Map<number, string[]>();
  const add = (element: number, material: string | undefined) => {
    if (material === undefined) return;
    const list = out.get(element) ?? [];
    if (!list.includes(material)) list.push(material);
    out.set(element, list);
  };
  for (const r of relations) {
    if (r.RelationType === 'HasLayer') add(Number(r.EntityIndexA), layerMaterial.get(Number(r.EntityIndexB)));
    else if (r.RelationType === 'HasMaterial' && r.CategoryA !== 'IFCMATERIALLAYER') add(Number(r.EntityIndexA), String(r.NameB));
  }
  return out;
};

const keywordPattern = (keyword: string): RegExp => new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

/** The first family, in priority order, with a keyword in the first of `names` that has any match. */
export const familyOf = (
  names: readonly string[],
  families: readonly CarbonFamily[],
): { family: CarbonFamily; matchedOn: string } | null => {
  const patterns = families.map((f) => ({ family: f, tests: f.keywords.map(keywordPattern) }));
  for (const name of names)
    for (const p of patterns) if (p.tests.some((t) => t.test(name))) return { family: p.family, matchedOn: name };
  return null;
};

/** Every built element of the model with its volume, family, and carbon. */
export const elementCarbon = (
  elements: readonly Row[],
  parameters: readonly Row[],
  relations: readonly Row[],
  factors: CarbonFactors,
): ElementCarbon[] => {
  const volumes = parametersByElement(
    parameters.filter((p) => p.ParameterGroup === 'PSet_Revit_Dimensions'),
    ['Volume'],
  );
  const materials = materialsByElement(relations);
  const cavity = factors.cavityKeywords.map(keywordPattern);
  const solid = (material: string) => !cavity.some((t) => t.test(material));
  return elements
    .filter((e) => !NOT_BUILT.has(String(e.Category)))
    .map((e) => {
      const index = Number(e.EntityIndex);
      const name = String(e.Name ?? '');
      const typeName = typeNameOf(name);
      const raw = volumes.get(index)?.Volume;
      const volume = typeof raw === 'number' && raw > 0 ? raw : null;
      const match = familyOf([typeName, ...(materials.get(index) ?? []).filter(solid)], factors.families);
      return {
        stepId: Number(e.StepId),
        name,
        typeName,
        category: String(e.Category),
        storey: e.StoreyName == null ? NO_STOREY : String(e.StoreyName),
        volume,
        family: match?.family.label ?? null,
        factor: match?.family.factor ?? null,
        matchedOn: match?.matchedOn ?? null,
        carbon: volume !== null && match ? volume * match.family.factor : null,
      };
    });
};

/** Storey names from top to bottom, by Ifc:Elevation. */
export const storeyOrder = (elements: readonly Row[], parameters: readonly Row[]): string[] => {
  const elevation = parametersByElement(parameters, ['Ifc:Elevation']);
  return storeys(elements, (i) => {
    const v = elevation.get(i)?.['Ifc:Elevation'];
    return typeof v === 'number' ? v : null;
  })
    .map((s) => s.name)
    .reverse();
};

const round = (x: number) => Math.round(x * 10) / 10;

/** Carbon summed per storey and family: the stacked bar's rows. */
export const carbonByStoreyFamily = (rows: readonly ElementCarbon[]): Row[] => {
  const sums = new Map<string, { storey: string; family: string; carbon: number; elements: number }>();
  for (const r of rows) {
    if (r.carbon === null || r.family === null) continue;
    const key = `${r.storey}\u0000${r.family}`;
    const s = sums.get(key) ?? { storey: r.storey, family: r.family, carbon: 0, elements: 0 };
    s.carbon += r.carbon;
    s.elements += 1;
    sums.set(key, s);
  }
  return [...sums.values()].map((s) => ({ ...s, carbon: round(s.carbon) }));
};

/** Carbon summed per family, largest first: the sorted bar's rows. */
export const carbonByFamily = (rows: readonly ElementCarbon[]): Row[] => {
  const sums = new Map<string, { family: string; factor: number; carbon: number; elements: number; volume: number }>();
  for (const r of rows) {
    if (r.carbon === null || r.family === null || r.factor === null || r.volume === null) continue;
    const s = sums.get(r.family) ?? { family: r.family, factor: r.factor, carbon: 0, elements: 0, volume: 0 };
    s.carbon += r.carbon;
    s.elements += 1;
    s.volume += r.volume;
    sums.set(r.family, s);
  }
  return [...sums.values()]
    .sort((a, b) => b.carbon - a.carbon)
    .map((s) => ({ ...s, carbon: round(s.carbon), volume: Math.round(s.volume * 100) / 100 }));
};

/** Per storey: total carbon, and how many elements were left out for want of a volume or a factor. */
export interface StoreyTally {
  readonly storey: string;
  readonly carbon: number;
  readonly counted: number;
  readonly noVolume: number;
  readonly noFactor: number;
}

export const storeyTallies = (rows: readonly ElementCarbon[], order: readonly string[]): StoreyTally[] => {
  const names = [...order, ...new Set(rows.map((r) => r.storey).filter((s) => !order.includes(s)))];
  return names
    .map((storey) => {
      const on = rows.filter((r) => r.storey === storey);
      return {
        storey,
        carbon: round(on.reduce((sum, r) => sum + (r.carbon ?? 0), 0)),
        counted: on.filter((r) => r.carbon !== null).length,
        noVolume: on.filter((r) => r.volume === null).length,
        noFactor: on.filter((r) => r.volume !== null && r.family === null).length,
      };
    })
    .filter((t) => t.counted + t.noVolume + t.noFactor > 0);
};
