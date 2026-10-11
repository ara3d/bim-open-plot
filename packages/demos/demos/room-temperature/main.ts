// Room temperature: synthetic hourly readings for one summer day in every
// room of the Duplex's two living storeys, as one plan per storey coloured
// by the reading at a chosen hour (15:00 by default) and a line chart of the
// whole day with the three hottest rooms at 15:00 in colour. Rooms are
// bounding boxes; the readings come from the rule in rule.ts.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadTable } from '../../src/data';
import { heatRect, mountSvg, planSvg, type PlanLine, type PlanRect } from '../../src/plan';
import { series, tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import { FACADES, LIVING_STOREYS, MODEL_FILES, loadRoomModel, roomLabel, type ModelSources, type Room, type Window } from './model';
import { HOURS, RULE } from './rule';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const READINGS_FILE = 'data/readings.json';

/** The hour the plans open on and the chart's highlight is ranked by. */
export const AFTERNOON_HOUR = 15;

/** Illustrative comfort limit for a living space in summer, °C; not a cited standard. */
export const COMFORT_LIMIT = 26;

const HIGHLIGHTED = 3;

export interface RoomReadings {
  readonly room: Room;
  /** 24 readings indexed by hour, or null when the room has no sensor. */
  readonly celsius: readonly number[] | null;
}

export interface TemperatureData {
  readonly rooms: readonly RoomReadings[];
  readonly windows: readonly Window[];
  /** The shared colour range for every plan at every hour, whole degrees. */
  readonly lo: number;
  readonly hi: number;
}

interface Sources extends ModelSources {
  readonly readings: string;
}

const mapSources = (f: (file: string) => string): Sources => ({
  elements: f(MODEL_FILES.elements),
  parameters: f(MODEL_FILES.parameters),
  bounds: f(MODEL_FILES.bounds),
  readings: f(READINGS_FILE),
});

/** The rooms with their day of readings; a room with no reading at some hour counts as having no sensor. */
export const loadTemperatures = async (src: Sources): Promise<TemperatureData> => {
  const [model, readings] = await Promise.all([loadRoomModel(src), loadTable(src.readings)]);
  const byRoom = new Map<number, (number | undefined)[]>();
  for (const r of readings) {
    const list = byRoom.get(Number(r.space)) ?? new Array<number | undefined>(HOURS.length);
    list[Number(r.hour)] = Number(r.celsius);
    byRoom.set(Number(r.space), list);
  }
  const rooms = model.rooms.map((room): RoomReadings => {
    const list = byRoom.get(room.id);
    const complete = list !== undefined && HOURS.every((h) => typeof list[h] === 'number');
    return { room, celsius: complete ? (list as number[]) : null };
  });
  const all = rooms.flatMap((r) => r.celsius ?? []);
  return { rooms, windows: model.windows, lo: Math.floor(Math.min(...all)), hi: Math.ceil(Math.max(...all)) };
};

export const sensed = (data: TemperatureData): (RoomReadings & { celsius: readonly number[] })[] =>
  data.rooms.filter((r): r is RoomReadings & { celsius: readonly number[] } => r.celsius !== null);

/** Rooms ranked hottest first at `hour`. */
export const hottestAt = (data: TemperatureData, hour: number) =>
  [...sensed(data)].sort((a, b) => b.celsius[hour]! - a.celsius[hour]!);

/** The first hour a room is above the comfort limit, or null when it never is. */
export const firstHourAbove = (celsius: readonly number[], limit = COMFORT_LIMIT): number | null => {
  const h = celsius.findIndex((t) => t > limit);
  return h < 0 ? null : h;
};

const hh = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const deg = (t: number) => `${t.toFixed(1)} °C`;

const glazing = (room: Room): string => {
  const sides = FACADES.filter((f) => room.exposure[f] > 0).map((f) => `${f} ${room.exposure[f].toFixed(1)} m²`);
  return sides.length === 0 ? 'no windows' : `windows: ${sides.join(', ')}`;
};

/** The plan of one storey at one hour: rooms on the shared heat ramp, windows as blue strokes. */
export const planFor = (data: TemperatureData, storey: string, hour: number, width = 400): { svg: string; rows: number } => {
  const rooms = data.rooms
    .filter((r) => r.room.storey === storey)
    // Larger boxes first, so a small room inside a larger box (the stair in the foyer) stays visible.
    .sort((a, b) => b.room.planArea - a.room.planArea);
  const rects: PlanRect[] = rooms.map(({ room, celsius }) => {
    const t = celsius?.[hour] ?? null;
    const what = t === null ? 'no sensor' : deg(t);
    return heatRect(
      String(room.id),
      room.box,
      t,
      data.lo,
      data.hi,
      t === null ? `${room.number} no sensor` : `${room.number} ${t.toFixed(1)}°`,
      `${roomLabel(room)}, ${storey}: ${what} at ${hh(hour)}; ${glazing(room)}`,
    );
  });
  const lines: PlanLine[] = data.windows
    .filter((w) => w.storey === storey)
    .map((w) => {
      const b = w.box;
      return b.size.x >= b.size.y
        ? { x0: b.min.x, y0: b.center.y, x1: b.max.x, y1: b.center.y, stroke: series[1]!, width: 3 }
        : { x0: b.center.x, y0: b.min.y, x1: b.center.x, y1: b.max.y, stroke: series[1]!, width: 3 };
    });
  const svg = planSvg(rects, {
    width,
    title: `${storey} at ${hh(hour)}`,
    subtitle: 'Synthetic readings, °C; north (+y) up; blue = windows',
    lines,
    scaleBar: true,
    legend: { kind: 'ramp', lo: data.lo, hi: data.hi, label: '°C; grey = no sensor', format: (v) => `${v} °C` },
  });
  return { svg, rows: rects.length };
};

/** One row per reading, with the room's label and whether it is among the hottest at AFTERNOON_HOUR. */
export const chartRows = (data: TemperatureData): Row[] => {
  const top = new Set(hottestAt(data, AFTERNOON_HOUR).slice(0, HIGHLIGHTED).map((r) => r.room.id));
  return sensed(data).flatMap(({ room, celsius }) =>
    HOURS.map((hour) => ({ room: roomLabel(room), storey: room.storey, hour, celsius: celsius[hour]!, highlight: top.has(room.id) })),
  );
};

const CHART_TITLE = 'Room temperature over one summer day';

/** The axes and tooltip both line layers share. */
const lineAxes = {
  x: {
    field: 'hour',
    type: 'quantitative' as const,
    title: 'Hour of the day',
    scale: { domain: [0, 23] },
    axis: { values: [0, 3, 6, 9, 12, 15, 18, 21], labelExpr: "datum.value + ':00'" },
  },
  y: { field: 'celsius', type: 'quantitative' as const, title: 'Temperature (°C)', scale: { zero: false } },
  tooltip: [
    { field: 'room', title: 'Room' },
    { field: 'storey', title: 'Storey' },
    { field: 'hour', title: 'Hour' },
    { field: 'celsius', title: '°C', format: '.1f' },
  ],
};

const spec = (highlightOrder: readonly string[]): TopLevelSpec => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: {
    text: CHART_TITLE,
    subtitle: `Synthetic hourly readings, one line per room; the ${HIGHLIGHTED} hottest at ${hh(AFTERNOON_HOUR)} in colour`,
  },
  width: 'container',
  height: 300,
  layer: [
    {
      mark: { type: 'line', color: tokens.dim, strokeWidth: 1, opacity: 0.35 },
      encoding: {
        ...lineAxes,
        detail: { field: 'room', type: 'nominal' },
      },
    },
    {
      transform: [{ filter: 'datum.highlight' }],
      mark: { type: 'line', strokeWidth: 2.5, point: true },
      encoding: {
        ...lineAxes,
        color: { field: 'room', type: 'nominal', title: `Hottest at ${hh(AFTERNOON_HOUR)}`, sort: [...highlightOrder] },
      },
    },
    {
      data: { values: [{ limit: COMFORT_LIMIT }] },
      mark: { type: 'rule', color: tokens.error, strokeWidth: 1.5, strokeDash: [5, 3] },
      encoding: { y: { field: 'limit', type: 'quantitative' } },
    },
    {
      data: { values: [{ limit: COMFORT_LIMIT }] },
      mark: { type: 'text', color: tokens.error, align: 'left', baseline: 'bottom', dx: 4, dy: -2 },
      encoding: { x: { value: 0 }, y: { field: 'limit', type: 'quantitative' }, text: { value: `${COMFORT_LIMIT} °C comfort limit (illustrative)` } },
    },
  ],
});

