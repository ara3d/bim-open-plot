# Cost by storey and class: Base vs value-engineered

For an estimator deciding where value engineering (VE) pays: what each storey of the Duplex Apartment costs by class under a Base and a VE set of unit rates, where the saving comes from, and which elements the rate book does not yet price.

## What it shows

1. **Cost per storey.** For each storey, highest first, a Base bar and a VE bar side by side, each stacked by class (Wall, Furniture, Slab, Window, Door, Stair, Covering, Beam, Footing), with the bar's total at its end.
2. **Saving per class.** A dumbbell per class from the VE cost to the Base cost over the whole building, labelled with the saving and its share of the Base cost, largest saving first.
3. **Unpriced elements per class.** How many elements are left out of the totals, split by why: no rate in the book, or a rate that needs a quantity the element does not carry.

The caption gives the totals, the storey with the highest Base cost, the measure used for each class, and every unpriced element by count and type.

## Where the numbers come from

- **Quantities** are the model's own, from `PSet_Revit_Dimensions` in `/data/duplex/parameters.json`: walls, slabs, and coverings by `Area` (m²), footings by `Volume` (m³), beams by `Length` (m); doors, windows, furniture, and stairs are counted. Only that property set is read, because `Area` also appears in `PSet_Revit_Type_Other` as a text placeholder.
- **Rates** are synthetic: `data/unit-rates.json`, in USD, invented at a plausible order of magnitude for Chicago-area low-rise residential work, installed, without overheads, profit, contingency, or tax. They are illustrative, not a priced bill. Each rate names the IFC classes and the type-name pattern it prices, its measure, a Base and a VE rate, and the substitution behind the VE rate. The first matching rate wins.
- **Assemblies** come from the `MemberOf` relations in `/data/duplex/relations.json`: stair flights, stringers, and railings belong to a stair and are priced in the stair's rate; the roof slab belongs to the roof. A part is never priced on its own.

## Honest absence

An element with no matching rate, or whose rate needs a quantity the model does not give, is unpriced: counted, listed in the third figure and the caption, and left out of every total, never priced at 0. In the Duplex that is 9 elements: 7 foundation walls and the roof (no rate), and one party wall with no `Area`. Adding a rate to `data/unit-rates.json` prices them.

Spaces, openings, storeys, the building, the site, and the project are places or voids, not priced items.

## Run

`npm run demos` at the repository root, then open `/demos/cost-by-storey-class/`. Test: `npx vitest run --root packages/demos -t "demo cost-by-storey-class"`.

The pricing is in `estimate.ts`; `main.ts` holds the three Vega-Lite specs and the page.
