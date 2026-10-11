// Clash candidates by class pair: every unordered pair of solid elements in
// the Duplex whose bounding boxes share more than 0.001 m³, split into
// hosted overlaps (a door or window in a wall, expected) and candidates.
// Three views: a class × class heat map of candidate counts, a bar of
// candidates per storey by class pair, and a plan of the busiest storey with
// each overlap box drawn over faint outlines of the elements involved.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadJson, loadTable, type Box3, type BoundsFile } from '../../src/data';
import { DOOR, WALLS, WINDOW, elementsWithBounds, overlapsXYZ, type PlanElement } from '../../src/building';
import { mountSvg, planSvg, type PlanRect } from '../../src/plan';
import { heat, series, tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import raw from './demo.json';

const manifest = raw as DemoManifest;

/** Overlaps with less volume in common than this (m³) are touching faces, not candidates. */
export const MIN_VOLUME = 0.001;

/** Spaces and openings are volumes of air, not solids. */
const NOT_SOLID: readonly string[] = ['IFCSPACE', 'IFCOPENINGELEMENT'];

/** How many class pairs the per-storey bar names; the rest are "Other pairs". */
const NAMED_PAIRS = 5;
const OTHER_PAIRS = 'Other pairs';

/** One unordered pair of elements whose boxes overlap. `a` has the lower STEP id. */
export interface Overlap {
  /** `${a.id}-${b.id}`: unique per unordered pair. */
  readonly key: string;
  readonly a: PlanElement;
  readonly b: PlanElement;
  /** The two class labels in alphabetical order, joined: "Furniture × Slab". */
  readonly pair: string;
  /** The shared storey, or "lower / upper" when the two elements sit on different storeys. */
  readonly storey: string;
  readonly sameStorey: boolean;
  /** The intersection of the two boxes. */
  readonly box: Box3;
  readonly volume: number;
  readonly kind: 'candidate' | 'hosted';
}

export interface ClashData {
  /** The elements tested: every bounded element except spaces, openings, and assemblies whose parts carry boxes. */
  readonly solids: readonly PlanElement[];
  /** Bounded elements left out because they are spaces or openings. */
  readonly notSolid: readonly PlanElement[];
  /** Assemblies left out because their parts carry their own boxes (the roof and its slab). */
  readonly assemblies: readonly PlanElement[];
  readonly overlaps: readonly Overlap[];
  /** Storey names from lowest to highest, by the lowest box on each. */
  readonly storeyOrder: readonly string[];
}

interface Sources {
  readonly elements: string;
  readonly bounds: string;
  readonly relations: string;
}

const FILES: Sources = {
  elements: '/data/duplex/elements.json',
  bounds: '/data/duplex/bounds.json',
  relations: '/data/duplex/relations.json',
};

const mapSources = (f: (file: string) => string): Sources => ({
  elements: f(FILES.elements),
  bounds: f(FILES.bounds),
  relations: f(FILES.relations),
});

/** Readable class names; IfcWall and IfcWallStandardCase are both "Wall". */
const CLASS_LABEL: Readonly<Record<string, string>> = {
  IFCWALL: 'Wall',
  IFCWALLSTANDARDCASE: 'Wall',
  IFCFURNISHINGELEMENT: 'Furniture',
  IFCSTAIRFLIGHT: 'Stair flight',
};

export const classLabel = (type: string): string =>
  CLASS_LABEL[type] ?? type.replace(/^IFC/, '').toLowerCase().replace(/^./, (c) => c.toUpperCase());

const isHosted = (a: PlanElement, b: PlanElement): boolean => {
  const opening = (e: PlanElement) => e.type === DOOR || e.type === WINDOW;
  return (opening(a) && WALLS.includes(b.type)) || (opening(b) && WALLS.includes(a.type));
};

/** The box both boxes contain, or null when they do not overlap with positive size on every axis. */
export const intersection = (a: Box3, b: Box3): Box3 | null => {
  const min = { x: Math.max(a.min.x, b.min.x), y: Math.max(a.min.y, b.min.y), z: Math.max(a.min.z, b.min.z) };
  const max = { x: Math.min(a.max.x, b.max.x), y: Math.min(a.max.y, b.max.y), z: Math.min(a.max.z, b.max.z) };
  if (max.x <= min.x || max.y <= min.y || max.z <= min.z) return null;
  return {
    min,
    max,
    center: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 },
    size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
  };
};

