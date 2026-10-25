import type { ActionEntry, Backend, SeededWorld } from './Backend';
import demoWorld from './demo-world.json';

// Plays the demo world's early generations (10 › Seeding) through the normal claim → commit path,
// so the result is the same as teammates playing them. scripts/seed-demo.ts runs it against
// Supabase; the offline build (VITE_OFFLINE=1) and LocalBackend.createDemoWorld run it locally. The
// seed-demo Edge Function plays the same founders server-side with `demoActions` (decision 036).

export interface DemoAction {
  type: ActionEntry['type'];
  plot?: string;
  targetEffectId?: string;
  eat?: boolean;
  /** Seconds into the turn. */
  t: number;
}

export interface DemoConfig {
  world: SeededWorld;
  /** Gets the world force-assigned once the founders are done. */
  judge: string;
  generations: { player: string; actions: DemoAction[]; journal: string }[];
}

export const DEMO = demoWorld as DemoConfig;

export interface DemoAccounts {
  /** Signs in as `username`, creating the account if needed, and returns a backend acting as them. */
  as(username: string): Promise<Backend>;
  admin(): Promise<Backend>;
}

/** A founder generation's actions as log entries for generation `turn` of `worldId`. */
export function demoActions(worldId: string, turn: number, actions: DemoAction[]): ActionEntry[] {
  return actions.map((a, seq) => ({
    id: `demo-${turn}-${seq}`,
    worldId,
    actorId: '',
    type: a.type,
    ...(a.plot ? { plotId: a.plot } : {}),
    ...(a.targetEffectId ? { targetEffectId: a.targetEffectId } : {}),
    ...(a.eat ? { eat: true } : {}),
    committedAt: { turn, t: a.t },
    dueAt: { turn, t: a.t },
    seq,
  }));
}

/**
 * Creates one copy of the demo world and plays its founder generations. Returns the world id.
 * `assignJudge: false` makes a spare: force-assign it by hand (admin screen) if the main one breaks.
 */
export async function seedDemo(
  accounts: DemoAccounts,
  config: DemoConfig = DEMO,
  assignJudge = true,
): Promise<string> {
  const worldId = await (await accounts.admin()).createSeededWorld(config.world);
  for (const gen of config.generations) {
    await accounts.as(gen.player); // the account must exist to be force-assigned
    await (await accounts.admin()).forceAssign(worldId, gen.player);
    const player = await accounts.as(gen.player);
    const world = await player.claimWorld();
    if (world.worldId !== worldId) {
      throw new Error(`${gen.player} already holds world ${world.worldId}; let it expire first`);
    }
    await player.commitTurn({
      worldId,
      actions: demoActions(worldId, world.turn, gen.actions),
      journal: { text: gen.journal, drawing: null },
    });
  }
  if (assignJudge) {
    await accounts.as(config.judge); // the account must exist to be force-assigned
    await (await accounts.admin()).forceAssign(worldId, config.judge);
  }
  return worldId;
}
