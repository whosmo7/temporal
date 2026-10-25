// The replay screen's own words (06): the plot history popover, the timeline and the legacy view
// on the ending card. Wording: docs/content/replay-causes.md. Only the replay may say these things.

import type { Replay } from '../../../api';
import type { ActionType, Biome, PlotId, PlotKind, ResourceKey, VisibleWorld } from '../../../engine';
import type { PlotGeneration } from '../../replay';
import { plotName, stageName, tileName } from '../../hud/copy';

/** "Field tile 4", "Tree 2", "Reservoir": what the popover is about. */
export function plotLabel(view: VisibleWorld, id: PlotId): string {
  const plot = view.plots[id];
  if (!plot) return 'Here';
  if (!plot.tile) return plotName(plot.kind, view.biome);
  const of = plot.tile.plot;
  const tiles = Object.values(view.plots)
    .filter((p) => p.tile?.plot === of)
    .sort((a, b) => a.tile!.y - b.tile!.y || a.tile!.x - b.tile!.x);
  return tileName(plot.kind, tiles.indexOf(plot) + 1);
}

const ACT: Record<ActionType, (biome: Biome) => string> = {
  plantCrops: () => 'sowed it',
  water: () => 'watered it',
  harvest: () => 'picked it',
  plantOrchard: () => 'planted it',
  repairReservoir: () => 'repaired it',
  digWell: () => 'dug it',
  maintain: () => 'tended it',
  fastTrack: () => 'hurried it',
  fishHunt: (biome) => (biome === 'island' ? 'fished there' : 'hunted there'),
  fillCan: () => 'filled the can there',
};

/** "AL sowed it, watered it and picked it", or null when nobody touched it that generation. */
export function actsPhrase(acts: PlotGeneration['acts'], biome: Biome): string | null {
  if (acts.length === 0) return null;
  const counts = new Map<ActionType, number>();
  for (const a of acts) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  const parts = [...counts].map(([type, n]) => ACT[type](biome) + (n > 1 ? ` ${n} times` : ''));
  return `${acts[0]!.actor} ${list(parts)}`;
}

/** One popover row: "Gen 1 · AL sowed it · Sown, dry". */
export function historyLine(g: PlotGeneration, kind: PlotKind, biome: Biome): string {
  const parts = [`Gen ${g.turn}`];
  const acts = actsPhrase(g.acts, biome);
  if (acts) parts.push(acts);
  if (g.stage) parts.push(stageName(kind, g.stage, biome));
  return parts.join(' · ');
}

/** Under a timeline dot: the name, cut short if it won't fit (the full name is on hover). */
export function shortName(name: string, max = 8): string {
  return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
}

export type Pace = 'slow' | 'normal' | 'fast';
export const PACES: readonly Pace[] = ['slow', 'normal', 'fast'];
export const PACE_MS: Record<Pace, number> = { slow: 12_000, normal: 8_000, fast: 4_000 };
export const PACE_LABEL: Record<Pace, string> = { slow: 'Slow', normal: 'Steady', fast: 'Quick' };

// ---- Legacy view (ending card) ----

const DID: Partial<Record<ActionType, string>> = {
  plantOrchard: 'planted an orchard',
  plantCrops: 'sowed crops',
  water: 'watered crops',
  repairReservoir: 'repaired the reservoir wall',
  digWell: 'dug a well',
  maintain: 'tended the land',
  fastTrack: 'hurried some work along',
};

const GAVE: Partial<Record<ResourceKey, string>> = { food: 'fed', water: 'gave water to' };

export interface Legacy {
  /** The generation the work was done in. */
  turn: number;
  /** "AL planted an orchard in Generation 1. It fed Generations 3, 4 and 5." */
  text: string;
}

/**
 * What each player's work did after they left: every food or water gain in a later generation
 * that credits something done in an earlier one, grouped by who did what. Gains only; the
 * causes panel shows the rest.
 */
export function legacyOf(replay: Pick<Replay, 'actions' | 'transitions'>, nameOf: (turn: number) => string): Legacy[] {
  const actions = new Map(replay.actions.map((a) => [a.id, a]));
  const groups = new Map<string, { turn: number; did: string; gave: Map<ResourceKey, Set<number>> }>();

  for (const tr of replay.transitions) {
    if (!('resource' in tr.target) || !(tr.target.resource in GAVE) || !tr.delta || tr.delta <= 0) continue;
    const resource = tr.target.resource;
    for (const cause of tr.causes) {
      if (cause.kind !== 'action' || cause.committedTurn >= tr.at.turn) continue;
      const did = DID[actions.get(cause.actionId)?.type as ActionType];
      if (!did) continue;
      const key = `${cause.committedTurn}|${did}`;
      const group = groups.get(key) ?? { turn: cause.committedTurn, did, gave: new Map() };
      const turns = group.gave.get(resource) ?? new Set<number>();
      turns.add(tr.at.turn);
      group.gave.set(resource, turns);
      groups.set(key, group);
    }
  }

  return [...groups.values()]
    .sort((a, b) => a.turn - b.turn)
    .map((g) => {
      const clauses = (['food', 'water'] as const)
        .filter((r) => g.gave.has(r))
        .map((r) => `${GAVE[r]} ${generations([...g.gave.get(r)!].sort((a, b) => a - b))}`);
      return { turn: g.turn, text: `${nameOf(g.turn)} ${g.did} in Generation ${g.turn}. It ${list(clauses)}.` };
    });
}

/** "Generation 3", "Generations 3, 4 and 5". */
function generations(turns: number[]): string {
  return turns.length === 1 ? `Generation ${turns[0]}` : `Generations ${list(turns.map(String))}`;
}

function list(parts: string[]): string {
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
