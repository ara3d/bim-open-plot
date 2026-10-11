# Room areas on the floor plan

One plan per storey of the Duplex Apartment, Level 1 and Level 2. Each room is a rectangle coloured by its area on one heat ramp shared by both plans, so a colour means the same number of square metres on either storey. Labels read "Name · Number · 30.1 m²" and shorten to "Number · area" or the number alone when the rectangle is narrow; hovering a room shows the full label and its box size. Walls are grey and doors blue, with a scale bar and a ramp legend in m².

- For: a facility manager asking where each room is and how large it is.
- Data, all from the model (no synthetic numbers):
  - `/data/duplex/elements.json`: each space and its storey.
  - `/data/duplex/parameters.json`: `PSet_Revit_Dimensions.Area` (the colour), `PSet_Revit_Identity Data.Number` (A102, B203, ...), `Ifc:LongName` (the room name), and `Ifc:Elevation` (storey order).
  - `/data/duplex/bounds.json`: the bounding boxes of rooms, walls, and doors.
- Approximations, also stated in the caption:
  - Rooms, walls, and doors are drawn as their axis-aligned bounding boxes, not their outlines. The colour is the modelled Area, not the box area.
  - Walls and doors are the ones whose box crosses a horizontal cut 1.2 m above the storey's lowest room floor, whichever storey the model assigns them to.
  - The ramp runs from 0 to 50 m². The largest room, 30.1 m², sits at about 60% of it, so the dark label text stays readable.
- Not drawn: the Roof storey's single space (R301, 145.7 m²). It is the roof deck over the whole footprint, and drawing it would hide both units and stretch the ramp. T/FDN has no rooms.
- Honest absence: a room with no Area would be drawn grey, labelled "no Area", and named in the caption. In the Duplex every room has one.
- Run: `npm run demos` at the repository root, then open `/demos/room-area-plan/`. Test: `npx vitest run --root packages/demos -t "demo room-area-plan"`.
