# BIM Open Plot: project brief

Written 2026-10-11 from the repository's README, brand guide, and two proposals, the code it grows from in bim-open-flow and bim-open-viewer, and an interview with the owner. This is a component brief: BIM Open Plot is one repository of the BIM Open family, and its workflows serve the family brief, `PROJECT.md` in bim-open-toolkit, whose workflows are cited here as W1 to W5. Tickets for this repository live in the toolkit's `tickets/` folder, with fences under `deps/bim-open-plot/`. A line ending `(unconfirmed)` rests on an inference; the owner confirms or corrects it and removes the marker.

## Purpose

A result table from a building model becomes a picture through a vendor's dashboard tool or a hand-written script, and the picture loses the data and the steps that made it. BIM Open Plot turns tables into charts, drawings, 3D overlays, maps, and infographics for the professionals and stakeholders of a construction project and for the agents that answer their questions: a figure is a JSON spec that Claude can write, a run record can hash, and the studio, a notebook, and an exported file all render the same way. It builds on Vega-Lite for 2D charts and on BIM Open Viewer for everything drawn on the building: plans and sections cut from geometry, bars standing in 3D space, and the model placed on a map.

## Users

- **A BIM professional working through Claude**: a BIM manager, architect, engineer, or coordinator who asks for a chart, a coloured plan, or a report and wants something to share. Shaped for this user first, as the family is.
- **Claude**, in Claude Code or the studio's Ask box: writes a figure spec as a tool result, needs the catalog of figure kinds and examples it can copy, and sees the rendered result inline.
- **A project stakeholder** (owner, project manager, estimator, facility manager, sustainability lead, site superintendent) who opens a demo page, a notebook, or an exported report with nothing installed and needs to understand it unaided.
- **A developer or Claude extending the family**: adds a figure kind, a renderer, or a demo.

## Workflows

1. **Ask Claude for a figure.** Serves W2 and W3. Actor and trigger: a BIM professional asks, in Claude Code or the Ask box, for "a door schedule per storey with a chart, as a report". Today: bim-open-flow's `@bimopenflow/viz` draws bar and line charts and tables as SVG in 773 lines with no legend layout; the studio's Chart tab, the notebook's chart embed, and the C# dashboard generator share it; a chart in the notebook is a 50-row snapshot. With this project: a `plot.*` node pack from this repository, loaded in the toolkit's `bim` profile, emits figure specs: a Vega-Lite spec verbatim for any 2D chart, and this repository's own JSON for drawing, 3D, and map views, composed into one figure with a selection keyed on element, storey, or class. The spec renders identically in the studio, in a notebook that opens with no host, and in a self-contained HTML, SVG, PNG, or PDF written headlessly. Done: the `chart.*` kinds are replaced by `plot.*` kinds and the catalog lists at least twelve figure kinds; one committed spec file renders in the studio, the notebook, and the headless exporter with a snapshot test that compares the three; on a committed set of ten chart tasks from the sample notebooks, Claude writes a valid spec that answers the task for at least nine. Cost of failure: "detailed analysis and charts" stays two chart types and a screenshot.
2. **See the data on the building.** Serves W3. Actor and trigger: a coordinator or manager wants rooms coloured by area on a plan, a section coloured by embodied carbon, storey totals as bars beside the building, or the project on a map beside its neighbours. Today: the viewer has clipping, per-instance colour, overhead navigation, and PNG capture, and the `view3d.*` nodes drive them as imperative verbs; no drawing is cut from geometry to 2D; nothing draws a map; `Ara3D.IO.GeoJson` in ara3d-sdk reads and writes GeoJSON and IMDF (Indoor Mapping Data Format, OGC 20-094: a GeoJSON profile with venue, level, unit, opening, and other feature types) but nothing in the family uses it. With this project: `drawing`, `scene3d`, and `map` view kinds render over the viewer; BOS (BIM Open Schema) levels, spaces, and doors become an IMDF archive; any GeoJSON file is a map layer; `IfcMapConversion` or a stated origin places the model on a public basemap; DuckDB's spatial extension and bim-open-flow's `spatial.*` pack supply joins. Done: from the public Duplex model, one command writes an IMDF archive whose `manifest.json`, `venue`, `address`, `level`, `unit`, and `opening` files validate against the specification; a plan drawing of one storey coloured by a table column is written as SVG and PNG by a test; a map demo on the public page shows the Duplex footprint at its coordinates on a basemap with a GeoJSON layer beside it. Cost of failure: the spatial half of every stakeholder's question, where is it and what is next to it, stays unanswered.
3. **Browse twenty demos and find your own.** Serves W1. Actor and trigger: a stakeholder hears of the toolkit and opens the public page to see whether it speaks to their job. Today: this repository holds brand and research and nothing that runs; the viewer's `workflows` package carries ten review recipes (door schedule, takeoff, delivery timeline, valve isolation, asset handover, material carbon, and others) with no figure page. With this project: a demo page in this repository with at least twenty demos, each named for a role and a decision on a realistic construction project, each rendered from a spec file and a data file in the repository, over the public models, with synthetic schedule, cost, progress, and sensor data allowed when marked synthetic on the page, and each showing the graph that produced it. Done: the page opens from GitHub Pages with nothing installed and lists at least twenty demos; every demo's spec renders headlessly in a test; every synthetic dataset carries a visible label. Cost of failure: the toolkit is shown with a bar chart, and an estimator or facility manager sees nothing for them.
4. **Add a figure kind.** Serves W4. Actor and trigger: a developer or Claude needs a mark or a view that does not exist, such as a Gantt bar or a stacked storey profile. Today: a new chart is a hand-written SVG module in `@bimopenflow/viz` and a C# node in another repository. With this project: a figure kind is one folder in this repository holding its schema, its renderer, its catalog entry, and one demo, and the `plot.*` pack picks it up. Done: adding a kind touches one folder here and it appears in the catalog, in Claude's tool description, and on the demo page, with no edit to bim-open-flow or the toolkit. Cost of failure: every new picture waits on the owner.

