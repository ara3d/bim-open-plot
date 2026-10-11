// Door width check: every door's overall width against an illustrative
// 850 mm threshold, as a sorted bar chart and as one plan per living storey
// with the doors coloured pass or fail. Plans are bounding boxes.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadJson, loadTable, parametersByElement, type Box3, type BoundsFile } from '../../src/data';
import { DOOR, SPACE, elementsWithBounds, ofType, onStorey, type PlanElement } from '../../src/building';
import { mountSvg, planSvg, type PlanRect } from '../../src/plan';
import { tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import raw from './demo.json';

const manifest = raw as DemoManifest;

/** Illustrative accessibility threshold; not a cited code clause. */
export const THRESHOLD_MM = 850;

/** The storeys people live on; T/FDN and Roof hold no doors. */
const PLAN_STOREYS = ['Level 1', 'Level 2'] as const;

export type DoorStatus = 'pass' | 'fail' | 'no width';

const STATUS_COLOR: Readonly<Record<DoorStatus, string>> = { pass: tokens.ok, fail: tokens.error, 'no width': tokens.dim };
const STATUS_LABEL: Readonly<Record<DoorStatus, string>> = {
  pass: `Pass (≥ ${THRESHOLD_MM} mm)`,
  fail: `Fail (< ${THRESHOLD_MM} mm)`,
  'no width': 'No width in the model',
};
const STATUSES = Object.keys(STATUS_COLOR) as DoorStatus[];

export interface DoorCheck {
  /** Unique chart label: the type and the Revit element id from the name, "0762 x 2032mm (150173)". */
  readonly label: string;
  readonly name: string;
  readonly storey: string | null;
  /** Ifc:OverallWidth in millimetres, or null when the model gives none. */
  readonly widthMm: number | null;
  readonly status: DoorStatus;
  /** The door's bounding box, or null when bounds.json has none. */
  readonly box: Box3 | null;
}

export interface DoorWidthData {
  readonly doors: readonly DoorCheck[];
  readonly spaces: readonly PlanElement[];
}

interface Sources {
  readonly elements: string;
  readonly parameters: string;
  readonly bounds: string;
}

const FILES: Sources = {
  elements: '/data/duplex/elements.json',
  parameters: '/data/duplex/parameters.json',
  bounds: '/data/duplex/bounds.json',
};

const mapSources = (f: (file: string) => string): Sources => ({
  elements: f(FILES.elements),
  parameters: f(FILES.parameters),
  bounds: f(FILES.bounds),
});

/** Revit names are "Family:Type:Type:ElementId"; the type plus the id tells two doors of one type apart. */
const doorLabel = (name: string): string => {
  const parts = name.split(':');
  return parts.length >= 3 ? `${parts[1]} (${parts[parts.length - 1]})` : name;
};

/** The Duplex export writes lengths in metres (0.864 for the "0864 x 2032mm" type); round to whole millimetres. */
const metresToMm = (m: number): number => Math.round(m * 1000);

const statusOf = (widthMm: number | null): DoorStatus =>
  widthMm === null ? 'no width' : widthMm < THRESHOLD_MM ? 'fail' : 'pass';

/** Every door with its width and box, and every space with its box. */
export const loadDoorWidths = async (src: Sources): Promise<DoorWidthData> => {
  const [elements, parameters, bounds] = await Promise.all([
    loadTable(src.elements),
    loadTable(src.parameters),
    loadJson<BoundsFile>(src.bounds),
  ]);
  const widths = parametersByElement(parameters, ['Ifc:OverallWidth']);
  const placed = elementsWithBounds(elements, bounds);
  const boxByStep = new Map(placed.map((p) => [p.id, p.box] as const));
  const doors = elements
    .filter((e) => e.Category === DOOR)
    .map((e): DoorCheck => {
      const w = widths.get(Number(e.EntityIndex))?.['Ifc:OverallWidth'];
      const widthMm = typeof w === 'number' ? metresToMm(w) : null;
      const name = String(e.Name);
      return {
        label: doorLabel(name),
        name,
        storey: (e.StoreyName as string | null) ?? null,
        widthMm,
        status: statusOf(widthMm),
        box: boxByStep.get(Number(e.StepId)) ?? null,
      };
    });
  return { doors, spaces: ofType(placed, SPACE) };
};

const chartRows = (doors: readonly DoorCheck[]): Row[] =>
  doors
    .filter((d) => d.widthMm !== null)
    .map((d) => ({ door: d.label, name: d.name, storey: d.storey ?? 'no storey', widthMm: d.widthMm, status: d.status }));

const CHART_TITLE = `Door width against ${THRESHOLD_MM} mm`;

const spec: TopLevelSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: { text: CHART_TITLE, subtitle: 'Duplex Apartment, Ifc:OverallWidth in mm, narrowest first' },
  width: 'container',
  height: { step: 22 },
  layer: [
    {
      mark: 'bar',
      encoding: {
        y: { field: 'door', type: 'nominal', title: null, axis: { labelLimit: 240 }, sort: { field: 'widthMm', order: 'ascending' } },
        x: { field: 'widthMm', type: 'quantitative', title: 'Overall width (mm)' },
        color: {
          field: 'status',
          type: 'nominal',
          title: 'Check',
          scale: { domain: STATUSES, range: STATUSES.map((s) => STATUS_COLOR[s]) },
        },
        tooltip: [
          { field: 'name', title: 'Door' },
          { field: 'storey', title: 'Storey' },
          { field: 'widthMm', title: 'Width (mm)', format: '.0f' },
        ],
      },
    },
    {
      data: { values: [{ threshold: THRESHOLD_MM }] },
      mark: { type: 'rule', color: tokens.error, strokeWidth: 2, strokeDash: [5, 3] },
      encoding: { x: { field: 'threshold', type: 'quantitative' } },
    },
    {
      data: { values: [{ threshold: THRESHOLD_MM }] },
      mark: { type: 'text', color: tokens.error, align: 'left', baseline: 'top', dx: 4, dy: 2 },
      encoding: { x: { field: 'threshold', type: 'quantitative' }, y: { value: 0 }, text: { value: `${THRESHOLD_MM} mm` } },
    },
  ],
};

