// Storeys in 3D: the federated Duplex tinted by storey, stacked or exploded,
// beside a bar chart of the architecture elements on each storey by class.
// Data shaping is in storeys.ts; the viewer calls are in scene-storeys.ts.

import type { TopLevelSpec } from 'vega-lite';
import type { LoadedModel } from '@bim-open-viewer/formats';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadTable } from '../../src/data';
import { describeScene, loadModelHeadless, mountScene } from '../../src/scene';
import { tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import { assignStoreys, countsPerStorey, elementsByStoreyAndClass, storeysByElevation, type Storey, type StoreyAssignment } from './storeys';
import { explodeOffsets, storeyExplode, tintStoreys } from './scene-storeys';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const ELEMENTS = '/data/duplex/elements.json';
const PARAMETERS = '/data/duplex/parameters.json';
const MODEL = '/models/duplex-federated.bos';

/** Segments narrower than this many elements get no class label; the tooltip still names them. */
const LABEL_MIN = 6;

interface Extracts {
  readonly storeys: Storey[];
  readonly chartRows: Row[];
  readonly elements: Row[];
}

const loadExtracts = async (elementsAt: string, parametersAt: string): Promise<Extracts> => {
  const elements = await loadTable(elementsAt);
  const storeys = storeysByElevation(elements, await loadTable(parametersAt));
  return { storeys, chartRows: elementsByStoreyAndClass(elements), elements };
};

/** Stacked bars, one per storey, in that storey's 3D colour; segments are classes, labelled where wide enough. */
const chartSpec = (storeys: readonly Storey[]): TopLevelSpec => {
  const topFirst = [...storeys].reverse().map((s) => s.name);
  const y = { field: 'storey', type: 'nominal' as const, title: null, sort: topFirst };
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    data: { values: [] }, // replaced by the rows at render time
    title: { text: 'Elements per storey, by class', subtitle: 'Duplex Apartment architecture model; each segment is one IFC class (hover a segment to name it)' },
    width: 'container',
    height: 220,
    transform: [
      { stack: 'count', groupby: ['storey'], sort: [{ field: 'count', order: 'descending' }], as: ['x0', 'x1'] },
      { calculate: '(datum.x0 + datum.x1) / 2', as: 'xm' },
    ],
    layer: [
      {
        mark: { type: 'bar', stroke: tokens.surface, strokeWidth: 1.5 },
        encoding: {
          y,
          x: { field: 'x0', type: 'quantitative', title: 'Elements' },
          x2: { field: 'x1' },
          color: {
            field: 'storey',
            type: 'nominal',
            title: 'Storey',
            scale: { domain: storeys.map((s) => s.name), range: storeys.map((s) => s.color) },
            legend: null,
          },
          tooltip: [{ field: 'storey' }, { field: 'cls', title: 'Class' }, { field: 'count', title: 'Elements' }],
        },
      },
      {
        transform: [{ filter: `datum.count >= ${LABEL_MIN}` }],
        mark: { type: 'text', color: tokens.surface, fontSize: 10 },
        encoding: { y, x: { field: 'xm', type: 'quantitative' }, text: { field: 'cls' } },
      },
    ],
  } as TopLevelSpec;
};

/** The layers a scene draws, the same in the headless description and the page's fallback. */
const sceneDescription = (storeys: readonly Storey[], assignment: StoreyAssignment): Record<string, unknown> => ({
  ...describeScene(
    MODEL,
    countsPerStorey(assignment, storeys).map((c) => ({
      ...c,
      legend: storeys.find((s) => s.name === c.name)?.color ?? 'unlisted storey',
    })),
  ),
  storeySource: assignment.sourceCounts,
  unassignedFaded: assignment.unassigned.length,
  roomsHidden: assignment.rooms.length,
  explode: 'storey i lifted by i x 1.5 x the average storey height; unassigned elements stay put',
});

const sceneCaption = (assignment: StoreyAssignment): string =>
  `${assignment.byKey.size} elements of the four discipline models are tinted by storey: ` +
  `${assignment.sourceCounts.extract} from the architecture extract's storey, ` +
  `${assignment.sourceCounts.containment} from the storey that contains them in their own model. ` +
  `${assignment.unassigned.length} elements name no storey and are drawn faint; they stay in place when exploded. ` +
  `${assignment.rooms.length} room volumes are hidden. The chart counts the architecture model only.`;

