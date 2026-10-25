// The replay's "what actually changed" lines (06): `explain()` output in words, naming people and
// generations. Wording: docs/content/replay-causes.md. This is the only place causes are shown,
// and only after a world's last generation.

import {
  explain,
  type ActionCause,
  type ActionEntry,
  type Biome,
  type Cause,
  type CauseRule,
  type ResourceKey,
  type Transition,
} from '../../engine';

export interface CauseSentence {
  amount: number;
  /** What did it, e.g. "the orchard AL planted in Generation 1, picked by MO". */
  text: string;
  /** Credits something done in an earlier generation: the replay's reveal. */
  earlier: boolean;
}

export interface ResourceChange {
  resource: ResourceKey;
  label: string;
  net: number;
  lines: CauseSentence[];
}

export interface ExplainContext {
  /** Every action in the world's log. */
  actions: ActionEntry[];
  /** All of the world's transitions (or at least generation `turn`'s). */
  transitions: Transition[];
  /** Who played each generation (the author of its journal page). */
  nameOf: (turn: number) => string;
  biome: Biome;
}

const LABEL: Record<ResourceKey, string> = { food: 'Food', water: 'Water', stamina: 'Stamina', hunger: 'Hunger', can: 'Watering can' };

/**
 * What changed `resources` in generation `turn`, and why. Amounts add up to `net`. Causes that
 * only credit someone (the person who planted the orchard being picked) are folded into the
 * line they credit rather than listed on their own.
 */
export function explainGeneration(
  turn: number,
  ctx: ExplainContext,
  resources: ResourceKey[] = ['food', 'water'],
): ResourceChange[] {
  const byId = new Map(ctx.transitions.map((t) => [t.id, t]));
  const actions = new Map(ctx.actions.map((a) => [a.id, a]));
  const changes: ResourceChange[] = [];

  for (const resource of resources) {
    const summary = explain(ctx.transitions, { turn, resource });
    if (summary.net === 0 && summary.lines.length === 0) continue;

    const lines = new Map<string, CauseSentence>();
    const add = (amount: number, cause: Cause, siblings: Cause[]) => {
      if (amount === 0) return;
      const phrased = phrase(cause, siblings, turn, ctx, actions);
      const line = lines.get(phrased.text) ?? { amount: 0, text: phrased.text, earlier: phrased.earlier };
      line.amount += amount;
      lines.set(phrased.text, line);
    };

    // explain() groups by the bare cause, so the reservoir's and the well's `income` share a line.
    // Each transition is phrased with its own siblings, and lines merge again by their words.
    for (const line of summary.lines) {
      for (const id of line.transitionIds) {
        const tr = byId.get(id);
        if (!tr || tr.delta === undefined) continue;
        const own = tr.causes.find((c) => sameCause(c, line.cause));
        if (own?.share !== undefined) {
          add(own.share, line.cause, tr.causes);
        } else if (tr.causes.length === 1) {
          add(tr.delta, line.cause, tr.causes);
        } else if (!tr.causes.some((c) => c.share !== undefined) && sameCause(tr.causes[0], line.cause)) {
          // Left unsplit (an eaten harvest): it belongs to the first cause.
          add(tr.delta, line.cause, tr.causes);
        }
        // Otherwise this cause only credits a sibling that carries the amount.
      }
    }

    changes.push({ resource, label: LABEL[resource], net: summary.net, lines: [...lines.values()] });
  }
  return changes;
}

/** "Food +30 — the orchard AL planted in Generation 1, picked by MO." */
export function sentence(change: Pick<ResourceChange, 'label'>, line: CauseSentence): string {
  return `${change.label} ${signed(line.amount)} — ${line.text}.`;
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}

function sameCause(a: Cause | undefined, b: Cause): boolean {
  return !!a && JSON.stringify(bare(a)) === JSON.stringify(bare(b));
}

function bare(cause: Cause): Cause {
  const copy = { ...cause };
  delete copy.share;
  return copy;
}

