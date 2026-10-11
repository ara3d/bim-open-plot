// Discipline mix: every drawn element of the federated Duplex (architecture,
// MEP, electrical, and mechanical models in one .bos) classified by the
// source document it came from and by the storey it sits on, shown in 3D
// coloured by discipline and as stacked bars per storey. The table is
// derived from the model on every load; nothing is stored.

import type { TopLevelSpec } from 'vega-lite';
import type { LoadedModel } from '@bim-open-viewer/formats';
import {
  boolColumn,
  f32Column,
  instanceTransform,
  meshBoundsAt,
  noMesh,
  objectKey,
  stringColumn,
  tableFromRecord,
  transformBounds,
  type Geometry,
  type ObjectKey,
} from '@bim-open-viewer/model';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { describeScene, loadModelHeadless, mountScene, rgbOfHex, type SceneHandle } from '../../src/scene';
import { series, tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import raw from './demo.json';

const manifest = raw as DemoManifest;
const MODEL = '/models/duplex-federated.bos';

export const NO_STOREY = 'no storey';

/** The four disciplines of the Duplex federation, in legend order; the theme `series` colours them in this order. */
export const DISCIPLINES = ['Architecture', 'MEP', 'Electrical', 'Mechanical'] as const;

/** How each object's discipline was decided: its source document, or its IFC class when the file names no documents. */
export type DisciplineMethod = 'document' | 'class';

/** One drawn element: its viewer key, IFC class, discipline, and storey name (or NO_STOREY). */
export interface ClassifiedObject {
  readonly key: ObjectKey;
  readonly category: string;
  readonly discipline: string;
  readonly storey: string;
}

export interface DisciplineMix {
  readonly method: DisciplineMethod;
  /** Drawn elements, IfcSpace excluded. */
  readonly objects: readonly ClassifiedObject[];
  /** Keys of the IfcSpace volumes: hidden in 3D and not counted. */
  readonly spaceKeys: readonly ObjectKey[];
  /** Storey names, highest first, NO_STOREY last when any object has none. */
  readonly storeys: readonly string[];
  /** Disciplines found, in legend order. */
  readonly disciplines: readonly string[];
  /** One row per storey and discipline with at least one object: { storey, discipline, objects }. */
  readonly rows: readonly Row[];
}

// The Duplex documents are named Duplex_A_..., Duplex_MEP_..., Duplex_Electrical_..., and
// Duplex_M_..._ROOMS_AND_SPACES; the letter after "Duplex_" is the discipline code.
const disciplineOfDocument = (title: string | undefined): string => {
  const t = title ?? '';
  if (/_MEP_/i.test(t)) return 'MEP';
  if (/electrical/i.test(t)) return 'Electrical';
  if (/_M_/i.test(t)) return 'Mechanical';
  if (/_A_/i.test(t)) return 'Architecture';
  return t === '' ? 'Unknown document' : t;
};

// The fallback when a model carries no document table: a discipline from the IFC class alone.
const disciplineOfClass = (category: string): string => {
  const c = category.toUpperCase();
  if (/^IFC(CABLECARRIER|CABLE|LIGHTFIXTURE|ELECTRIC|PROTECTIVEDEVICE|SWITCHINGDEVICE|OUTLET)/.test(c)) return 'Electrical';
  if (/^IFC(FLOW|DISTRIBUTION|PIPE|DUCT|ENERGYCONVERSION)/.test(c)) return 'MEP';
  return 'Architecture';
};

// Relation ordinals of the schema's RelationType enum that place an object inside another:
// partOf, memberOf (an IfcSpace in its storey), containedIn (an element on a storey or in a space).
const PLACING_RELATIONS = new Set([0, 1, 2]);

/** For each object row, the row it sits in: its parentId first, else a placing relation; -1 for none. */
const parentRows = (loaded: LoadedModel): Int32Array => {
  const objects = loaded.data.objects;
  const rowOfId = new Map(objects.map((o, i) => [o.ref.objectId, i]));
  const parent = new Int32Array(objects.length).fill(-1);
  const rel = loaded.relations;
  if (rel)
    for (let i = 0; i < rel.count; i += 1) {
      const from = rel.from[i] ?? -1;
      const to = rel.to[i] ?? -1;
      if (from >= 0 && to >= 0 && PLACING_RELATIONS.has(rel.kind[i] ?? -1) && parent[from] === -1) parent[from] = to;
    }
  objects.forEach((o, i) => {
    const p = o.parentId === undefined ? undefined : rowOfId.get(o.parentId);
    if (p !== undefined) parent[i] = p;
  });
  return parent;
};

const isStorey = (category: string | undefined) => category?.toUpperCase() === 'IFCBUILDINGSTOREY';

/** The storey row of each object row, walking parents up to an IfcBuildingStorey; -1 when there is none. */
const storeyRows = (loaded: LoadedModel): Int32Array => {
  const objects = loaded.data.objects;
  const parent = parentRows(loaded);
  const storey = new Int32Array(objects.length).fill(-1);
  objects.forEach((_, i) => {
    let at = parent[i] ?? -1;
    for (let hops = 0; at >= 0 && hops < 32; hops += 1) {
      if (isStorey(objects[at]?.category)) {
        storey[i] = at;
        return;
      }
      at = parent[at] ?? -1;
    }
  });
  return storey;
};

/** The lowest point of one placed instance in model space, or undefined for a row with no mesh. */
const lowestZ = (geometry: Geometry, row: number): number | undefined => {
  const index = geometry.instances.meshIndex[row] ?? noMesh;
  if (index === noMesh) return undefined;
  const local = geometry.meshes[index]?.bounds ?? (geometry.meshTable ? meshBoundsAt(geometry.meshTable, index) : undefined);
  return local ? transformBounds(instanceTransform(geometry.instances, row), local).min[2] : undefined;
};

/**
 * Storey names ordered highest first by the median lowest point of their elements. The BOS storey
 * records carry an identity placement, so the elevation is read from the geometry placed on them.
 */
const storeysByHeight = (loaded: LoadedModel, storeyOfObject: readonly string[]): string[] => {
  const zs = new Map<string, number[]>();
  const { instances } = loaded.geometry;
  for (let row = 0; row < instances.count; row += 1) {
    const storey = storeyOfObject[instances.objectIndex[row] ?? -1];
    const z = lowestZ(loaded.geometry, row);
    if (storey === undefined || storey === NO_STOREY || z === undefined) continue;
    const list = zs.get(storey);
    if (list) list.push(z);
    else zs.set(storey, [z]);
  }
  const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
  return [...zs.keys()].sort((a, b) => median(zs.get(b)!) - median(zs.get(a)!));
};

/** Classifies every drawn element of a federated model by discipline and storey. */
export const disciplineMix = (loaded: LoadedModel): DisciplineMix => {
  const objects = loaded.data.objects;
  const docs = loaded.documents;
  const method: DisciplineMethod = docs !== undefined && docs.count > 0 ? 'document' : 'class';
  const storeyOf = storeyRows(loaded);
  const storeyOfObject: string[] = [];
  const classified: ClassifiedObject[] = [];
  const spaceKeys: ObjectKey[] = [];
  objects.forEach((o, i) => {
    if (o.representation === undefined) return;
    const category = o.category ?? 'unknown';
    if (category.toUpperCase() === 'IFCSPACE') {
      spaceKeys.push(objectKey(o.ref));
      return;
    }
    const sRow = storeyOf[i] ?? -1;
    const storey = sRow < 0 ? NO_STOREY : (objects[sRow]?.name ?? `storey ${objects[sRow]?.sourceId ?? sRow}`);
    storeyOfObject[i] = storey;
    const discipline =
      method === 'document' ? disciplineOfDocument(docs!.title[docs!.ofObject[i] ?? -1]) : disciplineOfClass(category);
    classified.push({ key: objectKey(o.ref), category, discipline, storey });
  });

  const counts = new Map<string, number>();
  for (const c of classified) counts.set(`${c.storey}\u0000${c.discipline}`, (counts.get(`${c.storey}\u0000${c.discipline}`) ?? 0) + 1);
  const storeys = storeysByHeight(loaded, storeyOfObject);
  if (classified.some((c) => c.storey === NO_STOREY)) storeys.push(NO_STOREY);
  const found = new Set(classified.map((c) => c.discipline));
  const disciplines = [...DISCIPLINES.filter((d) => found.has(d)), ...[...found].filter((d) => !(DISCIPLINES as readonly string[]).includes(d)).sort()];
  const rows: Row[] = [];
  for (const storey of storeys)
    for (const discipline of disciplines) {
      const n = counts.get(`${storey}\u0000${discipline}`);
      if (n) rows.push({ storey, discipline, objects: n });
    }
  return { method, objects: classified, spaceKeys, storeys, disciplines, rows };
};

/** Objects per discipline. */
export const countsByDiscipline = (mix: DisciplineMix): Map<string, number> => {
  const out = new Map<string, number>();
  for (const c of mix.objects) out.set(c.discipline, (out.get(c.discipline) ?? 0) + 1);
  return out;
};

/** Objects per storey for one discipline. */
export const countsByStorey = (mix: DisciplineMix, discipline: string): Map<string, number> => {
  const out = new Map<string, number>();
  for (const c of mix.objects) if (c.discipline === discipline) out.set(c.storey, (out.get(c.storey) ?? 0) + 1);
  return out;
};

const colorOf = (mix: DisciplineMix, discipline: string): string => series[mix.disciplines.indexOf(discipline) % series.length]!;

const methodText = (mix: DisciplineMix): string =>
  mix.method === 'document'
    ? 'Discipline is the source document each object came from in the federation (Duplex_A: Architecture, Duplex_MEP: MEP, Duplex_Electrical: Electrical, Duplex_M rooms and spaces: Mechanical).'
    : 'The model names no source documents, so discipline is read from the IFC class (flow and distribution elements: MEP; cable carriers, light fixtures, electric appliances: Electrical; the rest: Architecture).';

/** The chart spec: objects per storey, stacked by discipline; `normalize` turns it into shares. */
const barSpec = (mix: DisciplineMix, normalize: boolean): TopLevelSpec => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: normalize
    ? { text: 'Share of each storey by discipline', subtitle: 'Duplex federated model, share of drawn elements' }
    : { text: 'Elements per storey by discipline', subtitle: 'Duplex federated model, drawn elements' },
  width: 'container',
  height: 220,
  mark: 'bar',
  encoding: {
    y: { field: 'storey', type: 'nominal', title: null, sort: [...mix.storeys] },
    x: {
      field: 'objects',
      type: 'quantitative',
      title: normalize ? 'Share of the storey' : 'Elements',
      stack: normalize ? 'normalize' : true,
      ...(normalize ? { axis: { format: '%' } } : {}),
    },
    color: {
      field: 'discipline',
      type: 'nominal',
      title: 'Discipline',
      scale: { domain: [...mix.disciplines], range: mix.disciplines.map((d) => colorOf(mix, d)) },
    },
    order: { field: 'discipline', sort: 'ascending' },
    tooltip: [{ field: 'storey' }, { field: 'discipline' }, { field: 'objects', title: 'elements' }],
  },
});

