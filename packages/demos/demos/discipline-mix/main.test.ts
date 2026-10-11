// The discipline mix of the federated Duplex: every drawn element lands in
// exactly one discipline, the four source documents give four disciplines,
// and Level 1 carries the most MEP elements.

import { describe, expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModelHeadless } from '../../src/scene';
import { countsByDiscipline, countsByStorey, demo, disciplineMix, NO_STOREY, type DisciplineMix } from './main';

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(here, '../../public');

let cached: DisciplineMix | undefined;
const federated = async (): Promise<DisciplineMix> =>
  (cached ??= disciplineMix(await loadModelHeadless(`${siteRoot}/models/duplex-federated.bos`)));

describe('demo discipline-mix: classification', () => {
  it('reads discipline from the source documents and puts every element in exactly one', async () => {
    const mix = await federated();
    expect(mix.method).toBe('document');
    const perDiscipline = countsByDiscipline(mix);
    const sum = [...perDiscipline.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(mix.objects.length);
    expect(mix.objects.length).toBe(1731);
    expect(mix.spaceKeys.length).toBe(101);
    expect(mix.disciplines.length).toBeGreaterThanOrEqual(3);
    expect(Object.fromEntries(perDiscipline)).toEqual({ Architecture: 215, MEP: 926, Electrical: 103, Mechanical: 487 });
  });

  it('orders storeys highest first and finds the storey with the most MEP elements', async () => {
    const mix = await federated();
    expect(mix.storeys).toEqual(['Roof', 'Level 2', 'Level 1', 'T/FDN']);
    const mep = countsByStorey(mix, 'MEP');
    const [top, n] = [...mep].sort((a, b) => b[1] - a[1])[0]!;
    expect([top, n]).toEqual(['Level 1', 497]);
    expect(mix.objects.filter((o) => o.storey === NO_STOREY)).toHaveLength(0);
  });

  it('chart rows add up to the element count, and the scene description names every discipline', async () => {
    const mix = await federated();
    expect(mix.rows.reduce((s, r) => s + Number(r.objects), 0)).toBe(mix.objects.length);
    const views = await demo.headless({ dataRoot: here, siteRoot });
    const scene = views.find((v) => v.kind === 'scene3d')!;
    const layers = scene.description!.layers as { name: string; elements: number }[];
    expect(layers.map((l) => l.name)).toEqual(['Architecture', 'MEP', 'Electrical', 'Mechanical']);
    expect(views.filter((v) => v.kind === 'chart')).toHaveLength(2);
  });
});
