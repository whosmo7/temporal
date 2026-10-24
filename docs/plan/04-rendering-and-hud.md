# 04 — World Rendering & In-Game UI (PixiJS + React)

**Owner:** Frontend/UI dev  
**Depends on:** `02` (`visibleView`, `applyAction`, `tick`), `03` (`TileMap`), `09` (assets).

## Decisions (locked)

- **PixiJS** draws the world. **React** draws the HUD, journal and menus as DOM overlays.
- **2D Stardew-style angle**, ~32×32 tiles, camera follows the player.
- **WASD/arrow** movement, desktop only.
- **Day/night** cycle across the turn.
- **Stardew-like HUD**: resource counters top-left, stamina bar, clock top-right, action hotbar bottom.
- **Strong visual world state**: the world never explains itself, so visuals carry all the information.
- **Partly hidden** pending effects: show growth stages, never numbers or due dates.

## Architecture

```
<GameScreen>
  ├─ <PixiStage>             // owns Pixi Application; mounts once
  │    ├─ TilemapLayer       // terrain/boundary/deco (static, cached as texture)
  │    ├─ PlotLayer          // plot sprites by visual stage
  │    ├─ ActorLayer         // player avatar, y-sorted with tall objects (trees)
  │    ├─ FxLayer            // particles: water splash, harvest pop, blight motes
  │    └─ LightingLayer      // day/night tint + night darkness overlay
  ├─ <Hud/>                  // React DOM overlay
  ├─ <InteractPrompt/>       // "E: Plant Orchard (25⚡ 5💧)" near a plot
  ├─ <FastTrackMenu/>        // list of pending effects (anyone's), no due dates
  └─ <JournalModal/> (05)    // opened from the lectern. The timer still runs during play (open: confirm)
```

- Keep game state in a small store (e.g. **Zustand**) that holds the engine `WorldState` + local action buffer. Pixi reads from the store every frame. React subscribes to the slices it needs.
- Use `@pixi/react` or a manual `useEffect` mount. **Recommendation:** manual mount for control and fewer version issues.
- Fixed-timestep game loop: movement at 60 fps, engine `tick(t)` at ~4 Hz for intra-turn effects.

### Built so far (`src/render/`)

- **`<PixiStage map>`** (`PixiStage.tsx`) owns one Pixi `Application`, which resizes to its container and uses `devicePixelRatio`,
  nearest-neighbour scaling and `roundPixels`. It's safe under StrictMode's double mount. `createWorldView(app, map)`
  (`world-view.ts`) builds the layers: **ground**, a single RenderTexture of terrain, ponds, sea and flowers; **flat**, for fields
  and the wild spot; and **sorted**, where trees, rocks, bushes, structures and the player are y-sorted by their bottom edge.
- **Camera** (`camera.ts`): zoom is the largest whole number of *device* pixels per art pixel that shows about 22×13 tiles,
  so it's 3× at 1280×720. The camera follows the player, clamps at the map edge, and centres maps that are smaller than the view.
- **Movement** (`movement.ts`, pure and tested): a fixed 60 Hz step, 4.5 tiles/s, and a hitbox at the feet against
  `buildCollision(map)`. Diagonal moves slide along walls. Walking uses a 4-direction, 4-frame animation.
- **Placeholder art** (`placeholder-art.ts`): code-drawn frames that already use the final frame names (`terrain/grass-1`,
  `boundary/tree-1`, `player/walk-down-0`, `<kind>/<stage>` …), so C's atlas replaces them by name. Plot frames are drawn at
  each plot's size, because presets can change plot sizes. `TILE = 16` in `constants.ts` until `09` picks a pack.
- **House cutaway** ([010](../decisions/010-player-house.md)): stepping into the doorway or the room fades out the roof and front
  wall over 0.35 s, dims the outside and zooms the camera onto the house (about 11×8 tiles in view, so 5× at 1280×720).
  Leaving reverses it. Turns start inside.
- **World look** (`WorldLook`): plot stages, the store stage (drawn by the cabinet), `weakened` and `drought`. `setLook()`
  re-textures plots without rebuilding the world. Weakened desaturates with an ochre cast. Drought bakes cracks into the ground
  and adds a warm tint.
- **Placeholder art** uses the art-direction palette, with 1 px ink outlines on objects.
- **`#/play?seed=123&biome=island&preset=small`** (`src/ui/screens/PlayScreen.tsx`) is a local hot-seat world for now. Plots
  show their founder stages until `visibleView()` (A) exists. Dev params: `look=healthy|neglected` previews the two
  acceptance worlds, and `fps=1` shows a frame-rate readout.
- **`#/dev/sprites`** shows every placeholder frame and plot stage at 3×, with frame names, for checking stages and atlas coverage.

