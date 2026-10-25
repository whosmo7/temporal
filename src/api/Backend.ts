import type { ActionEntry, Biome, Transition, TurnSummary, WorldState } from '../engine/types';
import type { PresetName } from '../worldgen/presets';

export type { ActionEntry, Transition, TurnSummary, WorldState };

// Placeholder until the journal stroke format (05) exists.
export type Drawing = unknown;

export interface Profile {
  id: string;
  username: string;
  /** `profiles.is_admin`: may open `/admin` (08). */
  isAdmin?: boolean;
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
  /** From the seed, `worldName` (decision 020). */
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
  /** The world's score (decision 037), from its whole history; null if the backend didn't count it. */
  score: number | null;
}

export interface Replay {
  worldId: string;
  name: string;
  seed: number;
  biome: Biome;
  /** Worldgen preset, to rebuild the map. Absent means `default` (every claimed world so far). */
  preset?: PresetName;
  snapshots: WorldState[]; // one per committed turn, in order
  actions: ActionEntry[];
  transitions: Transition[];
  journal: JournalPage[];
}

/** The single `settings` row (07): defaults for new worlds and how often Play inherits. */
export interface Settings {
  defaultTurnSeconds: number;
  defaultGenerationCount: number;
  /** Chance that Play inherits an open, unlocked world instead of starting one (0..1). */
  inheritRatio: number;
}

/** A world as the admin panel lists it. Usernames, not ids. */
export interface AdminWorld {
  worldId: string;
  /** From the seed, `worldName` (decision 020). */
  name: string;
  seed: number;
  biome: Biome;
  status: 'open' | 'complete';
  /** The next generation to be played. */
  currentTurn: number;
  generationCount: number;
  turnSeconds: number;
  lockedBy: string | null;
  lockExpiresAt: string | null;
  forcedFor: string | null;
  players: string[];
  createdAt: string | null;
}

/** What an admin call did, as the admin log records it (decision 036). */
export type AdminActionKind =
  | 'forceAssign'
  | 'configureWorld'
  | 'clearLock'
  | 'markComplete'
  | 'removeWorld'
  | 'createWorld'
  | 'createDemoWorld'
  | 'setSettings';

/** One row of the append-only admin log (decision 036). Newest first when listed. */
export interface AdminAction {
  id: string;
  at: string;
  /** Username of the admin account that made the call. */
  admin: string;
  action: AdminActionKind;
  worldId: string | null;
  before: unknown;
  after: unknown;
}

/** A journal page from a simulated player (decision 040). Never a real player's page. */
export interface SimJournalPage {
  generation: number;
  author: string;
  text: string;
  simulated: true;
}

/** Asks for one generation of an LLM playthrough (decision 040). */
export interface SimulationRequest {
  seed: number;
  biome: Biome;
  gens: number;
  generation: number;
  /** Persona ids to start with; the rest follow (scripts/llm/personas.ts). */
  personas: string[];
  model?: string;
  /** Model calls this generation may use, journal included. */
  callBudget: number;
  /** The world as the previous generation left it; null for generation 1. */
  state: WorldState | null;
  journal: SimJournalPage[];
}

/** One simulated generation, computed on the server and never saved there. */
export interface SimulationStep {
  simulated: true;
  model: string;
  promptVersion: string;
  persona: { id: string; motive: string };
  result: {
    generation: number;
    persona: string;
    player: string;
    calls: number;
    actions: number;
    rejections: number;
    /** Why the day ended: finished, time, calls, actions, invalid, budget, quota or deadline. */
    end: string;
    summary: TurnSummary;
    journal?: string;
    usage: { promptTokens?: number; outputTokens?: number; totalTokens?: number };
  };
  /** The world after this generation's night: send it with the next request. */
  state: WorldState;
  log: ActionEntry[];
  journalPage: SimJournalPage | null;
  /** Set when a quota error stopped it. */
  stopped: string | null;
  /** Every decision, as the command-line trace records it. */
  trace: Record<string, unknown>[];
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
  /**
   * Gives back a world you hold without playing it (backing out to Home, decision 035). The day
   * is voided, nothing is written, and the next Play is a fresh draw. A no-op if you don't hold it.
   */
  releaseWorld(worldId: string): Promise<void>;
  commitTurn(input: CommitInput): Promise<TurnSummary>;

  listCompletedWorlds(): Promise<CompletedWorld[]>;
  getReplay(worldId: string): Promise<Replay>;

  // Admin (08, decision 036). Each throws unless the signed-in user is an admin, and each change
  // writes one row to the admin log.
  /** Worlds still in progress and not removed. Finished worlds are in the gallery. */
  listWorlds(): Promise<AdminWorld[]>;
  getSettings(): Promise<Settings>;
  setSettings(settings: Partial<Settings>): Promise<void>;
  /** A world's turn length and generation count. The count can't go below the generation being played or next. */
  configureWorld(worldId: string, config: { turnSeconds?: number; generationCount?: number }): Promise<void>;
  /** That user's next Play gets this world. */
  forceAssign(worldId: string, username: string): Promise<void>;
  /**
   * Ends an open world where it stands so its replay can be watched ("skip to replay"): its
   * generation count becomes the generations played, and any lock is cleared.
   */
  markComplete(worldId: string): Promise<void>;
  clearLock(worldId: string): Promise<void>;
  /** A world from a chosen seed (the demo world, 10). Returns its id. */
  createSeededWorld(world: SeededWorld): Promise<string>;
  /**
   * Takes a world out of the game: never claimed, listed or replayed again. Its history stays in
   * the database (rule 2). Refused while someone holds its lock.
   */
  removeWorld(worldId: string): Promise<void>;
  /** Makes the demo world, plays its founder generations and force-assigns the judge (10). Returns its id. */
  createDemoWorld(): Promise<string>;
  /** The latest admin log rows, newest first. */
  listAdminActions(limit?: number): Promise<AdminAction[]>;
  /** Plays one generation with Gemini players on the server (decision 040). Nothing is saved. */
  simulateGeneration(request: SimulationRequest): Promise<SimulationStep>;
}
