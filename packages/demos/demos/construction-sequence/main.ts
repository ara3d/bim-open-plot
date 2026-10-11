// Construction sequence: a Gantt chart of a synthetic schedule over the real
// Duplex storeys and classes, with the critical path outlined, the elements
// built per week, and the 3D model coloured by build week with a week slider.
// The schedule comes from data/schedule.json, which schedule.ts writes by a
// stated rule; this file only draws it.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadJson } from '../../src/data';
import { describeScene, keysByStepId, loadModelHeadless, mountScene, rgbOfHex, type Rgb, type SceneHandle } from '../../src/scene';
import { heat, heatColor, series, tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import { STOREYS, TRADES, type Activity, type Schedule } from './schedule';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const SCHEDULE = 'data/schedule.json';
const MODEL = '/models/duplex-federated.bos';
const TRADE_NAMES = TRADES.map((t) => t.name);
/** Alpha of an element not yet built at the slider's week: a ghost, so the finished part reads against it. */
const GHOST = 0.06;

/** The status date drawn on the Gantt: the middle of the schedule, chosen for illustration, not a real date. */
export const todayWeek = (s: Schedule): number => Math.round(s.weeks / 2);

export const loadSchedule = (url: string): Promise<Schedule> => loadJson<Schedule>(url);

const label = (a: Activity) => `${a.storey} · ${a.trade}`;
const storeyIndex = (a: Activity) => (STOREYS as readonly string[]).indexOf(a.storey);

/** One Gantt row per activity, in start order. */
export const ganttRows = (s: Schedule): Row[] =>
  [...s.activities]
    .sort((a, b) => a.start - b.start || storeyIndex(a) - storeyIndex(b))
    .map((a) => ({
      activity: label(a),
      storey: a.storey,
      trade: a.trade,
      start: a.start,
      end: a.end,
      weeks: a.end - a.start,
      elements: a.elements,
      critical: a.critical,
      path: a.critical ? 'critical' : 'has slack',
      predecessors: a.predecessors.join(', ') || 'none',
    }));

/** Elements built by the end of each week (0 to the project's end), cumulative, per trade; tradeOrder stacks them in building order. */
export const cumulativeRows = (s: Schedule): Row[] => {
  const tradeOf = new Map(s.activities.map((a) => [a.id, a.trade]));
  const rows: Row[] = [];
  for (const trade of TRADE_NAMES) {
    const weeks = s.elements.filter((e) => tradeOf.get(e.activity) === trade).map((e) => e.week);
    if (weeks.length === 0) continue;
    for (let w = 0; w <= s.weeks; w += 1) rows.push({ week: w, trade, tradeOrder: TRADE_NAMES.indexOf(trade), built: weeks.filter((x) => x <= w).length });
  }
  return rows;
};

const tradeColor = { field: 'trade', type: 'nominal', title: 'Trade', scale: { domain: TRADE_NAMES, range: [...series] } } as const;

const ganttSpec = (s: Schedule, order: readonly string[]): TopLevelSpec => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by ganttRows at render time
  title: {
    text: 'Construction schedule, critical path outlined',
    subtitle: `Synthetic schedule over the Duplex storeys and classes; ${s.weeks} weeks; today = week ${todayWeek(s)} (illustrative)`,
  },
  width: 'container',
  height: { step: 20 },
  layer: [
    {
      mark: { type: 'bar', cornerRadius: 2, height: { band: 0.7 } },
      encoding: {
        y: { field: 'activity', type: 'nominal', title: null, sort: [...order] },
        x: { field: 'start', type: 'quantitative', title: 'Week', scale: { domain: [0, s.weeks] }, axis: { tickMinStep: 1 } },
        x2: { field: 'end' },
        color: tradeColor,
        stroke: { field: 'path', type: 'nominal', title: 'Path', scale: { domain: ['critical', 'has slack'], range: [tokens.error, 'transparent'] } },
        strokeWidth: { value: 2.5 },
        tooltip: [
          { field: 'activity' },
          { field: 'start', title: 'starts after week' },
          { field: 'end', title: 'done by end of week' },
          { field: 'elements' },
          { field: 'path' },
          { field: 'predecessors' },
        ],
      },
    },
    {
      data: { values: [{ today: todayWeek(s), text: `today, week ${todayWeek(s)} (illustrative)` }] },
      layer: [
        { mark: { type: 'rule', color: tokens.text, strokeDash: [4, 3] }, encoding: { x: { field: 'today', type: 'quantitative' } } },
        {
          mark: { type: 'text', align: 'left', dx: 4, dy: -6, color: tokens.text, fontSize: 11 },
          encoding: { x: { field: 'today', type: 'quantitative' }, y: { value: 0 }, text: { field: 'text' } },
        },
      ],
    },
  ],
});

