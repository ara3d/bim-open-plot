# Floor area by storey and room

For an architect asking which storey of the Duplex Apartment carries the most floor area, and how that area is split between rooms.

- **Storey bars.** One horizontal stacked bar per storey, top storey at the top (ordered by `Ifc:Elevation` on each `IFCBUILDINGSTOREY`). Each segment is one space, coloured by room name; the storey total is printed at the bar end. The tooltip gives the space, its unit, its room number, and its area.
- **Ranking.** The spaces of the two apartments ranked by area, Unit A and Unit B side by side, so the mirrored plan and the rooms that differ (Bathroom 2, Utility, and the Stair in Unit A against the Room in Unit B) show at a glance.

## Where the numbers come from

All model data, no synthetic numbers, nothing measured from geometry.

| Value | Source |
|---|---|
| Space, storey | `/data/duplex/elements.json`: rows with `Category` `IFCSPACE`, their `StoreyName` |
| Area (m²) | `/data/duplex/parameters.json`: `PSet_Revit_Dimensions` / `Area`, the authoring tool's room area |
| Room number | `PSet_Revit_Identity Data` / `Number` (A101, B101, R301) |
| Unit | `PSet_Revit_Other` / `OccupancyZoneName`, which reads "Unit A …" or "Unit B …"; the Roof space has none and is left out of the ranking |
| Storey order | `IFCBUILDINGSTOREY` / `Ifc:Elevation`: T/FDN −1.25, Level 1 0.0, Level 2 3.1, Roof 6.0 |

A space without an Area would be left out of both charts and named in the caption, not drawn as zero; in this model all 21 have one. T/FDN holds no spaces and is drawn as an empty row labelled "no spaces". The Roof storey's one space, R301 "Roof", is 145.7 m² and outweighs either floor of rooms; the caption says so and names Level 1 (141.8 m²) as the largest storey of rooms.

## Run

- Page: `npm run demos` at the repository root, then open `/demos/rooms-by-storey-area/`.
- Test: `npx vitest run --root packages/demos -t "demo rooms-by-storey-area"` from the repository root.
