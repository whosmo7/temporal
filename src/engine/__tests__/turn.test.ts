import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { asActor, newGame, sowAndWater } from '../__fixtures__/play';
import { explain } from '../replay';
import { visibleView } from '../view';

describe('beginTurn and endTurn', () => {
  it('gen 1 starts from the founder state with nothing applied', () => {
    const game = newGame();
    const founder = game.state;
    game.begin();
    expect(game.transitions).toEqual([]);
    expect(game.state.resources).toEqual(founder.resources);
  });

  it('hunger carries over and drops at each new generation, down to zero', () => {
    const game = newGame();
    game.turn();
    expect(game.state.resources.hunger).toBe(CONFIG.hungerMax);
    const hungerAt = [];
    for (let gen = 2; gen <= 6; gen++) {
      game.begin();
      hungerAt.push(game.state.resources.hunger);
      game.end();
    }
    expect(hungerAt).toEqual([70, 40, 10, 0, 0]);
    const drop = game.transitions.find((t) => 'resource' in t.target && t.target.resource === 'hunger');
    expect(drop?.causes).toEqual([{ kind: 'rule', rule: 'hunger' }]);
  });

  it('a player whose hunger has run out is shown as hungry', () => {
    const game = newGame().begin();
    expect(visibleView(game.state).hungry).toBe(false);
    game.state.resources.hunger = CONFIG.hungerSlowAt;
    expect(visibleView(game.state).hungry).toBe(true);
  });

  it('orchard planted in gen 1 fruits in gen 3 and is explained by the gen 1 action', () => {
    const game = newGame();
    asActor(game, 'AL', (g) => g.act('plantOrchard', { plotId: 'orchard-1:0,0' }));
    game.turn();
    expect(game.state.plots['orchard-1:0,0']?.stage).toBe('young');
    game.begin();
    expect(game.state.plots['orchard-1:0,0']?.stage).toBe('fruiting');
    game.act('harvest', { actorId: 'MO', plotId: 'orchard-1:0,0' });

    const why = explain(game.transitions, { turn: 3, resource: 'food' });
    expect(why.lines.map((l) => l.cause)).toContainEqual({
      kind: 'action',
      actionId: '1-0',
      actorId: 'AL',
      committedTurn: 1,
    });
  });

  it('an unmaintained well stagnates and maintain brings it back', () => {
    const game = newGame();
    game.turn((g) => g.act('digWell', { plotId: 'well' }));
    game.turn(); // gen 2: dug last turn, no wear
    expect(game.state.plots['well']?.wear).toBe(0);
    game.turn(); // gen 3: wear 1
    game.turn(); // gen 4: wear 2
    game.begin(); // gen 5: wear 3
    expect(game.state.plots['well']?.stage).toBe('stagnant');

    game.act('maintain', { plotId: 'well' });
    expect(game.state.plots['well']?.stage).toBe('clear');
    expect(game.state.plots['well']?.wear).toBe(0);
  });

  it('a stagnant well makes stored water stagnate faster', () => {
    const game = newGame();
    game.state.plots['well']!.stage = 'stagnant';
    game.state.plots['well']!.wear = CONFIG.wearBreakAt;
    game.state.resources.water = 50;
    game.state.turn = 2;
    game.begin();
    const decay = game.transitions.find((t) =>
      t.causes.some((c) => c.kind === 'rule' && c.rule === 'waterStagnate'),
    );
    expect(decay?.delta).toBe(-Math.round(50 * CONFIG.waterStagnateStagnantWellPct));
  });

  // Droughts are off in the game (decision 030); these check the rules for when they're back on.
  describe('with droughts on', () => {
    const config = CONFIG as { droughts: boolean };
    beforeEach(() => void (config.droughts = true));
    afterEach(() => void (config.droughts = false));

    it('a drought hurts water unless the reservoir was repaired', () => {
      const play = (repair: boolean) => {
        const game = newGame();
        game.state.events = [{ id: 'drought-3', kind: 'drought', turn: 3 }];
        game.turn((g) => {
          if (repair) g.act('repairReservoir', { plotId: 'reservoir' });
        });
        game.turn();
        game.begin();
        return game;
      };
      const protectedGame = play(true);
      const exposed = play(false);

      const droughtCauses = (game: ReturnType<typeof play>) =>
        game.transitions.filter((t) =>
          t.causes.some((c) => c.kind === 'event' && c.eventId === 'drought-3'),
        );
      expect(droughtCauses(protectedGame)).toEqual([]);
      expect(droughtCauses(exposed).length).toBeGreaterThan(0);
      expect(protectedGame.state.resources.water).toBeGreaterThan(exposed.state.resources.water);
    });

    it('reservoir income cut by drought splits the change between its causes', () => {
      const game = newGame();
      game.state.events = [{ id: 'drought-2', kind: 'drought', turn: 2 }];
      game.turn();
      game.begin();
      const income = game.transitions.find((t) =>
        t.causes.some((c) => c.kind === 'rule' && c.rule === 'income'),
      );
      const shares = income?.causes.reduce((sum, c) => sum + (c.share ?? 0), 0);
      expect(shares).toBe(income?.delta);
      expect(income?.delta).toBe(
        Math.round(CONFIG.reservoirIncomeCracked * CONFIG.droughtIncomeMult),
      );
    });
  });

  it('droughts are off: one in an older world\'s list does nothing and is not shown', () => {
    const game = newGame();
    game.state.events = [{ id: 'drought-2', kind: 'drought', turn: 2 }];
    game.turn();
    game.begin();
    expect(game.transitions.some((t) => t.causes.some((c) => c.kind === 'event' && c.eventId === 'drought-2'))).toBe(false);
    expect(visibleView(game.state).drought).toBe(false);
  });

  it('an upkeep shortfall weakens the next player, with a weakened cause', () => {
    const game = newGame().begin();
    game.state.resources.food = 6; // half the night's food
    game.state.resources.water = 0; // nights take no water (decision 027)
    game.end();
    expect(game.summaries[0]?.upkeep.met).toBe(false);
    expect(game.state.weakened).toBe(0.5);
    expect(game.state.resources.water).toBe(0);

    game.begin();
    const expected = Math.round(CONFIG.baseStamina * (1 - 0.5 * CONFIG.weakenFactor));
    expect(game.state.resources.stamina).toBe(expected);
    const stamina = game.transitions.at(-1);
    expect(stamina?.causes).toContainEqual({
      kind: 'rule',
      rule: 'weakened',
      share: expected - CONFIG.baseStamina,
    });
  });

  it('a crop ripe at the end of the day it ripened is left for the next player', () => {
    const game = newGame().begin();
    sowAndWater(game, 'field-1:0,0', 0); // ripe a minute in
    game.end();
    expect(game.state.plots['field-1:0,0']?.stage).toBe('ripe');
    expect(game.summaries[0]?.cropsRotted).toBe(0);
    game.begin();
    expect(game.act('harvest', { plotId: 'field-1:0,0', t: 5 }).error).toBeUndefined();
  });

  it('a crop ripe all through a generation, start to finish, rots at its end', () => {
    const game = newGame().begin();
    sowAndWater(game, 'field-1:0,0', 0);
    game.end().begin().end(); // gen 2 began with it ripe and never picked it
    expect(game.state.plots['field-1:0,0']?.stage).toBe('rotten');
    expect(game.summaries[1]?.cropsRotted).toBe(1);
    const rot = game.transitions.find((t) => t.id.startsWith('end-2') && 'plot' in t.target && t.after === 'rotten');
    expect(rot?.causes).toContainEqual({ kind: 'rule', rule: 'foodRot' });
  });

  it('a crop still growing at the end of the day grows on overnight, in half its time left', () => {
    const game = newGame().begin();
    const end = CONFIG.turnSeconds;
    sowAndWater(game, 'field-1:0,0', end - 20); // 40 s short when the day ends
    game.end();
    expect(game.state.plots['field-1:0,0']?.stage).toBe('watered');
    expect(game.summaries[0]?.cropsRotted).toBe(0);
    const carried = game.state.pending.find((e) => e.kind === 'cropRipe' && e.status === 'pending');
    expect(carried?.dueAt).toEqual({ turn: 2, t: 40 * CONFIG.overnightGrowth });
    expect(carried?.sourceActorId).toBe('AL'); // still the watering's effect
    game.begin();
    expect(visibleView(game.state, 0).plots['field-1:0,0']?.stage).toBe('growing');
    expect(game.act('harvest', { plotId: 'field-1:0,0', t: 19 }).error).toBe('Nothing to harvest here');
    expect(game.act('harvest', { plotId: 'field-1:0,0', t: 20 }).error).toBeUndefined();
  });

  it('nights take food only', () => {
    const game = newGame().begin();
    const water = game.state.resources.water;
    game.end();
    expect(game.state.resources.water).toBe(water);
    expect(game.summaries[0]?.upkeep.met).toBe(true);
  });

  it('an unwatered seed waits for the next player, and withers two generations after planting', () => {
    const game = newGame();
    asActor(game, 'AL', (g) => g.act('plantCrops', { plotId: 'field-1:0,0', t: 0 }));
    expect(game.state.plots['field-1:0,0']?.stage).toBe('sown');
    expect(game.summaries[0]?.cropsRotted).toBe(0);
    game.turn(); // gen 2: still waiting
    expect(game.state.plots['field-1:0,0']?.stage).toBe('sown');
    game.begin(); // gen 3
    expect(game.state.plots['field-1:0,0']?.stage).toBe('withered');
    const why = explain(game.transitions, { turn: 3, plot: 'field-1:0,0' });
    expect(why.lines.map((l) => l.cause)).toEqual([
      { kind: 'rule', rule: 'wither' },
      { kind: 'action', actionId: '1-0', actorId: 'AL', committedTurn: 1 },
    ]);
  });

  it('watering a seed the last player sowed starts it then', () => {
    const game = newGame();
    asActor(game, 'AL', (g) => g.act('plantCrops', { plotId: 'field-1:0,0', t: 0 }));
    game.begin();
    game.act('fillCan', { t: 0 });
    game.act('water', { plotId: 'field-1:0,0', t: 10 });
    expect(game.act('harvest', { plotId: 'field-1:0,0', t: 10 + CONFIG.cropRipenSeconds }).error).toBeUndefined();
  });

  it('two tiles watered at different times ripen at different times', () => {
    const game = newGame().begin();
    sowAndWater(game, 'field-1:0,0', 0);
    sowAndWater(game, 'field-1:1,0', 60);
    const ripe = CONFIG.cropRipenSeconds;
    expect(game.act('harvest', { plotId: 'field-1:1,0', t: ripe }).error).toBe('Nothing to harvest here');
    expect(game.act('harvest', { plotId: 'field-1:0,0', t: ripe }).error).toBeUndefined();
    expect(game.act('harvest', { plotId: 'field-1:1,0', t: ripe + 60 }).error).toBeUndefined();
  });

  it('the summary only reports realised outcomes', () => {
    const game = newGame();
    game.turn((g) => {
      g.act('plantOrchard', { plotId: 'orchard-1:0,0' });
      g.act('digWell', { plotId: 'well' });
    });
    const summary = game.summaries[0]!;
    expect(Object.keys(summary).sort()).toEqual(
      ['cropsRotted', 'foodEaten', 'gained', 'spent', 'turn', 'upkeep', 'weakenedNext'].sort(),
    );
    expect(summary.spent.stamina).toBe(CONFIG.plantOrchardCost + CONFIG.digWellCost);
    expect(summary.gained.water).toBe(CONFIG.digWellWater);
    expect(summary.gained.food).toBe(0); // the orchard hasn't fruited, so it isn't counted
  });

  it('wild stock regrows each generation up to the cap', () => {
    const game = newGame();
    game.state.wildStock = CONFIG.biomes.forest.wildCap - 1;
    game.turn();
    game.begin();
    expect(game.state.wildStock).toBe(CONFIG.biomes.forest.wildCap);
    game.end().begin();
    expect(game.state.wildStock).toBe(CONFIG.biomes.forest.wildCap);
  });
});
