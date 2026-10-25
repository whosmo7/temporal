# 03 — World Generation: Seeds, Biomes, Plots

**Owner:** Engine dev (with Art for tile mapping)  
**Depends on:** `02` PRNG. Consumed by `04` (rendering) and `02` (`createWorld`).

## Decisions (locked)

- Every world comes from a **seed**. The same seed always gives the same world.
- **~32×32 tile** map, Stardew-style ¾ top-down.
- A natural **boundary** encloses the farmable area. Hackathon biomes: **Forest** (tree ring) and **Island** (sea).
- **Pre-defined plots** for every action (no free placement).
- **Small modifiers** per biome (see `01`).
- New worlds start from a **seeded starter state**.
- **Map size is configurable** through presets. The default is **32×32 including the boundary** ([001](../decisions/001-worldgen-map-size-and-presets.md)).
- The **number of fields is configurable** through presets. The default is **2** ([001](../decisions/001-worldgen-map-size-and-presets.md)).
- **Map presets**: every generator knob can be overridden by a named preset in `src/worldgen/presets.ts`, and plots can be pinned to exact tiles ([001](../decisions/001-worldgen-map-size-and-presets.md)).

## Spec

### Layers

1. **Terrain layer**: grass, dirt, sand, water (sea/pond), path.
2. **Boundary layer**: dense trees (Forest) or shoreline + sea (Island). It can't be walked through, and it frames the map.
3. **Decoration layer**: rocks, bushes, flowers, chosen by the seed. Purely visual and walkable around.
4. **Plot layer**: fixed sites placed by the seeded generator inside the boundary, always reachable by path.
5. **Collision grid**: derived from layers 1–4 for WASD movement.

### Built (`src/worldgen/`)

```ts
generateMap(seed: number, biome: Biome, preset?: PresetName | WorldgenPreset): TileMap
buildCollision(map): Uint8Array        // 1 = blocked, indexed y * width + x
biomeFromSeed(seed): Biome             // for callers that want a seed-derived biome (open question 1)
```

- **`TileMap`** (`types.ts`): `{ width, height, biome, seed, layers: { terrain, boundary, deco }, plots: { id, kind, x, y, w, h }[], house, spawn }`.
  Layers are flat row-major arrays (`y * width + x`) of tile IDs (see `ids.md` › Tiles). It is plain data with no Pixi.
- **Presets** (`presets.ts`, `options.ts`): a preset is a partial `WorldgenOptions` merged over `BASE_OPTIONS` and then the
  biome defaults. The knobs are size, boundary depth, corner radius, beach width, field count, plot sizes, plot spacing,
  pond coverage, dirt amount, deco density and weights, path wiggle, lectern range, spawn clearance, spawn, `house`, `houseRange`, `pin` and `maxAttempts`.
  Default plot sizes come from the art direction: field 3×3, orchard 2×2, reservoir 3×2, well 1×1, wild 2×2, lectern 1×1 and graveyard 4×3.
  The orchard holds one tree per tile ([019](../decisions/019-per-tile-actions-take-time.md)), so it may be at most 2 tiles
  thick in one direction, and a layout is retried until every tree has a side the player can walk to.
  The built-in presets are `default`, `small`, `large`, `wide` and `bare`.
  Preview one with `npm run worldgen -- --seed 123 --biome island --preset small`.
- **Pinned plots** (`pin: { reservoir: { x, y } }`) are placed exactly and skip the kind rules (lectern range, wild-on-edge).
  Ponds keep off them, so a pinned preset works with any seed. A pin on the boundary, on spawn or overlapping another pin throws `WorldgenError`.
- **House** (`house.ts`, [010](../decisions/010-player-house.md)): a 7×5 house with a 5×3 room and the door in the middle of the bottom wall. Its furniture is the
  cabinet (the food store), oven, shelf, plant, bed, table and rug. It's placed right after the boundary, within `houseRange` of the
  map centre (or `spawn`), and before ponds, so nothing can block it. Paths start at the tile in front of the door, and the lectern
  goes near the door. The player spawns inside, just above the door. `pin.house` fixes the house and `house: false` turns it off.
- **Collision:** boundary, ponds, `rock`/`bush` deco and the solid plots (`orchard`, `reservoir`, `well`, `lectern`, `graveyard`) block movement.
  So do house walls (except the door) and furniture (except the rug).
  `field`, `wild` and `graveyard` are walkable.
- **Determinism:** each stage (plots, deco) has its own PRNG stream derived from `hash(seed, stage)`, so changing the
  deco density never moves plots.
- **Speed:** about 2–3 ms per 32×32 map, and under 10 ms for 40×40.
- **Events** (`events.ts`): `generateEvents(seed, biome, cfg)` returns the world's whole `SeededEvent[]`, one entry per
  event per generation, sorted by turn. A drought spanning several generations is several entries sharing a `spellId`.
  The drought rule is in [008](../decisions/008-drought-length-and-timing.md). Good harvest and storm follow [005](../decisions/005-seeded-events.md).
  The numbers (`droughtLengthFraction`, `droughtMaxLength`, `stormChance`) are passed in from `config.ts`.
