import type { ActionEntry, Biome, Transition, WorldState } from '../engine/types';
import type { PresetName } from '../worldgen/presets';

export type { ActionEntry, Transition, WorldState };

// Placeholders until endTurn's summary (02) and the journal stroke format (05) exist.
export type TurnSummary = unknown;
export type Drawing = unknown;

export interface Profile {
  id: string;
  username: string;
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
  seed: number;
  biome: Biome;
  generationCount: number;
  completedAt: string;
  players: string[];
}

export interface Replay {
  worldId: string;
  seed: number;
  biome: Biome;
  snapshots: WorldState[]; // one per committed turn, in order
  actions: ActionEntry[];
  transitions: Transition[];
  journal: JournalPage[];
}

export interface Backend {
  signUp(username: string, password: string): Promise<Profile>;
  signIn(username: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  currentUser(): Promise<Profile | null>;

  claimWorld(): Promise<ClaimedWorld>;
  commitTurn(input: CommitInput): Promise<TurnSummary>;

  listCompletedWorlds(): Promise<CompletedWorld[]>;
  getReplay(worldId: string): Promise<Replay>;

  // Admin
  forceAssign(worldId: string, username: string): Promise<void>;
}
