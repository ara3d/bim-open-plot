// Cost by storey and class for an estimator: the Duplex Apartment's own
// quantities priced at synthetic unit rates under a Base and a
// value-engineered (VE) scenario, the saving per class, and the elements that
// stay unpriced. The pricing is in estimate.ts; this file draws it.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadJson, loadTable } from '../../src/data';
import type { DemoManifest } from '../../src/manifest';
import { diverging, series, tokens } from '../../src/theme';
import {
  costRows, estimate, measuresByClass, savingRows, SCENARIOS, storeyTotals, unpricedRows,
  type Estimate, type RateBook,
} from './estimate';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const ELEMENTS = '/data/duplex/elements.json';
const PARAMETERS = '/data/duplex/parameters.json';
const RELATIONS = '/data/duplex/relations.json';
const RATES = 'data/unit-rates.json';

/** The estimate and the rate book, with each manifest path resolved by `at` (a URL in a browser, a path on disk). */
export const load = async (at: (file: string) => string): Promise<{ est: Estimate; book: RateBook }> => {
  const [elements, parameters, relations, book] = await Promise.all([
    loadTable(at(ELEMENTS)),
    loadTable(at(PARAMETERS)),
    loadTable(at(RELATIONS)),
    loadJson<RateBook>(at(RATES)),
  ]);
  return { est: estimate(elements, parameters, relations, book), book };
};

/** Nine priced classes against an eight-hue palette: the ninth takes the pale teal of the diverging scheme. */
const CLASS_COLOURS = [...series, diverging[1]!];
const SCENARIO_COLOURS = [tokens.accent, series[1]!];
const SCHEMA = 'https://vega.github.io/schema/vega-lite/v6.json';

/** Figure 1: per storey, a Base bar and a VE bar, each stacked by class, with the bar's total at its end. */
const costSpec = (storeys: readonly string[], classes: readonly string[], domainMax: number, currency: string): TopLevelSpec => ({
  $schema: SCHEMA,
  data: { values: [] }, // replaced by costRows at render time
  title: {
    text: 'Cost per storey, Base and value-engineered, by class',
    subtitle: `Duplex Apartment · ${currency} · model quantities × synthetic unit rates`,
  },
  facet: {
    row: {
      field: 'storey', type: 'nominal', sort: [...storeys], title: null,
      header: { labelAngle: 0, labelAlign: 'left', labelFontWeight: 600, labelFontSize: 12 },
    },
  },
  spacing: 8,
  spec: {
    width: 560,
    height: { step: 20 },
    layer: [
      {
        mark: 'bar',
        encoding: {
          y: { field: 'scenario', type: 'nominal', sort: [...SCENARIOS], title: null },
          x: { field: 'cost', type: 'quantitative', stack: 'zero', title: `Cost (${currency})`, axis: { format: ',.0f' }, scale: { domainMax } },
          color: { field: 'class', type: 'nominal', title: 'Class', scale: { domain: [...classes], range: CLASS_COLOURS } },
          tooltip: [
            { field: 'storey' }, { field: 'scenario' }, { field: 'class' },
            { field: 'cost', title: `Cost (${currency})`, format: ',.0f' }, { field: 'items', title: 'Elements' },
          ],
        },
      },
      {
        mark: { type: 'text', align: 'left', dx: 4, fontSize: 11 },
        encoding: {
          y: { field: 'scenario', type: 'nominal', sort: [...SCENARIOS] },
          x: { aggregate: 'sum', field: 'cost', type: 'quantitative' },
          text: { aggregate: 'sum', field: 'cost', type: 'quantitative', format: ',.0f' },
        },
      },
    ],
  },
});

/** Figure 2: a dumbbell per class from the VE cost to the Base cost, labelled with the saving. */
const savingSpec = (classes: readonly string[], domainMax: number, currency: string): TopLevelSpec => ({
  $schema: SCHEMA,
  data: { values: [] }, // replaced by savingRows at render time
  title: { text: 'Saving per class (Base − VE)', subtitle: `${currency}, whole building, largest saving first` },
  width: 380,
  height: { step: 24 },
  encoding: { y: { field: 'class', type: 'nominal', sort: [...classes], title: null } },
  layer: [
    {
      mark: { type: 'rule', color: tokens.dim, strokeWidth: 2 },
      encoding: {
        x: { field: 've', type: 'quantitative', title: `Cost (${currency})`, axis: { format: ',.0f' }, scale: { domainMax } },
        x2: { field: 'base' },
      },
    },
    {
      transform: [
        { fold: ['base', 've'], as: ['key', 'cost'] },
        { calculate: "datum.key === 'base' ? 'Base' : 'VE'", as: 'scenario' },
      ],
      mark: { type: 'point', filled: true, size: 90, opacity: 1 },
      encoding: {
        x: { field: 'cost', type: 'quantitative' },
        color: { field: 'scenario', type: 'nominal', title: 'Scenario', scale: { domain: [...SCENARIOS], range: SCENARIO_COLOURS } },
        tooltip: [{ field: 'class' }, { field: 'scenario' }, { field: 'cost', title: `Cost (${currency})`, format: ',.0f' }],
      },
    },
    {
      transform: [{ calculate: "'−' + format(datum.saving, ',.0f') + ' (' + format(datum.share, '.0%') + ')'", as: 'label' }],
      mark: { type: 'text', align: 'left', dx: 9, fontSize: 11 },
      encoding: { x: { field: 'base', type: 'quantitative' }, text: { field: 'label', type: 'nominal' } },
    },
  ],
});

