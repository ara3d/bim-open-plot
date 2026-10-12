# Parameter completeness

A heat map of which parameters are filled for which IFC classes in the Duplex Apartment, and a bar of the overall fill rate per class, for a BIM manager deciding whether a delivered model is complete enough to accept.

- For: a BIM manager at model handover.
- Data: `/data/duplex/elements.json` and `/data/duplex/parameters.json` (model data, no synthetic numbers).
- Run: `npm run demos` at the repository root, then `/demos/parameter-completeness/`. Test: `npx vitest run --root packages/demos -t "demo parameter-completeness"`.

## How the numbers are made

- **Classes.** Every IFC class in `elements.json` except the spatial structure (`IFCPROJECT`, `IFCSITE`, `IFCBUILDING`, `IFCBUILDINGSTOREY`) and `IFCOPENINGELEMENT`: 239 elements in 15 classes.
- **Columns.** A parameter is `PropertySet.Name`, with two exceptions so one column reads across classes: an IFC attribute (its group is the class itself, such as `Ifc:OverallWidth` on `IFCDOOR`) is its bare name, and the class-specific common sets (`Pset_DoorCommon`, `Pset_WallCommon`, ...) share one column, `Pset_*Common.Name`.
- **Fill rate.** For a class and a parameter: elements of the class with a real value, over all elements of the class. A value is not real when it is empty text or when it repeats the parameter's own name, ignoring case and spaces (`Material = "Material"`, `FireRating = "Fire Rating"`): Revit's COBie template writes those placeholders until someone types a value. The Duplex has 7,153 such rows and 464 empty ones out of 13,275.
- **Blank versus 0 %.** A cell is blank when no element of the class carries the parameter at all, so it does not apply to that class in this export. A 0 % cell means the parameter is there and nobody filled it.
- **Which parameters.** The 25 parameters with the most filled elements overall, plus every parameter about fire rating, external, load-bearing, overall width and height, area, volume, length, or material: 52 in all.
- **Overall rate per class.** Filled (element, parameter) pairs over every pair where the parameter occurs on the class, counted over all parameters rather than only the 52 shown. `IFCROOF` carries no parameters in this export and has no rate rather than 0 %.
- **Labels.** A partial fill is never rounded to 100 % or 0 %.
