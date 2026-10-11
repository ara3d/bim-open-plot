// Federated model diff: per IFC class, how many objects the Duplex
// architecture extract holds and how many the federated model (architecture,
// MEP, electrical, rooms and spaces in one file) adds, which classes only one
// side has, and whether every architecture element is still there by id.
// The comparison is computed here on every load; no file stores it.

import type { TopLevelSpec } from 'vega-lite';
import type { LoadedModel } from '@bim-open-viewer/formats';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadTable } from '../../src/data';
import { loadModelHeadless } from '../../src/scene';
import { series, tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const ELEMENTS = '/data/duplex/elements.json';
const MODEL = '/models/duplex-federated.bos';

/** The federated model's document that came from the architecture IFC (Duplex_A_20110907.ifc). */
const ARCHITECTURE_DOCUMENT = /^Duplex_A_/;

/** The class label for an object whose file names no class. */
export const NO_CLASS = 'NO CLASS';

/** Class names are compared upper-cased: the extracts spell IFCWALLSTANDARDCASE, a BOS may spell IfcWallStandardCase. */
const normalise = (category: unknown): string =>
  category === null || category === undefined ? NO_CLASS : String(category).toUpperCase();

/** One IFC class on both sides. */
export interface ClassCount {
  readonly ifcClass: string;
  readonly architecture: number;
  readonly federated: number;
}

/** How the architecture extract's elements are found again in the federated model, by STEP id. */
export interface IdMatch {
  /** Title of the federated model's architecture document, the only one STEP ids are compared in. */
  readonly document: string;
  readonly architecture: number;
  /** Extract rows whose STEP id is an object of the architecture document. */
  readonly matched: number;
  /** Of those, the ones whose class agrees after upper-casing. */
  readonly sameClass: number;
  /** Extract STEP ids that another discipline file also uses, for a different entity. */
  readonly reusedElsewhere: number;
}

/** What the three figures draw and the caption reports. */
export interface ModelDiff {
  /** Every class on either side, the federated model's largest first. */
  readonly classes: readonly ClassCount[];
  readonly architectureTotal: number;
  /** Objects in the federated model that are compared: drawn, or of a class the extract lists. */
  readonly federatedTotal: number;
  /** Every object in the federated file, types, geometry items, and styles included. */
  readonly federatedObjects: number;
  /** Class names, over both sides, that upper-casing changed. */
  readonly respelled: number;
  /** Null when the federated model records no document titled Duplex_A_*. */
  readonly idMatch: IdMatch | null;
}

const countBy = <T>(items: readonly T[], key: (item: T) => string): Map<string, number> => {
  const out = new Map<string, number>();
  for (const item of items) out.set(key(item), (out.get(key(item)) ?? 0) + 1);
  return out;
};

const respelledCount = (names: readonly unknown[]): number =>
  names.filter((n) => typeof n === 'string' && n !== n.toUpperCase()).length;

/**
 * Compares the architecture extract with the federated model per class and by STEP id.
 * The extract lists IFC products only, so the federated side keeps the objects that are
 * drawn (have a representation) or belong to a class the extract lists (spatial structure,
 * openings, and aggregates such as IFCROOF, which carry no geometry of their own); type
 * objects, geometry items, materials, and styles are left out.
 */
export const compareModels = (elements: readonly Row[], loaded: LoadedModel): ModelDiff => {
  const objects = loaded.data.objects;
  const architecture = countBy(elements, (e) => normalise(e.Category));
  const compared = objects.filter((o) => o.representation !== undefined || architecture.has(normalise(o.category)));
  const federated = countBy(compared, (o) => normalise(o.category));
  const classes = [...new Set([...architecture.keys(), ...federated.keys()])]
    .map((ifcClass) => ({ ifcClass, architecture: architecture.get(ifcClass) ?? 0, federated: federated.get(ifcClass) ?? 0 }))
    .sort((a, b) => b.federated - a.federated || b.architecture - a.architecture || a.ifcClass.localeCompare(b.ifcClass));
  return {
    classes,
    architectureTotal: elements.length,
    federatedTotal: compared.length,
    federatedObjects: objects.length,
    respelled: respelledCount(elements.map((e) => e.Category)) + respelledCount(compared.map((o) => o.category)),
    idMatch: matchByStepId(elements, loaded),
  };
};

const matchByStepId = (elements: readonly Row[], loaded: LoadedModel): IdMatch | null => {
  const documents = loaded.documents;
  const archIndex = documents?.title.findIndex((t) => ARCHITECTURE_DOCUMENT.test(t ?? '')) ?? -1;
  if (!documents || archIndex < 0) return null;
  const inArchitecture = new Map<number, string>();
  const elsewhere = new Set<number>();
  loaded.data.objects.forEach((o, row) => {
    const step = Number(o.sourceId);
    if (o.sourceId === undefined || !Number.isFinite(step)) return;
    if (documents.ofObject[row] === archIndex) inArchitecture.set(step, normalise(o.category));
    else elsewhere.add(step);
  });
  let matched = 0;
  let sameClass = 0;
  let reusedElsewhere = 0;
  for (const e of elements) {
    const step = Number(e.StepId);
    const found = inArchitecture.get(step);
    if (found !== undefined) {
      matched += 1;
      if (found === normalise(e.Category)) sameClass += 1;
    }
    if (elsewhere.has(step)) reusedElsewhere += 1;
  }
  return { document: documents.title[archIndex] ?? '', architecture: elements.length, matched, sameClass, reusedElsewhere };
};

const ADDED = 'Added by the other disciplines';
const FEWER = 'Fewer in the federated model (flag)';
const IN_ARCH = 'In the architecture extract';

/** Figure 1 rows: one per class; `left` is the architecture count drawn leftwards, `delta` is federated minus architecture. */
export const divergingRows = (diff: ModelDiff): Row[] =>
  diff.classes.map((c, order) => {
    const delta = c.federated - c.architecture;
    return {
      ifcClass: c.ifcClass,
      order,
      left: -c.architecture,
      delta,
      labelAt: Math.max(delta, 0),
      label: delta > 0 ? `+${delta}` : delta < 0 ? `${delta} missing` : '0',
    };
  });

/** Figure 2 rows: classes that only one side has, largest first. */
export const oneSidedRows = (diff: ModelDiff): Row[] =>
  diff.classes
    .flatMap((c) =>
      c.architecture === 0
        ? [{ ifcClass: c.ifcClass, side: 'Only in the federated model', count: c.federated }]
        : c.federated === 0
          ? [{ ifcClass: c.ifcClass, side: 'Only in the architecture extract', count: c.architecture }]
          : [],
    )
    .sort((a, b) => b.count - a.count || a.ifcClass.localeCompare(b.ifcClass))
    .map((r, order) => ({ ...r, order }));

/** Figure 3 rows: the STEP id match, as counts of architecture elements. */
export const idMatchRows = (m: IdMatch): Row[] => [
  { measure: 'Elements in the architecture extract', count: m.architecture, order: 0 },
  { measure: `Matched by STEP id in ${m.document}`, count: m.matched, order: 1 },
  { measure: 'Matched with the same class', count: m.sameClass, order: 2 },
  { measure: 'Same STEP id used by another discipline file', count: m.reusedElsewhere, order: 3 },
];

const byOrder = { field: 'order', op: 'min', order: 'ascending' } as const;

const divergingSpec: TopLevelSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by divergingRows at render time
  title: {
    text: 'Objects per IFC class: architecture extract and what federation adds',
    subtitle: 'Duplex Apartment; left: count in the architecture extract; right: federated minus architecture',
  },
  width: 'container',
  height: { step: 18 },
  encoding: {
    y: { field: 'ifcClass', type: 'nominal', title: null, sort: byOrder, axis: { labelLimit: 240 } },
  },
  layer: [
    {
      transform: [
        { fold: ['left', 'delta'], as: ['series', 'value'] },
        { calculate: `datum.series === 'left' ? '${IN_ARCH}' : datum.value < 0 ? '${FEWER}' : '${ADDED}'`, as: 'segment' },
      ],
      mark: 'bar',
      encoding: {
        x: {
          field: 'value',
          type: 'quantitative',
          stack: null,
          title: '← objects in the architecture extract · objects added by federation →',
          axis: { labelExpr: 'abs(datum.value)' },
        },
        color: {
          field: 'segment',
          type: 'nominal',
          title: null,
          scale: { domain: [IN_ARCH, ADDED, FEWER], range: [series[0]!, series[1]!, tokens.error] },
          legend: { orient: 'top', labelLimit: 320 },
        },
        tooltip: [{ field: 'ifcClass', title: 'Class' }, { field: 'segment' }, { field: 'value', title: 'Signed count' }],
      },
    },
    {
      mark: { type: 'text', align: 'left', dx: 4, fontSize: 10 },
      encoding: {
        x: { field: 'labelAt', type: 'quantitative' },
        text: { field: 'label' },
        color: { condition: { test: 'datum.delta < 0', value: tokens.error }, value: tokens.dim },
      },
    },
  ],
};

