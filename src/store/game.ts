import { create } from 'zustand';
import type { PlotId } from '../worldgen';

/**
 * Play session state the world and the HUD share. The game loop (src/render/world-view.ts) owns
 * the clock and advances it; React reads slices with selectors. The engine `WorldState` and the
 * local action buffer join this once `applyAction` (02) exists.
 */
export interface GameStore {
  /** Seconds into the turn, 0..turnSeconds. In-game, 0 is 6 am and turnSeconds is 6 am next day. */
  t: number;
  turnSeconds: number;
  /** The journal is open: time and movement are frozen (decision 012). */
  journalOpen: boolean;
  /** Plot the player is standing next to, for the interact prompt. */
  nearby: PlotId | null;

  /** Advances the clock unless the journal is open; stops at turnSeconds. */
  advance(dt: number): void;
  setJournalOpen(open: boolean): void;
  setNearby(id: PlotId | null): void;
  startTurn(turnSeconds: number): void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  t: 0,
  turnSeconds: 600,
  journalOpen: false,
  nearby: null,

  advance: (dt) => {
    const { t, turnSeconds, journalOpen } = get();
    if (journalOpen || t >= turnSeconds) return;
    set({ t: Math.min(turnSeconds, t + dt) });
  },
  setJournalOpen: (open) => set({ journalOpen: open }),
  setNearby: (id) => {
    if (get().nearby !== id) set({ nearby: id });
  },
  startTurn: (turnSeconds) => set({ t: 0, turnSeconds, journalOpen: false, nearby: null }),
}));

/** Time is up: the turn has reached 6 am the next morning. */
export const isTimeUp = (s: Pick<GameStore, 't' | 'turnSeconds'>) => s.t >= s.turnSeconds;
