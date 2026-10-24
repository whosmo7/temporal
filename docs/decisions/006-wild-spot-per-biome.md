# 006 — Forest hunts, Island fishes

**Status:** decided 2026-10-24 by C (game design) · **Section:** `01` Q5

## Context
`01` asked whether Fish/Hunt should depend on the biome, or both be available everywhere.

## Options
1. One wild spot per map: Forest = hunting ground, Island = fishing spot.
2. Both spots on every map.

## Decision
Option 1. The action is `fishHunt` in both biomes, with the same cost and yield. Only the name, sprite and plot placement differ.
Forest's wild stock cap is 10, Island's is 8.

## Consequences
- One `wild` plot per map (`03`, `ids.md`), as already planned.
- Player-facing name is "Hunt" in Forest and "Fish" in Island (`docs/content/flavour-text.md`).
