import { create } from 'zustand';
import type { Gravestone } from '../api/Backend';
import {
  applyAction,
  CONFIG,
  endTurn,
  tick,
  visibleView,
  type ActionEntry,
  type ActionInput,
  type EndTurnResult,
  type Transition,
  type VisibleWorld,
  type WorldState,
} from '../engine';
import type { PlotId } from '../worldgen';

/** Something in front of the player that isn't a plot: a pond or the sea, or the house's oven. */
export type Spot = 'water' | 'oven';

/** What the player asks for; the store fills in the id, actor and order. */
export type ActionRequest = Omit<ActionInput, 'id' | 'actorId' | 'seq'>;

/** How often (in-turn seconds) the game loop runs the engine's `tick` for intra-turn effects. */
const TICK_EVERY = 0.25;

/** How long `request` takes, in turn seconds (decision 019). Eating takes as long as harvesting. */
export function actionSeconds(request: Pick<ActionRequest, 'type'>): number {
  return CONFIG.actionSeconds[request.type];
}

/** What the player is doing right now: it started at `from` and lands at `until`. */
export interface Work {
  request: ActionRequest;
  from: number;
  until: number;
}

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
  /** "How to play" is open: time and movement are frozen, as for the journal. */
  helpOpen: boolean;
  /** Generation the journal opens at (a gravestone's page); null = the latest page. */
  journalPage: number | null;
  /** Plot the player is standing next to, for the interact prompt. */
  nearby: PlotId | null;
  /** At the graveyard: the stone E reads. */
  nearbyStone: Gravestone | null;
  /** Facing a pond or the sea edge, where the can fills (027), or the oven, where you eat (029). */
  facing: Spot | null;
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
  /** The action under way, if any. It's applied to the world when the clock reaches `until`. */
  work: Work | null;
  /** The Fast Track menu is open, optionally on one plot's effect. */
  fastTrack: { plotId: PlotId | null } | null;
  /**
   * The last action tried, for the prompt and FX; `n` counts up so repeats still register. `done`
   * is set when it landed, `error` when it was refused (at the start, or at the end if the world
   * changed meanwhile).
   */
  lastAction: { n: number; request: ActionRequest; error?: string; done?: boolean } | null;

  /** Advances the clock unless the journal or "How to play" is open; stops at turnSeconds. */
  advance(dt: number): void;
  setJournalOpen(open: boolean): void;
  setHelpOpen(open: boolean): void;
  /** Opens the journal, at `page`'s generation if given. */
  openJournal(page?: number): void;
  setNearby(id: PlotId | null, stone?: Gravestone | null, facing?: Spot | null): void;
  setHoveredStone(stone: GameStore['hoveredStone']): void;
  /** Starts playing `world` (already through `beginTurn`, whose transitions it takes) as `actor`, from 6 am. */
  loadTurn(world: WorldState, actor: string, begun?: Transition[]): void;
  /**
   * Starts an action. It takes `actionSeconds` of turn time, with the player standing still, and
   * the engine applies it when the clock gets there. Returns the reason if it can't start.
   */
  act(request: ActionRequest): { error?: string };
  /** The reason `request` would fail right now, without doing it; null if it would work. */
  check(request: ActionRequest): string | null;
  openFastTrack(plotId?: PlotId | null): void;
  closeFastTrack(): void;
  /** Ends the turn in the engine: rot, upkeep, the summary. The world moves on to the next turn. */
  finishTurn(): EndTurnResult | null;
}

export const useGameStore = create<GameStore>((set, get) => {
  /** Applies finished work to the world at the time it finished. */
  const land = (work: Work) => {
    const { world, actor, log, lastAction } = get();
    if (!world) return;
    const n = (lastAction?.n ?? 0) + 1;
    const input: ActionInput = { ...work.request, id: `${world.turn}-${log.length}`, actorId: actor, seq: log.length };
    const r = applyAction(world, input, work.until);
    if (r.error || !r.entry) return set({ work: null, lastAction: { n, request: work.request, error: r.error ?? 'Not possible' } });
    const entry = r.entry;
    set((s) => ({
      world: r.state,
      view: visibleView(r.state, work.until),
      log: [...s.log, entry],
      transitions: [...s.transitions, ...r.transitions],
      work: null,
      lastAction: { n, request: work.request, done: true },
    }));
  };

  return {
    t: 0,
    turnSeconds: CONFIG.turnSeconds,
    journalOpen: false,
    helpOpen: false,
    journalPage: null,
    nearby: null,
    nearbyStone: null,
    facing: null,
    hoveredStone: null,
    world: null,
    view: null,
    actor: '',
    log: [],
    transitions: [],
    busyUntil: 0,
    work: null,
    fastTrack: null,
    lastAction: null,

    advance: (dt) => {
      const before = get();
      if (before.journalOpen || before.helpOpen || before.t >= before.turnSeconds) return;
      const next = Math.min(before.turnSeconds, before.t + dt);
      // The action under way lands first, at the time it finishes.
      if (before.work && next >= before.work.until) land(before.work);
      const { t, world } = get();
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
    setHelpOpen: (open) => set({ helpOpen: open }),
    setNearby: (id, stone = null, facing = null) => {
      const s = get();
      if (s.nearby !== id || s.nearbyStone?.turn !== stone?.turn || s.facing !== facing) {
        set({ nearby: id, nearbyStone: stone, facing });
      }
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
        helpOpen: false,
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
        work: null,
        fastTrack: null,
        lastAction: null,
      }),
    act: (request) => {
      const { world, t, turnSeconds, work, lastAction } = get();
      if (!world) throw new Error('act() before loadTurn()');
      const n = (lastAction?.n ?? 0) + 1;
      const until = t + actionSeconds(request);
      const error = work ? 'Busy' : until > turnSeconds ? 'Not enough time left today' : get().check(request);
      if (error) {
        set({ lastAction: { n, request, error } });
        return { error };
      }
      set({ work: { request, from: t, until }, busyUntil: until, lastAction: { n, request } });
      return {};
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
      // Work that hadn't finished by the end of the day never happened.
      set((s) => ({ world: r.state, transitions: [...s.transitions, ...r.transitions], fastTrack: null, work: null }));
      return r;
    },
  };
});

/** Time is up: the turn has reached 6 am the next morning. */
export const isTimeUp = (s: Pick<GameStore, 't' | 'turnSeconds'>) => s.t >= s.turnSeconds;
