<p><img src="brand/lockup.svg" alt="BIM Open Plot" height="48"></p>

Charts, drawings, and figures from building-model tables, for the people who ask the questions and the agents that answer them.

[![Sixteen of the demos: the Duplex in 3D by storey, embodied carbon by material, a floor plan coloured by room area, handover fill rates, facade area by direction, a site map, clash candidates, a construction Gantt, size outliers, progress against plan, a room adjacency network, the model's make-up by class, cost per storey, carbon per m², and door widths against an 850 mm minimum](docs/collage.png)](https://ara3d.github.io/bim-open-plot/)

The [demo page](https://ara3d.github.io/bim-open-plot/) has 34 figures over the public Duplex model, each for a named role and a decision; the ones marked "from the graph" are computed by a [BIM Open Flow](https://github.com/ara3d/bim-open-flow) graph in the toolkit. Regenerate this picture with `npm run demos:thumbs` then `npm run demos:collage`.

BIM Open Plot is the picture layer of the [BIM Open family](https://github.com/ara3d/bim-open-toolkit): the part that turns a result table into a bar chart, a line chart, a section drawing coloured by data, a bar standing beside the building in 3D, or a composed figure for a report. What runs today, 2026-10-11, is the demo page in `packages/demos`: twenty standalone demos and fourteen mirrors of toolkit graphs, each one folder with its manifest, data, page, and a test that renders it with no browser; the shared code under `packages/demos/src` (the page frame, the brand theme as a Vega-Lite config, loaders for the Duplex extracts, a box model of the building, a plan renderer, a 3D helper over the viewer, a map helper) is what the figure spec and the `plot.*` node pack grow from. 2D charts are Vega-Lite; floor plans, heat maps, and egress maps are drawn from element bounding boxes until a geometry cut exists, and every caption says so. Run it with `npm install` then `npm run demos` (port 5320); test it with `npm test`. The code it replaces is `@bimopenflow/viz` in [bim-open-flow](https://github.com/ara3d/bim-open-flow) (bar and line charts and tables as SVG, shared by the studio's Chart tab, the notebook's chart embed, and the C# dashboard generator) and the `view3d.*` nodes over [bim-open-viewer](https://github.com/ara3d/bim-open-viewer).

## What it is for

The project brief, [`PROJECT.md`](PROJECT.md), says who it is for, the four workflows it serves, its principles, and what is in and out of scope. Tickets for this repository live in [bim-open-toolkit](https://github.com/ara3d/bim-open-toolkit)'s `tickets/` folder, with fences under `deps/bim-open-plot/`.

## Where it stands in the family

| | Repository | Role |
|---|---|---|
| <img src="https://raw.githubusercontent.com/ara3d/bim-open-toolkit/main/docs/brand/mark.svg" width="22" height="22" alt=""> | [bim-open-flow](https://github.com/ara3d/bim-open-flow) | Graphs over tables; the host that computes the result a figure shows |
| <img src="https://raw.githubusercontent.com/ara3d/bim-open-toolkit/main/docs/brand/viewer-mark.svg" width="22" height="22" alt=""> | [bim-open-viewer](https://github.com/ara3d/bim-open-viewer) | The 3D renderer that draws the model a figure colours or sections |
| <img src="https://raw.githubusercontent.com/ara3d/bim-open-toolkit/main/docs/brand/notebook-mark.svg" width="22" height="22" alt=""> | [bim-open-notebook](https://github.com/ara3d/bim-open-notebook) | The document a figure is embedded in, with its snapshot |
| <img src="brand/mark.svg" width="22" height="22" alt=""> | bim-open-plot | This repository: the figure spec and its renderers |

The three clients of the flow host, Notebook, Viewer, and Plot, share a mark that starts from the node disc; see `brand/BRANDING.md`.

## Design direction

Two investigations from 2026-10-11 set the direction; both are in `docs/proposals/` with the evidence for each claim.

- [`chart-spec-comparison.md`](docs/proposals/chart-spec-comparison.md) compares Vega-Lite, Vega, Mosaic, and a JSON spec of our own for AEC, and recommends a spec of our own whose 2D-chart subset copies Vega-Lite's shapes and renders through Vega-Lite today, while 3D overlays, drawings cut from geometry, maps, and transitions get renderers of our own over the viewer and [Gratify](https://github.com/ara3d/gratify). The one idea that lets charts, drawings, and 3D views share a spec is a selection keyed on element, storey, or class rather than on one view's rows.
- [`mosaic-for-notebook.md`](docs/proposals/mosaic-for-notebook.md) finds that Mosaic's DuckDB-per-interaction model does not fit a notebook whose embeds carry a 50-row snapshot and open with no host, and that Vega-Lite does.

The next step named there is a half-day spike: ten chart tasks from the sample notebooks, written by Claude as Vega-Lite and in a draft of the proposed `chart2d` shape, scored for validity and correctness. The result decides whether the 2D subset is a translation or Vega-Lite verbatim.

## Dependencies

`deps.json` pins the sibling repositories this one will read, by commit; `node deps.mjs` fills the git-ignored `deps/` folder, and `node deps.mjs --check` compares each clone with its pin. The script is the same file every BIM Open repository carries; its design is `docs/plans/repository-split.md` in bim-open-toolkit.

## Licence

MIT, as the rest of the family.
