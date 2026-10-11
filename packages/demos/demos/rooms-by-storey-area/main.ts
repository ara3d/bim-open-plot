// Floor area by storey and room, from the Duplex Apartment extracts: a
// stacked bar per storey (one segment per space, the storey total at the
// bar end) and the spaces ranked by area with the two apartment units side
// by side. Every number is a model value; nothing is measured from geometry.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadTable, parametersByElement } from '../../src/data';
import { storeys as storeysByElevation } from '../../src/building';
import { diverging, heat, series, tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const ELEMENTS = '/data/duplex/elements.json';
const PARAMETERS = '/data/duplex/parameters.json';

/** The parameters this demo reads, each from the one property set that carries it. */
const WANTED: Readonly<Record<string, string>> = {
  Area: 'PSet_Revit_Dimensions',
  Number: 'PSet_Revit_Identity Data',
  OccupancyZoneName: 'PSet_Revit_Other',
  'Ifc:Elevation': 'IFCBUILDINGSTOREY',
};

/** One IFCSPACE: its storey, room number, apartment unit, and Area in m² (null when the model has none). */
export interface Room {
  readonly entityIndex: number;
  readonly name: string;
  readonly number: string | null;
  readonly storey: string | null;
  /** "Unit A" or "Unit B" from the space's OccupancyZoneName; null for a space in no unit (the Roof). */
  readonly unit: string | null;
  readonly area: number | null;
}

/** One storey: its elevation, how many spaces with an Area it holds, and their total (null when it holds none). */
export interface StoreyArea {
  readonly name: string;
  readonly elevation: number | null;
  readonly spaces: number;
  readonly total: number | null;
}

export interface RoomAreas {
  /** Every IFCSPACE, with or without an Area. */
  readonly rooms: readonly Room[];
  /** Every storey, highest elevation first (the order the chart draws them, top to bottom). */
  readonly storeys: readonly StoreyArea[];
}

type Value = string | number | boolean | null | undefined;

const unitOf = (zone: Value): string | null => {
  const m = typeof zone === 'string' ? /^Unit\s+(\S+)/.exec(zone) : null;
  return m ? `Unit ${m[1]}` : null;
};

const numberOrNull = (v: Value): number | null => (typeof v === 'number' ? v : null);
const textOrNull = (v: Value): string | null => (v === null || v === undefined ? null : String(v));

/** Spaces and storey totals from the elements and parameters tables. */
export const roomAreas = (elements: readonly Row[], parameters: readonly Row[]): RoomAreas => {
  const params = parametersByElement(parameters.filter((r) => WANTED[String(r.Name)] === r.ParameterGroup));
  const rooms: Room[] = elements
    .filter((e) => e.Category === 'IFCSPACE')
    .map((e) => {
      const p = params.get(Number(e.EntityIndex));
      return {
        entityIndex: Number(e.EntityIndex),
        name: String(e.Name),
        number: textOrNull(p?.Number),
        storey: textOrNull(e.StoreyName),
        unit: unitOf(p?.OccupancyZoneName),
        area: numberOrNull(p?.Area),
      };
    });
  const known = storeysByElevation(elements, (id) => numberOrNull(params.get(id)?.['Ifc:Elevation']));
  // A space on a storey the elements table does not list still gets a row, below the known ones.
  const extra = [...new Set(rooms.map((r) => r.storey ?? 'no storey'))].filter((s) => !known.some((k) => k.name === s));
  const order = [...known.reverse(), ...extra.map((name) => ({ name, elevation: null }))];
  const storeys = order.map(({ name, elevation }) => {
    const measured = rooms.filter((r) => (r.storey ?? 'no storey') === name && r.area !== null);
    return {
      name,
      elevation,
      spaces: measured.length,
      total: measured.length === 0 ? null : measured.reduce((sum, r) => sum + r.area!, 0),
    };
  });
  return { rooms, storeys };
};

const m2 = (v: number): string => `${v.toFixed(1)} m²`;

/** Twelve distinct room names in the Duplex; the brand series has eight, so four tints from the theme follow. */
const roomPalette = [...series, heat[1]!, diverging[1]!, diverging[3]!, heat[4]!];

/** Figure 1 rows: one per measured space (kind 'room') and one per storey for the total label (kind 'total'). */
const storeyRows = (a: RoomAreas): Row[] => [
  ...a.rooms
    .filter((r) => r.area !== null)
    .sort((x, y) => (x.unit ?? '~').localeCompare(y.unit ?? '~') || x.name.localeCompare(y.name))
    .map((r, i) => ({
      kind: 'room',
      storey: r.storey ?? 'no storey',
      room: r.name,
      number: r.number,
      unit: r.unit ?? 'no unit',
      area: r.area,
      order: i,
    })),
  ...a.storeys.map((s) => ({
    kind: 'total',
    storey: s.name,
    label: s.total === null ? 'no spaces' : m2(s.total),
    // Where the label sits, not a measure: a storey with no spaces has its label at the axis.
    labelX: s.total ?? 0,
  })),
];

const storeySpec = (a: RoomAreas): TopLevelSpec => {
  const order = a.storeys.map((s) => s.name);
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    data: { values: [] }, // replaced by the rows at render time
    title: {
      text: 'Floor area by storey',
      subtitle: 'Duplex Apartment · one segment per space · Area from PSet_Revit_Dimensions, m²',
    },
    width: 'container',
    height: 200,
    encoding: {
      y: { field: 'storey', type: 'nominal', title: null, scale: { domain: order }, sort: order },
    },
    layer: [
      {
        transform: [{ filter: "datum.kind === 'room'" }],
        mark: { type: 'bar', stroke: tokens.surface, strokeWidth: 1 },
        encoding: {
          x: { field: 'area', type: 'quantitative', title: 'Area (m²)', stack: 'zero' },
          color: { field: 'room', type: 'nominal', title: 'Space', scale: { range: roomPalette } },
          order: { field: 'order', type: 'quantitative' },
          tooltip: [
            { field: 'room', title: 'Space' },
            { field: 'unit', title: 'Unit' },
            { field: 'number', title: 'Number' },
            { field: 'storey', title: 'Storey' },
            { field: 'area', title: 'Area (m²)', type: 'quantitative', format: '.1f' },
          ],
        },
      },
      {
        transform: [{ filter: "datum.kind === 'total'" }],
        mark: { type: 'text', align: 'left', dx: 6, fontWeight: 600 },
        encoding: {
          x: { field: 'labelX', type: 'quantitative' },
          text: { field: 'label' },
        },
      },
    ],
  } as TopLevelSpec;
};

