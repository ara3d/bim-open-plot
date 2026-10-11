// A 3D view through BIM Open Viewer: load a .bos from public/models, colour
// elements by STEP id, look from above or from the default orbit, and
// describe the scene for the headless test. Model loading is pure and runs
// in Node; only the canvas needs a browser.

import { createViewer, defaultFeatures, type Viewer } from '@bim-open-viewer/viewer';
import { loadModel, type LoadedModel } from '@bim-open-viewer/formats';
import { objectKey, tableFromRecord, stringColumn, f32Column, type ObjectKey } from '@bim-open-viewer/model';
import { tokens } from './theme';

/** An RGB triple in [0, 1]. */
export type Rgb = readonly [number, number, number];

export const rgbOfHex = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * Object keys by the element's STEP id (the `sourceId` the BOS loader
 * records), for one loaded model. A federated model holds several source
 * documents that each number their own entities, so a STEP id can name an
 * object in each of them: the object from the document matching `document`
 * wins, or, with no pattern, the one from the document whose title sorts
 * first (Duplex_A, the architecture model, in the Duplex federation).
 */
export const keysByStepId = (loaded: LoadedModel, document?: RegExp): Map<number, ObjectKey> => {
  const docs = loaded.documents;
  const titleOf = (i: number): string => docs?.title[docs.ofObject[i] ?? -1] ?? '';
  const out = new Map<number, ObjectKey>();
  const chosen = new Map<number, string>();
  loaded.data.objects.forEach((o, i) => {
    const step = Number(o.sourceId);
    if (!Number.isFinite(step)) return;
    const title = titleOf(i);
    const prev = chosen.get(step);
    const better =
      prev === undefined ||
      (document ? document.test(title) && !document.test(prev) : title.localeCompare(prev) < 0);
    if (better) {
      out.set(step, objectKey(o.ref));
      chosen.set(step, title);
    }
  });
  return out;
};

export interface SceneHandle {
  readonly viewer: Viewer;
  readonly loaded: LoadedModel;
  readonly modelId: string;
  readonly keys: ReadonlyMap<number, ObjectKey>;
  /** Colours elements by STEP id; elements not in the map keep their colour. Returns how many rows changed. */
  colorByStepId(colors: ReadonlyMap<number, Rgb>, alpha?: number): number;
  /** Fades every element to `alpha` (0..1), as a backdrop for the ones coloured afterwards. */
  fadeAll(alpha: number): void;
  /** Fits the camera to the model. */
  fit(): void;
  destroy(): void;
}

/** The canvas test: false in Node and in browsers without WebGL. */
export const hasWebGl = (doc: Document): boolean => {
  const probe = doc.createElement('canvas');
  return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
};

/**
 * Mounts a viewer in `el` and opens `modelUrl` (a `.bos` or `.glb`). Returns
 * null when WebGL is unavailable, so a demo can fall back to its description.
 */
export const mountScene = async (el: HTMLElement, modelUrl: string, height = 480): Promise<SceneHandle | null> => {
  const doc = el.ownerDocument;
  if (!hasWebGl(doc)) return null;
  const canvas = doc.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;
  canvas.style.display = 'block';
  canvas.style.background = tokens.background;
  el.appendChild(canvas);
  const viewer = createViewer({ canvas, features: [...defaultFeatures()], fitOnOpen: true });
  const opened = await viewer.open(modelUrl);
  if (!opened.ok) {
    viewer.dispose();
    canvas.remove();
    throw new Error(opened.diagnostics.map((d) => d.message).join('; ') || `could not open ${modelUrl}`);
  }
  const { ref, loaded } = opened.value;
  const modelId = ref.id;
  const keys = keysByStepId(loaded);
  const allKeys = loaded.data.objects.map((o) => objectKey(o.ref));

  const apply = (rows: { key: string; rgb?: Rgb; alpha?: number }[]): number => {
    if (rows.length === 0) return 0;
    const columns: Record<string, ReturnType<typeof stringColumn> | ReturnType<typeof f32Column>> = {
      key: stringColumn(rows.map((r) => r.key)),
    };
    if (rows.every((r) => r.rgb)) {
      columns.red = f32Column(rows.map((r) => r.rgb![0]));
      columns.green = f32Column(rows.map((r) => r.rgb![1]));
      columns.blue = f32Column(rows.map((r) => r.rgb![2]));
    }
    if (rows.every((r) => r.alpha !== undefined)) columns.alpha = f32Column(rows.map((r) => r.alpha!));
    const report = viewer.binding.applyChanges(modelId, tableFromRecord(columns));
    return report.ok ? report.value.rowsAddressed : 0;
  };

  return {
    viewer,
    loaded,
    modelId,
    keys,
    colorByStepId: (colors, alpha = 1) => {
      const rows: { key: string; rgb: Rgb; alpha: number }[] = [];
      for (const [step, rgb] of colors) {
        const key = keys.get(step);
        if (key) rows.push({ key, rgb, alpha });
      }
      return apply(rows);
    },
    fadeAll: (alpha) => {
      apply(allKeys.map((key) => ({ key, alpha })));
    },
    fit: () => {
      viewer.run('view.fit', {});
    },
    destroy: () => {
      viewer.dispose();
      canvas.remove();
    },
  };
};

/**
 * Loads a model with no renderer, for the headless test and for data a demo
 * derives from the model itself (counts per class, storeys). `source` is a
 * URL in the browser or a file path in Node.
 */
export const loadModelHeadless = async (source: string): Promise<LoadedModel> => {
  let input: string | ArrayBuffer = source;
  if (typeof window === 'undefined') {
    const { readFile } = await import('node:fs/promises');
    const bytes = await readFile(source);
    input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }
  const result = await loadModel(input);
  if (!result.ok) throw new Error(result.diagnostics.map((d) => d.message).join('; ') || `could not load ${source}`);
  return result.value;
};

/** Counts of objects per category in a loaded model. */
export const countsByCategory = (loaded: LoadedModel): Map<string, number> => {
  const out = new Map<string, number>();
  for (const o of loaded.data.objects) out.set(o.category ?? "unknown", (out.get(o.category ?? "unknown") ?? 0) + 1);
  return out;
};

/** What a scene would draw: for the headless test and for a page without WebGL. */
export const describeScene = (
  modelUrl: string,
  layers: readonly { readonly name: string; readonly elements: number; readonly legend?: string }[],
  camera: 'orbit' | 'top' = 'orbit',
): Record<string, unknown> => ({ model: modelUrl, camera, layers });
