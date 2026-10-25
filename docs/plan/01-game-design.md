# 01 — Game Design: Resources, Actions, Rules

**Owner:** Game design (with Engine)  
**Depends on:** nothing. This feeds `02-engine` (as `config.ts`) and `04`/`05` (what to show).

## Decisions (locked)

- Resources: **Food, Water, Labour (= player stamina)**, plus **hunger** ([016](../decisions/016-hunger.md)) and **seeds** ([022](../decisions/022-seed-stock.md)).
- Actions: Harvest, Plant Crops, **Water**, Repair Reservoir, Dig Well, Fish/Hunt, Maintain, Fast Track, plus the free `fillCan` at a source. Water will replace Plant Orchard ([021](../decisions/021-per-tile-farming-and-watering.md), [024](../decisions/024-emergent-orchards-and-flowers.md)); until trees come with level, Plant Orchard stays as a ninth action ([027](../decisions/027-watering-can-tilling-food-only-nights.md)).
- Unlimited actions within a configurable turn length. Stamina and resources are the real limits.
- End-of-turn **upkeep** (food + water). Missing it = **weakened start** for the successor.
- **Decay** (food rots, water stagnates) + **infrastructure wear** (structures degrade unless maintained).
- **Partly hidden** delayed effects: players see growth or decay visually, never the exact numbers or due dates.
- **Seeded events** only (e.g. a drought). No borrowing.
- **World health and level** are shown in the HUD: a health bar with no number and the land's name, Bare to Abundant ([023](../decisions/023-world-health-and-level.md)). They aren't a score: no points, no win. Nothing else new is shown during play ([026](../decisions/026-lift-no-explanation-rule.md)).
- The **reservoir dilemma is tuned in on purpose**.
- Biome (Forest / Island) gives **small modifiers** only.

Settled game-design questions (records in `docs/decisions/`):

