// At week 9 the synthetic record puts 96 of the Duplex's 218 built elements
// in against 106 planned: 86 installed, 10 ahead (Level 1 windows and
// doors), 20 late (14 Level 2 walls and beams, 6 roof elements), 102 not due.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTable } from '../../src/data';
import { countsByState, demo, loadProgress, mostBehind, sCurveRows, storeyProgress } from './main';
import { generateEvents } from './schedule';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '../../public');
const sources = { elements: `${site}/data/duplex/elements.json`, events: `${here}/data/events.json` };

describe('demo installed-vs-planned: the progress record', () => {
  it('events.json is exactly what the rule in schedule.ts generates', async () => {
    const elements = await loadTable(sources.elements);
    expect(JSON.parse(readFileSync(sources.events, 'utf8'))).toEqual(generateEvents(elements));
  });

  it('gives each of the 218 built elements one state, and the states sum to the element count', async () => {
    const p = await loadProgress(sources);
    const counts = countsByState(p);
    expect(p.elements).toHaveLength(218);
    expect(new Set(p.elements.map((e) => e.globalId)).size).toBe(218);
    expect(counts).toEqual({ installed: 86, ahead: 10, late: 20, 'not due': 102 });
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(p.elements.length);
  });

  it('has 106 planned and 96 installed cumulatively at week 9, and the installed line stops there', async () => {
    const p = await loadProgress(sources);
    const rows = sCurveRows(p);
    const at = (series: string, week: number) => rows.find((r) => r.series === series && r.week === week)?.count;
    expect(p.thisWeek).toBe(9);
    expect(at('Planned', 9)).toBe(106);
    expect(at('Installed', 9)).toBe(96);
    expect(at('Installed', 10)).toBeUndefined();
    expect(at('Planned', 15)).toBe(218);
  });

  it('finds Level 2 furthest behind, 14 short, with Level 1 10 ahead', async () => {
    const p = await loadProgress(sources);
    expect(storeyProgress(p).map((s) => [s.storey, s.planned, s.installed, s.shortfall])).toEqual([
      ['T/FDN', 14, 14, 0],
      ['Level 1', 47, 57, -10],
      ['Level 2', 39, 25, 14],
      ['Roof', 6, 0, 6],
    ]);
    expect(mostBehind(p)).toMatchObject({ storey: 'Level 2', shortfall: 14 });
  });

  it('describes the 3D view with one layer per state, every element found in the model', async () => {
    const views = await demo.headless({ dataRoot: here, siteRoot: site });
    const scene = views.find((v) => v.kind === 'scene3d')!;
    expect(scene.rows).toBe(218);
    expect(scene.description).toMatchObject({ model: '/models/duplex-federated.bos', thisWeek: 9, inModel: 218 });
    const layers = scene.description!.layers as { name: string; elements: number }[];
    expect(layers.map((l) => l.elements)).toEqual([86, 10, 20, 102]);
    const storeyChart = views.find((v) => v.title.startsWith('Planned to date'))!;
    expect(storeyChart.svg).toContain('14 behind');
    expect(storeyChart.svg).toContain('10 ahead');
  });
});
