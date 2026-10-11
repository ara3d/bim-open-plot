# Element mix by storey

Two stacked horizontal bars per storey of the Duplex Apartment, one segment per element class: the first in element counts, the second normalised to 100 % so the mix of a small storey compares with a large one. A storey row reads as "what is this storey made of"; a "no storey" row, drawn last, holds any element the model places in no storey.

- For: a BIM manager checking how the model is broken down by storey, and whether anything sits outside the spatial structure.
- Data: `/data/duplex/elements.json` (IFC class and `StoreyName` per entity) and `/data/duplex/parameters.json` (`Ifc:Elevation` of each storey, which orders the rows, highest first). Model data only, no synthetic numbers.
- Counted: every entity except the spatial structure (`IfcProject`, `IfcSite`, `IfcBuilding`, `IfcBuildingStorey`) and openings (`IfcOpeningElement`). Openings are voids cut into walls and slabs, not elements, so the caption reports them apart: all 50 in the Duplex have no storey.
- Class names: `IFCWALLSTANDARDCASE` is "Wall", `IFCWALL` is "Wall (other)", `IFCFURNISHINGELEMENT` is "Furniture", and so on (`CLASS_NAMES` in `main.ts`); an unlisted class drops its `IFC` prefix. The tooltip shows the IFC class, the storey, the count, and the share of the storey.
- Numbers the test checks (`main.test.ts`): 239 elements drawn, 0 with no storey, 50 openings left out; 56 walls, 1 other wall, 14 doors, 24 windows (4 on Level 1, 18 on Level 2, 2 on Roof), 61 furniture, 21 spaces.
- Colours: the brand palette has eight colours and the Duplex has fifteen classes, so the class scale uses Vega's `tableau20` scheme.
- Run: `npm run demos` at the repository root, then `/demos/element-mix-by-storey/`. Test: `npx vitest run --root packages/demos -t "demo element-mix-by-storey"`.
