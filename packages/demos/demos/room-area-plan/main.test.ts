// Checks specific to the room-area plan: every Duplex space is accounted for,
// each storey plan names its rooms by number, and the largest room is the
// one the model says it is.

import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDataPath } from '../../src/demo';
import { demo, loadRoomAreas, roomLabel, type Room } from './main';

const dataRoot = dirname(fileURLToPath(import.meta.url));
const paths = { dataRoot, siteRoot: resolve(dataRoot, '../../public') };

describe('demo room-area-plan: rooms on the plans', async () => {
  const areas = await loadRoomAreas((f) => resolveDataPath(f, paths));
  const views = await demo.headless(paths);

  it('accounts for all 21 spaces: 10 on each living storey, the Roof space skipped', () => {
    expect(areas.spaces).toHaveLength(21);
    expect(areas.plans.map((p) => [p.storey, p.rooms.length])).toEqual([
      ['Level 1', 10],
      ['Level 2', 10],
    ]);
    expect(areas.skipped.map((s) => s.room.number)).toEqual(['R301']);
    expect(views.map((v) => [v.kind, v.rows])).toEqual([
      ['drawing', 10],
      ['drawing', 10],
    ]);
  });

  it('draws every room number on its own storey plan', () => {
    for (const [i, plan] of areas.plans.entries()) {
      const svg = views[i]!.svg!;
      for (const r of plan.rooms) expect(svg, `${r.number} on ${plan.storey}`).toContain(`${r.number}`);
    }
    expect(views[0]!.svg).toContain('A102');
    expect(views[0]!.svg).not.toContain('A202');
    expect(views[1]!.svg).toContain('B203');
  });

  it('finds the Living Rooms (A102, B102) largest at 30.1 m², with walls and doors drawn', () => {
    const drawn = areas.plans.flatMap((p) => p.rooms);
    const top = Math.max(...drawn.map((r) => r.area ?? 0));
    expect(top).toBeCloseTo(30.14, 2);
    expect(drawn.filter((r) => r.area === top).map((r) => `${r.name} ${r.number}`).sort()).toEqual(['Living Room A102', 'Living Room B102']);
    expect(views[0]!.svg).toContain('Living Room · A102 · 30.1 m²');
    expect(areas.hi).toBe(50);
    for (const p of areas.plans) {
      expect(p.walls.length, `${p.storey} walls`).toBeGreaterThan(10);
      expect(p.doors.length, `${p.storey} doors`).toBeGreaterThan(4);
    }
  });

  it('labels a room without an Area as such and shortens labels to fit', () => {
    const room: Room = { ...areas.plans[0]!.rooms[0]!, name: 'Bathroom 1', number: 'A104', area: null };
    expect(roomLabel(room, 400)).toBe('Bathroom 1 · A104 · no Area');
    expect(roomLabel({ ...room, area: 4 }, 100)).toBe('A104 · 4.0 m²');
    expect(roomLabel({ ...room, area: 4 }, 40)).toBe('A104');
  });
});
