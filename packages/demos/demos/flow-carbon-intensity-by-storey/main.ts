// Carbon intensity by storey: the figure of the toolkit graph viz-carbon-intensity-by-storey, drawn from that graph's own
// output (data/figure.json) with its own Vega-Lite spec, and the graph listed under it.

import type { Row } from '../../src/chart';
import type { DemoManifest } from '../../src/manifest';
import { flowDemo, num } from '../../src/flow-demo';
import raw from './demo.json';

export const demo = flowDemo(raw as DemoManifest, 'viz-carbon-intensity-by-storey', (rows: readonly Row[]): string => {
    const parts = rows.map((r) =>
      r.Intensity_kgCO2e_per_m2 === null ? `${String(r.Storey)} has no floor area, so no intensity` : `${String(r.Storey)} ${num(Number(r.Intensity_kgCO2e_per_m2), 1)}`,
    );
    return `kgCO2e per m² of net space area: ${parts.join('; ')}. Carbon values are synthetic; floor areas are from the model.`;
  });
