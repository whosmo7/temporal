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
| Map size | **Configurable** per preset. Default **32×32 including the boundary** ([001](../decisions/001-worldgen-map-size-and-presets.md)) |
| Fields | **Configurable** per preset. Default **2** ([001](../decisions/001-worldgen-map-size-and-presets.md)) |
| Map presets | Named presets override any generator option and can **pin plots** to exact tiles ([001](../decisions/001-worldgen-map-size-and-presets.md)) |
| House | Every world has the player's **7×5 house** (5×3 room, door at the bottom). Each turn **starts inside**. Entering lifts the roof and zooms in. The oven is furniture only for now ([010](../decisions/010-player-house.md)) |
| Food store | The house's **cabinet** is the food store. **Stored food doesn't rot** for now (`foodRotPct: 0`, [011](../decisions/011-cabinet-food-store-no-rot.md)) |
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
| Eating | **Harvest and eat**: a free Harvest option (Q) that turns the fresh yield into hunger, up to full. Not a ninth action ([003](../decisions/003-eating-via-harvest.md), [016](../decisions/016-hunger.md)) |
| Hunger | Inherited meter, 0..100: **−30 at each new generation**, eating refills it, at 0 the player walks slower ([016](../decisions/016-hunger.md)) |
| Upkeep visibility | Screen order unchanged. HUD shows **"Needed by nightfall"** during play ([002](../decisions/002-upkeep-timing.md)) |
| Failure | **Soft fail**: if upkeep isn't met, the successor gets a **weakened start** (low stamina, visibly blighted world) |
| Decay | **Resource decay + infrastructure wear** (crops rot, water stagnates, structures wear unless maintained) |
| Delayed-effect visibility | **Partly hidden**: you can see something is growing or decaying, but not the exact numbers |
| Random events | **Seeded** (deterministic from the world seed) |
| Event set | **Drought**, **good harvest**, **storm** (Island only, 50%) ([005](../decisions/005-seeded-events.md)) |
| Drought | **Exactly one per world**, lasting `min(5, ceil(gens / 10))` consecutive generations, starting at a random gen ≥ 2 ([008](../decisions/008-drought-length-and-timing.md)) |
| Wild spot | **Forest = hunt, Island = fish**, same numbers ([006](../decisions/006-wild-spot-per-biome.md)) |
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

**Per tile, and in time ([019](../decisions/019-per-tile-actions-take-time.md)):** fields and orchards are worked one tile
at a time (the tile you face), each action takes a few seconds of the day with the player standing still, and every
stamina cost is 0 for now.

The **reservoir dilemma is designed in on purpose**: the numbers are tuned so one player can't
fully repair the reservoir *and* comfortably meet their own upkeep in the same turn.

## Turn flow

| Topic | Decision |
|---|---|
| Turn length | **Configurable** per world. Default **10 minutes** (600 s) ([007](../decisions/007-turn-and-generation-defaults.md)) |
| Generations per world | **Configurable** (not fixed at 4). Default **6** ([007](../decisions/007-turn-and-generation-defaults.md)) |
| Actions per turn | **Unlimited** within the time limit (stamina and resources still apply) |
| In-turn time | **Day/night cycle** plays out across the turn |
| Movement | **Walk with WASD/arrows** |
| When the timer ends | **Time freezes**. The player reads and writes in the shared journal. |
| End flow | **Freeze → journal → cost summary → gravestone** |
| Fast Track on an orchard | Fruits now, **no long-term yield penalty**; the 2× cost is the price ([004](../decisions/004-fast-tracked-orchard-yield.md)) |
| Committed at | **"Seal page"**; the cost summary and stone are for show. A failed save offers Try again, and a local copy is sent on the next Play ([018](../decisions/018-commit-on-seal-refresh-restarts.md)) |
| Cost summary | Shows **only what has been realised now** (costs paid, immediate gains). Pending benefits are left out on purpose, which sets up the demo moment. |

## Journal, graveyard, replay

