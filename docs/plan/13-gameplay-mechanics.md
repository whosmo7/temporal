# 13 — Gameplay Mechanics & Playing Experience

**Owner:** everyone, split by folder to keep merge conflicts down (see Task split)  
**Depends on:** the built engine (`02`), worldgen (`03`) and world view (`04`). **Changes:** `01`, `04`, `05`, `06`, `10`.

This section reworks how the game actually plays: farming is done tile by tile with a watering can, seeds are a
shared stock, and a visible **world health** and **level** grow orchards and flowers on their own. It also gathers the
unfinished gameplay tasks from the first plan. Backend, deploy and demo-admin tasks stay in their own sections.

All numbers marked `[PLACEHOLDER]` are starting values for C to tune. **Builds on
[019](../decisions/019-per-tile-actions-take-time.md)**, which is already on `main`: fields and orchards are worked tile by
tile, the action goes to the tile you face, every action takes time (`CONFIG.actionSeconds`), and **every stamina cost is 0**.
This section doesn't change stamina: it stays in the game, costs nothing, and is a placeholder.

## Decisions (locked)

- **Farming is per tile** (built in [019](../decisions/019-per-tile-actions-take-time.md)). Every field tile is its own plot,
  planted, watered, grown and harvested on its own, next to the others. This section adds watering on top ([021](../decisions/021-per-tile-farming-and-watering.md)).
- **Plant, then water, then it grows** ([021](../decisions/021-per-tile-farming-and-watering.md)). A planted tile doesn't
  grow until it has been watered once. Its own ripening clock starts at that pour.
- **Watering can** ([021](../decisions/021-per-tile-farming-and-watering.md)): holds a few pours. You fill it at a
  **dug well, the reservoir, a pond or the sea edge**. Filling it **never costs stored Water**.
- **Unwatered seeds carry over**, and wither if nobody waters them within 2 generations
  ([021](../decisions/021-per-tile-farming-and-watering.md)).
- **Seeds are a shared stock** carried between generations. You start with some, and harvesting gives some back
  ([022](../decisions/022-seed-stock.md)).
- **Stardew-style toolbar**: number keys pick a held tool (seeds, watering can, hands), and E uses it on the tile you face
  (facing-tile targeting already exists from 019).
- **World health and level** ([023](../decisions/023-world-health-and-level.md)), shown in the HUD as a **health bar** (no
  number) and the **land's name** for its level: Bare, Taking root, Green, Blooming, Abundant. Health goes up and down. **Level only rises.** This replaces the locked "no score" rule.
- **Orchards and flowers are emergent** ([024](../decisions/024-emergent-orchards-and-flowers.md)). There's no Plant
  Orchard action. Trees appear and fruit, and flowers spread, as the world levels up.
- **Eight actions in the end:** Water replaces Plant Orchard once trees come with level; until then Plant Orchard stays as a ninth, and filling the can is a free logged `fillCan` ([027](../decisions/027-watering-can-tilling-food-only-nights.md)) ([021](../decisions/021-per-tile-farming-and-watering.md),
  [024](../decisions/024-emergent-orchards-and-flowers.md)).
- **You eat at the oven**, one food from the store a meal, as a logged `eat` action. Harvest and eat is gone ([025](../decisions/025-oven-cooks-stored-food.md), [029](../decisions/029-eat-at-the-oven.md)).
- **What the world shows during play** ([026](../decisions/026-lift-no-explanation-rule.md)): the old blanket rule is
  lifted, and the only new readouts are the **health bar and land level**. Due dates, future yields and causes still wait
  for the replay. The **cost summary stays realised-only**.
- **Fast Track** still pulls a pending effect forward at 2× cost: a reservoir repair landing, a growing tile, the well's
  income. It never touches health or level.

## Spec

### Actions (8)

Stamina cost is 0 for every action (019). Time is from `CONFIG.actionSeconds`.

