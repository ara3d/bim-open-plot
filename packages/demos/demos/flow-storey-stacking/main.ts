// Elements per storey by class: the figure of the toolkit graph viz-storey-stacking, drawn from that graph's own
// output (data/figure.json) with its own Vega-Lite spec, and the graph listed under it.

import type { Row } from '../../src/chart';
import type { DemoManifest } from '../../src/manifest';
import { flowDemo, num } from '../../src/flow-demo';
import raw from './demo.json';

export const demo = flowDemo(raw as DemoManifest, 'viz-storey-stacking', (rows: readonly Row[]): string => {
    const keys = Object.keys(rows[0] ?? {}).filter((k) => k !== 'Storey' && k !== 'Elevation');
    const per = rows.map((r) => ({ storey: String(r.Storey), n: keys.reduce((s, k) => s + Number(r[k] ?? 0), 0) }));
    return `${num(per.reduce((s, p) => s + p.n, 0))} elements over ${rows.length} storeys: ${per.map((p) => `${p.storey} ${p.n}`).join(', ')}.`;
  });
