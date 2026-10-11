# Travel distance to an exit

For a fire engineer asking which rooms of the Duplex Apartment are furthest from an exit, and whether any exceed a travel-distance limit.

The figure has three views:

- **Two storey plans**, Level 1 and Level 2. Each room box is coloured by its distance to the nearest exit on one heat ramp shared by both plans, from 0 to the longest distance rounded up to a metre (13 m). The route of the three farthest rooms on each storey is drawn as a thin line from the room centre through each door, stair, or overlap centre to the exit; only three per storey, so the plan stays legible. On Level 2, which has no exit, a route turns dashed after the stair because the rest of it lies on Level 1. Exits are ochre dots on Level 1; on Level 2, grey dots mark the two stair flights.
- **A bar chart** of travel distance per room, longest first, with a dashed line at an illustrative 30 m limit. A bar beyond the line would be red; none is.

## Where the numbers come from

All of them are derived from two Duplex extracts in `public/data/duplex/`: `elements.json` (IFC class and storey per element) and `bounds.json` (one bounding box per element). `elementsWithBounds`, `allLinks`, and `travelDistances` in `src/building.ts` produce the distances. No synthetic data is used.

Results on the Duplex: 21 spaces, 20 of them on Level 1 and Level 2, and every one of those 20 has a route. The two exits are on Level 1, one per mirrored unit. The farthest room is Bedroom 1 on Level 2 (STEP id 1442), at 12.8 m; the nearest are the two foyers, at 3.7 m. The Roof space has no route, so it gets no bar and is listed in the caption instead of being shown as 0.

## Approximations

These are stated in the caption:

- A distance is a chain of straight segments over bounding boxes: from the centre of the room box to a door centre, then from door centre to door centre until an exit door. It is not a walking path around furniture, or around walls inside a room.
- Adjacency is box overlap. A door serves the rooms whose boxes it touches, with 0.3 m of tolerance, and an exit is a door that touches only one room. Two room boxes on one storey that overlap by at least 0.5 m² connect through the centre of the overlap.
- A stair counts as the plan centre of its flight. No stair length is added, so Level 2 distances are short by the length of the stair run.
- The 30 m line is illustrative, not a code limit.

## Run

Run `npm run demos` at the repository root, then open `/demos/travel-distance-heatmap/`. To test from the repository root: `npx vitest run --root packages/demos -t "demo travel-distance-heatmap"`.
