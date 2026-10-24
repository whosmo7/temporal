---
name: inheritance-balance
description: How to tune INHERITANCE's numbers (action costs, yields, delays, decay, wear, upkeep, events, biome modifiers) in the temporal repo. Covers config.ts as the single source, running scripts/simulate.ts with the hoarder, planter and quick-fixer strategies, the reservoir-dilemma target, the "no dominant strategy" check, and recording changes in the plan. Use this whenever someone wants to change a game number, says something feels too easy, too punishing or too obvious, asks whether a strategy is overpowered, sets turn length or generation defaults, or prepares the demo world's numbers.
---

# Balancing

The goal of balance here isn't fun-per-minute but **legitimate competing needs**: every choice should be
defensible, and no single strategy should be obviously right. Spec: `docs/plan/01-game-design.md`.

## Where numbers live

- **Only in `src/engine/config.ts`.** If you find a number in a reducer, move it to config.
- Every value in `01` marked `[PLACEHOLDER]` starts life in config with a comment naming that section.
  When a value is confirmed, update the table in `01` in the same PR and drop its placeholder marker.

## Targets

| Target | How to check |
|---|---|
| **Reservoir dilemma:** in a "medium" inherited world, a player can repair the reservoir *or* comfortably meet upkeep, not both | `simulate` with a repair-first strategy from the medium scenario → upkeep short |
| **No dominant strategy** over N generations | `hoarder`, `planter` and `quick-fixer` all end with some upkeep failures or visible decline. None is best in every generation |
| **Selfish play shows by the end** | An all-selfish run ends visibly worse (orchard dead, reservoir cracked, wild stock low) than a mixed run |
| **Pure sacrifice has a real cost** | An all-future run causes upkeep failures (weakened successors) along the way |
| **Fast Track is tempting but costly** | Rushing an orchard is affordable only with a good inheritance |
| **Biome modifiers are small** | The same strategy on Forest vs Island differs by < ~15% in final resources |
| **The demo world reliably shows the orchard** | With the demo seed and log, the orchard is `fruiting` in the judge's generation |

## Loop

1. State which target you're addressing and the current numbers.
2. Change values in `config.ts` only.
3. Run `npx tsx scripts/simulate.ts --seed <s> --gens <n> --strategy <name>` for each strategy and both biomes
   (the script prints a per-generation table).
4. Compare before and after, and keep the change if it moves the target without breaking another one.
5. Update the `01` tables and commit with `tune(design): <what and why>`, pasting the before/after table
   into the PR.

Strategies live in `scripts/strategies/` (`hoarder.ts`, `planter.ts`, `quickFixer.ts`, `repairFirst.ts`). They're also
used as Vitest fixtures, so changing numbers may require updating expected values in tests. Do that in the
same PR, and explain why the expected values moved.

## Defaults the team still has to set

`turnSeconds`, `generationCount` and `inheritRatio` defaults are game-design decisions (open in `01`/`07`).
Propose values with simulation evidence, but follow `inheritance-task-workflow` for recording the decision.
