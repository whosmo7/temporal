import type { Biome } from '../worldgen/types';
import type { PresetName } from '../worldgen/presets';
import { worldName } from '../worldgen/names';
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
  SeededWorld,
  Settings,
  Transition,
  TurnSummary,
  WorldState,
} from './Backend';
import { getLastWorld, setLastWorld } from './lastWorld';
import { runTurn } from './runTurn';

// Hot-seat backend on localStorage, for development and the offline demo. Same rules as the
// Supabase RPCs in supabase/migrations (claim order, lock TTL, heartbeat cap, void on expiry).
// Dev only: passwords are stored in plain text, and every user is an admin.

const STORAGE_KEY = 'inheritance.local';

// Matches the settings defaults in the migrations (decision 007, 019).
export const DEFAULT_SETTINGS: Settings = {
  inheritRatio: 0.7,
  defaultTurnSeconds: 600,
  defaultGenerationCount: 6,
  journalAllowanceSeconds: 300,
  lockGraceSeconds: 120,
  heartbeatCapSeconds: 900,
};
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
  lockedAt: number | null;
  lockExpiresAt: number | null;
  forcedFor: string | null;
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

export interface LocalDb {
  users: LocalUser[];
  session: string | null;
  settings?: Settings;
  worlds: LocalWorld[];
  turns: LocalTurn[];
}

export interface LocalBackendOptions {
  storageKey?: string;
  now?: () => number;
  random?: () => number;
  /** Starting data when storage is empty (the offline demo bakes its world in here). */
  initial?: LocalDb;
}

function toProfile(user: LocalUser): Profile {
  return { id: user.id, username: user.username, isAdmin: true };
}

export class LocalBackend implements Backend {
  private readonly key: string;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly initial: LocalDb | undefined;

  constructor(options: LocalBackendOptions = {}) {
    this.key = options.storageKey ?? STORAGE_KEY;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.initial = options.initial;
  }

  private load(): LocalDb {
    const raw = localStorage.getItem(this.key);
    if (raw) return JSON.parse(raw) as LocalDb;
    if (this.initial) return structuredClone(this.initial);
    return { users: [], session: null, worlds: [], turns: [] };
  }

  private save(db: LocalDb): void {
    localStorage.setItem(this.key, JSON.stringify(db));
  }

  private settings(db: LocalDb): Settings {
    return { ...DEFAULT_SETTINGS, ...db.settings };
  }

  private requireUser(db: LocalDb): LocalUser {
    const user = db.users.find((u) => u.id === db.session);
    if (!user) throw new Error('Not signed in');
    return user;
  }

  private ttlMs(db: LocalDb, world: LocalWorld): number {
    const s = this.settings(db);
    return (world.turnSeconds + s.journalAllowanceSeconds + s.lockGraceSeconds) * 1000;
  }

  private holds(world: LocalWorld, userId: string): boolean {
    return world.lockedBy === userId && (world.lockExpiresAt ?? 0) > this.now();
  }

