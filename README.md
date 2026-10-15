<p><img src="brand/lockup.svg" alt="BIM Open Plot" height="48"></p>

Charts, drawings, 3D overlays, and maps from building-model tables, for the people who ask questions about a building and the agents that answer them.

[![Sixteen of the demos: the Duplex in 3D by storey, embodied carbon by material, a floor plan coloured by room area, handover fill rates, facade area by direction, a site map, clash candidates, a construction Gantt, size outliers, progress against plan, a room adjacency network, the model's make-up by class, cost per storey, carbon per m², and door widths against an 850 mm minimum](docs/collage.png)](https://ara3d.github.io/bim-open-plot/)

The [demo page](https://ara3d.github.io/bim-open-plot/) opens in a browser with nothing installed. It holds 34 figures over the public Duplex Apartment model, each named for a role on a construction project (facility manager, estimator, site superintendent, sustainability lead) and the decision it supports. Fourteen of them, marked "from the graph", show rows computed by a [BIM Open Flow](https://github.com/ara3d/bim-open-flow) graph together with the graph's nodes and wires.

## What it is

BIM Open Plot is the picture layer of the [BIM Open family](https://github.com/ara3d/bim-open-toolkit), a set of open-source repositories for working with building information models (BIM) through tables and through Claude. The other parts compute a result table from a model; this one turns the table into a figure: a bar or line chart, a floor plan coloured by a column, bars standing beside the building in 3D, the model placed on a map, or several of these composed for a report.

It is for a BIM manager, architect, engineer, or project stakeholder who has a question about a model and wants the answer as a picture they can share, and for the agent, in practice Claude, that writes the figure for them. Developers who extend the family add figure kinds and demos here.

## The problem

A result table from a building model becomes a picture through a vendor's dashboard tool or a hand-written script, and the picture loses the data and the steps that made it. A colleague who receives a screenshot cannot check a number, rerun the query on next week's model, or see which rooms the bar stands for. BIM Open Plot's answer is that a figure is data: a JSON specification plus the rows it draws, which an agent can write, a run record can hash, and the studio, a notebook, and an exported file render the same way. The project brief, [`PROJECT.md`](PROJECT.md), gives the four workflows this serves and the measures that say when each is done.

## What it does not do

- It is not a general charting library. 2D charts are [Vega-Lite](https://vega.github.io/vega-lite/) specifications drawn by Vega-Lite; this repository adds a theme and the views Vega-Lite cannot draw (plans and sections, 3D overlays, maps), not a competitor.
- It does not read IFC or BOS (BIM Open Schema) files itself. The tables come from [bim-open-flow](https://github.com/ara3d/bim-open-flow) and the toolkit's IFC tools; the demos read JSON extracts and `.bos` files that were exported in advance.
- It does not do live cross-filtering over a database in a notebook. [`docs/proposals/mosaic-for-notebook.md`](docs/proposals/mosaic-for-notebook.md) explains why a notebook whose figures carry a 50-row snapshot and open with no host rules that out.
- It does not author or edit geometry, host map tiles, route through a building, or run GIS analysis beyond joins and measures.
- Drawings are not yet cut from geometry. Floor plans, heat maps, and egress maps draw each element as its axis-aligned bounding box, and every caption says so.

## What runs today

As of 2026-10-15 the repository holds one runnable package, the demo page in `packages/demos`, and two design proposals. The figure specification, its validator, the `plot.*` node pack for bim-open-flow, headless export to PNG and PDF, and the IMDF (Indoor Mapping Data Format) writer named in the brief do not exist yet. The demo page is where their shared code is being grown: a page frame, the brand theme as a Vega-Lite `config`, loaders for the Duplex extracts, a box model of the building, a plan renderer, a 3D helper over [bim-open-viewer](https://github.com/ara3d/bim-open-viewer), and a map helper over MapLibre, all under `packages/demos/src`.

Each demo is one folder under `packages/demos/demos/` that builds, runs, and tests on its own. Its `demo.json` says who the figure is for and where every number comes from:

```json
{
  "slug": "room-area-plan",
  "title": "Room areas on the floor plan",
  "role": "Facility manager",
  "decision": "Where is each room, and how large is it?",
  "kinds": ["drawing"],
  "model": "duplex",
  "data": [
    { "file": "/data/duplex/elements.json", "provenance": "model", "note": "Duplex Apartment entities with their storey" },
    { "file": "/data/duplex/parameters.json", "provenance": "model", "note": "Duplex Apartment room Area, Number, and name, and storey elevations" },
    { "file": "/data/duplex/bounds.json", "provenance": "model", "note": "Duplex Apartment bounding boxes for rooms, walls, and doors" }
  ],
  "tags": ["floor-plan", "heatmap", "area", "rooms"]
}
```

A data source whose `provenance` is `synthetic` (invented schedule, cost, progress, or sensor numbers) puts a **Synthetic data** badge on the page, and the demo's README says how the numbers were invented. The folder layout and the rules every demo follows are in [`packages/demos/README.md`](packages/demos/README.md).

## Running it locally

Prerequisites: Git and Node.js 22, the version the Pages workflow uses (Vite 7 needs at least 20.19). The demos have been run on Windows 11 and, by the Pages workflow, on Ubuntu.

The demos import the 3D viewer's source from a pinned checkout of bim-open-viewer rather than from a published package, so that checkout is fetched and its core package built before this repository's own install. These are the steps `.github/workflows/pages.yml` runs on every push to `main`:

```bash
node deps.mjs
```

```bash
cd deps/bim-open-viewer && npm ci && npm run build:gratify && npm run build -w @bim-open-viewer/core && cd ../..
```

```bash
npm ci
```

Then test and run:

```bash
npm test
```

```bash
npm run demos
```

The test command renders every demo without a browser and checks that each declared view is present, draws at least one row, and, for charts and drawings, produces an SVG with no `NaN`. On 2026-10-15 it ran 238 tests in 24 files in about 30 seconds. The run command serves the site at `http://127.0.0.1:5320/`: the index with its filters by role, figure kind, and origin at `/`, and one demo at `/demos/<slug>/`.

Three more scripts maintain the site: `npm run demos:index` rewrites `public/index.json` after a demo is added, `npm run demos:thumbs` screenshots each demo's headline view into `public/thumbs/`, and `npm run demos:collage` assembles the picture at the top of this file from those thumbnails.

`node deps.mjs` reads `deps.json`, which pins bim-open-flow, bim-open-viewer, and [Gratify](https://github.com/ara3d/gratify) by commit, and clones each into the git-ignored `deps/` folder; `node deps.mjs --check` reports each clone's commit against its pin. The same script is in every BIM Open repository, and its design is `docs/plans/repository-split.md` in bim-open-toolkit.

## Trade-offs

- **Vega-Lite verbatim for 2D charts.** A published schema with a corpus of examples is what lets Claude write a valid chart on the first try, and the notebook can render one with no host. The price is that a chart's look is bounded by what Vega-Lite's `config` can theme, and that a drawing, a 3D view, and a chart cannot yet share a selection; [`docs/proposals/chart-spec-comparison.md`](docs/proposals/chart-spec-comparison.md) proposes a specification of our own whose 2D subset copies Vega-Lite's shapes, with a selection keyed on element, storey, or class, to recover that.
- **Bounding boxes instead of geometry cuts.** Drawing a plan from boxes needed no geometry kernel and works for every element with bounds, at the cost of rectangles where walls have angles and openings have shape. The captions name the approximation rather than hide it.
- **One folder per demo, shared code by request.** Twenty demos were built by several agents at once, each editing only its own folder, which kept them independent and kept the shared code small. It also means a shared fix lands in `src/` separately and some helpers sit where their first user put them (`src/flow-demo.ts` is one).
- **Source imports from a sibling checkout.** Reading the viewer's TypeScript from `deps/` means no published package to version and one copy of three.js, at the cost of the two extra install steps above.

## Tested and untested

Tested: every demo's manifest, files, and headless render, by the shared test on each push; the plan renderer, the box model, and the 3D scene helper by their own tests under `packages/demos/test`; the Pages build, by the workflow that deploys the site. The site at the link above was last deployed from `main` on 2026-10-11.

Untested, or tested only by eye: the 3D views and the map render on a real GPU (the headless test accepts a text description for them, which is also what a browser without WebGL shows); the look of each page beyond its SVG; whether any of this is the right shape for the figure specification and node pack still to come. Nothing here has been used on a model larger than the Duplex and Schependomlaan samples.

## Related work

The chart-spec comparison dated 2026-10-11 is the evidence for the first three lines; these judgements can go stale as the projects move.

- [Vega-Lite](https://vega.github.io/vega-lite/) is what this repository uses for 2D charts; it has no notion of a building element, storey, or geometry, which is what the proposed specification adds.
- [Mosaic](https://idl.uw.edu/mosaic/) coordinates views over a DuckDB connection and was considered for the notebook; it needs a live database per interaction, which a hostless notebook embed does not have.
- [Vega](https://vega.github.io/vega/) was weighed as the base specification instead of Vega-Lite and set aside: its specifications are long, and the comparison judges that a model writes Vega-Lite far more reliably.
- Vendor dashboards such as Power BI with a BIM connector, and Speckle's web views, produce pictures from models today; they keep the data in the vendor's service and the steps in a person's head, which is the gap described above. This line is a general comparison, not from the proposal.
- `@bimopenflow/viz` in bim-open-flow is the predecessor: bar and line charts and tables as hand-written SVG, shared by the studio's Chart tab, the notebook's chart embed, and the C# dashboard generator. This repository replaces it.

## How the repository is organized

| Path | What it holds |
|---|---|
| `PROJECT.md` | The component brief: users, four workflows with their Done lines, principles, scope, open questions |
| `AGENTS.md` | Orientation for agents working here; tickets live in bim-open-toolkit's `tickets/` with fences under `deps/bim-open-plot/` |
| `brand/` | The mark, the lockup, and `BRANDING.md` with the colours and rules |
| `docs/proposals/` | The two investigations from 2026-10-11 that set the design direction |
| `docs/collage.png` | The picture at the top of this file, built by `npm run demos:collage` |
| `packages/demos/` | The demo page: `src/` shared code, `demos/<slug>/` one folder per figure, `public/` the Duplex extracts, `.bos` models, and thumbnails, `test/` the shared tests, `scripts/` the index, thumbnail, and collage builders |
| `deps.json`, `deps.mjs` | The pinned sibling repositories and the script that fetches them into `deps/` |
| `.github/workflows/pages.yml` | Tests every demo and publishes the site to GitHub Pages on each push to `main` |

## Where it stands in the family

| | Repository | Role |
|---|---|---|
| <img src="https://raw.githubusercontent.com/ara3d/bim-open-toolkit/main/docs/brand/mark.svg" width="22" height="22" alt=""> | [bim-open-flow](https://github.com/ara3d/bim-open-flow) | Graphs over tables; the host that computes the result a figure shows |
| <img src="https://raw.githubusercontent.com/ara3d/bim-open-toolkit/main/docs/brand/viewer-mark.svg" width="22" height="22" alt=""> | [bim-open-viewer](https://github.com/ara3d/bim-open-viewer) | The 3D renderer that draws the model a figure colours or sections |
| <img src="https://raw.githubusercontent.com/ara3d/bim-open-toolkit/main/docs/brand/notebook-mark.svg" width="22" height="22" alt=""> | [bim-open-notebook](https://github.com/ara3d/bim-open-notebook) | The document a figure is embedded in, with its snapshot |
| <img src="brand/mark.svg" width="22" height="22" alt=""> | bim-open-plot | This repository: the figure specification and its renderers |

The three clients of the flow host, Notebook, Viewer, and Plot, share a mark that starts from the node disc; see [`brand/BRANDING.md`](brand/BRANDING.md).

## Who it is for, and who should wait

Open the demo page if you want to see what questions about a building look like as pictures, or if you are deciding whether the BIM Open family speaks to your job. Clone the repository if you are adding a demo or a renderer, or writing the figure specification and node pack the brief describes.

Wait if you need a library to call from your own code, a chart from your own IFC file without the rest of the toolkit, or exact plans cut from geometry. None of those exist as of 2026-10-15; the brief's workflows 1, 2, and 4 are where they are planned.

## Licence and problems

MIT, as the rest of the family; see [`LICENSE`](LICENSE). The sample buildings keep their own licences, listed in `packages/demos/public/models/NOTICE.md`. Report problems and propose work as tickets in [bim-open-toolkit](https://github.com/ara3d/bim-open-toolkit), where this repository's tickets live.
