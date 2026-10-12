// Parameter completeness: for each product class of the Duplex and each
// parameter, the share of the class's elements that carry a real value.
// A heat map of class × parameter and a bar of the overall rate per class.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadTable } from '../../src/data';
import type { DemoManifest } from '../../src/manifest';
import { tokens } from '../../src/theme';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const ELEMENTS = '/data/duplex/elements.json';
const PARAMETERS = '/data/duplex/parameters.json';

/** Classes that are not delivered products: the spatial structure and the voids cut by openings. */
const NOT_PRODUCTS: ReadonlySet<string> = new Set(['IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCOPENINGELEMENT']);

/** How many of the most-filled parameters the heat map shows before the curated ones are added. */
const TOP = 25;

/** Parameter names a reviewer checks at handover, shown whenever they occur on a product class. */
const CURATED: readonly RegExp[] = [
  /fire\s*rating/i,
  /^IsExternal$/,
  /^LoadBearing$/,
  /^Ifc:Overall(Width|Height)$/,
  /^(Area|Volume|Length)$/,
  /material/i,
];

/** One cell: a parameter that occurs on a class, and how many of the class's elements fill it. */
export interface Cell {
  readonly ifcClass: string;
  readonly parameter: string;
  readonly filled: number;
  readonly elements: number;
}

export interface Completeness {
  /** Product classes with their element counts, most elements first. */
  readonly classes: readonly { readonly ifcClass: string; readonly elements: number }[];
  /** The parameters the heat map shows, grouped by property set. */
  readonly shown: readonly string[];
  /** Every (class, parameter) pair where the parameter occurs on the class; absent pairs are "not applicable". */
  readonly cells: readonly Cell[];
  readonly elementCount: number;
  readonly parameterRows: number;
  readonly emptyRows: number;
  readonly placeholderRows: number;
}

/**
 * The column a parameter row belongs to: "PropertySet.Name", except an IFC
 * attribute (its group is the class itself) is its bare name, and the
 * class-specific common sets (Pset_DoorCommon, Pset_WallCommon) share one
 * column, "Pset_*Common.Name", so FireRating or IsExternal reads across classes.
 */
export const parameterKey = (group: string, name: string, ifcClass: string): string =>
  group === ifcClass ? name : /^Pset_\w+Common$/.test(group) ? `Pset_*Common.${name}` : `${group}.${name}`;

/**
 * A value that counts as filled: not empty, and not the parameter's own name.
 * Revit's COBie template fills fields such as Material or AssetIdentifier with
 * their own name until someone types a real value; that is a placeholder.
 * Names compare without case, spaces, or punctuation, so FireRating = "Fire Rating" is one too.
 */