/** What the 3D view draws, for the headless test and a page without WebGL. */
const sceneDescription = (mix: DisciplineMix, modelUrl: string): Record<string, unknown> => {
  const perDiscipline = countsByDiscipline(mix);
  return {
    ...describeScene(
      modelUrl,
      mix.disciplines.map((d) => ({ name: d, elements: perDiscipline.get(d) ?? 0, legend: colorOf(mix, d) })),
    ),
    method: mix.method,
    elements: mix.objects.length,
    hiddenSpaces: mix.spaceKeys.length,
    perStorey: Object.fromEntries(
      mix.storeys.map((s) => [s, Object.fromEntries(mix.rows.filter((r) => r.storey === s).map((r) => [r.discipline, r.objects]))]),
    ),
  };
};

const caption = (mix: DisciplineMix): string => {
  const noStorey = mix.objects.filter((c) => c.storey === NO_STOREY).length;
  return [
    methodText(mix),
    'Storey: the containment and aggregation chain from each element up to an IfcBuildingStorey (an element placed in a space takes the space\'s storey); storeys of the four documents are merged by name.',
    `Counted: ${mix.objects.length} elements with geometry; the ${mix.spaceKeys.length} IfcSpace volumes are hidden in 3D and not counted.`,
    `${noStorey} elements with no storey are counted under "${NO_STOREY}".`,
  ].join(' ');
};

