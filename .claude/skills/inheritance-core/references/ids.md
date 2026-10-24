# Canonical identifiers

Once `src/engine/types.ts` exists, it is the source of truth. Keep this file in sync with it in the
same PR as any change.

## Resources

| ID | Meaning | Carries between generations? |
|---|---|---|
| `food` | Stored food | Yes, minus rot |
| `water` | Stored water | Yes, minus stagnation |
| `stamina` | The player's energy for this turn | No, reset each turn (reduced if weakened) |

## Actions (`ActionType`)

| ID | Player-facing name | Target |
|---|---|---|
| `harvest` | Harvest | ripe `field` or fruiting `orchard` |
| `plantCrops` | Plant Crops | empty `field` |
| `plantOrchard` | Plant Orchard | empty `orchard` |
| `repairReservoir` | Repair Reservoir | `reservoir` |
| `digWell` | Dig Well | undug `well` |
| `fishHunt` | Fish (Island) / Hunt (Forest) | `wild` |
| `maintain` | Maintain | `well`, `reservoir` or `orchard` |
| `fastTrack` | Fast Track | a pending `ScheduledEffect` (anyone's) |

## Plot kinds and plot IDs

| Kind | ID pattern | Count |
|---|---|---|
| `field` | `field-1`, `field-2`, … | open question (1–3) |
| `orchard` | `orchard-1` | 1 |
| `reservoir` | `reservoir` | 1 |
| `well` | `well` | 1 |
| `wild` | `wild` | 1 |
| `lectern` | `lectern` | 1 |
| `graveyard` | `graveyard` | 1 |

## Visual stages (from `visibleView()`; also sprite frame names)

Sprite frames are named `<kind>/<stage>`, e.g. `orchard/fruiting`, `well/stagnant`.

| Kind | Stages |
|---|---|
| `field` | `empty`, `sown`, `growing`, `ripe`, `rotten` |
| `orchard` | `empty`, `sapling`, `young`, `fruiting`, `worn`, `dead` |
| `reservoir` | `cracked`, `low`, `full` |
| `well` | `none`, `clear`, `stagnant` |
| `wild` | `many`, `few`, `none` |
| `store` (food store sprite) | `full`, `half`, `empty`, `rotting` |

World-level visual flags: `weakened` (blight filter), `drought` (cracked-ground overlay), plus
`timeOfDay` from 0 to 1.

## Causes (`Cause.kind`)

| Kind | Fields | Example |
|---|---|---|
| `action` | `actionId`, `actorId`, `committedTurn` | Orchard planted by AL in gen 1 |
| `event` | `eventId` | Drought in gen 3 |
| `rule` | `rule` | one of the rules below |

Rules: `foodRot`, `waterStagnate`, `wear`, `upkeep`, `regrow`, `weakened`, `income`.

## Events (`SeededEvent.kind`)

`drought`, `goodHarvest`, `storm` (Island only). The final list is an open question in `01`.

## Effect kinds (`ScheduledEffect.kind`)

`cropRipe`, `orchardMature`, `orchardYield`, `reservoirRepaired`, `wellIncome`.
Status: `pending`, `resolved`, `cancelled`, `fastTracked`.

## Time

`TimePoint = { turn: number; t?: number }`. `turn` is the generation index starting at 1; `t` is
seconds into the turn. "Due in 2 generations" means `dueAt.turn = committedAt.turn + 2`.

## Source layout

```
src/engine/    pure TS sim (no DOM)      src/render/  Pixi layers
src/worldgen/  pure TS map gen           src/ui/      React screens/components
src/store/     Zustand                   src/api/     Backend interface + Supabase/Local
src/audio/     Howler wrapper            scripts/     simulate.ts, seed-demo.ts
supabase/migrations/   supabase/functions/commit-turn/
public/assets/ atlases, audio, fonts     ASSETS.md    licences
```

## Branches, commits, labels

- Branch: `feat/<area>-<thing>` or `fix/<area>-<thing>`. Area is one of the labels below.
- Commit: `<type>(<area>): <summary>`, e.g. `feat(engine): schedule orchard maturity`.
- Labels: `design`, `engine`, `worldgen`, `render`, `journal`, `replay`, `backend`, `shell`, `art`, `audio`, `demo`, `infra`.
