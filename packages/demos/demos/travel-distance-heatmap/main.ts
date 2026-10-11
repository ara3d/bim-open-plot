// Travel distance: each room on the two living storeys of the Duplex coloured
// by its distance to the nearest exit, measured as a chain of straight
// segments between link centres (doors, stair flights, open overlaps) in the
// box model of src/building.ts, with the routes of the farthest rooms drawn,
// plus a sorted bar chart against an illustrative limit.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadJson, loadTable, type BoundsFile } from '../../src/data';
import {
  SPACE,
  STAIRS,
  allLinks,
  elementsWithBounds,
  exteriorDoors,
  ofType,
  onStorey,
  travelDistances,
  type PlanElement,
} from '../../src/building';
import { heatRect, mountSvg, planSvg, type PlanLine, type PlanPoint } from '../../src/plan';
import { tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const ELEMENTS = '/data/duplex/elements.json';
const BOUNDS = '/data/duplex/bounds.json';

/** The storeys people live on; the plans draw these, the chart lists every room with a route. */
export const LIVING_STOREYS = ['Level 1', 'Level 2'] as const;

/** The illustrative travel-distance limit drawn on the chart, in metres. Not taken from any code. */
export const LIMIT_M = 30;

/** How many routes each plan draws: the farthest rooms only, so the plan stays legible. */
export const ROUTES_PER_STOREY = 3;

/** One room's distance to the nearest exit, or null when the box model finds no route. */
export interface RoomTravel {
  readonly space: PlanElement;
  readonly distance: number | null;
  /** The links the route passes, from the room's first door to the exit door; empty when there is no route. */
  readonly path: readonly PlanElement[];
}

export interface Travel {
  /** Every space, farthest first; rooms with no route last. */
  readonly rooms: readonly RoomTravel[];
  readonly exits: readonly PlanElement[];
  readonly stairs: readonly PlanElement[];
  /** The top of the shared heat ramp for both plans: the longest distance rounded up to a metre. */
  readonly hi: number;
}

/** Loads the extracts and runs the box model: links, exits, and the shortest chain of link centres from each room. */
export const loadTravel = async (elementsPath: string, boundsPath: string): Promise<Travel> => {
  const items = elementsWithBounds(await loadTable(elementsPath), await loadJson<BoundsFile>(boundsPath));
  const spaces = ofType(items, SPACE);
  const links = allLinks(items);
  const routes = travelDistances(spaces, links);
  const rooms = spaces
    .map((space): RoomTravel => {
      const r = routes.get(space.id);
      return { space, distance: r?.distance ?? null, path: r?.path ?? [] };
    })
    .sort((a, b) => (b.distance ?? -1) - (a.distance ?? -1) || a.space.id - b.space.id);
  const longest = rooms[0]?.distance ?? 0;
  return {
    rooms,
    exits: exteriorDoors(links).map((e) => e.door),
    stairs: ofType(items, ...STAIRS),
    hi: Math.max(1, Math.ceil(longest)),
  };
};

const isStair = (e: PlanElement) => STAIRS.includes(e.type);
const planArea = (e: PlanElement) => e.box.size.x * e.box.size.y;

/** The room's name with its storey and STEP id: the Duplex is two mirrored units, so names repeat. */
export const roomLabel = (s: PlanElement): string => `${s.name} · ${s.storey ?? 'no storey'} · #${s.id}`;

const linkWord = (e: PlanElement, last: boolean) =>
  last ? 'exit door' : isStair(e) ? 'stair' : e.type === 'OPEN' ? 'open overlap' : 'door';
const via = (r: RoomTravel) => r.path.map((e, i) => linkWord(e, i === r.path.length - 1)).join(' → ');

/**
 * The route as plan segments: room centre, then each link's centre to the exit.
 * Segments after a stair lie on another storey, so they are dashed.
 */
const routeLines = (r: RoomTravel): PlanLine[] => {
  const points = [r.space, ...r.path];
  const lines: PlanLine[] = [];
  let passedStair = false;
  for (let i = 0; i + 1 < points.length; i += 1) {
    const a = points[i]!.box.center;
    const b = points[i + 1]!.box.center;
    passedStair ||= isStair(points[i]!);
    lines.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, stroke: tokens.text, width: 1.5, ...(passedStair ? { dash: '4 3' } : {}) });
  }
  return lines;
};

/** One storey's plan: rooms on the shared heat ramp, routes of the farthest rooms, exits and stair flights as points. */
export const storeyPlan = (travel: Travel, storey: string, width = 480): { svg: string; rooms: number } => {
  const rooms = travel.rooms.filter((r) => r.space.storey === storey);
  const rects = [...rooms]
    .sort((a, b) => planArea(b.space) - planArea(a.space))
    .map((r) =>
      heatRect(
        String(r.space.id),
        r.space.box,
        r.distance,
        0,
        travel.hi,
        r.space.name,
        r.distance === null ? `${roomLabel(r.space)}: no route to an exit` : `${roomLabel(r.space)}: ${r.distance.toFixed(1)} m via ${via(r)}`,
      ),
    );
  const routed = rooms.filter((r) => r.distance !== null).slice(0, ROUTES_PER_STOREY);
  const exitsHere = onStorey(travel.exits, storey);
  const points: PlanPoint[] = [
    // On its own storey a flight sits inside the stair room, which is already labelled; elsewhere it marks where a route changes storey.
    ...travel.stairs
      .filter((s) => s.storey !== storey)
      .map((s) => ({ x: s.box.center.x, y: s.box.center.y, r: 4, fill: tokens.dim, title: `Stair flight #${s.id}, counted at its plan centre` })),
    ...exitsHere.map((d) => ({ x: d.box.center.x, y: d.box.center.y, r: 6, fill: tokens.accent, label: 'Exit', title: `Exit door #${d.id}: ${d.name}` })),
  ];
  const svg = planSvg(
    rects,
    {
      width,
      title: storey,
      subtitle:
        exitsHere.length === 0
          ? 'No exit on this storey; dashed routes continue past the stair on another storey'
          : `${exitsHere.length} exits (ochre); routes of the ${ROUTES_PER_STOREY} farthest rooms`,
      legend: { kind: 'ramp', lo: 0, hi: travel.hi, label: 'Travel distance to an exit (m)' },
      lines: routed.flatMap(routeLines),
      points,
      scaleBar: true,
    },
  );
  return { svg, rooms: rooms.length };
};