const oneSidedSpec: TopLevelSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by oneSidedRows at render time
  title: { text: 'Classes present on one side only', subtitle: 'Objects per class, largest first' },
  width: 'container',
  height: { step: 20 },
  encoding: {
    y: { field: 'ifcClass', type: 'nominal', title: null, sort: byOrder, axis: { labelLimit: 240 } },
    x: { field: 'count', type: 'quantitative', title: 'Objects' },
  },
  layer: [
    {
      mark: 'bar',
      encoding: {
        color: {
          field: 'side',
          type: 'nominal',
          title: null,
          scale: { domain: ['Only in the federated model', 'Only in the architecture extract'], range: [series[1]!, tokens.error] },
          legend: { orient: 'top', labelLimit: 320 },
        },
        tooltip: [{ field: 'ifcClass', title: 'Class' }, { field: 'side' }, { field: 'count' }],
      },
    },
    {
      mark: { type: 'text', align: 'left', dx: 4, fontSize: 10, color: tokens.dim },
      encoding: { text: { field: 'count' } },
    },
  ],
};

const idMatchSpec: TopLevelSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by idMatchRows at render time
  title: { text: 'Architecture elements found again in the federated model', subtitle: 'Matched by STEP id inside the architecture document' },
  width: 'container',
  height: { step: 24 },
  encoding: {
    y: { field: 'measure', type: 'nominal', title: null, sort: byOrder, axis: { labelLimit: 360 } },
    x: { field: 'count', type: 'quantitative', title: 'Elements' },
  },
  layer: [
    { mark: 'bar', encoding: { tooltip: [{ field: 'measure' }, { field: 'count' }] } },
    { mark: { type: 'text', align: 'left', dx: 4, fontSize: 10, color: tokens.dim }, encoding: { text: { field: 'count' } } },
  ],
};

