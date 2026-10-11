// One Vite site for every demo: the index at /, each demo at /demos/<slug>/.
// Each demo folder is its own page, so a demo builds and runs on its own
// and the index only links them.
import { defineConfig } from 'vite';
import { readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { viewerAlias, viewerRoot } from './viewer-alias.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const demosDir = resolve(root, 'demos');

const pages = () => {
  const input = { index: resolve(root, 'index.html') };
  for (const slug of readdirSync(demosDir, { withFileTypes: true })) {
    const page = resolve(demosDir, slug.name, 'index.html');
    if (slug.isDirectory() && existsSync(page)) input[slug.name] = page;
  }
  return input;
};

export default defineConfig({
  root,
  base: process.env.PLOT_BASE ?? '/',
  resolve: { alias: viewerAlias() },
  build: { outDir: resolve(root, 'dist'), emptyOutDir: true, rollupOptions: { input: pages() } },
  server: { fs: { allow: [resolve(root, '../..'), viewerRoot] } },
});