## Principles

1. **A figure is data.** Every figure is a JSON spec plus the rows it shows; renderers are functions of the two and hold no state: a spec can be hashed into a run record, diffed, and written by Claude.
2. **Same picture everywhere.** The studio, the notebook, and the exported file render one spec through one code path, and a snapshot test compares them: a figure a colleague opens is the one the author saw.
3. **Build on Vega-Lite and the viewer; write only what they cannot draw.** 2D charts are Vega-Lite verbatim; renderers of our own exist for drawings cut from geometry, 3D overlays, and maps: a library with a published schema and a corpus beats one we would document alone.
4. **Selection by building key.** A selection is a set of element ids, storeys, or classes, never pixels or one view's rows: a chart, a drawing, the 3D view, and a table share it.
5. **Honest absence.** A figure shows a missing value as missing, never as zero or an interpolation, inherited from the family brief.
6. **One theme.** Fonts, colours, and status hues come from one theme object derived from `brand/BRANDING.md`, applied to Vega-Lite as `config` and to the viewer as its palette: a chart and the coloured model beside it agree.
7. **Demos tell the truth about their data.** A demo over synthetic numbers says so where the reader looks: a realistic picture must not be mistaken for a measured one.

## Replaces or augments

Replaces: `@bimopenflow/viz` and the `chart.bar` and `chart.line` nodes; the dashboard generator's inlined styles; screenshots of tables as deliverables. Augments and stays compatible with: bim-open-flow (the host that computes the table and the notebook's embed contract with its 50-row snapshot), bim-open-viewer (the renderer for everything on the building), bim-open-notebook, Vega-Lite and its headless tools, Ara3D.IO.GeoJson, DuckDB's spatial extension, and public basemaps.

## Scope

In: the figure spec (Vega-Lite for 2D, own JSON for drawing, 3D, map, and composed figures) with its schema and validator; the renderers; the `plot.*` C# node pack; headless export to SVG, PNG, PDF, and self-contained HTML; IMDF read and write and GeoJSON layers; georeferencing on a basemap; the theme; the demo page with its twenty demos and their data; tests that render every demo and every figure kind.
Out: a general charting library that competes with Vega-Lite on 2D charts; live cross-filtering over a database in the notebook (Mosaic; revisit for the studio only); authoring or editing geometry; GIS analysis beyond joins and measures; hosting map tiles; routing and navigation over IMDF; animation and transitions in 2D charts until a demo needs them; the private Snowdon model in the public demos.

## Success

- The public demo page lists at least twenty demos over public models, each rendered from a committed spec by a test.
- Claude, asked in Claude Code, produces a figure that opens in a notebook with no host and as a self-contained HTML, for every chart task in the committed ten-task set, with at least nine correct.
- A plan drawing, a 3D overlay, and a map of the Duplex, each coloured from the same table, share one selection in the studio.

## Open questions

- TKT-220 Does bim-open-flow's `tables` profile keep a 2D chart node when `chart.*` moves here?
- TKT-221 Which basemap and which georeference when the model has no `IfcMapConversion`?
- TKT-222 How does a figure's selection reach the notebook and the viewer (one bus or per-host adapters)?