- **Upkeep timing** ([002](../decisions/002-upkeep-timing.md)): the screen order stays freeze → journal → cost summary. ~~The HUD shows "Needed by nightfall"~~: the line is gone, and nights take **food only** ([027](../decisions/027-watering-can-tilling-food-only-nights.md)).
- **Eating** ([003](../decisions/003-eating-via-harvest.md)): yes, as an option on **Harvest** ("Harvest and eat"). It's not a ninth action.
- **Hunger** ([016](../decisions/016-hunger.md)): a meter the family inherits. It drops at each new generation; eating (free) refills it; empty, you walk slower.
- **Rushed orchard** ([004](../decisions/004-fast-tracked-orchard-yield.md)): no long-term yield penalty. *No longer applies once orchards grow from the level ([024](../decisions/024-emergent-orchards-and-flowers.md)).*
- **Plant, then water** ([021](../decisions/021-per-tile-farming-and-watering.md)): a sown tile grows only after one pour from the watering can. Unwatered seeds carry over and wither after 2 generations.
- **Oven** ([025](../decisions/025-oven-cooks-stored-food.md)): cooks stored food, so you can eat from the cabinet.
- **Events** ([005](../decisions/005-seeded-events.md)): drought (always), good harvest, storm (Island only).
- **Wild spot** ([006](../decisions/006-wild-spot-per-biome.md)): Forest = hunt, Island = fish, same numbers.
- **Defaults** ([007](../decisions/007-turn-and-generation-defaults.md)): **10-minute turns**, **6 generations**.
- **Fields** (B's [001](../decisions/001-worldgen-map-size-and-presets.md)): configurable per map preset, default **2**. All numbers here are balanced for 2. The `small` (1 field) and `large` (3 fields) presets are untuned.

## Design goal: avoid a morality game

Every action has to be something a reasonable person would choose. There is no "good" button.
The tension comes from:

1. **Your own survival vs. the future.** Upkeep is real, and failing it hurts your successor.
2. **Cashing in vs. preserving.** Fast Track lets you take a predecessor's gift early, at double cost. Eating a harvest buys stamina now with food the next player won't get.
3. **Quick fixes with a tail.** The well gives water now, but it obliges every later player to maintain it.
4. **Commons depletion.** Fish/Hunt stock is shared across generations and recovers slowly.
5. **Invisible protection.** Repairing the reservoir does nothing you can see in your own turn. It only matters when the seeded drought arrives.

Self-check for every balance change: *could a thoughtful player defend each option?*

## Core loop (one generation)

1. **Inherit.** Spawn in the world. Resources, structures and graveyard are as the previous player left them, after decay, wear, due effects and events have been applied. The journal is on a lectern and openable any time.
2. **Act.** The timer runs and day turns to night. Walk to plots and act. Each action costs stamina (and sometimes water). The HUD shows what's needed by nightfall.
3. **Freeze.** The timer hits 0, the world freezes, and input locks.
4. **Journal.** Write or draw your page. Earlier pages are read-only.
5. **Cost summary.** Shows only what was **realised** this turn, including whether upkeep was met. Pending benefits are left out.
6. **Upkeep check.** Food is deducted (water no longer, {D}). A shortfall marks the successor as weakened. (The engine computes this at freeze in `endTurn`. The cost summary is where the player sees it.)
7. **Gravestone.** Your stone is placed in the graveyard. The turn is committed.
8. **Between turns (engine).** Decay, wear, due effects, seeded events and wild stock regrowth are applied for the next generation.

## Resources

| Resource | Source | Sink | Between-generation rule |
|---|---|---|---|
| **Food** | Harvest (crops, orchard), Fish/Hunt | Upkeep, eating (Harvest and eat) | Kept in the house's cabinet. **Doesn't rot for now** (`foodRotPct: 0`, [011](../decisions/011-cabinet-food-store-no-rot.md)) |
| **Water** | Reservoir income, Well, starter stock | Plant Orchard, Fast Track (no longer upkeep, {D}). Crops are watered from the **can**, which fills free at a pond, the sea edge, the well or the reservoir | **Stagnates**: loses `waterStagnatePct` (20%), or 40% while the well is stagnant |
| **Labour (stamina)** | Full pool at turn start (reduced if weakened) | Every action | Doesn't carry over |
| **Seeds** | Founder stock `seedStart` (9); +1 per harvested field tile, +2 per tree harvest | Plant Crops (1 per tile); withered tiles lose theirs | **Carries over** in full ([022](../decisions/022-seed-stock.md)) |
| **Hunger** | Eating (Harvest and eat, or Cook and eat at the oven), `hungerPerFoodEaten` (10) per food, up to `hungerMax` (100) | — | **Carries over**, and drops by `hungerDropPerGen` (30) at each new generation. At or below `hungerSlowAt` (0) the player walks slower ([016](../decisions/016-hunger.md)) |

## Structures & plots (pre-defined sites)

| Plot | States (visual) | Notes |
|---|---|---|
| Field ×2 | empty → sown → watered → growing → ripe → rotten / withered, **per tile** | Quick crops ripen within one turn **once watered**. Each of the 9 tiles is sown, watered and harvested on its own ([019](../decisions/019-per-tile-actions-take-time.md), [021](../decisions/021-per-tile-farming-and-watering.md)) |
| Orchard plot | empty → sapling → young → fruiting → (worn → dead), **per tree** | Four one-tile trees. **They appear and grow with the land's level** (sapling at 1, young at 2, fruiting at 3), with nobody planting them ([024](../decisions/024-emergent-orchards-and-flowers.md)). Each is picked, tended and worn on its own |
| Water sources | — | Dug well, reservoir, pond and sea edge fill the watering can, for free ([021](../decisions/021-per-tile-farming-and-watering.md)) |
| Flowers | none → spreading | Appear with the level, visual only for now ([024](../decisions/024-emergent-orchards-and-flowers.md)) |
| Reservoir | cracked → low / full | Not repaired = cracked. Repaired with wear ≥ 2 = low. Repaired with wear < 2 = full. Sets water income and drought protection. |
| Well site | none → clear → (stagnant at wear 3) | Instant + ongoing water, needs maintaining |
| Wild spot | stock level: many / few / none | Forest → hunting ground, Island → fishing spot |
| Lectern (journal) | — | Always available |
| Graveyard | one stone per completed turn | Click a stone to open that player's page |

## Actions

> **Changed by [019](../decisions/019-per-tile-actions-take-time.md):** fields and orchards are worked a tile at a
> time, every stamina cost is **0 for now**, and each action takes time instead (`actionSeconds`: harvest 1 s, sow
> 1.5 s, plant a tree 3 s, repair 8 s, dig 6 s, fish/hunt 3 s, tend 3 s, hurry 2 s). Yields are per tile: **1 food per
> field tile, 4 per tree**. Sowing needs no water; a tree needs 1. The table below is the earlier whole-plot set, kept
> for when stamina comes back.
>
> **Changed by `13`:** Plant Crops costs 1 seed and leaves the tile sown until a **Water** action (1 pour from the can,
> 1 s) starts its ripening clock. **Plant Orchard is removed**: trees come from the level. See `13` › Actions.

Values below are the first confirmed set for `src/engine/config.ts` (full block under **Config values**).
They passed a rough scratch-model check (see **Balance pre-check**). The real check is task 4 with `scripts/simulate.ts`.

| # | Action | Target | Immediate | Delayed / tail | Cost |
|---|---|---|---|---|---|
| 1 | **Harvest** | ripe field or fruiting orchard | +5 food (field) or +15 food (orchard, once per gen, halved at wear ≥ 2). **Harvest and eat** option: see below. | — | 5 stamina |
| 2 | **Plant Crops** | empty field | — | Ripens after `cropRipenPct` × turn (25%, so 150 s at the default) **in the same turn**. Rots at end of turn if not harvested. | 8 stamina, 1 water |
| 3 | **Plant Orchard** | empty or dead orchard plot | — | Fruits from gen +2. Harvestable once per later gen while it survives wear. | 25 stamina, 5 water |
| 4 | **Repair Reservoir** | cracked or low reservoir | — | From gen +1: water income 4 → 12/gen (6 at wear 2), and drought protection while wear < 2. Wear resets to 0. | **60 stamina** (the dilemma) |
| 5 | **Dig Well** | well site, not yet dug | +8 water | +6 water/gen while wear < 3 (3 at wear 2). At wear 3 it stagnates: 0 income and stored water stagnates at 40%. Maintain brings a stagnant well back. | 20 stamina |
| 6 | **Fish/Hunt** | wild spot with stock > 0 | +4 food | Wild stock −1; regrows +1/gen up to the biome cap | 8 stamina |
| 7 | **Maintain** | dug well (including stagnant), repaired reservoir, or living orchard | Wear on that structure reset to 0 | It also skips the next generation's wear tick. Once per structure per turn. | 10 stamina |
| 8 | **Fast Track** | any pending effect (anyone's) | That effect resolves **now** | It no longer happens later | **2× the original action's cost** (stamina + water), paid now |

### Harvest and eat

- Harvest has two variants: **Harvest** (E, yield goes to the store, 5 stamina) and **Harvest and eat** (Q, **free**).
- Eating turns the fresh yield into **hunger** at `hungerPerFoodEaten` (10 per food), **up to full** (`hungerMax`). Whatever can't be eaten goes to the store. It's refused when hunger is already full ([016](../decisions/016-hunger.md), which replaced 003's eat-for-stamina).
- Only the food just harvested can be eaten here. Stored food is eaten at the **oven** ("Cook and eat", [025](../decisions/025-oven-cooks-stored-food.md)), and Fish/Hunt catches go to the store.
- Eating doesn't give stamina, so a weakened player can't eat their way back; hunger is a separate, inherited need.
- Eating is realised, so it appears in the cost summary ("You ate 15🍎").

### Why the reservoir dilemma works

- Starting stamina 100. Upkeep 12 food + 10 water. Repair = 60 stamina.
- In the **medium world** (below), feeding comfortably costs about 44 stamina and repairing costs 60. Doing both needs about 104. You can repair *and* scrape by on bare upkeep, but only by letting the well and orchard wear.
- Skipping the repair is safe until the seeded drought, which can start any time from gen 2 (decision 008).
- **Tuning target:** a player who inherits a "medium" world can either repair *or* comfortably feed themselves, not both.

### Medium world (tuning scenario, task 4)

| | Value |
|---|---|
| Generation | 3 of 6, not weakened (100 stamina), no drought this gen |
| Food / water | 6 / 12 |
| Wild stock | 4 |
| Reservoir | cracked |
| Well | dug, wear 1 |
| Orchard | sapling (planted gen 2), wear 1 |
| Fields | 2, empty |

**Comfortable** = upkeep met + well and orchard maintained + at least 6 food left after upkeep.
**Pass** = "repair + comfortable" is not reachable with 100 stamina, while each alone is.
Run it with `scripts/simulate.ts` once it exists (repair-first vs feed-first strategies).

### Fast Track details

- Shows every pending effect in the world, including other players' (e.g. "Orchard planted, Gen 1").
- Cost = 2× the original cost (stamina + water), paid by the current player. Rushing an orchard = 50 stamina, 10 water.
- Fast-tracking an orchard brings it to fruiting now, with **no long-term yield penalty** ([004](../decisions/004-fast-tracked-orchard-yield.md)). Its wear is unchanged.
- It records its own action and its own cause chain, so the replay can say *"MO rushed AL's orchard"*.

## Decay & wear (between generations)

Generation 1 starts from the starter state exactly: `beginTurn` for gen 1 applies no decay, wear or income.

| Rule | Value |
|---|---|
| Food rot | Off for now: stored food is kept in the cabinet ([011](../decisions/011-cabinet-food-store-no-rot.md)) |
| Water stagnation | −20% of stored water (−40% while the well is stagnant) |
| Unharvested crops | Rot at end of turn (lost) |
| Structure wear | +1 per gen on built structures (repaired reservoir, dug well, planted orchard) unless maintained during the previous turn. At wear 2: output halved. At wear 3: broken (orchard dies, reservoir cracks, well stagnates). |
| Wild stock regrowth | +1 per gen, up to the biome cap |

## Upkeep & soft fail

- End of turn: deduct `upkeepFood` (12) and `upkeepWater` (10).
- Shortfall ratio `s` = missing ÷ required (0–1, averaged over food and water).
- Successor's starting stamina = `baseStamina × (1 − s × weakenFactor)` with `weakenFactor` 0.6, floored at 40%.
- The world shows **blight visuals** for that generation (see `04`).
- The world never fully ends. The weakened player can always still act.

## Seeded events

- Derived from the world seed at creation, so they're fully deterministic and replayable.
- Hackathon set ([005](../decisions/005-seeded-events.md), drought timing from B's [008](../decisions/008-drought-length-and-timing.md)):
  - **Drought**: exactly one per world, lasting `min(droughtMaxLength, ceil(generationCount × droughtLengthFraction))` consecutive generations (1 gen at the default 6), starting at a random gen ≥ 2 (gen 1 only in a 1-gen world). In each drought generation, unless the reservoir is repaired with wear < 2: reservoir income ×0.3 and stored water −25%.
  - **Good harvest**: one per world, outside the drought's generations. Crop yield ×1.5 that generation.
  - **Storm** (Island only): 50% chance of one per world, outside the drought's generations. +1 wear on every built structure. The first thing to cut if time runs short.
- **Events are never announced to the player.** They only show up through visuals (cracked earth, rain) and in the replay.

## Biome modifiers (small)

| Biome | Modifier |
|---|---|
| **Forest** | Hunting ground; wild stock cap 10; starting water 16 |
| **Island** | Fishing spot; wild stock cap 8; starting water 18; storm event eligible |

## Founder / Gen-1 starter conditions

What the founder sees. B wires these into `createWorld` (`03`).

| | Forest | Island |
|---|---|---|
| Food | 12 | 12 |
| Water | 16 | 18 |
| Wild stock | 8 (cap 10), hunting | 8 (cap 8), fishing |
| Reservoir | cracked | cracked |
| Fields | 2, empty | 2, empty |
| Orchard plot | empty | empty |
| Well | not dug | not dug |
| Stamina | 100 | 100 |

The founder can meet upkeep from the starter stores alone (12 food, 16–18 water) with no actions.
Anything they invest comes out of the margin they leave the next player.

## Configurable per world

`turnSeconds` (default **600**), `generationCount` (default **6**), plus the admin-set global `inheritRatio` (see `07`).
The demo world sets its own shorter values (`10`).

## Config values

For `src/engine/config.ts`. Names are a proposal for the engine dev; the numbers are the decision.

```ts
export const CONFIG = {
  // World defaults (decision 007)
  turnSeconds: 600,
  generationCount: 6,
  // fields: a worldgen preset option (src/worldgen/options.ts, default 2), not engine config

  // Stamina, upkeep, soft fail
  baseStamina: 100,
  upkeepFood: 12,
  upkeepWater: 10,
  weakenFactor: 0.6,
  minStaminaPct: 0.4,

  // Hunger (decision 016)
  hungerMax: 100,
  hungerDropPerGen: 30,
  hungerPerFoodEaten: 10, // Harvest and eat
  hungerSlowAt: 0,
  hungrySpeedMult: 0.6,

  // Actions. Stamina costs are 0 for now and fields/orchards are per tile (decision 019);
  // the earlier whole-plot costs are in the comments.
  harvestCost: 0, // was 5
  harvestEatCost: 0, // decision 016
  cropYield: 1, // per field tile (was 5 per field)
  orchardYield: 4, // per tree, once per generation (was 15 per orchard)
  plantCropsCost: 0, // was 8
  plantCropsWater: 0, // was 1 per field
  cropRipenPct: 0.25, // fraction of turnSeconds
  plantOrchardCost: 0, // was 25
  plantOrchardWater: 1, // per tree (was 5 per orchard)
  orchardMatureGens: 2,
  repairReservoirCost: 0, // was 60
  reservoirIncomeCracked: 4,
  reservoirIncomeRepaired: 12,
  digWellCost: 0, // was 20
  digWellWater: 8,
  wellIncome: 6,
  fishHuntCost: 0, // was 8
  fishHuntYield: 4,
  maintainCost: 0, // was 10
  fastTrackMultiplier: 2,
  // Seconds each action takes; the player stands still meanwhile (decision 019)
  actionSeconds: { harvest: 1, plantCrops: 1.5, plantOrchard: 3, repairReservoir: 8, digWell: 6, fishHunt: 3, maintain: 3, fastTrack: 2 },

  // Decay and wear
  foodRotPct: 0, // decision 011: stored food doesn't rot for now (was 0.3)
  waterStagnatePct: 0.2,
  waterStagnateStagnantWellPct: 0.4,
  wearHalveAt: 2,
  wearBreakAt: 3,
  wildRegrow: 1,

  // Events (decision 005; drought timing decision 008)
  droughtLengthFraction: 0.1,
  droughtMaxLength: 5,
  droughtIncomeMult: 0.3,
  droughtEvaporatePct: 0.25,
  goodHarvestMult: 1.5,
  stormWear: 1,
  stormChance: 0.5,

  // Biomes: founder starter state
  biomes: {
    forest: { food: 12, water: 16, wildStock: 8, wildCap: 10, storm: false },
    island: { food: 12, water: 18, wildStock: 8, wildCap: 8, storm: true },
  },
} as const;
```

### Section 13 values (first pass)

Approved 2026-10-25 by the user as a **first pass**. They can't be balance-checked until `scripts/simulate.ts` models tiles,
the can, seeds and health (`13`, A). The keys are proposals for A, who adds them to `config.ts`; C owns the values.

```ts
  // Watering can (decision 021)
  // canCapacity 4, empty every morning, water 1 s, fillCan 1.5 s: built by 027, kept by the user (was proposed as 3)

  // Seeds (decision 022)
  seedStart: 9, // one full field
  seedsPerCrop: 1, // fixed, per harvested field tile
  seedsPerTree: 2, // per tree harvest, so a fruiting orchard grows the stock
  witherGens: 2, // an unwatered seed withers 2 generations after sowing

  // World health 0–100 (decision 023): each part is 0..1, weighted
  healthWeights: { crops: 0.25, water: 0.2, structures: 0.25, upkeep: 0.15, wild: 0.15 },
  // crops      = tended / (tended + rotten + withered) tiles; 0.5 with nothing planted
  // water      = stored water / healthWaterReserve, at most 1 (nights take no water since 027)
  // structures = mean over reservoir and well of (1 − wear / wearBreakAt); cracked or not dug = 0
  // upkeep     = 1 − the last upkeep shortfall
  // wild       = wildStock / wildCap
  healthWaterReserve: 20, // stored water that counts as a full reserve
  orchardYieldLowHealth: 50, // below this health a tree gives half

  // Level (decision 023): checked at each generation start, rises by at most 1, never falls
  levelThresholds: [55, 65, 75, 85], // health needed for levels 1–4
```

A founder world comes out at about **55** (Forest: crops 0.5, water 0.8, structures 0, upkeep 1, wild 0.8), so it
reaches **Taking root** at the start of generation 2 and the first saplings appear. Trees fruit at **Blooming** (75), which
needs the reservoir or the well in good repair. With at most one level per generation, the earliest fruit is generation 4
of 6.

Yields stay as [019](../decisions/019-per-tile-actions-take-time.md) set them: 1 food per field tile, 4 per tree.

## Balance pre-check (scratch model)

A rough Python model of the rules above, run before the engine exists. It isn't the engine, so treat it as a sanity check only.
6 gens, drought gen 5, good harvest gen 3, Island storm gen 4:

| Strategy | Forest: missed upkeep | Island: missed upkeep | Final world |
|---|---|---|---|
| Selfish (well when short, fish freely, crops) | gen 5 | gens 4–6 | reservoir cracked, no orchard, wild stock 0 |
| Hoarder (stockpile, keep the well) | gens 5–6 | gen 5 | reservoir cracked, no orchard |
| Quick-fixer (well + fishing, maintains well) | gen 5 | gen 5 | reservoir cracked, wild stock 0 |
| Planter (orchard + reservoir, then eat) | none | none | everything standing, thin stores |
| Mixed (upkeep first, invest with the rest) | none | none | everything standing, food ~50 |

What it shows: short-term play holds up until the drought and then fails, which is the "invisible protection" working.
**Known gap:** the pure-sacrifice run leaves the investing generations with almost nothing spare, but doesn't actually miss upkeep.
The acceptance line asks for missed upkeep, so check this in task 4. The levers, in order: starter food 12 → 11, repair 60 → 65.
The model doesn't include Harvest and eat yet.

## Balance after section 13 (engine run, 2026-10-25)

`npm run simulate -- --gens 6`, seed 1, on the engine as it stands: per-tile farming and watering (027), stamina a
placeholder at 0, nights taking 12 food and no water, no seeds, health or level yet.

| Strategy | Forest food, gen 1 → 6 | Missed upkeep | Final world |
|---|---|---|---|
| Hoarder (well, two crop cycles a day) | 72 → 192 | none | reservoir cracked, no orchard |
| Planter (orchard + reservoir) | 18 → 8 | none | everything standing |
| Repair first | 36 → 66 | none | reservoir full |
| Quick-fixer (well + hunting) | 32 → 0 | gen 6 | wild stock 0 |

Island is the same within a few points. **The dilemma doesn't hold.** Hoarding costs the hoarder nothing, investing never
costs upkeep, and in the medium world one day fits both the repair and comfortable feeding. Nothing in a day binds:
stamina is 0, and the action times add up to a few seconds of a 600 s day (the simulator doesn't count walking).

The fixtures in `scripts/__tests__/balance.test.ts` hold the `01` targets. The three that fail today are marked `it.fails`
with these gaps, and turn red once the numbers fix them. **Tune after A lands seeds ([022](../decisions/022-seed-stock.md),
caps sowing) and health and level ([023](../decisions/023-world-health-and-level.md), gives investment a payoff)**, as
both change this picture (decided 2026-10-25 by the user). Levers then, in order: `seedStart` and `seedsPerCrop`,
`upkeepFood`, `cropRipenPct` (one crop cycle a day instead of two), `foodRotPct`.

## Tasks

- [x] **[C]** Confirm the action table (costs, yields, delays) and record it as `config.ts` values with the engine dev
- [x] **[C]** Decide defaults for `turnSeconds` and `generationCount`
- [x] **[C]** Decide the open questions above (eating, rushed-orchard yield, event set, fishing vs hunting per biome)
- [ ] **[C]** Write the **"medium world" tuning scenario** and check the dilemma holds (use the engine's simulated playthrough script from `02`). *Scenario written and checked (`scripts/__tests__/balance.test.ts`): it doesn't hold yet. Tune after seeds, health and level land; see "Balance after section 13".*
- [x] **[C]** Write 3 balance test scenarios as Vitest fixtures: *hoarder*, *planter*, *quick-fixer*. Check no single strategy dominates over N gens. *(`scripts/__tests__/balance.test.ts`, 6 gens, both biomes, plus the medium world. Today the hoarder dominates; the missed targets are `it.fails` until tuning, see "Balance after section 13".)*
- [x] **[C]** Write the in-world flavour text: action names, plot names, short tooltips (no numbers on delayed effects). See `docs/content/flavour-text.md`.
- [x] **[C]** Write the founder/Gen-0 starter conditions per biome (see `03`)
- [x] **[C]** Hand `05` the cost-summary wording ("You spent… You gathered…") with no mention of future yields. See `docs/content/cost-summary.md`.

## Acceptance

- Every action has a cost, an immediate effect, a delayed effect (or none), and a visual state defined.
- A simulated "all-selfish" run ends in a visibly worse final world than a "mixed" run. A "pure sacrifice" run causes upkeep failures along the way, so no single strategy is obviously right.
- All tunables live in one config file.

## Open questions

1. **Idle time in 10-minute turns.** With 100 stamina, most players will spend it all well before nightfall.
   Should there be a way to end the day early (e.g. "Sleep" at the lectern), or is spare time for reading the journal and walking around?
   Touches `04` (HUD/timer) and `07` (lock TTL scales with `turn_seconds`).

