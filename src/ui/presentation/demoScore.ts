import { applyAction, CONFIG, createWorld, endTurn } from '../../engine';

/** A labelled, synthetic presentation fixture. Never reads or writes a player's world. */
export function scoreExample(kept: number) {
  const initial = createWorld(7, { worldId: 'presentation-only', biome: 'forest' }).state;
  // The example starts late in a day: 24 inherited food + 24 gathered food.
  initial.resources.food = 48;
  initial.resources.water = 20;
  initial.tally.productiveFood = 24;
  initial.tally.foodGained = 24;
  let state = initial;
  const units = Math.max(0, Math.min(48, Math.floor(kept)));
  for (let i = 0; i < units; i++) {
    state = applyAction(
      state,
      {
        id: `presentation-take-${i}`,
        actorId: 'example-player',
        seq: i,
        type: 'take',
      },
      60 + (i + 1) * CONFIG.actionSeconds.take,
    ).state;
  }
  const finished = endTurn(state).state;
  return {
    score: finished.scores![0]!,
    foodLeft: finished.resources.food,
    shortfall: finished.weakened,
  };
}
