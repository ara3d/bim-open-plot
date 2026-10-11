// Embodied carbon by storey and material family for the Duplex: model
// volumes (PSet_Revit_Dimensions) times synthetic factors per family, as a
// stacked bar per storey, a sorted bar per family, and the 3D model with
// each counted element on the heat ramp. The arithmetic is in carbon.ts.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadJson, loadTable } from '../../src/data';
import { describeScene, keysByStepId, loadModelHeadless, mountScene, rgbOfHex, type Rgb } from '../../src/scene';
import { heat, heatColor, series, tokens } from '../../src/theme';
import type { DemoManifest } from '../../src/manifest';
import {
  carbonByFamily,
  carbonByStoreyFamily,
  elementCarbon,
  storeyOrder,
  storeyTallies,
  type CarbonFactors,
  type ElementCarbon,
  type StoreyTally,
} from './carbon';
import raw from './demo.json';

const manifest = raw as DemoManifest;

const FILES = {
  elements: '/data/duplex/elements.json',
  parameters: '/data/duplex/parameters.json',
  relations: '/data/duplex/relations.json',
  factors: 'data/carbon-factors.json',
} as const;
const MODEL = '/models/duplex-federated.bos';
const SCHEMA = 'https://vega.github.io/schema/vega-lite/v6.json';

/** Everything the three views draw, computed once from the four files. */
export interface CarbonData {
  readonly elements: readonly ElementCarbon[];
  readonly order: readonly string[];
  readonly tallies: readonly StoreyTally[];
  readonly byFamily: readonly Row[];
  readonly byStoreyFamily: readonly Row[];
  readonly factors: CarbonFactors;
}

/** Loads the extracts and the factors; `resolve` turns a manifest path into a URL or a file path. */
export const loadCarbon = async (resolve: (file: string) => string): Promise<CarbonData> => {
  const [elements, parameters, relations, factors] = await Promise.all([
    loadTable(resolve(FILES.elements)),
    loadTable(resolve(FILES.parameters)),
    loadTable(resolve(FILES.relations)),
    loadJson<CarbonFactors>(resolve(FILES.factors)),
  ]);
  const rows = elementCarbon(elements, parameters, relations, factors);
  const order = storeyOrder(elements, parameters);
  return {
    elements: rows,
    order,
    tallies: storeyTallies(rows, order),
    byFamily: carbonByFamily(rows),
    byStoreyFamily: carbonByStoreyFamily(rows),
    factors,
  };
};

const tonnes = (kg: number) => `${(kg / 1000).toFixed(1)} t`;

/** The stacked bar's rows: one segment per storey and family, and one total per storey carrying its label. */
const storeyRows = (data: CarbonData): Row[] => [
  ...data.byStoreyFamily.map((r) => ({ ...r, kind: 'segment' })),
  ...data.tallies.map((t) => ({
    kind: 'total',
    storey: t.storey,
    carbon: t.carbon,
    label: `${tonnes(t.carbon)} · ${t.noFactor} no factor · ${t.noVolume} no volume`,
  })),
];

/** One colour per family, in the order of the family bar, so both charts agree. */
const familyScale = (data: CarbonData) => ({
  domain: data.byFamily.map((r) => String(r.family)),
  range: series.slice(0, data.byFamily.length),
});

const storeySpec = (data: CarbonData): TopLevelSpec => ({
  $schema: SCHEMA,
  data: { values: [] }, // replaced by storeyRows at render time
  title: {
    text: 'Embodied carbon by storey and material family',
    subtitle: 'kgCO2e (A1-A3); label: total, then elements left out for want of a factor or a volume',
  },
  width: 'container',
  height: 220,
  encoding: { y: { field: 'storey', type: 'nominal', title: null, sort: [...data.order] } },
  layer: [
    {
      transform: [{ filter: "datum.kind === 'segment'" }],
      mark: 'bar',
      encoding: {
        x: { field: 'carbon', type: 'quantitative', title: 'Embodied carbon (kgCO2e)', stack: true },
        color: { field: 'family', type: 'nominal', title: 'Material family', scale: familyScale(data), legend: { orient: 'bottom', direction: 'horizontal' } },
        tooltip: [
          { field: 'storey' },
          { field: 'family' },
          { field: 'carbon', title: 'kgCO2e', format: ',.0f' },
          { field: 'elements' },
        ],
      },
    },
    {
      transform: [{ filter: "datum.kind === 'total'" }],
      mark: { type: 'text', align: 'left', baseline: 'middle', dx: 6, fontSize: 11, color: tokens.dim },
      encoding: { x: { field: 'carbon', type: 'quantitative' }, text: { field: 'label' } },
    },
  ],
});

const familySpec = (data: CarbonData): TopLevelSpec => ({
  $schema: SCHEMA,
  data: { values: [] }, // replaced by data.byFamily at render time
  title: { text: 'Embodied carbon by material family', subtitle: 'kgCO2e, whole building, largest first' },
  width: 'container',
  height: 200,
  encoding: {
    y: { field: 'family', type: 'nominal', title: null, sort: familyScale(data).domain },
    x: { field: 'carbon', type: 'quantitative', title: 'Embodied carbon (kgCO2e)' },
  },
  layer: [
    {
      mark: 'bar',
      encoding: {
        color: { field: 'family', type: 'nominal', scale: familyScale(data), legend: null },
        tooltip: [
          { field: 'family' },
          { field: 'carbon', title: 'kgCO2e', format: ',.0f' },
          { field: 'volume', title: 'volume (m³)', format: ',.2f' },
          { field: 'factor', title: 'factor (kgCO2e/m³)', format: ',' },
          { field: 'elements' },
        ],
      },
    },
    {
      mark: { type: 'text', align: 'left', baseline: 'middle', dx: 4, fontSize: 11, color: tokens.dim },
      encoding: { text: { field: 'carbon', type: 'quantitative', format: ',.0f' } },
    },
  ],
});

