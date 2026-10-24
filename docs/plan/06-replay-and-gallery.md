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
- Sort: newest first. Filter by biome (stretch).
- Click → replay.
- "Your worlds" filter for the signed-in user (worlds they contributed to). This is optional, since repeat play and identity exist.

## Data

- Prefer **stored per-generation snapshots** (from `commit-turn`, see `07`) for quick loading.
- Fallback / verification: `engine.replay(seed, opts, log)` from the action log. The two should match, and a Vitest test checks this.

## Tasks

- [ ] **[C]** `explain()` output → human sentences (templating with actor names + generations)
- [ ] **[B]** Replay screen layout: snapshot panel + journal panel + causes panel + timeline
- [ ] **[B]** Read-only Pixi render of a snapshot (reuse `04` layers, no avatar, no input)
- [ ] **[B]** Highlight changed plots per generation (diff vs the previous snapshot)
- [ ] **[B]** Plot history popover
- [ ] **[B]** Generation stepping (buttons + arrow keys) + optional auto-play
- [ ] **[C]** Title card + ending card
- [ ] **[C]** Gallery grid + thumbnails (render the snapshot to a small texture or a stored image, shown as a small floating island, see `docs/art/art-direction.md`)
- [x] **[C]** Route `/#/world/:id/replay` and `/#/gallery` *(Both public ([017](../decisions/017-public-gallery.md)). `GalleryScreen` lists completed worlds newest first as text cards, with empty and error states; thumbnails come with the grid task. `ReplayScreen` loads `getReplay` and shows a stand-in until B's replay layout lands.)*
- [ ] **[C]** Admin "skip to replay" hook (`08`)
- [ ] **[C]** (Stretch) Legacy view per player
- [ ] **[B]** (Stretch) Animate drawing strokes in the journal panel

## Acceptance

- For the demo world, the gen where the orchard fruits shows a food line naming the planter and the generation they planted it in.
- Every resource change shown sums correctly to the displayed delta.
- The gallery lists every completed world and opens its replay.

## Open questions

1. Should the replay show the **start** or the **end** of each generation, or both (before/after slider)?
2. Should the final player watch the replay straight away, or be sent to the gallery?
3. Is the legacy view in scope?
4. Should incomplete worlds also be viewable (spectate-in-progress), or only completed ones?
