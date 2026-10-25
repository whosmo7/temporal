// What a simulated player sees and may choose (scripts/simulate-llm.ts). Built from visibleView
// only, plus the player's memory of their own day, so nothing reaches the model that a person
// standing in the field wouldn't know (CLAUDE.md rule 4): no seed, events, pending numbers, due
// dates or causes. Candidates are what the HUD would offer; the engine still decides each one.

import { CONFIG, type ActionType, type VisiblePlot, type VisibleWorld } from '../../src/engine';
import type { Candidate, Observation, SimJournalPage } from './types';

/** What the player remembers of today and knows of the world's people. */
export interface PlayerMemory {
  generation: number;
  generations: number;
  you: string;
  /** Display names by actor id, for "the tree Player 1 planted". */
  names: Record<string, string>;
  graveyard: string[];
  journal: SimJournalPage[];
  /** Labels of this player's accepted actions today, in order. */
  done: string[];
  /** Plots this player tended today (the engine allows one tending per structure per turn). */
  tended: Set<string>;
  /** Candidate keys the engine refused today: the player has learned not to try them again. */
  refused: Set<string>;
}

export function newMemory(base: Omit<PlayerMemory, 'done' | 'tended' | 'refused'>): PlayerMemory {
  return { ...base, done: [], tended: new Set(), refused: new Set() };
}

export function observe(view: VisibleWorld, t: number, turnSeconds: number, memory: PlayerMemory): Observation {
  const plots = Object.values(view.plots);
  const fields: Record<string, Record<string, number>> = {};
  for (const p of plots.filter((p) => p.kind === 'field')) {
    const name = fieldName(p);
    fields[name] = count(fields[name] ?? {}, p.stage ?? 'empty');
  }
  const orchard = plots.filter((p) => p.kind === 'orchard').reduce((acc, p) => count(acc, p.stage ?? 'empty'), {} as Record<string, number>);
  const stageOf = (kind: VisiblePlot['kind']) => plots.find((p) => p.kind === kind)?.stage;

  return {
    generation: memory.generation,
    generations: memory.generations,
    biome: view.biome,
    you: memory.you,
    timeLeftSeconds: Math.max(0, Math.round((turnSeconds - t) * 10) / 10),
    stores: {
      food: view.resources.food,
      water: view.resources.water,
      can: view.resources.can,
      canCapacity: CONFIG.canCapacity,
      hunger: view.resources.hunger,
      hungerMax: CONFIG.hungerMax,
      looks: view.store,
    },
    nightNeedsFood: CONFIG.upkeepFood,
    wokeTired: view.weakened,
    hungry: view.hungry,
    land: {
      fields,
      orchard,
      ...optional('reservoir', stageOf('reservoir')),
      ...optional('well', stageOf('well')),
      ...optional('wild', stageOf('wild')),
    },
    doneToday: tally(memory.done),
    graveyard: [...memory.graveyard],
    journal: memory.journal.map((p) => ({ ...p })),
  };
}

/**
 * The choices on offer now, grouped so the list stays short: one "next tile" choice per field
 * stage rather than one per tile. Ids are A1…An in a fixed order, then W1 (wait) and F1 (finish).
 */
