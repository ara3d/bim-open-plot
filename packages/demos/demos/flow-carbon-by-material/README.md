# Embodied carbon by material

Which few materials carry 80% of the embodied carbon, and which can be ignored? For: sustainability lead.

The figure is the output of the BIM Open Toolkit graph `viz-carbon-by-material` (`samples/viz-analyses/viz-carbon-by-material.json`), evaluated by the BIM Open Flow host over the Duplex Apartment in `samples/nrc` and drawn with the graph's own Vega-Lite spec (`samples/viz-analyses/specs/viz-carbon-by-material.vl.json`). Under the figure the page quotes the graph's note and lists its nodes and wires, so every number traces to the step that made it.

- Data: `data/figure.json` holds the rows of the table the spec draws, as the host computed them; `data/graph.json` is the graph and `data/spec.vl.json` the spec. Synthetic: Element embodied carbon (A1-A3) from the NRC paper's nrc_analytics_elements.csv, which the toolkit marks synthetic, over the Duplex Apartment's materials, split over material layers by thickness.
- Re-export every flow-* demo's `data/` from the toolkit root: `dotnet test tests/studio/BimOpenFlow.BimWorkflows.Tests --filter "FullyQualifiedName~VizDemoExport"`, adding `-p:DepsRoot=...` while `deps/` is mid-change (see `docs/plans/viz-demos.md`).
- Run: `npm run demos` at the repository root, then open `/demos/flow-carbon-by-material/`.
- Shared code: `flow-element-size-outliers/flow-demo.ts` draws every flow-* demo; it belongs in `src/`.