const cumulativeSpec = (s: Schedule): TopLevelSpec => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by cumulativeRows at render time
  title: { text: 'Elements built by the end of each week', subtitle: `Cumulative, ${s.elements.length} model elements, stacked by trade` },
  width: 'container',
  height: 220,
  layer: [
    {
      mark: { type: 'area', interpolate: 'linear', opacity: 0.85 },
      encoding: {
        x: { field: 'week', type: 'quantitative', title: 'Week', scale: { domain: [0, s.weeks] }, axis: { tickMinStep: 1 } },
        y: { field: 'built', type: 'quantitative', title: 'Elements built', stack: true },
        color: tradeColor,
        order: { field: 'tradeOrder' },
        tooltip: [{ field: 'week' }, { field: 'trade' }, { field: 'built' }],
      },
    },
    {
      data: { values: [{ today: todayWeek(s) }] },
      mark: { type: 'rule', color: tokens.text, strokeDash: [4, 3] },
      encoding: { x: { field: 'today', type: 'quantitative' } },
    },
  ],
});

/** Colours, by STEP id, of every element built by `week`: the heat ramp from week 1 (pale) to the last week (dark). */
const weekColors = (s: Schedule, upTo: (week: number) => boolean): Map<number, Rgb> =>
  new Map(s.elements.filter((e) => upTo(e.week)).map((e) => [e.stepId, rgbOfHex(heatColor(e.week, 1, s.weeks))]));

const sceneLayers = (s: Schedule, matched: number) => [
  { name: 'Built by week', elements: matched, legend: `heat ramp, week 1 (${heat[0]}) to week ${s.weeks} (${heat[heat.length - 1]})` },
];

/** A gradient bar with the first, middle, and last week under it. */
const legend = (doc: Document, s: Schedule): HTMLElement => {
  const box = doc.createElement('div');
  box.style.cssText = `font-size:12px;color:${tokens.dim};margin:8px 0;max-width:360px`;
  const bar = doc.createElement('div');
  bar.style.cssText = `height:10px;border-radius:3px;background:linear-gradient(to right, ${heat.join(', ')})`;
  const ticks = doc.createElement('div');
  ticks.style.cssText = 'display:flex;justify-content:space-between';
  for (const w of [1, Math.round((1 + s.weeks) / 2), s.weeks]) {
    const t = doc.createElement('span');
    t.textContent = `week ${w}`;
    ticks.appendChild(t);
  }
  box.append('Colour: the week an element is finished', bar, ticks);
  return box;
};

