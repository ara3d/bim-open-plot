# Site map and nearby projects

Where the Duplex Apartment sits on a map, and which of the owner's other projects are within a kilometre of it. An OpenStreetMap basemap carries three layers: the model's footprint, the Level 1 rooms coloured by name, and six nearby projects coloured by status. Below the map, a stacked bar chart gives the nearby projects' gross floor area by status.

- For: the owner, deciding how this building relates to the rest of their portfolio on the ground.
- Map kind: `src/map.ts` (MapLibre, OpenStreetMap raster tiles with attribution). Without WebGL the page prints the map's description instead.

## Where every number comes from

- **Position.** `data/georeference.json`, typed by hand from `IfcSite` in `duplex.ifc`: RefLatitude (41, 52, 27, 840000) and RefLongitude (-87, -38, -21, -839999), read as degrees, minutes, seconds, and millionths of a second: 41.8744° N, 87.6394° W, in Chicago (the file's postal address says Chicago, IL). This is the point the file states, not a surveyed one. The BOS converter truncates these values, so the demo does not read them from the `.bos` file; that is a toolkit defect.
- **Rotation.** The file has no `IfcMapConversion` and no TrueNorth, so the rotation is unknown. The map takes model +y as north (rotation 0) and the caption says so. This is the first answer to TKT-221 (which basemap and which georeference when a model has no `IfcMapConversion`).
- **Footprint.** The model's bounding box from `/data/duplex/bounds.json`, about 9.3 m by 26.6 m in plan; it includes the two exterior slabs at the ends.
- **Rooms.** The boxes of the ten `IFCSPACE` elements on Level 1 (`/data/duplex/elements.json` joined to `bounds.json` by STEP id), coloured by room name. The two units repeat the same names. Boxes, not room outlines.
- **Nearby projects.** `data/nearby.geojson` is **synthetic**: six invented projects, placed 500 to 720 m from the site point, each with a status (design, construction, handover) and a gross floor area of 620 to 4,200 m². The page shows a Synthetic data badge.

## Run

`npm run demos` at the repository root, then open `/demos/site-map/`. Test: `npx vitest run --root packages/demos -t "demo site-map"`.