/** Storeys from lowest to highest by the lowest box bottom among their elements. */
const storeyOrderOf = (items: readonly PlanElement[]): string[] => {
  const low = new Map<string, number>();
  for (const i of items) if (i.storey !== null) low.set(i.storey, Math.min(low.get(i.storey) ?? Infinity, i.box.min.z));
  return [...low.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
};

/** Every unordered pair of `solids` whose boxes share more than MIN_VOLUME, each pair once. */
export const findOverlaps = (solids: readonly PlanElement[], storeyOrder: readonly string[]): Overlap[] => {
  const rank = (s: string | null) => (s === null ? Infinity : storeyOrder.indexOf(s));
  const sorted = [...solids].sort((p, q) => p.id - q.id);
  const out: Overlap[] = [];
  for (let i = 0; i < sorted.length; i += 1)
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i]!;
      const b = sorted[j]!;
      if (!overlapsXYZ(a.box, b.box, 0)) continue;
      const box = intersection(a.box, b.box);
      if (box === null) continue;
      const volume = box.size.x * box.size.y * box.size.z;
      if (volume <= MIN_VOLUME) continue;
      const sameStorey = a.storey === b.storey;
      const [lo, hi] = [a.storey, b.storey].sort((s, t) => rank(s) - rank(t));
      out.push({
        key: `${a.id}-${b.id}`,
        a,
        b,
        pair: [classLabel(a.type), classLabel(b.type)].sort().join(' × '),
        storey: sameStorey ? (a.storey ?? 'no storey') : `${lo ?? 'no storey'} / ${hi ?? 'no storey'}`,
        sameStorey,
        box,
        volume,
        kind: isHosted(a, b) ? 'hosted' : 'candidate',
      });
    }
  return out;
};

/** Loads the extracts, chooses the solids, and finds every overlap. */
export const loadClashes = async (src: Sources): Promise<ClashData> => {
  const [elements, bounds, relations] = await Promise.all([
    loadTable(src.elements),
    loadJson<BoundsFile>(src.bounds),
    loadTable(src.relations),
  ]);
  const placed = elementsWithBounds(elements, bounds);
  const bounded = new Set(placed.map((p) => p.entityIndex));
  const withBoxedParts = new Set(
    relations
      .filter((r) => r.RelationType === 'MemberOf' && bounded.has(Number(r.EntityIndexA)))
      .map((r) => Number(r.EntityIndexB)),
  );
  const notSolid = placed.filter((p) => NOT_SOLID.includes(p.type));
  const assemblies = placed.filter((p) => !NOT_SOLID.includes(p.type) && p.entityIndex !== null && withBoxedParts.has(p.entityIndex));
  const solids = placed.filter((p) => !notSolid.includes(p) && !assemblies.includes(p));
  const storeyOrder = storeyOrderOf(placed);
  return { solids, notSolid, assemblies, overlaps: findOverlaps(solids, storeyOrder), storeyOrder };
};

export const candidatesOf = (data: ClashData): Overlap[] => data.overlaps.filter((o) => o.kind === 'candidate');

/** Counts per key, largest first, ties by name. */
const countBy = <T>(items: readonly T[], key: (t: T) => string): { name: string; count: number }[] => {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(key(i), (counts.get(key(i)) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((p, q) => q.count - p.count || p.name.localeCompare(q.name));
};

/** Candidate counts per class pair, largest first. */
export const pairCounts = (candidates: readonly Overlap[]) => countBy(candidates, (o) => o.pair);

/** Candidate counts per storey (shared or "lower / upper"), largest first. */
export const storeyCounts = (candidates: readonly Overlap[]) => countBy(candidates, (o) => o.storey);

/** The storey, among those whose candidates lie on one storey, with the most candidates. */
export const busiestStorey = (candidates: readonly Overlap[]): string | null =>
  storeyCounts(candidates.filter((o) => o.sameStorey))[0]?.name ?? null;

/** Every solid class, the most involved in candidates first; classes with none come last. */
const classOrder = (data: ClashData, candidates: readonly Overlap[]): string[] => {
  const involved = countBy(candidates.flatMap((o) => [classLabel(o.a.type), classLabel(o.b.type)]), (c) => c).map((c) => c.name);
  const rest = [...new Set(data.solids.map((s) => classLabel(s.type)))].filter((c) => !involved.includes(c)).sort();
  return [...involved, ...rest];
};

/** One cell per unordered class pair (the lower triangle in `order`), with its candidate count; zero is a real count. */
const matrixRows = (candidates: readonly Overlap[], order: readonly string[]): Row[] => {
  const counts = new Map(pairCounts(candidates).map((p) => [p.name, p.count] as const));
  const rows: Row[] = [];
  for (let i = 0; i < order.length; i += 1)
    for (let j = i; j < order.length; j += 1) {
      const pair = [order[i]!, order[j]!].sort().join(' × ');
      rows.push({ across: order[i]!, down: order[j]!, pair, count: counts.get(pair) ?? 0 });
    }
  return rows;
};

const HEAT_TITLE = 'Clash candidates by class pair';

const heatSpec = (order: readonly string[]): TopLevelSpec => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: {
    text: HEAT_TITLE,
    subtitle: `Duplex Apartment, bounding boxes sharing more than ${MIN_VOLUME} m³; doors and windows in walls left out as hosted`,
  },
  width: { step: 52 },
  height: { step: 30 },
  transform: [{ joinaggregate: [{ op: 'max', field: 'count', as: 'max' }] }],
  encoding: {
    x: { field: 'across', type: 'nominal', sort: [...order], title: null, axis: { orient: 'top', labelAngle: -35 } },
    y: { field: 'down', type: 'nominal', sort: [...order], title: null },
  },
  layer: [
    {
      mark: { type: 'rect', stroke: tokens.surface, strokeWidth: 1 },
      encoding: {
        color: {
          condition: { test: 'datum.count === 0', value: tokens.background },
          field: 'count',
          type: 'quantitative',
          title: 'Candidates',
          scale: { range: [...heat] },
        },
        tooltip: [
          { field: 'pair', title: 'Class pair' },
          { field: 'count', type: 'quantitative', title: 'Candidates' },
        ],
      },
    },
    {
      transform: [{ filter: 'datum.count > 0' }],
      mark: { type: 'text', fontSize: 11 },
      encoding: {
        text: { field: 'count', type: 'quantitative' },
        color: { condition: { test: 'datum.count > datum.max / 2', value: tokens.surface }, value: tokens.text },
      },
    },
  ],
});

