// Installed vs planned: a site superintendent's weekly status on the Duplex
// Apartment. Synthetic install events (data/events.json, made by the rule in
// schedule.ts) are joined by GlobalId to the model's real elements and drawn
// three ways: an S-curve of cumulative planned and installed elements, a bar
// per storey of planned-to-date against installed, and the 3D model coloured
// by each element's state this week.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadJson, loadTable } from '../../src/data';
import { describeScene, keysByStepId, loadModelHeadless, mountScene, rgbOfHex, type Rgb } from '../../src/scene';
import { tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import type { EventsFile } from './schedule';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const MODEL = '/models/duplex-federated.bos';

interface Sources {
  readonly elements: string;
  readonly events: string;
}

const FILES: Sources = { elements: '/data/duplex/elements.json', events: 'data/events.json' };

const mapSources = (f: (file: string) => string): Sources => ({ elements: f(FILES.elements), events: f(FILES.events) });

/**
 * An element's state this week. Installed: planned to date and in. Ahead: in,
 * though planned for a later week. Late: planned to date and not in.
 * Not due: planned for a later week and not in.
 */
export type State = 'installed' | 'ahead' | 'late' | 'not due';

const STATES: readonly State[] = ['installed', 'ahead', 'late', 'not due'];

/** The 3D colour per state; elements not yet due keep only the fade. */
const STATE_COLOR: Readonly<Record<State, string | null>> = {
  installed: tokens.ok,
  ahead: tokens.accent,
  late: tokens.error,
  'not due': null,
};

const STATE_LABEL: Readonly<Record<State, string>> = {
  installed: 'Installed as planned or late',
  ahead: 'Installed ahead of plan',
  late: 'Late: due, not installed',
  'not due': 'Not yet due',
};

const FADE = 0.2;

export const stateOf = (plannedWeek: number, actualWeek: number | null, thisWeek: number): State => {
  const due = plannedWeek <= thisWeek;
  if (actualWeek !== null) return due ? 'installed' : 'ahead';
  return due ? 'late' : 'not due';
};

/** One model element with its synthetic plan and its state this week. */
export interface ElementProgress {
  readonly stepId: number;
  readonly globalId: string;
  readonly ifcClass: string;
  readonly storey: string;
  readonly activity: string;
  readonly plannedWeek: number;
  readonly actualWeek: number | null;
  readonly state: State;
}

export interface Progress {
  readonly thisWeek: number;
  readonly elements: readonly ElementProgress[];
}

/** The events joined to the model's elements by GlobalId; an event with no element is an error in the data. */
export const loadProgress = async (src: Sources): Promise<Progress> => {
  const [elements, file] = await Promise.all([loadTable(src.elements), loadJson<EventsFile>(src.events)]);
  const byGlobalId = new Map(elements.map((e) => [String(e.GlobalId), e] as const));
  return {
    thisWeek: file.thisWeek,
    elements: file.events.map((ev): ElementProgress => {
      const e = byGlobalId.get(ev.globalId);
      if (!e) throw new Error(`events.json: no Duplex element with GlobalId ${ev.globalId}`);
      return {
        stepId: Number(e.StepId),
        globalId: ev.globalId,
        ifcClass: String(e.Category),
        storey: String(e.StoreyName),
        activity: ev.activity,
        plannedWeek: ev.plannedWeek,
        actualWeek: ev.actualWeek,
        state: stateOf(ev.plannedWeek, ev.actualWeek, file.thisWeek),
      };
    }),
  };
};

export const countsByState = (p: Progress): Record<State, number> => {
  const out = Object.fromEntries(STATES.map((s) => [s, 0])) as Record<State, number>;
  for (const e of p.elements) out[e.state] += 1;
  return out;
};

const SERIES = { planned: 'Planned', installed: 'Installed' } as const;
const SERIES_SCALE = { domain: [SERIES.planned, SERIES.installed], range: ['#4f5d78', tokens.ok] };

/**
 * Cumulative elements per week: planned for every week of the plan, installed
 * only up to this week (later weeks have not happened, so they are not drawn).
 */
export const sCurveRows = (p: Progress): Row[] => {
  const lastWeek = Math.max(...p.elements.map((e) => e.plannedWeek));
  const rows: Row[] = [];
  for (let week = 1; week <= lastWeek; week += 1) {
    rows.push({ week, series: SERIES.planned, count: p.elements.filter((e) => e.plannedWeek <= week).length });
    if (week <= p.thisWeek)
      rows.push({ week, series: SERIES.installed, count: p.elements.filter((e) => e.actualWeek !== null && e.actualWeek <= week).length });
  }
  return rows;
};

/** One storey's planned-to-date and installed counts; shortfall is planned minus installed, negative when ahead. */
export interface StoreyProgress {
  readonly storey: string;
  readonly planned: number;
  readonly installed: number;
  readonly shortfall: number;
}

/** Storeys in build order (by their earliest planned week). */
export const storeyProgress = (p: Progress): StoreyProgress[] => {
  const firstWeek = new Map<string, number>();
  for (const e of p.elements) firstWeek.set(e.storey, Math.min(firstWeek.get(e.storey) ?? Infinity, e.plannedWeek));
  return [...firstWeek.keys()]
    .sort((a, b) => firstWeek.get(a)! - firstWeek.get(b)!)
    .map((storey) => {
      const on = p.elements.filter((e) => e.storey === storey);
      const planned = on.filter((e) => e.plannedWeek <= p.thisWeek).length;
      const installed = on.filter((e) => e.actualWeek !== null).length;
      return { storey, planned, installed, shortfall: planned - installed };
    });
};

/** The storey with the largest shortfall, or null when none is behind. */
export const mostBehind = (p: Progress): StoreyProgress | null => {
  const behind = storeyProgress(p).filter((s) => s.shortfall > 0);
  return behind.length === 0 ? null : behind.reduce((a, b) => (b.shortfall > a.shortfall ? b : a));
};

const shortfallLabel = (s: StoreyProgress): string =>
  s.shortfall > 0 ? `${s.shortfall} behind` : s.shortfall < 0 ? `${-s.shortfall} ahead` : 'on plan';

const storeyRows = (p: Progress): Row[] =>
  storeyProgress(p).map((s) => ({ ...s, label: shortfallLabel(s), top: Math.max(s.planned, s.installed) }));

const S_CURVE_TITLE = 'Cumulative elements installed against plan';
const STOREY_TITLE = 'Planned to date and installed, per storey';

const sCurveSpec = (thisWeek: number): TopLevelSpec => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: { text: S_CURVE_TITLE, subtitle: `Duplex Apartment, synthetic events, status at week ${thisWeek}` },
  width: 'container',
  height: 260,
  layer: [
    {
      mark: { type: 'line', point: true },
      encoding: {
        x: { field: 'week', type: 'quantitative', title: 'Week on site', axis: { tickMinStep: 1, format: 'd' } },
        y: { field: 'count', type: 'quantitative', title: 'Elements (cumulative)' },
        color: { field: 'series', type: 'nominal', title: null, scale: SERIES_SCALE, legend: { orient: 'top-left' } },
        tooltip: [{ field: 'series' }, { field: 'week' }, { field: 'count', title: 'Elements' }],
      },
    },
    {
      data: { values: [{ week: thisWeek }] },
      mark: { type: 'rule', color: tokens.changed, strokeWidth: 2, strokeDash: [5, 3] },
      encoding: { x: { field: 'week', type: 'quantitative' } },
    },
    {
      data: { values: [{ week: thisWeek }] },
      mark: { type: 'text', color: tokens.changed, align: 'left', baseline: 'top', dx: 4, dy: 2 },
      encoding: { x: { field: 'week', type: 'quantitative' }, y: { value: 0 }, text: { value: `This week (${thisWeek})` } },
    },
  ],
});

