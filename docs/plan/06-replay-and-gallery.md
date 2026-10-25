# 06 — Replay & Gallery

**Owner:** Frontend dev + Engine dev (`replay`, `explain`)  
**Depends on:** `02` (snapshots, transitions, causes), `04` (renderer, read-only), `05` (page renderer), `07` (gallery queries).

## Decisions (locked)

- The replay runs once a world reaches its **final generation** (the generation count is configurable).
- For **each generation**, it shows a **snapshot of the world** and **that player's diary entry**.
- **The replay is the only place causes are explained** (during play the world never explains itself).
- Audience: **anyone**, through a public **gallery** of completed worlds. In-app only, no export.
- No score.

## Replay structure

```
[Title card]  World name · biome · N generations · "Everyone who lived here is gone."
   ▼
For each generation g = 1..N:
 ┌───────────────────────────────────────────────┬──────────────────────────┐
 │  World snapshot at END of gen g               │  Journal page of gen g   │
 │  (read-only Pixi render of the map)           │  author · text · drawing │
 │                                               │                          │
 │  Highlights: plots changed this gen glow;     ├──────────────────────────┤
 │  click a plot → its history                   │  "What actually changed" │
 │                                               │  Food  +32               │
 │                                               │   +30 Orchard ← AL, Gen 1│
 │                                               │   +12 Fished  ← MO, Gen 3│
 │                                               │   −10 Rot                │
 │                                               │  Water −14               │
 │                                               │   −10 Drought (event)    │
 │                                               │   −4  Well stagnant ← no │
 │                                               │       maintenance since  │
 │                                               │       Gen 2              │
 └───────────────────────────────────────────────┴──────────────────────────┘
 [◀ prev gen]   ● ● ● ○ ○  timeline   [next gen ▶]
   ▼
[Legacy view, optional/stretch]: for each player, "What you caused after you left"
   e.g. "AL planted an orchard in Gen 1. It fed Gen 3, Gen 4 and Gen 5."
```

- The cause lines come from `engine.explain(transitions, { turn: g, resource })`, which groups `Transition.causes` by source action → actor → committed generation.
- **Key line for the demo:** a cause whose `committedTurn` is earlier than the current generation shows as **"← planted by AL in Gen 1"**. That is the reveal.
- Plot click → a mini timeline of that plot across generations (stage + who acted on it).

## Gallery

- Grid of completed worlds: thumbnail (snapshot of the final gen), world name, biome, generation count, player names (from gravestones).
- Sort: Most recent (default), Highest score, Lowest score; each card shows the world's score [037](../decisions/037-world-score-and-leaderboard.md). Filter by biome (stretch).
- Click → replay.
- "Your worlds" filter for the signed-in user (worlds they contributed to). This is optional, since repeat play and identity exist.

## Data

- Prefer **stored per-generation snapshots** (from `commit-turn`, see `07`) for quick loading.
- Fallback / verification: `engine.replay(seed, opts, log)` from the action log. The two should match, and a Vitest test checks this.

## Replay viewer: who builds what

The generation view is split between **B** (the world and its data) and **C** (the screen around it), by folder so the
two can work at once: B in `src/render/` and `src/ui/replay/`, C in `src/ui/screens/ReplayScreen.tsx`, `src/ui/kit/`
and `docs/content/`. C's title card, ending card and arrow-key stepping are already built.

**The meeting point**, which B exports from `src/ui/replay/` first, as stubs if need be, so C builds against it straight away:

```ts
// A read-only world for one generation: the snapshot's map at its end-of-generation look, the
// stones so far, the changed tiles glowing. No player, no input, no clock. Fills its parent.
<ReplayWorld replay={replay} turn={n} onPlotClick={(plotId, at: { x: number; y: number }) => …} />

// Field and orchard tiles and whole plots whose stage changed in generation `turn`.
changedPlots(replay: Replay, turn: number): PlotId[]

// One plot's or tile's story, generation by generation: its stage at the end, and who acted on it.
plotHistory(replay: Replay, plotId: PlotId): { turn: number; stage: string; acts: { actor: string; type: ActionType }[] }[]
```

Names come from the journal page author of each generation, as in `causeSentences.ts`. Tiles are ids like
`field-1:2,0` ([019](../decisions/019-per-tile-actions-take-time.md)).

## Tasks

- [x] **[C]** `explain()` output → human sentences (templating with actor names + generations) *(`explainGeneration(turn, { actions, transitions, nameOf, biome })` in `src/ui/replay/causeSentences.ts` gives per-resource lines that add up to the net, each flagged `earlier` when it credits an earlier generation; `sentence()` formats one. Wording: `docs/content/replay-causes.md`. Names come from the journal page author of each generation.)*
**Replay viewer: B (the world and its data)**