/** Shows or hides one discipline's objects, and colours them, through the viewer's change table keyed by object. */
const applyDiscipline = (handle: SceneHandle, mix: DisciplineMix, discipline: string, visible: boolean): void => {
  const keys = mix.objects.filter((c) => c.discipline === discipline).map((c) => c.key);
  const [r, g, b] = rgbOfHex(colorOf(mix, discipline));
  const n = keys.length;
  handle.viewer.binding.applyChanges(
    handle.modelId,
    tableFromRecord({
      key: stringColumn(keys),
      red: f32Column(new Array<number>(n).fill(r)),
      green: f32Column(new Array<number>(n).fill(g)),
      blue: f32Column(new Array<number>(n).fill(b)),
      alpha: f32Column(new Array<number>(n).fill(1)),
      visible: boolColumn(new Array<boolean>(n).fill(visible)),
    }),
  );
};

const hideKeys = (handle: SceneHandle, keys: readonly ObjectKey[]): void => {
  if (keys.length === 0) return;
  handle.viewer.binding.applyChanges(
    handle.modelId,
    tableFromRecord({ key: stringColumn(keys), visible: boolColumn(new Array<boolean>(keys.length).fill(false)) }),
  );
};

/** The HTML legend: a swatch, a checkbox, and a count per discipline; toggling calls `onToggle`. */
const legend = (doc: Document, mix: DisciplineMix, onToggle: (discipline: string, on: boolean) => void): HTMLElement => {
  const perDiscipline = countsByDiscipline(mix);
  const el = doc.createElement('div');
  el.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px 18px;margin:10px 0 4px;font-size:13px;';
  for (const d of mix.disciplines) {
    const label = doc.createElement('label');
    label.style.cssText = 'display:inline-flex;align-items:center;gap:6px;cursor:pointer;';
    const box = doc.createElement('input');
    box.type = 'checkbox';
    box.checked = true;
    box.addEventListener('change', () => onToggle(d, box.checked));
    const swatch = doc.createElement('span');
    swatch.style.cssText = `display:inline-block;width:12px;height:12px;border-radius:3px;background:${colorOf(mix, d)};`;
    const text = doc.createElement('span');
    text.textContent = `${d} (${perDiscipline.get(d) ?? 0})`;
    label.append(box, swatch, text);
    el.appendChild(label);
  }
  return el;
};