- **Founder state** (`founder.ts`): `founderState(seed, biome, cfg, preset)` returns `{ map, resources, wildStock, wildCap, plots, events }`,
  where each plot starts at its `ids.md` stage (fields and orchard `empty`, reservoir `cracked`, well `none`).
  `createWorld` (A) builds `WorldState` from it. Until `config.ts` exists, `src/worldgen/__fixtures__/founder-config.ts` holds C's numbers.
- **Debug page:** `npm run dev:worldgen` opens `#/dev/worldgen?seed=123&biome=island&preset=small` (dev builds only). It's a canvas page
  that draws on a canvas, with controls for seed, biome, preset, generation count and JSON overrides. Its overlays are collision,
  walk distance and grid. It also lists the events, the founder state and the plots, and has a "Copy preset JSON" button for
  adding a new entry to `presets.ts`. `#/dev/sprites` shows every placeholder sprite.

### Generation outline

```
rng = prng(seed)
biome = seed-derived or chosen ('forest' | 'island')
mask = rounded-rect falloff + noise(seed) → inside/outside boundary (keep only the part connected to spawn)
ponds = lowest ground by elevation noise, up to pondCoverage of the interior
  Forest: outside = tree tiles (2–3 tiles deep)
  Island: outside = sand ring → sea
place plots via rng on a coarse grid inside mask, with min spacing:
  fields ×N, orchard plot ×1, reservoir ×1 (near water/low ground), well site ×1,
  wild spot ×1 (Island: shoreline/pier; Forest: tree edge), lectern ×1 (near spawn), graveyard ×1
carve paths spawn → each plot (Dijkstra with noise-weighted steps, branching off the existing network);
  if a plot has no spot or no path, re-roll placement with the next PRNG draws, up to maxAttempts, then throw
scatter decoration avoiding paths/plots
```

Use a small value-noise or simplex implementation seeded by our PRNG (no global randomness).

### Starter state (Gen 1), set by game design (`01` › Founder / Gen-1 starter conditions)

What the founder sees: `beginTurn` for gen 1 applies no decay, wear or income.

| | Forest | Island |
|---|---|---|
| Food | 12 | 12 |
| Water | 16 | 18 |
| Reservoir | cracked (not repaired) | cracked (not repaired) |
| Wild stock | 8 (cap 10), hunt | 8 (cap 8), fish |
| Fields | empty | empty |
| Orchard plot | empty | empty |
| Well | not dug | not dug |
| Graveyard | empty (open: founders' stone?) | empty |

### Seeded events

Generated at world creation from the seed (event list stored in state, see `02`/`01`). The
generator places **at least one drought** so the reservoir decision always matters (**off for now**: `droughts: false` seeds none, [030](../decisions/030-droughts-off.md)). Event set and timing: `01` › Seeded events
([005](../decisions/005-seeded-events.md)).

## Tasks

- [x] **[B]** Seeded noise util (value noise is enough)
- [x] **[B]** Boundary mask for Forest and Island
- [x] **[B]** Plot placement with spacing + reachability guarantee (re-roll if unreachable)
- [x] **[B]** Path carving (BFS/A*)
- [x] **[B]** Decoration scatter
- [x] **[B]** Collision grid export
- [x] **[B]** Output a `TileMap` data structure: `{ width, height, layers: { terrain, boundary, deco }, plots: {id, x, y, w, h, kind}[], spawn }` with no Pixi dependency
- [x] **[B]** Biome starter state + modifiers wired into `createWorld` *(A's `createWorld` builds gen 1 from `founderState()`: starter numbers, wild cap, founder stages and the biome-gated event list. `src/worldgen/__tests__/create-world.test.ts` checks the map, events and modifiers carry through.)*
- [x] **[B]** Seeded event list (≥1 drought)
- [x] **[B]** Vitest: same seed → identical map; 1000 random seeds → all plots reachable, no overlaps
- [x] **[B]** Debug page `/dev/worldgen?seed=123` that renders the map as coloured squares. Useful for picking demo seeds. *(Now `#/dev/worldgen`, drawn on a plain canvas, so it doesn't need `04`.)*

## Acceptance

- Any seed gives a valid, fully reachable map for both biomes in < 50 ms.
- The map looks clearly Forest or Island at a glance once the tiles from `09` are applied.

## Open questions

1. Is biome picked randomly from the seed, or chosen 50/50 at assignment? (Worldgen takes biome as an input, and `biomeFromSeed()` covers the first option.)
2. Should Gen 1 include a "founders" gravestone/journal page for flavour, or start with an empty graveyard?

(Field count and map size are settled in [001](../decisions/001-worldgen-map-size-and-presets.md). Both are preset options.)
