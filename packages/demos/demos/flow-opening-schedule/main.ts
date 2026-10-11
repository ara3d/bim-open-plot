// Door and window schedule: the figure of the toolkit graph viz-opening-schedule, drawn from that graph's own
// output (data/figure.json) with its own Vega-Lite spec, and the graph listed under it.

import type { Row } from '../../src/chart';
import type { DemoManifest } from '../../src/manifest';
import { flowDemo, num, total } from '../flow-element-size-outliers/flow-demo';
import raw from './demo.json';

export const demo = flowDemo(raw as DemoManifest, 'viz-opening-schedule', (rows: readonly Row[]): string => {
    const kind = (k: string) => total(rows.filter((r) => r.Kind === k), 'Count');
    return `${num(total(rows, 'Count'))} openings on ${rows.length} schedule lines: ${kind('Door')} doors and ${kind('Window')} windows, ${num(total(rows, 'Area_m2'), 1)} m² in all.`;
  });