/** Figure 2 rows: the spaces that belong to a unit and have an Area. */
const unitRows = (a: RoomAreas): Row[] =>
  a.rooms
    .filter((r) => r.unit !== null && r.area !== null)
    .map((r) => ({ room: r.name, unit: r.unit, number: r.number, storey: r.storey, area: r.area }));

const unitSpec: TopLevelSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: {
    text: 'Spaces ranked by area, unit by unit',
    subtitle: "Unit from each space's OccupancyZoneName in the model, m²",
  },
  width: 'container',
  height: 340,
  encoding: {
    y: { field: 'room', type: 'nominal', title: null, sort: { field: 'area', op: 'max', order: 'descending' } },
    yOffset: { field: 'unit', type: 'nominal' },
    x: { field: 'area', type: 'quantitative', title: 'Area (m²)' },
    tooltip: [
      { field: 'room', title: 'Space' },
      { field: 'unit', title: 'Unit' },
      { field: 'number', title: 'Number' },
      { field: 'storey', title: 'Storey' },
      { field: 'area', title: 'Area (m²)', type: 'quantitative', format: '.2f' },
    ],
  },
  layer: [
    {
      mark: 'bar',
      encoding: { color: { field: 'unit', type: 'nominal', title: 'Unit', scale: { range: [series[0]!, series[1]!] } } },
    },
    {
      mark: { type: 'text', align: 'left', dx: 4, fontSize: 10, color: tokens.dim },
      encoding: { text: { field: 'area', type: 'quantitative', format: '.1f' } },
    },
  ],
};

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The caption under both charts: coverage, the largest storey, and where the unit comes from. */
export const caption = (a: RoomAreas): string => {
  const measured = a.rooms.filter((r) => r.area !== null);
  const missing = a.rooms.filter((r) => r.area === null);
  const parts = [
    `${measured.length} of ${a.rooms.length} spaces have an Area in PSet_Revit_Dimensions; ` +
      (missing.length === 0
        ? 'none is missing one.'
        : `${plural(missing.length, 'space has', 'spaces have')} none and ${missing.length === 1 ? 'is' : 'are'} left out (${missing.map((r) => r.number ?? r.name).join(', ')}).`),
  ];
  const ranked = a.storeys.filter((s) => s.total !== null).sort((x, y) => y.total! - x.total!);
  const top = ranked[0];
  if (top) {
    const only = top.spaces === 1 ? measured.find((r) => r.storey === top.name) : undefined;
    parts.push(
      only
        ? `${top.name} carries the most, ${m2(top.total!)}, but that is the single space "${only.name}" (${only.number ?? 'no number'}).`
        : `${top.name} carries the most, ${m2(top.total!)} in ${top.spaces} spaces.`,
    );
    const rooms = ranked.find((s) => s.spaces > 1);
    if (only && rooms) parts.push(`Of the storeys with rooms, ${rooms.name} leads with ${m2(rooms.total!)} in ${rooms.spaces} spaces.`);
  }
  const empty = a.storeys.filter((s) => s.total === null).map((s) => s.name);
  if (empty.length > 0) parts.push(`${empty.join(', ')} ${empty.length === 1 ? 'holds' : 'hold'} no spaces.`);
  const noUnit = measured.filter((r) => r.unit === null);
  parts.push(
    "Unit A and Unit B come from each space's OccupancyZoneName in the model; " +
      (noUnit.length === 0
        ? 'every space is in a unit.'
        : `${plural(noUnit.length, 'space is', 'spaces are')} in no unit (${noUnit.map((r) => r.name).join(', ')}) and left out of the ranking.`),
  );
  return parts.join(' ');
};

