// Writes docs/collage.png for the README: a 4x4 grid of demo thumbnails from
// public/thumbs/, chosen and ordered so neighbours contrast (3D beside chart, plan
// beside map, warm beside cool). Run `npm run demos:collage` after `demos:thumbs`.
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { viewerRoot } from '../viewer-alias.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const thumbs = resolve(root, 'public/thumbs');
const out = resolve(root, '../../docs/collage.png');
const { chromium } = createRequire(resolve(viewerRoot, 'package.json'))('playwright-core');

// Row by row; no two neighbours, across or down, share a kind or a dominant colour.
const slugs = [
  'storeys-in-3d', 'flow-carbon-by-material', 'room-area-plan', 'flow-parameter-completeness',
  'flow-facade-orientation', 'site-map', 'flow-clash-matrix', 'discipline-mix',
  'flow-construction-sequence', 'flow-element-size-outliers', 'installed-vs-planned', 'room-adjacency-network',
  'flow-model-composition', 'cost-by-storey-class', 'flow-carbon-intensity-by-storey', 'flow-door-accessibility',
];
// 3D views leave the model small in a wide grey frame; zoom into the middle.
const zoom = { 'storeys-in-3d': 1.7, 'discipline-mix': 1.6 };
const cell = { width: 400, height: 250 };
const gap = 8;
const columns = 4;
const width = columns * cell.width + (columns + 1) * gap;
const height = (slugs.length / columns) * cell.height + (slugs.length / columns + 1) * gap;

const img = (slug) =>
  `<div class="c"><img style="transform:scale(${zoom[slug] ?? 1})" src="data:image/png;base64,${readFileSync(resolve(thumbs, `${slug}.png`)).toString('base64')}" alt="${slug}"></div>`;
const html = `<body style="margin:0;background:#e9e6df">
  <div style="display:grid;grid-template-columns:repeat(${columns},${cell.width}px);gap:${gap}px;padding:${gap}px">
    ${slugs.map(img).join('')}
  </div>
  <style>.c{width:${cell.width}px;height:${cell.height}px;overflow:hidden;background:#fff;border-radius:6px}img{width:100%;height:100%;object-fit:contain;display:block}</style>
</body>`;

const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch({ channel: 'chrome' }));
const page = await browser.newPage({ viewport: { width, height } });
await page.setContent(html);
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height } });
await browser.close();
console.log(`wrote ${out} (${width}x${height}, ${slugs.length} demos)`);
