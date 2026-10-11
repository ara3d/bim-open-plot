// The box model of the Duplex: elements join to bounds, doors find their
// rooms, exits exist, and the plan renderer draws them.

import { describe, expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadJson, loadTable, type BoundsFile } from '../src/data';
import { DOOR, SPACE, STAIRS, allLinks, doorSpacePairs, elementsWithBounds, exteriorDoors, hopsFrom, ofType, onStorey, roomGraph, stairLinks, storeys, travelDistances } from '../src/building';
import { heatRect, planSvg } from '../src/plan';

const data = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/duplex');

describe('the Duplex as boxes', async () => {
  const elements = await loadTable(`${data}/elements.json`);
  const bounds = await loadJson<BoundsFile>(`${data}/bounds.json`);
  const items = elementsWithBounds(elements, bounds);
  const spaces = ofType(items, SPACE);
  const doors = ofType(items, DOOR);
  const pairs = doorSpacePairs(doors, spaces);

  it('joins every bounded element to its storey', () => {
    expect(items.length).toBe(bounds.elements.length);
    expect(items.filter((i) => i.storey !== null).length).toBeGreaterThan(items.length * 0.9);
    expect(storeys(elements).map((s) => s.name)).toEqual(expect.arrayContaining(['Level 1', 'Level 2']));
  });

  it('has 21 spaces and 14 doors, and every door touches at least one space', () => {
    expect(spaces).toHaveLength(21);
    expect(doors).toHaveLength(14);
    expect(pairs.every((p) => p.spaces.length >= 1)).toBe(true);
  });

  it('finds the two exits and, with the stairs, reaches every room on the two living storeys', () => {
    const exits = exteriorDoors(pairs);
    expect(exits).toHaveLength(2);
    const links = allLinks(items);
    expect(stairLinks(ofType(items, ...STAIRS), spaces).some((l) => l.spaces.length >= 2)).toBe(true);
    const graph = roomGraph(links);
    const starts = exits.flatMap((e) => e.spaces.map((s) => s.id));
    const hops = hopsFrom(graph, starts);
    const living = spaces.filter((s) => s.storey === 'Level 1' || s.storey === 'Level 2');
    const unreached = living.filter((s) => !hops.has(s.id)).map((s) => `${s.name} (${s.storey})`);
    expect(unreached).toEqual([]);
    const travel = travelDistances(spaces, links);
    expect(travel.size).toBe(living.length);
    for (const t of travel.values()) expect(t.distance).toBeGreaterThan(0);
  });

  it('draws a storey plan with a legend', () => {
    const level1 = onStorey(spaces, 'Level 1');
    const svg = planSvg(
      level1.map((s) => heatRect(String(s.id), s.box, s.box.size.x * s.box.size.y, 0, 40, s.name)),
      { title: 'Level 1', legend: { kind: 'ramp', lo: 0, hi: 40, label: 'm²' }, scaleBar: true },
    );
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('Living Room');
    expect(svg).not.toContain('NaN');
  });
});
