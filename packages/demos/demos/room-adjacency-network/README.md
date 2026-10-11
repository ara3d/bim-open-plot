# Room adjacency network

For a space planner asking which rooms connect to which, and how: through a door, through an opening with no wall, or up a stair. The Duplex Apartment's two living storeys are drawn side by side (Level 1 left, Level 2 right) with each room as a node at its box centre, and a bar chart counts the connected rooms of every space.

- **Nodes** are coloured by storey and sized by the number of distinct rooms one connection away.
- **Edges**: a solid ochre line is a door; a dashed grey line is an open connection (two room boxes overlapping, no wall between them in the box model). Where a door and an overlap join the same two rooms, the line is drawn as a door.
- **Stairs**: each flight is outlined on both plans; a double line joins every room the flight touches to the flight box, and the flight's two ends are joined through a channel north or south of the plans.
- **Chart**: one bar per space, labelled with its name and room number (the two units repeat every name), coloured by storey. The tooltip splits the count by door, open overlap, and stair, and gives the Area.

## Where the numbers come from

Model data only: `/data/duplex/elements.json` (storey of each element) joined to `/data/duplex/bounds.json` (boxes) by STEP id with `elementsWithBounds`, room Number and Area from `/data/duplex/parameters.json`, then `allLinks` in `src/building.ts`. `network.ts` turns the links into one edge per room pair and kind, counts distinct neighbours, and finds components with `hopsFrom`; its degrees match `roomGraph` over the same links.

The model carries no door-to-room relation and no room outline, so every connection is inferred from axis-aligned boxes, and the caption says so:

- a door joins the rooms its box overlaps in plan, with 0.3 m tolerance; a door between three boxes joins each pair of them (a Kitchen and a Bathroom 1 share a door this way), and an exterior door touches one room and makes no edge;
- an open connection is two room boxes on one storey overlapping by at least 0.5 m²;
- a stair flight joins every room its box touches (0.5 m tolerance) on Level 1 to every one on Level 2;
- the two units are mirrored, so the rooms on the living storeys form two components joined only through the exterior.

The Roof space touches no door, opening, or flight: it has 0 connections, a count rather than a missing value, and is not drawn on the plans.

Expected result (checked by `main.test.ts`): 21 rooms; 18 door edges, 6 open edges, 8 stair edges over 28 distinct room pairs; both Foyers and both Hallways have the highest degree, 6; two components on Level 1, two on Level 2, one on the Roof; two components of 10 rooms across the living storeys and three in the whole building.

## Run

`npm run demos` at the repository root, then open `/demos/room-adjacency-network/`. Test: `npx vitest run --root packages/demos -t "demo room-adjacency-network"`.
