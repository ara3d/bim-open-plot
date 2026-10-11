// Window orientation: how much window area faces each compass direction, and
// the window-to-wall ratio per facade, from the Duplex boxes and parameters.
// A window's or wall's box is thin along the wall's normal, so its shape gives
// the axis it faces and its side of the model centre gives the direction.
// Model +y is taken as north: the Duplex IFC has no TrueNorth.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadJson, loadTable, parametersByElement, type Box3, type BoundsFile } from '../../src/data';
import { elementsWithBounds, ofType, WALLS, WINDOW } from '../../src/building';
import { series, tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const ELEMENTS = '/data/duplex/elements.json';
const PARAMETERS = '/data/duplex/parameters.json';
const BOUNDS = '/data/duplex/bounds.json';

/** The four compass facades, plus horizontal glazing (skylights) that faces the sky. */
export type Facing = 'N' | 'E' | 'S' | 'W' | 'Up';
export const FACADES: readonly Facing[] = ['N', 'E', 'S', 'W'];
const FACINGS: readonly Facing[] = [...FACADES, 'Up'];
const LABEL: Readonly<Record<Facing, string>> = { N: 'North', E: 'East', S: 'South', W: 'West', Up: 'Roof (skylights)' };

/** `Exterior` in Revit's wall Function enumeration (0 interior, 1 exterior, 2 foundation, 3 retaining, 4 soffit, 5 core shaft). */
const EXTERIOR_FUNCTION = 1;

/**
 * The direction a thin element faces. A box thinnest in z lies flat and faces
 * up; one narrower in x than in y sits in a north-south wall and faces east
 * when its centre is east of the model centre, else west; otherwise north or
 * south by the same test on y.
 */
export const facing = (box: Box3, model: Box3): Facing => {
  if (box.size.z < Math.min(box.size.x, box.size.y)) return 'Up';
  if (box.size.x < box.size.y) return box.center.x > model.center.x ? 'E' : 'W';
  return box.center.y > model.center.y ? 'N' : 'S';
};

export interface FacingElement {
  readonly name: string;
  readonly storey: string | null;
  readonly facing: Facing;
  /** m²; null when the model gives no width, height, or area for it. */
  readonly area: number | null;
}

export interface Orientation {
  /** Every window in elements.json that has a box. */
  readonly windows: readonly FacingElement[];
  /** Exterior walls (Revit Function = Exterior) that have a box; area is PSet_Revit_Dimensions Area, net of openings. */
  readonly walls: readonly FacingElement[];
  /** Windows in elements.json with no box in bounds.json, so with no facing. */
  readonly unboxedWindows: number;
}

const num = (v: string | number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Classifies every window and exterior wall by facing, with its area in m² (null when not measured). */
export const orientation = (elements: readonly Row[], parameterRows: readonly Row[], bounds: BoundsFile): Orientation => {
  const params = parametersByElement(parameterRows, ['Ifc:OverallWidth', 'Ifc:OverallHeight', 'Area', 'Function']);
  const items = elementsWithBounds(elements, bounds);
  const get = (entityIndex: number | null) => (entityIndex === null ? undefined : params.get(entityIndex));
  const windows = ofType(items, WINDOW).map((w) => {
    const p = get(w.entityIndex);
    // OverallWidth and OverallHeight are in metres here: a "4835mm x 2420mm" window carries 4.835 and 2.42.
    const width = num(p?.['Ifc:OverallWidth']);
    const height = num(p?.['Ifc:OverallHeight']);
    return { name: w.name, storey: w.storey, facing: facing(w.box, bounds.model), area: width !== null && height !== null ? width * height : null };
  });
  const walls = ofType(items, ...WALLS)
    .filter((w) => num(get(w.entityIndex)?.Function) === EXTERIOR_FUNCTION)
    .map((w) => ({ name: w.name, storey: w.storey, facing: facing(w.box, bounds.model), area: num(get(w.entityIndex)?.Area) }));
  const unboxedWindows = elements.filter((e) => e.Category === WINDOW).length - windows.length;
  return { windows, walls, unboxedWindows };
};

/** Sum of the measured areas, or null when none of the elements is measured (and there is at least one). */
const measuredSum = (items: readonly FacingElement[]): number | null => {
  const known = items.filter((i) => i.area !== null);
  return items.length > 0 && known.length === 0 ? null : known.reduce((s, i) => s + i.area!, 0);
};

/** Figure 1 rows: window area and count per facing, N, E, S, W, then skylights. */
export const areaByFacing = (o: Orientation): Row[] =>
  FACINGS.map((f) => {
    const ws = o.windows.filter((w) => w.facing === f);
    return { facing: LABEL[f], kind: f === 'Up' ? 'Horizontal' : 'Facade', area: measuredSum(ws), windows: ws.length };
  }).filter((r) => r.facing !== LABEL.Up || r.windows > 0);

/**
 * Figure 2 rows: per facade, one row for its windows and one for its exterior
 * wall, each with the facade's window-to-wall ratio: window area over gross
 * wall area, taken as the wall's net Area plus the window area in it.
 */
export const facadeRows = (o: Orientation): Row[] =>
  FACADES.flatMap((f) => {
    const win = measuredSum(o.windows.filter((w) => w.facing === f));
    const wall = measuredSum(o.walls.filter((w) => w.facing === f));
    const wwr = win !== null && wall !== null && win + wall > 0 ? win / (win + wall) : null;
    const label = wwr === null ? 'WWR not measured' : `WWR ${Math.round(wwr * 100)}%`;
    const top = Math.max(win ?? 0, wall ?? 0);
    return [
      { facade: LABEL[f], series: 'Windows', area: win, wwr, label, top },
      { facade: LABEL[f], series: 'Exterior wall (net)', area: wall, wwr, label, top },
    ];
  });

const facadeOrder = FACADES.map((f) => LABEL[f]);

const byFacingSpec: TopLevelSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: { text: 'Window area by direction', subtitle: 'Duplex Apartment, m²; model +y taken as north' },
  width: 'container',
  height: 260,
  encoding: {
    x: { field: 'facing', type: 'nominal', title: null, sort: [...facadeOrder, LABEL.Up], axis: { labelAngle: 0 } },
    y: { field: 'area', type: 'quantitative', title: 'Window area (m²)' },
  },
  layer: [
    {
      mark: 'bar',
      encoding: {
        color: { field: 'kind', type: 'nominal', title: null, scale: { domain: ['Facade', 'Horizontal'], range: [series[0]!, series[1]!] } },
        tooltip: [{ field: 'facing' }, { field: 'area', format: '.2f', title: 'm²' }, { field: 'windows' }],
      },
    },
    {
      transform: [{ calculate: "datum.windows + (datum.windows === 1 ? ' window' : ' windows')", as: 'windowsLabel' }],
      mark: { type: 'text', dy: -8, color: tokens.dim },
      encoding: { text: { field: 'windowsLabel', type: 'nominal' } },
    },
  ],
};

const facadeSpec: TopLevelSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: { text: 'Windows against exterior wall, per facade', subtitle: 'm²; label: window-to-wall ratio (WWR)' },
  width: 'container',
  height: 260,
  encoding: { x: { field: 'facade', type: 'nominal', title: null, sort: facadeOrder, axis: { labelAngle: 0 } } },
  layer: [
    {
      mark: 'bar',
      encoding: {
        xOffset: { field: 'series', sort: ['Windows', 'Exterior wall (net)'] },
        y: { field: 'area', type: 'quantitative', title: 'Area (m²)' },
        color: {
          field: 'series',
          type: 'nominal',
          title: null,
          sort: ['Windows', 'Exterior wall (net)'],
          scale: { domain: ['Windows', 'Exterior wall (net)'], range: [series[0]!, series[5]!] },
        },
        tooltip: [{ field: 'facade' }, { field: 'series' }, { field: 'area', format: '.2f', title: 'm²' }, { field: 'label', title: 'ratio' }],
      },
    },
    {
      transform: [{ filter: "datum.series === 'Windows'" }],
      mark: { type: 'text', dy: -8, fontWeight: 600 },
      encoding: { y: { field: 'top', type: 'quantitative' }, text: { field: 'label' } },
    },
  ],
};

