// The contract a demo's main.ts exports: its manifest, how it draws into a
// page, and what it produces with no browser, so one test can check every
// demo the same way.

import type { DemoManifest } from './manifest';

/** One view a demo produced headlessly: its kind, how many rows it drew, and its SVG when it has one. */
export interface HeadlessView {
  readonly kind: 'chart' | 'drawing' | 'scene3d' | 'map' | 'table';
  readonly title: string;
  readonly rows: number;
  /** Present for charts and drawings (anything that is SVG); absent for a 3D scene or a tiled map. */
  readonly svg?: string;
  /** For a 3D scene or map: what would be drawn, so a test can check it without WebGL. */
  readonly description?: Readonly<Record<string, unknown>>;
}

export interface Demo {
  readonly manifest: DemoManifest;
  /**
   * Draws the whole demo into `root` (the page's #app element) in a browser:
   * builds the frame with mountDemoPage, loads data, renders every view.
   */
  render(root: HTMLElement): Promise<void>;
  /**
   * Produces every view with no browser: loads data from `dataRoot` (the
   * demo folder's absolute path; site-absolute data paths such as
   * /data/duplex/x.json resolve against `siteRoot`, the public folder) and
   * returns one HeadlessView per view, with SVG for 2D views.
   */
  headless(paths: { dataRoot: string; siteRoot: string }): Promise<readonly HeadlessView[]>;
}

/** Resolves a manifest data file path for headless use. */
export const resolveDataPath = (file: string, paths: { dataRoot: string; siteRoot: string }): string =>
  file.startsWith('/') ? `${paths.siteRoot}${file}` : `${paths.dataRoot}/${file}`;

/** Resolves a manifest data file path to a URL in the browser, relative to the demo page. */
export const dataUrl = (file: string, base = import.meta.env?.BASE_URL ?? '/'): string =>
  file.startsWith('/') ? `${base.replace(/\/$/, '')}${file}` : `./${file}`;
