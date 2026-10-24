import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { backend, type AdminWorld, type Settings } from '../../api';
import { Button, ButtonLink, Dialog, Panel, TextInput } from '../kit';

const BIOME_NAME: Record<AdminWorld['biome'], string> = { forest: 'Forest', island: 'Island' };

/** Short enough to tell worlds apart in a list. */
const shortId = (id: string) => id.slice(0, 8);
const played = (w: AdminWorld) => w.currentTurn - 1;
const isLocked = (w: AdminWorld) => !!w.lockedBy && !!w.lockExpiresAt && Date.parse(w.lockExpiresAt) > Date.now();
const worldLabel = (w: AdminWorld) =>
  `${shortId(w.worldId)} · ${BIOME_NAME[w.biome]} · ${played(w)} of ${w.generationCount} played${w.players.length ? ` · ${w.players.join(', ')}` : ''}${isLocked(w) ? ` · in play (${w.lockedBy})` : ''}`;

/**
 * `/admin` (08), behind `RequireAdmin`. Force-assign comes first, so handing the demo world to a
 * judge takes one pick, one name and Enter. Then every world with its lock and settings, with
 * clear lock and skip to replay, then the defaults for new worlds.
 */
export function AdminScreen() {
  const [worlds, setWorlds] = useState<AdminWorld[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [w, s] = await Promise.all([backend.listWorlds(), backend.getSettings()]);
      setWorlds([...w].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')));
      setSettings(s);
      setError(null);
    } catch (e) {
      setError(message(e));
    }
  }, []);
  useEffect(() => void refresh(), [refresh]);

  /** Runs an admin call, then reloads the lists; returns the error text, if any. */
  const run = useCallback(
    async (call: () => Promise<void>): Promise<string | null> => {
      try {
        await call();
        await refresh();
        return null;
      } catch (e) {
        return message(e);
      }
    },
    [refresh],
  );

  if (error && !worlds) {
    return (
      <Panel title="Admin" className="admin">
        <p>{error}</p>
      </Panel>
    );
  }
  if (!worlds || !settings) return null;

  // Unlocked first: a locked world only reaches the assigned player once its lock clears.
  const open = worlds.filter((w) => w.status === 'open').sort((a, b) => +isLocked(a) - +isLocked(b));
  return (
    <section className="admin" aria-labelledby="admin-title">
      <h1 id="admin-title" className="gallery__title">
        Admin
      </h1>
      <ForceAssign worlds={open} run={run} />
      <WorldList worlds={worlds} run={run} />
      <Defaults settings={settings} run={run} />
    </section>
  );
}

type Run = (call: () => Promise<void>) => Promise<string | null>;

function ForceAssign({ worlds, run }: { worlds: AdminWorld[]; run: Run }) {
  const [worldId, setWorldId] = useState('');
  const [username, setUsername] = useState('');
  const [note, setNote] = useState<{ error: boolean; text: string } | null>(null);
  const chosen = worlds.find((w) => w.worldId === worldId) ?? worlds[0];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosen || !username.trim()) return;
    const name = username.trim().toLowerCase();
    const err = await run(() => backend.forceAssign(chosen.worldId, name));
    setNote(err ? { error: true, text: err } : { error: false, text: `${name}'s next Play gets ${shortId(chosen.worldId)}.` });
    if (!err) setUsername('');
  };

  return (
    <Panel title="Force-assign" className="admin__panel">
      {worlds.length === 0 ? (
        <p>No open worlds.</p>
      ) : (
        <form className="admin__assign" onSubmit={(e) => void submit(e)}>
          <div className="kit-field">
            <label className="kit-field__label" htmlFor="assign-world">
              World
            </label>
            <select id="assign-world" className="kit-field__input" value={chosen?.worldId ?? ''} onChange={(e) => setWorldId(e.target.value)}>
              {worlds.map((w) => (
                <option key={w.worldId} value={w.worldId}>
                  {worldLabel(w)}
                </option>
              ))}
            </select>
          </div>
          <TextInput label="Player" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" spellCheck={false} autoFocus />
          <Button type="submit" variant="primary" disabled={!username.trim()}>
            Assign
          </Button>
        </form>
      )}
      {note && (
        <p className={note.error ? 'auth__error' : 'admin__note'} role={note.error ? 'alert' : 'status'}>
          {note.text}
        </p>
      )}
    </Panel>
  );
}

