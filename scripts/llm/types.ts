// Types for the LLM playthrough simulator (scripts/simulate-llm.ts). A DecisionMaker only ever picks
// one of the candidate ids it is shown; the engine decides what happens.

import type { ActionInput, Biome, StoreStage, TurnSummary, WorldState } from '../../src/engine';

/** A simulated player's motives, in ordinary words. One per generation. */
export interface Persona {
  id: string;
  /** Two or three sentences, second person. Never names an action as right or wrong. */
  motive: string;
}

/** A journal page from an earlier generation. Always simulated data in this tool. */
export interface SimJournalPage {
  generation: number;
  author: string;
  text: string;
  simulated: true;
}

/**
 * What a player standing in the world could know right now: visibleView, the HUD and their own
 * day so far. No seed, events, pending effects, due dates, causes or later generations.
 */
export interface Observation {
  generation: number;
  generations: number;
  biome: Biome;
  you: string;
  timeLeftSeconds: number;
  stores: {
    food: number;
    water: number;
    can: number;
    canCapacity: number;
    hunger: number;
    hungerMax: number;
    looks: StoreStage;
  };
  /** Food the night takes, as the HUD shows it (decision 002). */
  nightNeedsFood: number;
  /** "You wake up tired": the last night was short. */
  wokeTired: boolean;
  hungry: boolean;
  /** Plot stages counted, e.g. fields → { 'Field 1': { empty: 6, ripe: 2 } }. */
  land: {
    fields: Record<string, Record<string, number>>;
    orchard: Record<string, number>;
    reservoir?: string;
    well?: string;
    wild?: string;
  };
  /** This player's own accepted actions today, counted. */
  doneToday: string[];
  /** Names on the gravestones. */
  graveyard: string[];
  journal: SimJournalPage[];
}

export type CandidateKind = 'action' | 'wait' | 'finish';

export interface Candidate {
  /** Short id the model answers with: A1, A2, …, W1, F1. */
  id: string;
  /** Stable across one decision and the next, so a repeat finds "the same choice" again. */
  key: string;
  label: string;
  seconds: number;
  kind: CandidateKind;
  /** What applyAction gets. Never shown to the model. */
  input?: Pick<ActionInput, 'type' | 'plotId' | 'targetEffectId'>;
}

/** What the model is shown: id, words and how long it takes. */
export type ShownCandidate = Pick<Candidate, 'id' | 'label' | 'seconds'>;

export interface ChoiceRequest {
  persona: Persona;
  observation: Observation;
  candidates: ShownCandidate[];
  /** Why the last answer didn't happen, in the engine's or the simulator's words. */
  lastRejection?: string;
}

export interface Usage {
  promptTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ChoiceResponse {
  /** Whatever the model answered. Validated against the candidates before anything happens. */
  choice: string;
  /** Do the same thing this many times in a row (1–maxRepeat), each re-checked. */
  repeat?: number;
  /** The player's private reason. Kept in the trace, never passed to later generations. */
  note?: string;
  usage?: Usage;
}

export interface JournalRequest {
  persona: Persona;
  you: string;
  generation: number;
  generations: number;
  doneToday: string[];
  /** The realised cost summary in words. */
  summary: string[];
  journal: SimJournalPage[];
}

export interface DecisionMaker {
  readonly model: string;
  choose(request: ChoiceRequest): Promise<ChoiceResponse>;
  journal?(request: JournalRequest): Promise<{ entry: string; usage?: Usage }>;
}

/** Thrown by a DecisionMaker when the provider's quota or rate limit is hit. Stops the run. */
export class QuotaError extends Error {}

export interface TurnLimits {
  /** Model calls per generation, journal included. */
  calls: number;
  /** Accepted actions per generation. */
  actions: number;
  /** Answers in a row that didn't happen before the turn ends. */
  invalidInARow: number;
  /** Waits per generation. */
  waits: number;
  /** In-turn seconds one wait moves the clock. */
  waitSeconds: number;
  /** Most times one answer may repeat. */
  maxRepeat: number;
}

export type TurnEnd = 'finished' | 'time' | 'calls' | 'actions' | 'invalid' | 'budget' | 'quota' | 'deadline';

export interface Decision {
  generation: number;
  t: number;
  observation: Observation;
  candidates: ShownCandidate[];
  response?: ChoiceResponse;
  accepted: { id: string; type: string; plotId?: string; at: number }[];
  rejection?: string;
}

export interface GenerationResult {
  generation: number;
  persona: string;
  player: string;
  calls: number;
  actions: number;
  rejections: number;
  end: TurnEnd;
  summary: TurnSummary;
  journal?: string;
  usage: Usage;
  state: WorldState;
}
