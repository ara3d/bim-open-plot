// The estimate behind the cost-by-storey-class demo: model quantities times
// synthetic unit rates, per element, under two scenarios. An element whose
// class and type match no rate, or whose rate needs a quantity the element
// does not carry, stays unpriced: counted and shown, never priced at 0.

import type { Row } from '../../src/chart';
import { parametersByElement } from '../../src/data';

/** The quantity a rate is applied to: a PSet_Revit_Dimensions value, or one per element. */
export type Measure = 'Area' | 'Volume' | 'Length' | 'Count';

/** One line of the rate book: which elements it prices, by what measure, at what rate per scenario. */
export interface UnitRate {
  readonly item: string;
  /** IFC entity names the rate applies to, e.g. IFCWALLSTANDARDCASE. */
  readonly ifcClasses: readonly string[];
  /** A regular expression tested against the element's type name (its Name without the trailing instance id). */
  readonly typePattern: string;
  readonly measure: Measure;
  /** The unit of the measure as shown to a reader: m², m³, m, or each. */
  readonly unit: string;
  readonly base: number;
  readonly ve: number;
  /** What the value-engineered rate substitutes. */
  readonly veChange: string;
}

/** The shape of data/unit-rates.json. */
export interface RateBook {
  readonly currency: string;
  readonly priceBase: string;
  readonly note: string;
  readonly rates: readonly UnitRate[];
}

/** The storey name used for an element with no storey, so it stays visible. */
export const NO_STOREY = 'no storey';

interface Element {
  readonly id: number;
  /** Readable class: Wall, Slab, Door, ... */
  readonly class: string;
  readonly type: string;
  readonly storey: string;
}

export interface PricedItem extends Element {
  readonly rate: UnitRate;
  readonly quantity: number;
  readonly base: number;
  readonly ve: number;
}

export interface UnpricedItem extends Element {
  /** 'no rate': nothing in the rate book matches; 'no quantity': a rate matches but the element lacks its measure. */
  readonly reason: 'no rate' | 'no quantity';
}

/** An element that is part of an assembly (a stair flight of a stair) and is measured with it. */
export interface IncludedPart extends Element {
  readonly partOf: string;
}

export interface Estimate {
  readonly priced: readonly PricedItem[];
  readonly unpriced: readonly UnpricedItem[];
  readonly included: readonly IncludedPart[];
  /** Storeys by elevation, highest first; NO_STOREY last when any element lacks one. */
  readonly storeys: readonly string[];
  readonly base: number;
  readonly ve: number;
}

/** Entities that are places or voids, not things a contractor builds and prices. */
const NOT_ITEMS: ReadonlySet<string> = new Set([
  'IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCSPACE', 'IFCOPENINGELEMENT',
]);

const CLASS_NAMES: Readonly<Record<string, string>> = {
  IFCWALL: 'Wall',
  IFCWALLSTANDARDCASE: 'Wall',
  IFCFURNISHINGELEMENT: 'Furniture',
  IFCSTAIRFLIGHT: 'Stair flight',
};

/** IFCSLAB -> Slab; the few compound names are spelled out above. */
export const readableClass = (ifcClass: string): string =>
  CLASS_NAMES[ifcClass] ?? ifcClass.replace(/^IFC/, '').toLowerCase().replace(/^./, (c) => c.toUpperCase());

/** "M_Single-Flush:0864 x 2032mm:0864 x 2032mm:150378" -> the type, without the instance id. */
const typeName = (name: string): string => name.replace(/:\d+$/, '');

const QUANTITY_GROUP = 'PSet_Revit_Dimensions';
const QUANTITIES: readonly Measure[] = ['Area', 'Volume', 'Length'];

/** Prices every buildable element of the model against the rate book. */
export const estimate = (
  elements: readonly Row[],
  parameters: readonly Row[],
  relations: readonly Row[],
  book: RateBook,
): Estimate => {
  // Area also appears as a text placeholder in PSet_Revit_Type_Other; read only the dimension set.
  const quantities = parametersByElement(
    parameters.filter((p) => p.ParameterGroup === QUANTITY_GROUP),
    QUANTITIES,
  );
  const items = elements.filter((e) => !NOT_ITEMS.has(String(e.Category))).map(toElement);
  const byId = new Map(items.map((e) => [e.id, e]));
  const parentOf = new Map<number, Element>();
  for (const r of relations) {
    if (r.RelationType !== 'MemberOf') continue;
    const part = byId.get(Number(r.EntityIndexA));
    const whole = byId.get(Number(r.EntityIndexB));
    if (part && whole) parentOf.set(part.id, whole);
  }
  const rates = book.rates.map((rate) => ({ rate, pattern: new RegExp(rate.typePattern) }));
  const ifcClassOf = new Map(elements.map((e) => [Number(e.EntityIndex), String(e.Category)]));

  const priced: PricedItem[] = [];
  const unpriced: UnpricedItem[] = [];
  const included: IncludedPart[] = [];
  for (const el of items) {
    const parent = parentOf.get(el.id);
    if (parent) {
      included.push({ ...el, partOf: parent.class });
      continue;
    }
    const ifcClass = ifcClassOf.get(el.id)!;
    const match = rates.find((r) => r.rate.ifcClasses.includes(ifcClass) && r.pattern.test(el.type));
    if (!match) {
      unpriced.push({ ...el, reason: 'no rate' });
      continue;
    }
    const { rate } = match;
    const quantity = rate.measure === 'Count' ? 1 : quantities.get(el.id)?.[rate.measure];
    if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
      unpriced.push({ ...el, reason: 'no quantity' });
      continue;
    }
    priced.push({ ...el, rate, quantity, base: quantity * rate.base, ve: quantity * rate.ve });
  }

  return {
    priced,
    unpriced,
    included,
    storeys: storeyOrder(elements, parameters, items),
    base: sum(priced.map((p) => p.base)),
    ve: sum(priced.map((p) => p.ve)),
  };
};

