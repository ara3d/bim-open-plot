// Egress hops: each room on the two living storeys of the Duplex coloured by
// the fewest connections (doors, stair flights, open overlaps) between it and
// an exit door, plus a bar chart of rooms per hop count. Everything comes from
// the box model in src/building.ts, so the caption states its approximations.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadJson, loadTable, type BoundsFile } from '../../src/data';
import {
  DOOR,
  SPACE,
  allLinks,
  doorSpacePairs,
  elementsWithBounds,
  exteriorDoors,
  hopsFrom,
  ofType,
  onStorey,
  roomGraph,
  type DoorSpaces,
  type PlanElement,
} from '../../src/building';
import { heatRect, mountSvg, planSvg, type PlanLine, type PlanPoint, type PlanRect } from '../../src/plan';
import { heatColor, tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const ELEMENTS = '/data/duplex/elements.json';
const BOUNDS = '/data/duplex/bounds.json';

/** The storeys people live on; the plans draw these, the chart counts every space. */
export const LIVING_STOREYS = ['Level 1', 'Level 2'] as const;

/** The box model of the Duplex with each space's hop count to the nearest exit. */
export interface Egress {
  readonly spaces: readonly PlanElement[];
  readonly doors: readonly PlanElement[];
  readonly links: readonly DoorSpaces[];
  readonly exits: readonly DoorSpaces[];
  /** Space id to hop count; a space with no route has no entry. */
  readonly hops: ReadonlyMap<number, number>;
  /** The largest hop count among reached spaces. */
  readonly maxHops: number;
}

/** Loads the extracts and runs the box model: links, exits, and hops from the rooms the exits open from. */
export const loadEgress = async (elementsPath: string, boundsPath: string): Promise<Egress> => {
  const items = elementsWithBounds(await loadTable(elementsPath), await loadJson<BoundsFile>(boundsPath));
  const spaces = ofType(items, SPACE);
  const doors = ofType(items, DOOR);
  const links = allLinks(items);
  const exits = exteriorDoors(doorSpacePairs(doors, spaces));
  const hops = hopsFrom(roomGraph(links), exits.flatMap((e) => e.spaces.map((s) => s.id)));
  return { spaces, doors, links, exits, hops, maxHops: Math.max(0, ...hops.values()) };
};

const UNREACHED = 'unreached';
const hopLabel = (h: number | undefined): string => (h === undefined ? UNREACHED : String(h));
const planArea = (e: PlanElement) => e.box.size.x * e.box.size.y;

/** The chart's rows: one per space, with its storey and hop count (or "unreached"). */
export const chartRows = (egress: Egress): Row[] =>
  egress.spaces.map((s) => {
    const h = egress.hops.get(s.id);
    return { space: s.name, storey: s.storey ?? 'no storey', hops: hopLabel(h), order: h ?? Number.MAX_SAFE_INTEGER };
  });

/** One storey's plan: rooms by hop count, doors and exits as points, stair flights outlined, open connections dashed. */
export const storeyPlan = (egress: Egress, storey: string, width = 480): { svg: string; rooms: number } => {
  const rooms = [...onStorey(egress.spaces, storey)].sort((a, b) => planArea(b) - planArea(a));
  // One step past the largest count, so the darkest heat colour (unreadable under dark labels) stays unused.
  const hi = egress.maxHops + 1;
  const roomRects = rooms.map((s) => {
    const h = egress.hops.get(s.id);
    const label = `${s.name}: ${hopLabel(h)}`;
    return heatRect(String(s.id), s.box, h ?? null, 0, hi, label, `${label} (${s.storey})`);
  });
  const onThisStorey = (l: DoorSpaces) => l.spaces.some((s) => s.storey === storey);
  const stairs = egress.links.filter((l) => l.kind === 'stair' && onThisStorey(l));
  const stairRects: PlanRect[] = stairs.map((l) => ({
    id: `stair-${l.door.id}`,
    x0: l.door.box.min.x,
    y0: l.door.box.min.y,
    x1: l.door.box.max.x,
    y1: l.door.box.max.y,
    fill: 'none',
    stroke: tokens.text,
    strokeWidth: 1.5,
    title: `Stair flight: ${l.door.name}; connects ${l.spaces.map((s) => `${s.name} (${s.storey})`).join(', ')}`,
  }));
  // The flight's label sits at its upper end: the centre is taken by the label of the room under it.
  const stairLabels: PlanPoint[] = stairs.map((l) => ({ x: l.door.box.center.x, y: l.door.box.max.y, r: 2, fill: tokens.text, label: 'Stair' }));
  const openLines: PlanLine[] = egress.links
    .filter((l) => l.kind === 'open' && l.door.storey === storey)
    .map((l) => {
      const [a, b] = l.spaces as [PlanElement, PlanElement];
      return { x0: a.box.center.x, y0: a.box.center.y, x1: b.box.center.x, y1: b.box.center.y, stroke: tokens.dim, width: 1.5, dash: '4 4' };
    });
  const exitIds = new Set(egress.exits.map((e) => e.door.id));
  const doorPoints: PlanPoint[] = onStorey(egress.doors, storey).map((d) =>
    exitIds.has(d.id)
      ? { x: d.box.center.x, y: d.box.center.y, r: 6, fill: tokens.accent, label: 'Exit', title: `Exit door: ${d.name}` }
      : { x: d.box.center.x, y: d.box.center.y, r: 3, fill: tokens.dim, title: `Door: ${d.name}` },
  );
  const hasUnreached = rooms.some((s) => !egress.hops.has(s.id));
  const swatches = [
    ...Array.from({ length: egress.maxHops + 1 }, (_, h) => ({ label: h === 0 ? '0 (exit room)' : String(h), color: heatColor(h, 0, hi) })),
    ...(hasUnreached ? [{ label: 'unreached', color: tokens.background }] : []),
    // Exit points carry their own "Exit" label; an ochre swatch would read as a hop colour.
    { label: 'Door', color: tokens.dim },
  ];
  const svg = planSvg([...roomRects, ...stairRects], {
    width,
    title: storey,
    subtitle: 'Connections from each room to the nearest exit',
    legend: { kind: 'swatches', items: swatches },
    lines: openLines,
    points: [...doorPoints, ...stairLabels],
    scaleBar: true,
  });
  return { svg, rooms: rooms.length };
};

const spec: TopLevelSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: { text: 'Rooms by connections to the nearest exit', subtitle: 'Duplex Apartment, every space; "unreached" has no route' },
  width: 'container',
  height: 240,
  mark: 'bar',
  encoding: {
    x: { field: 'hops', type: 'ordinal', title: 'Connections to an exit', sort: { field: 'order', op: 'min' }, axis: { labelAngle: 0 } },
    y: { aggregate: 'count', type: 'quantitative', title: 'Rooms', axis: { tickMinStep: 1 } },
    color: { field: 'storey', type: 'nominal', title: 'Storey', sort: ['Level 1', 'Level 2', 'Roof'] },
    tooltip: [{ field: 'hops', title: 'Connections' }, { field: 'storey' }, { aggregate: 'count', title: 'Rooms' }],
  },
};

