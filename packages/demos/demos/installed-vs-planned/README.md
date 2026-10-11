# Installed vs planned

A site superintendent's weekly status on the Duplex Apartment: how many elements are in against the plan, per storey, and where the job is behind. Three views:

1. An S-curve: cumulative planned and cumulative installed elements per week, with a dashed rule at this week (week 9). The installed line stops at week 9, because later weeks have not happened.
2. A grouped bar per storey: elements planned to date beside elements installed, labelled with the shortfall ("14 behind") or the lead ("10 ahead").
3. The federated 3D model, faded to 20%, with installed elements green, elements installed ahead of plan ochre, and late elements (due by week 9, not in) red; elements not yet due stay faded.

At week 9, 96 elements are installed against 106 planned to date; 10 of the 96 are Level 1 windows and doors fitted a week early. 20 are late: 14 Level 2 walls and beams and the 6 roof elements. Level 2 is the storey furthest behind.

- For: a site superintendent preparing the weekly progress meeting.
- Data: `/data/duplex/elements.json` (the model's 218 built elements: footings, slabs, walls, beams, members, stairs, railings, the roof, windows, doors, coverings, furniture; spaces, openings, and spatial containers are not installed and are left out) and `data/events.json` (synthetic). The 3D view is `/models/duplex-federated.bos`; every element matches it by STEP id.
- Run: `npm run demos` at the repository root, then `/demos/installed-vs-planned/`. Test: `npx vitest run --root packages/demos -t "demo installed-vs-planned"`.

## How the events were invented

`data/events.json` is synthetic. The element list, classes, and storeys are the model's; the weeks are not. `schedule.ts` holds the rule, and `main.test.ts` regenerates the file from it and fails when the two differ.

1. Each built element belongs to one activity by storey and class. The plan runs over 15 weeks in build order:

   | Week | Activity | Delay |
   |---|---|---|
   | 1 | Footings (T/FDN) | 0 |
   | 2 | Foundation walls (T/FDN) | 0 |
   | 3 | Level 1 slabs | 0 |
   | 4 to 5 | Level 1 walls and frame (walls, beams, members) | 0 |
   | 6 | Level 2 slabs | +1 |
   | 7 to 8 | Level 2 walls and frame | +2 |
   | 9 | Roof (slab, roof, parapet walls) | +2, waiting on the Level 2 walls |
   | 9 | Level 1 stairs and railings | 0 |
   | 10 | Level 1 windows and doors | -1 |
   | 11 | Level 2 windows and doors; roof windows | +2 |
   | 12 | Level 1 coverings | -1 |
   | 13 | Level 2 coverings | +2 |
   | 14 | Level 1 furniture | 0 |
   | 15 | Level 2 furniture | +2 |

2. Within an activity the n elements, ranked by STEP id, are spread evenly over its weeks: planned week = start + floor(i × weeks / n).
3. Actual week = planned week + the activity's delay. An element is installed when its actual week is at most week 9; otherwise its actual week is null.

States: **installed** (due by week 9 and in), **ahead** (in, though planned after week 9), **late** (due by week 9, not in), **not due** (planned after week 9, not in).
