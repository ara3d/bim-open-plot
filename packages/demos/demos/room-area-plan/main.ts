// Room areas on the floor plan: one plan per storey of the Duplex, each room
// a bounding box coloured by its modelled Area on one shared heat ramp, with
// the walls and doors a plan cut would show drawn underneath and on top.

import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { loadJson, loadTable, parametersByElement, type Box3, type BoundsFile } from '../../src/data';
import { DOOR, SPACE, WALLS, elementsWithBounds, ofType, storeys, type PlanElement } from '../../src/building';
import { heatRect, mountSvg, planSvg, type PlanRect } from '../../src/plan';
import { series, tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const ELEMENTS = '/data/duplex/elements.json';
const PARAMETERS = '/data/duplex/parameters.json';
const BOUNDS = '/data/duplex/bounds.json';

/** Storeys left out of the plans, with the reason the caption gives. */
const SKIPPED: ReadonlyMap<string, string> = new Map([
  ['Roof', 'its one space is the roof deck over the whole footprint, so it would hide both units and set the top of the colour ramp'],
]);

/** Walls and doors are drawn when their box crosses a horizontal cut this far above the storey's lowest room floor (metres). */
const CUT_HEIGHT = 1.2;

/**
 * The largest room lands at this fraction of the heat ramp. The plan's labels
 * are dark text, and the ramp's darkest fifths are too dark to read it on.
 */
const RAMP_REACH = 0.65;

/** Plan width in SVG pixels, and the margin planSvg adds around the content (metres). */
const WIDTH = 560;
const MARGIN = 0.5;

/** Width of one label character at planSvg's 11 px label size, a little above the 5 px measured in Edge. */
const CHAR_PX = 5.6;

export interface Room {
  readonly id: number;
  readonly name: string;
  /** PSet_Revit_Identity Data.Number, such as A102; null when the room has none. */
  readonly number: string | null;
  /** PSet_Revit_Dimensions.Area in m²; null when the model gives none. */
  readonly area: number | null;
  readonly storey: string | null;
  readonly box: Box3;
}

export interface StoreyPlan {
  readonly storey: string;
  readonly rooms: readonly Room[];
  readonly walls: readonly PlanElement[];
  readonly doors: readonly PlanElement[];
}

export interface RoomAreas {
  /** Every space in the model, drawn or not. */
  readonly spaces: readonly Room[];
  /** One plan per storey with rooms, in elevation order, skipped storeys left out. */
  readonly plans: readonly StoreyPlan[];
  /** Rooms on skipped storeys, with the reason. */
  readonly skipped: readonly { readonly room: Room; readonly reason: string }[];
  /** The shared ramp, 0 to hi m², for every plan. */
  readonly hi: number;
  /** The plan extent of every storey together, so all plans share one scale and position. */
  readonly frame: PlanRect;
}

/** Loads the Duplex extracts through `resolve` (a URL in the browser, a path on disk) and lays out the plans. */
export const loadRoomAreas = async (resolve: (file: string) => string): Promise<RoomAreas> => {
  const [elements, parameterRows, bounds] = await Promise.all([
    loadTable(resolve(ELEMENTS)),
    loadTable(resolve(PARAMETERS)),
    loadJson<BoundsFile>(resolve(BOUNDS)),
  ]);
  const params = parametersByElement(parameterRows, ['Area', 'Number', 'Ifc:LongName', 'Ifc:Elevation']);
  const items = elementsWithBounds(elements, bounds);
  const text = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? null : String(v));

  const spaces: Room[] = ofType(items, SPACE).map((s) => {
    const p = s.entityIndex === null ? undefined : params.get(s.entityIndex);
    const area = p?.Area;
    return {
      id: s.id,
      name: text(p?.['Ifc:LongName']) ?? s.name,
      number: text(p?.Number),
      area: typeof area === 'number' ? area : null,
      storey: s.storey,
      box: s.box,
    };
  });

  const elevation = (entityIndex: number) => {
    const e = params.get(entityIndex)?.['Ifc:Elevation'];
    return typeof e === 'number' ? e : null;
  };
  const walls = ofType(items, ...WALLS);
  const doors = ofType(items, DOOR);
  const plans: StoreyPlan[] = [];
  const skipped: { room: Room; reason: string }[] = [];
  for (const { name } of storeys(elements, elevation)) {
    const rooms = spaces.filter((s) => s.storey === name);
    if (rooms.length === 0) continue;
    const reason = SKIPPED.get(name);
    if (reason !== undefined) {
      skipped.push(...rooms.map((room) => ({ room, reason })));
      continue;
    }
    const cut = Math.min(...rooms.map((r) => r.box.min.z)) + CUT_HEIGHT;
    const crossesCut = (e: PlanElement) => e.box.min.z <= cut && e.box.max.z >= cut;
    plans.push({ storey: name, rooms, walls: walls.filter(crossesCut), doors: doors.filter(crossesCut) });
  }

  const drawn = plans.flatMap((p) => [...p.rooms, ...p.walls, ...p.doors]);
  const largest = Math.max(0, ...plans.flatMap((p) => p.rooms.map((r) => r.area ?? 0)));
  return {
    spaces,
    plans,
    skipped,
    hi: Math.max(5, Math.ceil(largest / RAMP_REACH / 5) * 5),
    frame: {
      id: 'frame',
      x0: Math.min(...drawn.map((e) => e.box.min.x)),
      y0: Math.min(...drawn.map((e) => e.box.min.y)),
      x1: Math.max(...drawn.map((e) => e.box.max.x)),
      y1: Math.max(...drawn.map((e) => e.box.max.y)),
      fill: 'none',
      stroke: 'none',
    },
  };
};

const m2 = (area: number) => `${area.toFixed(1)} m²`;

