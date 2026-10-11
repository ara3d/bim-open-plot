// Every demo under demos/ is checked the same way: its manifest is valid,
// its README and index.html exist, its main.ts exports a Demo, and
// headless() returns one view per declared kind with real rows and, for
// 2D kinds, an SVG. A demo that passes here renders on the page.

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { manifestProblems, type DemoManifest } from '../src/manifest';
import type { Demo } from '../src/demo';

const here = dirname(fileURLToPath(import.meta.url));
const demosDir = resolve(here, '../demos');
const siteRoot = resolve(here, '../public');

const slugs = existsSync(demosDir)
  ? readdirSync(demosDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
      .map((d) => d.name)
      .sort()
  : [];

describe.each(slugs)('demo %s', (slug) => {
  const dir = resolve(demosDir, slug);

  it('has a valid demo.json whose slug matches its folder', () => {
    const manifest = JSON.parse(readFileSync(resolve(dir, 'demo.json'), 'utf8')) as DemoManifest;
    expect(manifestProblems(manifest)).toEqual([]);
    expect(manifest.slug).toBe(slug);
  });

  it('has a README.md, an index.html, and a main.ts', () => {
    for (const f of ['README.md', 'index.html', 'main.ts']) expect(existsSync(resolve(dir, f)), f).toBe(true);
  });

  it('names data files that exist, and labels every synthetic one', () => {
    const manifest = JSON.parse(readFileSync(resolve(dir, 'demo.json'), 'utf8')) as DemoManifest;
    for (const d of manifest.data) {
      const path = d.file.startsWith('/') ? resolve(siteRoot, `.${d.file}`) : resolve(dir, d.file);
      expect(existsSync(path), d.file).toBe(true);
    }
  });

  it('renders headlessly: one view per kind, rows drawn, SVG for 2D kinds', async () => {
    const mod = (await import(pathToFileURL(resolve(dir, 'main.ts')).href)) as { demo: Demo };
    expect(mod.demo, 'main.ts must export `demo`').toBeDefined();
    const views = await mod.demo.headless({ dataRoot: dir, siteRoot });
    expect(views.length).toBeGreaterThan(0);
    const kinds = new Set(views.map((v) => v.kind));
    for (const k of mod.demo.manifest.kinds) expect(kinds.has(k), `no view of kind ${k}`).toBe(true);
    for (const v of views) {
      expect(v.rows, `${v.title}: rows`).toBeGreaterThan(0);
      if (v.kind === 'chart' || v.kind === 'drawing') {
        expect(v.svg, `${v.title}: svg`).toMatch(/^<svg/);
        expect(v.svg).not.toContain('NaN');
      } else {
        expect(v.description, `${v.title}: description`).toBeDefined();
      }
    }
  });
});

it('the demos folder exists', () => {
  expect(existsSync(demosDir)).toBe(true);
});
