// Facade area by compass sector: the figure of the toolkit graph viz-facade-orientation, drawn from that graph's own
// output (data/figure.json) with its own Vega-Lite spec, and the graph listed under it.

import type { Row } from '../../src/chart';
import type { DemoManifest } from '../../src/manifest';
import { flowDemo, num, total } from '../flow-element-size-outliers/flow-demo';
import raw from './demo.json';

export const demo = flowDemo(raw as DemoManifest, 'viz-facade-orientation', (rows: readonly Row[]): string => {
    const top = [...rows].sort((a, b) => Number(b.Total) - Number(a.Total))[0]!;
    return `${num(total(rows, 'Wall'))} m² of wall and ${num(total(rows, 'Window'))} m² of window across ${rows.length} sectors; the largest is ${String(top.Direction)} with ${num(Number(top.Total))} m². Sectors are from project north; the model has no true north.`;
  });
