# Door width check

Which doors in the Duplex Apartment are narrower than 850 mm, and where they are. A bar chart of every door's width, narrowest first, with a red rule at 850 mm and each bar coloured pass or fail; then a plan of Level 1 and of Level 2 with rooms as light labelled boxes and doors as small boxes in the same colours.

- For: an accessibility reviewer deciding which doors to flag for widening.
- Result: 6 of the 14 doors fail (four 762 mm `M_Single-Flush:0762 x 2032mm`, two on each living storey; two 813 mm glazed doors on Level 1); the six 864 mm and two 1250 mm doors pass.
- Data: `/data/duplex/elements.json` (doors, spaces, storeys), `/data/duplex/parameters.json` (`Ifc:OverallWidth`, written in metres by the export and converted to whole millimetres), `/data/duplex/bounds.json` (boxes for the plans). Model data only, nothing synthetic.
- Approximations, stated in the caption: 850 mm is an illustrative threshold, not a cited code clause; `Ifc:OverallWidth` is the door's overall width, wider than the clear opening by the frame and stop; rooms and doors are drawn as axis-aligned bounding boxes, not outlines. A door with no width would be listed as "no width" and drawn grey, never counted as 0 mm.
- Run: `npm run demos` at the repository root, then `/demos/door-width-check/`. Test: `npx vitest run --root packages/demos -t "door-width-check"`.
