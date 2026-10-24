# 01 — Game Design: Resources, Actions, Rules

**Owner:** Game design (with Engine)  
**Depends on:** nothing. This feeds `02-engine` (as `config.ts`) and `04`/`05` (what to show).

## Decisions (locked)

- Resources: **Food, Water, Labour (= player stamina)**.
- Eight actions: Harvest, Plant Crops, Plant Orchard, Repair Reservoir, Dig Well, Fish/Hunt, Maintain, Fast Track.
- Unlimited actions within a configurable turn length. Stamina and resources are the real limits.
- End-of-turn **upkeep** (food + water). Missing it = **weakened start** for the successor.
- **Decay** (food rots, water stagnates) + **infrastructure wear** (structures degrade unless maintained).
- **Partly hidden** delayed effects: players see growth or decay visually, never the exact numbers or due dates.
- **Seeded events** only (e.g. a drought). No borrowing, no score.
- The **reservoir dilemma is tuned in on purpose**.
- Biome (Forest / Island) gives **small modifiers** only.

## Design goal: avoid a morality game

Every action has to be something a reasonable person would choose. There is no "good" button.
The tension comes from:

1. **Your own survival vs. the future.** Upkeep is real, and failing it hurts your successor.
2. **Cashing in vs. preserving.** Fast Track lets you take a predecessor's gift early, at double cost.
3. **Quick fixes with a tail.** The well gives water now, but it obliges every later player to maintain it.
4. **Commons depletion.** Fish/Hunt stock is shared across generations and recovers slowly.
5. **Invisible protection.** Repairing the reservoir does nothing you can see in your own turn. It only matters when the seeded drought arrives.

Self-check for every balance change: *could a thoughtful player defend each option?*

## Core loop (one generation)

1. **Inherit.** Spawn in the world. Resources, structures and graveyard are as the previous player left them, after decay, wear, due effects and events have been applied. The journal is on a lectern and openable any time.
2. **Act.** The timer runs and day turns to night. Walk to plots and act. Each action costs stamina (and sometimes water or food).
3. **Freeze.** The timer hits 0, the world freezes, and input locks.
4. **Journal.** Write or draw your page. Earlier pages are read-only.
5. **Cost summary.** Shows only what was **realised** this turn. Pending benefits are left out.
6. **Upkeep check.** Food/water are deducted. A shortfall marks the successor as weakened.
7. **Gravestone.** Your stone is placed in the graveyard. The turn is committed.
8. **Between turns (engine).** Decay, wear, due effects, seeded events and wild stock regrowth are applied for the next generation.

> Open: should upkeep be checked *before* the journal, so the player knows whether they've failed while writing?
> The current order has the cost summary after the journal.

## Resources

| Resource | Source | Sink | Between-generation rule |
|---|---|---|---|
| **Food** | Harvest (crops, orchard), Fish/Hunt | Upkeep, Fast Track costs | **Rots**: loses `foodRotPct` per generation |
| **Water** | Reservoir income, Well, starter stock | Upkeep, Plant Crops/Orchard, Fast Track | **Stagnates**: loses `waterStagnatePct`; well water stagnates faster when unmaintained |
| **Labour (stamina)** | Full pool at turn start (reduced if weakened) | Every action | Doesn't carry over |

## Structures & plots (pre-defined sites)

| Plot | States (visual) | Notes |
|---|---|---|
| Field(s) ×N | empty → sown → growing → ripe → rotten | Quick crops can ripen within one turn |
| Orchard plot | empty → sapling → young → fruiting → (worn → dead) | Matures at gen +`orchardMatureGens` |
| Reservoir | cracked → repaired → (wear) | Sets water income and drought protection |
| Well site | none → dug → (stagnant if unmaintained) | Instant + ongoing water, needs upkeep |
| Fishing spot / hunting ground | stock level (visual abundance) | Island → fishing, Forest → hunting (open: confirm) |
| Lectern (journal) | — | Always available |
| Graveyard | one stone per completed turn | Click a stone to open that player's page |

## Actions

All numbers are **`[PLACEHOLDER]`** values for `src/engine/config.ts`.