- [x] **[B]** Stub the three exports above with their final types, so C can start (do first) *(built for real rather than stubbed: `import { ReplayWorld, changedPlots, plotHistory } from '../replay'`. Also exported: `viewAt`, `playerOf`, `stonesAt`, `replayMap`. Bench: `#/dev/replay` in dev, a scripted three-generation world, or `?world=<id>` for a finished one.)*
- [x] **[B]** `ReplayWorld`: a read-only `createWorldView` for a snapshot (reuse `04` layers; no avatar, no input, no clock, no music), the look from `visibleView(snapshot.state)`, the graveyard's stones up to that generation, and the camera framing the whole map *(`createWorldView(..., { onPlotClick })` replay mode: no player, keyboard, clock or music; midday light with the weakened and drought tints; the whole map at the largest whole-pixel zoom that fits. `Replay` gained an optional `preset` (LocalBackend fills it; `get_replay` doesn't return it yet, so it falls back to `default`, which every claimed world uses).)*
- [x] **[B]** `changedPlots`: diff each tile and plot's visible stage against the previous generation (the founder look for gen 1), with tests; the changed ones glow in `ReplayWorld` *(a soft pulsing fill and outline; compares visible stages, so a tile sown and harvested the same day isn't counted)*
- [x] **[B]** `plotHistory`, from the snapshots and the action log, with tests; clicking a tile or plot in `ReplayWorld` calls `onPlotClick` with its id and screen position *(position in CSS px from `ReplayWorld`'s top-left; hurrying a plot's effect counts as acting on it; `actor` is that generation's page author)*
- [ ] **[B]** Health and level per generation, read from the snapshots (once [023](../decisions/023-world-health-and-level.md) is in the engine), exported for C's panel
- [x] **[B]** Check `replay()` rebuilds the stored snapshots for a played world (the Data note above), with a test *(LocalBackend, two generations: `src/ui/replay/__tests__/replayData.test.ts`)*

**Replay viewer: C (the screen around it)**

- [x] **[C]** Generation layout in `ReplayScreen`: `ReplayWorld` on the left; the journal page and "What actually changed" on the right; the timeline underneath. It replaces the dusk-sky stand-in *(`GenerationView` in `ReplayScreen.tsx`; the world keeps its Pixi stage between generations. Dev bench of the whole screen on B's scripted world: `#/dev/replay-screen`.)*
- [x] **[C]** Timeline: one dot per generation with its player's name, the current one marked, click to jump; previous/next buttons beside it (the arrow keys already step) *(`src/ui/screens/replay/Timeline.tsx`; names cut to 8 characters, full name on hover ([031](../decisions/031-replay-viewer-pacing-and-legacy.md)))*
- [x] **[C]** Auto-play: play/pause and a pace, stepping on its own, stopping at the ending card *(off until Play; Slow/Steady/Quick = 12/8/4 s; waits while a plot's history is open ([031](../decisions/031-replay-viewer-pacing-and-legacy.md)))*
- [x] **[C]** Plot history popover: opened by `onPlotClick`, anchored at the click, listing `plotHistory` generation by generation ("Gen 1 · AL sowed it · Sown"); Esc and clicking away close it *(`PlotPopover.tsx`; up to the generation on screen; titled "Field tile 4", "Tree 2", "Reservoir")*
- [x] **[C]** Causes panel: make `earlier` lines (the reveal, "← planted by AL in Gen 1") stand out; add the health and level line once B exports it *(earlier lines get a ← , a peach tint and a left rule; titled "What actually changed". The health and level line waits on B's task above; its wording is ready in `replay-causes.md`.)*
- [x] **[C]** Copy for the popover, timeline and health lines in `docs/content/replay-causes.md`
- [x] **[C]** Title card + ending card *(`ReplayScreen`: title card ("An island · 6 generations", "Everyone who lived here is gone.", Begin) → each generation → ending card (the dusk island with a stone per generation, "6 generations lived here.", the names in order, Watch again / Gallery). Arrow keys step through. Worlds have no names yet, so the title uses the biome. Until B's layout lands, each generation shows the journal page and the cause lines on a dusk sky.)*
- [x] **[C]** Gallery grid + thumbnails (render the snapshot to a small texture or a stored image, shown as a small floating island, see `docs/art/art-direction.md`) *(`IslandThumb` in `src/ui/gallery/` draws the world's map from the world atlas on a 2D canvas: the area inside the boundary is the island's top, plots at their stage in the last snapshot, a stone per player, a cliff underneath. `CompletedWorld` gained optional `preset` and `finalState` for it (`07`); without them it draws the founder stages on the default preset.)*
- [x] **[C]** Route `/#/world/:id/replay` and `/#/gallery` *(Both public ([017](../decisions/017-public-gallery.md)). `GalleryScreen` lists completed worlds newest first as text cards, with empty and error states; each card shows its world as a floating island. `ReplayScreen` loads `getReplay`; see the title and ending card task.)*
- [x] **[C]** Admin "skip to replay" hook (`08`) *(Skip to replay in the admin world list asks to confirm, calls `markComplete` (the world ends with the generations played so far, its lock cleared) and opens its replay. Completed worlds get a Replay link instead.)*
- [x] **[C]** (Stretch) Legacy view per player *(on the ending card, "After they left" ([031](../decisions/031-replay-viewer-pacing-and-legacy.md)); `legacyOf()` in `src/ui/screens/replay/words.ts`)*
- [x] **[A]** Ghosts: each generation's player replays their day on the map, from the action log *(`src/ui/replay/ghosts.ts`, a "Ghosts" toggle beside the pace; replay only, off for reduced motion ([038](../decisions/038-replay-ghosts.md)))*
- [ ] **[B]** (Stretch) Animate drawing strokes in the journal panel

## Acceptance

- For the demo world, the gen where the orchard fruits shows a food line naming the planter and the generation they planted it in.
- Every resource change shown sums correctly to the displayed delta.
- The gallery lists every completed world and opens its replay.

## Open questions

1. Should the replay show the **start** or the **end** of each generation, or both (before/after slider)?
2. Should the final player watch the replay straight away, or be sent to the gallery?
3. ~~Is the legacy view in scope?~~ Yes, on the ending card ([031](../decisions/031-replay-viewer-pacing-and-legacy.md)).
4. Should incomplete worlds also be viewable (spectate-in-progress), or only completed ones?
