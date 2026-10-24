import { applyAction, beginTurn, createWorld, endTurn } from '../engine';
import type { Biome } from '../worldgen/types';
import type { PresetName } from '../worldgen/presets';
import type {
  ActionEntry,
  AdminWorld,
  Backend,
  ClaimedWorld,
  CommitInput,
  CompletedWorld,
  Drawing,
  JournalPage,
  Profile,
  Replay,
  Settings,
  Transition,
  TurnSummary,
  WorldState,
} from './Backend';

// Hot-seat backend on localStorage, for development and the offline demo.
// Dev only: passwords are stored in plain text. Signing up as `admin` makes an admin, standing in
// for `update profiles set is_admin = true` (07); everything here is in the browser anyway.

const STORAGE_KEY = 'inheritance.local';

// Matches the settings defaults in the schema migration (decision 007).
const DEFAULT_SETTINGS: Settings = { defaultTurnSeconds: 600, defaultGenerationCount: 6, inheritRatio: 0.7 };
const JOURNAL_ALLOWANCE_SECONDS = 300;
const LOCK_GRACE_SECONDS = 120;
const ADMIN_USERNAME = 'admin';
const BIOMES: Biome[] = ['forest', 'island'];

interface LocalUser {
  id: string;
  username: string;
  password: string;
  isAdmin?: boolean;
}

interface LocalWorld {
  id: string;
  seed: number;
  biome: Biome;
  preset: PresetName;
  generationCount: number;
  turnSeconds: number;
  currentTurn: number;
  status: 'open' | 'complete';
  lockedBy: string | null;
  lockExpiresAt: number | null;
  forcedFor: string | null;
  createdAt?: string;
  completedAt: string | null;
}

interface LocalTurn {
  worldId: string;
  turn: number;
  playerId: string;
  actions: ActionEntry[];
  transitions: Transition[];
  snapshot: WorldState | null;
  journal: { text: string; drawing: Drawing };
  committedAt: string;
}

interface Db {
  users: LocalUser[];
  session: string | null;
  worlds: LocalWorld[];
  turns: LocalTurn[];
  settings?: Settings;
}

function load(): Db {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw) as Db;
  return { users: [], session: null, worlds: [], turns: [] };
}

function save(db: Db): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function toProfile(user: LocalUser): Profile {
  return { id: user.id, username: user.username, isAdmin: !!user.isAdmin };
}

function requireUser(db: Db): LocalUser {
  const user = db.users.find((u) => u.id === db.session);
  if (!user) throw new Error('Not signed in');
  return user;
}

function requireAdmin(db: Db): LocalUser {
  const user = requireUser(db);
  if (!user.isAdmin) throw new Error('Not allowed');
  return user;
}

function worldOf(db: Db, worldId: string): LocalWorld {
  const world = db.worlds.find((w) => w.id === worldId);
  if (!world) throw new Error('World not found');
  return world;
}

function settingsOf(db: Db): Settings {
  return { ...DEFAULT_SETTINGS, ...db.settings };
}

function usernameOf(db: Db, id: string): string {
  return db.users.find((u) => u.id === id)?.username ?? 'unknown';
}

function turnsOf(db: Db, worldId: string): LocalTurn[] {
  return db.turns.filter((t) => t.worldId === worldId).sort((a, b) => a.turn - b.turn);
}

function journalOf(db: Db, worldId: string): JournalPage[] {
  return turnsOf(db, worldId).map((t) => ({
    turn: t.turn,
    authorUsername: usernameOf(db, t.playerId),
    text: t.journal.text,
    drawing: t.journal.drawing,
  }));
}

function toClaimed(db: Db, world: LocalWorld): ClaimedWorld {
  const turns = turnsOf(db, world.id);
  return {
    worldId: world.id,
    seed: world.seed,
    biome: world.biome,
    preset: world.preset,
    turn: world.currentTurn,
    generationCount: world.generationCount,
    turnSeconds: world.turnSeconds,
    lockExpiresAt: new Date(world.lockExpiresAt ?? 0).toISOString(),
    snapshot: turns.at(-1)?.snapshot ?? null,
    journal: journalOf(db, world.id),
    gravestones: turns.map((t) => ({ turn: t.turn, username: usernameOf(db, t.playerId) })),
  };
}

function lock(world: LocalWorld, userId: string, now: number): void {
  world.lockedBy = userId;
  world.lockExpiresAt =
    now + (world.turnSeconds + JOURNAL_ALLOWANCE_SECONDS + LOCK_GRACE_SECONDS) * 1000;
}

