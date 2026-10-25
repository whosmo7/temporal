# In-world text: actions, plots, tooltips, errors

**From:** `01` (C) · **For:** `04` hotbar, prompts and hover names (B), `08` tutorial (C), `09` icon names (C)

Rules (from `inheritance-player-facing`): describe, don't judge. A prompt may show the **cost** of an action, never what it will
yield later or when. Use the words a farmer would use. Keys are the canonical IDs, so these strings can move into
`src/content/` as they are once the scaffold exists.

## Actions

Fields and orchards are worked a tile at a time, and every action takes a moment instead of stamina for now
([019](../decisions/019-per-tile-actions-take-time.md)), so the prompts below show no stamina cost. Section `13` adds
watering ([021](../decisions/021-per-tile-farming-and-watering.md)), seeds ([022](../decisions/022-seed-stock.md)) and the oven
([025](../decisions/025-oven-cooks-stored-food.md)), and removes Plant trees ([024](../decisions/024-emergent-orchards-and-flowers.md)).

| ID | Hotbar label | Interact prompt | Tooltip |
|---|---|---|---|
| `harvest` | Harvest | Harvest | Gather what's ripe into the store. |
| `harvest` + `eat` | Harvest and eat (Q) | Harvest and eat (free, [016](../decisions/016-hunger.md)) | Eat what you gather now. What you can't eat goes to the store. |
| `plantCrops` | Sow | Sow crops · 1 seed | A seed in the ground. It needs water before it will take. |
| `water` (`13`) | Water | Water | Wet the soil around the seed. One pour from the can. |
| ~~`plantOrchard`~~ | — | — | Removed in `13`: trees come up on their own as the land recovers. Kept until the engine drops it: Plant trees · Plant a tree · 1💧 · "A sapling. It takes its time." |
| `repairReservoir` | Repair | Repair the reservoir wall | Patch the cracks and rebuild the wall. |
| `digWell` | Dig | Dig a well | Water from the ground. A well needs looking after. |
| `fishHunt` (Forest) | Hunt | Hunt | Set snares along the tree line. |
| `fishHunt` (Island) | Fish | Fish | Cast a line off the rocks. |
| `maintain` (well) | Tend | Clear the well | Scrape it out and keep the water moving. |
| `maintain` (reservoir) | Tend | Shore up the wall | Fill the small cracks before they spread. |
| `maintain` (orchard) | Tend | Prune the tree | Cut back the dead wood. |
| `fastTrack` | Hurry | Hurry this along · {cost} | Push someone's work along now, at twice the effort. |

## Tools and things you use (`13`)

| What | Toolbar label | Prompt | Tooltip |
|---|---|---|---|
| Hands (slot 1) | Hands | (the plot's own action, e.g. Harvest) | Pick, pull and carry. |
| Seeds (slot 2) | Seeds · {n} | Sow crops · 1 seed | Seed for the fields. |
| Watering can (slot 3) | Can | Water | Fill it at the well, the reservoir, a pond or the sea. |
| Fill the can, at a source | — | Fill the can | — |
| Oven ([025](../decisions/025-oven-cooks-stored-food.md)) | — | Cook and eat | Cook something from the store. |

The can's pours show as small pips beside its icon, filled or empty; screen readers hear "Can, 2 of 3".

Fast Track menu: title **"Hurry something along"**. Each row: `{what} — started by {name}, Generation {n}` + its current stage name + cost.
No due dates or yields. One row per tile, numbered across the plot. Example: *"Tree 2 — started by AL, Generation 1 · Young tree · 2💧"*.

## Plots and stages (hover names)

Plot name, then the name of each visual stage from `visibleView()`.

| Kind | Plot name | Stages |
|---|---|---|
| `field` | Field | `empty` Bare earth · `sown` Sown · `watered` Watered · `growing` Coming up · `ripe` Ripe · `rotten` Rotten · `withered` Withered |
| `orchard` | Orchard (one tree per tile; trees come up with the land's level, `13`) | `empty` Bare ground · `sapling` Sapling · `young` Young tree · `fruiting` Fruiting · `worn` Untended tree · `dead` Dead tree |
| `reservoir` | Reservoir | `cracked` Cracked · `low` Low · `full` Full |
| `well` | Well | `none` Soft ground · `clear` Clear water · `stagnant` Green water |
| `wild` (Forest) | Tree line | `many` Tracks everywhere · `few` A few tracks · `none` Quiet |
| `wild` (Island) | Rocks | `many` Fish rising · `few` The odd fish · `none` Still water |
| `store` | Store | `full` Full · `half` Half full · `empty` Bare · `rotting` Spoiling |
| `lectern` | Journal | — (prompt: "Read the journal") |
| `graveyard` | Graveyard | — (stone hover: "{name} · Generation {n}"; prompt: "Read {name}'s page", [014](../decisions/014-gravestones.md)) |

## Errors (invalid action reasons)

Say what's missing, in a few words.

| Situation | Text |
|---|---|
| Not enough stamina | Not enough stamina |
| Not enough water | Not enough water |
| Harvest on a field that isn't ripe | Nothing to harvest yet |
| Harvest on an orchard already picked this generation | Picked clean for now |
| Harvest on an orchard that isn't fruiting | Nothing to harvest yet |
| Sow on a field that isn't empty | Already sown |
| Plant trees on a living orchard | Trees already planted |
| Repair a sound reservoir | The wall is sound |
| Repair already done this turn | Already repaired |
| Dig where a well exists | There's already a well |
| Fish/Hunt with no stock left | Nothing left to catch (Island) / Nothing left to hunt (Forest) |
| Tend the cracked reservoir | It needs repairing first |
| Tend something already tended this turn | Already seen to today |
| Hurry with nothing pending | Nothing to hurry |
| Harvest and eat when not hungry ([016](../decisions/016-hunger.md)) | You're not hungry |
| Sow with no seeds left (`13`) | No seeds left |
| Water with an empty can | The can is empty |
| Water a tile that isn't sown | Nothing to water |
| Water a tile that's already watered | Already watered |
| Fill a can that's full | The can is full |
| Fill the can at a green well | The water's gone green |
| Cook and eat when not hungry | You're not hungry |
| Cook and eat with an empty store | The store is empty |

## HUD and other short lines

| Where | Text |
|---|---|
| HUD upkeep reminder (decision 002) | Needed by nightfall: 12🍎 10💧 |
| HUD generation badge | Generation {n} of {m} |
| HUD hunger bar ([016](../decisions/016-hunger.md)) | (a bowl icon and a bar, no words; screen readers hear "Hunger") |
| HUD land: health bar ([023](../decisions/023-world-health-and-level.md)) | (a sprout icon and a bar, **no number**; screen readers hear "The land") |
| HUD land: level name | `0` Bare · `1` Taking root · `2` Green · `3` Blooming · `4` Abundant. Shown as the name alone, never "Level 3", and never announced when it changes |
| Weakened start ("You are inheriting…") | You wake up tired. |
| Freeze | The day is over. |
| After your stone rises (`05`) | Generation {n} is over. · button: Continue |

Things deliberately **not** written: no tooltip says what anything becomes or when (the Sow tooltip says a seed *needs* water, not what it will give),
no line says how to raise the land's health or what the next level brings, nothing explains why a plot looks
the way it does, and no event (drought, storm, good harvest) is ever named during play.