| # | Action | Target | Takes | Uses | Effect |
|---|---|---|---|---|---|
| 1 | **Harvest** | one ripe tile, or a fruiting tree | 1 s | — | Tile: +1 food, + seeds back. Tree: +4 food once per generation, scaled by health `[PLACEHOLDER]` |
| 1b | **Cook and eat** (at the oven) | food in the store | 0.5 s | 1 food | Refills hunger, allowed when full. Replaces Harvest and eat ([029](../decisions/029-eat-at-the-oven.md)) |
| 2 | **Plant Crops** | one empty or rotten tile | 1.5 s | 1 seed | Tile becomes `sown`. Doesn't grow until watered |
| 3 | **Water** (new) | one sown tile | `[PLACEHOLDER 1 s]` | 1 pour from the can | Starts that tile's ripening clock (25% of the turn) |
| 4 | **Repair Reservoir** | reservoir | 8 s | — | As before |
| 5 | **Dig Well** | well site | 6 s | — | As before. A dug well becomes a can source |
| 6 | **Fish/Hunt** | wild spot | 3 s | — | As before |
| 7 | **Maintain** | well, reservoir, trees | 3 s | — | As before |
| 8 | **Fast Track** | any pending effect | 2 s | 2× its cost | As before. Fast-tracking a watered tile ripens it now |

Plant Orchard (3 s, 1 water per tree) is removed: the four 1-tile trees from 019 appear with level instead.

**Filling the can** isn't an action in the log. It's an interaction at a water source, like opening the journal. It costs
no stamina and no stored Water. The engine still checks that the can has a pour when a Water action is logged, so the
can's fill level is part of the turn's state: `can: { pours, capacity }`.

### Tile lifecycle

```
empty ─plant→ sown ─water→ watered/growing ─(1 min)→ ripe ─harvest→ empty
               │              │                       │
               │              │ still growing at dusk: │ ripe at dusk: left ripe for the next player.
               │              │ carries over, half its │ Still unpicked at the end of a generation
               │              │ time left              │ that began with it ripe: rotten (tend to clear)
               │ not watered: stays sown and carries over
               └ still unwatered 2 generations after planting: withered (tend to clear)
```

- Tiles are already separate plots (`field-1:0,0` … `field-1:2,2`, from 019). Each tile's state has `ripeSince` for
  the rot rule ([028](../decisions/028-two-minute-days-crops-carry-over.md)).
- Watering happens **once**. After that the tile ripens with no more care, in `cropRipenSeconds` (60).
- Unwatered `sown` tiles stay through the generation change. Watering one in a later generation starts it then.

### Watering can

- Capacity **4** pours (027; kept by the user on 2026-10-25). It starts every turn empty ([027](../decisions/027-watering-can-tilling-food-only-nights.md)).
- Sources: a dug well (clear or stagnant), the reservoir (cracked or not), ponds, the sea edge ([027](../decisions/027-watering-can-tilling-food-only-nights.md)). The HUD's water count shows the can's pours.
- The toolbar shows the fill level. The can's sprite shows full or empty.

### Seeds

- Shared stock `seeds`, a carried resource like food. Founder start **9** (first pass).
- Planting costs 1 seed. Harvesting a field tile gives back **1** (fixed), and a tree harvest **2**.
- With 0 seeds you can't plant. The toolbar shows "No seeds".

### World health and level

- **Health** `0–100`, recomputed from the world's condition. It rises with: tended and harvested tiles, stored water,
  structures in repair, upkeep met, wild stock recovering. It falls with: rotten or withered tiles, wear, stagnation,
  drought, missed upkeep, overfishing or overhunting. Weights and the formula: `01` › Section 13 values (first pass).
- **Level** starts at 0 (Bare) and **only rises**, by at most 1, at the **start of a generation** when health is at or
  above the next threshold (55, 65, 75, 85). A founder world is about 55.
- **HUD:** a health bar with no number, and the level's name.
- Every health change is a transition with causes, so the replay can say who raised or lowered it.

### Emergent orchards and flowers

| Level | Orchard plot | Flowers |
|---|---|---|
| 0 Bare | empty | none |
| 1 Taking root | saplings appear on the four tree tiles | a few near the house |
| 2 Green | young trees | spread along paths |
| 3 Blooming | fruiting trees (harvestable) | meadow patches |
| 4 Abundant | `[OPEN]` more trees / higher yield | full bloom |

