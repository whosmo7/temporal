import type { Biome } from '../worldgen/types';
import type { PresetName } from '../worldgen/presets';
import type {
  ActionEntry,
  Backend,
  ClaimedWorld,
  CommitInput,
  CompletedWorld,
  Drawing,
  JournalPage,
  Profile,
  Replay,
  TurnSummary,
  WorldState,
} from './Backend';

// Hot-seat backend on localStorage, for development and the offline demo.
// Dev only: passwords are stored in plain text.

const STORAGE_KEY = 'inheritance.local';

// TODO: read these from settings once LocalBackend has an admin settings call.
// Matches the settings defaults in the schema migration (decision 007).
const TURN_SECONDS = 600;
const JOURNAL_ALLOWANCE_SECONDS = 300;
const LOCK_GRACE_SECONDS = 120;
const DEFAULT_GENERATIONS = 6;
const INHERIT_RATIO = 0.7;
const BIOMES: Biome[] = ['forest', 'island'];

interface LocalUser {
  id: string;
  username: string;
  password: string;
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
  completedAt: string | null;
}

interface LocalTurn {
  worldId: string;
  turn: number;
  playerId: string;
  actions: ActionEntry[];
  snapshot: WorldState | null;
  journal: { text: string; drawing: Drawing };
  committedAt: string;
}

interface Db {
  users: LocalUser[];
  session: string | null;
  worlds: LocalWorld[];
  turns: LocalTurn[];
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
  return { id: user.id, username: user.username };
}

function requireUser(db: Db): LocalUser {
  const user = db.users.find((u) => u.id === db.session);
  if (!user) throw new Error('Not signed in');
  return user;
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
    const user = { id: crypto.randomUUID(), username: name, password };
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
    if (!world) {
      const open = db.worlds.filter((w) => w.status === 'open' && !w.lockedBy);
      if (open.length > 0 && Math.random() < INHERIT_RATIO) {
        world = open[Math.floor(Math.random() * open.length)];
      }
    }
    if (!world) {
      world = {
        id: crypto.randomUUID(),
        seed: Math.floor(Math.random() * 2 ** 31),
        biome: BIOMES[Math.floor(Math.random() * BIOMES.length)] ?? 'forest',
        preset: 'default',
        generationCount: DEFAULT_GENERATIONS,
        turnSeconds: TURN_SECONDS,
        currentTurn: 1,
        status: 'open',
        lockedBy: null,
        lockExpiresAt: null,
        forcedFor: null,
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

    // TODO: re-run the engine here (beginTurn, apply actions, endTurn) and store its snapshot.
    db.turns.push({
      worldId: world.id,
      turn: world.currentTurn,
      playerId: me.id,
      actions: input.actions,
      snapshot: null,
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
    return null;
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
      transitions: [], // TODO: from the engine once it exists
      journal: journalOf(db, worldId),
    };
  }

  async forceAssign(worldId: string, username: string): Promise<void> {
    const db = load();
    const world = db.worlds.find((w) => w.id === worldId);
    const user = db.users.find((u) => u.username === username.toLowerCase());
    if (!world || !user) throw new Error('World or user not found');
    world.forcedFor = user.id;
    save(db);
  }
}
