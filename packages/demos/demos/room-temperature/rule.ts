// The rule that invented data/readings.json: one summer day of hourly room
// temperatures, from a daily curve, the room's window exposure, and whether
// it is a wet room. Deterministic (no random numbers), so the file can be
// regenerated (generate.ts) and checked against the rule (main.test.ts).

import type { Facade, Room } from './model';

/** One synthetic sensor reading. */
export interface Reading {
  /** STEP id of the IfcSpace the sensor is in. */
  readonly space: number;
  /** Hour of the day, 0 to 23 (the reading at hh:00). */
  readonly hour: number;
  readonly celsius: number;
}

export const HOURS: readonly number[] = Array.from({ length: 24 }, (_, h) => h);

/** The constants of the rule, in one place so the README and the note can quote them. */
export const RULE = {
  /** Daily curve: mean + amplitude × cos(2π (hour − peakHour) / 24), °C. */
  base: { mean: 22.5, amplitude: 2.5, peakHour: 16 },
  /** Solar gain at its peak, °C per unit of glazing-to-floor ratio (glazed m² ÷ box plan m²). */
  gainPerRatio: 10,
  /** The hour each facade's gain peaks; north gets none. Gain falls linearly to 0 over `spreadHours` either side. */
  gainPeak: { north: null, east: 9, south: 13, west: 16 } as Readonly<Record<Facade, number | null>>,
  spreadHours: 4,
  /** Bathrooms and utility rooms run warmer all day: small, enclosed, hot-water pipes. */
  wetRoomOffset: 0.8,
  /** Fixed per-room, per-hour wobble: variation × sin(0.7 × StepId + 1.3 × hour), °C. */
  variation: 0.3,
} as const;

/**
 * Rooms with no sensor: no readings at all, drawn grey as "no sensor".
 * A105 Stair (Level 1) and B205 Utility (Level 2), by STEP id.
 */
export const NO_SENSOR: ReadonlySet<number> = new Set([3456, 3325]);

export const isWetRoom = (name: string): boolean => /bath|utility/i.test(name);

const baseCurve = (hour: number): number =>
  RULE.base.mean + RULE.base.amplitude * Math.cos((2 * Math.PI * (hour - RULE.base.peakHour)) / 24);

const gainShape = (hour: number, peak: number | null): number =>
  peak === null ? 0 : Math.max(0, 1 - Math.abs(hour - peak) / RULE.spreadHours);

/** Solar gain in °C at `hour`, summed over the room's facades. */
export const solarGain = (room: Pick<Room, 'exposure' | 'planArea'>, hour: number): number =>
  (Object.keys(RULE.gainPeak) as Facade[]).reduce(
    (sum, f) => sum + RULE.gainPerRatio * (room.exposure[f] / room.planArea) * gainShape(hour, RULE.gainPeak[f]),
    0,
  );

/** The rule's temperature for a room at an hour, rounded to 0.1 °C as a sensor reports it. */
export const ruleTemperature = (room: Pick<Room, 'id' | 'name' | 'exposure' | 'planArea'>, hour: number): number => {
  const t =
    baseCurve(hour) +
    solarGain(room, hour) +
    (isWetRoom(room.name) ? RULE.wetRoomOffset : 0) +
    RULE.variation * Math.sin(0.7 * room.id + 1.3 * hour);
  return Math.round(t * 10) / 10;
};

/** Every reading for the day: 24 per room, rooms in NO_SENSOR left out. */
export const syntheticReadings = (rooms: readonly Room[]): Reading[] =>
  rooms
    .filter((r) => !NO_SENSOR.has(r.id))
    .flatMap((r) => HOURS.map((hour) => ({ space: r.id, hour, celsius: ruleTemperature(r, hour) })));