- Trees still wear and can be maintained (`[OPEN]`: or does health replace their wear?). Level can't fall, so a tree
  can only die from wear, not from a level drop.
- Flowers are visual only for now (`[OPEN]`: do they feed health?).

### Toolbar and controls

- Slots: `1` hands (harvest, interact), `2` seeds, `3` watering can, `4–8` contextual structure actions. **E** uses the
  held tool on the facing tile, **F** fast-tracks. There's no Q: you eat at the oven.
- The prompt names the tile action ("E · Water"). Filling the can: "E · Fill can" at a source.

### Oven

- Facing the oven, "E · Cook and eat" takes `mealFood` (1) from the cabinet's store and adds `hungerPerFoodEaten` to
  hunger, up to full. It's free, takes 0.5 s, and is allowed when you're full. It's a logged action, `eat`, so the server
  re-run and the replay see it ([029](../decisions/029-eat-at-the-oven.md)).

## Task split (least merge conflicts)

| Person | Owns these folders in this section |
|---|---|
| **A** | `src/engine/**` (types, actions, turn, view, effects, replay), engine tests, `scripts/simulate.ts`, **new keys** in `config.ts` |
| **B** | `src/worldgen/**`, `src/render/**`, `src/store/**`, replay viewer in `src/ui/replay/` |
| **C** | `src/ui/hud/**`, `src/ui/kit/**`, `src/ui/screens/**`, `docs/content/**`, decision follow-ups, and **values** in `config.ts` after A's key PR merges |

Order: A lands the contract PR first (`types.ts`, new config keys, `visibleView` stages). B and C build against it.

## Tasks

**Contracts (do first)**

- [ ] **[A]** `types.ts`: `ActionType` swaps `plantOrchard` → `water`, `seeds` resource, `can` state, `health`/`level` on `WorldState`, new cause rules (`wither`, `health`, `level`)
- [ ] **[A]** Add the new config keys with placeholder values (can capacity, seed start/return, wither gens, health weights, level thresholds)
- [ ] **[A]** `visibleView`: per-tile stages (`sown`, `watered`, `growing`, `ripe`, `rotten`, `withered`), can fill, seeds, health bar value, level, tree and flower stages by level
- [ ] **[A]** Update `inheritance-core/references/ids.md` with the new IDs

**Engine (A)**

