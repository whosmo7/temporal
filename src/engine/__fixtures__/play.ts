// Test driver: plays a world turn by turn like the game loop does, keeping the log and every
// transition, so tests read as "gen 1: plant the orchard; gen 3: harvest it".

import { applyAction } from '../actions';
import { createWorld, type CreateWorldOptions } from '../createWorld';
import { beginTurn, endTurn } from '../turn';
import type {
  ActionEntry,
  ActionInput,
  ActionResult,
  Transition,
  TurnSummary,
  WorldState,
} from '../types';

export interface Game {
  state: WorldState;
  log: ActionEntry[];
  transitions: Transition[];
  summaries: TurnSummary[];
  begin(): Game;
  act(type: ActionInput['type'], opts?: Partial<ActionInput> & { t?: number }): ActionResult;
  end(): Game;
  /** begin → actions → end for one generation. */
  turn(actions?: (game: Game) => void): Game;
}

export const OPTS: CreateWorldOptions = { worldId: 'world-1', biome: 'forest' };

/**
 * Seeded events are cleared unless `withEvents` is set, so a test only meets the drought or good
 * harvest it adds itself.
 */
export function newGame(
  seed = 7,
  opts: CreateWorldOptions = OPTS,
  actor = 'AL',
  withEvents = false,
): Game {
  let seq = 0;
  const start = createWorld(seed, opts).state;
  if (!withEvents) start.events = [];
  const game: Game = {
    state: start,
    log: [],
    transitions: [],
    summaries: [],
    begin() {
      const r = beginTurn(game.state);
      game.state = r.state;
      game.transitions.push(...r.transitions);
      seq = 0;
      return game;
    },
    act(type, { t = 0, ...rest } = {}) {
      const input: ActionInput = {
        id: `${game.state.turn}-${seq}`,
        actorId: actor,
        type,
        seq,
        ...rest,
      };
      const r = applyAction(game.state, input, t);
      if (r.entry) {
        game.state = r.state;
        game.log.push(r.entry);
        game.transitions.push(...r.transitions);
        seq++;
      }
      return r;
    },
    end() {
      const r = endTurn(game.state);
      game.state = r.state;
      game.transitions.push(...r.transitions);
      game.summaries.push(r.summary);
      return game;
    },
    turn(actions) {
      game.begin();
      actions?.(game);
      return game.end();
    },
  };
  return game;
}

/** Plays one generation as `actor`, for multi-player scenarios. */
export function asActor(game: Game, actor: string, actions: (game: Game) => void): Game {
  return game.turn((g) => {
    const original = g.act;
    g.act = (type, opts = {}) => original(type, { actorId: actor, ...opts });
    actions(g);
    g.act = original;
  });
}
