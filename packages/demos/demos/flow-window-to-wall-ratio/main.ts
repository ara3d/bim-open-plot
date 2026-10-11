// Window-to-wall ratio by facing: the figure of the toolkit graph viz-window-to-wall-ratio, drawn from that graph's own
// output (data/figure.json) with its own Vega-Lite spec, and the graph listed under it.

import type { Row } from '../../src/chart';
import type { DemoManifest } from '../../src/manifest';
import { flowDemo } from '../../src/flow-demo';
import raw from './demo.json';

export const demo = flowDemo(raw as DemoManifest, 'viz-window-to-wall-ratio', (rows: readonly Row[]): string => {
    const parts = rows.map((r) => `${String(r.Facing)} ${r.WWR === null ? 'no wall' : Number(r.WWR).toFixed(2)}`);
    const over = rows.filter((r) => r.WWR !== null && Number(r.WWR) > Number(r.Limit)).length;
    return `Window-to-wall ratio: ${parts.join(', ')}; ${over} facing${over === 1 ? '' : 's'} over the 0.40 limit.`;
  });