const legend = (doc: Document, storeys: readonly Storey[], assignment: StoreyAssignment): HTMLElement => {
  const counts = new Map(countsPerStorey(assignment, storeys).map((c) => [c.name, c.elements]));
  const el = doc.createElement('div');
  el.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;';
  for (const s of [...storeys].reverse()) {
    const item = doc.createElement('span');
    item.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
    const swatch = doc.createElement('span');
    swatch.style.cssText = `width:12px;height:12px;border-radius:2px;background:${s.color};`;
    item.append(swatch, `${s.name} (${counts.get(s.name) ?? 0})`);
    el.appendChild(item);
  }
  return el;
};

const toggle = (doc: Document, onChange: (exploded: boolean) => void): HTMLElement => {
  const group = doc.createElement('div');
  group.setAttribute('role', 'group');
  group.style.cssText = 'display:inline-flex;gap:4px;';
  const buttons = (['Stacked', 'Exploded'] as const).map((label) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = `font:inherit;font-size:13px;padding:4px 12px;border-radius:6px;cursor:pointer;border:1px solid ${tokens.border};`;
    return b;
  });
  const paint = (exploded: boolean) =>
    buttons.forEach((b, i) => {
      const on = (i === 1) === exploded;
      b.setAttribute('aria-pressed', String(on));
      b.style.background = on ? tokens.accentSoft : tokens.surface;
      b.style.borderColor = on ? tokens.accent : tokens.border;
    });
  buttons.forEach((b, i) =>
    b.addEventListener('click', () => {
      paint(i === 1);
      onChange(i === 1);
    }),
  );
  paint(false);
  group.append(...buttons);
  return group;
};

/** Draws the 3D figure into `el`; returns the caption, or a description when WebGL is unavailable. */
const renderScene = async (el: HTMLElement, extracts: Extracts): Promise<string> => {
  const doc = el.ownerDocument;
  const bar = doc.createElement('div');
  bar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;';
  const holder = doc.createElement('div');
  el.append(bar, holder);
  const handle = await mountScene(holder, dataUrl(MODEL));
  const loaded: LoadedModel = handle?.loaded ?? (await loadModelHeadless(dataUrl(MODEL)));
  const assignment = assignStoreys(loaded, extracts.elements);
  bar.appendChild(legend(doc, extracts.storeys, assignment));
  if (handle === null) {
    const pre = doc.createElement('pre');
    pre.style.cssText = `font-family:${tokens.mono};font-size:12px;white-space:pre-wrap;`;
    pre.textContent = `No WebGL here, so the 3D view is described instead:\n${JSON.stringify(sceneDescription(extracts.storeys, assignment), null, 2)}`;
    holder.appendChild(pre);
    return sceneCaption(assignment);
  }
  tintStoreys(handle, extracts.storeys, assignment);
  const explode = storeyExplode(handle, explodeOffsets(extracts.storeys, assignment, loaded.coordinates.up));
  if (explode !== null) bar.appendChild(toggle(doc, (on) => explode.set(on)));
  return sceneCaption(assignment);
};

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts and the federated model…');
    const extracts = await loadExtracts(dataUrl(ELEMENTS), dataUrl(PARAMETERS));
    const doc = root.ownerDocument;
    const sceneEl = doc.createElement('div');
    const chartEl = doc.createElement('div');
    chartEl.style.marginTop = '16px';
    page.figure.append(sceneEl, chartEl);
    const [scene] = await Promise.allSettled([
      renderScene(sceneEl, extracts),
      renderVegaLite(chartEl, chartSpec(extracts.storeys), extracts.chartRows),
    ]);
    if (scene.status === 'rejected') page.status(`The 3D view failed: ${String(scene.reason)}`, true);
    else page.status('');
    const total = extracts.chartRows.reduce((n, r) => n + Number(r.count), 0);
    page.caption(
      `${scene.status === 'fulfilled' ? `${scene.value} ` : ''}` +
        `The chart's ${total} elements carry a storey in the IFC; rooms and openings are left out. ` +
        `Storeys are ordered by Ifc:Elevation.`,
    );
  },
  async headless(paths): Promise<HeadlessView[]> {
    const extracts = await loadExtracts(resolveDataPath(ELEMENTS, paths), resolveDataPath(PARAMETERS, paths));
    const loaded = await loadModelHeadless(resolveDataPath(MODEL, paths));
    const assignment = assignStoreys(loaded, extracts.elements);
    const fixed = { ...chartSpec(extracts.storeys), width: 640 } as TopLevelSpec;
    return [
      {
        kind: 'scene3d',
        title: 'Federated Duplex tinted by storey',
        rows: assignment.byKey.size,
        description: sceneDescription(extracts.storeys, assignment),
      },
      {
        kind: 'chart',
        title: 'Elements per storey, by class',
        rows: extracts.chartRows.length,
        svg: await vegaLiteToSvg(fixed, extracts.chartRows),
      },
    ];
  },
};
