# Construction sequence

A project manager's view of a construction schedule for the Duplex Apartment: a Gantt chart with the critical path outlined in red and an illustrative "today" line at week 12, a stacked area of how many model elements are built by the end of each week, and the 3D model coloured by the week each element is finished, with a week slider that ghosts what is not yet built.

- For: a project manager asking whether the finishing sequence is on the critical path, and what is built by which week.
- Answer on this schedule: yes. The project takes 24 weeks; 11 of its 14 activities are critical, and the chain runs up the structure, through the roof, then through windows and doors on Level 1 and Level 2, Level 2 coverings, and Level 2 furniture. Level 1 coverings and furniture, and the two roof windows, have one or two weeks of slack.
- Data: `/data/duplex/elements.json` (the real element list: class and storey of 218 built elements), `/models/duplex-federated.bos` (the 3D model, matched by STEP id), and `data/schedule.json` (**synthetic**).
- Run: `npm run demos` at the repository root, then `/demos/construction-sequence/`. Test: `npx vitest run --root packages/demos -t "demo construction-sequence"`.

## How the schedule is invented

The schedule is not from a real project. `schedule.ts` makes it from `elements.json` by this rule, and `main.test.ts` checks that `data/schedule.json` is exactly its output:

1. **What is built.** Every element except the project, site, building, storeys, spaces, and openings: 218 elements.
2. **Activities.** One per storey and trade that has elements. The trades, in building order, with the classes they build and one crew's rate:

   | Trade | IFC classes | Elements per week |
   |---|---|---|
   | Footings | IfcFooting | 4 |
   | Slabs and beams | IfcSlab, IfcBeam, IfcMember | 9 |
   | Walls and stairs | IfcWall, IfcWallStandardCase, IfcStair, IfcStairFlight | 10 |
   | Roof | IfcRoof, and slabs and walls on the Roof storey | 3 |
   | Windows and doors | IfcWindow, IfcDoor | 8 |
   | Coverings | IfcCovering, IfcRailing | 4 |
   | Furniture | IfcFurnishingElement | 30 |

   An activity lasts ceil(elements / rate) whole weeks. On T/FDN, "Walls and stairs" is the foundation walls.
3. **Precedence.**
   - Structure (footings, slabs and beams, walls and stairs, roof) goes up one activity at a time: storey by storey from T/FDN to the Roof.
   - Windows and doors on a storey wait for that storey's walls and for the roof (the building is dried in first).
   - Coverings on a storey follow its windows and doors; furniture follows its coverings.
   - Each finishing trade has one crew, which finishes the storey below before moving up.
4. **Timing.** The critical path method: a forward pass gives each activity's earliest start, a backward pass its latest finish; an activity with no slack is critical. Start and end are in weeks from day 0.
5. **Element weeks.** Within an activity, elements in STEP id order are spread evenly over its weeks; an element's week is the 1-based week by whose end it is finished.

Today's week is the middle of the schedule (week 12 of 24), chosen to show the "today" line; it is not a real status date.

To change the rule, edit `schedule.ts`, then rewrite the file with `npx vitest run --root packages/demos -t "demo construction-sequence" -u` and update the numbers in `main.test.ts`.

## Approximations

- Durations come from element counts, not quantities: a long wall and a short one count the same.
- The model's own storey assignment decides where an element is built; beams and members are built with the slab of their storey.
- Elements in the federated model that are not in the architectural extract (spaces, openings, and anything else without a schedule entry) are drawn as faint ghosts and never coloured.