const percent = (x: number) => `${Math.round(x * 100)}%`;
const m2 = (x: number | null) => (x === null ? 'not measured' : `${x.toFixed(1)} m²`);

/** The caption: method, approximations, and every window that could not be measured or placed. */
const caption = (o: Orientation): string => {
  const unmeasured = o.windows.filter((w) => w.area === null).map((w) => w.name);
  const wallsUnmeasured = o.walls.filter((w) => w.area === null).map((w) => w.name);
  const total = measuredSum(o.windows);
  const up = o.windows.filter((w) => w.facing === 'Up').length;
  const totals = facadeRows(o)
    .filter((r) => r.series === 'Windows')
    .map((r) => `${String(r.facade)} ${r.wwr === null ? 'not measured' : percent(r.wwr as number)}`)
    .join(', ');
  return [
    `${o.windows.length} windows, ${m2(total)} of glazing; ${o.walls.length} exterior walls (Revit wall Function = Exterior). WWR: ${totals}.`,
    'Orientation is inferred from each box: a window or wall is thin along its normal, so a box narrower in x than in y faces east or west, by which side of the model centre it sits, and otherwise north or south.',
    'Model +y is taken as north: the Duplex IFC has no TrueNorth, so on site every direction may be rotated.',
    `${up} skylight${up === 1 ? '' : 's'} (box thinnest in height) face${up === 1 ? 's' : ''} up and are shown apart, not in any facade.`,
    'Window area is Ifc:OverallWidth × Ifc:OverallHeight (frame size, in metres). Wall area is PSet_Revit_Dimensions Area, which Revit reports net of openings; the ratio takes gross wall as net wall plus window area, so door openings are left out of the gross and the ratio reads slightly high. Roof-level parapets count as exterior wall.',
    unmeasured.length === 0
      ? 'Every window carries a width and a height.'
      : `Not measured (no width or height): ${unmeasured.join(', ')}.`,
    ...(wallsUnmeasured.length > 0 ? [`Exterior walls with no Area, left out: ${wallsUnmeasured.join(', ')}.`] : []),
    ...(o.unboxedWindows > 0 ? [`${o.unboxedWindows} windows have no box in bounds.json and are not placed.`] : []),
  ].join(' ');
};