const valueState = (value: unknown, name: string): 'filled' | 'empty' | 'placeholder' => {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text === '' ? 'empty' : squash(text) === squash(name) ? 'placeholder' : 'filled';
};

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Fill counts per class and parameter from the two extracts. */
export const completeness = (elements: readonly Row[], parameters: readonly Row[]): Completeness => {
  const classOf = new Map<number, string>();
  const classSize = new Map<string, number>();
  for (const e of elements) {
    const c = String(e.Category);
    if (NOT_PRODUCTS.has(c)) continue;
    classOf.set(Number(e.EntityIndex), c);
    classSize.set(c, (classSize.get(c) ?? 0) + 1);
  }

  // class -> key -> { carriers, fillers } as element sets, so two rows of one element count once.
  const occur = new Map<string, Map<string, { carriers: Set<number>; fillers: Set<number> }>>();
  const nameOf = new Map<string, string>();
  let emptyRows = 0;
  let placeholderRows = 0;
  for (const p of parameters) {
    const id = Number(p.EntityIndex);
    const c = classOf.get(id);
    if (c === undefined) continue;
    const name = String(p.Name);
    const key = parameterKey(String(p.ParameterGroup), name, c);
    nameOf.set(key, name);
    const byKey = occur.get(c) ?? new Map();
    occur.set(c, byKey);
    const entry = byKey.get(key) ?? { carriers: new Set<number>(), fillers: new Set<number>() };
    byKey.set(key, entry);
    entry.carriers.add(id);
    const state = valueState(p.Value, name);
    if (state === 'filled') entry.fillers.add(id);
    else if (state === 'empty') emptyRows += 1;
    else placeholderRows += 1;
  }

  const cells: Cell[] = [];
  for (const [ifcClass, byKey] of occur)
    for (const [parameter, { fillers }] of byKey)
      cells.push({ ifcClass, parameter, filled: fillers.size, elements: classSize.get(ifcClass) ?? 0 });

  const populated = new Map<string, number>();
  for (const cell of cells) populated.set(cell.parameter, (populated.get(cell.parameter) ?? 0) + cell.filled);
  const ranked = [...populated].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
  const curated = ranked.filter((k) => CURATED.some((re) => re.test(nameOf.get(k) ?? '')));
  const shown = [...new Set([...ranked.slice(0, TOP), ...curated])].sort((a, b) => a.localeCompare(b));

  return {
    classes: [...classSize]
      .map(([ifcClass, n]) => ({ ifcClass, elements: n }))
      .sort((a, b) => b.elements - a.elements || a.ifcClass.localeCompare(b.ifcClass)),
    shown,
    cells,
    elementCount: classOf.size,
    parameterRows: parameters.filter((p) => classOf.has(Number(p.EntityIndex))).length,
    emptyRows,
    placeholderRows,
  };
};

/** "57%" for a rate, never rounding a partial fill up to 100% or down to 0%. */
const percentLabel = (filled: number, total: number): string => {
  if (filled === total) return '100%';
  if (filled === 0) return '0%';
  return `${Math.min(99, Math.max(1, Math.round((100 * filled) / total)))}%`;
};

const classLabel = (c: { ifcClass: string; elements: number }) => `${c.ifcClass} (${c.elements})`;

/** Heat-map rows: one per shown parameter that occurs on a class. */
export const heatRows = (r: Completeness): Row[] => {
  const shown = new Set(r.shown);
  const size = new Map(r.classes.map((c) => [c.ifcClass, c]));
  return r.cells
    .filter((c) => shown.has(c.parameter))
    .map((c) => ({
      ifcClass: classLabel(size.get(c.ifcClass)!),
      parameter: c.parameter,
      rate: c.filled / c.elements,
      label: percentLabel(c.filled, c.elements),
      count: `${c.filled} of ${c.elements}`,
    }));
};

/**
 * Bar rows: per class, filled (element, parameter) pairs over every pair
 * where the parameter occurs on the class, across all parameters, not only
 * the shown ones. A class that carries no parameter at all has no rate.
 */
export const classRows = (r: Completeness): Row[] =>
  r.classes.map((c) => {
    const mine = r.cells.filter((cell) => cell.ifcClass === c.ifcClass);
    const filled = mine.reduce((s, cell) => s + cell.filled, 0);
    const pairs = mine.length * c.elements;
    return {
      ifcClass: classLabel(c),
      rate: pairs === 0 ? null : filled / pairs,
      label: pairs === 0 ? 'no parameters' : `${percentLabel(filled, pairs)} of ${mine.length} parameters`,
    };
  });

const heatSpec = (r: Completeness, width: number | 'container'): TopLevelSpec => {
  const x = { field: 'ifcClass', type: 'nominal' as const, title: 'IFC class (elements)', sort: r.classes.map(classLabel), axis: { orient: 'top' as const, labelAngle: -40, labelLimit: 0 } };
  const y = { field: 'parameter', type: 'nominal' as const, title: null, sort: r.shown as string[], axis: { labelLimit: 0 } };
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    data: { values: [] }, // replaced by the rows at render time
    title: {
      text: 'Fill rate by class and parameter',
      subtitle: 'Share of the class’s elements with a real value. Blank: the parameter does not occur on that class.',
    },
    width,
    height: { step: 16 },
    encoding: { x, y },
    layer: [
      {
        mark: { type: 'rect', stroke: tokens.surface, strokeWidth: 1 },
        encoding: {
          // Quantitative colour on a rect takes the config's range.heatmap (the theme's `heat`).
          color: { field: 'rate', type: 'quantitative', title: 'Fill rate', scale: { domain: [0, 1] }, legend: { format: '.0%' } },
          tooltip: [{ field: 'ifcClass', title: 'Class' }, { field: 'parameter', title: 'Parameter' }, { field: 'count', title: 'Filled' }],
        },
      },
      {
        mark: { type: 'text', fontSize: 9 },
        encoding: {
          text: { field: 'label' },
          color: { condition: { test: 'datum.rate > 0.6', value: tokens.surface }, value: tokens.text },
        },
      },
    ],
  } as TopLevelSpec;
};