- [ ] **[A]** `plantCrops` (already per tile): costs 1 seed, leaves the tile `sown` with no ripening effect scheduled
- [x] **[A]** `water` action: needs a pour and a `sown` tile; schedules that tile's ripening effect *(built by B, [027](../decisions/027-watering-can-tilling-food-only-nights.md))*
- [x] **[A]** Can fill as a non-logged interaction with a source check; the can resets at turn start *(built by B as a free **logged** `fillCan`, so the server re-run sees the pours; [027](../decisions/027-watering-can-tilling-food-only-nights.md))*
- [ ] **[A]** Harvest returns seeds; tree harvest scaled by health; add `water` to `actionSeconds`
- [x] **[A]** Unwatered `sown` tiles carry over; `beginTurn` withers them 2 generations after planting *(built by B, [027](../decisions/027-watering-can-tilling-food-only-nights.md); tending clears a withered or rotten tile)*
- [ ] **[A]** Remove `plantOrchard`; the four tree tiles' stages follow level
- [ ] **[A]** Health recompute with causes, and the level-up rule (never down)
- [x] **[A]** Oven eat from store (refills hunger) *(built by B as a logged `eat` action, [029](../decisions/029-eat-at-the-oven.md))*
- [x] **[A]** Fast Track on a watered tile and on the other pending effects *(works unchanged: watering schedules the tile's ripening)*
- [ ] **[A]** Vitest: plant without water never ripens; water starts the clock; can empties; wither at +2 gens; seeds conserved; health causes; level never drops; still deterministic
- [ ] **[A]** `scripts/simulate.ts` strategies updated for tiles, can trips and seeds

**World and rendering (B)**

- [ ] **[B]** Worldgen: mark water-source tiles (pond edge, sea edge, well, reservoir) for can filling
- [ ] **[B]** Worldgen: flower spawn spots
- [x] **[B]** Render the new tile stages (sown, watered dark soil, withered) next to the existing ones *(borrowed frames with a tint until the atlas has their own; [027](../decisions/027-watering-can-tilling-food-only-nights.md))*
- [ ] **[B]** Held-tool state in the store, number-key switching, "Fill can" at sources *("Fill the can" at ponds, the sea edge, the well and the reservoir is done, [027](../decisions/027-watering-can-tilling-food-only-nights.md); held tool not yet)*
- [ ] **[B]** Watering FX (splash on the tile) and the can's full/empty sprite in hand
- [ ] **[B]** Trees and flowers appear and grow with level; flowers spread
- [x] **[B]** Oven interaction prompt in the house *([029](../decisions/029-eat-at-the-oven.md))*

**HUD, copy and numbers (C)**

- [x] **[C]** Toolbar component (slots, held tool, can fill pips, seed count)
- [x] **[C]** Health bar (no number) and level badge in the HUD
- [x] **[C]** Prompt and tooltip copy for Plant, Water, Fill can, Cook and eat, No seeds (`docs/content/flavour-text.md`)
- [x] **[C]** Cost summary: tiles planted and watered, seeds used and gained, health and level at the end of your day
- [x] **[C]** Tune the placeholders: can capacity, seed start and return, health weights, level thresholds, per-tile yields *(first pass in `01` › Section 13 values; re-check once `simulate.ts` models them)*
- [x] **[C]** Update `inheritance-player-facing`, `inheritance-core` and the `CLAUDE.md` rules to match decisions 023 and 026
- [x] **[C]** Update `01`, `04`, `05` and `10` text where this section changes them

**Carried over from the first plan** (also listed in their own sections; tick both)

- [ ] **[C]** `01` Write the "medium world" tuning scenario and check the dilemma holds (scenario written; re-run for tiles) *(re-run 2026-10-25: doesn't hold yet; tune after A's seeds, health and level, `01` › Balance after section 13)*
- [x] **[C]** `01` Write 3 balance test scenarios as Vitest fixtures: hoarder, planter, quick-fixer
- [x] **[C]** `05` Copywriting pass with Game design (tone: quiet, reflective, no moralising)
- [x] **[C]** `08` Tutorial scene (now: plant, water, fill the can, harvest) *(now the "How to play" pop-up built by B, with eating too, [033](../decisions/033-how-to-play-pop-up.md))*
- [ ] **[B]** `08` Error states: no network (claim and commit failed are done)
- [ ] **[B]** `06` Replay viewer, the world and its data: `ReplayWorld` (read-only snapshot render), `changedPlots` (per tile), `plotHistory` and plot clicks, health and level per generation (split in `06` › Replay viewer: who builds what)
- [x] **[C]** `06` Replay viewer, the screen around it: layout, timeline and stepping, auto-play, plot history popover, causes panel, copy (same split)
- [ ] **[C]** `10` Decide the new demo moment (the planted orchard is gone; see Open questions)
- [ ] **[C]** `10` Pick the demo seed, generation count and turn length
- [ ] **[C]** `10` Write the founder journal pages
- [x] **[C]** `06` (Stretch) Legacy view per player
- [ ] **[B]** `06` (Stretch) Animate drawing strokes in the journal panel

## Acceptance

- A player plants a tile, sees it stay as seed, fills the can at a pond, waters it, and watches only that tile grow.
- Two tiles next to each other, planted and watered at different times, ripen at different times.
- An unwatered seed is still there for the next player, and is withered two generations after it was planted.
- The HUD shows a health bar and level. Health falls when tiles rot; level never goes down.
- A sapling appears on the orchard plot when the world reaches level 1, with nobody planting it.
- `replay()` still rebuilds identical states, and every health change has a cause.

## Open questions

1. **Demo moment** without a planted orchard (deferred by the user). Candidates: a health legacy reveal in the replay, or
   keep one plantable orchard.
2. With stamina free (019), time and can trips are the only limits. Is that enough pressure, or does stamina come back?
3. Do trees still wear, or does health replace wear for them? What does level 4+ add?
4. Do flowers feed health, or are they visual only?
5. What to do with spare time once stamina runs out (sleep to end the day, shorter turns)? Left open after a playtest.
