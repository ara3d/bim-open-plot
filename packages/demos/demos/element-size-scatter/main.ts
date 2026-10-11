// Element size outliers: every built element's volume (log scale) against
// its height, coloured by class group, with the shape saying whether the
// volume is a modelled quantity or the bounding-box volume; then the ten
// largest elements by volume. Rooms are left out: their volume is air.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadJson, loadTable, parametersByElement, type Box3, type BoundsFile } from '../../src/data';
import { SPACE, elementsWithBounds } from '../../src/building';
import type { DemoManifest } from '../../src/manifest';
import raw from './demo.json';

const manifest = raw as DemoManifest;

/** Where an element's volume comes from: the model's own quantity, or the box it sits in. */
export type VolumeSource = 'modelled' | 'box';

const SOURCE_LABEL: Readonly<Record<VolumeSource, string>> = {
  modelled: 'Modelled (PSet_Revit_Dimensions)',
  box: 'Bounding box (over-states)',
};
const SOURCE_SHAPE: Readonly<Record<VolumeSource, string>> = { modelled: 'circle', box: 'triangle-up' };
const SOURCES = Object.keys(SOURCE_LABEL) as VolumeSource[];

/**
 * IFC classes grouped so the colours fit the theme's eight-colour palette;
 * the exact class is in the tooltip. A class not listed here falls in "Other".
 * The order picks the colours: furniture, the largest group, gets slate
 * rather than the orange that sits next to the walls' ochre.
 */
const GROUP_OF: Readonly<Record<string, string>> = {
  IFCWALL: 'Walls',
  IFCWALLSTANDARDCASE: 'Walls',
  IFCSLAB: 'Slabs and roof',
  IFCROOF: 'Slabs and roof',
  IFCCOVERING: 'Coverings',
  IFCBEAM: 'Beams and footings',
  IFCFOOTING: 'Beams and footings',
  IFCDOOR: 'Doors and windows',
  IFCWINDOW: 'Doors and windows',
  IFCFURNISHINGELEMENT: 'Furniture',
  IFCSTAIRFLIGHT: 'Stairs and railings',
  IFCMEMBER: 'Stairs and railings',
  IFCRAILING: 'Stairs and railings',
};
const OTHER = 'Other';
const GROUPS = [...new Set(Object.values(GROUP_OF)), OTHER];

export interface ElementSize {
  readonly name: string;
  readonly ifcClass: string;
  readonly group: string;
  readonly storey: string;
  /** m³: the modelled Volume when the model gives one, else the box volume. */
  readonly volume: number;
  /** m: the bounding box's vertical size. */
  readonly height: number;
  readonly source: VolumeSource;
  /** m³: the box volume, kept for every element so the two can be compared. */
  readonly boxVolume: number;
}

export interface ElementSizeData {
  /** The elements drawn: a volume above zero and a finite height. */
  readonly points: readonly ElementSize[];
  /** Elements left out because their volume or height is zero or missing; a log scale cannot place them. */
  readonly leftOut: readonly { name: string; ifcClass: string }[];
  /** Rooms (IFCSPACE) with a box, not drawn. */
  readonly spaces: number;
  /** Drawn elements that share their name and box with another drawn element: an assembly and its part. */
  readonly sharedBoxes: readonly ElementSize[];
}

interface Sources {
  readonly elements: string;
  readonly parameters: string;
  readonly bounds: string;
}

const FILES: Sources = {
  elements: '/data/duplex/elements.json',
  parameters: '/data/duplex/parameters.json',
  bounds: '/data/duplex/bounds.json',
};

const mapSources = (f: (file: string) => string): Sources => ({
  elements: f(FILES.elements),
  parameters: f(FILES.parameters),
  bounds: f(FILES.bounds),
});