  async signUp(username: string, password: string): Promise<Profile> {
    const db = this.load();
    const name = username.toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(name)) {
      throw new Error('Usernames are 3 to 20 letters, numbers or underscores');
    }
    if (db.users.some((u) => u.username === name)) throw new Error('Username taken');
    const user = { id: crypto.randomUUID(), username: name, password };
    db.users.push(user);
    db.session = user.id;
    this.save(db);
    return toProfile(user);
  }

  async signIn(username: string, password: string): Promise<Profile> {
    const db = this.load();
    const name = username.toLowerCase();
    const user = db.users.find((u) => u.username === name && u.password === password);
    if (!user) throw new Error('Wrong username or password');
    db.session = user.id;
    this.save(db);
    return toProfile(user);
  }

  async signOut(): Promise<void> {
    const db = this.load();
    db.session = null;
    this.save(db);
  }

  async currentUser(): Promise<Profile | null> {
    const db = this.load();
    const user = db.users.find((u) => u.id === db.session);
    return user ? toProfile(user) : null;
  }

  // Same order as claim_world in supabase/migrations.
  async claimWorld(): Promise<ClaimedWorld> {
    const db = this.load();
    const me = this.requireUser(db);
    const now = this.now();
    const settings = this.settings(db);

    // 1. Resume a world we already hold.
    const held = db.worlds.find((w) => this.holds(w, me.id));
    if (held) return this.toClaimed(db, held);

    // 3. Expire stale locks. The turn is voided; nothing was written.
    for (const w of db.worlds) {
      if (w.lockedBy !== null && (w.lockExpiresAt ?? 0) <= now) {
        w.lockedBy = null;
        w.lockedAt = null;
        w.lockExpiresAt = null;
      }
    }

    // 2. Admin force-assign.
    let world = db.worlds.find((w) => w.forcedFor === me.id && w.status === 'open' && !w.lockedBy);

    // 4. Inherit an open world (not the one this device just played), or start a new one.
    if (!world && this.random() < settings.inheritRatio) {
      const avoid = getLastWorld(me.id);
      const open = db.worlds.filter(
        (w) =>
          w.status === 'open' &&
          !w.lockedBy &&
          (w.forcedFor === null || w.forcedFor === me.id) &&
          w.id !== avoid,
      );
      world = open[Math.floor(this.random() * open.length)];
    }
    if (!world) {
      world = this.newWorld(
        Math.floor(this.random() * 2147483647),
        BIOMES[Math.floor(this.random() * BIOMES.length)] ?? 'forest',
        settings,
      );
      db.worlds.push(world);
    }

    // 5. Lock it.
    world.lockedBy = me.id;
    world.lockedAt = now;
    world.lockExpiresAt = now + this.ttlMs(db, world);
    world.forcedFor = null;
    this.save(db);
    return this.toClaimed(db, world);
  }

  async heartbeat(worldId: string): Promise<string | null> {
    const db = this.load();
    const me = this.requireUser(db);
    const world = db.worlds.find((w) => w.id === worldId);
    if (!world || !this.holds(world, me.id)) return null;
    const s = this.settings(db);
    const cap = (world.lockedAt ?? 0) + this.ttlMs(db, world) + s.heartbeatCapSeconds * 1000;
    const extended = Math.max(world.lockExpiresAt ?? 0, this.now() + s.lockGraceSeconds * 1000);
    world.lockExpiresAt = Math.min(extended, cap);
    this.save(db);
    return new Date(world.lockExpiresAt).toISOString();
  }

  async commitTurn(input: CommitInput): Promise<TurnSummary> {
    const db = this.load();
    const me = this.requireUser(db);
    const world = db.worlds.find((w) => w.id === input.worldId);
    if (!world) throw new Error('World not found');
    if (!this.holds(world, me.id)) throw new Error('Your turn has expired');

    // Re-run the turn through the engine, as commit-turn does, so a bad log is rejected.
    const result = runTurn(
      {
        worldId: world.id,
        seed: world.seed,
        biome: world.biome,
        preset: world.preset,
        generationCount: world.generationCount,
        turnSeconds: world.turnSeconds,
      },
      this.turnsOf(db, world.id).at(-1)?.snapshot ?? null,
      input.actions,
      me.id,
    );

    db.turns.push({
      worldId: world.id,
      turn: world.currentTurn,
      playerId: me.id,
      actions: result.actions,
      transitions: result.transitions,
      snapshot: result.state,
      journal: input.journal,
      committedAt: new Date(this.now()).toISOString(),
    });

    world.currentTurn += 1;
    world.lockedBy = null;
    world.lockedAt = null;
    world.lockExpiresAt = null;
    if (world.currentTurn > world.generationCount) {
      world.status = 'complete';
      world.completedAt = new Date(this.now()).toISOString();
    }
    this.save(db);
    setLastWorld(me.id, world.id);
    return result.summary;
  }

  async listCompletedWorlds(): Promise<CompletedWorld[]> {
    const db = this.load();
    return db.worlds
      .filter((w) => w.status === 'complete')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      .map((w) => ({
        worldId: w.id,
        name: worldName(w.seed, w.biome),
        seed: w.seed,
        biome: w.biome,
        generationCount: w.generationCount,
        completedAt: w.completedAt ?? '',
        players: this.turnsOf(db, w.id).map((t) => this.usernameOf(db, t.playerId)),
        preset: w.preset,
        finalState: this.turnsOf(db, w.id).at(-1)?.snapshot ?? null,
      }));
  }

  async getReplay(worldId: string): Promise<Replay> {
    const db = this.load();
    const world = db.worlds.find((w) => w.id === worldId);
    if (!world || world.status !== 'complete') throw new Error('World not found');
    const turns = this.turnsOf(db, worldId);
    return {
      worldId: world.id,
      name: worldName(world.seed, world.biome),
      seed: world.seed,
      biome: world.biome,
      snapshots: turns.flatMap((t) => (t.snapshot ? [t.snapshot] : [])),
      actions: turns.flatMap((t) => t.actions),
      transitions: turns.flatMap((t) => t.transitions),
      journal: this.journalOf(db, worldId),
    };
  }

  async listAllWorlds(): Promise<AdminWorld[]> {
    const db = this.load();
    const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
    return db.worlds.map((w) => ({
      worldId: w.id,
      name: worldName(w.seed, w.biome),
      seed: w.seed,
      biome: w.biome,
      status: w.status,
      turn: w.currentTurn,
      generationCount: w.generationCount,
      turnSeconds: w.turnSeconds,
      lockedBy: w.lockedBy,
      lockExpiresAt: iso(w.lockExpiresAt),
      forcedFor: w.forcedFor,
    }));
  }

  async setSettings(patch: Partial<Settings>): Promise<void> {
    const db = this.load();
    db.settings = { ...this.settings(db), ...patch };
    this.save(db);
  }

  async setWorld(
    worldId: string,
    patch: { turnSeconds?: number; generationCount?: number },
  ): Promise<void> {
    const db = this.load();
    const world = this.openWorld(db, worldId);
    world.turnSeconds = patch.turnSeconds ?? world.turnSeconds;
    world.generationCount = patch.generationCount ?? world.generationCount;
    this.save(db);
  }

  async forceAssign(worldId: string, username: string): Promise<void> {
    const db = this.load();
    const world = this.openWorld(db, worldId);
    const user = db.users.find((u) => u.username === username.toLowerCase());
    if (!user) throw new Error(`No player ${username}`);
    world.forcedFor = user.id;
    this.save(db);
  }

  async createSeededWorld(seeded: SeededWorld): Promise<string> {
    const db = this.load();
    const settings = this.settings(db);
    const world = this.newWorld(seeded.seed, seeded.biome, settings);
    world.preset = seeded.preset ?? world.preset;
    world.turnSeconds = seeded.turnSeconds ?? world.turnSeconds;
    world.generationCount = seeded.generationCount ?? world.generationCount;
    db.worlds.push(world);
    this.save(db);
    return world.id;
  }

  async completeWorld(worldId: string): Promise<void> {
    const db = this.load();
    const world = this.openWorld(db, worldId);
    world.status = 'complete';
    world.completedAt = new Date(this.now()).toISOString();
    world.lockedBy = null;
    world.lockedAt = null;
    world.lockExpiresAt = null;
    world.forcedFor = null;
    this.save(db);
  }

  private newWorld(seed: number, biome: Biome, settings: Settings): LocalWorld {
    return {
      id: crypto.randomUUID(),
      seed,
      biome,
      preset: 'default',
      generationCount: settings.defaultGenerationCount,
      turnSeconds: settings.defaultTurnSeconds,
      currentTurn: 1,
      status: 'open',
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      forcedFor: null,
      completedAt: null,
    };
  }

  private openWorld(db: LocalDb, worldId: string): LocalWorld {
    const world = db.worlds.find((w) => w.id === worldId && w.status === 'open');
    if (!world) throw new Error(`No open world ${worldId}`);
    return world;
  }

  private usernameOf(db: LocalDb, id: string): string {
    return db.users.find((u) => u.id === id)?.username ?? 'unknown';
  }

  private turnsOf(db: LocalDb, worldId: string): LocalTurn[] {
    return db.turns.filter((t) => t.worldId === worldId).sort((a, b) => a.turn - b.turn);
  }

  private journalOf(db: LocalDb, worldId: string): JournalPage[] {
    return this.turnsOf(db, worldId).map((t) => ({
      turn: t.turn,
      authorUsername: this.usernameOf(db, t.playerId),
      text: t.journal.text,
      drawing: t.journal.drawing,
    }));
  }

  private toClaimed(db: LocalDb, world: LocalWorld): ClaimedWorld {
    const turns = this.turnsOf(db, world.id);
    return {
      worldId: world.id,
      name: worldName(world.seed, world.biome),
      seed: world.seed,
      biome: world.biome,
      preset: world.preset,
      turn: world.currentTurn,
      generationCount: world.generationCount,
      turnSeconds: world.turnSeconds,
      lockExpiresAt: new Date(world.lockExpiresAt ?? 0).toISOString(),
      snapshot: turns.at(-1)?.snapshot ?? null,
      journal: this.journalOf(db, world.id),
      gravestones: turns.map((t) => ({ turn: t.turn, username: this.usernameOf(db, t.playerId) })),
    };
  }
}
