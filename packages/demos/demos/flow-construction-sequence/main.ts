// Construction sequence (from the graph): the figure of the toolkit graph viz-construction-sequence, drawn from that graph's own
// output (data/figure.json) with its own Vega-Lite spec, and the graph listed under it.

import type { Row } from '../../src/chart';
import type { DemoManifest } from '../../src/manifest';
import { flowDemo, num, total } from '../flow-element-size-outliers/flow-demo';
import raw from './demo.json';

export const demo = flowDemo(raw as DemoManifest, 'viz-construction-sequence', (rows: readonly Row[]): string => {
    const starts = rows.map((r) => String(r.Start)).sort();
    const ends = rows.map((r) => String(r.End)).sort();
    return `${rows.length} tasks covering ${num(total(rows, 'ElementCount'))} elements, from ${starts[0]} to ${ends[ends.length - 1]}. The dates are synthetic.`;
  });
