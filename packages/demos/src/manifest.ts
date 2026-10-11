// What every demo declares about itself, in its demo.json. The index page,
// the headless test, and the README generator read only this.

/** The kinds of view a demo draws; a demo may combine several. */
export type ViewKind = 'chart' | 'drawing' | 'scene3d' | 'map' | 'table';

/** Where a data file's numbers come from. Synthetic data is shown as such on the page. */
export type Provenance = 'model' | 'synthetic' | 'derived';

export interface DataSource {
  /** Path relative to the demo folder, or an absolute site path such as /data/duplex/elements.json. */
  readonly file: string;
  readonly provenance: Provenance;
  /** One sentence: which model, or how the synthetic numbers were invented, or what derived it. */
  readonly note: string;
}

export interface DemoManifest {
  /** Folder name under demos/: lower-case words joined by hyphens. */
  readonly slug: string;
  readonly title: string;
  /** The person the figure is for: "Facility manager", "Estimator", "Site superintendent". */
  readonly role: string;
  /** The decision the figure supports, as a question that person asks. */
  readonly decision: string;
  readonly kinds: readonly ViewKind[];
  /** The public model drawn or queried, or 'none' for a figure over synthetic tables only. */
  readonly model: 'duplex' | 'schependomlaan' | 'none';
  readonly data: readonly DataSource[];
  /** Free tags for the index page filter: 'heatmap', 'floor-plan', 'egress', 'schedule', 'cost', ... */
  readonly tags: readonly string[];
}

const KINDS: ReadonlySet<string> = new Set(['chart', 'drawing', 'scene3d', 'map', 'table']);
const PROVENANCE: ReadonlySet<string> = new Set(['model', 'synthetic', 'derived']);
const MODELS: ReadonlySet<string> = new Set(['duplex', 'schependomlaan', 'none']);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Every problem with a manifest, in reading order; empty when it is valid. */
export const manifestProblems = (m: unknown): string[] => {
  if (typeof m !== 'object' || m === null) return ['manifest is not an object'];
  const r = m as Record<string, unknown>;
  const problems: string[] = [];
  const text = (key: string) => {
    if (typeof r[key] !== 'string' || (r[key] as string).trim() === '') problems.push(`${key}: missing text`);
  };
  text('slug');
  text('title');
  text('role');
  text('decision');
  if (typeof r.slug === 'string' && !SLUG.test(r.slug)) problems.push(`slug: "${r.slug}" is not lower-case-hyphenated`);
  if (!Array.isArray(r.kinds) || r.kinds.length === 0) problems.push('kinds: empty');
  else for (const k of r.kinds) if (!KINDS.has(String(k))) problems.push(`kinds: unknown "${String(k)}"`);
  if (!MODELS.has(String(r.model))) problems.push(`model: unknown "${String(r.model)}"`);
  if (!Array.isArray(r.data)) problems.push('data: missing list');
  else
    r.data.forEach((d: unknown, i: number) => {
      const s = d as Record<string, unknown>;
      if (typeof s?.file !== 'string') problems.push(`data[${i}].file: missing`);
      if (!PROVENANCE.has(String(s?.provenance))) problems.push(`data[${i}].provenance: unknown "${String(s?.provenance)}"`);
      if (typeof s?.note !== 'string' || s.note.trim() === '') problems.push(`data[${i}].note: missing`);
    });
  if (!Array.isArray(r.tags)) problems.push('tags: missing list');
  return problems;
};

/** True when any data source is synthetic, so the page must say so. */
export const usesSyntheticData = (m: DemoManifest): boolean => m.data.some((d) => d.provenance === 'synthetic');
