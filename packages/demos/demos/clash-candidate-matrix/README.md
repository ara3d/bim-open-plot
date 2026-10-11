# Clash candidates by class pair

Which class pairs overlap most, per storey, so the clash meeting starts in the right place? Three views over the Duplex Apartment:

1. A class × class heat map of clash candidates, one cell per unordered pair of classes (the lower triangle), with the count written in the cell. A pale grey cell is a real zero.
2. A plan of the storey with the most candidates (Level 1): every overlap box drawn as an ochre rectangle over faint outlines of the elements involved.
3. A bar of candidates per storey, split by the five largest class pairs and "Other pairs".

- For: a BIM coordinator preparing a clash meeting.
- Data: `/data/duplex/elements.json` (class and storey), `/data/duplex/bounds.json` (one axis-aligned box per element, metres), and `/data/duplex/relations.json` (MemberOf, to find assemblies). All model data; nothing synthetic.
- Run: `npm run demos` at the repository root, then `/demos/clash-candidate-matrix/`. Test: `npx vitest run --root packages/demos -t "demo clash-candidate-matrix"`.

## Method

Every unordered pair of solid elements is tested once: their boxes must overlap on all three axes (`overlapsXYZ` from `src/building.ts`, no padding) and the intersection box must hold more than 0.001 m³, which drops faces that only touch. A pair of a door or window with a wall is **hosted, expected** and is counted apart from the candidates; any door or window overlapping any wall counts as hosted, not only its host wall. The rest are candidates.

Left out before testing: spaces and opening elements, which are volumes of air (the bounds extract has 21 spaces and no openings), and assemblies whose parts carry their own boxes (the IfcRoof, whose roof slab has the same box). Walls are IfcWall and IfcWallStandardCase together. A pair whose elements sit on two storeys is counted under "lower / upper" and is not drawn on the plan.

## Numbers (2026-10-11 extract)

215 solids, 287 candidates, 43 hosted overlaps (22 window × wall, 21 door × wall). Furniture × Slab leads with 57, then Covering × Wall (47) and Slab × Wall (40). Level 1 holds 172 candidates, Level 2 84, and 31 span two storeys. `main.test.ts` asserts these.

## What the numbers are not

Candidates are bounding-box overlaps, and box overlap over-counts: a box overlap is not a geometric clash. A box covers empty space around a sloped, hollow, or L-shaped element, furniture boxes dip into the slab they stand on, and joined walls overlap at their ends. This is the first filter a coordinator would run, not a verdict. The plan flattens height, so overlaps at different heights on one storey draw on top of each other.
