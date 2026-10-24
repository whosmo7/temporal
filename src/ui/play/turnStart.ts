import type { ClaimedWorld, CommitInput } from '../../api';
import { beginTurn, createWorld } from '../../engine';
import type { TurnStart } from './Game';

/**
 * The turn a claim hands you: the last generation's snapshot (or a new world for generation 1)
 * through `beginTurn`, as the server's commit-turn will rebuild it, with the pages and stones so far.
 */
export function turnStart(claim: ClaimedWorld): TurnStart {
  const before =
    claim.snapshot ??
    createWorld(claim.seed, {
      worldId: claim.worldId,
      biome: claim.biome,
      preset: claim.preset,
      generationCount: claim.generationCount,
      turnSeconds: claim.turnSeconds,
    }).state;
  const begun = beginTurn(before);
  return { world: begun.state, begun: begun.transitions, pages: claim.journal, stones: claim.gravestones };
}

// A sealed turn is kept in localStorage until the backend has it, so a failed commit or a closed
// tab doesn't lose the page (05). Storage can be missing or full; then there is just no copy.
const UNSAVED_KEY = 'inheritance.unsaved';

export function keepUnsaved(input: CommitInput): void {
  try {
    localStorage.setItem(UNSAVED_KEY, JSON.stringify(input));
  } catch {
    // No local copy; the commit itself may still go through.
  }
}

export function loadUnsaved(): CommitInput | null {
  try {
    const raw = localStorage.getItem(UNSAVED_KEY);
    return raw ? (JSON.parse(raw) as CommitInput) : null;
  } catch {
    return null;
  }
}

export function clearUnsaved(): void {
  try {
    localStorage.removeItem(UNSAVED_KEY);
  } catch {
    // Nothing to clear.
  }
}