const toElement = (e: Row): Element => ({
  id: Number(e.EntityIndex),
  class: readableClass(String(e.Category)),
  type: typeName(String(e.Name)),
  storey: e.StoreyName === null || e.StoreyName === undefined ? NO_STOREY : String(e.StoreyName),
});

const storeyOrder = (elements: readonly Row[], parameters: readonly Row[], items: readonly Element[]): string[] => {
  const elevation = parametersByElement(parameters, ['Ifc:Elevation']);
  const storeys = elements
    .filter((e) => e.Category === 'IFCBUILDINGSTOREY')
    .map((e) => ({ name: String(e.Name), z: elevation.get(Number(e.EntityIndex))?.['Ifc:Elevation'] }))
    .sort((a, b) => Number(b.z ?? -Infinity) - Number(a.z ?? -Infinity))
    .map((s) => s.name);
  return items.some((e) => e.storey === NO_STOREY) ? [...storeys, NO_STOREY] : storeys;
};

const sum = (xs: readonly number[]): number => xs.reduce((t, x) => t + x, 0);

/** Groups `xs` by `key` into a map in first-seen order. */
const groupBy = <T>(xs: readonly T[], key: (x: T) => string): Map<string, T[]> => {
  const out = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const group = out.get(k);
    if (group) group.push(x);
    else out.set(k, [x]);
  }
  return out;
};

/** The two scenarios as they are labelled on the charts. */
export const SCENARIOS = ['Base', 'VE'] as const;

/** One row per storey, scenario, and class: the cost and the number of elements priced. */
export const costRows = (est: Estimate): Row[] =>
  [...groupBy(est.priced, (p) => `${p.storey}\u0000${p.class}`).values()].flatMap((group) => {
    const { storey, class: cls } = group[0]!;
    return [
      { storey, scenario: 'Base', class: cls, cost: sum(group.map((p) => p.base)), items: group.length },
      { storey, scenario: 'VE', class: cls, cost: sum(group.map((p) => p.ve)), items: group.length },
    ];
  });

/** One row per class: Base and VE cost and the saving, largest saving first. */
export const savingRows = (est: Estimate): Row[] =>
  [...groupBy(est.priced, (p) => p.class).entries()]
    .map(([cls, group]) => {
      const base = sum(group.map((p) => p.base));
      const ve = sum(group.map((p) => p.ve));
      return { class: cls, base, ve, saving: base - ve, share: (base - ve) / base };
    })
    .sort((a, b) => b.saving - a.saving);

/** One row per class and reason: how many elements are unpriced and which types they are. */
export const unpricedRows = (est: Estimate): Row[] =>
  [...groupBy(est.unpriced, (u) => `${u.class}\u0000${u.reason}`).values()].map((group) => ({
    class: group[0]!.class,
    reason: group[0]!.reason,
    count: group.length,
    types: [...new Set(group.map((u) => u.type))].join('; '),
  }));

/** Base and VE totals per storey, in storey order. */
export const storeyTotals = (est: Estimate): { storey: string; base: number; ve: number }[] =>
  est.storeys.map((storey) => {
    const on = est.priced.filter((p) => p.storey === storey);
    return { storey, base: sum(on.map((p) => p.base)), ve: sum(on.map((p) => p.ve)) };
  });

/** The measure each priced class was quantified by, e.g. { Wall: 'Area (m²)' }, for the caption. */
export const measuresByClass = (est: Estimate): Map<string, string> => {
  const out = new Map<string, string>();
  for (const p of est.priced) {
    const label = p.rate.measure === 'Count' ? 'count' : `${p.rate.measure} (${p.rate.unit})`;
    const seen = out.get(p.class);
    if (seen === undefined) out.set(p.class, label);
    else if (!seen.split(', ').includes(label)) out.set(p.class, `${seen}, ${label}`);
  }
  return out;
};