/** The caption: what was compared, by which identifier, and the normalisation. */
export const captionOf = (diff: ModelDiff): string => {
  const fewer = diff.classes.filter((c) => c.federated < c.architecture);
  const archOnly = diff.classes.filter((c) => c.federated === 0 && c.architecture > 0);
  const fedOnly = diff.classes.filter((c) => c.architecture === 0);
  const id = diff.idMatch;
  const missing =
    fewer.length === 0
      ? 'No class has fewer objects in the federated model, and no class is only in the architecture extract.'
      : `Flagged: ${fewer.map((c) => `${c.ifcClass} (${c.federated - c.architecture})`).join(', ')} have fewer objects in the federated model; ${archOnly.length} class(es) are only in the architecture extract.`;
  const idText = id
    ? `Identity: the BOS file carries no GlobalId, so elements are matched by STEP id, and only inside the federated model's architecture document (${id.document}); ${id.matched} of ${id.architecture} matched, ${id.sameClass} with the same class. ${id.reusedElsewhere} of those STEP ids are also used by another discipline file for a different entity, which is why the match is not made across the whole model.`
    : 'Identity: the federated model records no architecture document (Duplex_A_*), so no element was matched by id and the third figure is not drawn.';
  return [
    `Compared per IFC class: ${diff.architectureTotal} products in the architecture extract (elements.json, from duplex.ifc) against ${diff.federatedTotal} of the federated model's ${diff.federatedObjects} objects, those that are drawn or belong to a class the extract lists; type objects, geometry items, materials, and styles in the BOS are left out.`,
    `Class names are upper-cased on both sides before comparing (${diff.respelled} spellings changed). ${fedOnly.length} classes come only from the other disciplines. Each discipline file brings its own project, site, building, and storeys, and nothing was merged, so those count as added.`,
    missing,
    idText,
  ].join(' ');
};

const load = (elementsSource: string, modelSource: string): Promise<[Row[], LoadedModel]> =>
  Promise.all([loadTable(elementsSource), loadModelHeadless(modelSource)]);

const figures = (diff: ModelDiff): { title: string; spec: TopLevelSpec; rows: Row[] }[] => [
  { title: 'Objects per IFC class, architecture vs added by federation', spec: divergingSpec, rows: divergingRows(diff) },
  { title: 'Classes present on one side only', spec: oneSidedSpec, rows: oneSidedRows(diff) },
  ...(diff.idMatch ? [{ title: 'Architecture elements matched by STEP id', spec: idMatchSpec, rows: idMatchRows(diff.idMatch) }] : []),
];

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the architecture extract and the federated model…');
    try {
      const [elements, loaded] = await load(dataUrl(ELEMENTS), dataUrl(MODEL));
      const diff = compareModels(elements, loaded);
      page.status('');
      for (const f of figures(diff)) {
        const el = root.ownerDocument.createElement('div');
        el.style.marginBottom = '24px';
        page.figure.appendChild(el);
        await renderVegaLite(el, f.spec, f.rows);
      }
      page.caption(captionOf(diff));
    } catch (error) {
      page.status(`Could not load the data: ${(error as Error).message}`, true);
    }
  },
  async headless(paths): Promise<HeadlessView[]> {
    const [elements, loaded] = await load(resolveDataPath(ELEMENTS, paths), resolveDataPath(MODEL, paths));
    const diff = compareModels(elements, loaded);
    return Promise.all(
      figures(diff).map(async (f) => ({
        kind: 'chart' as const,
        title: f.title,
        rows: f.rows.length,
        svg: await vegaLiteToSvg({ ...f.spec, width: 640 } as TopLevelSpec, f.rows),
      })),
    );
  },
};