export function candidates(view: VisibleWorld, t: number, turnSeconds: number, memory: PlayerMemory): Candidate[] {
  const out: Omit<Candidate, 'id'>[] = [];
  const plots = Object.values(view.plots).sort((a, b) => (a.id < b.id ? -1 : 1));
  const { food, water, can } = view.resources;
  const fieldsIn = (stage: string) => plots.filter((p) => p.kind === 'field' && p.stage === stage);
  const treesIn = (...stages: string[]) => plots.filter((p) => p.kind === 'orchard' && stages.includes(p.stage ?? 'empty'));
  const add = (key: string, type: ActionType, label: string, plotId?: string, targetEffectId?: string) => {
    if (memory.refused.has(key)) return;
    const input: Candidate['input'] = { type };
    if (plotId) input.plotId = plotId;
    if (targetEffectId) input.targetEffectId = targetEffectId;
    out.push({ key, label, seconds: CONFIG.actionSeconds[type], kind: 'action', input });
  };
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

  // Fields, worked a tile at a time (decisions 019, 027)
  const ripe = fieldsIn('ripe');
  if (ripe[0]) add('harvest-field', 'harvest', `Harvest a ripe field tile (${n(ripe.length, 'is', 'are')} ripe)`, ripe[0].id);
  const sown = fieldsIn('sown');
  if (sown[0] && can > 0) add('water-field', 'water', `Water a sown tile from the can (${n(sown.length, 'tile waits', 'tiles wait')})`, sown[0].id);
  const empty = fieldsIn('empty');
  if (empty[0]) add('sow', 'plantCrops', `Sow an empty field tile (${n(empty.length, 'is', 'are')} empty)`, empty[0].id);
  const spoiled = [...fieldsIn('rotten'), ...fieldsIn('withered')];
  if (spoiled[0]) add('clear-field', 'maintain', `Clear and till a spoiled field tile (${spoiled.length} spoiled)`, spoiled[0].id);
  if (can < CONFIG.canCapacity) add('fill-can', 'fillCan', `Fill the watering can at the ${view.biome === 'island' ? 'sea' : 'pond'} (holds ${CONFIG.canCapacity} pours)`);

  // Orchard
  const fruiting = treesIn('fruiting', 'worn');
  if (fruiting[0]) add('harvest-tree', 'harvest', `Pick a fruiting tree (${fruiting.length} fruiting)`, fruiting[0].id);
  const bare = treesIn('empty', 'dead');
  if (bare[0] && water >= CONFIG.plantOrchardWater) {
    add('plant-tree', 'plantOrchard', `Plant a tree on a bare orchard spot (uses ${CONFIG.plantOrchardWater} water; ${bare.length} bare)`, bare[0].id);
  }
  const untended = treesIn('sapling', 'young', 'fruiting', 'worn').filter((p) => !memory.tended.has(p.id));
  if (untended[0]) add('tend-tree', 'maintain', `Prune a tree (${n(untended.length, 'tree', 'trees')} not yet pruned today)`, untended[0].id);

  // Reservoir and well
  const reservoir = plots.find((p) => p.kind === 'reservoir');
  if (reservoir && reservoir.stage !== 'full') add('repair-reservoir', 'repairReservoir', `Repair the reservoir wall (it looks ${reservoir.stage})`, reservoir.id);
  if (reservoir && reservoir.stage !== 'cracked' && !memory.tended.has(reservoir.id)) add('tend-reservoir', 'maintain', 'Shore up the reservoir wall', reservoir.id);
  const well = plots.find((p) => p.kind === 'well');
  if (well?.stage === 'none') add('dig-well', 'digWell', 'Dig a well', well.id);
  if (well && well.stage !== 'none' && !memory.tended.has(well.id)) add('tend-well', 'maintain', `Clear the well (the water looks ${well.stage === 'stagnant' ? 'murky' : 'clear'})`, well.id);

  // Wild spot
  const wild = plots.find((p) => p.kind === 'wild');
  if (wild && wild.stage !== 'none') add('hunt', 'fishHunt', `${view.biome === 'island' ? 'Fish' : 'Hunt'} at the wild spot (there look to be ${wild.stage === 'many' ? 'plenty' : 'a few'})`, wild.id);

  // The oven (decisions 029, 039)
  if (food >= CONFIG.mealFood) add('eat', 'eat', `Cook and eat a meal at the oven (${CONFIG.mealFood} food from the store; you are ${view.hungry ? 'hungry' : 'not hungry'})`);
  if (food >= CONFIG.takeFood) add('keep', 'take', `Keep some food for yourself (${CONFIG.takeFood} food leaves the store for good)`);

  // Hurrying something already under way, as the Fast Track menu lists it: who and when, never when it's due
  for (const option of view.fastTrackable) {
    const who = option.actorId ? (memory.names[option.actorId] ?? 'someone') : 'someone';
    const when = option.committedTurn === view.turn ? 'today' : `in Generation ${option.committedTurn}`;
    const price = [option.cost.water ? `${option.cost.water} water` : '', option.cost.stamina ? `${option.cost.stamina} stamina` : ''].filter(Boolean).join(' and ') || 'nothing';
    add(`hurry-${option.effectId}`, 'fastTrack', `Hurry the ${HURRIED[option.kind]} ${who} started ${when} (costs ${price})`, undefined, option.effectId);
  }

  // Only what still fits before nightfall
  const left = turnSeconds - t;
  const fits = out.filter((c) => c.seconds <= left + 1e-9);
  const shown: Candidate[] = fits.map((c, i) => ({ ...c, id: `A${i + 1}` }));
  shown.push({ id: 'W1', key: 'wait', label: 'Wait a little and watch', seconds: 0, kind: 'wait' });
  shown.push({ id: 'F1', key: 'finish', label: 'Call it a day (end your turn now)', seconds: 0, kind: 'finish' });
  return shown;
}

/** How an accepted choice reads in "done today": fixed words, so repeats group. */
export function doneLabel(c: Candidate): string {
  if (c.key.startsWith('hurry-')) return 'Hurried something already under way';
  return DONE[c.key] ?? c.label;
}

const DONE: Record<string, string> = {
  'harvest-field': 'Harvested a field tile',
  'water-field': 'Watered a sown tile',
  sow: 'Sowed a field tile',
  'clear-field': 'Cleared a spoiled tile',
  'fill-can': 'Filled the can',
  'harvest-tree': 'Picked a tree',
  'plant-tree': 'Planted a tree',
  'tend-tree': 'Pruned a tree',
  'repair-reservoir': 'Started repairing the reservoir wall',
  'tend-reservoir': 'Shored up the reservoir wall',
  'dig-well': 'Dug a well',
  'tend-well': 'Cleared the well',
  hunt: 'Hunted or fished at the wild spot',
  eat: 'Cooked and ate a meal',
  keep: 'Kept some food for yourself',
};

const HURRIED: Record<string, string> = {
  cropRipe: 'crop',
  orchardMature: 'young tree',
  orchardYield: 'orchard',
  reservoirRepaired: 'reservoir repair',
  wellIncome: 'well',
};

function fieldName(p: VisiblePlot): string {
  const plot = p.tile?.plot ?? p.id;
  const number = /-(\d+)$/.exec(plot)?.[1];
  return number ? `Field ${number}` : 'Field';
}

function count(acc: Record<string, number>, key: string): Record<string, number> {
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}

function optional<K extends string>(key: K, value: string | undefined): Partial<Record<K, string>> {
  return value ? ({ [key]: value } as Record<K, string>) : {};
}

/** ["Sow an empty field tile", "Sow an empty field tile"] → ["Sow an empty field tile ×2"]. */
function tally(done: string[]): string[] {
  const out: { label: string; n: number }[] = [];
  for (const label of done) {
    const last = out.at(-1);
    if (last?.label === label) last.n++;
    else out.push({ label, n: 1 });
  }
  return out.map((d) => (d.n > 1 ? `${d.label} ×${d.n}` : d.label));
}