const load = async (path: (file: string) => string): Promise<RoomAreas> =>
  roomAreas(await loadTable(path(ELEMENTS)), await loadTable(path(PARAMETERS)));

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts…');
    const areas = await load((f) => dataUrl(f));
    page.status('');
    const doc = root.ownerDocument;
    const storeyEl = doc.createElement('div');
    const unitEl = doc.createElement('div');
    unitEl.style.marginTop = '24px';
    page.figure.append(storeyEl, unitEl);
    await renderVegaLite(storeyEl, storeySpec(areas), storeyRows(areas));
    await renderVegaLite(unitEl, unitSpec, unitRows(areas));
    page.caption(caption(areas));
  },
  async headless(paths): Promise<HeadlessView[]> {
    const areas = await load((f) => resolveDataPath(f, paths));
    const byStorey = storeyRows(areas);
    const byUnit = unitRows(areas);
    return [
      {
        kind: 'chart',
        title: 'Floor area by storey',
        rows: byStorey.filter((r) => r.kind === 'room').length,
        svg: await vegaLiteToSvg({ ...storeySpec(areas), width: 640 } as TopLevelSpec, byStorey),
      },
      {
        kind: 'chart',
        title: 'Spaces ranked by area, unit by unit',
        rows: byUnit.length,
        svg: await vegaLiteToSvg({ ...unitSpec, width: 640 } as TopLevelSpec, byUnit),
      },
    ];
  },
};
