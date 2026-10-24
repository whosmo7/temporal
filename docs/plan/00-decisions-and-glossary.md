# 00 — Decisions Log & Glossary

Everything the team has decided so far, so nobody re-argues it at hour 30.

## Project constraints

| Topic | Decision |
|---|---|
| Event | OxHack, **48-hour** build window |
| Team | **3–4 people**, mixed experience with the stack; roles: engine/sim, frontend/UI, design/art/audio, game design/narrative/pitch |
| Repo | `whosmo7/temporal` |
| Stack | **React + TypeScript + Vite** |
| World renderer | **PixiJS** (canvas/WebGL) inside React; React draws UI overlays |
| Hosting | **GitHub Pages** |
| Backend | **Supabase** (async online play) |
| Devices | **Desktop/laptop only** (keyboard + mouse) |
| Workflow | **GitHub Issues + PRs** (the team creates the issues from these docs) |
| Testing | **Vitest unit tests on the engine** |
| Scheduling | The team plans its own time. These docs give tasks by section, not a timetable. |
| Pitch deliverables (slides, video, write-up) | Out of scope for these docs. The team handles them. |

## World & setting

| Topic | Decision |
|---|---|
| Tone | Simple farming life, Minecraft-like simplicity |
| View | **2D with a Stardew Valley-style angle** (top-down ¾ view) |
| Map | **~32×32 tiles** (needs a camera that follows the player) |
| Seeds | Every world is generated from a seed and has a natural **boundary** |
| Boundaries for hackathon | **Forest (trees)** and **Island (sea)** |
| Boundary effect | **Small modifiers** to starting values. Rules are the same everywhere. |
| Placement | **Pre-defined plots** (fixed sites for fields, orchard, reservoir, well, fishing/hunting spot) |
| Population | **No NPC villagers.** The player is the only person alive in the world. The **graveyard** of past players is the visible population. |
| World health visuals | **Strong**: withered crops, cracked reservoir, murky water, blight. The world never explains itself, so it has to be readable by eye. |

## Resources & player

| Topic | Decision |
|---|---|
| Resources | **Food, Water, Labour** |
| Labour | The **player's energy/stamina**. Actions spend it. |
| Personal needs | **Player must meet food + water upkeep** at end of turn |
| Failure | **Soft fail**: if upkeep isn't met, the successor gets a **weakened start** (low stamina, visibly blighted world) |
| Decay | **Resource decay + infrastructure wear** (crops rot, water stagnates, structures wear unless maintained) |
| Delayed-effect visibility | **Partly hidden**: you can see something is growing or decaying, but not the exact numbers |
| Random events | **Seeded** (deterministic from the world seed) |
| Borrowing | **None** |
| Scoring | **No score.** The replay is the ending. |

## Actions (8)

1. **Harvest**: collect from ripe fields or orchards (farmed food)
2. **Plant Crops**: quick crops that can ripen within the same turn
3. **Plant Orchard**: slow; matures in a later generation
4. **Repair Reservoir**: protects future water; tuned to be costly (see dilemma below)
5. **Dig Well**: quick water, but must be **maintained** or its water stagnates
6. **Fish/Hunt**: wild food from a commons that depletes and recovers slowly
7. **Maintain**: repair wear on structures (well, reservoir, orchard)
8. **Fast Track**: pull any pending effect forward to now at **double cost, paid by the current player**. Works on effects **other players** started too.

The **reservoir dilemma is designed in on purpose**: the numbers are tuned so one player can't
fully repair the reservoir *and* comfortably meet their own upkeep in the same turn.

## Turn flow

| Topic | Decision |
|---|---|
| Turn length | **Configurable** per world (default chosen by the game designer) |
| Generations per world | **Configurable** (not fixed at 4) |
| Actions per turn | **Unlimited** within the time limit (stamina and resources still apply) |
| In-turn time | **Day/night cycle** plays out across the turn |
| Movement | **Walk with WASD/arrows** |
| When the timer ends | **Time freezes**. The player reads and writes in the shared journal. |
| End flow | **Freeze → journal → cost summary → gravestone** |
| Cost summary | Shows **only what has been realised now** (costs paid, immediate gains). Pending benefits are left out on purpose, which sets up the demo moment. |

## Journal, graveyard, replay

| Topic | Decision |
|---|---|
| Journal | One page per player. **Free text + drawing**. **Earlier pages can't be edited.** |
| Drawing tools | **Single pen, a few colours** (+ eraser) |
| Journal access | An **in-world object, openable any time** (reading it doesn't use game time) |
| What successors learn | **Only the journal.** The world never explains why it is in its current state. |
| Gravestone | **Name/initials**, **click to open that player's journal page** |
| Replay | For each generation: **a snapshot of the world plus that player's diary entry**. The replay is where causes are explained. |
| Replay audience | **Anyone**, through a public **gallery** of completed worlds |
| Sharing/export | **No**, in-app only |
| Moderation | **None** for the hackathon (logged as a risk) |

## Multiplayer

| Topic | Decision |
|---|---|
| Mode | **Async online**: each generation is played by whoever is assigned next, on their own device |
| Assignment | **Weighted random** between inheriting an unlocked in-progress world and getting a new one; **ratio configurable** |
| Concurrency | **Only one player can hold a world at a time** (lock) |
| Abandon mid-turn | **Turn voided**: the lock expires, the world stays as it was before the turn, no gravestone |
| Identity | **Username + password** (security isn't the focus) |
| Repeat play | **Allowed**: the same person can play several generations of one world |
| New world (Gen 1) | **Seeded starter state** (some food/water, damaged reservoir, wild stock, empty plots, biome modifier) |

## Screens

Landing/title · Sign up/Log in · Onboarding/tutorial · Game · Gallery of completed worlds ·
Admin tools: **force-assign a world, configure turn length/generations, skip to replay**.

## Demo

**Pre-seeded demo world**: teammates play the earlier generations before judging (one plants the
orchard and sees only its cost). The judge is force-assigned the generation where it is
flourishing. The slot is **5 minutes**.

---

## Glossary

| Term | Meaning |
|---|---|
| **World** | One seeded map with its own history, journal and graveyard |
| **Generation / Turn** | One player's timed session in a world. Turn index `n` = generation `n`. |
| **Seed** | The integer that deterministically produces the map, biome, starter state and events |
| **Plot** | A pre-defined site where an action can be done (field, orchard plot, reservoir, well, fishing/hunting spot) |
| **Action** | A player's choice, recorded in the append-only action log |
| **Effect** | A state change produced by an action, event or rule. It has a *due* time. |
| **Pending effect** | An effect committed but not yet due (e.g. an orchard maturing at gen n+2) |
| **Transition** | One recorded state change, with its **causes** |
| **Cause** | A reference to the action, event or rule (decay, wear, upkeep) behind a transition |
| **Upkeep** | Food + water the player must have at end of turn |
| **Weakened start** | Soft-fail penalty given to the successor after missed upkeep |
| **Lock** | A server-side claim that one player holds a world for the length of their turn |
