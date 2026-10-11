// Room adjacency network: the Duplex's two living storeys side by side, each
// room a node at its box centre sized by its connections, edges drawn by kind
// (door, open overlap, stair flight between the two plans), and a bar chart
// of connections per room. The graph is network.ts over the box model in
// src/building.ts, so the caption states its approximations.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg } from '../../src/chart';
import type { PlanElement } from '../../src/building';
import { mountSvg, planSvg, type PlanLine, type PlanPoint, type PlanRect } from '../../src/plan';
import { series, tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import { chartRows, components, degrees, loadNetwork, roomLabel, type Edge, type Network } from './network';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const ELEMENTS = '/data/duplex/elements.json';
const BOUNDS = '/data/duplex/bounds.json';
const PARAMETERS = '/data/duplex/parameters.json';

/** The storeys the drawing shows, left to right; the chart counts every space. */
export const LIVING_STOREYS = ['Level 1', 'Level 2'] as const;

/** One colour per storey, shared by the drawing's nodes and the chart's bars. */
const STOREY_COLOURS: Readonly<Record<string, string>> = { 'Level 1': series[2]!, 'Level 2': series[3]!, Roof: series[5]! };

/** Metres between the two plans, and outside the footprint for the stair connectors. */
const GAP = 3;
const LABEL_BAND = 0.9;
const CHANNEL_STEP = 0.6;

const isLiving = (e: PlanElement) => (LIVING_STOREYS as readonly (string | null)[]).includes(e.storey);

/** A stair segment drawn as a double line: a wide dark stroke with a thin light one on top. */
const stairStroke = (segments: readonly Omit<PlanLine, 'stroke'>[]): PlanLine[] => [
  ...segments.map((s) => ({ ...s, stroke: tokens.text, width: 5 })),
  ...segments.map((s) => ({ ...s, stroke: tokens.surface, width: 1.5 })),
];

/** The drawing: Level 1 on the left, Level 2 on the right, stair flights joined across the gap. */
export const drawing = (net: Network, width = 720): { svg: string; rooms: number } => {
  const rooms = net.rooms.filter((r) => isLiving(r.space));
  const boxes = rooms.map((r) => r.space.box);
  const minX = Math.min(...boxes.map((b) => b.min.x));
  const maxX = Math.max(...boxes.map((b) => b.max.x));
  const minY = Math.min(...boxes.map((b) => b.min.y));
  const maxY = Math.max(...boxes.map((b) => b.max.y));
  const offset = (storey: string | null) => (storey === LIVING_STOREYS[1] ? maxX - minX + GAP : 0);
  const centre = (e: PlanElement, storey = e.storey) => ({ x: e.box.center.x + offset(storey), y: e.box.center.y });
  const deg = degrees(net);

  const roomRects: PlanRect[] = rooms.map((r) => {
    const o = offset(r.space.storey);
    return {
      id: String(r.space.id),
      x0: r.space.box.min.x + o,
      y0: r.space.box.min.y,
      x1: r.space.box.max.x + o,
      y1: r.space.box.max.y,
      fill: tokens.background,
      stroke: tokens.border,
      title: `${roomLabel(r)} (${r.space.storey}): ${r.area === null ? 'no Area in the model' : `${r.area.toFixed(1)} m²`}`,
    };
  });
  const storeyLabels: PlanRect[] = LIVING_STOREYS.map((s) => ({
    id: `storey-${s}`,
    x0: minX + offset(s),
    y0: maxY + 0.2,
    x1: maxX + offset(s),
    y1: maxY + LABEL_BAND,
    fill: 'none',
    stroke: 'none',
    label: s,
  }));

  // Same-storey edges: one line per room pair; a pair joined by a door and an open overlap is drawn as a door.
  const inPlan = new Map<string, Edge>();
  for (const e of net.edges) {
    if (e.kind === 'stair' || !isLiving(e.a)) continue;
    const key = `${e.a.id}:${e.b.id}`;
    if (!inPlan.has(key) || e.kind === 'door') inPlan.set(key, e);
  }
  const roomLines: PlanLine[] = [...inPlan.values()].map((e) => {
    const a = centre(e.a);
    const b = centre(e.b);
    return e.kind === 'door'
      ? { x0: a.x, y0: a.y, x1: b.x, y1: b.y, stroke: tokens.accent, width: 2.5 }
      : { x0: a.x, y0: a.y, x1: b.x, y1: b.y, stroke: tokens.dim, width: 2, dash: '5 4' };
  });

  // Stair flights: the flight box is outlined on both plans, each room it touches is joined to the nearest
  // point of that box, and the flight's two ends are joined through a channel north or south of the plans,
  // whichever is nearer. A stair well's centre sits on the flight's, so room-centre lines would hide its open edge.
  const flights = net.links.filter((l) => l.kind === 'stair');
  const flightRects: PlanRect[] = flights.flatMap((l) =>
    LIVING_STOREYS.map((s) => ({
      id: `stair-${l.door.id}-${s}`,
      x0: l.door.box.min.x + offset(s),
      y0: l.door.box.min.y,
      x1: l.door.box.max.x + offset(s),
      y1: l.door.box.max.y,
      fill: 'none',
      stroke: tokens.text,
      strokeWidth: 2,
      title: `Stair flight ${l.door.name}: touches ${l.spaces.map((x) => `${x.name} (${x.storey})`).join(', ')}`,
    })),
  );
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const channels = { north: 0, south: 0 };
  const stairSegments = flights.flatMap((l) => {
    const foot = centre(l.door, LIVING_STOREYS[0]);
    const head = centre(l.door, LIVING_STOREYS[1]);
    const north = maxY - foot.y < foot.y - minY;
    const y = north
      ? maxY + LABEL_BAND + 0.5 + CHANNEL_STEP * channels.north++
      : minY - 0.8 - CHANNEL_STEP * channels.south++;
    const toRooms = l.spaces.filter(isLiving).map((s) => {
      const room = centre(s);
      const o = offset(s.storey);
      const x = clamp(room.x, l.door.box.min.x + o, l.door.box.max.x + o);
      return { x0: x, y0: clamp(room.y, l.door.box.min.y, l.door.box.max.y), x1: room.x, y1: room.y };
    });
    return [
      ...toRooms,
      { x0: foot.x, y0: foot.y, x1: foot.x, y1: y },
      { x0: foot.x, y0: y, x1: head.x, y1: y },
      { x0: head.x, y0: y, x1: head.x, y1: head.y },
    ];
  });

  const points: PlanPoint[] = rooms.map((r) => {
    const c = centre(r.space);
    const d = deg.get(r.space.id) ?? 0;
    return {
      ...c,
      // planSvg puts a point's label 8 px right of its centre, so the radius stays under 9 px.
      r: 2.5 + d,
      fill: STOREY_COLOURS[r.space.storey ?? ''] ?? tokens.dim,
      label: r.space.name,
      title: `${roomLabel(r)} (${r.space.storey}): ${d} connected rooms`,
    };
  });

  const svg = planSvg([...roomRects, ...flightRects, ...storeyLabels], {
    width,
    margin: 1.5,
    title: 'Which rooms connect to which',
    subtitle: 'Duplex Apartment; node size is the number of connected rooms',
    lines: [...stairStroke(stairSegments), ...roomLines],
    points,
    legend: {
      kind: 'swatches',
      items: [
        { label: 'Door', color: tokens.accent },
        { label: 'Open (dashed)', color: tokens.dim },
        { label: 'Stair flight', color: tokens.text },
        ...LIVING_STOREYS.map((s) => ({ label: s, color: STOREY_COLOURS[s]! })),
      ],
    },
    scaleBar: true,
  });
  return { svg, rooms: rooms.length };
};

const spec: TopLevelSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: { text: 'Connected rooms per room', subtitle: 'Duplex Apartment, every space; doors, open overlaps, and stair flights' },
  width: 'container',
  height: { step: 16 },
  mark: 'bar',
  encoding: {
    y: { field: 'room', type: 'nominal', title: null, sort: { field: 'degree', order: 'descending' } },
    x: { field: 'degree', type: 'quantitative', title: 'Connected rooms', axis: { tickMinStep: 1 } },
    color: { field: 'storey', type: 'nominal', title: 'Storey', scale: { domain: Object.keys(STOREY_COLOURS), range: Object.values(STOREY_COLOURS) } },
    tooltip: [
      { field: 'room' },
      { field: 'storey' },
      { field: 'degree', title: 'Connected rooms' },
      { field: 'doors', title: 'Through a door' },
      { field: 'open', title: 'Open overlap' },
      { field: 'stairs', title: 'Up or down a stair' },
      { field: 'area', title: 'Area (m²)', format: '.1f' },
    ],
  },
};