const boxVolume = (b: Box3): number => b.size.x * b.size.y * b.size.z;
const positive = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0;
const boxKey = (e: ElementSize, b: Box3): string =>
  [e.name, b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(String).join('|');

/** Every element with a box, sized: modelled volume where present, else box volume, and the box height. */
export const loadElementSizes = async (sources: Sources): Promise<ElementSizeData> => {
  const [elements, parameterRows, bounds] = await Promise.all([
    loadTable(sources.elements),
    loadTable(sources.parameters),
    loadJson<BoundsFile>(sources.bounds),
  ]);
  const dims = parameterRows.filter((r) => r.ParameterGroup === 'PSet_Revit_Dimensions');
  const volumes = parametersByElement(dims, ['Volume']);
  const all = elementsWithBounds(elements, bounds);
  const built = all.filter((e) => e.type !== SPACE);

  const points: ElementSize[] = [];
  const leftOut: { name: string; ifcClass: string }[] = [];
  const keys = new Map<string, ElementSize[]>();
  for (const e of built) {
    const modelled = e.entityIndex === null ? undefined : volumes.get(e.entityIndex)?.Volume;
    const hasModelled = typeof modelled === 'number';
    const volume = hasModelled ? modelled : boxVolume(e.box);
    const height = e.box.size.z;
    if (!positive(volume) || !Number.isFinite(height)) {
      leftOut.push({ name: e.name, ifcClass: e.type });
      continue;
    }
    const point: ElementSize = {
      name: e.name,
      ifcClass: e.type,
      group: GROUP_OF[e.type] ?? OTHER,
      storey: e.storey ?? 'no storey',
      volume,
      height,
      source: hasModelled ? 'modelled' : 'box',
      boxVolume: boxVolume(e.box),
    };
    points.push(point);
    const key = boxKey(point, e.box);
    keys.set(key, [...(keys.get(key) ?? []), point]);
  }
  const sharedBoxes = [...keys.values()].filter((g) => g.length > 1).flat();
  return { points, leftOut, spaces: all.length - built.length, sharedBoxes };
};

/** The ten largest drawn elements by volume, largest first. */
export const largest = (points: readonly ElementSize[], n = 10): ElementSize[] =>
  [...points].sort((a, b) => b.volume - a.volume).slice(0, n);

/**
 * Revit names are "Family:Type:...:ElementId", and a stair's parts add a
 * sub-index ("...:151086:1"); the type and the numeric parts tell two
 * elements apart.
 */
const shortName = (name: string): string => {
  const parts = name.split(':');
  const ids = parts.slice(2).filter((p) => /^\d+$/.test(p));
  return parts.length >= 3 && ids.length > 0 ? `${parts[1]} (${ids.join(':')})` : name;
};

const scatterRows = (points: readonly ElementSize[]): Row[] =>
  points.map((p) => ({
    name: p.name,
    ifcClass: p.ifcClass,
    group: p.group,
    storey: p.storey,
    volume: p.volume,
    height: p.height,
    boxVolume: p.boxVolume,
    source: SOURCE_LABEL[p.source],
  }));

const rankRows = (points: readonly ElementSize[]): Row[] =>
  largest(points).map((p, i) => ({
    label: `${i + 1}. ${shortName(p.name)}`,
    name: p.name,
    ifcClass: p.ifcClass,
    group: p.group,
    storey: p.storey,
    volume: p.volume,
    source: SOURCE_LABEL[p.source],
    note: `${p.ifcClass} · ${p.source === 'modelled' ? 'modelled' : 'box'}`,
  }));

/** Colour by class group over the fixed group order, so a group keeps its colour; only the groups present get a legend entry. */
const colour = (points: readonly ElementSize[]) => {
  const present = new Set(points.map((p) => p.group));
  return {
    field: 'group',
    type: 'nominal',
    title: 'Class group',
    scale: { domain: GROUPS },
    legend: { values: GROUPS.filter((g) => present.has(g)) },
  } as const;
};

const SCATTER_TITLE = 'Volume against height, per element';
const RANK_TITLE = 'The ten largest elements by volume';

const scatterSpec = (points: readonly ElementSize[]): TopLevelSpec => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: { text: SCATTER_TITLE, subtitle: 'Duplex Apartment; circles are modelled volumes, triangles are bounding-box volumes' },
  width: 'container',
  height: 360,
  mark: { type: 'point', filled: true, size: 70, opacity: 0.8 },
  encoding: {
    x: { field: 'volume', type: 'quantitative', title: 'Volume (m³, log scale)', scale: { type: 'log' } },
    y: { field: 'height', type: 'quantitative', title: 'Height (bounding box, m)' },
    color: colour(points),
    shape: {
      field: 'source',
      type: 'nominal',
      title: 'Volume from',
      scale: { domain: SOURCES.map((s) => SOURCE_LABEL[s]), range: SOURCES.map((s) => SOURCE_SHAPE[s]) },
    },
    tooltip: [
      { field: 'name', title: 'Name' },
      { field: 'ifcClass', title: 'Class' },
      { field: 'storey', title: 'Storey' },
      { field: 'volume', title: 'Volume (m³)', format: '.3f' },
      { field: 'height', title: 'Height (m)', format: '.2f' },
      { field: 'source', title: 'Volume from' },
      { field: 'boxVolume', title: 'Box volume (m³)', format: '.3f' },
    ],
  },
  config: { legend: { labelLimit: 280 } },
});

