// Room areas: the figure of the toolkit graph viz-room-areas, drawn from that graph's own
// output (data/figure.json) with its own Vega-Lite spec, and the graph listed under it.

import type { Row } from '../../src/chart';
import type { DemoManifest } from '../../src/manifest';
import { flowDemo, num, total } from '../../src/flow-demo';
import raw from './demo.json';

export const demo = flowDemo(raw as DemoManifest, 'viz-room-areas', (rows: readonly Row[]): string => {
    const largest = [...rows].sort((a, b) => Number(b.Area) - Number(a.Area))[0]!;
    return `${rows.length} rooms, ${num(total(rows, 'Area'), 1)} m² in all; the largest is ${String(largest.Name)} at ${num(Number(largest.Area), 1)} m² (the Roof space is the attic volume, not an occupied room).`;
  });
