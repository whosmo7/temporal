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
