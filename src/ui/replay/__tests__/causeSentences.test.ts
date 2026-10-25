import { describe, expect, it } from 'vitest';
import { applyAction, beginTurn, CONFIG, createWorld, endTurn, type ActionEntry, type ActionInput, type Transition } from '../../../engine';
import { explainGeneration, sentence } from '../causeSentences';

const NAMES = ['AL', 'MO', 'KE', 'JO', 'RI', 'SU'];

/** Plays generation n as NAMES[n-1], with no seeded events, keeping the log and transitions. */
function world(turns: (Pick<ActionInput, 'type' | 'plotId' | 'eat'> & { t?: number })[][], biome: 'forest' | 'island' = 'forest') {
  let state = createWorld(1, { worldId: 'w', biome }).state;
  state.events = [];
  const log: ActionEntry[] = [];
  const transitions: Transition[] = [];
  turns.forEach((acts, i) => {
    const begun = beginTurn(state);
    state = begun.state;
    transitions.push(...begun.transitions);
    acts.forEach(({ t, ...a }, seq) => {
      const r = applyAction(state, { ...a, id: `${i + 1}-${seq}`, actorId: `id-${NAMES[i]}`, seq }, t ?? seq);
      if (r.error || !r.entry) throw new Error(r.error);
      state = r.state;
      transitions.push(...r.transitions);
      log.push(r.entry);
    });
    const ended = endTurn(state);
    state = ended.state;
    transitions.push(...ended.transitions);
  });
  return { ctx: { actions: log, transitions, nameOf: (n: number) => NAMES[n - 1]!, biome } };
}

// Crops are sown, then watered from the can (decision 027).
describe('replay cause sentences', () => {
  it('names the planter and their generation when the orchard is picked later', () => {
    const { ctx } = world([
      [{ type: 'plantOrchard', plotId: 'orchard-1:0,0' }],
      [],
      [{ type: 'harvest', plotId: 'orchard-1:0,0' }],
    ]);
    const food = explainGeneration(3, ctx).find((c) => c.resource === 'food')!;
    const picked = food.lines.find((l) => l.earlier)!;
    expect(sentence(food, picked)).toBe(`Food +${CONFIG.orchardYield} — the orchard AL planted in Generation 1, picked by KE.`);
  });

  it('adds up to the net change for every resource and generation', () => {
    const ripe = CONFIG.cropRipenSeconds + 1;
    const { ctx } = world([
      [{ type: 'plantOrchard', plotId: 'orchard-1:0,0' }, { type: 'digWell', plotId: 'well' }],
      [{ type: 'plantCrops', plotId: 'field-1:0,0', t: 0 }, { type: 'fillCan', t: 0 }, { type: 'water', plotId: 'field-1:0,0', t: 0 }, { type: 'harvest', plotId: 'field-1:0,0', t: ripe }],
      [{ type: 'harvest', plotId: 'orchard-1:0,0', eat: true }, { type: 'fishHunt', plotId: 'wild' }],
      [{ type: 'repairReservoir', plotId: 'reservoir' }],
      [],
    ]);
    for (let g = 1; g <= 5; g++) {
      for (const change of explainGeneration(g, ctx, ['food', 'water', 'stamina'])) {
        expect(change.lines.reduce((s, l) => s + l.amount, 0), `gen ${g} ${change.resource}`).toBe(change.net);
      }
    }
  });

  it('words the generation’s own work, the store and the night plainly', () => {
    const ripe = CONFIG.cropRipenSeconds + 1;
    const { ctx } = world([[{ type: 'plantCrops', plotId: 'field-1:0,0', t: 0 }, { type: 'fillCan', t: 0 }, { type: 'water', plotId: 'field-1:0,0', t: 0 }, { type: 'harvest', plotId: 'field-1:0,0', t: ripe }, { type: 'fishHunt', plotId: 'wild' }]], 'island');
    const food = explainGeneration(1, ctx).find((c) => c.resource === 'food')!;
    expect(food.lines.map((l) => sentence(food, l))).toEqual([
      `Food +${CONFIG.cropYield} — the crops AL sowed and picked.`,
      `Food +${CONFIG.fishHuntYield} — AL's fishing.`,
      `Food −${CONFIG.upkeepFood} — what the night took.`,
    ]);
  });

  it('credits income to whoever built it', () => {
    const { ctx } = world([[{ type: 'digWell', plotId: 'well' }], []]);
    const water = explainGeneration(2, ctx).find((c) => c.resource === 'water')!;
    expect(water.lines.map((l) => l.text)).toContain('the well AL dug in Generation 1');
  });

  it('keeps the well and the reservoir apart when both pay out', () => {
    const { ctx } = world([[{ type: 'digWell', plotId: 'well' }], [{ type: 'repairReservoir', plotId: 'reservoir' }], []]);
    const water = explainGeneration(3, ctx).find((c) => c.resource === 'water')!;
    const texts = water.lines.map((l) => l.text);
    expect(texts).toContain('the well AL dug in Generation 1');
    expect(texts).toContain('the reservoir wall MO repaired in Generation 2');
    expect(water.lines.reduce((s, l) => s + l.amount, 0)).toBe(water.net);
  });
});
