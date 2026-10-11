// What the model is made of: the figure of the toolkit graph viz-model-composition, drawn from that graph's own
// output (data/figure.json) with its own Vega-Lite spec, and the graph listed under it.

import type { Row } from '../../src/chart';
import type { DemoManifest } from '../../src/manifest';
import { flowDemo, num, pct, total } from '../../src/flow-demo';
import raw from './demo.json';

export const demo = flowDemo(raw as DemoManifest, 'viz-model-composition', (rows: readonly Row[]): string => {
    const top = rows[0]!;
    return `${num(total(rows, 'Elements'))} physical elements in ${rows.length} groups; the largest is ${String(top.Group)} with ${String(top.Elements)} (${pct(Number(top.Share))}).`;
  });
