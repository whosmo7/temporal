import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { newGame, OPTS, sowAndWater } from '../__fixtures__/play';
import { replay } from '../replay';
import { NO_TALLY, scoreGeneration, tallyHistory, worldCondition, worldScore } from '../score';

describe('player scores (decision 039)', () => {
  it('locks one score per generation at its end, and later generations never change it', () => {
    const game = newGame();
    game.turn((g) => g.act('digWell', { plotId: 'well' }));
    const first = structuredClone(game.state.scores);
    expect(first).toHaveLength(1);
    expect(first![0]!.turn).toBe(1);

    // Gen 2 wrecks the world; gen 1's locked score stays as it was.
    game.turn((g) => {
      while (g.state.resources.food > 0) g.act('take');
    });
    expect(game.state.scores).toHaveLength(2);
    expect(game.state.scores![0]).toEqual(first![0]);
    expect(game.state.scores![1]!.condition).toBeLessThan(first![0]!.condition);
  });

  it('assesses the world after that generation’s upkeep, and records the cause', () => {
    const game = newGame().turn();
    const score = game.state.scores![0]!;
    expect(score.condition).toBe(worldCondition(game.state));
    const locked = game.transitions.find((t) => 'world' in t.target && t.target.world === 'score');
    expect(locked?.after).toBe(score.total);
    expect(locked?.causes).toEqual([{ kind: 'rule', rule: 'assessed' }]);
  });

  it('a better world handed over earns a bigger exit bonus, all else equal', () => {
    const game = newGame().begin();
    const good = structuredClone(game.state);
    good.plots['reservoir']!.stage = 'full';
    good.resources.food = 24;
    const poor = structuredClone(game.state);
    poor.resources.food = 0;
    poor.wildStock = 0;
    const a = scoreGeneration(good, 1);
    const b = scoreGeneration(poor, 1);
    expect(a.condition).toBeGreaterThan(b.condition);
    expect(a.exitBonus).toBeGreaterThan(b.exitBonus);
    expect(a.exitBonus).toBeCloseTo(a.condition * CONFIG.playerScore.exitBonusPerCondition, 1);
  });

  it('does not reward stockpiling past the reserve, or count broken structures', () => {
    const state = newGame().begin().state;
    const cap = CONFIG.upkeepFood * CONFIG.playerScore.foodReserveNights;
    state.resources.food = cap;
    const atCap = worldCondition(state);
    state.resources.food = cap * 50;
    expect(worldCondition(state)).toBe(atCap);

    state.plots['reservoir']!.stage = 'cracked';
    const cracked = worldCondition(state);
    state.plots['reservoir']!.stage = 'full';
    expect(worldCondition(state)).toBeGreaterThan(cracked);
  });

  it('a short night scales the condition down', () => {
    const state = newGame().begin().state;
    const fed = worldCondition(state);
    state.weakened = 1;
    expect(worldCondition(state)).toBeCloseTo(fed * (1 - CONFIG.playerScore.weakenedPenalty), 0);
  });

  it('take moves food out of the store and is refused when it is empty', () => {
    const game = newGame().begin();
    const food = game.state.resources.food;
    expect(game.act('take').error).toBeUndefined();
    expect(game.state.resources.food).toBe(food - CONFIG.takeFood);
    expect(game.state.tally.foodTaken).toBe(CONFIG.takeFood);
    game.state.resources.food = 0;
    expect(game.act('take').error).toBe('The store is empty');
  });

  it('food harvested then kept counts once, as extraction, never twice', () => {
    const game = newGame().begin();
    sowAndWater(game, 'field-1:0,0');
    game.act('harvest', { plotId: 'field-1:0,0', t: CONFIG.cropRipenSeconds });
    expect(game.state.tally.productiveFood).toBe(CONFIG.cropYield);
    game.act('take', { t: CONFIG.cropRipenSeconds });
    const score = scoreGeneration(game.state, 1);
    expect(score.productive).toBe(0);
    expect(score.extraction).toBe(CONFIG.takeFood * CONFIG.playerScore.takePerFood);
    expect(score.corruption).toBeGreaterThan(0);
  });

  it('catching below the wild floor counts as overhunting', () => {
    const game = newGame().begin();
    const caught: string[] = [];
    while (game.state.wildStock > 0) {
      game.act('fishHunt', { plotId: 'wild' });
      caught.push(game.state.wildStock < CONFIG.playerScore.wildFloor ? 'over' : 'fair');
    }
    const over = caught.filter((c) => c === 'over').length * CONFIG.fishHuntYield;
    expect(game.state.tally.overhuntFood).toBe(over);
    expect(game.state.tally.productiveFood).toBe(caught.length * CONFIG.fishHuntYield - over);
  });

  it('corruption grows faster than linearly, so a little pays and a lot does not', () => {
    const state = newGame().begin().state;
    const corruptionFor = (n: number) => scoreGeneration({ ...state, tally: { ...state.tally, foodTaken: n } }, 1).corruption;
    expect(corruptionFor(20) - corruptionFor(10)).toBeGreaterThan(corruptionFor(10) - corruptionFor(0));
  });

  it('the last generation is assessed the same way: emptying the store lowers its own score', () => {
    const play = (liquidate: boolean) => {
      const game = newGame(7, { ...OPTS, generationCount: 2 });
      game.turn();
      game.turn((g) => {
        g.state.resources.food = 40; // a full store to hand over, or to empty
        if (liquidate) while (g.state.resources.food > 0) g.act('take');
      });
      return game.state.scores![1]!;
    };
    const kept = play(false);
    const sold = play(true);
    expect(sold.condition).toBeLessThan(kept.condition);
    expect(sold.corruption).toBeGreaterThan(0);
  });

  it('replay rebuilds the same locked scores from the log', () => {
    const game = newGame(7, OPTS, 'AL', true);
    game.turn((g) => g.act('fishHunt', { plotId: 'wild' }));
    game.turn((g) => g.act('take'));
    const rebuilt = replay(7, OPTS, game.log);
    expect(rebuilt.snapshots.at(-1)!.state.scores).toEqual(game.state.scores);
  });
});

