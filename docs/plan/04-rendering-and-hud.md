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

- [ ] **[B]** Pixi app mount/unmount inside React. Handle resize and devicePixelRatio. Use nearest-neighbour scaling for pixel art.
- [ ] **[B]** Tilemap renderer from `03` `TileMap`, cached to a RenderTexture
- [ ] **[B]** Camera follow + clamp to map bounds
- [ ] **[B]** Player avatar: 4-direction walk animation, collision against the grid
- [ ] **[B]** Y-sorting for trees/structures vs the player
- [ ] **[B]** Plot sprites driven by `visibleView()` stages
- [ ] **[B]** Interact prompt + key handling + hotbar
- [ ] **[B]** Wire actions → engine `applyAction` → store → re-render. Show an invalid-action reason.
- [ ] **[B]** Fast Track menu (lists pending effects, with the originating player's name, no due dates)
- [ ] **[B]** Day/night lighting + timer
- [ ] **[B]** Freeze at time-up (lock input, dim world) → hand off to the `05` flow
- [ ] **[B]** Visual-state variants for all rows in the table above
- [ ] **[B]** FX: harvest pop, splash, rot flies, blight motes
- [ ] **[B]** HUD components (React) styled to match the pixel art
- [ ] **[B]** Graveyard rendering: one stone per gravestone record, hover shows the name, click opens the journal page (`05`)
- [ ] **[B]** Lectern: interact opens the journal
- [ ] **[B]** Perf check: 60 fps on a mid laptop at 32×32

## Acceptance

- A player can walk around, do all 8 actions, watch day turn to night, and hit freeze, in a local hot-seat build.
- A teammate shown screenshots of two worlds (healthy vs neglected) can tell which is which and name what's wrong, without any text.

## Open questions

1. Does the turn timer **keep running** while the journal is open during play? ("Openable any time" vs "time freezes only at end".)
2. Show numeric Food/Water counts, or only diegetic visuals (crate fill, reservoir level)? The current decision is the Stardew-like HUD with counters.
3. Can the player sprint (more stamina, less time)?
