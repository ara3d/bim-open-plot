// The data side of the storeys demo, with no viewer: storeys in elevation
// order from the extracts, the chart's counts per storey and class, and the
// storey of every drawn object in the federated model. Runs in Node.

import type { LoadedModel } from '@bim-open-viewer/formats';
import { objectKey, type ObjectKey, type ObjectRecord } from '@bim-open-viewer/model';
import type { Row } from '../../src/chart';
import { parametersByElement } from '../../src/data';
import { series } from '../../src/theme';

/** One storey: its name, its Ifc:Elevation (m), and its colour in both figures. */
export interface Storey {
  readonly name: string;
  readonly elevation: number;
  readonly color: string;
}

/** Storeys from the IFCBUILDINGSTOREY rows of the extracts, lowest first, coloured by the `series` palette. */
export const storeysByElevation = (elements: readonly Row[], parameters: readonly Row[]): Storey[] => {
  const elevations = parametersByElement(parameters, ['Ifc:Elevation']);
  return elements
    .filter((e) => e.Category === 'IFCBUILDINGSTOREY')
    .map((e) => ({ name: String(e.Name), elevation: elevations.get(Number(e.EntityIndex))?.['Ifc:Elevation'] }))
    .filter((s): s is { name: string; elevation: number } => typeof s.elevation === 'number')
    .sort((a, b) => a.elevation - b.elevation)
    .map((s, i) => ({ ...s, color: series[i % series.length]! }));
};

/** Room volumes: not elements a storey holds, and drawn as boxes they would hide the rest. */
const isRoom = (category: string | undefined): boolean => category === 'IFCSPACE';

const CLASS_LABELS: Readonly<Record<string, string>> = {
  IFCWALLSTANDARDCASE: 'Wall',
  IFCFURNISHINGELEMENT: 'Furnishing',
  IFCSTAIRFLIGHT: 'Stair flight',
};

/** A reader's name for an IFC class: IFCWALLSTANDARDCASE and IFCWALL are both "Wall". */
export const classLabel = (category: string): string => {
  const known = CLASS_LABELS[category];
  if (known) return known;
  const bare = category.replace(/^IFC/, '').toLowerCase();
  return bare.charAt(0).toUpperCase() + bare.slice(1);
};

/** The chart's rows: architecture elements per storey and class, from the extracts' StoreyName. Rooms are left out. */
export const elementsByStoreyAndClass = (elements: readonly Row[]): Row[] => {
  const counts = new Map<string, { storey: string; cls: string; count: number }>();
  for (const e of elements) {
    if (e.StoreyName === null || e.StoreyName === undefined || isRoom(String(e.Category))) continue;
    const storey = String(e.StoreyName);
    const cls = classLabel(String(e.Category));
    const id = `${storey}\u0000${cls}`;
    const entry = counts.get(id) ?? { storey, cls, count: 0 };
    entry.count += 1;
    counts.set(id, entry);
  }
  return [...counts.values()];
};

/** How a drawn object got its storey. */
export type StoreySource = 'extract' | 'containment';

/** The storey of every drawn object in the loaded model, and what could not be placed on one. */
export interface StoreyAssignment {
  readonly byKey: ReadonlyMap<ObjectKey, string>;
  readonly sourceCounts: Readonly<Record<StoreySource, number>>;
  /** Drawn objects with no storey from either source: faded, not moved. */
  readonly unassigned: readonly ObjectKey[];
  /** Drawn room volumes (IFCSPACE): hidden. */
  readonly rooms: readonly ObjectKey[];
}

/**
 * Assigns each drawn object a storey. First from the extracts: the
 * architecture model is the first file of the federation, so its object
 * `bos:<EntityIndex>` is the extract row, and the row is trusted only when
 * the object's STEP id agrees. Then, for the other three files, from the
 * model's own containment: the nearest IFCBUILDINGSTOREY up the `parentId`
 * chain. STEP ids alone cannot join: the four files reuse them.
 */
export const assignStoreys = (loaded: LoadedModel, elements: readonly Row[]): StoreyAssignment => {
  const objects = loaded.data.objects;
  const fromExtract = new Map<ObjectRecord, string>();
  for (const e of elements) {
    const record = objects[Number(e.EntityIndex)];
    if (record && record.sourceId === String(e.StepId) && e.StoreyName !== null && e.StoreyName !== undefined)
      fromExtract.set(record, String(e.StoreyName));
  }
  const byObjectId = new Map(objects.map((o) => [o.ref.objectId, o]));
  const containingStorey = (record: ObjectRecord): string | undefined => {
    const seen = new Set<string>();
    for (let parent = record.parentId; parent !== undefined && !seen.has(parent); ) {
      seen.add(parent);
      const up = byObjectId.get(parent);
      if (up === undefined) return undefined;
      if (up.category === 'IFCBUILDINGSTOREY') return up.name;
      parent = up.parentId;
    }
    return undefined;
  };

  const byKey = new Map<ObjectKey, string>();
  const sourceCounts = { extract: 0, containment: 0 };
  const unassigned: ObjectKey[] = [];
  const rooms: ObjectKey[] = [];
  for (const record of objects) {
    if (record.representation === undefined) continue;
    const key = objectKey(record.ref);
    if (isRoom(record.category)) {
      rooms.push(key);
      continue;
    }
    const extract = fromExtract.get(record);
    const storey = extract ?? containingStorey(record);
    if (storey === undefined) unassigned.push(key);
    else {
      byKey.set(key, storey);
      sourceCounts[extract !== undefined ? 'extract' : 'containment'] += 1;
    }
  }
  return { byKey, sourceCounts, unassigned, rooms };
};

/** Drawn objects per storey, in the storeys' order; a storey name not in `storeys` is counted under its own name at the end. */
export const countsPerStorey = (assignment: StoreyAssignment, storeys: readonly Storey[]): { name: string; elements: number }[] => {
  const counts = new Map<string, number>(storeys.map((s) => [s.name, 0]));
  for (const storey of assignment.byKey.values()) counts.set(storey, (counts.get(storey) ?? 0) + 1);
  return [...counts].map(([name, elements]) => ({ name, elements }));
};
