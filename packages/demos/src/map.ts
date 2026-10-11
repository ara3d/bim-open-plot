// A map view through MapLibre: an OpenStreetMap raster basemap with
// attribution, GeoJSON layers, and a model footprint placed at a stated
// origin. Headless, a demo describes the layers instead of drawing them.

import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { tokens } from './theme';

/** Where the model's origin sits on the earth and how it is turned: the IfcSite latitude and longitude, or a stated assumption. */
export interface Georeference {
  readonly lat: number;
  readonly lon: number;
  /** Degrees clockwise from north to the model's +y axis. */
  readonly rotation: number;
  readonly source: string;
}

const EARTH = 6378137;

/** Model x/y metres at a georeference to a [lon, lat] pair (local tangent plane; fine within a few kilometres). */
export const toLonLat = (x: number, y: number, g: Georeference): [number, number] => {
  const t = (g.rotation * Math.PI) / 180;
  const east = x * Math.cos(t) + y * Math.sin(t);
  const north = -x * Math.sin(t) + y * Math.cos(t);
  const lat = g.lat + (north / EARTH) * (180 / Math.PI);
  const lon = g.lon + (east / (EARTH * Math.cos((g.lat * Math.PI) / 180))) * (180 / Math.PI);
  return [lon, lat];
};

/** A GeoJSON polygon for a model-space box. */
export const boxFeature = (
  id: string,
  box: { min: { x: number; y: number }; max: { x: number; y: number } },
  g: Georeference,
  properties: Record<string, unknown> = {},
): Feature<Polygon> => {
  const ring = [
    toLonLat(box.min.x, box.min.y, g),
    toLonLat(box.max.x, box.min.y, g),
    toLonLat(box.max.x, box.max.y, g),
    toLonLat(box.min.x, box.max.y, g),
    toLonLat(box.min.x, box.min.y, g),
  ];
  return { type: 'Feature', id, geometry: { type: 'Polygon', coordinates: [ring] }, properties: { id, ...properties } };
};

export interface MapLayer {
  readonly id: string;
  readonly data: FeatureCollection;
  readonly kind: 'fill' | 'line' | 'circle';
  readonly color?: string;
  readonly opacity?: number;
  /** A data-driven colour: the property to read and the colour per value. */
  readonly colorBy?: { readonly property: string; readonly colors: Readonly<Record<string, string>>; readonly fallback: string };
}

export interface MapHandle {
  destroy(): void;
}

/** Mounts a MapLibre map in `el` centred on `g` with `layers`. Returns null when WebGL is not available. */
export const mountMap = async (el: HTMLElement, g: Georeference, layers: readonly MapLayer[], zoom = 17): Promise<MapHandle | null> => {
  const probe = el.ownerDocument.createElement('canvas');
  if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return null;
  const maplibre = await import('maplibre-gl');
  await import('maplibre-gl/dist/maplibre-gl.css');
  el.style.minHeight = '480px';
  const map = new maplibre.Map({
    container: el,
    center: [g.lon, g.lat],
    zoom,
    attributionControl: {},
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
  });
  map.on('load', () => {
    for (const layer of layers) {
      map.addSource(layer.id, { type: 'geojson', data: layer.data });
      const color = layer.colorBy
        ? ['match', ['get', layer.colorBy.property], ...Object.entries(layer.colorBy.colors).flat(), layer.colorBy.fallback]
        : (layer.color ?? tokens.accent);
      if (layer.kind === 'fill')
        map.addLayer({ id: layer.id, type: 'fill', source: layer.id, paint: { 'fill-color': color as never, 'fill-opacity': layer.opacity ?? 0.6, 'fill-outline-color': tokens.text } });
      else if (layer.kind === 'line')
        map.addLayer({ id: layer.id, type: 'line', source: layer.id, paint: { 'line-color': color as never, 'line-width': 2 } });
      else map.addLayer({ id: layer.id, type: 'circle', source: layer.id, paint: { 'circle-color': color as never, 'circle-radius': 6, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
    }
  });
  return { destroy: () => map.remove() };
};

/** What the map would draw, for the headless test and for a page without WebGL. */
export const describeMap = (g: Georeference, layers: readonly MapLayer[]): Record<string, unknown> => ({
  center: { lat: g.lat, lon: g.lon, rotation: g.rotation, source: g.source },
  basemap: 'OpenStreetMap raster tiles',
  layers: layers.map((l) => ({ id: l.id, kind: l.kind, features: l.data.features.length })),
});
