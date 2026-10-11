// The Duplex's two living storeys hold 20 rooms; 18 have a synthetic sensor
// (A105 Stair and B205 Utility have none). At 15:00 the hottest is B202
// Bedroom 1, west-facing, at 27.4 °C, above the 26 °C limit from 14:00.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AFTERNOON_HOUR, demo, firstHourAbove, hottestAt, loadTemperatures, sensed } from './main';
import { loadRoomModel, roomLabel } from './model';
import { RULE, syntheticReadings } from './rule';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '../../public');
const model = {
  elements: `${site}/data/duplex/elements.json`,
  parameters: `${site}/data/duplex/parameters.json`,
  bounds: `${site}/data/duplex/bounds.json`,
};
const sources = { ...model, readings: `${here}/data/readings.json` };

describe('demo room-temperature: the readings and the ranking', () => {
  it('data/readings.json is exactly what the rule produces', async () => {
    const { rooms } = await loadRoomModel(model);
    const file = JSON.parse(readFileSync(sources.readings, 'utf8')) as unknown[];
    expect(file).toEqual(syntheticReadings(rooms));
  });

  it('has 24 readings for 18 of the 20 living-storey rooms; A105 and B205 have no sensor', async () => {
    const data = await loadTemperatures(sources);
    expect(data.rooms).toHaveLength(20);
    expect(sensed(data)).toHaveLength(18);
    for (const r of sensed(data)) expect(r.celsius).toHaveLength(24);
    expect(data.rooms.filter((r) => r.celsius === null).map((r) => roomLabel(r.room)).sort()).toEqual(['A105 Stair', 'B205 Utility']);
  });

  it('ranks B202 Bedroom 1 hottest at 15:00 at 27.4 °C, above 26 °C from 14:00', async () => {
    const data = await loadTemperatures(sources);
    const top = hottestAt(data, AFTERNOON_HOUR).slice(0, 3);
    expect(top.map((r) => [r.room.number, r.celsius[AFTERNOON_HOUR]])).toEqual([
      ['B202', 27.4],
      ['A102', 26.9],
      ['A203', 26.5],
    ]);
    expect(firstHourAbove(top[0]!.celsius)).toBe(14);
  });

  it('draws one plan per living storey with every room, and a chart of 432 readings', async () => {
    const views = await demo.headless({ dataRoot: here, siteRoot: site });
    expect(views.map((v) => [v.kind, v.rows])).toEqual([
      ['drawing', 10],
      ['drawing', 10],
      ['chart', 432],
    ]);
    expect(views[0]!.svg).toContain('A105 no sensor');
    expect(views[1]!.svg).toContain('B202 27.4°');
  });

  it('the manifest note quotes the rule constants', () => {
    const note = (demo.manifest.data.find((d) => d.provenance === 'synthetic')?.note ?? '').replace(/\s+/g, ' ');
    for (const n of [RULE.base.mean, RULE.base.amplitude, RULE.gainPerRatio, RULE.wetRoomOffset, RULE.variation, RULE.spreadHours])
      expect(note).toContain(String(n));
  });
});
