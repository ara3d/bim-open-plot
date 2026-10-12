// Writes public/thumbs/<slug>.png, a 640x400 picture of each demo's figure, for
// the index page. Screenshots rather than headless() SVG, because 3D and map demos
// describe themselves in text when headless. The pictures are committed, so the
// Pages build needs no GPU. Run `npm run demos:thumbs` (reuses a dev server on
// PLOT_URL, default http://127.0.0.1:5320, or starts one), then `npm run demos:index`.
// Pass slugs to redo only those: `npm run demos:thumbs -- flow-clash-matrix`.
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { viewerRoot } from '../viewer-alias.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demosDir = resolve(root, 'demos');
const thumbsDir = resolve(root, 'public/thumbs');
const baseUrl = process.env.PLOT_URL ?? 'http://127.0.0.1:5320';
const size = { width: 640, height: 400 };
const timeoutMs = 30_000;
const settleMs = 1_500;

// playwright-core comes from the viewer checkout, which already depends on it.
const { chromium } = createRequire(resolve(viewerRoot, 'package.json'))('playwright-core');

const allSlugs = () =>
  readdirSync(demosDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(resolve(demosDir, d.name, 'index.html')))
    .map((d) => d.name)
    .sort();

const isUp = async () => {
  try {
    return (await fetch(baseUrl)).ok;
  } catch {
    return false;
  }
};

/** Reuses a running dev server, or starts one and returns it so it can be stopped. */
const ensureServer = async () => {
  if (await isUp()) return undefined;
  const port = new URL(baseUrl).port;
  const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', port, '--strictPort'], { cwd: root, shell: true, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    if (await isUp()) return server;
    await new Promise((r) => setTimeout(r, 500));
  }
  server.kill();
  throw new Error(`dev server did not start on ${baseUrl}`);
};

const launch = async () => {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    } catch {
      // try the next installed browser
    }
  }
  throw new Error('neither Edge nor Chrome is installed for playwright-core');
};

/** Scales a whole-figure screenshot into the thumbnail box, letterboxed on white,
 * so a tall plan or a wide chart is shown entire rather than cropped. */
const fit = async (page, png, path) => {
  await page.setViewportSize(size);
  await page.setContent(
    `<body style="margin:0;background:#fff"><img src="data:image/png;base64,${png.toString('base64')}"
      style="display:block;width:${size.width}px;height:${size.height}px;object-fit:contain"></body>`,
  );
  await page.locator('img').evaluate((img) => img.decode());
  await page.screenshot({ path, clip: { x: 0, y: 0, ...size } });
};

/** One screenshot of `.plot-demo .figure`, or a reason it could not be taken. */
const shoot = async (browser, slug) => {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${baseUrl}/demos/${slug}/`, { timeout: timeoutMs });
    await page.waitForSelector('.plot-demo .figure svg, .plot-demo .figure canvas', { timeout: timeoutMs });
    await page.waitForTimeout(settleMs);
    // The headline view only: the figure's first large svg or canvas, so captions, the
    // flow-* graph listing, and a demo's secondary views do not shrink it.
    const clip = await page.locator('.plot-demo .figure').first().evaluate((figure) => {
      const r = [...figure.querySelectorAll('svg, canvas')]
        .map((el) => el.getBoundingClientRect())
        .find((b) => b.width > 200 && b.height > 120);
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
    });
    const shot = await page.screenshot({ clip, fullPage: true });
    await fit(page, shot, resolve(thumbsDir, `${slug}.png`));
    return undefined;
  } catch (e) {
    return String(e.message ?? e).split('\n')[0];
  } finally {
    await page.close();
  }
};

const slugs = process.argv.slice(2).length ? process.argv.slice(2) : allSlugs();
mkdirSync(thumbsDir, { recursive: true });
const server = await ensureServer();
const browser = await launch();
const failures = [];
for (const slug of slugs) {
  const reason = await shoot(browser, slug);
  console.log(reason ? `no thumbnail  ${slug}: ${reason}` : `thumbnail     ${slug}`);
  if (reason) failures.push(slug);
}
await browser.close();
server?.kill();
console.log(`${slugs.length - failures.length} of ${slugs.length} thumbnails written to public/thumbs/`);
