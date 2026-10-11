// Embodied carbon by material: the figure of the toolkit graph viz-carbon-by-material, drawn from that graph's own
// output (data/figure.json) with its own Vega-Lite spec, and the graph listed under it.

import type { Row } from '../../src/chart';
import type { DemoManifest } from '../../src/manifest';
import { flowDemo, num, pct, total } from '../../src/flow-demo';
import raw from './demo.json';

export const demo = flowDemo(raw as DemoManifest, 'viz-carbon-by-material', (rows: readonly Row[]): string => {
    const a = rows.filter((r) => r.ParetoClass === 'A');
    const top = [...rows].sort((x, y) => Number(y.MaterialTotal_kgCO2e) - Number(x.MaterialTotal_kgCO2e))[0]!;
    return `${num(total(rows, 'MaterialTotal_kgCO2e'), 1)} kgCO2e over ${rows.length} materials and classes; ${a.length} of them reach 80%. The largest is ${String(top.MaterialOrClass)} at ${pct(Number(top.Share))}. Carbon values are synthetic.`;
  });