const BAR_TITLE = 'Candidates per storey';

const barRows = (candidates: readonly Overlap[]): Row[] => {
  const named = new Set(pairCounts(candidates).slice(0, NAMED_PAIRS).map((p) => p.name));
  return candidates.map((o) => ({ storey: o.storey, pair: named.has(o.pair) ? o.pair : OTHER_PAIRS }));
};

const barSpec = (candidates: readonly Overlap[], storeyOrder: readonly string[]): TopLevelSpec => {
  const named = pairCounts(candidates).slice(0, NAMED_PAIRS).map((p) => p.name);
  const groups = candidates.some((o) => !named.includes(o.pair)) ? [...named, OTHER_PAIRS] : named;
  const rank = (s: string) => Math.min(...s.split(' / ').map((part) => storeyOrder.indexOf(part)));
  const storeys = [...new Set(candidates.map((o) => o.storey))].sort((p, q) => rank(p) - rank(q) || p.length - q.length);
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    data: { values: [] }, // replaced by the rows at render time
    title: { text: BAR_TITLE, subtitle: `The ${NAMED_PAIRS} largest class pairs named; "lower / upper" spans two storeys` },
    width: 'container',
    height: { step: 28 },
    mark: 'bar',
    encoding: {
      y: { field: 'storey', type: 'nominal', sort: storeys, title: null },
      x: { aggregate: 'count', type: 'quantitative', title: 'Candidates' },
      color: {
        field: 'pair',
        type: 'nominal',
        title: 'Class pair',
        sort: groups,
        scale: { domain: groups, range: groups.map((g, i) => (g === OTHER_PAIRS ? tokens.dim : series[i % series.length]!)) },
        legend: { orient: 'bottom', columns: 2 },
      },
      tooltip: [
        { field: 'storey', title: 'Storey' },
        { field: 'pair', title: 'Class pair' },
        { aggregate: 'count', type: 'quantitative', title: 'Candidates' },
      ],
    },
  };
};

const PLAN_WIDTH = 340;

const fmtVolume = (v: number) => (v >= 0.01 ? v.toFixed(2) : v.toFixed(3));

/** The busiest storey: faint outlines of every element in a candidate there, an accent box at each overlap. */
const busiestPlan = (data: ClashData, candidates: readonly Overlap[]): { svg: string; drawn: number; storey: string | null } => {
  const storey = busiestStorey(candidates);
  const here = candidates.filter((o) => o.sameStorey && o.storey === storey);
  const involved = new Map<number, PlanElement>();
  for (const o of here) for (const e of [o.a, o.b]) involved.set(e.id, e);
  const outlines: PlanRect[] = [...involved.values()].map((e) => ({
    id: `element-${e.id}`,
    x0: e.box.min.x,
    y0: e.box.min.y,
    x1: e.box.max.x,
    y1: e.box.max.y,
    fill: 'none',
    stroke: tokens.dim,
    strokeWidth: 0.75,
    opacity: 0.45,
    title: `${classLabel(e.type)}: ${e.name}`,
  }));
  // Largest footprint first, so a small overlap is drawn over a large one rather than hidden by it.
  const planArea = (o: Overlap) => o.box.size.x * o.box.size.y;
  const overlaps: PlanRect[] = [...here].sort((p, q) => planArea(q) - planArea(p)).map((o) => ({
    id: `overlap-${o.key}`,
    x0: o.box.min.x,
    y0: o.box.min.y,
    x1: o.box.max.x,
    y1: o.box.max.y,
    fill: tokens.accent,
    stroke: tokens.accent,
    strokeWidth: 1,
    opacity: 0.3,
    title: `${o.pair}: ${o.a.name} and ${o.b.name}, ${fmtVolume(o.volume)} m³ in common`,
  }));
  const hosted = data.overlaps.filter((o) => o.kind === 'hosted' && o.sameStorey && o.storey === storey).length;
  const svg = planSvg([...outlines, ...overlaps], {
    width: PLAN_WIDTH,
    title: storey === null ? 'No storey has candidates' : `${storey}: where the candidates are`,
    subtitle: `${here.length} candidates between ${involved.size} elements; ${hosted} hosted overlaps not drawn`,
    scaleBar: true,
    legend: {
      kind: 'swatches',
      items: [
        { label: 'Overlap box (candidate)', color: tokens.accent },
        { label: 'Element box involved', color: tokens.border },
      ],
    },
  });
  return { svg, drawn: here.length, storey };
};

