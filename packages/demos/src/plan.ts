// A plan drawing as SVG from rectangles: each shape is a box in model x/y
// with a fill, a label, and a tooltip. Pure string output, so it renders in
// the page and in the headless test alike. Y is flipped so north is up.

import { tokens, heat, heatColor } from './theme';

export interface PlanRect {
  readonly id: string;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly fill: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly opacity?: number;
  readonly label?: string;
  /** Hover text (an SVG <title>). */
  readonly title?: string;
}

export interface PlanLine {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly stroke: string;
  readonly width?: number;
  readonly dash?: string;
}

export interface PlanPoint {
  readonly x: number;
  readonly y: number;
  readonly r?: number;
  readonly fill: string;
  readonly label?: string;
  readonly title?: string;
}

export type PlanLegend =
  | { readonly kind: 'ramp'; readonly lo: number; readonly hi: number; readonly label: string; readonly colors?: readonly string[]; readonly format?: (v: number) => string }
  | { readonly kind: 'swatches'; readonly items: readonly { label: string; color: string }[] };

export interface PlanOptions {
  readonly width?: number;
  readonly title?: string;
  readonly subtitle?: string;
  readonly legend?: PlanLegend;
  readonly lines?: readonly PlanLine[];
  readonly points?: readonly PlanPoint[];
  /** Metres of margin around the content. */
  readonly margin?: number;
  /** Draw a 1 m scale bar. */
  readonly scaleBar?: boolean;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/** The SVG for a plan of `rects` (model units), scaled to `width` pixels. */
export const planSvg = (rects: readonly PlanRect[], opts: PlanOptions = {}): string => {
  const width = opts.width ?? 720;
  const margin = opts.margin ?? 0.5;
  const all = [
    ...rects.map((r) => [r.x0, r.y0, r.x1, r.y1]),
    ...(opts.lines ?? []).map((l) => [l.x0, l.y0, l.x1, l.y1]),
    ...(opts.points ?? []).map((p) => [p.x, p.y, p.x, p.y]),
  ];
  if (all.length === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="80"><text x="12" y="40" fill="${tokens.dim}">Nothing to draw</text></svg>`;
  const minX = Math.min(...all.map((b) => Math.min(b[0]!, b[2]!))) - margin;
  const maxX = Math.max(...all.map((b) => Math.max(b[0]!, b[2]!))) + margin;
  const minY = Math.min(...all.map((b) => Math.min(b[1]!, b[3]!))) - margin;
  const maxY = Math.max(...all.map((b) => Math.max(b[1]!, b[3]!))) + margin;
  const headerH = opts.title ? (opts.subtitle ? 44 : 28) : 0;
  const legendH = opts.legend ? 36 : 0;
  const scale = width / (maxX - minX);
  const planH = (maxY - minY) * scale;
  const height = headerH + planH + legendH + (opts.scaleBar ? 24 : 0);
  const X = (x: number) => (x - minX) * scale;
  const Y = (y: number) => headerH + (maxY - y) * scale;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round(height)}" viewBox="0 0 ${width} ${Math.round(height)}" font-family="${esc(tokens.font)}" style="background:${tokens.surface}">`);
  if (opts.title) parts.push(`<text x="0" y="18" font-size="15" font-weight="600" fill="${tokens.text}">${esc(opts.title)}</text>`);
  if (opts.subtitle) parts.push(`<text x="0" y="36" font-size="12" fill="${tokens.dim}">${esc(opts.subtitle)}</text>`);
  for (const r of rects) {
    const x = X(Math.min(r.x0, r.x1));
    const y = Y(Math.max(r.y0, r.y1));
    const w = Math.abs(r.x1 - r.x0) * scale;
    const h = Math.abs(r.y1 - r.y0) * scale;
    parts.push(
      `<g data-id="${esc(r.id)}"><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${r.fill}" stroke="${r.stroke ?? tokens.border}" stroke-width="${r.strokeWidth ?? 1}" opacity="${r.opacity ?? 1}">${r.title ? `<title>${esc(r.title)}</title>` : ''}</rect>` +
        (r.label && w > 24 && h > 14
          ? `<text x="${(x + w / 2).toFixed(1)}" y="${(y + h / 2 + 4).toFixed(1)}" font-size="11" text-anchor="middle" fill="${tokens.text}" pointer-events="none">${esc(r.label)}</text>`
          : '') +
        `</g>`,
    );
  }
  for (const l of opts.lines ?? [])
    parts.push(`<line x1="${X(l.x0).toFixed(1)}" y1="${Y(l.y0).toFixed(1)}" x2="${X(l.x1).toFixed(1)}" y2="${Y(l.y1).toFixed(1)}" stroke="${l.stroke}" stroke-width="${l.width ?? 2}"${l.dash ? ` stroke-dasharray="${l.dash}"` : ''} stroke-linecap="round"/>`);
  for (const p of opts.points ?? [])
    parts.push(
      `<g><circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${p.r ?? 5}" fill="${p.fill}" stroke="${tokens.surface}" stroke-width="1.5">${p.title ? `<title>${esc(p.title)}</title>` : ''}</circle>` +
        (p.label ? `<text x="${(X(p.x) + 8).toFixed(1)}" y="${(Y(p.y) + 4).toFixed(1)}" font-size="11" fill="${tokens.text}">${esc(p.label)}</text>` : '') +
        `</g>`,
    );
  let y = headerH + planH + 6;
  if (opts.scaleBar) {
    parts.push(`<line x1="8" y1="${y + 8}" x2="${8 + scale}" y2="${y + 8}" stroke="${tokens.text}" stroke-width="2"/><text x="${12 + scale}" y="${y + 12}" font-size="11" fill="${tokens.dim}">1 m</text>`);
    y += 24;
  }
  if (opts.legend?.kind === 'ramp') {
    const colors = opts.legend.colors ?? heat;
    const stops = colors.map((c, i) => `<stop offset="${(i / (colors.length - 1)) * 100}%" stop-color="${c}"/>`).join('');
    const f = opts.legend.format ?? fmt;
    parts.push(
      `<defs><linearGradient id="plan-ramp">${stops}</linearGradient></defs>` +
        `<rect x="8" y="${y + 8}" width="160" height="12" fill="url(#plan-ramp)"/>` +
        `<text x="8" y="${y + 32}" font-size="11" fill="${tokens.dim}">${esc(f(opts.legend.lo))}</text>` +
        `<text x="168" y="${y + 32}" font-size="11" text-anchor="end" fill="${tokens.dim}">${esc(f(opts.legend.hi))}</text>` +
        `<text x="180" y="${y + 18}" font-size="12" fill="${tokens.text}">${esc(opts.legend.label)}</text>`,
    );
  } else if (opts.legend?.kind === 'swatches') {
    let x = 8;
    for (const item of opts.legend.items) {
      parts.push(`<rect x="${x}" y="${y + 8}" width="12" height="12" fill="${item.color}"/><text x="${x + 16}" y="${y + 18}" font-size="12" fill="${tokens.text}">${esc(item.label)}</text>`);
      x += 24 + item.label.length * 7;
    }
  }
  parts.push('</svg>');
  return parts.join('');
};

/** A rect from a box with a value on the heat ramp between lo and hi; a null value is hatched grey (honest absence). */
export const heatRect = (
  id: string,
  box: { min: { x: number; y: number }; max: { x: number; y: number } },
  value: number | null,
  lo: number,
  hi: number,
  label?: string,
  title?: string,
): PlanRect => ({
  id,
  x0: box.min.x,
  y0: box.min.y,
  x1: box.max.x,
  y1: box.max.y,
  fill: value === null ? tokens.background : heatColor(value, lo, hi),
  stroke: value === null ? tokens.dim : tokens.surface,
  strokeWidth: value === null ? 1 : 1.5,
  ...(label === undefined ? {} : { label }),
  ...(title === undefined ? {} : { title }),
});

/** Puts an SVG string into a page element. */
export const mountSvg = (el: HTMLElement, svg: string): void => {
  el.innerHTML = svg;
  const node = el.querySelector('svg');
  if (node) {
    node.style.width = '100%';
    node.style.height = 'auto';
  }
};
