import type { Biome } from '../worldgen/types';

export type WorldState = unknown;
export type Action = unknown;
export type Transition = unknown;
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
  turn: number;
  generationCount: number;
  lockExpiresAt: string;
  snapshot: WorldState | null; // null on generation 1
  journal: JournalPage[];
  gravestones: Gravestone[];
}

export interface CommitInput {
  worldId: string;
  actions: Action[];
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
  snapshots: WorldState[]; // index = turn
  actions: Action[];
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
