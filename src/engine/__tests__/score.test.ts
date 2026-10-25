import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { newGame, sowAndWater } from '../__fixtures__/play';
import { NO_TALLY, tallyHistory, worldScore } from '../score';

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
