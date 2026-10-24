# INHERITANCE — Project Plan

> *What would responsibility mean if the people affected by your choices could never reward you?*

A browser-based, async-multiplayer farming game for OxHack (48h, team of 3–4).
Each player governs a small seeded world for one timed turn (one **generation**). They
inherit what earlier players left: resources, structures, consequences already in motion, and a
shared journal. Some actions pay off right away. Others only mature after the player has left.
When a world reaches its final generation, a replay shows what each player actually caused.

This folder is the plan. It is split by area so each person can own a section. It is **not** a
build-everything-in-one-go spec. Each doc has:

- **Decisions**: what the team has already chosen (from the planning Q&A)
- **Spec**: how it should work
- **Tasks**: checklists, roughly in dependency order
- **Acceptance**: how you know the section is done
- **Open questions**: things still to decide. Nothing here has been assumed.

Values marked **`[PLACEHOLDER]`** are suggested starting numbers for the game designer to tune.
They are not decisions.

## Sections

| # | Doc | Owner role |
|---|-----|-----------|
| 00 | [Decisions log & glossary](00-decisions-and-glossary.md) | Everyone, read first |
| 01 | [Game design: resources, actions, rules](01-game-design.md) | Game design |
| 02 | [Simulation engine: turn engine, action log, causality](02-engine.md) | Engine |
| 03 | [World generation: seeds, biomes, plots](03-world-generation.md) | Engine |
| 04 | [World rendering & in-game UI (PixiJS)](04-rendering-and-hud.md) | Frontend |
| 05 | [Journal, end-of-turn flow, graveyard](05-journal-and-graveyard.md) | Frontend |
| 06 | [Replay & gallery](06-replay-and-gallery.md) | Frontend + Engine |
| 07 | [Backend & async multiplayer (Supabase)](07-backend-and-multiplayer.md) | Engine / Backend |
| 08 | [App shell: screens, auth, onboarding, admin](08-screens-onboarding-admin.md) | Frontend |
| 09 | [Art & audio](09-art-and-audio.md) | Design/art/audio |
| 10 | [Demo world & demo moment](10-demo.md) | Game design / pitch |
| 11 | [Repo setup, workflow, testing, deploy](11-workflow-testing-deploy.md) | Everyone (do first) |
| 12 | [Team split: who does what](12-team-split.md) | Everyone |

**Single-page view:** open `plan.html` in a browser for the whole plan on one page, with owner filters and tickable tasks.
Rebuild it after editing any doc: `python3 docs/plan/tools/build_page.py docs/plan docs/plan/plan.html docs/plan/tools/page-template.html` (needs pandoc).

**Working with Claude Code:** `CLAUDE.md` and the project skills in `.claude/skills/` (`inheritance-*`)
turn this plan into rules Claude follows in every teammate's session. Ask your Claude to "start my next [A]/[B]/[C] task".

Each task in `01`–`11` is tagged **[A]**, **[B]** or **[C]**. These are the three equal workloads in
`12`: **A** = Engine & Backend, **B** = World & Gameplay, **C** = Design, Content & App Shell.

## Suggested critical path (dependencies, not a schedule)

```
11 repo setup ──► 02 engine core ──► 01 balance config ──► 04 world render + HUD
                   │                                        │
                   ├──► 03 worldgen ────────────────────────┤
                   │                                        ▼
                   └──► 07 backend (schema, claim/commit) ──► 05 journal/end flow ──► 06 replay/gallery
                                                                                          │
                                                 09 art/audio (parallel throughout) ──────┤
                                                                                          ▼
                                                                         08 shell/admin ──► 10 demo world
```

Your first milestone should be a playable hot-seat loop: inherit → act → freeze → journal →
gravestone → next player, running locally with placeholder squares and no backend. Every
later section plugs into that loop.
