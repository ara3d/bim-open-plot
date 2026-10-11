# Storeys in 3D

The federated Duplex Apartment drawn in 3D with every element tinted by the storey it sits on, and a **Stacked / Exploded** toggle that lifts the storeys apart so each floor's contents can be seen on their own. Below it, a stacked bar chart counts the architecture elements on each storey by IFC class, in the same storey colours as the 3D legend.

- For: a coordinator checking what each storey holds before a coordination meeting.
- Decision: what does each storey hold, seen in 3D, stacked and exploded?

## Where the numbers come from

- **Storeys and their order:** the four IFCBUILDINGSTOREY rows of `/data/duplex/elements.json`, ordered by `Ifc:Elevation` in `/data/duplex/parameters.json`: T/FDN (-1.25 m), Level 1 (0 m), Level 2 (3.1 m), Roof (6.0 m). Colours are the theme's `series` palette in that order.
- **The chart:** architecture elements with a `StoreyName` in the extract, grouped by class (IFCWALL and IFCWALLSTANDARDCASE both count as Wall): T/FDN 14, Level 1 103, Level 2 93, Roof 8. Rooms (IFCSPACE) and openings are left out.
- **The 3D tint**, over `/models/duplex-federated.bos` (architecture, MEP, electrical, and rooms-and-spaces models in one file): 1,485 drawn elements get a storey. 215 come from the extract: the architecture model is the federation's first file, so object `bos:<EntityIndex>` is the extract row, kept only when its STEP id agrees. The other 1,270 take the nearest IFCBUILDINGSTOREY up their own model's containment (`parentId`). 246 elements name no storey either way; they are drawn faint and stay in place when exploded. The 101 room volumes are hidden so the elements show.
- **Exploded:** storey *i* (the lowest is 0) is lifted by *i* × 1.5 × the average storey height (7.25 m / 3), by translating the model's instance rows with the viewer's layout functions (`captureTranslations`, `layoutTranslations`, `writeLayout`). Stacked writes the captured translations back.

STEP ids alone cannot join the extract to the federated model: the four source files reuse them, and 33 extract rows' STEP ids resolve to an object of another file.

## Run

`npm run demos` at the repository root, then open `/demos/storeys-in-3d/`. Without WebGL the page prints the scene description instead of the 3D view.

Test: `npx vitest run --root packages/demos -t "demo storeys-in-3d"` from the repository root.

## Files

- `main.ts`: the page and the headless views.
- `storeys.ts`: storeys by elevation, the chart's rows, and each drawn object's storey; no viewer, runs in Node.
- `scene-storeys.ts`: the colour rules and the explode, through the viewer the `SceneHandle` exposes.
- `main.test.ts`: the counts above.
