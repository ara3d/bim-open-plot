// The building as boxes: elements joined to their bounds, storeys, spaces,
// doors, and the adjacency that the boxes imply. BOS carries no door-to-room
// relation and no room outline, so every spatial fact here is approximate
// (axis-aligned boxes, overlap tests) and a demo says so in its caption.

import type { Row } from './chart';
import type { Box3, BoundsFile, ElementBounds } from './data';

export interface PlanElement {
  /** STEP id in the IFC file (bounds.json `id`, elements.json `StepId`). */
  readonly id: number;
  readonly entityIndex: number | null;
  readonly globalId: string | null;
  readonly type: string;
  readonly name: string;
  readonly storey: string | null;
  readonly box: Box3;
}

/** elements.json rows joined to bounds.json boxes by STEP id; elements without a box are left out. */
export const elementsWithBounds = (elements: readonly Row[], bounds: BoundsFile): PlanElement[] => {
  const byStep = new Map<number, Row>();
  for (const e of elements) byStep.set(Number(e.StepId), e);
  return bounds.elements.map((b: ElementBounds) => {
    const e = byStep.get(b.id);
    return {
      id: b.id,
      entityIndex: e ? Number(e.EntityIndex) : null,
      globalId: e ? (e.GlobalId as string | null) : null,
      type: b.type,
      name: b.name,
      storey: e ? ((e.StoreyName as string | null) ?? null) : null,
      box: b.bounds,
    };
  });
};

/** Storey names in elevation order, with the elevation when parameters give one (Ifc:Elevation). */
export const storeys = (
  elements: readonly Row[],
  elevationOf?: (entityIndex: number) => number | null,
): { name: string; elevation: number | null }[] =>
  elements
    .filter((e) => e.Category === 'IFCBUILDINGSTOREY')
    .map((e) => ({ name: String(e.Name), elevation: elevationOf?.(Number(e.EntityIndex)) ?? null }))
    .sort((a, b) => (a.elevation ?? 0) - (b.elevation ?? 0));

export const ofType = (items: readonly PlanElement[], ...types: string[]): PlanElement[] =>
  items.filter((i) => types.includes(i.type));

export const onStorey = (items: readonly PlanElement[], storey: string): PlanElement[] =>
  items.filter((i) => i.storey === storey);

/** Spaces, doors, and walls in the Duplex are these IFC classes. */
export const SPACE = 'IFCSPACE';
export const DOOR = 'IFCDOOR';
export const WINDOW = 'IFCWINDOW';
export const WALLS = ['IFCWALLSTANDARDCASE', 'IFCWALL'];

/** True when the two boxes overlap in plan (x and y), with `pad` added around `a`. */
export const overlapsXY = (a: Box3, b: Box3, pad = 0): boolean =>
  a.min.x - pad <= b.max.x && a.max.x + pad >= b.min.x && a.min.y - pad <= b.max.y && a.max.y + pad >= b.min.y;

/** True when the boxes overlap in all three axes, with `pad` around `a`. */
export const overlapsXYZ = (a: Box3, b: Box3, pad = 0): boolean =>
  overlapsXY(a, b, pad) && a.min.z - pad <= b.max.z && a.max.z + pad >= b.min.z;

/** Plan-view distance between two box centres, in model units (metres in the Duplex). */
export const centreDistance = (a: Box3, b: Box3): number => Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y);

export interface DoorSpaces {
  /** The element the link goes through: a door, a stair, or (for an open connection) a stand-in element at the overlap. */
  readonly door: PlanElement;
  readonly kind?: 'door' | 'stair' | 'open';
  /** The spaces whose box, padded, touches the door box on the same storey: usually one or two. */
  readonly spaces: readonly PlanElement[];
}

/**
 * Open connections: two spaces on one storey whose boxes overlap by at least
 * `minArea` m² have no wall between them in the box model (a stair well in a
 * foyer, an alcove off a hall), so a route passes without a door. The link's
 * `door` is a stand-in element at the overlap, with a negative id.
 */
export const openLinks = (spaces: readonly PlanElement[], minArea = 0.5): DoorSpaces[] => {
  const out: DoorSpaces[] = [];
  for (let i = 0; i < spaces.length; i += 1)
    for (let j = i + 1; j < spaces.length; j += 1) {
      const a = spaces[i]!;
      const b = spaces[j]!;
      if (a.storey !== b.storey) continue;
      const x0 = Math.max(a.box.min.x, b.box.min.x);
      const x1 = Math.min(a.box.max.x, b.box.max.x);
      const y0 = Math.max(a.box.min.y, b.box.min.y);
      const y1 = Math.min(a.box.max.y, b.box.max.y);
      if (x1 <= x0 || y1 <= y0 || (x1 - x0) * (y1 - y0) < minArea) continue;
      const z0 = Math.min(a.box.min.z, b.box.min.z);
      const z1 = Math.max(a.box.max.z, b.box.max.z);
      const box: Box3 = {
        min: { x: x0, y: y0, z: z0 },
        max: { x: x1, y: y1, z: z1 },
        center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 },
        size: { x: x1 - x0, y: y1 - y0, z: z1 - z0 },
      };
      out.push({
        kind: 'open',
        door: { id: -(out.length + 1), entityIndex: null, globalId: null, type: 'OPEN', name: `${a.name} / ${b.name}`, storey: a.storey, box },
        spaces: [a, b],
      });
    }
  return out;
};

/** Every connection in the box model: doors, stairs between storeys, and open overlaps. */
export const allLinks = (items: readonly PlanElement[]): DoorSpaces[] => {
  const spaces = ofType(items, SPACE);
  return [
    ...doorSpacePairs(ofType(items, DOOR), spaces).map((p) => ({ ...p, kind: 'door' as const })),
    ...stairLinks(ofType(items, ...STAIRS), spaces).map((p) => ({ ...p, kind: 'stair' as const })),
    ...openLinks(spaces),
  ];
};

