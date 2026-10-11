// Clash candidate matrix (from the graph): the figure of the toolkit graph viz-clash-matrix, drawn from that graph's own
// output (data/figure.json) with its own Vega-Lite spec, and the graph listed under it.

import type { Row } from '../../src/chart';
import type { DemoManifest } from '../../src/manifest';
import { flowDemo, num, total } from '../../src/flow-demo';
import raw from './demo.json';

export const demo = flowDemo(raw as DemoManifest, 'viz-clash-matrix', (rows: readonly Row[]): string => {
    const top = [...rows].sort((a, b) => Number(b.Pairs) - Number(a.Pairs)).slice(0, 3);
    return `${num(total(rows, 'Pairs'))} element pairs across ${rows.length} class pairs have overlapping boxes. Most: ${top.map((r) => `${String(r.RowClass)} with ${String(r.ColumnClass)} (${String(r.Pairs)})`).join(', ')}. These are box candidates, not confirmed clashes.`;
  });
