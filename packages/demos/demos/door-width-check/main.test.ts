// The Duplex has 14 doors, all with an Ifc:OverallWidth: six are below
// 850 mm (four 762 mm, two 813 mm) and eight pass (six 864 mm, two 1250 mm).

import { describe, expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demo, loadDoorWidths } from './main';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '../../public');
const sources = {
  elements: `${site}/data/duplex/elements.json`,
  parameters: `${site}/data/duplex/parameters.json`,
  bounds: `${site}/data/duplex/bounds.json`,
};

describe('demo door-width-check: the check itself', () => {
  it('checks all 14 Duplex doors: 6 fail, 8 pass, none without a width', async () => {
    const { doors } = await loadDoorWidths(sources);
    expect(doors).toHaveLength(14);
    expect(doors.filter((d) => d.status === 'fail').map((d) => d.widthMm).sort()).toEqual([762, 762, 762, 762, 813, 813]);
    expect(doors.filter((d) => d.status === 'pass')).toHaveLength(8);
    expect(doors.filter((d) => d.status === 'no width')).toHaveLength(0);
  });

  it('draws one plan per living storey, with every door placed', async () => {
    const views = await demo.headless({ dataRoot: here, siteRoot: site });
    const plans = views.filter((v) => v.kind === 'drawing');
    expect(plans.map((p) => p.rows)).toEqual([6, 8]);
    expect(plans[0]!.svg).toContain('Level 1');
  });
});
