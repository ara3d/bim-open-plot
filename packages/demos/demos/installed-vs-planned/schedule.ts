// The rule that invented data/events.json: a fifteen-week plan for the
// Duplex Apartment's real elements, by storey and class in build order, and
// a delay per activity that puts Level 2 and the roof behind and Level 1's
// windows and doors ahead. main.test.ts regenerates the file from this rule
// and fails when the two differ, so the rule stated here is the one drawn.

import type { Row } from '../../src/chart';

/** One activity of the plan: which storey and classes it installs, when, and how late it runs. */
export interface Activity {
  readonly name: string;
  readonly storey: string;
  readonly classes: readonly string[];
  /** The planned week the activity starts (week 1 is the first week on site). */
  readonly start: number;
  /** Planned duration in weeks; elements are spread evenly over it in STEP id order. */
  readonly weeks: number;
  /** Actual minus planned week for every element of the activity: positive is late, negative early. */
  readonly delay: number;
}

/** One element's planned week and, when installed by `thisWeek`, the week it went in. */
export interface InstallEvent {
  readonly globalId: string;
  readonly activity: string;
  readonly plannedWeek: number;
  /** Null when the element is not installed as of `thisWeek`. */
  readonly actualWeek: number | null;
}

export interface EventsFile {
  readonly provenance: 'synthetic';
  readonly rule: string;
  /** The status date: events after this week have not happened. */
  readonly thisWeek: number;
  readonly events: readonly InstallEvent[];
}

/** The status date of the synthetic progress record. */
export const THIS_WEEK = 9;

const WALLS = ['IFCWALLSTANDARDCASE', 'IFCWALL'];

/** The plan, in build order: foundations, slabs, walls and frame, roof, openings, finishes, furniture. */
export const ACTIVITIES: readonly Activity[] = [
  { name: 'Footings', storey: 'T/FDN', classes: ['IFCFOOTING'], start: 1, weeks: 1, delay: 0 },
  { name: 'Foundation walls', storey: 'T/FDN', classes: WALLS, start: 2, weeks: 1, delay: 0 },
  { name: 'Level 1 slabs', storey: 'Level 1', classes: ['IFCSLAB'], start: 3, weeks: 1, delay: 0 },
  { name: 'Level 1 walls and frame', storey: 'Level 1', classes: [...WALLS, 'IFCBEAM', 'IFCMEMBER'], start: 4, weeks: 2, delay: 0 },
  { name: 'Level 2 slabs', storey: 'Level 2', classes: ['IFCSLAB'], start: 6, weeks: 1, delay: 1 },
  { name: 'Level 2 walls and frame', storey: 'Level 2', classes: [...WALLS, 'IFCBEAM', 'IFCMEMBER'], start: 7, weeks: 2, delay: 2 },
  { name: 'Roof', storey: 'Roof', classes: ['IFCSLAB', 'IFCROOF', ...WALLS], start: 9, weeks: 1, delay: 2 },
  { name: 'Level 1 stairs and railings', storey: 'Level 1', classes: ['IFCSTAIR', 'IFCSTAIRFLIGHT', 'IFCRAILING'], start: 9, weeks: 1, delay: 0 },
  { name: 'Level 1 windows and doors', storey: 'Level 1', classes: ['IFCWINDOW', 'IFCDOOR'], start: 10, weeks: 1, delay: -1 },
  { name: 'Level 2 windows and doors', storey: 'Level 2', classes: ['IFCWINDOW', 'IFCDOOR'], start: 11, weeks: 1, delay: 2 },
  { name: 'Roof windows', storey: 'Roof', classes: ['IFCWINDOW'], start: 11, weeks: 1, delay: 2 },
  { name: 'Level 1 coverings', storey: 'Level 1', classes: ['IFCCOVERING'], start: 12, weeks: 1, delay: -1 },
  { name: 'Level 2 coverings', storey: 'Level 2', classes: ['IFCCOVERING'], start: 13, weeks: 1, delay: 2 },
  { name: 'Level 1 furniture', storey: 'Level 1', classes: ['IFCFURNISHINGELEMENT'], start: 14, weeks: 1, delay: 0 },
  { name: 'Level 2 furniture', storey: 'Level 2', classes: ['IFCFURNISHINGELEMENT'], start: 15, weeks: 1, delay: 2 },
];

export const RULE =
  'Each built element of the Duplex (not spaces, openings, or spatial containers) belongs to one activity by storey and class; ' +
  'its planned week is the activity start plus floor(i × duration / n), i its rank by STEP id among the n elements of the activity; ' +
  'its actual week is the planned week plus the activity delay (Level 2 slabs +1; Level 2 walls and frame, the roof as a knock-on, ' +
  'and every later Level 2 and roof activity +2; Level 1 windows, doors, and coverings -1; everything else 0); ' +
  `an element is installed when its actual week is at most week ${THIS_WEEK}.`;

/** The events for every element of `elements` (the elements.json rows) that an activity installs. */
export const generateEvents = (elements: readonly Row[]): EventsFile => {
  const events: InstallEvent[] = [];
  for (const a of ACTIVITIES) {
    const members = elements
      .filter((e) => e.StoreyName === a.storey && a.classes.includes(String(e.Category)))
      .sort((x, y) => Number(x.StepId) - Number(y.StepId));
    members.forEach((e, i) => {
      const plannedWeek = a.start + Math.floor((i * a.weeks) / members.length);
      const actual = plannedWeek + a.delay;
      events.push({ globalId: String(e.GlobalId), activity: a.name, plannedWeek, actualWeek: actual <= THIS_WEEK ? actual : null });
    });
  }
  return { provenance: 'synthetic', rule: RULE, thisWeek: THIS_WEEK, events };
};
