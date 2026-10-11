// The room adjacency network of the Duplex: one node per space, one edge per
// pair of rooms and kind of connection (door, open overlap, stair flight),
// all inferred from boxes by allLinks in src/building.ts. Degree counts the
// distinct rooms one step away; components use hopsFrom for reachability.

import type { Row } from '../../src/chart';
import { loadJson, loadTable, parametersByElement, type BoundsFile } from '../../src/data';
import { SPACE, allLinks, elementsWithBounds, hopsFrom, ofType, type DoorSpaces, type PlanElement } from '../../src/building';

export type EdgeKind = 'door' | 'open' | 'stair';

/** Two rooms joined by one kind of connection, with every element that makes it (two doors can join the same pair). */
export interface Edge {
  readonly a: PlanElement;
  readonly b: PlanElement;
  readonly kind: EdgeKind;
  readonly via: readonly PlanElement[];
}

/** A space with its room number ("PSet_Revit_Identity Data".Number) and Area (PSet_Revit_Dimensions, m²), each null when the model has none. */
export interface RoomNode {
  readonly space: PlanElement;
  readonly number: string | null;
  readonly area: number | null;
}

export interface Network {
  readonly rooms: readonly RoomNode[];
  readonly edges: readonly Edge[];
  /** Every link the box model found, including exterior doors that touch one room and make no edge. */
  readonly links: readonly DoorSpaces[];
}

/**
 * The edges of one link: every pair of rooms it touches. A stair flight joins
 * only rooms on different storeys; rooms beside a flight on one storey are
 * joined by a door or an open overlap if they are joined at all.
 */
const linkPairs = (link: DoorSpaces): [PlanElement, PlanElement][] => {
  const out: [PlanElement, PlanElement][] = [];
  for (let i = 0; i < link.spaces.length; i += 1)
    for (let j = i + 1; j < link.spaces.length; j += 1) {
      const a = link.spaces[i]!;
      const b = link.spaces[j]!;
      if (link.kind === 'stair' && a.storey === b.storey) continue;
      out.push(a.id < b.id ? [a, b] : [b, a]);
    }
  return out;
};

/** One edge per room pair and kind; the links that repeat a pair are kept in `via`. */
export const edgesOf = (links: readonly DoorSpaces[]): Edge[] => {
  const byKey = new Map<string, { a: PlanElement; b: PlanElement; kind: EdgeKind; via: PlanElement[] }>();
  for (const link of links) {
    const kind = link.kind ?? 'door';
    for (const [a, b] of linkPairs(link)) {
      const key = `${kind}:${a.id}:${b.id}`;
      const edge = byKey.get(key) ?? { a, b, kind, via: [] };
      edge.via.push(link.door);
      byKey.set(key, edge);
    }
  }
  return [...byKey.values()];
};

/** Loads the extracts and builds the network. */
export const loadNetwork = async (elementsPath: string, boundsPath: string, parametersPath: string): Promise<Network> => {
  const items = elementsWithBounds(await loadTable(elementsPath), await loadJson<BoundsFile>(boundsPath));
  const params = parametersByElement(await loadTable(parametersPath), ['Number', 'Area']);
  const rooms = ofType(items, SPACE).map((space): RoomNode => {
    const p = space.entityIndex === null ? undefined : params.get(space.entityIndex);
    const number = p?.Number;
    const area = p?.Area;
    return { space, number: typeof number === 'string' ? number : null, area: typeof area === 'number' ? area : null };
  });
  const links = allLinks(items);
  return { rooms, edges: edgesOf(links), links };
};

/** Room id to the ids of the rooms one edge away, over `edges`. */
export const adjacency = (edges: readonly Edge[]): Map<number, Set<number>> => {
  const out = new Map<number, Set<number>>();
  const add = (from: number, to: number) => out.set(from, (out.get(from) ?? new Set()).add(to));
  for (const e of edges) {
    add(e.a.id, e.b.id);
    add(e.b.id, e.a.id);
  }
  return out;
};

/** Distinct neighbouring rooms per room id; a room with no edge has 0 (a count, not a missing value). */
export const degrees = (net: Network): Map<number, number> => {
  const adj = adjacency(net.edges);
  return new Map(net.rooms.map((r) => [r.space.id, adj.get(r.space.id)?.size ?? 0]));
};

/** Connected components among `rooms` over the edges whose two ends are both in `rooms`. */
export const components = (rooms: readonly PlanElement[], edges: readonly Edge[]): PlanElement[][] => {
  const ids = new Set(rooms.map((r) => r.id));
  const adj = adjacency(edges.filter((e) => ids.has(e.a.id) && ids.has(e.b.id)));
  const graph = new Map([...adj].map(([from, to]) => [from, [...to].map((t) => ({ to: t }))]));
  const seen = new Set<number>();
  const out: PlanElement[][] = [];
  for (const r of rooms) {
    if (seen.has(r.id)) continue;
    const reached = hopsFrom(graph, [r.id]);
    for (const id of reached.keys()) seen.add(id);
    out.push(rooms.filter((x) => reached.has(x.id)));
  }
  return out;
};

/** The label a reader can tell apart: the two units repeat every room name, so the room number goes with it. */
export const roomLabel = (r: RoomNode): string => `${r.space.name} ${r.number ?? `#${r.space.id}`}`;

/** The chart's rows: one per room, with its degree and the count of neighbours per kind. */
export const chartRows = (net: Network): Row[] => {
  const deg = degrees(net);
  const perKind = (kind: EdgeKind) => adjacency(net.edges.filter((e) => e.kind === kind));
  const kinds = { door: perKind('door'), open: perKind('open'), stair: perKind('stair') };
  return net.rooms.map((r) => ({
    room: roomLabel(r),
    storey: r.space.storey ?? 'no storey',
    degree: deg.get(r.space.id) ?? 0,
    doors: kinds.door.get(r.space.id)?.size ?? 0,
    open: kinds.open.get(r.space.id)?.size ?? 0,
    stairs: kinds.stair.get(r.space.id)?.size ?? 0,
    area: r.area,
  }));
};
