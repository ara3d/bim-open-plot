// Site map: the Duplex footprint placed at its IfcSite latitude and longitude
// on an OpenStreetMap basemap, its Level 1 rooms coloured by name, and the
// owner's other projects nearby (synthetic) coloured by status, with a chart
// of their floor areas by status. The file has no IfcMapConversion or
// TrueNorth, so the rotation is taken as north-up and the page says so.

import type { Feature, FeatureCollection, Point } from 'geojson';
import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadJson, loadTable, type BoundsFile } from '../../src/data';
import { SPACE, elementsWithBounds, ofType, onStorey } from '../../src/building';
import { boxFeature, describeMap, mountMap, type Georeference, type MapLayer } from '../../src/map';
import { series, tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import raw from './demo.json';

const manifest = raw as DemoManifest;

/** The storey whose rooms are drawn inside the footprint. */
export const PLAN_STOREY = 'Level 1';

/** Close enough to show every nearby project (about 3.6 m per pixel at this latitude); scroll to reach the footprint. */
const ZOOM = 15;

/** An IfcCompoundPlaneAngleMeasure: degrees, minutes, seconds, millionths of a second, all with the same sign. */
export type CompoundAngle = readonly [number, number, number, number];

/** data/georeference.json: the IfcSite reference point as typed from the IFC file. */
export interface GeoreferenceFile {
  readonly refLatitude: CompoundAngle;
  readonly refLongitude: CompoundAngle;
  /** Degrees clockwise from north to model +y; 0 when the file states none. */
  readonly rotation: number;
  /** False when the rotation is an assumption, not read from the file. */
  readonly rotationStated: boolean;
  readonly source: string;
}

export const compoundAngleDegrees = ([d, m, s, micro]: CompoundAngle): number => d + m / 60 + (s + micro / 1e6) / 3600;

export const georeferenceOf = (f: GeoreferenceFile): Georeference => ({
  lat: compoundAngleDegrees(f.refLatitude),
  lon: compoundAngleDegrees(f.refLongitude),
  rotation: f.rotation,
  source: f.source,
});

export const STATUSES = ['design', 'construction', 'handover'] as const;
export type ProjectStatus = (typeof STATUSES)[number];

/** One colour per project status, shared by the map circles and the chart bars. */
export const STATUS_COLOR: Readonly<Record<ProjectStatus, string>> = {
  design: series[1]!,
  construction: tokens.changed,
  handover: tokens.ok,
};

/** A nearby project in data/nearby.geojson. */
export interface ProjectProperties {
  readonly name: string;
  readonly status: ProjectStatus;
  /** Gross floor area in m², or null when unknown. */
  readonly floorArea: number | null;
}

export interface SiteMap {
  readonly georeference: Georeference;
  readonly layers: readonly MapLayer[];
  /** The chart rows: one per nearby project, with its distance from the IfcSite point in metres. */
  readonly projects: readonly Row[];
  /** Room name to fill colour for the Level 1 spaces layer. */
  readonly roomColors: Readonly<Record<string, string>>;
  /** The model box in plan, metres. */
  readonly footprintSize: { readonly x: number; readonly y: number };
}

interface Sources {
  readonly elements: string;
  readonly bounds: string;
  readonly georeference: string;
  readonly nearby: string;
}

const FILES: Sources = {
  elements: '/data/duplex/elements.json',
  bounds: '/data/duplex/bounds.json',
  georeference: 'data/georeference.json',
  nearby: 'data/nearby.geojson',
};

/**
 * The same files as browser URLs. The demo's own files use literal
 * `new URL(..., import.meta.url)` so Vite copies them into the build, and
 * the result is an absolute URL that loadText fetches.
 */
const browserSources = (): Sources => ({
  elements: dataUrl(FILES.elements),
  bounds: dataUrl(FILES.bounds),
  georeference: new URL('./data/georeference.json', import.meta.url).href,
  nearby: new URL('./data/nearby.geojson', import.meta.url).href,
});

const collection = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features });

/** Plan distance in metres between a point and the georeference (local tangent plane, as toLonLat). */
export const metresFrom = (g: Georeference, [lon, lat]: readonly number[]): number => {
  const perDegree = (6378137 * Math.PI) / 180;
  const east = (lon! - g.lon) * perDegree * Math.cos((g.lat * Math.PI) / 180);
  const north = (lat! - g.lat) * perDegree;
  return Math.hypot(east, north);
};

export const loadSiteMap = async (src: Sources): Promise<SiteMap> => {
  const [elements, bounds, file, nearby] = await Promise.all([
    loadTable(src.elements),
    loadJson<BoundsFile>(src.bounds),
    loadJson<GeoreferenceFile>(src.georeference),
    loadJson<FeatureCollection<Point, ProjectProperties>>(src.nearby),
  ]);
  const g = georeferenceOf(file);
  const spaces = onStorey(ofType(elementsWithBounds(elements, bounds), SPACE), PLAN_STOREY);
  const rooms = [...new Set(spaces.map((s) => s.name))].sort();
  const roomColors = Object.fromEntries(rooms.map((r, i) => [r, series[i % series.length]!]));
  const layers: MapLayer[] = [
    {
      id: 'footprint',
      kind: 'fill',
      data: collection([boxFeature('footprint', bounds.model, g, { name: 'Duplex Apartment, model bounding box' })]),
      color: tokens.accent,
      opacity: 0.2,
    },
    {
      id: 'level-1-spaces',
      kind: 'fill',
      data: collection(spaces.map((s) => boxFeature(`space-${s.id}`, s.box, g, { room: s.name, storey: s.storey }))),
      colorBy: { property: 'room', colors: roomColors, fallback: tokens.dim },
      opacity: 0.7,
    },
    {
      id: 'nearby-projects',
      kind: 'circle',
      data: nearby,
      colorBy: { property: 'status', colors: STATUS_COLOR, fallback: tokens.dim },
    },
  ];
  const projects = nearby.features.map((f) => ({
    name: f.properties.name,
    status: f.properties.status,
    floorArea: f.properties.floorArea ?? null,
    distance: Math.round(metresFrom(g, f.geometry.coordinates)),
  }));
  return { georeference: g, layers, projects, roomColors, footprintSize: { x: bounds.model.size.x, y: bounds.model.size.y } };
};

