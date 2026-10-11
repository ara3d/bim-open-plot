// The frame every demo page shares: title, role and decision, data provenance
// (a synthetic dataset is labelled where the reader looks), and the figure
// container the demo draws into. Styles are injected once per document so a
// demo's index.html needs no stylesheet of its own.

import type { DemoManifest } from './manifest';
import { usesSyntheticData } from './manifest';
import { tokens } from './theme';

const STYLE_ID = 'bim-open-plot-demo-style';

const css = `
  :root { color-scheme: light; }
  body { margin: 0; background: ${tokens.background}; color: ${tokens.text}; font-family: ${tokens.font}; }
  .plot-demo { max-width: 1180px; margin: 0 auto; padding: 24px 16px 48px; }
  .plot-demo header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 16px; margin-bottom: 12px; }
  .plot-demo header h1 { font-size: 22px; font-weight: 700; margin: 0; }
  .plot-demo header .brand { font-weight: 600; color: ${tokens.dim}; font-size: 13px; }
  .plot-demo header .brand a { color: inherit; text-decoration: none; }
  .plot-demo .role { font-size: 14px; color: ${tokens.dim}; margin: 0 0 4px; }
  .plot-demo .decision { font-size: 16px; margin: 0 0 12px; }
  .plot-demo .badges { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; }
  .plot-demo .badge { font-size: 12px; padding: 3px 8px; border-radius: 999px; border: 1px solid ${tokens.border}; background: ${tokens.surface}; color: ${tokens.dim}; }
  .plot-demo .badge.synthetic { border-color: ${tokens.changed}; color: ${tokens.changed}; background: #fff7ed; font-weight: 600; }
  .plot-demo .badge.model { border-color: ${tokens.accent}; color: ${tokens.accent}; background: ${tokens.accentSoft}; }
  .plot-demo .figure { background: ${tokens.surface}; border: 1px solid ${tokens.border}; border-radius: 10px; padding: 16px; min-height: 320px; }
  .plot-demo .figure .vega-embed { width: 100%; }
  .plot-demo .figure canvas, .plot-demo .figure svg { max-width: 100%; }
  .plot-demo .caption { font-size: 13px; color: ${tokens.dim}; margin: 12px 0 0; }
  .plot-demo .caption a { color: ${tokens.accent}; }
  .plot-demo .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
  .plot-demo .status { font-size: 13px; color: ${tokens.dim}; padding: 8px 0; }
  .plot-demo .status.error { color: ${tokens.error}; }
`;

const ensureStyle = (doc: Document) => {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  doc.head.appendChild(style);
};

export interface DemoPage {
  /** The element the demo draws its figure into. */
  readonly figure: HTMLElement;
  /** Replaces the caption under the figure (plain text or HTML). */
  caption(html: string): void;
  /** Shows a one-line status (loading, error) under the header. */
  status(text: string, error?: boolean): void;
}

/** Builds the page frame inside `root` for `manifest` and returns the figure container. */
export const mountDemoPage = (root: HTMLElement, manifest: DemoManifest, indexHref = '../../'): DemoPage => {
  const doc = root.ownerDocument;
  ensureStyle(doc);
  doc.title = `${manifest.title} · BIM Open Plot`;
  root.classList.add('plot-demo');
  root.replaceChildren();

  const header = doc.createElement('header');
  const brand = doc.createElement('span');
  brand.className = 'brand';
  const link = doc.createElement('a');
  link.href = indexHref;
  link.textContent = 'BIM Open Plot · demos';
  brand.appendChild(link);
  const h1 = doc.createElement('h1');
  h1.textContent = manifest.title;
  header.append(brand, h1);

  const role = doc.createElement('p');
  role.className = 'role';
  role.textContent = `For: ${manifest.role}`;
  const decision = doc.createElement('p');
  decision.className = 'decision';
  decision.textContent = manifest.decision;

  const badges = doc.createElement('div');
  badges.className = 'badges';
  if (manifest.model !== 'none') badges.appendChild(badge(doc, `Model: ${modelName(manifest.model)}`, 'model'));
  if (usesSyntheticData(manifest)) badges.appendChild(badge(doc, 'Synthetic data: invented to be realistic, not measured', 'synthetic'));
  for (const d of manifest.data) badges.appendChild(badge(doc, `${d.provenance}: ${d.note}`, ''));
  for (const k of manifest.kinds) badges.appendChild(badge(doc, k, ''));

  const status = doc.createElement('div');
  status.className = 'status';
  const figure = doc.createElement('div');
  figure.className = 'figure';
  const caption = doc.createElement('p');
  caption.className = 'caption';

  root.append(header, role, decision, badges, status, figure, caption);

  return {
    figure,
    caption: (html) => {
      caption.innerHTML = html;
    },
    status: (text, error = false) => {
      status.textContent = text;
      status.classList.toggle('error', error);
    },
  };
};

const badge = (doc: Document, text: string, kind: string) => {
  const el = doc.createElement('span');
  el.className = `badge ${kind}`.trim();
  el.textContent = text;
  return el;
};

const modelName = (m: DemoManifest['model']) =>
  m === 'duplex' ? 'Duplex Apartment (buildingSMART, CC BY 4.0)' : m === 'schependomlaan' ? 'Schependomlaan (CC BY 4.0)' : m;
