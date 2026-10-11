# Handover parameter fill rate

Which classes of element are missing the parameters the handover needs? For: bim manager.

The figure is the output of the BIM Open Toolkit graph `viz-parameter-completeness` (`samples/viz-analyses/viz-parameter-completeness.json`), evaluated by the BIM Open Flow host over the Duplex Apartment in `samples/nrc` and drawn with the graph's own Vega-Lite spec (`samples/viz-analyses/specs/viz-parameter-completeness.vl.json`). Under the figure the page quotes the graph's note and lists its nodes and wires, so every number traces to the step that made it.

- Data: `data/figure.json` holds the rows of the table the spec draws, as the host computed them; `data/graph.json` is the graph and `data/spec.vl.json` the spec. Model data: Duplex Apartment parameter values checked against fourteen COBie-style handover fields by the graph.
- Re-export every flow-* demo's `data/` from the toolkit root: `dotnet test tests/studio/BimOpenFlow.BimWorkflows.Tests --filter "FullyQualifiedName~VizDemoExport"`, adding `-p:DepsRoot=...` while `deps/` is mid-change (see `docs/plans/viz-demos.md`).
- Run: `npm run demos` at the repository root, then open `/demos/flow-parameter-completeness/`.
- Shared code: `flow-element-size-outliers/flow-demo.ts` draws every flow-* demo; it belongs in `src/`.