const load = async (elements: string, parameters: string, bounds: string): Promise<Orientation> =>
  orientation(await loadTable(elements), await loadTable(parameters), await loadJson<BoundsFile>(bounds));

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts…');
    try {
      const o = await load(dataUrl(ELEMENTS), dataUrl(PARAMETERS), dataUrl(BOUNDS));
      page.status('');
      const grid = root.ownerDocument.createElement('div');
      grid.className = 'grid';
      const left = root.ownerDocument.createElement('div');
      const right = root.ownerDocument.createElement('div');
      grid.append(left, right);
      page.figure.appendChild(grid);
      await renderVegaLite(left, byFacingSpec, areaByFacing(o));
      await renderVegaLite(right, facadeSpec, facadeRows(o));
      page.caption(caption(o));
    } catch (e) {
      page.status(`Could not draw: ${(e as Error).message}`, true);
    }
  },
  async headless(paths): Promise<HeadlessView[]> {
    const o = await load(resolveDataPath(ELEMENTS, paths), resolveDataPath(PARAMETERS, paths), resolveDataPath(BOUNDS, paths));
    const fixed = (s: TopLevelSpec) => ({ ...s, width: 480 }) as TopLevelSpec;
    const first = areaByFacing(o);
    const second = facadeRows(o);
    return [
      { kind: 'chart', title: 'Window area by direction', rows: first.length, svg: await vegaLiteToSvg(fixed(byFacingSpec), first) },
      { kind: 'chart', title: 'Windows against exterior wall, per facade', rows: second.length, svg: await vegaLiteToSvg(fixed(facadeSpec), second) },
    ];
  },
};
