# Room temperature on a summer day

For a facility manager deciding which rooms overheat in the afternoon and when it starts. Over the Duplex Apartment (buildingSMART, CC BY 4.0), with **synthetic** sensor readings.

- **Plans:** one per living storey (Level 1, Level 2), each room coloured by its reading at the chosen hour on one shared ramp (whole-degree range of every reading of the day), windows drawn as blue strokes. A room with no sensor is grey and labelled "no sensor". The hour slider above the plans redraws them for any hour; they open at 15:00.
- **Chart:** temperature over the day, one faint line per room, with the three hottest rooms at 15:00 in colour, and a dashed rule at 26 °C. The 26 °C limit is illustrative, not a cited standard.
- The caption names the three hottest rooms at 15:00, their reading, and the first hour each goes above 26 °C.

At the committed data, the hottest at 15:00 are B202 Bedroom 1 (27.4 °C, west windows, above 26 °C from 14:00), A102 Living Room (26.9 °C, south window), and A203 Bedroom 2 (26.5 °C, south windows).

## Where the numbers come from

| File | Provenance | What |
|---|---|---|
| `/data/duplex/elements.json` | model | spaces and windows with their storey |
| `/data/duplex/parameters.json` | model | each room's `Number` (Identity Data), since the two units reuse room names |
| `/data/duplex/bounds.json` | model | bounding boxes of rooms and windows |
| `data/readings.json` | synthetic | 24 hourly readings for each of 18 rooms, invented by the rule below |

Readings are keyed by the space's STEP id (`space`), with `hour` (0 to 23) and `celsius`.

### The rule (`rule.ts`)

For room *r* at hour *h*, rounded to 0.1 °C:

```
T = 22.5 + 2.5 cos(2π (h − 16) / 24)                       daily curve, 20.0 °C at 04:00, 25.0 °C at 16:00
  + Σ over facades 10 × (glazed m² on that facade ÷ room box m²) × max(0, 1 − |h − peak| / 4)
                                                             solar gain; peak 09:00 east, 13:00 south, 16:00 west; north none
  + 0.8 if the room is a bathroom or a utility room
  + 0.3 sin(0.7 × StepId + 1.3 × h)                          fixed per-room, per-hour wobble
```

No random numbers are used. Rooms A105 Stair (Level 1) and B205 Utility (Level 2) have no sensor and no readings: honest absence, not a zero.

Window exposure: a window belongs to the room on its storey whose box lies within 0.3 m across the wall and shares the most of the window's length; its glazed area is the window box's length along the wall times its height (frame included). The window box's thinner plan axis gives the wall direction, and the side of the room it sits on gives the facade, with model +y taken as north (the IFC's true-north angle is not applied). The two roof lights are on the Roof storey and are not counted.

Regenerate the file after changing the rule, from the repository root:

```
npx vite-node packages/demos/demos/room-temperature/generate.ts
```

`main.test.ts` fails when `data/readings.json` differs from what the rule produces.

## Approximations

- Readings are synthetic, by the rule above.
- Rooms are axis-aligned bounding boxes, not outlines; window-to-room assignment and room areas use the boxes.
- North is model +y.

## Run

`npm run demos` at the repository root, then open `/demos/room-temperature/`. Test: `npx vitest run --root packages/demos -t "demo room-temperature"`.
