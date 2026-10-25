---
name: inheritance-world-ui
description: Frontend conventions for the INHERITANCE game in the temporal repo. Covers the PixiJS world inside React (layers, camera, y-sorting, pixel scaling), the Zustand store, how the UI talks to the engine (visibleView, applyAction, tick, endTurn), the HUD, the journal and drawing canvas, the end-of-turn flow, the replay viewer, and the app screens and hash routes. Use this whenever you build or change anything under src/render/, src/ui/ or src/store/, including the world view, an in-game prompt or menu, the journal, cost summary, gravestones, the replay or gallery, landing, auth, tutorial or admin screens.
---

# World & UI

Pixi draws the world; React draws everything else as DOM overlays. Keeping that split, and keeping the
UI reading only what the engine chooses to show, is what stops the game from leaking hidden information
and stops B and C from colliding. Spec: `docs/plan/04`–`08`. IDs: `inheritance-core/references/ids.md`.
Also load `inheritance-player-facing` for anything a player sees.

## Architecture

```
<GameScreen>
  <PixiStage/>     mounts one Pixi Application (manual useEffect mount, not @pixi/react)
     TilemapLayer → PlotLayer → ActorLayer (y-sorted) → FxLayer → LightingLayer
  <Hud/> <InteractPrompt/> <FastTrackMenu/> <JournalModal/>   React DOM overlays
```

- **One Pixi `Application` per screen.** Create it in a `useEffect` and destroy it on unmount
  (`app.destroy(true, { children: true })`). Leaked WebGL contexts are the usual cause of "it went black
  after navigating twice".
- **Pixel art:** nearest-neighbour scaling (`TextureStyle.defaultOptions.scaleMode = 'nearest'` or the
  equivalent for the installed Pixi version), integer zoom levels and rounded camera positions, or
  sprites shimmer.
- **Static terrain** is drawn once to a `RenderTexture`. Only plots, actors and FX update each frame.
- **Y-sort** the actor layer by sprite bottom, so the player walks behind trees and structures.

## State flow

```
keyboard → game loop → engine.applyAction(state, action, t) → store.set(state) → Pixi reads visibleView(state)
                      ↘ engine.tick(state, t) at ~4 Hz
```

- The store (`src/store/game.ts`, Zustand) holds the engine `WorldState`, the local action buffer and
  session info. **Engine state is only changed through engine functions.** The UI never edits
  resources or plots directly, otherwise the action log and the server re-simulation drift apart.
- **Pixi and React render from `visibleView(state)`, not from raw `WorldState`.** This keeps pending
  numbers, due turns and causes out of the play UI by construction.
- Pixi reads the store in its ticker (`useStore.getState()`). React components subscribe to slices with
  selectors so the HUD doesn't re-render every frame.
- The movement loop runs at display rate with a fixed timestep. Walking and work animations take real
  turn time on purpose.

## Interaction

- Next to a plot, show `InteractPrompt` with the valid action(s) and cost, e.g. `E  Plant Orchard  25⚡ 5💧`.
  Keys: `E`/`Space` = default action, `1`–`8` = hotbar, `F` = Fast Track on a pending plot, `J` = journal
  (when standing at the lectern), `Esc` = close the overlay.
- Invalid action: grey it out and show the engine's `error` string verbatim.
- While a DOM overlay is open, pause movement input (but check open question `04`/`05` about whether the
  timer keeps running while the journal is open).

## Visual state

Map every `visibleView` stage to a frame named `<kind>/<stage>` (see `inheritance-assets`). World flags
become filters: `weakened` → desaturation + blight motes + slower walk; `drought` → cracked-ground
overlay + warm tint. A successor should be able to read the world's health from these alone, because
the world never explains itself (the HUD adds only a health bar with no number and the land's level name, 023).

## End-of-turn flow

`time-up → freeze (lock input, dim) → JournalModal (write) → CostSummary → Gravestone → commit`

- `CostSummary` renders `endTurn().summary` only. That type contains realised outcomes only. Don't
  compute extra "future" lines in the UI.
- The journal page is sealed with an in-page confirmation step. `confirm()` isn't used; build the
  confirmation into the modal.
- Drawings are stored as stroke JSON `{ color, width, points: [x, y][] }[]` on a fixed logical canvas
  (320×200). Use the single `StrokeRenderer` component for the journal, the replay and gallery thumbnails.
- Commit through the `Backend` interface (`src/api/`). If it fails, retry and keep a local copy. Never
  lose a sealed page.

## Replay & gallery

- The replay uses read-only Pixi layers (no avatar, no input) on stored snapshots.
- The causes panel shows `explain()` output turned into sentences (C's templates, `inheritance-player-facing`).
- Step generations with buttons and arrow keys.

## Screens & routes

Hash routes only (GitHub Pages): `/#/`, `/#/auth`, `/#/tutorial`, `/#/play`, `/#/gallery`,
`/#/world/:id/replay`, `/#/admin`. Shared components (`Button`, `Panel`, `Modal`, `Icon`) live in
`src/ui/kit/` and use the pixel UI kit from `inheritance-assets`. Use them instead of styling one-off
buttons, so the game looks like one thing.

For the landing page's visual polish, the `taste-skill:design-taste-frontend` skill can help if
available, but keep the pixel-art identity from `inheritance-assets`. That identity takes
precedence over generic web styling.

## Checking your work

- Launch the app and play through the change (the `run` skill can help). Attach a screenshot to the PR.
- Desktop only, but it must work at 1280×720 and up, at 60 fps on a mid laptop.
- Before a PR: no `console.error`, no Pixi warnings about destroyed textures.
