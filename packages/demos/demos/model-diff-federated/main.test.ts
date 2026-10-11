// The numbers the figures rest on: the federated Duplex holds more than the
// architecture extract, the other disciplines bring MEP classes the
// architecture model has none of, walls are unchanged, and every
// architecture element is found again by STEP id with its class.

import { beforeAll, describe, expect, it } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTable } from '../../src/data';
import { loadModelHeadless } from '../../src/scene';
import { compareModels, oneSidedRows, type ModelDiff } from './main';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '../../public');

describe('demo model-diff-federated: the comparison', () => {
  let diff: ModelDiff;
  const count = (ifcClass: string) => diff.classes.find((c) => c.ifcClass === ifcClass);

  beforeAll(async () => {
    const elements = await loadTable(`${site}/data/duplex/elements.json`);
    const loaded = await loadModelHeadless(`${site}/models/duplex-federated.bos`);
    diff = compareModels(elements, loaded);
  });

  it('the federated model has more compared objects than the architecture extract', () => {
    expect(diff.architectureTotal).toBe(296);
    expect(diff.federatedTotal).toBe(1910);
    expect(diff.federatedTotal).toBeGreaterThan(diff.architectureTotal);
  });

  it('classes only in the federated model include MEP classes, and none is only in the architecture extract', () => {
    const fedOnly = oneSidedRows(diff).filter((r) => r.side === 'Only in the federated model').map((r) => r.ifcClass);
    expect(fedOnly).toContain('IFCFLOWSEGMENT');
    expect(fedOnly).toContain('IFCFLOWFITTING');
    expect(fedOnly).toHaveLength(8);
    expect(oneSidedRows(diff).filter((r) => r.side === 'Only in the architecture extract')).toEqual([]);
  });

  it('walls match: 56 standard-case walls and 1 other wall on both sides', () => {
    expect(count('IFCWALLSTANDARDCASE')).toEqual({ ifcClass: 'IFCWALLSTANDARDCASE', architecture: 56, federated: 56 });
    expect(count('IFCWALL')).toEqual({ ifcClass: 'IFCWALL', architecture: 1, federated: 1 });
  });

  it('no class has fewer objects in the federated model; spaces and storeys gain the other files\' copies', () => {
    expect(diff.classes.filter((c) => c.federated < c.architecture)).toEqual([]);
    expect(count('IFCSPACE')).toEqual({ ifcClass: 'IFCSPACE', architecture: 21, federated: 101 });
    expect(count('IFCBUILDINGSTOREY')).toEqual({ ifcClass: 'IFCBUILDINGSTOREY', architecture: 4, federated: 13 });
  });

  it('every architecture element is matched by STEP id, with its class, in the architecture document', () => {
    expect(diff.idMatch).not.toBeNull();
    expect(diff.idMatch!.document).toBe('Duplex_A_20110907');
    expect(diff.idMatch!.matched).toBe(296);
    expect(diff.idMatch!.sameClass).toBe(296);
    expect(diff.idMatch!.reusedElsewhere).toBeGreaterThan(0);
  });
});