const fixedWidth = (spec: TopLevelSpec): TopLevelSpec => ({ ...spec, width: 560 }) as TopLevelSpec;

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    const doc = root.ownerDocument;
    page.status('Loading the federated Duplex model…');
    const sceneEl = doc.createElement('div');
    const charts = doc.createElement('div');
    charts.className = 'grid';
    charts.style.marginTop = '16px';
    const stacked = doc.createElement('div');
    const shares = doc.createElement('div');
    charts.append(stacked, shares);
    page.figure.append(sceneEl, charts);

    const handle = await mountScene(sceneEl, dataUrl(MODEL));
    const loaded = handle?.loaded ?? (await loadModelHeadless(dataUrl(MODEL)));
    const mix = disciplineMix(loaded);
    if (handle) {
      hideKeys(handle, mix.spaceKeys);
      for (const d of mix.disciplines) applyDiscipline(handle, mix, d, true);
      sceneEl.appendChild(legend(doc, mix, (d, on) => applyDiscipline(handle, mix, d, on)));
    } else {
      const note = doc.createElement('pre');
      note.style.cssText = `font:12px ${tokens.mono};color:${tokens.dim};white-space:pre-wrap;margin:0;`;
      note.textContent = `WebGL is not available, so the 3D view is described instead:\n${JSON.stringify(sceneDescription(mix, MODEL), null, 2)}`;
      sceneEl.appendChild(note);
    }
    page.status('');
    await renderVegaLite(stacked, barSpec(mix, false), mix.rows);
    await renderVegaLite(shares, barSpec(mix, true), mix.rows);
    page.caption(caption(mix));
  },
  async headless(paths): Promise<HeadlessView[]> {
    const mix = disciplineMix(await loadModelHeadless(resolveDataPath(MODEL, paths)));
    return [
      { kind: 'scene3d', title: 'Federated Duplex coloured by discipline', rows: mix.objects.length, description: sceneDescription(mix, MODEL) },
      { kind: 'chart', title: 'Elements per storey by discipline', rows: mix.rows.length, svg: await vegaLiteToSvg(fixedWidth(barSpec(mix, false)), mix.rows) },
      { kind: 'chart', title: 'Share of each storey by discipline', rows: mix.rows.length, svg: await vegaLiteToSvg(fixedWidth(barSpec(mix, true)), mix.rows) },
    ];
  },
};
