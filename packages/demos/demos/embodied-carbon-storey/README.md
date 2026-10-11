# Embodied carbon by storey and material

For a sustainability lead deciding where embodied-carbon cuts pay off most: which storey carries the most carbon, and which material family drives it.

Three views of the Duplex Apartment:

1. A stacked bar of embodied carbon per storey (kgCO2e), one segment per material family. The label at the end of each bar gives the storey total and how many elements were left out for want of a factor or a volume.
2. A bar of carbon per material family for the whole building, largest first.
3. The 3D model with every counted element coloured on the heat ramp by its carbon (pale for little, deep brown for the most) and everything else faded.

## Where the numbers come from

- Volume: the model's `PSet_Revit_Dimensions` `Volume` (m³) in `/data/duplex/parameters.json`. Model data.
- Material family: the first family in `data/carbon-factors.json` whose keyword is a whole word in the element's type name (`Basic Wall:Exterior - Brick on Block` gives brick); failing that, in its material names from `/data/duplex/relations.json` in layer order, skipping air and stud layers. Model data, matched by this demo's keyword list.
- Carbon factor per family (kgCO2e/m³, A1-A3): `data/carbon-factors.json`. **Synthetic**: illustrative values sized like generic entries in an EPD (Environmental Product Declaration) database such as the ICE inventory or EC3, not taken from any EPD. Do not use them for a real assessment.
- Storey order: `Ifc:Elevation` of each `IFCBUILDINGSTOREY`.

Carbon is volume times factor, per element. An element with no volume (doors, windows, furniture, the roof, stairs) or no family match (the bearing footings, which name no material, and the ceramic tile finish floors, whose materials have no factor) is left out and counted, never added as zero. Each element takes one family over its whole volume, so a layered wall counts as its leading material; the extracts carry no layer thicknesses to split it.

The arithmetic is in `carbon.ts`; the views in `main.ts`. `main.test.ts` checks the counts and the totals.

## Run

`npm run demos` at the repository root, then open `/demos/embodied-carbon-storey/`. Test: `npx vitest run --root packages/demos -t "demo embodied-carbon-storey"`.
