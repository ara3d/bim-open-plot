// Vega-Lite for the demos: one function draws a spec into a page element,
// one renders it to SVG with no browser (for the headless test and export).
// Both apply the brand theme, so a demo writes only the spec.

import type { TopLevelSpec } from 'vega-lite';
import { vegaConfig } from './theme';

/** A row of a result table: one value per column. */
export type Row = Readonly<Record<string, string | number | boolean | null>>;

/** The spec with the theme config merged under the demo's own config. */
export const themed = (spec: TopLevelSpec): TopLevelSpec =>
  ({ ...spec, config: { ...(vegaConfig as object), ...((spec as { config?: object }).config ?? {}) } }) as TopLevelSpec;

/** Draws `spec` into `el` in a browser. `rows`, when given, becomes the spec's data.values. */
export const renderVegaLite = async (el: HTMLElement, spec: TopLevelSpec, rows?: readonly Row[]): Promise<void> => {
  const embed = (await import('vega-embed')).default;
  const full = rows ? withRows(spec, rows) : spec;
  await embed(el, themed(full), { actions: false, renderer: 'svg' });
};

/** Renders `spec` to an SVG string with Vega's headless view; works in Node and in a browser. */
export const vegaLiteToSvg = async (spec: TopLevelSpec, rows?: readonly Row[]): Promise<string> => {
  const vl = await import('vega-lite');
  const vega = await import('vega');
  const full = rows ? withRows(spec, rows) : spec;
  const compiled = vl.compile(themed(full)).spec;
  const view = new vega.View(vega.parse(compiled), { renderer: 'none' });
  return view.toSVG();
};

const withRows = (spec: TopLevelSpec, rows: readonly Row[]): TopLevelSpec =>
  ({ ...spec, data: { values: rows as Row[] } }) as TopLevelSpec;