const caption = (data: ClashData, candidates: readonly Overlap[]): string => {
  const pairs = pairCounts(candidates);
  const hosted = data.overlaps.filter((o) => o.kind === 'hosted');
  const hostedByPair = pairCounts(hosted).map((p) => `${p.count} ${p.name.toLowerCase()}`).join(', ');
  const storey = busiestStorey(candidates);
  const storeyCount = candidates.filter((o) => o.sameStorey && o.storey === storey).length;
  const spaces = data.notSolid.filter((e) => e.type === 'IFCSPACE').length;
  const openings = data.notSolid.length - spaces;
  return [
    `${candidates.length} clash candidates among ${data.solids.length} solid elements.`,
    pairs.length > 0 ? `The most are ${pairs.slice(0, 3).map((p) => `${p.name} (${p.count})`).join(', ')}.` : '',
    storey !== null ? `${storey} has the most on one storey (${storeyCount}); the plan shows it.` : '',
    `<strong>Candidates are axis-aligned bounding-box overlaps of more than ${MIN_VOLUME} m³. Box overlap over-counts: a box overlap is not a geometric clash, because a box covers empty space around a sloped, hollow, or L-shaped element and joined elements overlap at their ends. This is the first filter a coordinator would run before a clash meeting, not a verdict.</strong>`,
    `${hosted.length} overlaps of a door or window with a wall (${hostedByPair}) are hosted, expected, and left out of the counts; any door or window overlapping any wall counts as hosted, not only its host wall.`,
    `Spaces and opening elements are not solids and are not tested (${spaces} spaces, ${openings} openings in the bounds extract).`,
    data.assemblies.length > 0
      ? `${data.assemblies.map((a) => classLabel(a.type)).join(', ')} left out as an assembly whose parts carry their own boxes (MemberOf in the model).`
      : '',
    'Walls are IfcWall and IfcWallStandardCase together. A pair on two storeys counts under "lower / upper" and is not drawn on the plan; the plan flattens height, so overlaps at different heights draw on top of each other.',
  ]
    .filter((s) => s !== '')
    .join(' ');
};

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts and testing every pair of boxes…');
    const data = await loadClashes(mapSources(dataUrl));
    const candidates = candidatesOf(data);
    page.status('');
    const doc = root.ownerDocument;
    const heatEl = doc.createElement('div');
    const grid = doc.createElement('div');
    grid.className = 'grid';
    const planEl = doc.createElement('div');
    const barEl = doc.createElement('div');
    grid.append(planEl, barEl);
    page.figure.append(heatEl, grid);
    const order = classOrder(data, candidates);
    await renderVegaLite(heatEl, heatSpec(order), matrixRows(candidates, order));
    mountSvg(planEl, busiestPlan(data, candidates).svg);
    await renderVegaLite(barEl, barSpec(candidates, data.storeyOrder), barRows(candidates));
    page.caption(caption(data, candidates));
  },
  async headless(paths): Promise<HeadlessView[]> {
    const data = await loadClashes(mapSources((f) => resolveDataPath(f, paths)));
    const candidates = candidatesOf(data);
    const order = classOrder(data, candidates);
    const cells = matrixRows(candidates, order);
    const bars = barRows(candidates);
    const plan = busiestPlan(data, candidates);
    const fixedBar = { ...barSpec(candidates, data.storeyOrder), width: 420 } as TopLevelSpec;
    return [
      { kind: 'chart', title: HEAT_TITLE, rows: cells.length, svg: await vegaLiteToSvg(heatSpec(order), cells) },
      { kind: 'chart', title: BAR_TITLE, rows: bars.length, svg: await vegaLiteToSvg(fixedBar, bars) },
      { kind: 'drawing', title: `${plan.storey ?? 'No storey'}: clash candidates`, rows: plan.drawn, svg: plan.svg },
    ];
  },
};