/** The chart's rows: one per room with a route; a room with no route has no bar and is listed in the caption. */
export const chartRows = (travel: Travel): Row[] =>
  travel.rooms
    .filter((r) => r.distance !== null)
    .map((r) => ({ room: roomLabel(r.space), storey: r.space.storey ?? 'no storey', distance: r.distance, via: via(r) }));

const spec: TopLevelSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: {
    text: 'Travel distance to the nearest exit, per room',
    subtitle: `Duplex Apartment, m; the ${LIMIT_M} m line is illustrative, not a code limit`,
  },
  width: 'container',
  height: { step: 18 },
  layer: [
    {
      mark: 'bar',
      encoding: {
        y: { field: 'room', type: 'nominal', title: null, sort: '-x', axis: { labelLimit: 260 } },
        x: { field: 'distance', type: 'quantitative', title: 'Travel distance to an exit (m)' },
        color: { condition: { test: `datum.distance > ${LIMIT_M}`, value: tokens.error }, value: tokens.accent },
        tooltip: [{ field: 'room' }, { field: 'distance', format: '.1f', title: 'Distance (m)' }, { field: 'via', title: 'Route' }],
      },
    },
    {
      data: { values: [{ limit: LIMIT_M }] },
      mark: { type: 'rule', color: tokens.error, strokeDash: [4, 3], strokeWidth: 1.5 },
      encoding: { x: { field: 'limit', type: 'quantitative' } },
    },
    {
      data: { values: [{ limit: LIMIT_M, text: `Illustrative limit ${LIMIT_M} m` }] },
      mark: { type: 'text', align: 'right', baseline: 'top', dx: -4, color: tokens.error, fontSize: 11 },
      encoding: { x: { field: 'limit', type: 'quantitative' }, y: { value: 4 }, text: { field: 'text' } },
    },
  ],
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The caption: the farthest room, the rooms over the limit, the approximations, and the rooms with no route. */
const caption = (travel: Travel): string => {
  const reached = travel.rooms.filter((r) => r.distance !== null);
  const far = reached[0];
  const over = reached.filter((r) => r.distance! > LIMIT_M);
  const none = travel.rooms.filter((r) => r.distance === null).map((r) => `${r.space.name} (${r.space.storey ?? 'no storey'})`);
  return [
    far ? `Farthest from an exit: ${esc(roomLabel(far.space))}, ${far.distance!.toFixed(1)} m.` : 'No room has a route to an exit.',
    over.length === 0
      ? `No room exceeds the illustrative ${LIMIT_M} m limit.`
      : `${over.length} rooms exceed the illustrative ${LIMIT_M} m limit (red): ${over.map((r) => esc(roomLabel(r.space))).join(', ')}.`,
    'Distances are chains of straight segments between door centres over bounding boxes: from the centre of the room box to a door centre, then door centre to door centre to an exit door.',
    'They are not walking paths around furniture or around walls inside a room.',
    'Adjacency is box overlap: a door serves the rooms whose boxes it touches (0.3 m tolerance), an exit is a door touching only one room, and two room boxes overlapping by at least 0.5 m² connect through the centre of the overlap.',
    'A stair counts as the plan centre of its flight (grey dots on Level 2): no stair length is added, so Level 2 distances are short by the run of the stair.',
    `Routes are drawn only for the ${ROUTES_PER_STOREY} farthest rooms per storey to keep the plan legible; a dashed segment lies on another storey, past the stair.`,
    `Both plans share one ramp, 0 to ${travel.hi} m. The ${LIMIT_M} m line on the chart is illustrative, not a code limit.`,
    none.length === 0 ? 'Every room has a route to an exit.' : `Rooms with no route, left uncoloured and without a bar, never shown as 0: ${esc(none.join(', '))}.`,
  ].join(' ');
};

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts…');
    const travel = await loadTravel(dataUrl(ELEMENTS), dataUrl(BOUNDS));
    page.status('');
    const plans = root.ownerDocument.createElement('div');
    plans.className = 'grid';
    for (const storey of LIVING_STOREYS) {
      const cell = root.ownerDocument.createElement('div');
      mountSvg(cell, storeyPlan(travel, storey).svg);
      plans.appendChild(cell);
    }
    const chart = root.ownerDocument.createElement('div');
    page.figure.append(plans, chart);
    await renderVegaLite(chart, spec, chartRows(travel));
    page.caption(caption(travel));
  },
  async headless(paths): Promise<HeadlessView[]> {
    const travel = await loadTravel(resolveDataPath(ELEMENTS, paths), resolveDataPath(BOUNDS, paths));
    const plans = LIVING_STOREYS.map((storey): HeadlessView => {
      const plan = storeyPlan(travel, storey);
      return { kind: 'drawing', title: `${storey}: travel distance to an exit`, rows: plan.rooms, svg: plan.svg };
    });
    const rows = chartRows(travel);
    const fixed = { ...spec, width: 640 } as TopLevelSpec;
    return [...plans, { kind: 'chart', title: 'Travel distance to the nearest exit, per room', rows: rows.length, svg: await vegaLiteToSvg(fixed, rows) }];
  },
};
