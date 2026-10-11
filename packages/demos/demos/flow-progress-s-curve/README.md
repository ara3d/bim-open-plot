# Progress S-curve (from the graph)

How many elements should be installed by each week, and how far behind is the site? For: project manager.

The figure is the output of the BIM Open Toolkit graph `viz-progress-s-curve` (`samples/viz-analyses/viz-progress-s-curve.json`), evaluated by the BIM Open Flow host over the Duplex Apartment in `samples/nrc` and drawn with the graph's own Vega-Lite spec (`samples/viz-analyses/specs/viz-progress-s-curve.vl.json`). Under the figure the page quotes the graph's note and lists its nodes and wires, so every number traces to the step that made it.

- Data: `data/figure.json` holds the rows of the table the spec draws, as the host computed them; `data/graph.json` is the graph and `data/spec.vl.json` the spec. Synthetic: Invented by bim.buildSequence over the Duplex Apartment's real element list: storeys bottom-up, trades Structure, Envelope, MEP, Finishes, 10-day tasks from 2027-01-04; no real programme; Actual is Planned held three weeks late, a made-up slip.
- Re-export every flow-* demo's `data/` from the toolkit root: `dotnet test tests/studio/BimOpenFlow.BimWorkflows.Tests --filter "FullyQualifiedName~VizDemoExport"`, adding `-p:DepsRoot=...` while `deps/` is mid-change (see `docs/plans/viz-demos.md`).
- Run: `npm run demos` at the repository root, then open `/demos/flow-progress-s-curve/`.
- Shared code: `flow-element-size-outliers/flow-demo.ts` draws every flow-* demo; it belongs in `src/`.
