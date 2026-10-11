// A demo mirrored from a BIM Open Flow graph in the BIM Open Toolkit
// (samples/viz-analyses/viz-<name>.json). Its data/ folder is written by the
// toolkit's exporter (tests/studio/BimOpenFlow.BimWorkflows.Tests/VizDemoExport.cs):
//   figure.json   the rows the spec draws, exactly as the host computed them
//   graph.json    the graph document that computed them
//   spec.vl.json  the graph's Vega-Lite spec
// The page draws the spec over the rows, then lists the graph's nodes and wires.
//
// Every flow-* demo imports this file. It belongs in src/ and lives here only
// because the builder that mirrored the graphs could edit flow-* folders alone.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from './demo';
import { dataUrl, resolveDataPath } from './demo';
import { mountDemoPage } from './page';
import { renderVegaLite, vegaLiteToSvg, type Row } from './chart';
import { loadJson, loadTable } from './data';
import type { DemoManifest } from './manifest';

/** The part of a BIM Open Flow graph document this page reads. */
export interface FlowGraph {
  readonly structure: {
    readonly nodes: readonly { readonly id: string; readonly kind: string }[];
    readonly edges: readonly { readonly from: string; readonly to: string }[];
  };
  readonly values?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** One node of the graph with the endpoints wired into it ("ranked.table"). */
export interface GraphLine {
  readonly id: string;
  readonly kind: string;
  readonly inputs: readonly string[];
}

/** The nodes in document order, each with the outputs that feed it. */
export const graphLines = (g: FlowGraph): GraphLine[] =>
  g.structure.nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    inputs: g.structure.edges.filter((e) => e.to.split('.')[0] === n.id).map((e) => e.from),
  }));

/** The text of the graph's view.note, which names the role, the question, and how to read the figure. */
export const graphNote = (g: FlowGraph): string | undefined => {
  const note = g.structure.nodes.find((n) => n.kind === 'view.note');
  return note ? g.values?.[note.id]?.text : undefined;
};

/** A number for a caption: grouped thousands, at most `digits` decimals. */
export const num = (x: number, digits = 0): string =>
  x.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** A share as a whole percentage. */
export const pct = (x: number): string => `${Math.round(x * 100)}%`;

/** The sum of a numeric column, skipping missing values. */
export const total = (rows: readonly Row[], column: string): number =>
  rows.reduce((s, r) => s + (typeof r[column] === 'number' ? (r[column] as number) : 0), 0);

const FIGURE = 'data/figure.json';
const GRAPH = 'data/graph.json';
const SPEC = 'data/spec.vl.json';

interface Loaded {
  readonly rows: Row[];
  readonly graph: FlowGraph;
  readonly spec: TopLevelSpec;
}

const load = async (at: (file: string) => string): Promise<Loaded> => {
  const [rows, graph, spec] = await Promise.all([loadTable(at(FIGURE)), loadJson<FlowGraph>(at(GRAPH)), loadJson<TopLevelSpec>(at(SPEC))]);
  return { rows, graph, spec };
};

const specTitle = (spec: TopLevelSpec): string => {
  const t = (spec as { title?: string | { text?: string | string[] } }).title;
  const text = typeof t === 'string' ? t : t?.text;
  return (Array.isArray(text) ? text.join(' ') : text) ?? 'Figure';
};

/** The section under the figure: the graph's id, its note, and one line per node. */
const graphSection = (doc: Document, graphId: string, g: FlowGraph): HTMLElement => {
  const section = doc.createElement('section');
  section.style.marginTop = '20px';
  section.style.fontSize = '13px';
  const h = doc.createElement('h2');
  h.style.fontSize = '15px';
  h.style.margin = '0 0 6px';
  h.textContent = `The graph that computed this figure: ${graphId}`;
  const lines = graphLines(g);
  const where = doc.createElement('p');
  where.style.margin = '0 0 8px';
  where.textContent = `samples/viz-analyses/${graphId}.json in the BIM Open Toolkit, evaluated by the BIM Open Flow host: ${lines.length} nodes, ${g.structure.edges.length} wires. Each line is a node, its kind, and the outputs wired into it.`;
  section.append(h, where);
  const note = graphNote(g);
  if (note) {
    const quote = doc.createElement('blockquote');
    quote.style.margin = '0 0 8px';
    quote.style.paddingLeft = '10px';
    quote.style.borderLeft = '3px solid #ccc';
    quote.textContent = note;
    section.append(quote);
  }
  const list = doc.createElement('ol');
  list.style.fontFamily = 'ui-monospace, Consolas, monospace';
  list.style.fontSize = '12px';
  list.style.margin = '0';
  for (const line of lines) {
    const li = doc.createElement('li');
    li.textContent = `${line.id}  ${line.kind}${line.inputs.length ? `  ← ${line.inputs.join(', ')}` : ''}`;
    list.append(li);
  }
  section.append(list);
  return section;
};

/**
 * A Demo for a mirrored graph: draws data/spec.vl.json over data/figure.json, shows the
 * graph from data/graph.json under the figure, and writes `caption(rows)` under it all.
 */
export const flowDemo = (manifest: DemoManifest, graphId: string, caption: (rows: readonly Row[]) => string): Demo => ({
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the graph output…');
    try {
      const d = await load((f) => dataUrl(f));
      page.status('');
      const doc = root.ownerDocument;
      const chart = doc.createElement('div');
      page.figure.append(chart, graphSection(doc, graphId, d.graph));
      await renderVegaLite(chart, d.spec, d.rows);
      page.caption(caption(d.rows));
    } catch (e) {
      page.status(`Could not draw the figure: ${String(e)}`, true);
    }
  },
  async headless(paths): Promise<HeadlessView[]> {
    const d = await load((f) => resolveDataPath(f, paths));
    const lines = graphLines(d.graph);
    return [
      { kind: 'chart', title: specTitle(d.spec), rows: d.rows.length, svg: await vegaLiteToSvg(d.spec, d.rows) },
      {
        kind: 'table',
        title: `Graph ${graphId}`,
        rows: lines.length,
        description: { graph: graphId, nodes: lines.length, edges: d.graph.structure.edges.length, caption: caption(d.rows) },
      },
    ];
  },
});