const spec: TopLevelSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: { text: 'Floor area of the other projects nearby, by status', subtitle: 'Synthetic portfolio, gross floor area in m²' },
  width: 'container',
  height: 140,
  transform: [{ filter: 'isValid(datum.floorArea)' }],
  mark: { type: 'bar', stroke: tokens.surface, strokeWidth: 1.5 },
  encoding: {
    y: { field: 'status', type: 'nominal', title: null, sort: [...STATUSES] },
    x: { field: 'floorArea', type: 'quantitative', aggregate: 'sum', title: 'Gross floor area (m²)', stack: true },
    color: {
      field: 'status',
      type: 'nominal',
      title: 'Status',
      scale: { domain: [...STATUSES], range: STATUSES.map((s) => STATUS_COLOR[s]) },
    },
    detail: { field: 'name', type: 'nominal' },
    tooltip: [
      { field: 'name', title: 'Project' },
      { field: 'status', title: 'Status' },
      { field: 'floorArea', aggregate: 'sum', title: 'Floor area (m²)', format: ',.0f' },
      { field: 'distance', aggregate: 'min', title: 'Distance from the Duplex (m)', format: ',.0f' },
    ],
  },
};

const featureCount = (layers: readonly MapLayer[]): number => layers.reduce((n, l) => n + l.data.features.length, 0);

const degrees = (value: number, positive: string, negative: string): string =>
  `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;

const caption = (site: SiteMap): string => {
  const g = site.georeference;
  const spaces = site.layers.find((l) => l.id === 'level-1-spaces')!.data.features.length;
  return [
    `Position: the IfcSite latitude and longitude as stated by duplex.ifc (${degrees(g.lat, 'N', 'S')}, ${degrees(g.lon, 'E', 'W')}), not a surveyed point.`,
    `The file has no IfcMapConversion and no TrueNorth, so the rotation is unknown and the map takes model +y as north.`,
    `The outline is the model's bounding box (${site.footprintSize.x.toFixed(1)} m by ${site.footprintSize.y.toFixed(1)} m, exterior slabs included); the coloured rooms are the boxes of the ${spaces} ${PLAN_STOREY} spaces, not their outlines. Scroll to zoom in.`,
    `<strong>The nearby projects are synthetic</strong>: invented names, positions, and floor areas.`,
    `Tiles © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors.`,
  ].join(' ');
};

/** A swatch list under the map: MapLibre draws no legend. */
const legend = (doc: Document, groups: readonly [string, Readonly<Record<string, string>>][]): HTMLElement => {
  const el = doc.createElement('div');
  el.style.cssText = `display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:${tokens.dim};margin:10px 0 0`;
  for (const [title, colors] of groups) {
    const head = doc.createElement('strong');
    head.textContent = `${title}:`;
    el.appendChild(head);
    for (const [label, color] of Object.entries(colors)) {
      const item = doc.createElement('span');
      const swatch = doc.createElement('span');
      swatch.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;background:${color}`;
      item.append(swatch, label);
      el.appendChild(item);
    }
  }
  return el;
};

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    const doc = root.ownerDocument;
    try {
      page.status('Loading the Duplex extracts, the georeference, and the nearby projects…');
      const site = await loadSiteMap(browserSources());
      page.status('');
      const mapEl = doc.createElement('div');
      const chartEl = doc.createElement('div');
      chartEl.style.marginTop = '20px';
      page.figure.append(mapEl);
      const handle = await mountMap(mapEl, site.georeference, site.layers, ZOOM);
      if (handle === null) {
        const text = doc.createElement('pre');
        text.textContent = `No WebGL in this browser, so the map is described instead:\n${JSON.stringify(describeMap(site.georeference, site.layers), null, 2)}`;
        mapEl.appendChild(text);
      }
      page.figure.append(
        legend(doc, [
          ['Nearby projects (synthetic)', STATUS_COLOR],
          [`${PLAN_STOREY} rooms`, site.roomColors],
        ]),
        chartEl,
      );
      await renderVegaLite(chartEl, spec, site.projects);
      page.caption(caption(site));
    } catch (e) {
      page.status(`Could not draw the site map: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  },
  async headless(paths): Promise<HeadlessView[]> {
    const site = await loadSiteMap({
      elements: resolveDataPath(FILES.elements, paths),
      bounds: resolveDataPath(FILES.bounds, paths),
      georeference: resolveDataPath(FILES.georeference, paths),
      nearby: resolveDataPath(FILES.nearby, paths),
    });
    const fixed = { ...spec, width: 640 } as TopLevelSpec;
    return [
      {
        kind: 'map',
        title: 'Duplex site and nearby projects',
        rows: featureCount(site.layers),
        description: describeMap(site.georeference, site.layers),
      },
      {
        kind: 'chart',
        title: 'Floor area of the other projects nearby, by status',
        rows: site.projects.length,
        svg: await vegaLiteToSvg(fixed, site.projects),
      },
    ];
  },
};
