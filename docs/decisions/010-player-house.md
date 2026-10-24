# 010: The player's house

**Status:** accepted (B, 2026-10-24) · **Adds to:** `03` worldgen, `04` rendering · **Leaves open:** what the oven does (C, A)

## Context

We wanted a home in each world: a small Pokémon-style house the player starts in, with an oven and a cabinet inside.
Entering should zoom in and lift the roof, so you see the room in place rather than loading a separate scene.

## Decision

- **Shape:** a 7×5 footprint (wider than tall), with 1-tile walls round a 5×3 room. The door is in the middle of the
  bottom wall. The house is always 7×5, so its art and room layout are fixed.
- **Room:** cabinet and oven against the back wall, then shelf and plant, a bed on the right, a table bottom-left, and a
  rug in front of the door. The tiles in front of the oven and cabinet stay free. Furniture blocks movement except the rug.
- **Worldgen:** the house is placed first, after the boundary and before ponds, within `houseRange` (4) of the map centre
  (or `spawn`). Ponds, deco and plots keep clear of it. Paths start from the tile in front of the door, and the lectern
  goes near the door. `pin.house` fixes the house, and `house: false` turns it off. It's stored in `TileMap.house`, not
  in `plots`, because it isn't something you act on.
- **Spawn:** each turn starts inside, just above the door.
- **Rendering:** stepping into the doorway or the room fades out the roof and front wall, dims everything outside, and
  zooms the camera in onto the house (3× → about 5× at 1280×720). Leaving reverses it.
- **Oven:** furniture only for now. The cabinet is the food store ([011](011-cabinet-food-store-no-rot.md)).

## Consequences

- `TileMap` gains `house: House | null`. **A:** the engine needn't model it, because nothing in it is an action yet.
- Plot sizes moved to the art direction's (orchard 2×2, reservoir 3×2, well 1×1), which changes every seed's layout.
  No worlds are live yet.
- **Open question for C and A:** should the oven do something? Options include cooking stored food for stamina (a
  ninth action, which changes the locked eight-action rule and decision 003), or making the oven where "Harvest and eat"
  happens.
