import { describe, expect, it } from 'vitest';
import {
  applyAction,
  beginTurn,
  CONFIG,
  createWorld,
  endTurn,
  tick,
  type ActionEntry,
  type ActionInput,
  type Transition,
  type WorldState,
} from '../../../engine';
import { costSummary } from '../summaryView';

/** Plays one turn of `inputs` (each at its own `t`) and returns the summary view for it. */
function play(world: WorldState, inputs: (Omit<ActionInput, 'actorId' | 'seq'> & { t: number })[], actor = 'AL') {
  const begun = beginTurn(world);
  let state = begun.state;
  const transitions: Transition[] = [...begun.transitions];
  const log: ActionEntry[] = [];
  for (const [seq, { t, ...input }] of inputs.entries()) {
    const ticked = tick(state, t);
    state = ticked.state;
    transitions.push(...ticked.transitions);
    const r = applyAction(state, { ...input, actorId: actor, seq }, t);
    if (r.error || !r.entry) throw new Error(r.error);
    state = r.state;
    transitions.push(...r.transitions);
    log.push(r.entry);
  }
  const ended = endTurn(state);
  transitions.push(...ended.transitions);
  const view = costSummary({ summary: ended.summary, log, transitions, after: ended.state, biome: state.biome, actor });
  return { view, ended };
}

/** A cost as the summary shows it: spent is negative, and nothing spent is 0 (not -0). */
const spent = (n: number) => (n === 0 ? 0 : -n);

const fresh = (biome: 'forest' | 'island' = 'forest') => {
  const w = createWorld(7, { worldId: 'w', biome }).state;
  w.events = [];
  return w;
};

describe('cost summary', () => {
  it('shows an orchard as its cost and nothing else', () => {
    const { view } = play(fresh(), [{ id: 'a', type: 'plantOrchard', plotId: 'orchard-1:0,0', t: 10 }]);
    expect(view.rows).toEqual([
      { label: 'Orchard', count: 1, stamina: spent(CONFIG.plantOrchardCost), water: spent(CONFIG.plantOrchardWater), food: 0 },
    ]);
    expect(view.spentLine).toBe(`You spent ${CONFIG.plantOrchardCost}⚡.`);
    expect(view.foodLine).toBe('You gathered nothing.');
  });

  it('groups repeats and shows what a harvest this turn really gave', () => {
    const ripe = CONFIG.cropRipenSeconds + 1;
    const { view } = play(fresh(), [
      { id: 'a', type: 'plantCrops', plotId: 'field-1:0,0', t: 0 },
      { id: 'a2', type: 'fillCan', t: 0 },
      { id: 'a3', type: 'water', plotId: 'field-1:0,0', t: 0 },
      { id: 'b', type: 'harvest', plotId: 'field-1:0,0', t: ripe },
      { id: 'c', type: 'fishHunt', plotId: 'wild', t: ripe + 1 },
      { id: 'd', type: 'fishHunt', plotId: 'wild', t: ripe + 2 },
    ]);
    const byLabel = Object.fromEntries(view.rows.map((r) => [r.label, r]));
    expect(byLabel['Crops sown']).toMatchObject({ count: 1, stamina: spent(CONFIG.plantCropsCost), food: 0 });
    expect(byLabel['Crops watered']).toMatchObject({ count: 1, food: 0 });
    expect(byLabel['Harvest']).toMatchObject({ count: 1, food: CONFIG.cropYield });
    expect(byLabel['Hunt']).toMatchObject({ count: 2, stamina: spent(2 * CONFIG.fishHuntCost), food: 2 * CONFIG.fishHuntYield });
  });

  it('adds up to the summary totals', () => {
    const { view, ended } = play(fresh('island'), [
      { id: 'a', type: 'digWell', plotId: 'well', t: 0 },
      { id: 'b', type: 'fishHunt', plotId: 'wild', t: 1 },
    ]);
    const stamina = view.rows.reduce((s, r) => s + r.stamina, 0);
    const food = view.rows.reduce((s, r) => s + r.food, 0);
    expect(spent(stamina)).toBe(ended.summary.spent.stamina);
    expect(food).toBe(ended.summary.gained.food);
    expect(view.rows.map((r) => r.label)).toEqual(['Well', 'Fishing']);
    expect(view.store).toEqual({ food: ended.state.resources.food, water: ended.state.resources.water });
  });

  it('names whose work was hurried', () => {
    const planted = play(fresh(), [{ id: 'a', type: 'plantOrchard', plotId: 'orchard-1:0,0', t: 0 }], 'AL').ended.state;
    planted.resources.water = 100;
    const { view } = play(planted, [{ id: 'b', type: 'fastTrack', targetEffectId: 'a:orchardMature', t: 0 }], 'MO');
    expect(view.rows[0]?.label).toBe("Hurried: AL's orchard");
  });

  it('says how short the night was, and never what is still to come', () => {
    const w = fresh();
    w.resources.food = 0;
    w.resources.water = 0;
    const { view } = play(w, []);
    expect(view.night.short).not.toBeNull();
    expect(JSON.stringify(view)).not.toMatch(/will|later|future|successor/i);
  });
});

describe('cost summary: seeds and the land (13)', () => {
  it('adds no seed or land lines until the engine has them', () => {
    const { view } = play(fresh(), [{ id: 'a', type: 'plantCrops', plotId: 'field-1:0,0', t: 0 }]);
    expect(view.seedsLine).toBeNull();
    expect(view.land).toBeNull();
  });

  it("shows seeds used and gathered by today's actions, and the land as it stands", () => {
    const world = fresh();
    const begun = beginTurn(world);
    const r = applyAction(
      begun.state,
      { id: 'a', type: 'plantCrops', plotId: 'field-1:0,0', actorId: 'AL', seq: 0 },
      0,
    );
    if (!r.entry) throw new Error(r.error);
    const ended = endTurn(r.state);
    const seeds = (delta: number, id: string): Transition => ({
      id,
      at: { turn: ended.summary.turn, t: 0 },
      target: { resource: 'seeds' as never },
      before: 0,
      after: 0,
      delta,
      causes: [{ kind: 'action', actionId: 'a', actorId: 'AL', committedTurn: ended.summary.turn }],
    });
    const after = { ...ended.state, health: 62, level: 1 } as WorldState;
    const view = costSummary({
      summary: ended.summary,
      log: [r.entry],
      transitions: [seeds(-1, 's1'), seeds(-1, 's2'), seeds(1, 's3')],
      after,
      biome: world.biome,
      actor: 'AL',
    });
    expect(view.seedsLine).toBe('You used 2 seeds and gathered 1.');
    expect(view.land).toEqual({ health: 0.62, level: 1, name: 'Taking root' });
  });
});
