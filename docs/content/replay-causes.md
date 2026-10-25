# Replay cause sentences

**From:** C · **For:** `06` replay causes panel (B), built by `explainGeneration()` in `src/ui/replay/causeSentences.ts`

The replay is the only place the game explains itself. Each generation's panel lists, per resource, what changed
and who or what did it. Lines are factual and name people and generations. No commentary ("thanks to AL's
foresight"), no judgement ("MO neglected the well").

## Layout

```
Food +3
  +15  the orchard AL planted in Generation 1, picked by KE
  −12  what the night took
Water +2
  +12  the reservoir wall MO repaired in Generation 2
   +6  the well AL dug in Generation 1
   −3  wear on the well AL dug in Generation 1
   −3  water going stale
  −10  what the night took
```

As a full sentence (`sentence()`): "Food +15 — the orchard AL planted in Generation 1, picked by KE."
Lines that credit an earlier generation are flagged `earlier`, so the panel can mark the reveal.
Amounts always add up to the net change.

## Templates

`{name}` is the author of that generation's journal page. "in Generation {n}" is added only when the work was done in an
earlier generation than the one shown.

| Cause | Wording |
|---|---|
| Harvest of something planted earlier | the orchard {planter} planted in Generation {n}, picked by {name} |
| Harvest of crops the same person sowed this generation | the crops {name} sowed and picked |
| Harvest with nothing to credit | {name}'s harvest |
| Hunt / fish | {name}'s hunting / {name}'s fishing |
| Plant orchard (its cost) | the orchard {name} planted |
| Sow crops | the crops {name} sowed |
| Repair reservoir | the reservoir wall {name} repaired |
| Dig well | the well {name} dug |
| Tending | the tending {name} did |
| Fast Track | the orchard / crops / reservoir wall / well {name} hurried |
| Reservoir or well income | the reservoir wall {name} repaired in Generation {n} / the well {name} dug in Generation {n} |
| Cracked reservoir's trickle | the cracked reservoir |
| Wear on income or yield | wear on {the thing as above} (or "wear" with nothing to credit) |
| Drought / storm / good harvest | drought / a storm / a good harvest |
| Food rot | food rotting in the store |
| Water stagnation | water going stale |
| Upkeep | what the night took |
| Starting stamina | a night’s rest |
| Weakened start | a short night the generation before |

Food and water are shown by default. Stamina can be asked for (`resources` argument); hunger isn't shown.

## The screen around the causes (06, [029](../decisions/029-replay-viewer-pacing-and-legacy.md))

Built in `src/ui/screens/replay/words.ts`.

### Plot history popover

Opened by clicking a plot or tile in the replay world. The title is the plot's name as in the game ("Field tile 4",
"Tree 2", "Reservoir", "Tree line"). One row per generation, up to the one on screen:

```
Field tile 4
Gen 1 · AL sowed it and watered it · Watered
Gen 2 · MO picked it · Tilled earth
Gen 3 · Tilled earth
```

`Gen {n} · {name} {acts} · {stage}`. The acts part is left out when nobody touched it; the stage is the hover name from
the game (`stageName`), left out for plots with none. Repeats are counted: "fished there 3 times".

| Action | Words |
|---|---|
| Sow | sowed it |
| Water | watered it |
| Harvest | picked it |
| Plant orchard | planted it |
| Repair reservoir | repaired it |
| Dig well | dug it |
| Tend | tended it |
| Fast Track | hurried it |
| Hunt / fish | hunted there / fished there |
| Fill can | filled the can there |

### Timeline

One dot per generation with the player's name under it (cut to 8 characters, e.g. "Barthol…"; the full name and
"Generation {n}" on hover). Beside it: Play / Pause, and the pace: **Slow**, **Steady**, **Quick**.

### Legacy view (ending card)

Headed **After they left**. One line per player and piece of work whose food or water reached a later generation:

- "AL planted an orchard in Generation 1. It fed Generations 3, 4 and 5."
- "MO dug a well in Generation 2. It gave water to Generation 3."
- "AL repaired the reservoir wall in Generation 1. It gave water to Generations 2 and 3."

| Work | Words |
|---|---|
| Plant orchard | planted an orchard |
| Sow | sowed crops |
| Water | watered crops |
| Repair reservoir | repaired the reservoir wall |
| Dig well | dug a well |
| Tend | tended the land |
| Fast Track | hurried some work along |

Gains only, and no amounts: the causes panel has those. No praise ("generously", "thanks to").

### The land (once B exports health and level per generation)

A line at the top of "What actually changed", with the health bar (the replay may also show the number):

- Level unchanged: "The land · Green · 62"
- Level rose: "The land · Green → Blooming · 76"
