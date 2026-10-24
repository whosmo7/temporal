import { create } from 'zustand';
import type { Gravestone } from '../api/Backend';
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
  /** Generation the journal opens at (a gravestone's page); null = the latest page. */
  journalPage: number | null;
  /** Plot the player is standing next to, for the interact prompt. */
  nearby: PlotId | null;
  /** At the graveyard: the stone E reads. */
  nearbyStone: Gravestone | null;
  /** Stone under the mouse, with its top-centre in canvas CSS px for the label. */
  hoveredStone: (Gravestone & { x: number; y: number }) | null;

  /** Advances the clock unless the journal is open; stops at turnSeconds. */
  advance(dt: number): void;
  setJournalOpen(open: boolean): void;
  /** Opens the journal, at `page`'s generation if given. */
  openJournal(page?: number): void;
  setNearby(id: PlotId | null, stone?: Gravestone | null): void;
  setHoveredStone(stone: GameStore['hoveredStone']): void;
  startTurn(turnSeconds: number): void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  t: 0,
  turnSeconds: 600,
  journalOpen: false,
  journalPage: null,
  nearby: null,
  nearbyStone: null,
  hoveredStone: null,

  advance: (dt) => {
    const { t, turnSeconds, journalOpen } = get();
    if (journalOpen || t >= turnSeconds) return;
    set({ t: Math.min(turnSeconds, t + dt) });
  },
  setJournalOpen: (open) => set(open ? { journalOpen: true } : { journalOpen: false, journalPage: null }),
  openJournal: (page) => set({ journalOpen: true, journalPage: page ?? null, hoveredStone: null }),
  setNearby: (id, stone = null) => {
    const s = get();
    if (s.nearby !== id || s.nearbyStone?.turn !== stone?.turn) set({ nearby: id, nearbyStone: stone });
  },
  setHoveredStone: (stone) => {
    const h = get().hoveredStone;
    if (h?.turn !== stone?.turn || h?.x !== stone?.x || h?.y !== stone?.y) set({ hoveredStone: stone });
  },
  startTurn: (turnSeconds) =>
    set({ t: 0, turnSeconds, journalOpen: false, journalPage: null, nearby: null, nearbyStone: null, hoveredStone: null }),
}));

/** Time is up: the turn has reached 6 am the next morning. */
export const isTimeUp = (s: Pick<GameStore, 't' | 'turnSeconds'>) => s.t >= s.turnSeconds;
