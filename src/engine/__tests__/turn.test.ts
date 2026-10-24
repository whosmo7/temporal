import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { asActor, newGame } from '../__fixtures__/play';
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

  it('an upkeep shortfall weakens the next player, with a weakened cause', () => {
    const game = newGame().begin();
    game.state.resources.food = 0;
    game.end();
    expect(game.summaries[0]?.upkeep.met).toBe(false);
    expect(game.state.weakened).toBe(0.5);

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

  it('crops still in the ground at the end of the turn rot', () => {
    const game = newGame().begin();
    game.act('plantCrops', { plotId: 'field-1:0,0', t: 500 }); // ripens after the turn ends
    game.end();
    expect(game.state.plots['field-1:0,0']?.stage).toBe('rotten');
    expect(game.summaries[0]?.cropsRotted).toBe(1);
    expect(game.state.pending[0]?.status).toBe('cancelled');
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
