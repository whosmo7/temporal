import { createClient, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AdminWorld,
  Backend,
  ClaimedWorld,
  CommitInput,
  CompletedWorld,
  Profile,
  Replay,
  SeededWorld,
  Settings,
  TurnSummary,
} from './Backend';
import { getLastWorld, setLastWorld } from './lastWorld';
import {
  toAdminWorld,
  toClaimedWorld,
  toCompletedWorld,
  toReplay,
  toSettings,
  type AdminWorldRow,
  type ClaimRow,
  type CompletedRow,
  type ReplayRow,
  type SettingsRow,
} from './mappers';

// The real backend (07). Writes go through RPCs and the commit-turn Edge Function only; RLS refuses
// direct inserts, so "past pages can't be changed" holds whatever the client does.

const EMAIL_DOMAIN = 'players.temporal.local';

const emailFor = (username: string) => `${username.toLowerCase()}@${EMAIL_DOMAIN}`;

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export class SupabaseBackend implements Backend {
  private readonly db: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.db = createClient(url, anonKey);
  }

  private async profile(id: string): Promise<Profile> {
    const { data, error } = await this.db
      .from('profiles')
      .select('id, username, is_admin')
      .eq('id', id)
      .single();
    fail(error);
    return { id: data!.id, username: data!.username, isAdmin: data!.is_admin };
  }

  private async userId(): Promise<string> {
    const { data } = await this.db.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('Not signed in');
    return id;
  }

  async signUp(username: string, password: string): Promise<Profile> {
    const name = username.toLowerCase();
    const { data: free, error: checkError } = await this.db.rpc('username_available', { name });
    fail(checkError);
    if (!free) throw new Error('Username taken');
    const { data, error } = await this.db.auth.signUp({
      email: emailFor(name),
      password,
      options: { data: { username: name } },
    });
    fail(error);
    return this.profile(data.user!.id);
  }

  async signIn(username: string, password: string): Promise<Profile> {
    const { data, error } = await this.db.auth.signInWithPassword({
      email: emailFor(username),
      password,
    });
    if (error) throw new Error('Wrong username or password');
    return this.profile(data.user.id);
  }

  async signOut(): Promise<void> {
    fail((await this.db.auth.signOut()).error);
  }

  async currentUser(): Promise<Profile | null> {
    const { data } = await this.db.auth.getSession();
    const id = data.session?.user.id;
    return id ? this.profile(id) : null;
  }

  async claimWorld(): Promise<ClaimedWorld> {
    const me = await this.userId();
    const { data, error } = await this.db.rpc('claim_world', { avoid: getLastWorld(me) });
    fail(error);
    return toClaimedWorld(data as ClaimRow);
  }

  async heartbeat(worldId: string): Promise<string | null> {
    const { data, error } = await this.db.rpc('heartbeat', { world: worldId });
    fail(error);
    return (data as string | null) ?? null;
  }

  async releaseWorld(worldId: string): Promise<void> {
    const { error } = await this.db.rpc('release_world', { world: worldId });
    fail(error);
  }

  async commitTurn(input: CommitInput): Promise<TurnSummary> {
    const me = await this.userId();
    const { data, error } = await this.db.functions.invoke('commit-turn', { body: input });
    if (error) {
      // The function answers { error } with a 4xx; surface its message, not "non-2xx status".
      if (error instanceof FunctionsHttpError) {
        const body = (await error.context.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? error.message);
      }
      throw error;
    }
    setLastWorld(me, input.worldId);
    return (data as { summary: TurnSummary }).summary;
  }

  async listCompletedWorlds(): Promise<CompletedWorld[]> {
    const { data, error } = await this.db.rpc('list_completed_worlds');
    fail(error);
    return (data as CompletedRow[]).map(toCompletedWorld);
  }

  async getReplay(worldId: string): Promise<Replay> {
    const { data, error } = await this.db.rpc('get_replay', { world: worldId });
    fail(error);
    if (!data) throw new Error('World not found');
    return toReplay(data as ReplayRow);
  }

  async listWorlds(): Promise<AdminWorld[]> {
    const { data, error } = await this.db.rpc('admin_list_worlds');
    fail(error);
    return (data as AdminWorldRow[]).map(toAdminWorld);
  }

  async getSettings(): Promise<Settings> {
    const { data, error } = await this.db
      .from('settings')
      .select('inherit_ratio, default_turn_seconds, default_generation_count')
      .single();
    fail(error);
    return toSettings(data as SettingsRow);
  }

  async setSettings(patch: Partial<Settings>): Promise<void> {
    const { error } = await this.db.rpc('admin_set_settings', {
      inherit_ratio: patch.inheritRatio ?? null,
      default_turn_seconds: patch.defaultTurnSeconds ?? null,
      default_generation_count: patch.defaultGenerationCount ?? null,
    });
    fail(error);
  }

  async configureWorld(
    worldId: string,
    config: { turnSeconds?: number; generationCount?: number },
  ): Promise<void> {
    const { error } = await this.db.rpc('admin_set_world', {
      world: worldId,
      turn_seconds: config.turnSeconds ?? null,
      generation_count: config.generationCount ?? null,
    });
    fail(error);
  }

  async forceAssign(worldId: string, username: string): Promise<void> {
    fail((await this.db.rpc('admin_force_assign', { world: worldId, username })).error);
  }

  async createSeededWorld(world: SeededWorld): Promise<string> {
    const { data, error } = await this.db.rpc('admin_create_world', {
      seed: world.seed,
      biome: world.biome,
      preset: world.preset ?? 'default',
      turn_seconds: world.turnSeconds ?? null,
      generation_count: world.generationCount ?? null,
    });
    fail(error);
    return data as string;
  }

  async markComplete(worldId: string): Promise<void> {
    fail((await this.db.rpc('admin_complete_world', { world: worldId })).error);
  }

  async clearLock(worldId: string): Promise<void> {
    fail((await this.db.rpc('admin_clear_lock', { world: worldId })).error);
  }
}
