# Cost summary wording

**From:** `01` (C) · **For:** `05` cost summary screen (C), built from `endTurn().summary` (A)

The cost summary shows **only what happened this turn**: what was spent, what was gathered, and whether there was
enough for the night. Anything planted or built appears **as a cost only**. Never mention what it will become,
who will benefit, or when. The demo moment depends on the orchard planter's screen saying only "Orchard −25⚡ −5💧".

## Layout

```
What you gave

You spent 92⚡.
You used 6💧 and gathered 8💧.
You gathered 17🍎.

  Orchard                 −25⚡  −5💧
  Crops sown ×1            −8⚡  −1💧
  Harvest ×1               −5⚡   +5🍎
  Hunt ×3                 −24⚡  +12🍎
  Well                    −20⚡   +8💧
  Tending ×1              −10⚡

For the night: 12🍎 10💧 — enough.

Left in the store: 4🍎 8💧
```

## Templates

| Line | Template | Shown when |
|---|---|---|
| Heading | What you gave | always |
| Stamina | You spent {n}⚡. | always (even 0) |
| Water | You used {spent}💧 and gathered {gained}💧. | always. Drop a half if it's 0 ("You used 6💧."); if both are 0: "You used no water." |
| Food | You gathered {gained}🍎. | always ("You gathered nothing." if 0) |
| Eating | You ate {n}🍎. | only if they ate at the oven ([029](../decisions/029-eat-at-the-oven.md)) |
| Rotted | One patch of crops rotted in the ground. / {n} patches of crops rotted in the ground. | only if crops were left in the ground at the end (`summary.cropsRotted`, one per field tile, [019](../decisions/019-per-tile-actions-take-time.md)) |
| Per-action rows | `{label}  −{stamina}⚡  {±water}💧  {+food}🍎` | one row per action type used; group repeats as "×N" |
| Upkeep met | For the night: {food}🍎 {water}💧 — enough. | upkeep met |
| Upkeep short | For the night: {food}🍎 {water}💧 — short by {x}🍎 {y}💧. | any shortfall (omit a zero part) |
| Store | Left in the store: {food}🍎 {water}💧 | always (after upkeep) |
| Seeds (`13`) | You used {used} seeds and gathered {gained}. | if any were used or gathered. Drop a half if it's 0 ("You used 6 seeds."); "1 seed" when singular |
| Land (`13`) | The land: {level name}. + the health bar, no number | always once health exists. As it stands at day's end, after upkeep |

Row labels (cost-only, past tense, no outcomes):

| Action | Row label |
|---|---|
| `plantOrchard` | Orchard |
| `plantCrops` | Crops sown (×N = tiles sown) |
| `water` | Crops watered (×N = tiles watered) |
| `fillCan` | Can filled |
| `eat` | Meal |
| `harvest` | Harvest / Harvest, eaten |
| `repairReservoir` | Reservoir wall |
| `digWell` | Well |
| `fishHunt` | Hunt (Forest) / Fishing (Island) |
| `maintain` | Tending |
| `fastTrack` | Hurried: {name}'s {thing} (e.g. "Hurried: AL's orchard") |

## Don'ts

- No "will", "later", "future", "successor", "pay off", "thank you". No yields for anything still growing.
- No judgement of the shortfall ("You failed", "You neglected"). Just the numbers.
- Never say what a sown or watered tile will give, or how many are "still growing". The land line shows how it is now,
  not whether it went up or down, and never "level up".
- Don't show the successor's weakened stamina here. It belongs to the next player's "You wake up tired".
- Rows for things that resolved *this turn* (crops sown and harvested) show their real gain. A rushed orchard shows its
  cost, and its harvest shows on its own Harvest row.

## Example: the demo planter (Gen 1)

```
What you gave

You spent 33⚡.
You used 5💧.
You gathered 4🍎.

  Orchard                 −25⚡  −5💧
  Hunt ×1                  −8⚡  +4🍎

For the night: 12🍎 10💧 — enough.

Left in the store: 4🍎 1💧
```

(Exact numbers come from the demo log in `10`. The point is that the orchard row is the only trace of the orchard.)
