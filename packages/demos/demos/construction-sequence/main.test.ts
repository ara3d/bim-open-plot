// The construction-sequence demo's numbers on the Duplex: the committed
// schedule is exactly what the rule in schedule.ts makes from elements.json
// (rerun with -u to rewrite data/schedule.json after changing the rule),
// every built element has a week, and the critical path runs through the
// finishing trades. The describe name matches the shared test's
// "demo construction-sequence" filter.

import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDataPath } from '../../src/demo';
import { loadTable } from '../../src/data';
import { NOT_BUILT, buildSchedule, scheduleJson } from './schedule';
import { cumulativeRows, demo, loadSchedule, todayWeek } from './main';

const dataRoot = dirname(fileURLToPath(import.meta.url));
const paths = { dataRoot, siteRoot: resolve(dataRoot, '../../public') };

describe('demo construction-sequence: schedule rule', async () => {
  const elements = await loadTable(resolveDataPath('/data/duplex/elements.json', paths));
  const schedule = buildSchedule(elements);

  it('data/schedule.json is what the rule makes from elements.json', async () => {
    await expect(scheduleJson(schedule)).toMatchFileSnapshot('./data/schedule.json');
    expect(await loadSchedule(resolveDataPath('data/schedule.json', paths))).toEqual(JSON.parse(scheduleJson(schedule)));
  });

  it('has 14 activities over 24 weeks', () => {
    expect(schedule.activities).toHaveLength(14);
    expect(schedule.weeks).toBe(24);
    expect(todayWeek(schedule)).toBe(12);
  });

  it('gives every one of the 218 built elements a week inside its activity', () => {
    const built = elements.filter((e) => !NOT_BUILT.has(String(e.Category)));
    expect(built).toHaveLength(218);
    const weekOf = new Map(schedule.elements.map((e) => [e.stepId, e]));
    expect(built.filter((e) => !weekOf.has(Number(e.StepId)))).toEqual([]);
    expect(schedule.elements).toHaveLength(218);
    const byId = new Map(schedule.activities.map((a) => [a.id, a]));
    for (const e of schedule.elements) {
      const a = byId.get(e.activity)!;
      expect(e.week).toBeGreaterThan(a.start);
      expect(e.week).toBeLessThanOrEqual(a.end);
    }
  });

  it('puts 11 activities on the critical path, ending with the Level 2 finishing sequence', () => {
    const critical = schedule.activities.filter((a) => a.critical);
    expect(critical).toHaveLength(11);
    expect(critical.map((a) => a.end).reduce((x, y) => Math.max(x, y))).toBe(24);
    expect(critical.map((a) => a.id)).toEqual(expect.arrayContaining(['Level 2/Windows and doors', 'Level 2/Coverings', 'Level 2/Furniture']));
    // A critical chain has no gaps: the critical activities' durations add up to the project length.
    expect(critical.reduce((sum, a) => sum + a.end - a.start, 0)).toBe(24);
  });

  it('ends the cumulative chart at every element built', () => {
    const last = cumulativeRows(schedule).filter((r) => r.week === schedule.weeks);
    expect(last.reduce((sum, r) => sum + Number(r.built), 0)).toBe(218);
  });

  it('draws the Gantt with a today rule and colours every scheduled element in the 3D view', async () => {
    const views = await demo.headless(paths);
    expect(views.map((v) => v.kind)).toEqual(['chart', 'chart', 'scene3d']);
    expect(views[0]!.rows).toBe(14);
    expect(views[0]!.svg).toContain('today, week 12 (illustrative)');
    expect(views[0]!.svg).toContain('Level 2 · Furniture');
    expect(views[0]!.svg).toContain('>critical<');
    expect(views[2]!.rows).toBe(218);
    const layers = views[2]!.description!.layers as { elements: number }[];
    expect(layers[0]!.elements).toBe(218);
  });
});