export class LocalBackend implements Backend {
  async signUp(username: string, password: string): Promise<Profile> {
    const db = load();
    const name = username.toLowerCase();
    if (db.users.some((u) => u.username === name)) throw new Error('Username taken');
    const user: LocalUser = { id: crypto.randomUUID(), username: name, password, isAdmin: name === ADMIN_USERNAME };
    db.users.push(user);
    db.session = user.id;
    save(db);
    return toProfile(user);
  }

  async signIn(username: string, password: string): Promise<Profile> {
    const db = load();
    const name = username.toLowerCase();
    const user = db.users.find((u) => u.username === name && u.password === password);
    if (!user) throw new Error('Wrong username or password');
    db.session = user.id;
    save(db);
    return toProfile(user);
  }

  async signOut(): Promise<void> {
    const db = load();
    db.session = null;
    save(db);
  }

  async currentUser(): Promise<Profile | null> {
    const db = load();
    const user = db.users.find((u) => u.id === db.session);
    return user ? toProfile(user) : null;
  }

  // Same order as the claim_world RPC in plan 07.
  async claimWorld(): Promise<ClaimedWorld> {
    const db = load();
    const me = requireUser(db);
    const now = Date.now();

    // 1. Resume a world we already hold.
    const held = db.worlds.find((w) => w.lockedBy === me.id && (w.lockExpiresAt ?? 0) > now);
    if (held) return toClaimed(db, held);

    // 3. Expire stale locks. The turn is voided; nothing was written.
    for (const w of db.worlds) {
      if (w.lockExpiresAt !== null && w.lockExpiresAt <= now) {
        w.lockedBy = null;
        w.lockExpiresAt = null;
      }
    }

    // 2. Admin force-assign.
    let world = db.worlds.find((w) => w.forcedFor === me.id && w.status === 'open' && !w.lockedBy);
    if (world) world.forcedFor = null;

    // 4. Inherit an open world, or start a new one.
    const settings = settingsOf(db);
    if (!world) {
      const open = db.worlds.filter((w) => w.status === 'open' && !w.lockedBy);
      if (open.length > 0 && Math.random() < settings.inheritRatio) {
        world = open[Math.floor(Math.random() * open.length)];
      }
    }
    if (!world) {
      world = {
        id: crypto.randomUUID(),
        seed: Math.floor(Math.random() * 2 ** 31),
        biome: BIOMES[Math.floor(Math.random() * BIOMES.length)] ?? 'forest',
        preset: 'default',
        generationCount: settings.defaultGenerationCount,
        turnSeconds: settings.defaultTurnSeconds,
        currentTurn: 1,
        status: 'open',
        lockedBy: null,
        lockExpiresAt: null,
        forcedFor: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      db.worlds.push(world);
    }

    // 5. Lock it.
    lock(world, me.id, now);
    save(db);
    return toClaimed(db, world);
  }

  async commitTurn(input: CommitInput): Promise<TurnSummary> {
    const db = load();
    const me = requireUser(db);
    const world = db.worlds.find((w) => w.id === input.worldId);
    if (!world) throw new Error('World not found');
    if (world.lockedBy !== me.id || (world.lockExpiresAt ?? 0) <= Date.now()) {
      throw new Error('Your turn has expired');
    }

    // Re-run the turn through the engine, as commit-turn does, so a bad log is rejected.
    const previous = turnsOf(db, world.id).at(-1)?.snapshot;
    let state =
      previous ??
      createWorld(world.seed, {
        worldId: world.id,
        biome: world.biome,
        preset: world.preset,
        generationCount: world.generationCount,
        turnSeconds: world.turnSeconds,
      }).state;
    const begun = beginTurn(state);
    state = begun.state;
    const transitions: Transition[] = [...begun.transitions];
    const actions: ActionEntry[] = [];
    for (const action of [...input.actions].sort((a, b) => a.seq - b.seq)) {
      const result = applyAction(state, action, action.committedAt.t ?? 0);
      if (result.error || !result.entry) throw new Error(`Invalid action: ${result.error}`);
      state = result.state;
      transitions.push(...result.transitions);
      actions.push(result.entry);
    }
    const ended = endTurn(state);
    transitions.push(...ended.transitions);

    db.turns.push({
      worldId: world.id,
      turn: world.currentTurn,
      playerId: me.id,
      actions,
      transitions,
      snapshot: ended.state,
      journal: input.journal,
      committedAt: new Date().toISOString(),
    });

    world.currentTurn += 1;
    world.lockedBy = null;
    world.lockExpiresAt = null;
    if (world.currentTurn > world.generationCount) {
      world.status = 'complete';
      world.completedAt = new Date().toISOString();
    }
    save(db);
    return ended.summary;
  }

  async listCompletedWorlds(): Promise<CompletedWorld[]> {
    const db = load();
    return db.worlds
      .filter((w) => w.status === 'complete')
      .map((w) => ({
        worldId: w.id,
        seed: w.seed,
        biome: w.biome,
        generationCount: w.generationCount,
        completedAt: w.completedAt ?? '',
        players: turnsOf(db, w.id).map((t) => usernameOf(db, t.playerId)),
        preset: w.preset,
        finalState: turnsOf(db, w.id).at(-1)?.snapshot ?? null,
      }));
  }

  async getReplay(worldId: string): Promise<Replay> {
    const db = load();
    const world = db.worlds.find((w) => w.id === worldId);
    if (!world || world.status !== 'complete') throw new Error('World not found');
    const turns = turnsOf(db, worldId);
    return {
      worldId: world.id,
      seed: world.seed,
      biome: world.biome,
      snapshots: turns.flatMap((t) => (t.snapshot ? [t.snapshot] : [])),
      actions: turns.flatMap((t) => t.actions),
      transitions: turns.flatMap((t) => t.transitions),
      journal: journalOf(db, worldId),
    };
  }

  async listWorlds(): Promise<AdminWorld[]> {
    const db = load();
    requireAdmin(db);
    const name = (id: string | null) => (id ? usernameOf(db, id) : null);
    return db.worlds.map((w) => ({
      worldId: w.id,
      seed: w.seed,
      biome: w.biome,
      status: w.status,
      currentTurn: w.currentTurn,
      generationCount: w.generationCount,
      turnSeconds: w.turnSeconds,
      lockedBy: name(w.lockedBy),
      lockExpiresAt: w.lockExpiresAt === null ? null : new Date(w.lockExpiresAt).toISOString(),
      forcedFor: name(w.forcedFor),
      players: turnsOf(db, w.id).map((t) => usernameOf(db, t.playerId)),
      createdAt: w.createdAt ?? null,
    }));
  }

  async getSettings(): Promise<Settings> {
    return settingsOf(load());
  }

  async setSettings(settings: Partial<Settings>): Promise<void> {
    const db = load();
    requireAdmin(db);
    const next = { ...settingsOf(db), ...settings };
    if (!(next.defaultTurnSeconds > 0 && next.defaultGenerationCount > 0)) throw new Error('Must be above 0');
    if (!(next.inheritRatio >= 0 && next.inheritRatio <= 1)) throw new Error('Inherit ratio must be between 0 and 1');
    db.settings = next;
    save(db);
  }

  async configureWorld(worldId: string, config: { turnSeconds?: number; generationCount?: number }): Promise<void> {
    const db = load();
    requireAdmin(db);
    const world = worldOf(db, worldId);
    if (world.status === 'complete') throw new Error('This world has ended');
    const { turnSeconds = world.turnSeconds, generationCount = world.generationCount } = config;
    if (!(turnSeconds > 0)) throw new Error('Turn length must be above 0');
    if (generationCount < world.currentTurn) throw new Error(`At least ${world.currentTurn} generations: that one is being played or next`);
    world.turnSeconds = turnSeconds;
    world.generationCount = generationCount;
    save(db);
  }

  async forceAssign(worldId: string, username: string): Promise<void> {
    const db = load();
    requireAdmin(db);
    const world = worldOf(db, worldId);
    if (world.status !== 'open') throw new Error('This world has ended');
    const user = db.users.find((u) => u.username === username.trim().toLowerCase());
    if (!user) throw new Error('No player by that name');
    world.forcedFor = user.id;
    save(db);
  }

  async markComplete(worldId: string): Promise<void> {
    const db = load();
    requireAdmin(db);
    const world = worldOf(db, worldId);
    if (world.status === 'complete') return;
    const played = turnsOf(db, worldId).length;
    if (played === 0) throw new Error('Nobody has played this world yet');
    world.status = 'complete';
    world.generationCount = played;
    world.completedAt = new Date().toISOString();
    world.lockedBy = null;
    world.lockExpiresAt = null;
    world.forcedFor = null;
    save(db);
  }

  async clearLock(worldId: string): Promise<void> {
    const db = load();
    requireAdmin(db);
    const world = worldOf(db, worldId);
    world.lockedBy = null;
    world.lockExpiresAt = null;
    save(db);
  }
}
