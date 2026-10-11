// Progress S-curve (from the graph): the figure of the toolkit graph viz-progress-s-curve, drawn from that graph's own
// output (data/figure.json) with its own Vega-Lite spec, and the graph listed under it.

import type { Row } from '../../src/chart';
import type { DemoManifest } from '../../src/manifest';
import { flowDemo } from '../flow-element-size-outliers/flow-demo';
import raw from './demo.json';

export const demo = flowDemo(raw as DemoManifest, 'viz-progress-s-curve', (rows: readonly Row[]): string => {
    const gap = Math.max(...rows.map((r) => Number(r.Planned) - Number(r.Actual)));
    const last = rows[rows.length - 1]!;
    return `${rows.length} weeks; both curves end at ${String(last.Planned)} elements. The largest shortfall is ${gap} elements. Both series are synthetic.`;
  });