const storeySpec: TopLevelSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: { text: STOREY_TITLE, subtitle: 'Labels: elements behind or ahead of plan at this week' },
  width: 'container',
  height: 260,
  encoding: { x: { field: 'storey', type: 'nominal', title: null, sort: null, axis: { labelAngle: 0 } } },
  layer: [
    {
      transform: [
        { fold: ['planned', 'installed'], as: ['key', 'count'] },
        { calculate: `datum.key === 'planned' ? '${SERIES.planned} to date' : '${SERIES.installed}'`, as: 'series' },
      ],
      mark: 'bar',
      encoding: {
        xOffset: { field: 'series', type: 'nominal', sort: [`${SERIES.planned} to date`, SERIES.installed] },
        y: { field: 'count', type: 'quantitative', title: 'Elements' },
        color: {
          field: 'series',
          type: 'nominal',
          title: null,
          scale: { ...SERIES_SCALE, domain: [`${SERIES.planned} to date`, SERIES.installed] },
          legend: { orient: 'top-left' },
        },
        tooltip: [{ field: 'storey' }, { field: 'series' }, { field: 'count', title: 'Elements' }],
      },
    },
    {
      mark: { type: 'text', baseline: 'bottom', dy: -4, fontWeight: 600 },
      encoding: {
        y: { field: 'top', type: 'quantitative' },
        text: { field: 'label' },
        color: { condition: { test: 'datum.shortfall > 0', value: tokens.error }, value: tokens.dim },
      },
    },
  ],
};