const boxRect = (id: string, box: Box3, fill: string, extra: Partial<PlanRect> = {}): PlanRect => ({
  id,
  x0: box.min.x,
  y0: box.min.y,
  x1: box.max.x,
  y1: box.max.y,
  fill,
  ...extra,
});

const PLAN_WIDTH = 380;

/** One storey's plan: rooms as light labelled boxes, doors as small boxes coloured by their check. */
const storeyPlan = (data: DoorWidthData, storey: string): { svg: string; doors: number } => {
  const rooms = onStorey(data.spaces, storey).map((s) =>
    boxRect(`space-${s.id}`, s.box, tokens.background, { stroke: tokens.dim, label: s.name, title: s.name }),
  );
  const doors = data.doors.filter((d) => d.storey === storey && d.box !== null);
  const doorRects = doors.map((d, i) =>
    boxRect(`door-${i}`, d.box!, STATUS_COLOR[d.status], {
      stroke: tokens.text,
      strokeWidth: 0.5,
      title: `${d.name}: ${d.widthMm === null ? 'no width' : `${d.widthMm} mm`}`,
    }),
  );
  const fails = doors.filter((d) => d.status === 'fail').length;
  const svg = planSvg([...rooms, ...doorRects], {
    width: PLAN_WIDTH,
    title: storey,
    subtitle: `${doors.length} doors, ${fails} below ${THRESHOLD_MM} mm`,
    scaleBar: true,
    legend: {
      kind: 'swatches',
      items: STATUSES.filter((s) => doors.some((d) => d.status === s)).map((s) => ({ label: STATUS_LABEL[s], color: STATUS_COLOR[s] })),
    },
  });
  return { svg, doors: doors.length };
};

const caption = (data: DoorWidthData): string => {
  const fails = data.doors.filter((d) => d.status === 'fail');
  const missing = data.doors.filter((d) => d.status === 'no width');
  const unplaced = data.doors.filter((d) => d.box === null);
  return [
    `${fails.length} of ${data.doors.length} doors are narrower than ${THRESHOLD_MM} mm: ${[...new Set(fails.map((d) => `${d.widthMm} mm`))].join(', ') || 'none'}.`,
    missing.length > 0 ? `${missing.length} with no width in the model: ${missing.map((d) => d.label).join(', ')}.` : '',
    `${THRESHOLD_MM} mm is an illustrative threshold, not a cited code clause.`,
    'Width is the door\'s overall width (Ifc:OverallWidth); the clear opening is narrower by the frame and stop.',
    'The plans are drawn from bounding boxes: rooms and doors are axis-aligned boxes, not outlines.',
    unplaced.length > 0 ? `${unplaced.length} doors have no box and are not drawn.` : '',
  ]
    .filter((s) => s !== '')
    .join(' ');
};

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts…');
    const data = await loadDoorWidths(mapSources(dataUrl));
    page.status('');
    const doc = root.ownerDocument;
    const chartEl = doc.createElement('div');
    const grid = doc.createElement('div');
    grid.className = 'grid';
    page.figure.append(chartEl, grid);
    await renderVegaLite(chartEl, spec, chartRows(data.doors));
    for (const storey of PLAN_STOREYS) {
      const el = doc.createElement('div');
      grid.appendChild(el);
      mountSvg(el, storeyPlan(data, storey).svg);
    }
    page.caption(caption(data));
  },
  async headless(paths): Promise<HeadlessView[]> {
    const data = await loadDoorWidths(mapSources((f) => resolveDataPath(f, paths)));
    const rows = chartRows(data.doors);
    const fixed = { ...spec, width: 640 } as TopLevelSpec;
    const chart: HeadlessView = { kind: 'chart', title: CHART_TITLE, rows: rows.length, svg: await vegaLiteToSvg(fixed, rows) };
    const plans = PLAN_STOREYS.map((storey): HeadlessView => {
      const plan = storeyPlan(data, storey);
      return { kind: 'drawing', title: `${storey}: doors by width`, rows: plan.doors, svg: plan.svg };
    });
    return [chart, ...plans];
  },
};