const FIELD = 'field-1';
const TREE = 'orchard-1:0,0';

describe('world score (decision 037)', () => {
  it('counts harvests, trees, catches, rotted crops and withered seeds from the logs', () => {
    const game = newGame().begin();
    sowAndWater(game, `${FIELD}:0,0`, 0);
    game.act('harvest', { plotId: `${FIELD}:0,0`, t: CONFIG.cropRipenSeconds + 1 }); // +1
    game.act('plantOrchard', { plotId: TREE, t: 2 });
    const grow = game.state.pending.find((e) => e.kind === 'orchardMature');
    game.act('fastTrack', { targetEffectId: grow?.id, t: 3 });
    game.act('harvest', { plotId: TREE, t: 4 }); // +3
    game.act('fishHunt', { plotId: 'wild', t: 5 }); // +2
    sowAndWater(game, `${FIELD}:1,0`, 6); // ripens today, left all of gen 2: rots, −2
    game.act('plantCrops', { plotId: `${FIELD}:2,0`, t: 8 }); // never watered: withers in gen 3, −1
    game.end().begin().end().begin();

    const tally = tallyHistory(game.log, game.transitions);
    expect(tally).toEqual({ cropsHarvested: 1, treesHarvested: 1, catches: 1, cropsRotted: 1, seedsWithered: 1 });
    expect(worldScore(tally)).toBe(1 + 3 + 2 - 2 - 1);
  });

  it('a refused action scores nothing: only logged actions count', () => {
    const game = newGame().begin();
    game.act('harvest', { plotId: `${FIELD}:0,0`, t: 1 }); // nothing ripe: refused, not logged
    expect(tallyHistory(game.log, game.transitions)).toEqual(NO_TALLY);
  });

  it('scores worlds from before per-tile fields too (whole-field plot ids)', () => {
    const tally = tallyHistory(
      [{ type: 'harvest', plotId: 'field-1' }, { type: 'harvest', plotId: 'orchard-1' }],
      [{ target: { plot: 'field-2', field: 'stage' }, after: 'rotten' }],
    );
    expect(tally).toEqual({ ...NO_TALLY, cropsHarvested: 1, treesHarvested: 1, cropsRotted: 1 });
  });

  it('uses the weights in config', () => {
    const w = CONFIG.score;
    expect([w.cropHarvested, w.treeHarvested, w.catch, w.cropRotted, w.seedWithered]).toEqual([1, 3, 2, -2, -1]);
  });
});
