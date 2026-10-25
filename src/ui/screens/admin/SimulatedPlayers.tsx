import { useRef, useState, type FormEvent } from 'react';
import { backend, type SimJournalPage, type SimulationStep, type WorldState } from '../../../api';
import type { Biome } from '../../../engine';
import { Button, Panel, TextInput } from '../../kit';
import { SIM_PERSONAS } from './simPersonas';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

interface RunInfo {
  seed: number;
  biome: Biome;
  gens: number;
  first: string;
  model: string;
  budget: number;
  startedAt: string;
}

/**
 * The admin panel's "Simulated players" (decision 040): Gemini plays one generation after another
 * in a fresh world, on the server, one request per generation. Nothing is saved; the trace can be
 * downloaded at the end.
 */
export function SimulatedPlayers() {
  const [gens, setGens] = useState('2');
  const [biome, setBiome] = useState<Biome>('forest');
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 100000)));
  const [first, setFirst] = useState<string>(SIM_PERSONAS[0]);
  const [budget, setBudget] = useState('60');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [steps, setSteps] = useState<SimulationStep[]>([]);
  const [run, setRun] = useState<RunInfo | null>(null);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  const start = async (e: FormEvent) => {
    e.preventDefault();
    const info: RunInfo = {
      seed: Math.floor(Number(seed)),
      biome,
      gens: Math.max(1, Math.min(12, Math.floor(Number(gens)))),
      first,
      model: model.trim() || DEFAULT_MODEL,
      budget: Math.max(1, Math.floor(Number(budget))),
      startedAt: new Date().toISOString(),
    };
    if (!Number.isFinite(info.seed)) return setStatus({ error: true, text: 'The seed must be a number.' });
    setRun(info);
    setSteps([]);
    setRunning(true);
    stop.current = false;

    const done: SimulationStep[] = [];
    let state: WorldState | null = null;
    const journal: SimJournalPage[] = [];
    let spent = 0;
    let note = '';
    try {
      for (let generation = 1; generation <= info.gens; generation++) {
        if (stop.current) {
          note = `Stopped after generation ${generation - 1}.`;
          break;
        }
        if (spent >= info.budget) {
          note = `The call budget ran out before generation ${generation}.`;
          break;
        }
        setStatus({ error: false, text: `Generation ${generation} of ${info.gens} is playing… (about a minute each)` });
        const step = await backend.simulateGeneration({
          seed: info.seed,
          biome: info.biome,
          gens: info.gens,
          generation,
          personas: [info.first],
          model: info.model,
          callBudget: info.budget - spent,
          state,
          journal,
        });
        done.push(step);
        setSteps([...done]);
        spent += step.result.calls;
        state = step.state;
        if (step.journalPage) journal.push(step.journalPage);
        if (step.stopped) {
          note = `Stopped: ${step.stopped}`;
          break;
        }
      }
      setStatus({ error: false, text: note || `Done: ${done.length} generations, ${spent} model calls.` });
    } catch (err) {
      setStatus({ error: true, text: `${err instanceof Error ? err.message : 'Something went wrong'}${done.length ? ` (the ${done.length} finished generations are kept below)` : ''}` });
    } finally {
      setRunning(false);
    }
  };

  const download = () => {
    if (!run) return;
    const lines = [
      { type: 'run', simulated: true, note: 'Simulated players driven by an LLM. Not a real game.', source: 'admin panel', ...run, promptVersion: steps[0]?.promptVersion, personas: steps.map((s) => ({ generation: s.result.generation, ...s.persona })) },
      ...steps.flatMap((s) => s.trace),
      { type: 'final', simulated: true, log: steps.flatMap((s) => s.log), finalState: steps.at(-1)?.state ?? null },
    ];
    const blob = new Blob([lines.map((l) => JSON.stringify(l)).join('\n') + '\n'], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm-${run.seed}-${run.biome}-${run.startedAt.replace(/[:.]/g, '-')}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tokens = steps.reduce((n, s) => n + (s.result.usage.totalTokens ?? 0), 0);
  const calls = steps.reduce((n, s) => n + s.result.calls, 0);

  return (
    <Panel title="Simulated players" className="admin__panel">
      <p>
        Gemini plays a fresh world, one generation after another, seeing only what a player would. Nothing is saved: the results stay on this page
        until you download them.
      </p>
      <form className="admin__sim" onSubmit={(e) => void start(e)}>
        <TextInput label="Generations" type="number" min={1} max={12} value={gens} onChange={(e) => setGens(e.target.value)} disabled={running} />
        <div className="kit-field">
          <label className="kit-field__label" htmlFor="sim-biome">
            Biome
          </label>
          <select id="sim-biome" className="kit-field__input" value={biome} onChange={(e) => setBiome(e.target.value as Biome)} disabled={running}>
            <option value="forest">Forest</option>
            <option value="island">Island</option>
          </select>
        </div>
        <TextInput label="Seed" type="number" value={seed} onChange={(e) => setSeed(e.target.value)} disabled={running} />
        <div className="kit-field">
          <label className="kit-field__label" htmlFor="sim-persona">
            First player
          </label>
          <select id="sim-persona" className="kit-field__input" value={first} onChange={(e) => setFirst(e.target.value)} disabled={running}>
            {SIM_PERSONAS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <TextInput label="Call budget" hint="About 30–40 calls a generation" type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} disabled={running} />
        <TextInput label="Model" value={model} onChange={(e) => setModel(e.target.value)} disabled={running} spellCheck={false} autoComplete="off" />
        <div className="admin__sim-actions">
          {running ? (
            <Button type="button" onClick={() => (stop.current = true)}>
              Stop after this generation
            </Button>
          ) : (
            <Button type="submit" variant="primary">
              Run simulation
            </Button>
          )}
          {!running && steps.length > 0 && (
            <Button type="button" onClick={download}>
              Download trace
            </Button>
          )}
        </div>
      </form>
      {status && (
        <p className={status.error ? 'auth__error' : 'admin__note'} role={status.error ? 'alert' : 'status'}>
          {status.text}
        </p>
      )}
      {steps.length > 0 && (
        <>
          <div className="admin__scroll">
            <table className="admin__table">
              <thead>
                <tr>
                  {['Gen', 'Player', 'Food', 'Water', 'Night', 'Wild', 'Reservoir', 'Well', 'Trees', 'Calls', 'Actions', 'Refused', 'Day ended', 'Score'].map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {steps.map((s) => (
                  <SimRow key={s.result.generation} step={s} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="admin__note">
            {calls} model calls · {tokens || 'unknown'} tokens · simulated, not a real game
          </p>
          {steps.some((s) => s.journalPage) && (
            <ul className="admin__log">
              {steps
                .filter((s) => s.journalPage)
                .map((s) => (
                  <li key={s.result.generation}>
                    <b>{s.result.player}</b> ({s.persona.id}, simulated): “{s.journalPage!.text}”
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}

function SimRow({ step }: { step: SimulationStep }) {
  const { result, state } = step;
  const plots = Object.values(state.plots);
  const orchard = plots.filter((p) => p.kind === 'orchard');
  const trees = orchard.filter((p) => ['sapling', 'young', 'fruiting'].includes(p.stage ?? '')).length;
  const night = result.summary.upkeep;
  return (
    <tr>
      <td>{result.generation}</td>
      <td>{result.persona}</td>
      <td>{state.resources.food}</td>
      <td>{state.resources.water}</td>
      <td>{night.met ? 'fed' : `short ${night.food.required - night.food.paid}`}</td>
      <td>{state.wildStock}</td>
      <td>{state.plots['reservoir']?.stage ?? '—'}</td>
      <td>{state.plots['well']?.stage ?? '—'}</td>
      <td>
        {trees}/{orchard.length}
      </td>
      <td>{result.calls}</td>
      <td>{result.actions}</td>
      <td>{result.rejections}</td>
      <td>{result.end}</td>
      <td>{state.scores?.at(-1)?.total ?? '—'}</td>
    </tr>
  );
}
