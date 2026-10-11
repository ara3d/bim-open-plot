// Handover parameter fill rate: the figure of the toolkit graph viz-parameter-completeness, drawn from that graph's own
// output (data/figure.json) with its own Vega-Lite spec, and the graph listed under it.

import type { Row } from '../../src/chart';
import type { DemoManifest } from '../../src/manifest';
import { flowDemo, num, pct, total } from '../flow-element-size-outliers/flow-demo';
import raw from './demo.json';

export const demo = flowDemo(raw as DemoManifest, 'viz-parameter-completeness', (rows: readonly Row[]): string => {
    const classes = new Set(rows.map((r) => r.Class)).size;
    const params = new Set(rows.map((r) => r.Parameter)).size;
    const filled = total(rows, 'FilledElements');
    const cells = total(rows, 'Elements');
    return `${num(filled)} of ${num(cells)} element-field cells are filled (${pct(filled / cells)}), across ${classes} classes and ${params} fields. A blank cell means the class never carries the field, not 0%.`;
  });
