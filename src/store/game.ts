import { create } from 'zustand';
import type { Gravestone } from '../api/Backend';
import {
  applyAction,
  endTurn,
  tick,
  visibleView,
  type ActionEntry,
  type ActionInput,
  type ActionResult,
  type EndTurnResult,
  type Transition,
  type VisibleWorld,
  type WorldState,
} from '../engine';
import type { PlotId } from '../worldgen';

/** What the player asks for; the store fills in the id, actor and order. */
export type ActionRequest = Omit<ActionInput, 'id' | 'actorId' | 'seq'>;

/** How often (in-turn seconds) the game loop runs the engine's `tick` for intra-turn effects. */
const TICK_EVERY = 0.25;
/** Acting takes real turn time: the player stands still this long after an action (04). */
export const ACTION_TIME = 0.5;

/**
 * Play session state the world and the HUD share. The game loop (src/render/world-view.ts) owns
 * the clock and advances it; React reads slices with selectors. Engine state only changes through
 * engine functions here (`applyAction`, `tick`, `endTurn`); everything drawn comes from `view`.
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

  /** The engine world for this turn, after `beginTurn`. Null until a turn is loaded. */
  world: WorldState | null;
  /** All the play UI may see of it: `visibleView(world, t)`, refreshed after each action and tick. */
  view: VisibleWorld | null;
  /** Who is playing (the actor on every action). */
  actor: string;
  /** This turn's action log and transitions, in order, for the commit (07). */
  log: ActionEntry[];
  transitions: Transition[];
  /** In-turn time until which the player is busy acting and can't walk. */
  busyUntil: number;
  /** The Fast Track menu is open, optionally on one plot's effect. */
  fastTrack: { plotId: PlotId | null } | null;
  /** The last action tried, for the prompt and FX; `n` counts up so repeats still register. */
  lastAction: { n: number; request: ActionRequest; error?: string } | null;

  /** Advances the clock unless the journal is open; stops at turnSeconds. */
  advance(dt: number): void;
  setJournalOpen(open: boolean): void;
  /** Opens the journal, at `page`'s generation if given. */
  openJournal(page?: number): void;
  setNearby(id: PlotId | null, stone?: Gravestone | null): void;
  setHoveredStone(stone: GameStore['hoveredStone']): void;
  /** Starts playing `world` (already through `beginTurn`, whose transitions it takes) as `actor`, from 6 am. */
  loadTurn(world: WorldState, actor: string, begun?: Transition[]): void;
  /** Tries an action now. On success the world, log and view move on; on error nothing changes. */
  act(request: ActionRequest): ActionResult;
  /** The reason `request` would fail right now, without doing it; null if it would work. */
  check(request: ActionRequest): string | null;
  openFastTrack(plotId?: PlotId | null): void;
  closeFastTrack(): void;
  /** Ends the turn in the engine: rot, upkeep, the summary. The world moves on to the next turn. */
  finishTurn(): EndTurnResult | null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  t: 0,
  turnSeconds: 600,
  journalOpen: false,
  journalPage: null,
  nearby: null,
  nearbyStone: null,
  hoveredStone: null,
  world: null,
  view: null,
  actor: '',
  log: [],
  transitions: [],
  busyUntil: 0,
  fastTrack: null,
  lastAction: null,

  advance: (dt) => {
    const { t, turnSeconds, journalOpen, world } = get();
    if (journalOpen || t >= turnSeconds) return;
    const next = Math.min(turnSeconds, t + dt);
    if (!world || Math.floor(next / TICK_EVERY) === Math.floor(t / TICK_EVERY)) return set({ t: next });
    // ~4 Hz: crops ripen, and the view catches up with the time of day.
    const r = tick(world, next);
    set((s) => ({
      t: next,
      world: r.state,
      view: visibleView(r.state, next),
      transitions: r.transitions.length ? [...s.transitions, ...r.transitions] : s.transitions,
    }));
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
  loadTurn: (world, actor, begun = []) =>
    set({
      t: 0,
      turnSeconds: world.turnSeconds,
      journalOpen: false,
      journalPage: null,
      nearby: null,
      nearbyStone: null,
      hoveredStone: null,
      world,
      view: visibleView(world, 0),
      actor,
      log: [],
      transitions: begun,
      busyUntil: 0,
      fastTrack: null,
      lastAction: null,
    }),
  act: (request) => {
    const { world, t, actor, log, lastAction } = get();
    if (!world) throw new Error('act() before loadTurn()');
    const n = (lastAction?.n ?? 0) + 1;
    const input: ActionInput = { ...request, id: `${world.turn}-${log.length}`, actorId: actor, seq: log.length };
    const r = applyAction(world, input, t);
    if (r.error || !r.entry) {
      set({ lastAction: { n, request, error: r.error ?? 'Not possible' } });
      return r;
    }
    const entry = r.entry;
    set((s) => ({
      world: r.state,
      view: visibleView(r.state, t),
      log: [...s.log, entry],
      transitions: [...s.transitions, ...r.transitions],
      busyUntil: t + ACTION_TIME,
      lastAction: { n, request },
    }));
    return r;
  },
  check: (request) => {
    const { world, t, actor, log } = get();
    if (!world) return 'No world';
    const r = applyAction(world, { ...request, id: 'check', actorId: actor, seq: log.length }, t);
    return r.error ?? null;
  },
  openFastTrack: (plotId = null) => set({ fastTrack: { plotId } }),
  closeFastTrack: () => set({ fastTrack: null }),
  finishTurn: () => {
    const { world } = get();
    if (!world) return null;
    const r = endTurn(world);
    set((s) => ({ world: r.state, transitions: [...s.transitions, ...r.transitions], fastTrack: null }));
    return r;
  },
}));

/** Time is up: the turn has reached 6 am the next morning. */
export const isTimeUp = (s: Pick<GameStore, 't' | 'turnSeconds'>) => s.t >= s.turnSeconds;
