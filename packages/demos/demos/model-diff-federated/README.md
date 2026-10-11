# What federation adds, class by class

For a BIM manager taking delivery of a federated model, who asks: what do the MEP, electrical, and rooms-and-spaces files add to the architecture model, per IFC class, and does anything from the architecture model go missing?

Three charts:

1. **Diverging bar per class.** The left bar is the count in the architecture extract. The right bar is the federated count minus the architecture count. A negative difference is drawn in red and labelled "missing"; the Duplex has none.
2. **Classes on one side only**, largest first. The Duplex has eight classes that only the other disciplines bring, such as IFCFLOWSEGMENT and IFCFLOWFITTING. No class appears only in the architecture extract.
3. **Architecture elements found again by id.** All 296 extract rows match an object with the same class in the federated model's architecture document.

## Where the numbers come from

- `/data/duplex/elements.json`: the 296 IFC products of the architecture IFC (`duplex.ifc`), with class and STEP id (model data).
- `/models/duplex-federated.bos`: the four Duplex discipline files in one BOS (BIM Open Schema) file. Each file is kept as its own document and nothing is merged (model data; see `public/models/NOTICE.md`). It is loaded with `loadModelHeadless` from `src/scene.ts`, in Node for the test and in the browser for the page.
- The comparison is derived in `main.ts` (`compareModels`) on every load. No file stores it.

Choices the caption states:

- **Which federated objects are compared.** The extract lists products only, but the BOS also holds type objects, geometry items, materials, and styles (14,077 objects in all). The demo counts an object if it is drawn or if its class appears in the extract. The second rule covers the spatial structure, openings, and aggregates such as IFCROOF, which have no geometry of their own. That leaves 1,910 objects.
- **Class names are upper-cased** on both sides before comparing. The BOS already writes them in upper case, so this changes no spelling here, but it protects against a BOS that writes `IfcWallStandardCase`.
- **Identity is the STEP id.** The BOS has no GlobalId property, so the GlobalIds in the extract cannot be used. STEP ids are compared only inside the document titled `Duplex_A_20110907`. Each discipline file numbers its own entities, so the same STEP id names a different entity in the MEP file. The third chart counts how many extract ids collide this way.
- Each discipline file brings its own project, site, building, and storeys, and nothing was merged. These copies count as added: IFCBUILDINGSTOREY goes from 4 to 13 and IFCSPACE from 21 to 101.

## Run

`npm run demos` at the repository root, then open `/demos/model-diff-federated/`. Test: `npx vitest run --root packages/demos -t "demo model-diff-federated"`.
