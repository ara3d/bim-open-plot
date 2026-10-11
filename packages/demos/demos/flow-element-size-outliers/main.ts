// Element size outliers: the figure of the toolkit graph viz-element-size-outliers, drawn from that graph's own
// output (data/figure.json) with its own Vega-Lite spec, and the graph listed under it.

import type { Row } from '../../src/chart';
import type { DemoManifest } from '../../src/manifest';
import { flowDemo, num } from './flow-demo';
import raw from './demo.json';

export const demo = flowDemo(raw as DemoManifest, 'viz-element-size-outliers', (rows: readonly Row[]): string => {
    const out = rows.filter((r) => r.Outlier === true);
    const top = [...rows].sort((a, b) => Number(b.Fold) - Number(a.Fold))[0]!;
    return `${out.length} of ${rows.length} elements are ten or more times off their class median volume; the furthest is ${String(top.Name)} (${String(top.Class)}), ${num(Number(top.Fold), 0)} times its class median.`;
  });
