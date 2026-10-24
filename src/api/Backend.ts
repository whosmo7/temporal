import type { ActionEntry, Biome, Transition, TurnSummary, WorldState } from '../engine/types';
import type { PresetName } from '../worldgen/presets';

export type { ActionEntry, Transition, TurnSummary, WorldState };

// Placeholder until the journal stroke format (05) exists.
export type Drawing = unknown;

export interface Profile {
  id: string;
  username: string;
  /** Shows the admin screen. Always true on LocalBackend (hot-seat is a dev/demo tool). */
  isAdmin: boolean;
}

export interface JournalPage {
  turn: number;
  authorUsername: string;
  text: string;
  drawing: Drawing;
}

export interface Gravestone {
  turn: number;
  username: string;
}

export interface ClaimedWorld {
  worldId: string;
  /** From the seed, `worldName` (decision 019). */
  name: string;
  seed: number;
  biome: Biome;
  preset: PresetName;
  turn: number;
  generationCount: number;
  turnSeconds: number;
  lockExpiresAt: string;
  snapshot: WorldState | null; // null on generation 1
  journal: JournalPage[];
  gravestones: Gravestone[];
}

export interface CommitInput {
  worldId: string;
  actions: ActionEntry[];
  journal: { text: string; drawing: Drawing };
}

export interface CompletedWorld {
  worldId: string;
  name: string;
  seed: number;
  biome: Biome;
  generationCount: number;
  completedAt: string;
  players: string[];
  /** For the gallery thumbnail (06): the map preset, and the state after the last generation. */
  preset?: PresetName;
  finalState?: WorldState | null;
}

export interface Replay {
  worldId: string;
  name: string;
  seed: number;
  biome: Biome;
  snapshots: WorldState[]; // one per committed turn, in order
  actions: ActionEntry[];
  transitions: Transition[];
  journal: JournalPage[];
}

export interface Settings {
  /** P(inherit) when an open world exists. */
  inheritRatio: number;
  defaultTurnSeconds: number;
  defaultGenerationCount: number;
  journalAllowanceSeconds: number;
  lockGraceSeconds: number;
  /** How far heartbeats may stretch a lock past its first deadline. */
  heartbeatCapSeconds: number;
}

/** A world as the admin screen sees it, any status. */
export interface AdminWorld {
  worldId: string;
  name: string;
  seed: number;
  biome: Biome;
  status: 'open' | 'complete';
  turn: number;
  generationCount: number;
  turnSeconds: number;
  lockedBy: string | null;
  lockExpiresAt: string | null;
  forcedFor: string | null;
}

export interface SeededWorld {
  seed: number;
  biome: Biome;
  preset?: PresetName;
  /** Defaults to settings. */
  turnSeconds?: number;
  generationCount?: number;
}

export interface Backend {
  signUp(username: string, password: string): Promise<Profile>;
  signIn(username: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  currentUser(): Promise<Profile | null>;

  /** Random weighted assignment; resumes a world the player already holds. */
  claimWorld(): Promise<ClaimedWorld>;
  /**
   * Call about once a minute while the clock is stopped (journal open, end-of-turn flow).
   * Returns the new lock expiry, or null if the turn was voided and the world is gone.
   */
  heartbeat(worldId: string): Promise<string | null>;
  commitTurn(input: CommitInput): Promise<TurnSummary>;

  listCompletedWorlds(): Promise<CompletedWorld[]>;
  getReplay(worldId: string): Promise<Replay>;

  // Admin (10: force-assign, configure, skip to replay). Non-admins get an error.
  listAllWorlds(): Promise<AdminWorld[]>;
  setSettings(patch: Partial<Settings>): Promise<void>;
  setWorld(worldId: string, patch: { turnSeconds?: number; generationCount?: number }): Promise<void>;
  forceAssign(worldId: string, username: string): Promise<void>;
  /** A world from a chosen seed (the demo world, 10). Returns its id. */
  createSeededWorld(world: SeededWorld): Promise<string>;
  /** Skip to replay: ends the world after its committed turns. */
  completeWorld(worldId: string): Promise<void>;
}
