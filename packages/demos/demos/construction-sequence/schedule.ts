// The rule that invents this demo's construction schedule from the Duplex
// element list. Deterministic: the same elements.json gives the same
// data/schedule.json, and main.test.ts checks that it does. The README
// states the rule in words; this file is the rule.

import type { Row } from '../../src/chart';

/** Storeys from the ground up, as they appear in elements.json. */
export const STOREYS = ['T/FDN', 'Level 1', 'Level 2', 'Roof'] as const;

/** One trade: the IFC classes it builds and how many of them one crew finishes in a week. */
interface Trade {
  readonly name: string;
  readonly classes: readonly string[];
  readonly perWeek: number;
}

/** The trades in the order a building goes up; the Gantt colours by these names. */
export const TRADES: readonly Trade[] = [
  { name: 'Footings', classes: ['IFCFOOTING'], perWeek: 4 },
  { name: 'Slabs and beams', classes: ['IFCSLAB', 'IFCBEAM', 'IFCMEMBER'], perWeek: 9 },
  { name: 'Walls and stairs', classes: ['IFCWALL', 'IFCWALLSTANDARDCASE', 'IFCSTAIR', 'IFCSTAIRFLIGHT'], perWeek: 10 },
  { name: 'Roof', classes: ['IFCROOF'], perWeek: 3 },
  { name: 'Windows and doors', classes: ['IFCWINDOW', 'IFCDOOR'], perWeek: 8 },
  { name: 'Coverings', classes: ['IFCCOVERING', 'IFCRAILING'], perWeek: 4 },
  { name: 'Furniture', classes: ['IFCFURNISHINGELEMENT'], perWeek: 30 },
];

/** Trades that carry the building's structure, built storey after storey. */
const STRUCTURE = new Set(['Footings', 'Slabs and beams', 'Walls and stairs', 'Roof']);
/** Trades that need the envelope closed; one crew each, moving up a storey at a time. */
const FINISHING = ['Windows and doors', 'Coverings', 'Furniture'];

/** Classes that are not built: spatial structure, voids, and rooms. */
export const NOT_BUILT = new Set([
  'IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCSPACE', 'IFCOPENINGELEMENT',
]);

export interface Activity {
  /** Short stable id, such as "Level 2/Coverings". */
  readonly id: string;
  readonly storey: string;
  readonly trade: string;
  readonly elements: number;
  /** Weeks elapsed before work starts (0 is the first day). */
  readonly start: number;
  /** start + duration: the week by whose end the activity is done. */
  readonly end: number;
  readonly predecessors: readonly string[];
  /** On the longest chain: no slack between this activity and the project's end. */
  readonly critical: boolean;
}

export interface BuiltElement {
  readonly stepId: number;
  readonly activity: string;
  /** The week (1-based) whose end the element is finished by. */
  readonly week: number;
}

export interface Schedule {
  readonly weeks: number;
  readonly activities: readonly Activity[];
  readonly elements: readonly BuiltElement[];
}

/** The trade that builds `category` on `storey`; undefined for a class no trade builds. */
export const tradeOf = (category: string, storey: string): string | undefined => {
  // On the Roof storey, slabs and walls (deck and parapets) are part of the roof.
  if (storey === 'Roof' && ['IFCSLAB', 'IFCWALL', 'IFCWALLSTANDARDCASE'].includes(category)) return 'Roof';
  return TRADES.find((t) => t.classes.includes(category))?.name;
};

const activityId = (storey: string, trade: string) => `${storey}/${trade}`;

/**
 * Builds the schedule: one activity per storey and trade that has elements,
 * lasting ceil(elements / perWeek) weeks, linked by the precedence rule in
 * `predecessorsOf`, timed by the critical path method (forward and backward
 * pass), and each element given a week inside its activity.
 * Throws when a built element has no storey or no trade, so nothing is dropped silently.
 */