const highlightOrder = (data: TemperatureData): string[] =>
  hottestAt(data, AFTERNOON_HOUR).slice(0, HIGHLIGHTED).map((r) => roomLabel(r.room));

const gainPeaks = FACADES.flatMap((f) => {
  const peak = RULE.gainPeak[f];
  return peak === null ? [] : [`${f} peaks at ${hh(peak)}`];
}).join(', ');

const caption = (data: TemperatureData): string => {
  const top = hottestAt(data, AFTERNOON_HOUR)
    .slice(0, HIGHLIGHTED)
    .map(({ room, celsius }) => {
      const onset = firstHourAbove(celsius);
      return `${roomLabel(room)} ${deg(celsius[AFTERNOON_HOUR]!)} (${onset === null ? `never above ${COMFORT_LIMIT} °C` : `above ${COMFORT_LIMIT} °C from ${hh(onset)}`})`;
    });
  const missing = data.rooms.filter((r) => r.celsius === null).map((r) => roomLabel(r.room));
  return [
    `Hottest at ${hh(AFTERNOON_HOUR)}: ${top.join('; ')}.`,
    `No sensor, drawn grey and left out of the chart: ${missing.length === 0 ? 'none' : missing.join(', ')}.`,
    `<strong>The readings are synthetic</strong>, invented by a stated rule, not measured: a daily curve peaking at ${hh(RULE.base.peakHour)}, plus solar gain from each room's window area per facade (${gainPeaks}, north none), plus ${RULE.wetRoomOffset} °C for bathrooms and utility rooms, plus a fixed ±${RULE.variation} °C wobble (see the README).`,
    `Rooms are axis-aligned bounding boxes, not outlines; model +y is taken as north; a window counts for the room whose box lies across the wall from it.`,
    `The ${COMFORT_LIMIT} °C limit is illustrative.`,
  ].join(' ');
};

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts and the readings…');
    const data = await loadTemperatures(mapSources(dataUrl));
    page.status('');
    const doc = root.ownerDocument;

    const control = doc.createElement('label');
    control.style.cssText = 'display:flex;align-items:center;gap:12px;font-size:14px;margin-bottom:12px';
    const slider = doc.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = String(HOURS.length - 1);
    slider.step = '1';
    slider.value = String(AFTERNOON_HOUR);
    slider.style.flex = '1';
    const shown = doc.createElement('output');
    control.append('Hour', slider, shown);

    const plans = doc.createElement('div');
    plans.className = 'grid';
    const panes = LIVING_STOREYS.map(() => plans.appendChild(doc.createElement('div')));
    const drawPlans = (hour: number) => {
      shown.textContent = hh(hour);
      LIVING_STOREYS.forEach((storey, i) => mountSvg(panes[i]!, planFor(data, storey, hour).svg));
    };
    slider.addEventListener('input', () => drawPlans(Number(slider.value)));

    const chart = doc.createElement('div');
    chart.style.marginTop = '24px';
    page.figure.append(control, plans, chart);
    drawPlans(AFTERNOON_HOUR);
    await renderVegaLite(chart, spec(highlightOrder(data)), chartRows(data));
    page.caption(caption(data));
  },
  async headless(paths): Promise<HeadlessView[]> {
    const data = await loadTemperatures(mapSources((f) => resolveDataPath(f, paths)));
    const plans = LIVING_STOREYS.map((storey): HeadlessView => {
      const { svg, rows } = planFor(data, storey, AFTERNOON_HOUR);
      return { kind: 'drawing', title: `${storey} at ${hh(AFTERNOON_HOUR)}`, rows, svg };
    });
    const rows = chartRows(data);
    const fixed = { ...spec(highlightOrder(data)), width: 640 } as TopLevelSpec;
    return [...plans, { kind: 'chart', title: CHART_TITLE, rows: rows.length, svg: await vegaLiteToSvg(fixed, rows) }];
  },
};
