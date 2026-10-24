# 011: Engine rule details left open by 01

**Status:** proposed (A, 2026-10-24). Built this way in `src/engine/`; confirm or change before balance runs.

## Context

Writing the engine (`02`) needed answers the `01` rules don't give. Each one below changes numbers a
player sees, so it's recorded here rather than left in code.

## Decisions

1. **Building counts as maintenance for the next wear tick.** Digging a well, planting an orchard or a
   reservoir repair landing all set `lastMaintainedTurn` to the turn the action was taken, so a new
   structure doesn't wear in the generation straight after it was built. Otherwise a repair would land
   at gen +1 and immediately wear to 1.
2. **Rounding:** every percentage or multiplier result is `Math.round`ed, so stores stay whole numbers.
   Examples: food rot of 5 loses 2; a good-harvest crop gives 8 (5 × 1.5); drought on cracked
   reservoir income gives 1 (4 × 0.3); a worn orchard gives 8 (15 / 2).
3. **Rotten fields can be replanted.** End-of-turn rot leaves the field `rotten` (so the next player sees
   it), and Plant Crops accepts `empty` or `rotten`.
4. **Stamina refill has its own cause, `newTurn`** (added to `ids.md`). A weakened start adds a second
   cause, `weakened`, with its share, so the replay can say "−30 from weakness".
5. **`replay` also returns each generation's summary** alongside the snapshots, so the replay screen
   doesn't need a second pass to show what each player paid.
6. **Food store sprite:** `empty` at 0, `half` below 2 × upkeep food, `full` otherwise. `rotting` is not
   produced yet; C/B to say when it should show.
7. **A field shows `growing` from halfway to ripe.** The view never exposes the ripening time itself.
8. **Fast Track menu shows the price.** `fastTrackable` lists who started each effect, in which
   generation, and the 2× cost, but never its due turn.

## Consequences

- Balance runs (`scripts/simulate.ts`) use these rules. Changing 1 or 2 will move the reservoir-dilemma
  numbers.
