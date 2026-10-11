// Element mix by storey: how many elements of each IFC class every storey of
// the Duplex holds, as counts and as shares, so a BIM manager can see what a
// storey is made of and whether anything sits outside every storey.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadTable, parametersByElement } from '../../src/data';
import type { DemoManifest } from '../../src/manifest';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const ELEMENTS = '/data/duplex/elements.json';
const PARAMETERS = '/data/duplex/parameters.json';

/** The storey label for an element the model places in no storey. */
export const NO_STOREY = 'no storey';

/** Rows that are the spatial structure itself, not elements in it. */
const SPATIAL: ReadonlySet<string> = new Set(['IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY']);

/** Openings are voids cut into walls and slabs, so they are counted apart and not drawn. */
const OPENING = 'IFCOPENINGELEMENT';

/** Readable names, in the order the legend and the stack show them: structure, envelope, circulation, fit-out, rooms. */
const CLASS_NAMES: readonly (readonly [string, string])[] = [
  ['IFCFOOTING', 'Footing'],
  ['IFCSLAB', 'Slab'],
  ['IFCWALLSTANDARDCASE', 'Wall'],
  ['IFCWALL', 'Wall (other)'],
  ['IFCBEAM', 'Beam'],
  ['IFCMEMBER', 'Member'],
  ['IFCROOF', 'Roof'],
  ['IFCDOOR', 'Door'],
  ['IFCWINDOW', 'Window'],
  ['IFCSTAIR', 'Stair'],
  ['IFCSTAIRFLIGHT', 'Stair flight'],
  ['IFCRAILING', 'Railing'],
  ['IFCCOVERING', 'Covering'],
  ['IFCFURNISHINGELEMENT', 'Furniture'],
  ['IFCSPACE', 'Space'],
];
const NAME_OF = new Map(CLASS_NAMES);

/** IFCWALLSTANDARDCASE -> Wall; a class not in the list loses its IFC prefix: IFCPLATE -> Plate. */
export const className = (ifcClass: string): string =>
  NAME_OF.get(ifcClass) ?? ifcClass.replace(/^IFC/, '').replace(/^(.)(.*)$/, (_, a: string, b: string) => a + b.toLowerCase());

/** What the figures draw and the caption reports. */
export interface ElementMix {
  /** One row per storey and class: storey, elevation (m, null for no storey), class, ifcClass, count, share of the storey. */
  readonly rows: Row[];
  /** Storeys from the highest elevation down; storeys with no elevation after them; "no storey" last when it has elements. */
  readonly storeys: string[];
  /** Readable class names in legend order. */
  readonly classes: string[];
  /** Elements drawn: every row that is neither spatial structure nor an opening. */
  readonly total: number;
  /** Elements drawn whose StoreyName is null. */
  readonly noStorey: number;
  /** Openings left out of the figures, and how many of them have no storey. */
  readonly openings: number;
  readonly openingsWithoutStorey: number;
}

/** Counts elements per storey and class from the elements and parameters extracts. */
export const elementMix = (elements: readonly Row[], parameters: readonly Row[]): ElementMix => {
  const levels = parametersByElement(parameters, ['Ifc:Elevation']);
  const elevation = new Map<string, number | null>();
  for (const e of elements)
    if (e.Category === 'IFCBUILDINGSTOREY') {
      const v = levels.get(Number(e.EntityIndex))?.['Ifc:Elevation'];
      elevation.set(String(e.Name), typeof v === 'number' ? v : null);
    }

  const counts = new Map<string, Map<string, number>>();
  let openings = 0;
  let openingsWithoutStorey = 0;
  for (const e of elements) {
    const ifcClass = String(e.Category);
    if (SPATIAL.has(ifcClass)) continue;
    if (ifcClass === OPENING) {
      openings += 1;
      if (e.StoreyName == null) openingsWithoutStorey += 1;
      continue;
    }
    const storey = e.StoreyName == null ? NO_STOREY : String(e.StoreyName);
    const byClass = counts.get(storey) ?? new Map<string, number>();
    byClass.set(ifcClass, (byClass.get(ifcClass) ?? 0) + 1);
    counts.set(storey, byClass);
  }

  const rank = (s: string) => (s === NO_STOREY ? 2 : elevation.get(s) == null ? 1 : 0);
  const storeys = [...counts.keys()].sort(
    (a, b) => rank(a) - rank(b) || (elevation.get(b) ?? 0) - (elevation.get(a) ?? 0) || a.localeCompare(b),
  );
  const present = new Set([...counts.values()].flatMap((m) => [...m.keys()]));
  const known = CLASS_NAMES.map(([c]) => c).filter((c) => present.has(c));
  const unknown = [...present].filter((c) => !NAME_OF.has(c)).sort();
  const order = [...known, ...unknown];

  const rows: Row[] = [];
  for (const storey of storeys) {
    const byClass = counts.get(storey)!;
    const storeyTotal = [...byClass.values()].reduce((s, n) => s + n, 0);
    for (const ifcClass of order) {
      const count = byClass.get(ifcClass);
      if (count === undefined) continue;
      rows.push({
        storey,
        elevation: elevation.get(storey) ?? null,
        class: className(ifcClass),
        ifcClass,
        order: order.indexOf(ifcClass),
        count,
        share: count / storeyTotal,
      });
    }
  }
  const total = rows.reduce((s, r) => s + Number(r.count), 0);
  const noStorey = rows.filter((r) => r.storey === NO_STOREY).reduce((s, r) => s + Number(r.count), 0);
  return { rows, storeys, classes: order.map(className), total, noStorey, openings, openingsWithoutStorey };
};