/** Elements with carbon and their heat-ramp colour (0 to the largest element). */
const sceneColours = (data: CarbonData): { colours: Map<number, Rgb>; max: number } => {
  const counted = data.elements.filter((e) => e.carbon !== null);
  const max = Math.max(...counted.map((e) => e.carbon!));
  return { colours: new Map(counted.map((e) => [e.stepId, rgbOfHex(heatColor(e.carbon!, 0, max))])), max };
};

/** The scene's layers: the coloured elements found in the model, and the built elements left faded. */
const sceneLayers = (data: CarbonData, coloured: number, max: number) => [
  { name: 'element carbon (kgCO2e, heat ramp)', elements: coloured, legend: `0 to ${Math.round(max).toLocaleString('en-US')} kgCO2e` },
  { name: 'faded: built elements with no volume or no factor', elements: data.elements.length - coloured },
];

const legend = (doc: Document, max: number): HTMLElement => {
  const el = doc.createElement('div');
  el.style.cssText = `display:flex;align-items:center;gap:8px;font-size:12px;color:${tokens.dim};margin-top:8px;flex-wrap:wrap`;
  const ramp = doc.createElement('span');
  ramp.style.cssText = `display:inline-block;width:160px;height:10px;border-radius:2px;background:linear-gradient(to right, ${heat.join(', ')})`;
  const faded = doc.createElement('span');
  faded.style.cssText = `display:inline-block;width:14px;height:10px;border-radius:2px;background:${tokens.border};margin-left:16px`;
  el.append('0', ramp, `${Math.round(max).toLocaleString('en-US')} kgCO2e per element`, faded, 'faded: not counted');
  return el;
};

/** "61 furnishingelement, 24 window, ..." for a list of elements, largest class first. */
const classCounts = (elements: readonly ElementCarbon[]): string => {
  const counts = new Map<string, number>();
  for (const e of elements) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${n} ${c.replace(/^IFC/, '').toLowerCase()}`)
    .join(', ');
};

const caption = (data: CarbonData): string => {
  const counted = data.elements.filter((e) => e.carbon !== null).length;
  const noVolume = data.elements.filter((e) => e.volume === null);
  const noFactor = data.elements.filter((e) => e.volume !== null && e.family === null);
  const types = [...new Set(noFactor.map((e) => e.typeName))].join('; ');
  const top = [...data.tallies].sort((a, b) => b.carbon - a.carbon)[0];
  const topFamily = data.byFamily[0];
  return [
    `<strong>The carbon factors are synthetic and illustrative</strong>, sized like generic values in an EPD database, not taken from an EPD.`,
    `Volumes are the model's PSet_Revit_Dimensions Volume. ${counted} of ${data.elements.length} built elements are counted;`,
    `${noVolume.length} have no volume (${classCounts(noVolume)}) and ${noFactor.length} have a volume but no family match (${types}), so they are left out, not counted as zero.`,
    `Each element takes one family over its whole volume, from its type name or its first solid material layer, so layered walls are approximate.`,
    top && topFamily ? `Largest: ${top.storey} at ${tonnes(top.carbon)}, and ${String(topFamily.family)} across the building at ${tonnes(Number(topFamily.carbon))}.` : '',
  ].join(' ');
};

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts and the carbon factors…');
    const data = await loadCarbon((f) => dataUrl(f));
    page.status('');
    const doc = root.ownerDocument;
    const grid = doc.createElement('div');
    grid.className = 'grid';
    const storeyEl = doc.createElement('div');
    const familyEl = doc.createElement('div');
    grid.append(storeyEl, familyEl);
    const sceneEl = doc.createElement('div');
    sceneEl.style.marginTop = '16px';
    page.figure.append(grid, sceneEl);
    await renderVegaLite(storeyEl, storeySpec(data), storeyRows(data));
    await renderVegaLite(familyEl, familySpec(data), data.byFamily);
    page.caption(caption(data));

    const { colours, max } = sceneColours(data);
    const scene = await mountScene(sceneEl, dataUrl(MODEL));
    if (!scene) {
      const text = doc.createElement('p');
      text.className = 'status';
      text.textContent = `3D view unavailable (no WebGL): ${JSON.stringify(describeScene(MODEL, sceneLayers(data, colours.size, max)))}`;
      sceneEl.appendChild(text);
      return;
    }
    scene.fadeAll(0.15);
    scene.colorByStepId(colours);
    sceneEl.appendChild(legend(doc, max));
  },
  async headless(paths): Promise<HeadlessView[]> {
    const data = await loadCarbon((f) => resolveDataPath(f, paths));
    const fixed = (spec: TopLevelSpec) => ({ ...spec, width: 640 }) as TopLevelSpec;
    const { colours, max } = sceneColours(data);
    const loaded = await loadModelHeadless(`${paths.siteRoot}${MODEL}`);
    const keys = keysByStepId(loaded);
    const coloured = [...colours.keys()].filter((step) => keys.has(step)).length;
    const storey = storeyRows(data);
    return [
      { kind: 'chart', title: 'Embodied carbon by storey and material family', rows: storey.length, svg: await vegaLiteToSvg(fixed(storeySpec(data)), storey) },
      { kind: 'chart', title: 'Embodied carbon by material family', rows: data.byFamily.length, svg: await vegaLiteToSvg(fixed(familySpec(data)), data.byFamily) },
      {
        kind: 'scene3d',
        title: 'Duplex coloured by element carbon',
        rows: coloured,
        description: describeScene(MODEL, sceneLayers(data, coloured, max)),
      },
    ];
  },
};