/** Which spaces each door connects, by box overlap with `pad` metres of tolerance around the door. */
export const doorSpacePairs = (doors: readonly PlanElement[], spaces: readonly PlanElement[], pad = 0.3): DoorSpaces[] =>
  doors.map((door) => ({
    door,
    spaces: spaces.filter((s) => s.storey === door.storey && overlapsXY(door.box, s.box, pad)),
  }));

/** Doors that touch at most one space: they open to the outside (or to an unmodelled area), so they count as exits. */
export const exteriorDoors = (pairs: readonly DoorSpaces[]): DoorSpaces[] =>
  pairs.filter((p) => p.door.type === DOOR && p.spaces.length <= 1);

/** Stairs carry their box on the flights in the Duplex; the IFCSTAIR assembly has none. */
export const STAIRS = ['IFCSTAIR', 'IFCSTAIRFLIGHT'];

/**
 * Stairs as connectors between storeys: a stair touches, in plan, the spaces
 * on every storey its box overlaps (padded), so a route can go up or down.
 * The result has the same shape as a door pair and joins the same graph.
 */
export const stairLinks = (stairs: readonly PlanElement[], spaces: readonly PlanElement[], pad = 0.5): DoorSpaces[] =>
  stairs.map((stair) => ({
    door: stair,
    spaces: spaces.filter((s) => overlapsXY(stair.box, s.box, pad) && overlapsZ(stair.box, s.box, pad)),
  }));

const overlapsZ = (a: Box3, b: Box3, pad: number): boolean => a.min.z - pad <= b.max.z && a.max.z + pad >= b.min.z;

/** Space-to-space adjacency through doors: each edge carries the door that makes it. */
export const roomGraph = (pairs: readonly DoorSpaces[]): Map<number, { to: number; door: PlanElement }[]> => {
  const graph = new Map<number, { to: number; door: PlanElement }[]>();
  const add = (from: number, to: number, door: PlanElement) => {
    const list = graph.get(from) ?? [];
    list.push({ to, door });
    graph.set(from, list);
  };
  for (const p of pairs)
    for (const a of p.spaces) for (const b of p.spaces) if (a.id !== b.id) add(a.id, b.id, p.door);
  return graph;
};

/** Door hops from any start space to every reachable space (breadth first); starts are at 0. */
export const hopsFrom = (graph: ReadonlyMap<number, readonly { to: number }[]>, starts: readonly number[]): Map<number, number> => {
  const hops = new Map<number, number>();
  const queue: number[] = [];
  for (const s of starts) {
    hops.set(s, 0);
    queue.push(s);
  }
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const edge of graph.get(at) ?? []) {
      if (hops.has(edge.to)) continue;
      hops.set(edge.to, hops.get(at)! + 1);
      queue.push(edge.to);
    }
  }
  return hops;
};

/**
 * Shortest walking distance from each space to an exit, through door centres,
 * as a path of straight segments between door centres (Dijkstra over the door
 * graph). A space with no route gets no entry. Approximate: walls are not
 * avoided inside a room.
 */
export const travelDistances = (
  spaces: readonly PlanElement[],
  pairs: readonly DoorSpaces[],
): Map<number, { distance: number; path: PlanElement[] }> => {
  // Nodes are doors; an exit door has distance 0 at its own centre. A space's
  // distance is the shortest door-to-door chain from any of its doors.
  const doorsOfSpace = new Map<number, DoorSpaces[]>();
  for (const p of pairs) for (const s of p.spaces) doorsOfSpace.set(s.id, [...(doorsOfSpace.get(s.id) ?? []), p]);
  const exits = new Set(exteriorDoors(pairs).map((p) => p.door.id));
  const best = new Map<number, { distance: number; prev: number | null }>();
  const open: { id: number; distance: number }[] = [];
  for (const p of pairs) if (exits.has(p.door.id)) {
    best.set(p.door.id, { distance: 0, prev: null });
    open.push({ id: p.door.id, distance: 0 });
  }
  const byId = new Map(pairs.map((p) => [p.door.id, p] as const));
  while (open.length > 0) {
    open.sort((a, b) => a.distance - b.distance);
    const cur = open.shift()!;
    if (cur.distance > (best.get(cur.id)?.distance ?? Infinity)) continue;
    const here = byId.get(cur.id)!;
    for (const s of here.spaces)
      for (const next of doorsOfSpace.get(s.id) ?? []) {
        if (next.door.id === cur.id) continue;
        const d = cur.distance + centreDistance(here.door.box, next.door.box);
        if (d < (best.get(next.door.id)?.distance ?? Infinity)) {
          best.set(next.door.id, { distance: d, prev: cur.id });
          open.push({ id: next.door.id, distance: d });
        }
      }
  }
  const out = new Map<number, { distance: number; path: PlanElement[] }>();
  for (const s of spaces) {
    let choice: { distance: number; doorId: number } | null = null;
    for (const p of doorsOfSpace.get(s.id) ?? []) {
      const b = best.get(p.door.id);
      if (!b) continue;
      const d = b.distance + centreDistance(s.box, p.door.box);
      if (choice === null || d < choice.distance) choice = { distance: d, doorId: p.door.id };
    }
    if (choice === null) continue;
    const path: PlanElement[] = [];
    for (let at: number | null = choice.doorId; at !== null; at = best.get(at)!.prev) path.push(byId.get(at)!.door);
    out.set(s.id, { distance: choice.distance, path });
  }
  return out;
};