export const buildSchedule = (elements: readonly Row[]): Schedule => {
  const built = elements.filter((e) => !NOT_BUILT.has(String(e.Category)));
  const groups = new Map<string, Row[]>();
  for (const e of built) {
    const storey = e.StoreyName === null ? undefined : String(e.StoreyName);
    const trade = storey === undefined ? undefined : tradeOf(String(e.Category), storey);
    if (storey === undefined || trade === undefined) throw new Error(`no activity for ${String(e.Category)} #${String(e.StepId)} on ${String(e.StoreyName)}`);
    const id = activityId(storey, trade);
    groups.set(id, [...(groups.get(id) ?? []), e]);
  }

  // Activities in building order: storey from the ground up, then trade order.
  const ordered = STOREYS.flatMap((s) => TRADES.map((t) => ({ storey: s, trade: t })))
    .filter(({ storey, trade }) => groups.has(activityId(storey, trade.name)));
  const ids = new Set(ordered.map(({ storey, trade }) => activityId(storey, trade.name)));
  const structureChain = ordered.filter(({ trade }) => STRUCTURE.has(trade.name)).map(({ storey, trade }) => activityId(storey, trade.name));

  const predecessorsOf = (storey: string, trade: string): string[] => {
    const id = activityId(storey, trade);
    if (STRUCTURE.has(trade)) {
      // Structure goes up one activity at a time.
      const i = structureChain.indexOf(id);
      return i > 0 ? [structureChain[i - 1]!] : [];
    }
    const below = STOREYS[STOREYS.indexOf(storey as (typeof STOREYS)[number]) - 1];
    const candidates = [
      // The same finishing crew finishes the storey below first.
      ...(below ? [activityId(below, trade)] : []),
      ...(trade === 'Windows and doors'
        ? // Dry-in: the storey's walls and the roof are up before windows and doors go in.
          [activityId(storey, 'Walls and stairs'), structureChain[structureChain.length - 1]!]
        : // Coverings follow windows and doors on the storey; furniture follows coverings.
          [activityId(storey, FINISHING[FINISHING.indexOf(trade) - 1]!)]),
    ];
    return [...new Set(candidates.filter((c) => ids.has(c) && c !== id))];
  };

  const nodes = ordered.map(({ storey, trade }) => {
    const id = activityId(storey, trade.name);
    const count = groups.get(id)!.length;
    return { id, storey, trade: trade.name, elements: count, duration: Math.ceil(count / trade.perWeek), predecessors: predecessorsOf(storey, trade.name) };
  });

  // Building order is not a topological order (Level 1 windows wait for the
  // roof), so both passes recurse over the links, remembering each answer.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const memo = <T>(f: (id: string) => T): ((id: string) => T) => {
    const seen = new Map<string, T>();
    return (id) => {
      if (!seen.has(id)) seen.set(id, f(id));
      return seen.get(id)!;
    };
  };
  // Forward pass: an activity starts when its last predecessor ends.
  const earlyStart: (id: string) => number = memo((id) =>
    Math.max(0, ...byId.get(id)!.predecessors.map((p) => earlyStart(p) + byId.get(p)!.duration)),
  );
  const early = new Map(nodes.map((n) => [n.id, { start: earlyStart(n.id), end: earlyStart(n.id) + n.duration }]));
  const weeks = Math.max(...[...early.values()].map((t) => t.end));

  // Backward pass: the latest finish that keeps the project at `weeks`.
  const lateFinish: (id: string) => number = memo((id) =>
    Math.min(weeks, ...nodes.filter((m) => m.predecessors.includes(id)).map((m) => lateFinish(m.id) - m.duration)),
  );

  const activities: Activity[] = nodes.map((n) => ({
    id: n.id,
    storey: n.storey,
    trade: n.trade,
    elements: n.elements,
    start: early.get(n.id)!.start,
    end: early.get(n.id)!.end,
    predecessors: n.predecessors,
    critical: lateFinish(n.id) === early.get(n.id)!.end,
  }));

  // Within an activity, elements in STEP id order are spread evenly over its weeks.
  const builtElements = activities.flatMap((a) => {
    const members = [...groups.get(a.id)!].sort((x, y) => Number(x.StepId) - Number(y.StepId));
    const duration = a.end - a.start;
    return members.map((e, i) => ({
      stepId: Number(e.StepId),
      activity: a.id,
      week: a.start + 1 + Math.floor((i * duration) / members.length),
    }));
  });

  return { weeks, activities, elements: builtElements.sort((x, y) => x.stepId - y.stepId) };
};

/** The schedule as JSON text with one activity or element per line, for data/schedule.json. */
export const scheduleJson = (s: Schedule): string => {
  const list = (items: readonly unknown[]) => items.map((x) => `    ${JSON.stringify(x)}`).join(',\n');
  return [
    '{',
    `  "generatedBy": "schedule.ts buildSchedule over /data/duplex/elements.json; the rule is in README.md",`,
    `  "weeks": ${s.weeks},`,
    '  "activities": [',
    list(s.activities),
    '  ],',
    '  "elements": [',
    list(s.elements),
    '  ]',
    '}',
    '',
  ].join('\n');
};