/** The ranking; the x axis runs half again past the longest bar so the class label after it fits. */
const rankSpec = (points: readonly ElementSize[]): TopLevelSpec => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: { text: RANK_TITLE, subtitle: 'm³; the label after each bar gives the IFC class and where the volume comes from' },
  width: 'container',
  height: { step: 22 },
  encoding: {
    y: { field: 'label', type: 'nominal', title: null, sort: null, axis: { labelLimit: 480 } },
    x: {
      field: 'volume',
      type: 'quantitative',
      title: 'Volume (m³)',
      scale: { domain: [0, 1.5 * Math.max(0, ...largest(points).map((p) => p.volume))], nice: true },
    },
    tooltip: [
      { field: 'name', title: 'Name' },
      { field: 'ifcClass', title: 'Class' },
      { field: 'storey', title: 'Storey' },
      { field: 'volume', title: 'Volume (m³)', format: '.2f' },
      { field: 'source', title: 'Volume from' },
    ],
  },
  layer: [
    { mark: 'bar', encoding: { color: { ...colour(points), legend: null } } },
    { mark: { type: 'text', align: 'left', dx: 4, fontSize: 11 }, encoding: { text: { field: 'note' } } },
  ],
});

/** Headless rendering has no container to fill. */
const fixedWidth = (spec: TopLevelSpec): TopLevelSpec => ({ ...spec, width: 640 }) as TopLevelSpec;

const fmt = (n: number, digits = 1) => n.toFixed(digits);

const caption = (data: ElementSizeData): string => {
  const modelled = data.points.filter((p) => p.source === 'modelled');
  const box = data.points.filter((p) => p.source === 'box');
  const ratios = modelled.map((p) => p.boxVolume / p.volume);
  const worst = ratios.length > 0 ? Math.max(...ratios) : null;
  const shared = [...new Set(data.sharedBoxes.map((p) => p.ifcClass))].join(' and ');
  return [
    `${data.points.length} elements drawn. ${modelled.length} have a modelled volume (PSet_Revit_Dimensions Volume);`,
    `${box.length} have none and fall back to their bounding-box volume, drawn as triangles.`,
    worst !== null
      ? `A box over-states a sloped, L-shaped, or hollow element (where an element has both, the box is up to ${fmt(worst)} times the modelled volume).`
      : 'A box over-states a sloped, L-shaped, or hollow element.',
    `${data.leftOut.length} left out for a zero or missing size.`,
    `${data.spaces} rooms (IFCSPACE) are not drawn: their volume is air, not built quantity.`,
    data.sharedBoxes.length > 0
      ? `${data.sharedBoxes.length} elements (${shared}) share a name and a box: an assembly and its part, so that volume appears twice; count it once.`
      : '',
    'Height is the vertical size of the axis-aligned bounding box, not a modelled height.',
  ]
    .filter((s) => s !== '')
    .join(' ');
};

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts…');
    const data = await loadElementSizes(mapSources(dataUrl));
    page.status('');
    const doc = root.ownerDocument;
    const scatterEl = doc.createElement('div');
    const rankEl = doc.createElement('div');
    page.figure.append(scatterEl, rankEl);
    await renderVegaLite(scatterEl, scatterSpec(data.points), scatterRows(data.points));
    await renderVegaLite(rankEl, rankSpec(data.points), rankRows(data.points));
    page.caption(caption(data));
  },
  async headless(paths): Promise<HeadlessView[]> {
    const data = await loadElementSizes(mapSources((f) => resolveDataPath(f, paths)));
    const scatter = scatterRows(data.points);
    const rank = rankRows(data.points);
    return [
      { kind: 'chart', title: SCATTER_TITLE, rows: scatter.length, svg: await vegaLiteToSvg(fixedWidth(scatterSpec(data.points)), scatter) },
      { kind: 'chart', title: RANK_TITLE, rows: rank.length, svg: await vegaLiteToSvg(fixedWidth(rankSpec(data.points)), rank) },
    ];
  },
};
