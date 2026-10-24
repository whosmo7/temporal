# 10 — Demo World & Demo Moment

**Owner:** Game design / pitch (with the Engine/backend dev for seeding)  
**Depends on:** everything. Prepare this once `07` and `06` work.

## Decisions (locked)

- **Pre-seeded demo world**, played in advance by teammates.
- **5-minute** slot.
- Admin tools needed: **force-assign**, **configure turn length/generations**, **skip to replay**.
- Pitch deliverables (slides, video, write-up) are handled by the team outside these docs.

## The demo moment (from the brief)

> A judge inherits a flourishing orchard and discovers it was planted by someone whose own final
> screen showed only its cost.

### Setup (example with a 3-generation demo world, so the judge plays Gen 3)

| Gen | Played by | What they do | Their cost summary shows |
|---|---|---|---|
| 1 | Teammate A | Plants the **orchard** (sacrificing comfort), writes a journal page, e.g. *"I planted something by the east fence. Look after it."* | "Orchard: −25⚡ −5💧"; upkeep barely met |
| 2 | Teammate B | Repairs the reservoir, goes hungry → successor weakened? (or not, to taste) | Costs only |
| 3 | **Judge** | Spawns next to a **fruiting orchard**. Harvests and lives comfortably. Reads the journal. | — |
| → | Admin: **Skip to replay** | Replay shows gen 3: *"Food +30 ← Orchard planted by A in Gen 1"*, beside A's gen 1 page and **A's gen 1 cost-only summary** | |

Optional extra beat: show A's actual end-of-turn screen (a screenshot, or a "what they saw" panel in
the replay) next to the judge's flourishing orchard.

> Open: should the replay include a **"what this player saw"** panel (their realised-only summary)? That would make the demo moment show up without the presenter having to narrate it.

### Seeding

- **Preferred:** teammates actually play the early generations on the live site (so it's real data).
- **Backup:** `scripts/seed-demo.ts` creates the same world from a fixed seed + a fixed action log + fixed journal pages, through the same `commit-turn` path. Run it the morning of judging, plus a second copy as a spare.
- Choose a seed where the orchard plot is near spawn and clearly visible (use the `03` worldgen debug page).
- Set a **turn length** the judge can play comfortably in the slot (e.g. 60s). The game designer decides.

### 5-minute run sheet (draft, for the team to adapt)

1. 0:00–0:30 Premise + question ("What would responsibility mean…").
2. 0:30–1:00 Show the gallery/landing. Admin force-assigns the demo world to the judge.
3. 1:00–2:30 Judge plays: inherits the orchard, harvests, opens the journal, sees the graveyard.
4. 2:30–3:30 Freeze → judge writes a line → cost summary → gravestone.
5. 3:30–4:30 Skip to replay → gen 1: A's page + cost-only summary → gen 3: orchard cause line.
6. 4:30–5:00 Tech in one breath (append-only log, due-turns, causal transitions) + why it matters (classrooms/workshops).

## Tasks

- [ ] **[C]** Pick the demo seed (orchard visible, nice-looking biome)
- [ ] **[C]** Decide the demo world's generation count + turn length
- [ ] **[C]** Write the founder journal pages (natural, not preachy)
- [ ] **[A]** Write `scripts/seed-demo.ts` (+ a spare world)
- [ ] **[C]** Create judge accounts (or a shared "judge" account) + admin account
- [ ] **[C]** Rehearse force-assign → play → replay flow 3+ times on the demo laptop
- [ ] **[A]** Offline fallback: the `LocalBackend` hot-seat build with the same seed + log baked in, in case the venue Wi-Fi fails
- [ ] **[C]** Decide on the "what this player saw" replay panel (open question)

## Acceptance

- From a cold browser, the full demo runs in under 5 minutes, three times in a row, without help from the dev console.
- The replay line naming the orchard's planter appears every time.
