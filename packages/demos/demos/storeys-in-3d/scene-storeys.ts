// The viewer side of the storeys demo: tint each storey through colour rules
// and lift the storeys apart by moving the instance rows. Both go through the
// viewer's own API on the SceneHandle; nothing here edits the model.

import { captureTranslations, layoutTranslations, writeLayout } from '@bim-open-viewer/features';
import type { ObjectKey, StyleRule, Vec3 } from '@bim-open-viewer/model';
import { rgbOfHex, type SceneHandle } from '../../src/scene';
import type { Storey, StoreyAssignment } from './storeys';

/** How faint an object with no storey is drawn. */
const UNASSIGNED_OPACITY = 0.12;

/** The gap the explode adds per storey, as a multiple of the average storey height. */
const EXPLODE_STRENGTH = 1.5;

const rule = (id: string, priority: number, targets: readonly ObjectKey[], change: StyleRule['change']): StyleRule => ({
  id,
  name: id,
  enabled: true,
  priority,
  targets,
  change,
});

/**
 * Colours every assigned object by its storey, fades the unassigned ones,
 * and hides room volumes. Rules, not raw colour writes, so a click-select
 * restyles over them instead of wiping them.
 */
export const tintStoreys = (handle: SceneHandle, storeys: readonly Storey[], assignment: StoreyAssignment): void => {
  const rules = storeys.map((s, i) =>
    rule(
      `storey:${s.name}`,
      i + 1,
      [...assignment.byKey].filter(([, name]) => name === s.name).map(([key]) => key),
      { color: rgbOfHex(s.color), opacity: 1 },
    ),
  );
  rules.push(rule('storey:none', 0, assignment.unassigned, { opacity: UNASSIGNED_OPACITY }));
  rules.push(rule('rooms', 0, assignment.rooms, { visible: false }));
  const result = handle.viewer.apply(...rules);
  if (!result.ok) throw new Error(result.diagnostics.map((d) => d.message).join('; '));
};

/** Offsets that lift storey i (lowest is 0) by i × strength × the average storey height, along the model's up axis. */
export const explodeOffsets = (
  storeys: readonly Storey[],
  assignment: StoreyAssignment,
  up: 'y' | 'z',
  strength = EXPLODE_STRENGTH,
): Map<ObjectKey, Vec3> => {
  const offsets = new Map<ObjectKey, Vec3>();
  if (storeys.length < 2) return offsets;
  const step = ((storeys[storeys.length - 1]!.elevation - storeys[0]!.elevation) / (storeys.length - 1)) * strength;
  const rank = new Map(storeys.map((s, i) => [s.name, i]));
  for (const [key, name] of assignment.byKey) {
    const lift = (rank.get(name) ?? 0) * step;
    if (lift !== 0) offsets.set(key, up === 'y' ? [0, lift, 0] : [0, 0, lift]);
  }
  return offsets;
};

/** Switches the scene between the model's own placement and the exploded one. */
export interface StoreyExplode {
  set(exploded: boolean): void;
}

/**
 * Captures the model's row translations once, then writes base + offsets
 * for Exploded and base alone for Stacked. Unassigned objects stay where
 * the model placed them. Null when the model is not bound.
 */
export const storeyExplode = (handle: SceneHandle, offsets: ReadonlyMap<ObjectKey, Vec3>): StoreyExplode | null => {
  const binding = handle.viewer.binding;
  const bound = binding.models.find((m) => m.modelId === handle.modelId);
  if (bound === undefined) return null;
  const base = captureTranslations(bound.table);
  const scratch = new Float32Array(base.length);
  const none: ReadonlyMap<ObjectKey, Vec3> = new Map();
  return {
    set: (exploded) => {
      writeLayout(bound.table, layoutTranslations(bound.table, base, exploded ? offsets : none, scratch), bound.dirty);
      binding.publish();
      handle.fit();
    },
  };
};