/** Figure 3: elements left unpriced, per class, split by why. */
const unpricedSpec: TopLevelSpec = {
  $schema: SCHEMA,
  data: { values: [] }, // replaced by unpricedRows at render time
  title: { text: 'Unpriced elements per class', subtitle: 'counted and left out of the totals, never priced at 0' },
  width: 300,
  height: { step: 24 },
  mark: 'bar',
  encoding: {
    y: { field: 'class', type: 'nominal', sort: '-x', title: null },
    x: { field: 'count', type: 'quantitative', stack: 'zero', title: 'Elements', axis: { format: 'd', tickMinStep: 1 } },
    color: {
      field: 'reason', type: 'nominal', title: 'Why unpriced',
      scale: { domain: ['no rate', 'no quantity'], range: [tokens.changed, tokens.error] },
    },
    tooltip: [{ field: 'class' }, { field: 'reason' }, { field: 'count', title: 'Elements' }, { field: 'types', title: 'Types' }],
  },
};

/** The three figures with their rows, in page order. */
const figures = (est: Estimate, book: RateBook): { title: string; spec: TopLevelSpec; rows: Row[] }[] => {
  const savings = savingRows(est);
  const classes = savings.map((r) => String(r.class));
  const maxStorey = Math.max(...storeyTotals(est).map((s) => s.base));
  const maxClass = Math.max(...savings.map((r) => Number(r.base)));
  // Each x domain runs past the longest bar so the text label at its end stays inside the plot.
  return [
    { title: 'Cost per storey, Base and VE, by class', spec: costSpec(est.storeys, classes, maxStorey * 1.15, book.currency), rows: costRows(est) },
    { title: 'Saving per class (Base − VE)', spec: savingSpec(classes, maxClass * 1.35, book.currency), rows: savings },
    { title: 'Unpriced elements per class', spec: unpricedSpec, rows: unpricedRows(est) },
  ];
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The caption: where the rates and quantities come from, the totals, and every unpriced element by count. */
export const captionHtml = (est: Estimate, book: RateBook): string => {
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: book.currency, maximumFractionDigits: 0 });
  const byMeasure = new Map<string, string[]>();
  for (const [cls, measure] of measuresByClass(est)) byMeasure.set(measure, [...(byMeasure.get(measure) ?? []), cls]);
  const measures = [...byMeasure].map(([m, classes]) => `${classes.join(', ')} by ${m}`).join('; ');
  const top = storeyTotals(est).reduce((a, b) => (b.base > a.base ? b : a));
  const unpriced = unpricedRows(est)
    .map((r) => `${r.count} ${r.class} (${escapeHtml(String(r.types))}): ${r.reason === 'no rate' ? 'no rate in the book' : 'no quantity in the model'}`)
    .join('; ');
  const parts = [...new Set(est.included.map((p) => p.partOf))]
    .map((whole) => {
      const of = est.included.filter((p) => p.partOf === whole);
      return `${of.length} ${of.length === 1 ? 'part' : 'parts'} of a ${whole} (${[...new Set(of.map((p) => p.class))].join(', ')})`;
    })
    .join('; ');
  return [
    `<strong>Rates are synthetic and illustrative</strong> (${book.currency}; ${escapeHtml(book.priceBase.replace(/\.$/, ''))}), not a priced bill.`,
    `Quantities come from the model's PSet_Revit_Dimensions: ${measures}.`,
    `${est.priced.length} elements priced: Base ${money.format(est.base)}, VE ${money.format(est.ve)}, saving ${money.format(est.base - est.ve)}.`,
    `${escapeHtml(top.storey)} carries the highest Base cost (${money.format(top.base)}).`,
    `<strong>Unpriced, ${est.unpriced.length} elements</strong>, left out of the totals: ${unpriced}.`,
    `Measured with their assembly and not priced again: ${parts}.`,
  ].join(' ');
};

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts and the rate book…');
    const { est, book } = await load((f) => dataUrl(f));
    page.status('');
    const doc = root.ownerDocument;
    const figs = figures(est, book);
    const slots = figs.map(() => doc.createElement('div'));
    const grid = doc.createElement('div');
    grid.className = 'grid';
    grid.append(...slots.slice(1));
    page.figure.append(slots[0]!, grid);
    await Promise.all(figs.map((f, i) => renderVegaLite(slots[i]!, f.spec, f.rows)));
    page.caption(captionHtml(est, book));
  },
  async headless(paths): Promise<HeadlessView[]> {
    const { est, book } = await load((f) => resolveDataPath(f, paths));
    return Promise.all(
      figures(est, book).map(async (f) => ({ kind: 'chart' as const, title: f.title, rows: f.rows.length, svg: await vegaLiteToSvg(f.spec, f.rows) })),
    );
  },
};