/** The longest of "Name · Number · 12.3 m²", "Number · 12.3 m²", "Number" that fits a room `widthPx` wide. */
export const roomLabel = (room: Room, widthPx: number): string => {
  const size = room.area === null ? 'no Area' : m2(room.area);
  const tiers = room.number === null
    ? [`${room.name} · ${size}`, size, room.name]
    : [`${room.name} · ${room.number} · ${size}`, `${room.number} · ${size}`, room.number];
  return tiers.find((t) => t.length * CHAR_PX + 6 <= widthPx) ?? tiers[tiers.length - 1]!;
};

/** The SVG plan of one storey; `titled` puts the storey name inside the SVG (headless output has no page heading). */
export const storeyPlanSvg = (plan: StoreyPlan, areas: RoomAreas, titled: boolean): string => {
  const { frame, hi } = areas;
  const pxPerMetre = WIDTH / (frame.x1 - frame.x0 + 2 * MARGIN);
  const box = (e: PlanElement, fill: string, title: string): PlanRect => ({
    id: String(e.id),
    x0: e.box.min.x,
    y0: e.box.min.y,
    x1: e.box.max.x,
    y1: e.box.max.y,
    fill,
    stroke: 'none',
    title,
  });
  // Larger rooms first, so a small room that overlaps a large one stays on top.
  const rooms = [...plan.rooms].sort((a, b) => (b.area ?? 0) - (a.area ?? 0));
  const rects: PlanRect[] = [
    frame,
    ...plan.walls.map((w) => ({ ...box(w, tokens.dim, `Wall: ${w.name}`), opacity: 0.45 })),
    ...rooms.map((r) =>
      heatRect(
        String(r.id),
        r.box,
        r.area,
        0,
        hi,
        roomLabel(r, r.box.size.x * pxPerMetre),
        `${r.name}${r.number === null ? '' : ` ${r.number}`}: ${r.area === null ? 'no Area in the model' : m2(r.area)} · box ${r.box.size.x.toFixed(2)} × ${r.box.size.y.toFixed(2)} m`,
      ),
    ),
    ...plan.doors.map((d) => box(d, DOOR_COLOUR, `Door: ${d.name}`)),
  ];
  return planSvg(rects, {
    width: WIDTH,
    margin: MARGIN,
    ...(titled ? { title: plan.storey, subtitle: storeySummary(plan) } : {}),
    legend: { kind: 'ramp', lo: 0, hi, label: 'Room area, m² (PSet_Revit_Dimensions)', format: (v) => `${v} m²` },
    scaleBar: true,
  });
};

/** Doors in a blue from the series palette, so they stand out against the ochre heat ramp. */
const DOOR_COLOUR = series[1]!;

const storeySummary = (plan: StoreyPlan): string => {
  const known = plan.rooms.filter((r) => r.area !== null);
  const total = known.reduce((sum, r) => sum + r.area!, 0);
  return `${plan.rooms.length} rooms · ${m2(total)} in total${known.length < plan.rooms.length ? ` over the ${known.length} with an Area` : ''}`;
};

const roomName = (r: Room) => (r.number === null ? r.name : `${r.name} ${r.number}`);

const caption = (areas: RoomAreas): string => {
  const drawn = areas.plans.flatMap((p) => p.rooms);
  const known = drawn.filter((r) => r.area !== null);
  const top = Math.max(...known.map((r) => r.area!));
  const largest = known.filter((r) => r.area === top);
  const missing = drawn.filter((r) => r.area === null);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return [
    `Largest room: ${largest.map((r) => esc(roomName(r))).join(' and ')}, ${m2(top)}.`,
    `Colour is the modelled Area (PSet_Revit_Dimensions) on one ramp, 0 to ${areas.hi} m², shared by both plans so colours compare.`,
    missing.length === 0
      ? `Every drawn room has an Area.`
      : `No Area in the model, drawn grey: ${missing.map((r) => esc(`${roomName(r)} (${r.storey})`)).join(', ')}.`,
    `Rooms, walls, and doors are drawn as their axis-aligned bounding boxes, not their outlines; walls (grey) and doors (blue) are those whose box crosses a cut ${CUT_HEIGHT} m above the storey's floor.`,
    `The two units repeat room names; numbers starting A and B tell them apart. Hover a room for its box size.`,
    ...areas.skipped.map(({ room, reason }) => `Not drawn: ${esc(roomName(room))} on ${esc(room.storey ?? 'no storey')}, ${room.area === null ? 'no Area' : m2(room.area)}: ${esc(reason)}.`),
  ].join(' ');
};

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts…');
    const areas = await loadRoomAreas((f) => dataUrl(f));
    page.status('');
    const doc = root.ownerDocument;
    const grid = doc.createElement('div');
    grid.className = 'grid';
    for (const plan of areas.plans) {
      const section = doc.createElement('section');
      const heading = doc.createElement('h2');
      heading.textContent = plan.storey;
      heading.style.cssText = 'font-size:16px;margin:0 0 2px';
      const summary = doc.createElement('p');
      summary.textContent = storeySummary(plan);
      summary.style.cssText = `font-size:13px;color:${tokens.dim};margin:0 0 8px`;
      const holder = doc.createElement('div');
      mountSvg(holder, storeyPlanSvg(plan, areas, false));
      section.append(heading, summary, holder);
      grid.appendChild(section);
    }
    page.figure.appendChild(grid);
    page.caption(caption(areas));
  },
  async headless(paths): Promise<HeadlessView[]> {
    const areas = await loadRoomAreas((f) => resolveDataPath(f, paths));
    return areas.plans.map((plan) => ({
      kind: 'drawing',
      title: `${plan.storey}: room areas`,
      rows: plan.rooms.length,
      svg: storeyPlanSvg(plan, areas, true),
    }));
  },
};
