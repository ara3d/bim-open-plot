// The room adjacency network's numbers on the Duplex: edges per kind, the
// rooms with the most connections, components per storey, and agreement
// with roomGraph in src/building.ts. The describe name matches the shared
// test's "demo room-adjacency-network" filter.

import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDataPath } from '../../src/demo';
import { onStorey, roomGraph } from '../../src/building';
import { caption, demo } from './main';
import { chartRows, components, degrees, loadNetwork } from './network';

const dataRoot = dirname(fileURLToPath(import.meta.url));
const paths = { dataRoot, siteRoot: resolve(dataRoot, '../../public') };
const at = (f: string) => resolveDataPath(f, paths);

describe('demo room-adjacency-network: the network', async () => {
  const net = await loadNetwork(at('/data/duplex/elements.json'), at('/data/duplex/bounds.json'), at('/data/duplex/parameters.json'));
  const spaces = net.rooms.map((r) => r.space);
  const deg = degrees(net);

  it('has 21 rooms, each with a room number', () => {
    expect(net.rooms).toHaveLength(21);
    expect(net.rooms.filter((r) => r.number === null)).toEqual([]);
  });

  it('counts 18 door edges, 6 open edges, and 8 stair edges, over 28 distinct room pairs', () => {
    const count = (kind: string) => net.edges.filter((e) => e.kind === kind).length;
    expect({ door: count('door'), open: count('open'), stair: count('stair') }).toEqual({ door: 18, open: 6, stair: 8 });
    expect(new Set(net.edges.map((e) => `${e.a.id}:${e.b.id}`)).size).toBe(28);
    expect(net.edges.filter((e) => e.kind === 'stair').every((e) => e.a.storey !== e.b.storey)).toBe(true);
    expect(net.edges.filter((e) => e.kind !== 'stair').every((e) => e.a.storey === e.b.storey)).toBe(true);
  });

  it('gives both Foyers and both Hallways the highest degree, 6; the Roof has 0', () => {
    const max = Math.max(...deg.values());
    expect(max).toBe(6);
    const top = net.rooms.filter((r) => deg.get(r.space.id) === max).map((r) => `${r.space.name} (${r.space.storey})`).sort();
    expect(top).toEqual(['Foyer (Level 1)', 'Foyer (Level 1)', 'Hallway (Level 2)', 'Hallway (Level 2)']);
    expect(net.rooms.filter((r) => deg.get(r.space.id) === 0).map((r) => r.space.name)).toEqual(['Roof']);
  });

  it('agrees with roomGraph over the same links on every room\'s distinct neighbours', () => {
    const graph = roomGraph(net.links);
    for (const s of spaces) expect(deg.get(s.id), s.name).toBe(new Set((graph.get(s.id) ?? []).map((e) => e.to)).size);
  });

  it('has two components on each living storey, one on the Roof, and two units with the stairs', () => {
    const perStorey = Object.fromEntries(['Level 1', 'Level 2', 'Roof'].map((s) => [s, components(onStorey(spaces, s), net.edges).length]));
    expect(perStorey).toEqual({ 'Level 1': 2, 'Level 2': 2, Roof: 1 });
    const living = spaces.filter((s) => s.storey === 'Level 1' || s.storey === 'Level 2');
    expect(components(living, net.edges).map((c) => c.length)).toEqual([10, 10]);
    expect(components(spaces, net.edges)).toHaveLength(3);
  });

  it('draws one plan with both storeys and every edge kind, and a chart of 21 rooms', async () => {
    const views = await demo.headless(paths);
    expect(views.map((v) => v.kind)).toEqual(['drawing', 'chart']);
    const [plan, chart] = views;
    expect(plan!.rows).toBe(20);
    expect(plan!.svg).toContain('>Level 1<');
    expect(plan!.svg).toContain('>Level 2<');
    expect(plan!.svg).toContain('stroke-dasharray');
    expect(plan!.svg).toContain('Stair flight');
    expect(chart!.rows).toBe(21);
    expect(chartRows(net).map((r) => r.room)).toContain('Foyer A101');
    expect(chart!.svg).toContain('Foyer A101');
  });

  it('states the box-model approximations in the caption', () => {
    const text = caption(net);
    expect(text).toContain('0.3 m tolerance');
    expect(text).toContain('overlapping room boxes');
    expect(text).toContain('form 2 components joined only through the exterior');
    expect(text).toContain('Roof (Roof) has 0 connections');
  });
});
