// The rooms of the Duplex's living storeys as boxes, each with the window
// glazing on its four sides. The synthetic readings (rule.ts) are shaped by
// this exposure, and the plans draw the same rooms and windows.

import type { Box3, BoundsFile } from '../../src/data';
import { loadJson, loadTable, parametersByElement } from '../../src/data';
import { SPACE, WINDOW, elementsWithBounds, ofType, type PlanElement } from '../../src/building';

/** The storeys people live on; T/FDN holds no rooms and Roof is the roof space. */
export const LIVING_STOREYS = ['Level 1', 'Level 2'] as const;

/** Model +y is taken as north; the IFC's true-north angle is not applied. */
export type Facade = 'north' | 'east' | 'south' | 'west';
export const FACADES: readonly Facade[] = ['north', 'east', 'south', 'west'];

/** Glazed area in m² per facade. */
export type Exposure = Readonly<Record<Facade, number>>;

export interface Room {
  /** STEP id of the IfcSpace: the key of every reading. */
  readonly id: number;
  /** Identity Data Number (A102, B202): the two units reuse room names, so labels lead with it. */
  readonly number: string;
  readonly name: string;
  readonly storey: string;
  readonly box: Box3;
  /** Plan area of the bounding box, m². */
  readonly planArea: number;
  readonly exposure: Exposure;
}

export interface Window {
  readonly id: number;
  readonly storey: string;
  readonly box: Box3;
  readonly facade: Facade;
  /** Width along the wall times height, m². */
  readonly area: number;
  /** STEP id of the room it was assigned to, or null when no room box touches it. */
  readonly room: number | null;
}

export interface RoomModel {
  readonly rooms: readonly Room[];
  readonly windows: readonly Window[];
}

export interface ModelSources {
  readonly elements: string;
  readonly parameters: string;
  readonly bounds: string;
}

export const MODEL_FILES: ModelSources = {
  elements: '/data/duplex/elements.json',
  parameters: '/data/duplex/parameters.json',
  bounds: '/data/duplex/bounds.json',
};

/** Metres a window box may sit from a room box, across the wall, and still count as that room's. */
const WALL_GAP = 0.3;

const overlap = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const gap = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, b0 - a1, a0 - b1);

/** How much of the window's length runs along the room's wall, or 0 when the room is not across the wall from it. */
const sharedLength = (w: Box3, room: Box3, alongX: boolean): number =>
  alongX
    ? gap(w.min.y, w.max.y, room.min.y, room.max.y) <= WALL_GAP ? overlap(w.min.x, w.max.x, room.min.x, room.max.x) : 0
    : gap(w.min.x, w.max.x, room.min.x, room.max.x) <= WALL_GAP ? overlap(w.min.y, w.max.y, room.min.y, room.max.y) : 0;

/**
 * Each window goes to the room on its storey that shares the most of its
 * length; its facade is the side of that room it sits on. A window box is
 * thin across its wall, so the thinner plan axis gives the wall direction.
 */
export const assignWindows = (windows: readonly PlanElement[], spaces: readonly PlanElement[]): Window[] =>
  windows.flatMap((w) => {
    if (w.storey === null) return [];
    const alongX = w.box.size.x >= w.box.size.y;
    let best: { room: PlanElement; length: number } | null = null;
    for (const s of spaces) {
      if (s.storey !== w.storey) continue;
      const length = sharedLength(w.box, s.box, alongX);
      if (length > 0 && (best === null || length > best.length)) best = { room: s, length };
    }
    const ref = best?.room.box.center ?? w.box.center;
    const facade: Facade = alongX
      ? w.box.center.y >= ref.y ? 'north' : 'south'
      : w.box.center.x >= ref.x ? 'east' : 'west';
    const length = alongX ? w.box.size.x : w.box.size.y;
    return [{ id: w.id, storey: w.storey, box: w.box, facade, area: length * w.box.size.z, room: best?.room.id ?? null }];
  });

const emptyExposure = (): Record<Facade, number> => ({ north: 0, east: 0, south: 0, west: 0 });

/** The rooms on the living storeys with their window exposure, and the windows they own. */
export const loadRoomModel = async (src: ModelSources): Promise<RoomModel> => {
  const [elements, parameters, bounds] = await Promise.all([
    loadTable(src.elements),
    loadTable(src.parameters),
    loadJson<BoundsFile>(src.bounds),
  ]);
  const numbers = parametersByElement(parameters, ['Number']);
  const placed = elementsWithBounds(elements, bounds).filter(
    (e) => e.storey !== null && (LIVING_STOREYS as readonly string[]).includes(e.storey),
  );
  const spaces = ofType(placed, SPACE);
  const windows = assignWindows(ofType(placed, WINDOW), spaces);
  const exposure = new Map<number, Record<Facade, number>>();
  for (const w of windows) {
    if (w.room === null) continue;
    const e = exposure.get(w.room) ?? emptyExposure();
    e[w.facade] += w.area;
    exposure.set(w.room, e);
  }
  const rooms = spaces.map((s): Room => {
    const n = s.entityIndex === null ? undefined : numbers.get(s.entityIndex)?.Number;
    return {
      id: s.id,
      number: typeof n === 'string' && n !== '' ? n : `#${s.id}`,
      name: s.name,
      storey: s.storey!,
      box: s.box,
      planArea: s.box.size.x * s.box.size.y,
      exposure: exposure.get(s.id) ?? emptyExposure(),
    };
  });
  return { rooms, windows };
};

/** "A102 Living Room": unique across the two units. */
export const roomLabel = (r: Pick<Room, 'number' | 'name'>): string => `${r.number} ${r.name}`;