const loadMix = async (elementsUrl: string, parametersUrl: string): Promise<ElementMix> =>
  elementMix(await loadTable(elementsUrl), await loadTable(parametersUrl));

/** The two figures: counts, and the same counts normalised to 100 % per storey. */
const VIEWS = [
  { stack: true, title: 'Elements per storey, by class', subtitle: 'Duplex Apartment, element count', axis: 'Elements', format: 'd' },
  { stack: 'normalize', title: 'Class mix per storey', subtitle: 'Duplex Apartment, share of each storey', axis: 'Share of storey', format: '.0%' },
] as const;

const spec = (view: (typeof VIEWS)[number], mix: ElementMix, width: number | 'container'): TopLevelSpec => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: { text: view.title, subtitle: view.subtitle },
  width,
  height: 36 * mix.storeys.length,
  mark: { type: 'bar', stroke: '#ffffff', strokeWidth: 0.5 },
  encoding: {
    y: { field: 'storey', type: 'nominal', title: null, sort: mix.storeys },
    x: { field: 'count', type: 'quantitative', title: view.axis, stack: view.stack, axis: { format: view.format } },
    // The brand palette has eight colours and the Duplex has up to fifteen classes, so a twenty-colour scheme keeps them apart.
    color: { field: 'class', type: 'nominal', title: 'Class', sort: mix.classes, scale: { scheme: 'tableau20' } },
    order: { field: 'order', type: 'quantitative' },
    tooltip: [
      { field: 'class', title: 'Class' },
      { field: 'ifcClass', title: 'IFC class' },
      { field: 'storey', title: 'Storey' },
      { field: 'count', title: 'Count' },
      { field: 'share', title: 'Share of storey', format: '.1%' },
    ],
  },
});

const caption = (mix: ElementMix): string =>
  `${mix.total} elements in ${mix.storeys.filter((s) => s !== NO_STOREY).length} storeys; ` +
  `${mix.noStorey} ${mix.noStorey === 1 ? 'has' : 'have'} no storey` +
  (mix.noStorey > 0 ? ' and appear in the "no storey" row' : '') +
  `. Storeys are ordered by Ifc:Elevation, highest first. ` +
  `${mix.openings} openings (IfcOpeningElement, ${mix.openingsWithoutStorey} of them with no storey) are left out: ` +
  `they are voids cut into walls and slabs, not elements. Project, site, building, and storey rows are the spatial structure and are not counted. ` +
  `"Wall" is IfcWallStandardCase and "Wall (other)" is IfcWall.`;

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts…');
    const mix = await loadMix(dataUrl(ELEMENTS), dataUrl(PARAMETERS));
    page.status('');
    for (const view of VIEWS) {
      const el = root.ownerDocument.createElement('div');
      page.figure.appendChild(el);
      await renderVegaLite(el, spec(view, mix, 'container'), mix.rows);
    }
    page.caption(caption(mix));
  },
  async headless(paths): Promise<HeadlessView[]> {
    const mix = await loadMix(resolveDataPath(ELEMENTS, paths), resolveDataPath(PARAMETERS, paths));
    return Promise.all(
      VIEWS.map(async (view) => ({
        kind: 'chart' as const,
        title: view.title,
        rows: mix.rows.length,
        svg: await vegaLiteToSvg(spec(view, mix, 640), mix.rows),
      })),
    );
  },
};