const barSpec = (r: Completeness, width: number | 'container'): TopLevelSpec =>
  ({
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    data: { values: [] },
    title: {
      text: 'Overall fill rate by class',
      subtitle: 'Over every parameter that occurs on the class, not only those in the heat map',
    },
    width,
    height: { step: 20 },
    encoding: {
      y: { field: 'ifcClass', type: 'nominal', title: null, sort: r.classes.map(classLabel), axis: { labelLimit: 0 } },
    },
    layer: [
      {
        mark: 'bar',
        encoding: { x: { field: 'rate', type: 'quantitative', title: 'Fill rate', scale: { domain: [0, 1] }, axis: { format: '.0%' } } },
      },
      {
        // The label sits after the bar; a class with no rate gets it at 0.
        transform: [{ calculate: 'datum.rate === null ? 0 : datum.rate', as: 'labelAt' }],
        mark: { type: 'text', align: 'left', dx: 4, color: tokens.dim },
        encoding: { x: { field: 'labelAt', type: 'quantitative' }, text: { field: 'label' } },
      },
    ],
  }) as TopLevelSpec;

const caption = (r: Completeness): string =>
  `Read ${r.elementCount} product elements in ${r.classes.length} classes and their ${r.parameterRows.toLocaleString('en')} parameter rows. ` +
  `The heat map shows the ${TOP} most-filled parameters plus fire rating, external, load-bearing, overall size, area, volume, length, and material parameters (${r.shown.length} in all). ` +
  `A blank cell means the parameter does not occur on that class in this export; 0% means it occurs and no element has a value. ` +
  `${r.emptyRows.toLocaleString('en')} rows with empty text and ${r.placeholderRows.toLocaleString('en')} rows whose value repeats the parameter's own name (a COBie template placeholder such as Material = "Material") count as unfilled. ` +
  `Pset_DoorCommon, Pset_WallCommon, and the other class-specific common sets share one column, Pset_*Common; Ifc: columns are IFC attributes.`;

const load = async (elementsUrl: string, parametersUrl: string): Promise<Completeness> =>
  completeness(await loadTable(elementsUrl), await loadTable(parametersUrl));

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts…');
    try {
      const r = await load(dataUrl(ELEMENTS), dataUrl(PARAMETERS));
      page.status('');
      const heat = root.ownerDocument.createElement('div');
      const bars = root.ownerDocument.createElement('div');
      bars.style.marginTop = '24px';
      page.figure.append(heat, bars);
      await renderVegaLite(heat, heatSpec(r, 'container'), heatRows(r));
      await renderVegaLite(bars, barSpec(r, 'container'), classRows(r));
      page.caption(caption(r));
    } catch (err) {
      page.status(`Could not draw the demo: ${(err as Error).message}`, true);
    }
  },
  async headless(paths): Promise<HeadlessView[]> {
    const r = await load(resolveDataPath(ELEMENTS, paths), resolveDataPath(PARAMETERS, paths));
    const heat = heatRows(r);
    const bars = classRows(r);
    return [
      { kind: 'chart', title: 'Fill rate by class and parameter', rows: heat.length, svg: await vegaLiteToSvg(heatSpec(r, 640), heat) },
      { kind: 'chart', title: 'Overall fill rate by class', rows: bars.length, svg: await vegaLiteToSvg(barSpec(r, 480), bars) },
    ];
  },
};