/** What the 3D view colours: one layer per state, with its element count and colour. */
const sceneLayers = (p: Progress) => {
  const counts = countsByState(p);
  return STATES.map((s) => ({ name: STATE_LABEL[s], elements: counts[s], legend: STATE_COLOR[s] ?? `faded to ${FADE * 100}%` }));
};

const stateColors = (p: Progress): Map<number, Rgb> => {
  const out = new Map<number, Rgb>();
  for (const e of p.elements) {
    const hex = STATE_COLOR[e.state];
    if (hex) out.set(e.stepId, rgbOfHex(hex));
  }
  return out;
};

const legendHtml = (p: Progress): string => {
  const counts = countsByState(p);
  const swatch = (s: State) => {
    const fill = STATE_COLOR[s] ?? tokens.border;
    return `<span style="display:inline-block;width:12px;height:12px;border-radius:2px;margin-right:6px;vertical-align:-1px;background:${fill}"></span>`;
  };
  return STATES.map((s) => `<span style="margin-right:16px;white-space:nowrap">${swatch(s)}${STATE_LABEL[s]}: ${counts[s]}</span>`).join('');
};

const caption = (p: Progress): string => {
  const counts = countsByState(p);
  const planned = p.elements.filter((e) => e.plannedWeek <= p.thisWeek).length;
  const installed = counts.installed + counts.ahead;
  const worst = mostBehind(p);
  return [
    `Week ${p.thisWeek}: ${installed} elements installed against ${planned} planned to date (${counts.ahead} of them ahead of plan); ${counts.late} are late.`,
    worst ? `${worst.storey} is furthest behind, ${worst.shortfall} elements short.` : 'No storey is behind.',
    'The install events are synthetic, made by a stated rule (see this demo\'s README); the element list, classes, and storeys are the Duplex model\'s own.',
    'Spaces, openings, and spatial containers are not installed and are not counted.',
  ].join(' ');
};

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex elements and the install events…');
    const progress = await loadProgress(mapSources(dataUrl));
    const doc = root.ownerDocument;
    const grid = doc.createElement('div');
    grid.className = 'grid';
    const curveEl = doc.createElement('div');
    const storeyEl = doc.createElement('div');
    grid.append(curveEl, storeyEl);
    const sceneEl = doc.createElement('div');
    sceneEl.style.marginTop = '16px';
    const legend = doc.createElement('div');
    legend.style.cssText = `font-size:13px;color:${tokens.dim};margin-top:8px`;
    legend.innerHTML = legendHtml(progress);
    page.figure.append(grid, sceneEl, legend);
    await renderVegaLite(curveEl, sCurveSpec(progress.thisWeek), sCurveRows(progress));
    await renderVegaLite(storeyEl, storeySpec, storeyRows(progress));
    page.caption(caption(progress));
    page.status('Loading the 3D model…');
    try {
      const scene = await mountScene(sceneEl, dataUrl(MODEL));
      page.status('');
      if (!scene) {
        const counts = countsByState(progress);
        sceneEl.textContent =
          `The 3D view needs WebGL, which this browser does not offer. It would show ${MODEL.slice(MODEL.lastIndexOf('/') + 1)} ` +
          `faded, with ${counts.installed} installed elements in green, ${counts.ahead} ahead of plan in ochre, ` +
          `and ${counts.late} late in red; ${counts['not due']} not yet due stay faded.`;
        return;
      }
      scene.fadeAll(FADE);
      scene.colorByStepId(stateColors(progress));
    } catch (err) {
      page.status(`The 3D model did not load: ${(err as Error).message}`, true);
    }
  },
  async headless(paths): Promise<HeadlessView[]> {
    const progress = await loadProgress(mapSources((f) => resolveDataPath(f, paths)));
    const curve = sCurveRows(progress);
    const storeys = storeyRows(progress);
    const loaded = await loadModelHeadless(resolveDataPath(MODEL, paths));
    const keys = keysByStepId(loaded);
    const inModel = progress.elements.filter((e) => keys.has(e.stepId)).length;
    return [
      { kind: 'chart', title: S_CURVE_TITLE, rows: curve.length, svg: await vegaLiteToSvg({ ...sCurveSpec(progress.thisWeek), width: 560 } as TopLevelSpec, curve) },
      { kind: 'chart', title: STOREY_TITLE, rows: storeys.length, svg: await vegaLiteToSvg({ ...storeySpec, width: 560 } as TopLevelSpec, storeys) },
      {
        kind: 'scene3d',
        title: 'Elements by install state',
        rows: progress.elements.length,
        description: { ...describeScene(MODEL, sceneLayers(progress)), thisWeek: progress.thisWeek, fade: FADE, inModel },
      },
    ];
  },
};