function WorldList({ worlds, run }: { worlds: AdminWorld[]; run: Run }) {
  const navigate = useNavigate();
  const [ending, setEnding] = useState<AdminWorld | null>(null);
  const [rowError, setRowError] = useState<{ worldId: string; text: string } | null>(null);

  const act = async (w: AdminWorld, call: () => Promise<void>) => {
    const err = await run(call);
    setRowError(err ? { worldId: w.worldId, text: err } : null);
    return !err;
  };

  return (
    <Panel title="Worlds" className="admin__panel">
      {worlds.length === 0 ? (
        <p>No worlds yet. One starts the first time someone presses Play.</p>
      ) : (
        <table className="admin__table">
          <thead>
            <tr>
              <th scope="col">World</th>
              <th scope="col">Played</th>
              <th scope="col">Generations</th>
              <th scope="col">Turn (s)</th>
              <th scope="col">Lock</th>
              <th scope="col">Next Play</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {worlds.map((w) => (
              <WorldRow
                key={w.worldId}
                world={w}
                error={rowError?.worldId === w.worldId ? rowError.text : null}
                onSave={(config) => act(w, () => backend.configureWorld(w.worldId, config))}
                onClearLock={() => void act(w, () => backend.clearLock(w.worldId))}
                onSkip={() => setEnding(w)}
              />
            ))}
          </tbody>
        </table>
      )}
      <Dialog
        open={!!ending}
        title="End this world here?"
        onClose={() => setEnding(null)}
        actions={
          <>
            <Button variant="quiet" onClick={() => setEnding(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const w = ending!;
                setEnding(null);
                void act(w, () => backend.markComplete(w.worldId)).then((ok) => ok && navigate(`/world/${w.worldId}/replay`));
              }}
            >
              End and watch
            </Button>
          </>
        }
      >
        {ending && (
          <p>
            {shortId(ending.worldId)} ends after {played(ending)} {played(ending) === 1 ? 'generation' : 'generations'}. Nobody can play it again, and
            it joins the gallery.
          </p>
        )}
      </Dialog>
    </Panel>
  );
}

function WorldRow({
  world: w,
  error,
  onSave,
  onClearLock,
  onSkip,
}: {
  world: AdminWorld;
  error: string | null;
  onSave: (config: { turnSeconds: number; generationCount: number }) => Promise<boolean>;
  onClearLock: () => void;
  onSkip: () => void;
}) {
  const [turnSeconds, setTurnSeconds] = useState(String(w.turnSeconds));
  const [generations, setGenerations] = useState(String(w.generationCount));
  useEffect(() => {
    setTurnSeconds(String(w.turnSeconds));
    setGenerations(String(w.generationCount));
  }, [w.turnSeconds, w.generationCount]);

  const isOpen = w.status === 'open';
  const changed = turnSeconds !== String(w.turnSeconds) || generations !== String(w.generationCount);
  const locked = isLocked(w);

  return (
    <>
      <tr>
        <th scope="row">
          <span className="admin__id">{shortId(w.worldId)}</span> {BIOME_NAME[w.biome]}
          {w.players.length > 0 && <span className="admin__players">{w.players.join(', ')}</span>}
        </th>
        <td>{played(w)}</td>
        <td>
          {isOpen ? (
            <input
              className="kit-field__input admin__num"
              type="number"
              min={w.currentTurn}
              value={generations}
              onChange={(e) => setGenerations(e.target.value)}
              aria-label={`Generations for ${shortId(w.worldId)}`}
            />
          ) : (
            w.generationCount
          )}
        </td>
        <td>
          {isOpen ? (
            <input
              className="kit-field__input admin__num"
              type="number"
              min={1}
              value={turnSeconds}
              onChange={(e) => setTurnSeconds(e.target.value)}
              aria-label={`Turn length in seconds for ${shortId(w.worldId)}`}
            />
          ) : (
            w.turnSeconds
          )}
        </td>
        <td>{locked ? `${w.lockedBy} until ${new Date(w.lockExpiresAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}</td>
        <td>{w.forcedFor ?? '—'}</td>
        <td className="admin__actions">
          {isOpen && changed && (
            <Button size="sm" variant="primary" onClick={() => void onSave({ turnSeconds: Number(turnSeconds), generationCount: Number(generations) })}>
              Save
            </Button>
          )}
          {isOpen && locked && (
            <Button size="sm" onClick={onClearLock}>
              Clear lock
            </Button>
          )}
          {isOpen && played(w) > 0 && (
            <Button size="sm" onClick={onSkip}>
              Skip to replay
            </Button>
          )}
          {!isOpen && (
            <ButtonLink size="sm" to={`/world/${w.worldId}/replay`}>
              Replay
            </ButtonLink>
          )}
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={7} className="auth__error" role="alert">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}

function Defaults({ settings, run }: { settings: Settings; run: Run }) {
  const [turnSeconds, setTurnSeconds] = useState(String(settings.defaultTurnSeconds));
  const [generations, setGenerations] = useState(String(settings.defaultGenerationCount));
  const [ratio, setRatio] = useState(String(settings.inheritRatio));
  const [note, setNote] = useState<{ error: boolean; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = await run(() =>
      backend.setSettings({ defaultTurnSeconds: Number(turnSeconds), defaultGenerationCount: Number(generations), inheritRatio: Number(ratio) }),
    );
    setNote(err ? { error: true, text: err } : { error: false, text: 'Saved. New worlds use these.' });
  };

  return (
    <Panel title="New worlds" className="admin__panel">
      <form className="admin__defaults" onSubmit={(e) => void submit(e)}>
        <TextInput label="Turn (s)" type="number" min={1} value={turnSeconds} onChange={(e) => setTurnSeconds(e.target.value)} />
        <TextInput label="Generations" type="number" min={1} value={generations} onChange={(e) => setGenerations(e.target.value)} />
        <TextInput
          label="Inherit ratio"
          hint="Chance Play picks an open world over a new one"
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={ratio}
          onChange={(e) => setRatio(e.target.value)}
        />
        <Button type="submit">Save</Button>
      </form>
      {note && (
        <p className={note.error ? 'auth__error' : 'admin__note'} role={note.error ? 'alert' : 'status'}>
          {note.text}
        </p>
      )}
    </Panel>
  );
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}