| Topic | Decision |
|---|---|
| Journal | One page per player. **Free text + drawing**. **Earlier pages can't be edited.** |
| Journal text limit | **400 characters** ([009](../decisions/009-journal-character-limit.md)) |
| Music | **Ninja Adventure tracks (CC0)**, not original: day `Peaceful`, dusk `Quiet`, reflective `Melancholia` ([015](../decisions/015-music-from-the-pack.md)) |
| Drawing tools | **Single pen, a few colours** (+ eraser) |
| Journal access | An **in-world object, openable any time** (reading it doesn't use game time: the clock stops, [012](../decisions/012-day-night-clock.md)) |
| Day/night | A turn is **one in-game day, 6 am to 6 am** ([012](../decisions/012-day-night-clock.md)) |
| What successors learn | **Only the journal.** The world never explains why it is in its current state. |
| Gravestone | **Name/initials**, **click to open that player's journal page**. Hover shows "AL · Generation 2"; E at the graveyard reads the nearest stone ([014](../decisions/014-gravestones.md)) |
| Replay | For each generation: **a snapshot of the world plus that player's diary entry**. The replay is where causes are explained. |
| Gallery access | **Public**: anyone can view the gallery and replays without logging in; only Play needs an account ([017](../decisions/017-public-gallery.md)) |
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
| Refresh mid-turn | **The same turn starts over** at 6 am, within the original lock ([018](../decisions/018-commit-on-seal-refresh-restarts.md)) |
| Identity | **Username + password** (security isn't the focus) |
| Repeat play | **Allowed**: the same person can play several generations of one world. Straight after a turn, the device asks not to be handed the same world again (a client-side hint, [020](../decisions/020-claim-and-lock-rules.md)) |
| Choosing a world | **No**: assignment is always the weighted random draw ([020](../decisions/020-claim-and-lock-rules.md)) |
| World names | **From the seed**, `worldName(seed, biome)`, e.g. "Hollow Elm" ([020](../decisions/020-claim-and-lock-rules.md)) |
| Lock while reading | **Heartbeat** extends the lock while the clock is stopped, capped at 15 extra minutes ([020](../decisions/020-claim-and-lock-rules.md)) |
| New world (Gen 1) | **Seeded starter state** (some food/water, damaged reservoir, wild stock, empty plots, biome modifier) |

## Screens

Landing/title · Sign up/Log in · Onboarding/tutorial · Game · Gallery of completed worlds ·
Admin tools: **force-assign a world, configure turn length/generations, skip to replay**.

## Demo

**Pre-seeded demo world**: teammates play the earlier generations before judging (one plants the
orchard and sees only its cost). The judge is force-assigned the generation where it is
flourishing. The slot is **5 minutes**.

---

## Gameplay rework (13)

| Topic | Decision |
|---|---|
| Fields | **Per tile**: each tile is planted, watered, grown and harvested on its own ([019](../decisions/019-per-tile-actions-take-time.md); watering added in [021](../decisions/021-per-tile-farming-and-watering.md)) |
| Watering | **Plant, then water once** before a tile grows. A **watering can** holds a few pours, filled free at a well, reservoir, pond or sea edge ([021](../decisions/021-per-tile-farming-and-watering.md)) |
| Unwatered seeds | Carry over, and **wither 2 generations** after planting ([021](../decisions/021-per-tile-farming-and-watering.md)) |
| Actions | Still **eight**: **Water** replaces Plant Orchard ([021](../decisions/021-per-tile-farming-and-watering.md), [024](../decisions/024-emergent-orchards-and-flowers.md)) |
| Seeds | **Shared stock** carried between generations; harvest gives some back ([022](../decisions/022-seed-stock.md)) |
| Health & level | **World health bar + level badge in the HUD**; level only rises. Replaces "No score" ([023](../decisions/023-world-health-and-level.md)) |
| Orchards & flowers | **Emergent** from the world's level; no planting ([024](../decisions/024-emergent-orchards-and-flowers.md)) |
| Oven | **Cooks stored food** to refill hunger ([025](../decisions/025-oven-cooks-stored-food.md)) |
| Explaining the world | The blanket rule is **lifted**, but the only new readouts are the **health bar and land level**. Due dates, yields and causes still wait for the replay; the cost summary stays realised-only ([026](../decisions/026-lift-no-explanation-rule.md)) |
| Level names | **Bare, Taking root, Green, Blooming, Abundant** (levels 0–4), shown by name, never as a number ([023](../decisions/023-world-health-and-level.md)) |
| First-pass numbers | Can 3 pours, empty each morning; 9 starting seeds, +1 per field tile, +2 per tree; level thresholds 55/65/75/85 (`01` › Section 13 values) |

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
