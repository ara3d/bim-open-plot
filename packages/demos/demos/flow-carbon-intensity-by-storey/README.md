# Carbon intensity by storey

How much embodied carbon does each storey carry per square metre of floor? For: sustainability lead.

The figure is the output of the BIM Open Toolkit graph `viz-carbon-intensity-by-storey` (`samples/viz-analyses/viz-carbon-intensity-by-storey.json`), evaluated by the BIM Open Flow host over the Duplex Apartment in `samples/nrc` and drawn with the graph's own Vega-Lite spec (`samples/viz-analyses/specs/viz-carbon-intensity-by-storey.vl.json`). Under the figure the page quotes the graph's note and lists its nodes and wires, so every number traces to the step that made it.

- Data: `data/figure.json` holds the rows of the table the spec draws, as the host computed them; `data/graph.json` is the graph and `data/spec.vl.json` the spec. Synthetic: Element embodied carbon (A1-A3) from the NRC paper's nrc_analytics_elements.csv, which the toolkit marks synthetic, over the Duplex Apartment's materials, divided by each storey's net IfcSpace area from the model.
- Re-export every flow-* demo's `data/` from the toolkit root: `dotnet test tests/studio/BimOpenFlow.BimWorkflows.Tests --filter "FullyQualifiedName~VizDemoExport"`, adding `-p:DepsRoot=...` while `deps/` is mid-change (see `docs/plans/viz-demos.md`).
- Run: `npm run demos` at the repository root, then open `/demos/flow-carbon-intensity-by-storey/`.
- Shared code: `flow-element-size-outliers/flow-demo.ts` draws every flow-* demo; it belongs in `src/`.
