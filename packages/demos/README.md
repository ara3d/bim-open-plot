# Demos

The public demo page of BIM Open Plot: one figure per role and decision on a realistic construction project, over public building models. Serves workflow 3 of `PROJECT.md`. Each demo is one folder under `demos/` that builds, runs, and tests on its own; the index page only links them.

Run the site: `npm run demos` at the repository root (port 5320), then open `/` for the index or `/demos/<slug>/` for one demo. Test every demo: `npm test -w @bim-open-plot/demos`. Rebuild the index after adding a demo: `npm run demos:index`.

## A demo folder

```
demos/<slug>/
  demo.json      the manifest (src/manifest.ts): slug, title, role, decision, kinds, model, data, tags
  README.md      what the figure shows, who it is for, where every number comes from, how to run it
  index.html     the page: a #app div and <script type="module" src="./main.ts">
  main.ts        exports `demo: Demo` (src/demo.ts): manifest, render(root), headless(paths)
  main.test.ts   optional: checks specific to this demo (the shared test already renders it)
  data/          this demo's own files (synthetic tables as JSON or CSV, GeoJSON)
  spec*.json     optional: Vega-Lite specs kept as data rather than inline
```

Rules:

- `render(root)` calls `mountDemoPage(root, manifest)` from `src/page.ts` and draws into the `figure` element it returns. The frame shows the role, the decision, the model's licence, and a **Synthetic data** badge whenever any data source has `provenance: "synthetic"`. Do not draw your own header.
- `headless(paths)` loads the same data from disk and returns one `HeadlessView` per view: `svg` for charts and drawings (use `vegaLiteToSvg` from `src/chart.ts`), `description` for a 3D scene or a map (the layers, the element count, the camera). The shared test (`test/demos.test.ts`) fails a demo whose SVG is missing, empty, or contains `NaN`, or whose rows are 0.
- 2D charts are Vega-Lite specs, drawn with `renderVegaLite` and themed by `src/theme.ts`. Do not add a second charting library.
- A 3D view uses the viewer through `src/scene.ts`; a map uses MapLibre through `src/map.ts`. Both degrade to a text description when WebGL is unavailable.
- Data: the Duplex extracts in `public/data/duplex/` (`elements.json`, `parameters.json`, `relations.json`, `bounds.json`, from `ifc_sql_export` and `ifc_bounds` over `data/duplex.ifc` in the toolkit on 2026-10-11; newline-delimited JSON, read with `loadTable()` from `src/data.ts`; `bounds.json` is one object, `BoundsFile`); the models in `public/models/` (`duplex.bos`, `duplex-federated.bos`, `schependomlaan.bos`, licences in `NOTICE.md`). Synthetic data lives in the demo's own `data/` folder with a `note` in the manifest saying how it was invented; keep it plausible (real unit prices, durations, and rates of the kind a project of that size has) and never present it as measured.
- Honest absence: a missing value stays missing. No zero for a null area, no interpolated reading.
- Each demo owns only its folder. Shared code changes (`src/`) are requests to the supervisor, not edits.
