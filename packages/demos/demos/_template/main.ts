// Template demo: net floor area per room, stacked by storey, from the Duplex
// extracts. Copy this folder, rename the slug, and replace the query and
// the spec. The `_` prefix keeps this folder out of the index and the test.

import type { TopLevelSpec } from 'vega-lite';
import type { Demo, HeadlessView } from '../../src/demo';
import { dataUrl, resolveDataPath } from '../../src/demo';
import { mountDemoPage } from '../../src/page';
import { renderVegaLite, vegaLiteToSvg, type Row } from '../../src/chart';
import { loadTable, parametersByElement } from '../../src/data';
import type { DemoManifest } from '../../src/manifest';
import raw from './demo.json';

const manifest = raw as DemoManifest;

/** The rows the chart draws: one per space with an Area (PSet_Revit_Dimensions, m²). */
const rows = async (elementsUrl: string, parametersUrl: string): Promise<Row[]> => {
  const elements = await loadTable(elementsUrl);
  const params = parametersByElement(await loadTable(parametersUrl), ['Area']);
  return elements
    .filter((e) => e.Category === 'IFCSPACE')
    .map((e) => ({
      space: String(e.Name),
      storey: String(e.StoreyName ?? 'no storey'),
      area: (params.get(Number(e.EntityIndex))?.Area as number | null) ?? null,
    }))
    .filter((r) => r.area !== null);
};

const spec: TopLevelSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: [] }, // replaced by the rows at render time
  title: { text: 'Floor area by storey and room', subtitle: 'Duplex Apartment, m²' },
  width: 'container',
  height: 260,
  mark: 'bar',
  encoding: {
    y: { field: 'storey', type: 'nominal', title: null, sort: ['Roof', 'Level 2', 'Level 1', 'T/FDN'] },
    x: { field: 'area', type: 'quantitative', title: 'Area (m²)', stack: true },
    color: { field: 'space', type: 'nominal', title: 'Room' },
    tooltip: [{ field: 'space' }, { field: 'storey' }, { field: 'area', format: '.1f' }],
  },
};

export const demo: Demo = {
  manifest,
  async render(root) {
    const page = mountDemoPage(root, manifest);
    page.status('Loading the Duplex extracts…');
    const data = await rows(dataUrl('/data/duplex/elements.json'), dataUrl('/data/duplex/parameters.json'));
    page.status('');
    await renderVegaLite(page.figure, spec, data);
    page.caption(`${data.length} rooms with an Area in PSet_Revit_Dimensions; rooms without one are not drawn.`);
  },
  async headless(paths): Promise<HeadlessView[]> {
    const data = await rows(
      resolveDataPath('/data/duplex/elements.json', paths),
      resolveDataPath('/data/duplex/parameters.json', paths),
    );
    const fixed = { ...spec, width: 640 } as TopLevelSpec;
    return [{ kind: 'chart', title: 'Floor area by storey and room', rows: data.length, svg: await vegaLiteToSvg(fixed, data) }];
  },
};