/** The caption: what the figure counts and the approximations of the box model. */
export const caption = (net: Network): string => {
  const living = net.rooms.map((r) => r.space).filter(isLiving);
  const units = components(living, net.edges).length;
  const deg = degrees(net);
  const isolated = net.rooms.filter((r) => (deg.get(r.space.id) ?? 0) === 0).map((r) => `${r.space.name} (${r.space.storey ?? 'no storey'})`);
  return [
    'A room\'s connections are the distinct rooms one door, open overlap, or stair flight away. The model has no door-to-room relation and no room outline, so every edge comes from axis-aligned bounding boxes:',
    'adjacency is bounding-box overlap with 0.3 m tolerance around each door, so a door between three boxes joins each pair of them, and an exterior door touches one room and makes no edge;',
    'open connections are overlapping room boxes on one storey (at least 0.5 m², dashed), with no wall between them in the box model;',
    'a stair flight joins every room its box touches (0.5 m tolerance) on Level 1 to every one on Level 2.',
    `The two units are mirrored, so the rooms on Level 1 and Level 2 form ${units} components joined only through the exterior: no door, opening, or stair links one unit to the other.`,
    isolated.length === 0 ? '' : `With no door, opening, or flight touching it, ${isolated.join(', ')} has 0 connections: a count, not a missing value.`,
  ]
    .filter((s) => s !== '')
    .join(' ');
};

const load = (resolve: (file: string) => string) => loadNetwork(resolve(ELEMENTS), resolve(BOUNDS), resolve(PARAMETERS));

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts…');
    const net = await load((f) => dataUrl(f));
    page.status('');
    const plan = root.ownerDocument.createElement('div');
    mountSvg(plan, drawing(net).svg);
    const chart = root.ownerDocument.createElement('div');
    page.figure.append(plan, chart);
    await renderVegaLite(chart, spec, chartRows(net));
    page.caption(caption(net));
  },
  async headless(paths): Promise<HeadlessView[]> {
    const net = await load((f) => resolveDataPath(f, paths));
    const plan = drawing(net);
    const rows = chartRows(net);
    const fixed = { ...spec, width: 640 } as TopLevelSpec;
    return [
      { kind: 'drawing', title: 'Room adjacency on Level 1 and Level 2', rows: plan.rooms, svg: plan.svg },
      { kind: 'chart', title: 'Connected rooms per room', rows: rows.length, svg: await vegaLiteToSvg(fixed, rows) },
    ];
  },
};
