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

## Spec

### Layers

1. **Terrain layer**: grass, dirt, sand, water (sea/pond), path.
2. **Boundary layer**: dense trees (Forest) or shoreline + sea (Island). It can't be walked through, and it frames the map.
3. **Decoration layer**: rocks, bushes, flowers, chosen by the seed. Purely visual and walkable around.
4. **Plot layer**: fixed sites placed by the seeded generator inside the boundary, always reachable by path.
5. **Collision grid**: derived from layers 1–4 for WASD movement.

### Generation outline

```
rng = prng(seed)
biome = seed-derived or chosen ('forest' | 'island')
mask = radial falloff + noise(seed) → inside/outside boundary
  Forest: outside = tree tiles (2–3 tiles deep)
  Island: outside = sand ring → sea
place plots via rng on a coarse grid inside mask, with min spacing:
  fields ×N, orchard plot ×1, reservoir ×1 (near water/low ground), well site ×1,
  wild spot ×1 (Island: shoreline/pier; Forest: tree edge), lectern ×1 (near spawn), graveyard ×1
carve paths spawn → each plot (BFS on grid) so everything is reachable
scatter decoration avoiding paths/plots
```

Use a small value-noise or simplex implementation seeded by our PRNG (no global randomness).

### Starter state (Gen 1), all `[PLACEHOLDER]`

| | Forest | Island |
|---|---|---|
| Food | 20 | 20 |
| Water | 18 | 22 |
| Reservoir | cracked (wear 3) | cracked (wear 3) |
| Wild stock | 8 (cap 10) | 8 (cap 8), fish |
| Fields | empty | empty |
| Orchard plot | empty | empty |
| Well | not dug | not dug |
| Graveyard | empty (open: founders' stone?) | empty |

### Seeded events

Generated at world creation from the seed (event list stored in state, see `02`/`01`). The
generator places **at least one drought** so the reservoir decision always matters.

## Tasks

- [ ] **[B]** Seeded noise util (value noise is enough)
- [ ] **[B]** Boundary mask for Forest and Island
- [ ] **[B]** Plot placement with spacing + reachability guarantee (re-roll if unreachable)
- [ ] **[B]** Path carving (BFS/A*)
- [ ] **[B]** Decoration scatter
- [ ] **[B]** Collision grid export
- [ ] **[B]** Output a `TileMap` data structure: `{ width, height, layers: { terrain, boundary, deco }, plots: {id, x, y, w, h, kind}[], spawn }` with no Pixi dependency
- [ ] **[B]** Biome starter state + modifiers wired into `createWorld`
- [ ] **[B]** Seeded event list (≥1 drought)
- [ ] **[B]** Vitest: same seed → identical map; 1000 random seeds → all plots reachable, no overlaps
- [ ] **[B]** Debug page `/dev/worldgen?seed=123` that renders the map as coloured squares (needs `04` basic renderer). Useful for picking demo seeds.

## Acceptance

- Any seed gives a valid, fully reachable map for both biomes in < 50 ms.
- The map looks clearly Forest or Island at a glance once the tiles from `09` are applied.

## Open questions

1. Is biome picked randomly from the seed, or chosen 50/50 at assignment?
2. Number of fields (1, 2 or 3)?
3. Should Gen 1 include a "founders" gravestone/journal page for flavour, or start with an empty graveyard?
4. Exact map size: 32×32 including the boundary, or a 32×32 interior?