## Interaction model

- Walk next to a plot and an **interact prompt** appears showing the valid action(s) and costs.
- `E` / `Space` does the default action. Number keys `1–8` pick a hotbar action when several are valid. Invalid actions are greyed out with a reason ("Not enough stamina").
- **Fast Track**: from a pending plot (e.g. a sapling), prompt "F: Fast Track (cost ×2)". The menu also lists every pending effect.
- **Harvesting/planting animations** are short (~0.5s) and **use real turn time**, so walking and acting cost time.

## Visual state mapping (what the successor "reads")

| Thing | Healthy | Warning | Bad |
|---|---|---|---|
| Field | green rows / golden ripe | wilting | brown rot, flies |
| Orchard | sapling → young → fruiting tree | fewer fruit, yellow leaves (wear 2) | dead stump (wear 3) |
| Reservoir | full blue, intact wall | lower water, hairline cracks | cracked dry bed |
| Well | clear water sparkle | — | green murky water (stagnant) |
| Wild spot | many fish/deer sprites | few | empty |
| Food store | full crate/granary sprite | half | nearly empty, flies (rot) |
| Weakened start | — | — | desaturated filter + slow player walk + blight motes |
| Drought (event) | — | — | cracked ground tiles, yellow tint, no rain |

These visuals should be enough to inherit the world without reading anything. No text explains causes.

## HUD

- **Top-left:** Food 🍎 / Water 💧 counts (current, **numeric**. Resources are visible, pending effects aren't).
- **Stamina bar** under the resources.
- **Top-right:** clock / sun-moon dial + seconds left. Tint shifts with day/night.
- **Bottom:** hotbar with 8 action icons + key hints.
- **Generation badge:** "Generation 3 of 5" + world name/seed.
- **Upkeep reminder:** a small "Needed by nightfall: 12🍎 10💧", always shown ([002](../decisions/002-upkeep-timing.md)).
- **Stamina can rise mid-turn** when the player uses Harvest and eat ([003](../decisions/003-eating-via-harvest.md)).

## Day/night

- `t / turnSeconds` maps to the time of day. Dawn at 0%, noon at 40%, dusk at 80%, night at 95–100%.
- `ColorMatrixFilter` or a tinted overlay. Night darkens around the player (soft radial light).
- At 100%: freeze → `05` end flow.

## Tasks

- [x] **[B]** Pixi app mount/unmount inside React. Handle resize and devicePixelRatio. Use nearest-neighbour scaling for pixel art.
- [x] **[B]** Tilemap renderer from `03` `TileMap`, cached to a RenderTexture
- [x] **[B]** Camera follow + clamp to map bounds
- [x] **[B]** Player avatar: 4-direction walk animation, collision against the grid
- [x] **[B]** Y-sorting for trees/structures vs the player
- [ ] **[B]** Plot sprites driven by `visibleView()` stages *(the renderer side is done: `WorldView.setLook()` takes stages per plot. It waits on A's `visibleView()`)*
- [ ] **[B]** Interact prompt + key handling + hotbar
- [ ] **[B]** Wire actions → engine `applyAction` → store → re-render. Show an invalid-action reason.
- [ ] **[B]** Fast Track menu (lists pending effects, with the originating player's name, no due dates)
- [ ] **[B]** Day/night lighting + timer
- [ ] **[B]** Freeze at time-up (lock input, dim world) → hand off to the `05` flow
- [ ] **[B]** Visual-state variants for all rows in the table above *(placeholder frames exist for every plot, store and grave stage, plus the weakened and drought filters. Still to do: the weakened slow walk and blight motes, which come with FX)*
- [ ] **[B]** FX: harvest pop, splash, rot flies, blight motes
- [ ] **[B]** HUD components (React) styled to match the pixel art
- [ ] **[B]** Graveyard rendering: one stone per gravestone record, hover shows the name, click opens the journal page (`05`)
- [ ] **[B]** Lectern: interact opens the journal
- [x] **[B]** Perf check: 60 fps on a mid laptop at 32×32 *(held the browser's 60 fps ceiling at 32×32 and 40×40 with filters on, in headless Firefox on a dev machine. Add `&fps=1` to `#/play` to check on other laptops)*

## Acceptance

- A player can walk around, do all 8 actions, watch day turn to night, and hit freeze, in a local hot-seat build.
- A teammate shown screenshots of two worlds (healthy vs neglected) can tell which is which and name what's wrong, without any text.

## Open questions

1. Does the turn timer **keep running** while the journal is open during play? ("Openable any time" vs "time freezes only at end".)
2. Show numeric Food/Water counts, or only diegetic visuals (crate fill, reservoir level)? The current decision is the Stardew-like HUD with counters.
3. Can the player sprint (more stamina, less time)?
