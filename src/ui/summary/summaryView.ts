// The cost summary's lines (05), worded from docs/content/cost-summary.md. Realised only: every
// number here is something that already happened this turn. Nothing reads a pending effect's
// yield or due time, so nothing still growing can show up as a gain.

import type {
  ActionEntry,
  Biome,
  EffectKind,
  ResourceKey,
  Transition,
  TurnSummary,
  WorldState,
} from '../../engine';

/** One per-action row: what that kind of action cost and gave back this turn. */
export interface SummaryRow {
  label: string;
  count: number;
  stamina: number;
  water: number;
  food: number;
}

export interface CostSummaryView {
  spentLine: string;
  waterLine: string;
  foodLine: string;
  eatenLine: string | null;
  rottedLine: string | null;
  rows: SummaryRow[];
  night: { food: number; water: number; short: { food: number; water: number } | null };
  store: { food: number; water: number };
}

const COUNTED: readonly ResourceKey[] = ['stamina', 'water', 'food'];

/**
 * `log` and `transitions` are this turn's (the store's `log` and `transitions` after
 * `finishTurn`), `after` is `endTurn().state`. `nameOf` turns an actor id into a display name.
 */
export function costSummary(input: {
  summary: TurnSummary;
  log: ActionEntry[];
  transitions: Transition[];
  after: WorldState;
  biome: Biome;
  actor: string;
  nameOf?: (actorId: string) => string;
}): CostSummaryView {
  const { summary, log, transitions, after, biome, actor } = input;
  const nameOf = input.nameOf ?? ((id: string) => id);
  const turnActions = new Map(log.filter((a) => a.committedAt.turn === summary.turn).map((a) => [a.id, a]));

  // What each of this turn's actions changed, from the transitions it caused this turn.
  const byAction = new Map<string, { stamina: number; water: number; food: number }>();
  for (const tr of transitions) {
    if (tr.at.turn !== summary.turn || tr.delta === undefined || !('resource' in tr.target)) continue;
    const key = tr.target.resource;
    if (!COUNTED.includes(key)) continue;
    const own = tr.causes.find((c) => c.kind === 'action' && turnActions.has(c.actionId));
    if (!own || own.kind !== 'action') continue;
    const sums = byAction.get(own.actionId) ?? { stamina: 0, water: 0, food: 0 };
    sums[key as 'stamina' | 'water' | 'food'] += tr.delta;
    byAction.set(own.actionId, sums);
  }

  const rows = new Map<string, SummaryRow>();
  for (const action of turnActions.values()) {
    const label = rowLabel(action, after, biome, actor, nameOf);
    const sums = byAction.get(action.id) ?? { stamina: 0, water: 0, food: 0 };
    const row = rows.get(label) ?? { label, count: 0, stamina: 0, water: 0, food: 0 };
    row.count++;
    row.stamina += sums.stamina;
    row.water += sums.water;
    row.food += sums.food;
    rows.set(label, row);
  }

  const { spent, gained, upkeep } = summary;
  const shortFood = upkeep.food.required - upkeep.food.paid;
  const shortWater = upkeep.water.required - upkeep.water.paid;

  return {
    spentLine: `You spent ${spent.stamina}⚡.`,
    waterLine: waterLine(spent.water, gained.water),
    foodLine: gained.food > 0 ? `You gathered ${gained.food}🍎.` : 'You gathered nothing.',
    eatenLine: summary.foodEaten > 0 ? `You ate ${summary.foodEaten}🍎.` : null,
    rottedLine:
      summary.cropsRotted === 0
        ? null
        : summary.cropsRotted === 1
          ? 'One field of crops rotted in the ground.'
          : `${summary.cropsRotted} fields of crops rotted in the ground.`,
    rows: [...rows.values()],
    night: {
      food: upkeep.food.required,
      water: upkeep.water.required,
      short: upkeep.met ? null : { food: shortFood, water: shortWater },
    },
    store: { food: after.resources.food, water: after.resources.water },
  };
}

function waterLine(spent: number, gained: number): string {
  if (spent > 0 && gained > 0) return `You used ${spent}💧 and gathered ${gained}💧.`;
  if (spent > 0) return `You used ${spent}💧.`;
  if (gained > 0) return `You gathered ${gained}💧.`;
  return 'You used no water.';
}

function rowLabel(
  action: ActionEntry,
  after: WorldState,
  biome: Biome,
  actor: string,
  nameOf: (id: string) => string,
): string {
  switch (action.type) {
    case 'plantOrchard':
      return 'Orchard';
    case 'plantCrops':
      return 'Crops sown';
    case 'harvest':
      return action.eat ? 'Harvest, eaten' : 'Harvest';
    case 'repairReservoir':
      return 'Reservoir wall';
    case 'digWell':
      return 'Well';
    case 'fishHunt':
      return biome === 'island' ? 'Fishing' : 'Hunt';
    case 'maintain':
      return 'Tending';
    case 'fastTrack': {
      const effect = after.pending.find((e) => e.id === action.targetEffectId);
      const kind = (effect?.kind ?? action.targetEffectId?.split(':').pop()) as EffectKind | undefined;
      const owner = effect?.sourceActorId;
      const whose = !owner || owner === actor ? 'your' : `${nameOf(owner)}'s`;
      return `Hurried: ${whose} ${kind ? THING[kind] : 'work'}`;
    }
  }
}

const THING: Record<EffectKind, string> = {
  cropRipe: 'crops',
  orchardMature: 'orchard',
  orchardYield: 'orchard',
  reservoirRepaired: 'reservoir wall',
  wellIncome: 'well',
};
