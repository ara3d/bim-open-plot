// The BIM Open Plot theme, from brand/BRANDING.md, as tokens and as a
// Vega-Lite config. One object so a chart and the coloured model beside it agree.

export const tokens = {
  accent: '#a16207',
  accentSoft: '#f6efdb',
  text: '#171a1f',
  dim: '#5a606c',
  surface: '#ffffff',
  background: '#f4f5f7',
  border: '#e3e6ea',
  ok: '#16a34a',
  changed: '#d97706',
  error: '#dc2626',
  font: "'Instrument Sans', 'Segoe UI', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, Consolas, monospace",
} as const;

/** The multi-series palette: ochre first, then the family's cool hues. */
export const series: readonly string[] = [
  '#a16207', '#2f66ce', '#0f8a80', '#5a47c7', '#b8326e', '#4f5d78', '#d97706', '#3b3f47',
];

/** A sequential scheme for heat maps and quantities: pale ochre to deep brown. */
export const heat: readonly string[] = ['#f6efdb', '#e9cf8a', '#d4a53f', '#a16207', '#6b3f05'];

/** A diverging scheme centred on neutral: teal (below) to rose (above). */
export const diverging: readonly string[] = ['#0f8a80', '#a7d8d3', '#f4f5f7', '#e8b3c9', '#b8326e'];

/** Vega-Lite `config` for every 2D chart on the demo page. */
export const vegaConfig = {
  font: tokens.font,
  background: tokens.surface,
  padding: 12,
  title: { color: tokens.text, fontSize: 15, fontWeight: 600, anchor: 'start' as const, subtitleColor: tokens.dim },
  axis: {
    labelColor: tokens.dim,
    titleColor: tokens.text,
    gridColor: tokens.border,
    domainColor: tokens.border,
    tickColor: tokens.border,
    labelFontSize: 11,
    titleFontSize: 12,
    titleFontWeight: 600,
  },
  legend: { labelColor: tokens.dim, titleColor: tokens.text, labelFontSize: 11, titleFontSize: 12 },
  view: { stroke: null },
  range: { category: [...series], heatmap: [...heat], diverging: [...diverging], ramp: [...heat] },
  mark: { color: tokens.accent },
  bar: { color: tokens.accent },
  line: { color: tokens.accent, strokeWidth: 2 },
  point: { color: tokens.accent, filled: true },
  area: { color: tokens.accent, opacity: 0.6 },
  rect: { color: tokens.accent },
  text: { color: tokens.text, font: tokens.font },
  header: { labelColor: tokens.text, titleColor: tokens.text },
} as const;

/** The colour for a value between lo and hi on the heat scheme, as a hex string. */
export const heatColor = (value: number, lo: number, hi: number): string => {
  if (!Number.isFinite(value) || hi <= lo) return heat[0]!;
  const t = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
  const pos = t * (heat.length - 1);
  const i = Math.min(heat.length - 2, Math.floor(pos));
  return mixHex(heat[i]!, heat[i + 1]!, pos - i);
};

const mixHex = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const x = (pa >> shift) & 255;
    const y = (pb >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
};
