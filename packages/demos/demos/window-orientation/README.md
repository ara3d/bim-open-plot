# Window area by orientation

Two charts for an energy analyst sizing solar gain and heat loss on the Duplex Apartment:

1. **Window area by direction**: total window area facing north, east, south, and west, with the two roof skylights as a separate bar, and the window count on each bar.
2. **Windows against exterior wall, per facade**: window area beside net exterior wall area for each facade, labelled with the window-to-wall ratio (WWR).

On the model as delivered, the short north and south facades carry 20.3 m² of window each (WWR 36% and 37%); the long east and west facades carry 11.9 m² each (WWR 10% and 11%). Total glazing is 65.9 m² over 24 windows.

## Where the numbers come from

All model data, no synthetic numbers.

- `/data/duplex/elements.json`: the 24 `IFCWINDOW` and 56 `IFCWALLSTANDARDCASE` elements.
- `/data/duplex/parameters.json`: window `Ifc:OverallWidth` and `Ifc:OverallHeight` (metres: a "4835mm x 2420mm" window carries 4.835 and 2.42); wall `PSet_Revit_Dimensions` `Area` (m², net of openings) and `PSet_Revit_Type_Construction` `Function`, Revit's wall-function number, where 1 is Exterior (12 walls, all "Exterior - Brick on Block"), 0 interior, 2 foundation, and 5 core shaft.
- `/data/duplex/bounds.json`: each element's axis-aligned box in metres, joined by STEP id.

## Method and approximations

- Facing comes from the box. A window or wall is thin along its normal: a box narrower in x than in y faces east when its centre is east of the model box's centre, else west; otherwise north or south by the same test on y. A box thinnest in height lies flat and faces up (the two `M_Skylight` windows on the roof); those are not assigned to a facade.
- Model +y is taken as north. The Duplex IFC has no TrueNorth, so the real directions may be rotated.
- Window area is width × height of the frame, not the glazed area.
- WWR is window area over gross wall area, with gross wall taken as Revit's net wall Area plus the window area on that facade. Door openings are not added back, so the ratio reads slightly high. The 0.6 m roof parapets count as exterior wall.
- Missing values stay missing: a window with no width or height is listed in the caption as not measured and left out of the sums; an exterior wall with no Area likewise. In this model every window and every exterior wall is measured.
- The skylights' `Ifc:OverallHeight` is 0.6348 m while their name says 1170 mm and their box is 1.22 m deep; the chart uses the model's value, as for every other window.

## Run

`npm run demos` at the repository root, then open `/demos/window-orientation/`. Test: `npx vitest run --root packages/demos -t "demo window-orientation"`.
