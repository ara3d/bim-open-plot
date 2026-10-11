// Door widths against 850 mm: the figure of the toolkit graph viz-door-accessibility, drawn from that graph's own
// output (data/figure.json) with its own Vega-Lite spec, and the graph listed under it.

import type { Row } from '../../src/chart';
import type { DemoManifest } from '../../src/manifest';
import { flowDemo, num, total } from '../flow-element-size-outliers/flow-demo';
import raw from './demo.json';

export const demo = flowDemo(raw as DemoManifest, 'viz-door-accessibility', (rows: readonly Row[]): string => {
    const count = (score: number | null) => total(rows.filter((r) => r.PassScore === score), 'Doors');
    return `${num(total(rows, 'Doors'))} doors: ${count(0)} narrower than 850 mm, ${count(1)} at or above it, ${count(null)} with no width. Width is the IFC OverallWidth, so a pass is provisional until clear width is measured.`;
  });
