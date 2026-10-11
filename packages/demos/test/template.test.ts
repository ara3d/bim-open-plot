// The template demo is the proof that the shared helpers work headlessly:
// Duplex extracts load from disk and Vega-Lite renders to SVG with no browser.

import { expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demo } from '../demos/_template/main';

const here = dirname(fileURLToPath(import.meta.url));

it('the template demo renders its chart to SVG from the Duplex extracts', async () => {
  const views = await demo.headless({ dataRoot: resolve(here, '../demos/_template'), siteRoot: resolve(here, '../public') });
  expect(views).toHaveLength(1);
  expect(views[0]!.rows).toBeGreaterThan(10);
  expect(views[0]!.svg).toMatch(/^<svg/);
  expect(views[0]!.svg).toContain('Level 1');
});
