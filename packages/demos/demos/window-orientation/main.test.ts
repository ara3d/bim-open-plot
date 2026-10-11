// Checks specific to window-orientation: every Duplex window gets one facing,
// the totals match the model's widths and heights, and the facing rule reads
// a box's shape and side as intended.

import { beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { loadJson, loadTable, type Box3, type BoundsFile } from '../../src/data';
import { areaByFacing, facadeRows, facing, orientation, type Orientation } from './main';

const site = resolve(__dirname, '../../public/data/duplex');

const box = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): Box3 => ({
  min: { x: cx - sx / 2, y: cy - sy / 2, z: cz - sz / 2 },
  max: { x: cx + sx / 2, y: cy + sy / 2, z: cz + sz / 2 },
  center: { x: cx, y: cy, z: cz },
  size: { x: sx, y: sy, z: sz },
});

describe('demo window-orientation: classification', () => {
  let o: Orientation;
  beforeAll(async () => {
    o = orientation(
      await loadTable(`${site}/elements.json`),
      await loadTable(`${site}/parameters.json`),
      await loadJson<BoundsFile>(`${site}/bounds.json`),
    );
  });

  it('classifies all 24 windows, each with one facing', () => {
    expect(o.windows).toHaveLength(24);
    expect(o.unboxedWindows).toBe(0);
    for (const w of o.windows) expect(['N', 'E', 'S', 'W', 'Up']).toContain(w.facing);
    const count = (f: string) => o.windows.filter((w) => w.facing === f).length;
    expect([count('N'), count('E'), count('S'), count('W'), count('Up')]).toEqual([5, 6, 5, 6, 2]);
  });

  it('puts every vertical window on one of the four facades and only the two skylights on the roof', () => {
    const up = o.windows.filter((w) => w.facing === 'Up');
    expect(up.map((w) => w.name).every((n) => n.startsWith('M_Skylight'))).toBe(true);
    expect(o.windows.filter((w) => w.facing !== 'Up')).toHaveLength(22);
  });

  it('totals 65.94 m² of window area, every window measured', () => {
    expect(o.windows.every((w) => w.area !== null)).toBe(true);
    const total = o.windows.reduce((s, w) => s + (w.area ?? 0), 0);
    expect(total).toBeCloseTo(65.94, 2);
    const byFacing = Object.fromEntries(areaByFacing(o).map((r) => [r.facing, r.area]));
    expect(byFacing.North).toBeCloseTo(20.31, 2);
    expect(byFacing.East).toBeCloseTo(11.91, 2);
    expect(byFacing.South).toBeCloseTo(20.31, 2);
    expect(byFacing.West).toBeCloseTo(11.91, 2);
    expect(byFacing['Roof (skylights)']).toBeCloseTo(1.49, 2);
  });

  it('finds 12 exterior walls, three per facade, and the window-to-wall ratio per facade', () => {
    expect(o.walls).toHaveLength(12);
    for (const f of ['N', 'E', 'S', 'W']) expect(o.walls.filter((w) => w.facing === f)).toHaveLength(3);
    const wwr = Object.fromEntries(facadeRows(o).filter((r) => r.series === 'Windows').map((r) => [r.facade, r.wwr]));
    expect(wwr.North).toBeCloseTo(0.3615, 3);
    expect(wwr.East).toBeCloseTo(0.1049, 3);
    expect(wwr.South).toBeCloseTo(0.3717, 3);
    expect(wwr.West).toBeCloseTo(0.1063, 3);
  });
});

describe('demo window-orientation: facing rule', () => {
  const model = box(0, 0, 0, 10, 20, 10);
  it('reads a box narrow in x as east or west by its side of the centre', () => {
    expect(facing(box(4.9, 0, 0, 0.4, 2, 2), model)).toBe('E');
    expect(facing(box(-4.9, 0, 0, 0.4, 2, 2), model)).toBe('W');
  });
  it('reads a box narrow in y as north (+y) or south', () => {
    expect(facing(box(0, 9.9, 0, 2, 0.4, 2), model)).toBe('N');
    expect(facing(box(0, -9.9, 0, 2, 0.4, 2), model)).toBe('S');
  });
  it('reads a box thinnest in z as facing up', () => {
    expect(facing(box(0, 0, 5, 1.2, 1.2, 0.2), model)).toBe('Up');
  });
});
