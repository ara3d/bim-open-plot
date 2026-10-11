# Connections to an exit, room by room

For a fire engineer asking how many doors each room's occupants pass through to get out. Two storey plans of the Duplex Apartment (Level 1 and Level 2) colour every room by the fewest connections between it and an exit door, and a bar chart counts the rooms at each hop count, with a bar for rooms that have no route.

- **0** is a room an exit door opens from (the Foyer of each unit). Each further connection (a door, a stair flight, or an open connection) adds one.
- Exit doors are ochre points labelled "Exit"; other doors are small grey points; stair flights are outlined rectangles labelled "Stair"; dashed lines join rooms with an open connection.
- Rooms with no route are drawn hatched grey and counted as "unreached", never as 0. In the Duplex that is the Roof space.

## Where the numbers come from

Model data only: `/data/duplex/elements.json` (storey of each element) joined to `/data/duplex/bounds.json` (boxes) by STEP id with `elementsWithBounds`, then the box model in `src/building.ts`: `allLinks`, `exteriorDoors(doorSpacePairs(...))`, `roomGraph`, `hopsFrom`.

The model carries no door-to-room relation and no room outline, so every connection is inferred from axis-aligned boxes, and the caption says so:

- a door connects the rooms its box overlaps in plan, with 0.3 m tolerance;
- an exit is a door touching at most one room;
- an open connection is two room boxes on one storey overlapping by at least 0.5 m² (no wall between them in the box model);
- stairs connect storeys by their flights (the flight box touches rooms on both storeys, 0.5 m tolerance);
- every connection counts as one hop, so a stair flight or an open connection counts like a door.

Expected result (checked by `main.test.ts`): 2 exits; all 20 rooms on Level 1 and Level 2 reached; 2 rooms at 0, 12 at 1, 6 at 2; the Roof space unreached.

## Run

`npm run demos` at the repository root, then open `/demos/egress-hops-plan/`. Test: `npx vitest run --root packages/demos -t "demo egress-hops-plan"`.