| # | Action | Target | Immediate | Delayed / tail | Proposed cost |
|---|---|---|---|---|---|
| 1 | **Harvest** | ripe field or fruiting orchard | +food (crop: 6, orchard: 15) | — | 5 stamina |
| 2 | **Plant Crops** | empty field | — | Ripens after `cropRipenSeconds` (≈25% of turn) **in the same turn**. Rots at end of turn if not harvested. | 8 stamina, 2 water |
| 3 | **Plant Orchard** | orchard plot | — | Fruits from gen +2; yields each later gen while maintained | 25 stamina, 5 water |
| 4 | **Repair Reservoir** | reservoir | — | From gen +1: water income rises (e.g. 4 → 12/gen) and drought penalty is cancelled | **55 stamina** (the dilemma) |
| 5 | **Dig Well** | well site | +8 water | +4 water/gen **while maintained**; unmaintained → stagnates and gives 0, and stored water decays faster | 20 stamina |
| 6 | **Fish/Hunt** | fishing/hunting spot | +5 food | Wild stock −1; regrows +1/gen up to a cap | 6 stamina |
| 7 | **Maintain** | well, reservoir, orchard | Wear on that structure reset to 0 | Prevents stagnation/decline | 10 stamina |
| 8 | **Fast Track** | any pending effect (anyone's) | That effect resolves **now** | It no longer happens later | **2× the original action's cost**, paid now |

### Why the reservoir dilemma works (with placeholder numbers)

- Starting stamina 100. Upkeep 10 food + 10 water.
- Repair = 55 stamina. That leaves 45, enough for about 4 Fish/Hunt (+20 food) or 2 crop cycles.
- If the player inherits low food, repairing means risking upkeep. Skipping it means the seeded drought hits a successor.
- **Tuning target:** a player who inherits a "medium" world can either repair *or* comfortably feed themselves, not both.

### Fast Track details

- Shows every pending effect in the world, including other players' (e.g. "Orchard planted, Gen 1").
- Cost = 2× the original cost (stamina + resources), paid by the current player.
- Fast-tracking an orchard brings it to fruiting now. **Open:** does a rushed orchard yield less long-term?
- It records its own action and its own cause chain, so the replay can say *"MO rushed AL's orchard"*.

## Decay & wear (between generations)

| Rule | `[PLACEHOLDER]` |
|---|---|
| Food rot | −30% of stored food |
| Water stagnation | −20% of stored water (−40% if the well is stagnant) |
| Unharvested crops | Rot at end of turn (lost) |
| Structure wear | +1 wear level per gen. At wear 2: output halved. At wear 3: broken (orchard dies, reservoir cracks, well stagnates). |
| Wild stock regrowth | +1 per gen, cap 8 |

## Upkeep & soft fail

- End of turn: deduct `upkeepFood` (10) and `upkeepWater` (10).
- Shortfall ratio `s` = missing ÷ required (0–1, averaged over food and water).
- Successor's starting stamina = `baseStamina × (1 − s × weakenFactor)`, floored at 40%. `[PLACEHOLDER]`
- The world shows **blight visuals** for that generation (see `04`).
- The world never fully ends. The weakened player can always still act.

> Open: can the player **eat** mid-turn to restore stamina (spending food)? That would be a strong extra tension: eat now vs. leave food. It isn't decided yet.

## Seeded events

- Derived from the world seed at creation, so they're fully deterministic and replayable.
- Hackathon set (suggested, needs confirming):
  - **Drought**: exactly one per world, lasting `min(5, ceil(generationCount / 10))` consecutive generations and starting at a random gen ≥ 2 (gen 1 only in a 1-gen world). Reservoir income −70% unless the reservoir is repaired and wear < 2 ([008](../decisions/008-drought-length-and-timing.md)).
  - **Good harvest**: +50% crop yield in one gen.
  - **Storm** (Island only?): +1 wear on all structures.
- **Events are never announced to the player.** They only show up through visuals (cracked earth, rain) and in the replay.

## Biome modifiers (small)

| Biome | `[PLACEHOLDER]` modifier |
|---|---|
| **Forest** | Hunting ground; wild stock cap +2; water start −10% |
| **Island** | Fishing spot; water start +10%; storm event eligible |

## Configurable per world

`turnSeconds`, `generationCount`, plus the admin-set global `inheritRatio` (see `07`).
**Default values: game designer to decide.**

## Tasks

- [ ] **[C]** Confirm the action table (costs, yields, delays) and record it as `config.ts` values with the engine dev
- [ ] **[C]** Decide defaults for `turnSeconds` and `generationCount`
- [ ] **[C]** Decide the open questions above (eating, rushed-orchard yield, event set, fishing vs hunting per biome)
- [ ] **[C]** Write the **"medium world" tuning scenario** and check the dilemma holds (use the engine's simulated playthrough script from `02`)
- [ ] **[C]** Write 3 balance test scenarios as Vitest fixtures: *hoarder*, *planter*, *quick-fixer*. Check no single strategy dominates over N gens.
- [ ] **[C]** Write the in-world flavour text: action names, plot names, short tooltips (no numbers on delayed effects)
- [ ] **[C]** Write the founder/Gen-0 starter conditions per biome (see `03`)
- [ ] **[C]** Hand `05` the cost-summary wording ("You spent… You gathered…") with no mention of future yields

## Acceptance

- Every action has a cost, an immediate effect, a delayed effect (or none), and a visual state defined.
- A simulated "all-selfish" run ends in a visibly worse final world than a "mixed" run. A "pure sacrifice" run causes upkeep failures along the way, so no single strategy is obviously right.
- All tunables live in one config file.

## Open questions (recap)

1. Upkeep check before or after the journal?
2. Can the player eat mid-turn to restore stamina?
3. Does a fast-tracked orchard have reduced long-term yield?
4. Final seeded event list and timing.
5. Forest = hunt / Island = fish, or both available everywhere?
6. Defaults for turn length and generation count.
7. How many fields per map?
