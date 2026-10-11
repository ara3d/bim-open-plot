// One Vite site for every demo: the index at /, each demo at /demos/<slug>/.
// Each demo folder is its own page, so a demo builds and runs on its own
// and the index only links them.
import { defineConfig } from 'vite';
import { readdirSync, existsSync, cpSync } from 'node:fs';
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

// A demo's own data/ folder is fetched at run time by a relative URL, which the
// bundler cannot see, so the folder is copied into the built site as it is.
const copyDemoData = () => ({
  name: 'copy-demo-data',
  closeBundle() {
    for (const slug of readdirSync(demosDir, { withFileTypes: true })) {
      const data = resolve(demosDir, slug.name, 'data');
      if (slug.isDirectory() && existsSync(data)) cpSync(data, resolve(root, 'dist/demos', slug.name, 'data'), { recursive: true });
    }
  },
});

export default defineConfig({
  root,
  plugins: [copyDemoData()],
  base: process.env.PLOT_BASE ?? '/',
  resolve: { alias: viewerAlias() },
  build: { outDir: resolve(root, 'dist'), emptyOutDir: true, rollupOptions: { input: pages() } },
  server: { fs: { allow: [resolve(root, '../..'), viewerRoot] } },
});
