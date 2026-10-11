# Discipline mix by storey

For an MEP coordinator deciding which discipline drives each storey's coordination effort. The federated Duplex Apartment (architecture, MEP, electrical, and mechanical models in one file) is drawn in 3D with each element coloured by its discipline and a checkbox per discipline to show or hide it, beside a stacked bar of elements per storey by discipline and the same bars normalised to shares.

- Model: `/models/duplex-federated.bos` (buildingSMART Duplex Apartment, CC BY 4.0; see `public/models/NOTICE.md`). No synthetic data.
- Discipline: the source document each object came from, which the BOS file records per entity: `Duplex_A` is Architecture, `Duplex_MEP` is MEP, `Duplex_Electrical` is Electrical, and `Duplex_M_..._ROOMS_AND_SPACES` is Mechanical. When a model names no documents, the code falls back to the IFC class (flow and distribution elements MEP, cable carriers and light fixtures Electrical, the rest Architecture); the caption says which method ran.
- Storey: the containment and aggregation chain (`parentId`, then the `containedIn`, `memberOf`, and `partOf` relations) from each element up to an `IfcBuildingStorey`. An element contained in a space takes the space's storey. Storeys of the four documents are merged by name and ordered by the median lowest point of their elements, because the storey records carry no elevation.
- Counted: drawn elements (objects with geometry), 1731 in all. The 101 `IfcSpace` volumes are hidden in 3D and not counted; elements with no storey would be counted under "no storey" (there are none).
- Numbers the test pins: Architecture 215, MEP 926, Electrical 103, Mechanical 487; Level 1 holds the most MEP elements (497).
- Colours: the federation's objects share STEP ids across documents, so the 3D view colours and hides by viewer object key through `applyChanges` (`key`, `red`, `green`, `blue`, `alpha`, `visible`), not by STEP id.
- Run: `npm run demos` at the repository root, then `/demos/discipline-mix/`. Test: `npx vitest run --root packages/demos -t "demo discipline-mix"`.
