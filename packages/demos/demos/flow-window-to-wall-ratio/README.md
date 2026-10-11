# Window-to-wall ratio by facing

What share of each facade is glazing, against the 0.40 prescriptive ceiling? For: energy modeller.

The figure is the output of the BIM Open Toolkit graph `viz-window-to-wall-ratio` (`samples/viz-analyses/viz-window-to-wall-ratio.json`), evaluated by the BIM Open Flow host over the Duplex Apartment in `samples/nrc` and drawn with the graph's own Vega-Lite spec (`samples/viz-analyses/specs/viz-window-to-wall-ratio.vl.json`). Under the figure the page quotes the graph's note and lists its nodes and wires, so every number traces to the step that made it.

- Data: `data/figure.json` holds the rows of the table the spec draws, as the host computed them; `data/graph.json` is the graph and `data/spec.vl.json` the spec. Model data: Duplex Apartment external wall and window face areas per facing, from bim.orientation.
- Re-export every flow-* demo's `data/` from the toolkit root: `dotnet test tests/studio/BimOpenFlow.BimWorkflows.Tests --filter "FullyQualifiedName~VizDemoExport"`, adding `-p:DepsRoot=...` while `deps/` is mid-change (see `docs/plans/viz-demos.md`).
- Run: `npm run demos` at the repository root, then open `/demos/flow-window-to-wall-ratio/`.
- Shared code: `flow-element-size-outliers/flow-demo.ts` draws every flow-* demo; it belongs in `src/`.
