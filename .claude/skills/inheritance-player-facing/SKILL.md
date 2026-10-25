---
name: inheritance-player-facing
description: Rules for everything an INHERITANCE player sees or reads, covering both what information may be shown at each stage (play, journal, cost summary, gravestone, replay, tutorial) and the voice of all in-game text. Use this whenever you write or review UI text, tooltips, prompts, HUD elements, the tutorial, the cost summary, error messages, the "You are inheriting…" screen, replay cause sentences, landing copy or founder journal pages in the temporal repo, and whenever a feature might reveal numbers, due dates or causes to a player during play. This protects the game's central mechanic and the demo moment.
---

# Player-facing information and voice

The game works because players **can't see** the future value of what they do, and successors **can't
see** why the world is the way it is, except through the journal, what the world looks like, and the
HUD's **world health bar and land level** ([023](../../../docs/decisions/023-world-health-and-level.md)).
Decision [026](../../../docs/decisions/026-lift-no-explanation-rule.md) lifted the old blanket rule, and the
user then chose (2026-10-25) to show **only health and level** beyond what was already allowed. Anything more
(due dates, future yields, causes during play) needs a new decision first. The demo moment is being redesigned
(`13` open question 1), but whatever it becomes, it needs the reveal to stay in the replay. Text that moralises turns the game into the
"simplistic morality game" the brief warns against.

## What may be shown, where

| Surface | May show | Must not show |
|---|---|---|
| **HUD (during play)** | Current food, water, stamina, hunger; clock / time of day; generation "N of M"; upkeep needed by nightfall (002); **world health as a bar with no number**; **the land's level name** (Bare, Taking root, Green, Blooming, Abundant); toolbar: held tool, seed count, the can's pours | Pending effect values, due generations, decay %, upcoming events; health as a number, its formula, or what raises it; the next level's threshold |
| **Interact prompt** | Action name, its **cost** (including 1 seed or 1 pour), the engine's error reason, "Fill the can" at a source | What it will yield later or when ("ripens in 150 s", "+4 food per tree"), or how it moves health |
| **Plots / world** | Visual stages (sapling, cracked, murky), weather, blight | Labels or tooltips explaining causes ("cracked because no one maintained it") |
| **Fast Track menu** | Pending items, the name of who started them, current stage, Fast Track cost | Due date or yield of the item |
| **"You are inheriting…"** | World name, biome, generation N of M, names on gravestones, "You wake up tired" when weakened | Resource numbers, causes, what earlier players did |
| **Journal** | Players' own pages (text + drawing), author name, generation | Any auto-generated summary of what happened |
| **Cost summary** | Costs paid and immediate gains this turn; upkeep met / short by X; what you sowed, watered or built **as a cost** ("Crops sown ×6", "Watered ×6"); seeds used and gathered; the land's health bar and level name **as they stand at day's end** | What anything will become, tiles "still growing", or "your successors will thank you" |
| **Gravestone** | Name/initials (generation if decided) | Achievements, ratings, score |
| **Replay (after the final gen)** | Everything: causes, actors, generations, cost-only summaries, journal pages | No restriction (this is where the explanation happens) |
| **Tutorial** | How to move/act/use the journal; that upkeep exists | Numbers for delayed effects, or any hint of how long something takes ([032](../../../docs/decisions/032-tutorial-first-play-skippable.md)) |

Rule of thumb: **before the replay, a player knows only what a person standing in that field would
know.**

## Voice

The tone is quiet, plain and observational, like a field notebook or a parish register, and never preachy.

- **Describe, don't judge.** "The well water is green." Not "You neglected the well."
- **No moral labels** on actions or outcomes: no "selfish", "noble", "sacrifice", "greed", "good choice".
  Every action should read as something a reasonable person might do.
- **No score language:** no "win", "lose", "points", "achievement", "level up". The land level is shown by its
  **name** ("The land is Green"), never as "Level 3", and it's never announced as a reward.
- **Address the player as "you", in the present tense,** briefly. One line where one line will do.
- **Name things the way a farmer would**: field, orchard, reservoir, well, store. Never system terms
  like "effect", "transition", "turn engine" or "stamina pool". "Stamina" and the ⚡ icon are fine.
- **Error messages** say what's missing: "Not enough stamina", "Nothing to harvest yet".
- **Replay cause sentences** are factual and name people and generations:
  "Food +30 — the orchard planted by AL in Generation 1."
  "Water −10 — drought." "Water −6 — the reservoir wall, last repaired in Generation 1."
  Avoid adding commentary like "thanks to AL's foresight".
- **Founder / demo journal pages** (C): written like a real person in a hurry. Specific, a little uncertain, not wise.
  Good: "I put something in by the east fence. Water it if you can." Bad: "Remember, we plant trees for those who come after."

## Quick review checklist

Before merging anything player-facing:
- [ ] During play, nothing shows a future number, a due date or a cause; health appears only as a bar, level only as its name
- [ ] The cost summary has only realised lines
- [ ] No text judges an action or rates the player
- [ ] Words are the farmer's, not the codebase's
- [ ] Shown at 1280×720, the text fits without clipping

Put this checklist's result in the PR's "Player-facing check" section.
