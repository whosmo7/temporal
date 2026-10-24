# In-world text: actions, plots, tooltips, errors

**From:** `01` (C) · **For:** `04` hotbar, prompts and hover names (B), `08` tutorial (C), `09` icon names (C)

Rules (from `inheritance-player-facing`): describe, don't judge. A prompt may show the **cost** of an action, never what it will
yield later or when. Use the words a farmer would use. Keys are the canonical IDs, so these strings can move into
`src/content/` as they are once the scaffold exists.

## Actions

| ID | Hotbar label | Interact prompt | Tooltip |
|---|---|---|---|
| `harvest` | Harvest | Harvest · 5⚡ | Gather what's ripe into the store. |
| `harvest` + `eat` | Harvest and eat | Harvest and eat · 5⚡ | Eat what you gather now. What you can't eat goes to the store. |
| `plantCrops` | Sow | Sow crops · 8⚡ 1💧 | Quick to grow. Left in the ground at nightfall, they rot. |
| `plantOrchard` | Plant trees | Plant an orchard · 25⚡ 5💧 | Saplings. They take their time. |
| `repairReservoir` | Repair | Repair the reservoir wall · 60⚡ | Patch the cracks and rebuild the wall. |
| `digWell` | Dig | Dig a well · 20⚡ | Water from the ground. A well needs looking after. |
| `fishHunt` (Forest) | Hunt | Hunt · 8⚡ | Set snares along the tree line. |
| `fishHunt` (Island) | Fish | Fish · 8⚡ | Cast a line off the rocks. |
| `maintain` (well) | Tend | Clear the well · 10⚡ | Scrape it out and keep the water moving. |
| `maintain` (reservoir) | Tend | Shore up the wall · 10⚡ | Fill the small cracks before they spread. |
| `maintain` (orchard) | Tend | Prune the trees · 10⚡ | Cut back the dead wood. |
| `fastTrack` | Hurry | Hurry this along · {cost} | Push someone's work along now, at twice the effort. |

Fast Track menu: title **"Hurry something along"**. Each row: `{what} — started by {name}, Generation {n}` + its current stage name + cost.
No due dates or yields. Example: *"Orchard — started by AL, Generation 1 · Young trees · 50⚡ 10💧"*.

## Plots and stages (hover names)

Plot name, then the name of each visual stage from `visibleView()`.

| Kind | Plot name | Stages |
|---|---|---|
| `field` | Field | `empty` Bare earth · `sown` Sown · `growing` Coming up · `ripe` Ripe · `rotten` Rotten |
| `orchard` | Orchard | `empty` Orchard plot · `sapling` Saplings · `young` Young trees · `fruiting` Fruiting · `worn` Untended trees · `dead` Dead trees |
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

## HUD and other short lines

| Where | Text |
|---|---|
| HUD upkeep reminder (decision 002) | Needed by nightfall: 12🍎 10💧 |
| HUD generation badge | Generation {n} of {m} |
| Weakened start ("You are inheriting…") | You wake up tired. |
| Freeze | The day is over. |
| After your stone rises (`05`) | Generation {n} is over. · button: Continue |

Things deliberately **not** written: no tooltip says what anything becomes or when, nothing explains why a plot looks
the way it does, and no event (drought, storm, good harvest) is ever named during play.
