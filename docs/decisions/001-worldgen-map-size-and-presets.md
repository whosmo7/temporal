# 001: Map size, field count and map presets

**Status:** accepted (B, 2026-10-24) · **Settles:** `03` open questions 2 and 4

## Context

`03` left two questions open: how big the map is (32×32 including the boundary, or a 32×32
interior) and how many fields there are (1, 2 or 3). We also want to make specific worlds
on purpose, such as a demo world with the reservoir in a known place, or a smaller map for a quick playtest,
without changing generator code.

## Options

1. Fix one size and one field count in code. This is simplest, but every change needs a code change and a
   rebalance by hand.
2. Make every generator knob an option, with named **presets** that override any subset, and
   let a preset **pin** plots to exact tiles.

## Decision

Option 2.

- `generateMap(seed, biome, preset)` takes a preset name or any partial `WorldgenOptions`
  (`src/worldgen/options.ts`). Named presets live in `src/worldgen/presets.ts`.
- **Map size** is `width` × `height` (independent, 16–128). The default is **32×32 including the boundary**,
  which leaves a farmable interior of roughly 26×26 for Forest and 22×22 for Island. That keeps walks short in a timed turn.
- **Fields:** `fields` (1–9), default **2**. Field count is a game-design number, so C may change the
  default. It's one value in `BASE_OPTIONS`.
- **Pins:** `pin: { <plotId>: { x, y } }` fixes a plot's top-left tile. Pinned plots skip the kind rules,
  ponds avoid them, and invalid pins throw `WorldgenError`.

## Consequences

- A world must store which preset it was generated with (or the resolved options) next to its seed, or
  the map can't be rebuilt. `createWorld` (A) and the `worlds` table (A) need a `preset` field. Until then
  everything uses `default`.
- Changing a preset's values changes every world that uses it. Treat shipped presets as append-only:
  add a new name rather than editing one that live worlds use.
- The renderer (`04`) and camera can't assume 32×32. They have to read `map.width` and `map.height`.