/** The week slider: elements built by the chosen week in their colour, the rest as ghosts. */
const slider = (doc: Document, s: Schedule, scene: SceneHandle): HTMLElement => {
  const row = doc.createElement('label');
  row.style.cssText = `display:flex;align-items:center;gap:12px;font-size:13px;color:${tokens.text};margin:8px 0`;
  const input = doc.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = String(s.weeks);
  input.step = '1';
  input.value = String(s.weeks);
  input.style.flex = '1';
  const text = doc.createElement('span');
  text.style.minWidth = '260px';
  const show = () => {
    const week = Number(input.value);
    const built = s.elements.filter((e) => e.week <= week).length;
    scene.colorByStepId(weekColors(s, (w) => w <= week), 1);
    scene.colorByStepId(weekColors(s, (w) => w > week), GHOST);
    text.textContent = `End of week ${week} of ${s.weeks}: ${built} of ${s.elements.length} elements built`;
  };
  input.addEventListener('input', show);
  show();
  row.append('Week', input, text);
  return row;
};

const section = (parent: HTMLElement): HTMLElement => {
  const el = parent.ownerDocument.createElement('div');
  el.style.marginBottom = '20px';
  parent.appendChild(el);
  return el;
};

const orderOf = (s: Schedule) => ganttRows(s).map((r) => String(r.activity));
const criticalCount = (s: Schedule) => s.activities.filter((a) => a.critical).length;

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the schedule…');
    const s = await loadSchedule(dataUrl(SCHEDULE));
    page.status('');
    await renderVegaLite(section(page.figure), ganttSpec(s, orderOf(s)), ganttRows(s));
    await renderVegaLite(section(page.figure), cumulativeSpec(s), cumulativeRows(s));

    const sceneBox = section(page.figure);
    const caption =
      `The schedule is synthetic: ${s.activities.length} activities over the real element list of the Duplex, ` +
      `built by the rule in this demo's README (one activity per storey and trade, duration from element count, ` +
      `precedence from the building order). ${criticalCount(s)} activities are critical; the project takes ${s.weeks} weeks. ` +
      `Today, week ${todayWeek(s)}, is illustrative.`;
    page.status('Loading the 3D model…');
    const scene = await mountScene(sceneBox, dataUrl(MODEL)).catch((e: unknown) => {
      page.status(`3D view unavailable: ${String(e)}`, true);
      return null;
    });
    if (scene === null) {
      const pre = page.figure.ownerDocument.createElement('pre');
      pre.style.cssText = `font:12px ${tokens.mono};color:${tokens.dim};white-space:pre-wrap`;
      pre.textContent = JSON.stringify(describeScene(MODEL, sceneLayers(s, s.elements.length)), null, 2);
      sceneBox.appendChild(pre);
      page.caption(`${caption} No WebGL here, so the 3D view is described instead of drawn.`);
      return;
    }
    page.status('');
    scene.fadeAll(GHOST);
    sceneBox.append(legend(root.ownerDocument, s), slider(root.ownerDocument, s, scene));
    const matched = s.elements.filter((e) => scene.keys.has(e.stepId)).length;
    page.caption(`${caption} The 3D model shows ${matched} of ${s.elements.length} scheduled elements; drag the week slider to scrub the sequence.`);
  },
  async headless(paths): Promise<HeadlessView[]> {
    const s = await loadSchedule(resolveDataPath(SCHEDULE, paths));
    const loaded = await loadModelHeadless(resolveDataPath(MODEL, paths));
    const keys = keysByStepId(loaded);
    const matched = s.elements.filter((e) => keys.has(e.stepId)).length;
    const gantt = ganttRows(s);
    const cumulative = cumulativeRows(s);
    return [
      {
        kind: 'chart',
        title: 'Construction schedule',
        rows: gantt.length,
        svg: await vegaLiteToSvg({ ...ganttSpec(s, orderOf(s)), width: 640 } as TopLevelSpec, gantt),
      },
      {
        kind: 'chart',
        title: 'Elements built by week',
        rows: cumulative.length,
        svg: await vegaLiteToSvg({ ...cumulativeSpec(s), width: 640 } as TopLevelSpec, cumulative),
      },
      {
        kind: 'scene3d',
        title: 'Model coloured by build week',
        rows: s.elements.length,
        description: describeScene(MODEL, sceneLayers(s, matched)),
      },
    ];
  },
};
