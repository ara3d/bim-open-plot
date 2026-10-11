// Checks specific to site-map: the IfcSite angles read as Chicago, the
// footprint lands on the georeference, each layer has the features the
// model and the synthetic file hold, and every nearby project is within 1 km.

import { beforeAll, describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Polygon } from 'geojson';
import { STATUSES, compoundAngleDegrees, demo, loadSiteMap, type SiteMap } from './main';

const dataRoot = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(dataRoot, '../../public');

describe('demo site-map: georeference and layers', () => {
  let site: SiteMap;
  beforeAll(async () => {
    site = await loadSiteMap({
      elements: `${siteRoot}/data/duplex/elements.json`,
      bounds: `${siteRoot}/data/duplex/bounds.json`,
      georeference: `${dataRoot}/data/georeference.json`,
      nearby: `${dataRoot}/data/nearby.geojson`,
    });
  });

  const layer = (id: string) => site.layers.find((l) => l.id === id)!;

  it('reads the IfcSite compound angles as 41.8744 N, 87.6394 W, north-up', () => {
    expect(compoundAngleDegrees([41, 52, 27, 840000])).toBeCloseTo(41.8744, 6);
    expect(site.georeference.lat).toBeCloseTo(41.8744, 6);
    expect(site.georeference.lon).toBeCloseTo(-87.6394, 6);
    expect(site.georeference.rotation).toBe(0);
  });

  it("puts the footprint's centre within 0.001 degrees of the georeference", () => {
    const ring = (layer('footprint').data.features[0]!.geometry as Polygon).coordinates[0]!.slice(0, 4);
    const lon = ring.reduce((s, p) => s + p[0]!, 0) / 4;
    const lat = ring.reduce((s, p) => s + p[1]!, 0) / 4;
    expect(Math.abs(lon - site.georeference.lon)).toBeLessThan(0.001);
    expect(Math.abs(lat - site.georeference.lat)).toBeLessThan(0.001);
  });

  it('draws 1 footprint, 10 Level 1 spaces, and 6 nearby projects', () => {
    expect(site.layers.map((l) => [l.id, l.data.features.length])).toEqual([
      ['footprint', 1],
      ['level-1-spaces', 10],
      ['nearby-projects', 6],
    ]);
    expect(Object.keys(site.roomColors).sort()).toEqual(['Bathroom 1', 'Foyer', 'Kitchen', 'Living Room', 'Room', 'Stair']);
  });

  it('places every nearby project within 1 km, with a known status and a floor area', () => {
    expect(site.projects).toHaveLength(6);
    for (const p of site.projects) {
      expect(p.distance as number).toBeGreaterThan(0);
      expect(p.distance as number).toBeLessThan(1000);
      expect(STATUSES).toContain(p.status);
      expect(p.floorArea as number).toBeGreaterThan(0);
    }
    for (const s of STATUSES) expect(site.projects.filter((p) => p.status === s)).toHaveLength(2);
  });

  it('reports 17 map features and 6 chart rows headlessly', async () => {
    const views = await demo.headless({ dataRoot, siteRoot });
    expect(views.map((v) => [v.kind, v.rows])).toEqual([
      ['map', 17],
      ['chart', 6],
    ]);
  });
});