function phrase(
  cause: Cause,
  siblings: Cause[],
  turn: number,
  ctx: ExplainContext,
  actions: Map<string, ActionEntry>,
): { text: string; earlier: boolean } {
  // The structure or planting this change came out of, if someone else's action is credited.
  const credit = siblings.find(
    (c): c is ActionCause & { share?: number } => c.kind === 'action' && !sameCause(c, cause) && c.share === undefined,
  );

  if (cause.kind === 'event') return { text: EVENT[cause.eventId.split('-')[0] ?? ''] ?? 'the weather', earlier: false };

  if (cause.kind === 'rule') {
    const made = credit ? madeBy(credit, turn, ctx, actions) : null;
    if (cause.rule === 'income') {
      // Only a cracked reservoir pays out with nobody to credit.
      return made ? { text: made.text, earlier: made.earlier } : { text: 'the cracked reservoir', earlier: false };
    }
    if (cause.rule === 'wear' && made) return { text: `wear on ${made.text}`, earlier: made.earlier };
    return { text: RULE[cause.rule], earlier: false };
  }

  const action = actions.get(cause.actionId);
  const who = ctx.nameOf(cause.committedTurn);
  if (action?.type === 'harvest') {
    const crop = credit ? madeBy(credit, turn, ctx, actions) : null;
    if (!crop) return { text: `${who}'s harvest`, earlier: false };
    const builder = ctx.nameOf(credit!.committedTurn);
    if (!crop.earlier && builder === who) return { text: `${crop.thing} ${who} ${crop.verb} and picked`, earlier: false };
    return { text: `${crop.text}, picked by ${who}`, earlier: crop.earlier };
  }
  if (action?.type === 'fishHunt') return { text: `${who}'s ${ctx.biome === 'island' ? 'fishing' : 'hunting'}`, earlier: false };
  const made = madeBy(cause, turn, ctx, actions);
  return { text: made.text, earlier: made.earlier };
}

/** "the orchard AL planted in Generation 1" (the generation only when it isn't this one). */
function madeBy(
  cause: ActionCause,
  turn: number,
  ctx: ExplainContext,
  actions: Map<string, ActionEntry>,
): { text: string; thing: string; verb: string; earlier: boolean } {
  const action = actions.get(cause.actionId);
  const [thing, verb] = action ? MADE[action.type](action) : ['work', 'did'];
  const earlier = cause.committedTurn < turn;
  const when = earlier ? ` in Generation ${cause.committedTurn}` : '';
  return { text: `${thing} ${ctx.nameOf(cause.committedTurn)} ${verb}${when}`, thing, verb, earlier };
}

const MADE: Record<ActionEntry['type'], (a: ActionEntry) => [string, string]> = {
  plantOrchard: () => ['the orchard', 'planted'],
  plantCrops: () => ['the crops', 'sowed'],
  repairReservoir: () => ['the reservoir wall', 'repaired'],
  digWell: () => ['the well', 'dug'],
  maintain: () => ['the tending', 'did'],
  harvest: () => ['the harvest', 'brought in'],
  fishHunt: () => ['the catch', 'brought in'],
  fastTrack: (a) => [`the ${HURRIED[a.targetEffectId?.split(':').pop() ?? ''] ?? 'work'}`, 'hurried'],
  water: () => ['the crops', 'watered'],
  fillCan: () => ['the can', 'filled'],
};

const HURRIED: Record<string, string> = {
  cropRipe: 'crops',
  orchardMature: 'orchard',
  orchardYield: 'orchard',
  reservoirRepaired: 'reservoir wall',
  wellIncome: 'well',
};

const EVENT: Record<string, string> = { drought: 'drought', storm: 'a storm', goodHarvest: 'a good harvest' };

const RULE: Record<CauseRule, string> = {
  foodRot: 'food rotting in the store',
  waterStagnate: 'water going stale',
  wear: 'wear',
  upkeep: 'what the night took',
  regrow: 'the wild growing back',
  weakened: 'a short night the generation before',
  income: 'the reservoir',
  newTurn: 'a night’s rest',
  hunger: 'hunger',
  wither: 'seeds left dry',
  overnight: 'crops growing on overnight',
};