/** The caption: what the colours mean, the box-model approximations, and the rooms with no route. */
const caption = (egress: Egress): string => {
  const unreached = egress.spaces.filter((s) => !egress.hops.has(s.id)).map((s) => `${s.name} (${s.storey ?? 'no storey'})`);
  return [
    `Each room is coloured by the fewest connections between it and one of the ${egress.exits.length} exit doors; 0 is a room an exit door opens from. The Duplex is two mirrored units, each with its own exit on Level 1.`,
    'Approximations of the box model (the model has no door-to-room relation and no room outlines): adjacency is bounding-box overlap with 0.3 m tolerance around each door;',
    'an exit is a door touching at most one room; open connections are room boxes on one storey overlapping by at least 0.5 m² (dashed lines);',
    'stairs connect storeys by their flights (outlined). Every connection counts as one hop, so a stair flight or an open connection counts like a door.',
    unreached.length === 0
      ? 'Every space has a route to an exit.'
      : `Rooms with no route are shown as unreached, never as 0: ${unreached.join(', ')}.`,
  ].join(' ');
};

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts…');
    const egress = await loadEgress(dataUrl(ELEMENTS), dataUrl(BOUNDS));
    page.status('');
    const plans = root.ownerDocument.createElement('div');
    plans.className = 'grid';
    for (const storey of LIVING_STOREYS) {
      const cell = root.ownerDocument.createElement('div');
      mountSvg(cell, storeyPlan(egress, storey).svg);
      plans.appendChild(cell);
    }
    const chart = root.ownerDocument.createElement('div');
    page.figure.append(plans, chart);
    await renderVegaLite(chart, spec, chartRows(egress));
    page.caption(caption(egress));
  },
  async headless(paths): Promise<HeadlessView[]> {
    const egress = await loadEgress(resolveDataPath(ELEMENTS, paths), resolveDataPath(BOUNDS, paths));
    const plans = LIVING_STOREYS.map((storey): HeadlessView => {
      const plan = storeyPlan(egress, storey);
      return { kind: 'drawing', title: `${storey}: connections to an exit`, rows: plan.rooms, svg: plan.svg };
    });
    const rows = chartRows(egress);
    const fixed = { ...spec, width: 640 } as TopLevelSpec;
    return [...plans, { kind: 'chart', title: 'Rooms by connections to the nearest exit', rows: rows.length, svg: await vegaLiteToSvg(fixed, rows) }];
  },
};
