# Canonical identifiers

Once `src/engine/types.ts` exists, it is the source of truth. Keep this file in sync with it in the
same PR as any change.

## Resources

| ID | Meaning | Carries between generations? |
|---|---|---|
| `food` | Stored food | Yes, minus rot |
| `water` | Stored water | Yes, minus stagnation |
| `stamina` | The player's energy for this turn | No, reset each turn (reduced if weakened) |
| `hunger` | How fed the family is, 0..100; eating refills it (decision 016) | Yes, minus 30 at each new generation |

## Actions (`ActionType`)

| ID | Player-facing name | Target |
|---|---|---|
| `harvest` | Harvest / Harvest and eat (`eat: true`, decision 003) | ripe `field` or fruiting `orchard` |
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
| `field` | `field-1`, `field-2`, … | configurable, default 2 (decision 001) |
| `orchard` | `orchard-1` | 1 |
| `reservoir` | `reservoir` | 1 |
| `well` | `well` | 1 |
| `wild` | `wild` | 1 |
| `lectern` | `lectern` | 1 |
| `graveyard` | `graveyard` | 1 |

**Tiles (decision 019).** Fields and orchards are worked one tile at a time, so in the engine (`WorldState.plots`,
`visibleView().plots`, actions' `plotId`, causes) each of their tiles is a plot of its own: `<plot>:<x>,<y>`, with
`x`, `y` counted from the plot's top-left tile, e.g. `field-1:2,0`, `orchard-1:1,1`. Its `tile` field says
`{ plot, x, y }`. The map (`TileMap.plots`) keeps the whole `field-1` and `orchard-1` for layout and collision.
Helpers: `tileId`, `tileOf`, `mapPlotOf`, `TILED_KINDS` in `src/engine/tiles.ts`.

## Tiles (`TileMap` layers, `src/worldgen/types.ts`)

The atlas needs a frame (or autotile set) for each of these.

| Layer | IDs | Notes |
|---|---|---|
| `terrain` | `grass`, `dirt`, `sand`, `water`, `path` | `water` = pond inside the boundary (blocks). Under the Island sea it's `water`, and under Forest trees it's `grass`. Field plots are painted `dirt` |
| `boundary` | `tree`, `sea`, or `null` | Frames the map and always blocks. `tree` is Forest, `sea` is Island |
| `deco` | `rock`, `bush`, `flower`, or `null` | `rock` and `bush` block, `flower` doesn't |

## House (`TileMap.house`, decision 010)

7×5 footprint, a 5×3 room and the door in the middle of the bottom wall. Furniture (`FurnitureKind`): `oven`, `cabinet`,
`bed`, `table`, `shelf`, `plant`, `rug`. Only the `rug` is walkable. The cabinet is drawn with `store/<stage>`.
Frames: `house/exterior` (roof and front wall, faded out while you're inside), `house/interior` (floor and walls),
`furniture/<kind>`, `store/<stage>`. Drought overlay: `terrain/cracks-1`.

## Visual stages (from `visibleView()`; also sprite frame names)

Sprite frames are named `<kind>/<stage>`, e.g. `orchard/fruiting`, `well/stagnant`. A frame can also carry the
biome, `<kind>/<stage>-<biome>`, which the renderer tries first: the wild spot uses it (`wild/many-forest` is game
in tall grass, `wild/many-island` fish in a pool).

| Kind | Stages |
|---|---|
| `field` | `empty`, `sown`, `growing`, `ripe`, `rotten` |
| `orchard` | `empty`, `sapling`, `young`, `fruiting`, `worn`, `dead` (per tree; one-tile frames `orchard/tree-<stage>`) |
| `reservoir` | `cracked`, `low`, `full` |
| `well` | `none`, `clear`, `stagnant` |
| `wild` | `many`, `few`, `none` |
| `store` (the house cabinet, i.e. the food store) | `full`, `half`, `empty`, `rotting` |
| `lectern`, `graveyard` | `default` (they always look the same) |

World-level visual flags: `weakened` (blight filter), `drought` (cracked-ground overlay), `hungry` (slow walk), plus
`timeOfDay` from 0 to 1.

## UI icons and sounds (C's atlases, `09`)

- **Icons** (`src/ui/kit/ui-atlas.json`, `<PixelIcon>`): `ui/icon-food`, `ui/icon-water`, `ui/icon-stamina`,
  `ui/icon-<ActionType>` (e.g. `ui/icon-plantOrchard`), except Fish/Hunt, which is per biome:
  `ui/icon-fishHunt-island`, `ui/icon-fishHunt-forest`. Clock: `ui/icon-day`, `ui/icon-night` (24 px).
- **Sounds** (`src/audio/sfx-sprite.json`, `playSfx()`): every `ActionType` (Fish/Hunt as `fishHunt-island` and
  `fishHunt-forest`), plus `deny`, `ui-click`, `tick`, `bell`, `page`, `pen`, `seal`, `stone`, `footstep-1`,
  `footstep-2`. Music (`playMusic()`): `day`, `dusk`, `reflective`.

## Causes (`Cause.kind`)

| Kind | Fields | Example |
|---|---|---|
| `action` | `actionId`, `actorId`, `committedTurn` | Orchard planted by AL in gen 1 |
| `event` | `eventId` | Drought in gen 3 |
| `rule` | `rule` | one of the rules below |

Rules: `foodRot`, `waterStagnate`, `wear`, `upkeep`, `regrow`, `weakened`, `income`, `newTurn`
(stamina refilled at the start of a generation), `hunger` (the drop at the start of a generation).

## Events (`SeededEvent.kind`)

`drought`, `goodHarvest`, `storm` (Island only), from decision 005. The drought timing comes from decision 008.

`SeededEvent = { id, kind, turn, spellId? }`, with one entry per event per generation (`src/worldgen/events.ts`). The ID is `<kind>-<turn>`,
e.g. `drought-4`. Every generation of a multi-generation drought shares the same `spellId` (`drought-<startTurn>`).

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
