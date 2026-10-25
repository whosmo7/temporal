import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { backend, type Replay } from '../../api';
import { applyAction, beginTurn, CONFIG, createWorld, endTurn, type ActionEntry, type ActionInput, type PlotId, type Transition, type WorldState } from '../../engine';
import { changedPlots, playerOf, plotHistory, ReplayWorld } from '../replay';

type Act = Pick<ActionInput, 'type' | 'plotId' | 'targetEffectId' | 'eat'> & { t: number };

const RIPE = CONFIG.cropRipenPct * CONFIG.turnSeconds;
/** Three generations on seed 123: AL farms and starts the reservoir, MO tends and hurries, KE picks. */
const FIRST: Act[] = [
  { type: 'fillCan', t: 1 },
  ...['field-1:0,0', 'field-1:1,0', 'field-1:2,0'].flatMap((plotId, i): Act[] => [
    { type: 'plantCrops', plotId, t: 2 + i * 3 },
    { type: 'water', plotId, t: 3 + i * 3 },
    { type: 'harvest', plotId, t: 3 + i * 3 + RIPE },
  ]),
  { type: 'plantCrops', plotId: 'field-1:0,1', t: 20 }, // left dry: it waits, then withers
  { type: 'plantCrops', plotId: 'field-1:1,1', t: 21 },
  { type: 'water', plotId: 'field-1:1,1', t: 22 }, // never picked: it rots
  { type: 'plantOrchard', plotId: 'orchard-1:0,0', t: 30 },
  { type: 'repairReservoir', plotId: 'reservoir', t: 40 },
];
/** The tree's growing effect, named after the action that planted it (`<id>:orchardMature`). */
const TREE_EFFECT = `1-${FIRST.findIndex((a) => a.type === 'plantOrchard')}:orchardMature`;

/** Three generations on seed 123: AL farms and starts the reservoir, MO tends and hurries, KE picks. */
const SCRIPT: { player: string; acts: Act[] }[] = [
  { player: 'al', acts: FIRST },
  {
    player: 'mo',
    acts: [
      { type: 'maintain', plotId: 'field-1:1,1', t: 5 },
      { type: 'digWell', plotId: 'well', t: 10 },
      { type: 'fastTrack', targetEffectId: TREE_EFFECT, t: 20 },
    ],
  },
  { player: 'ke', acts: [{ type: 'harvest', plotId: 'orchard-1:0,0', t: 5 }, { type: 'fishHunt', plotId: 'wild', t: 10 }] },
];

/** Plays SCRIPT through the engine into a finished-world Replay, as the backend would store it. */
export function scriptedReplay(): Replay {
  let state: WorldState = createWorld(123, { worldId: 'bench', biome: 'forest', generationCount: SCRIPT.length }).state;
  const snapshots: WorldState[] = [];
  const actions: ActionEntry[] = [];
  const transitions: Transition[] = [];
  SCRIPT.forEach(({ acts }, i) => {
    const begun = beginTurn(state);
    state = begun.state;
    transitions.push(...begun.transitions);
    acts.forEach(({ t, ...a }, seq) => {
      const r = applyAction(state, { ...a, id: `${i + 1}-${seq}`, actorId: SCRIPT[i]!.player, seq }, t);
      if (!r.entry) return console.warn(`bench: gen ${i + 1} ${a.type} refused: ${r.error}`);
      state = r.state;
      transitions.push(...r.transitions);
      actions.push(r.entry);
    });
    const ended = endTurn(state);
    state = ended.state;
    transitions.push(...ended.transitions);
    snapshots.push(state);
  });
  const journal = SCRIPT.map(({ player }, i) => ({ turn: i + 1, authorUsername: player, text: '', drawing: [] }));
  return { worldId: 'bench', name: 'Bench', seed: 123, biome: 'forest', snapshots, actions, transitions, journal };
}

/**
 * `#/dev/replay` (dev builds only): B's replay world on its own, for C's layout work. A scripted
 * three-generation world, or `?world=<id>` for a finished world from the backend.
 */
export function ReplayBench() {
  const [params] = useSearchParams();
  const worldId = params.get('world');
  const [replay, setReplay] = useState<Replay | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!worldId) return setReplay(scriptedReplay());
    backend.getReplay(worldId).then(setReplay, (e: unknown) => setError(String(e)));
  }, [worldId]);

  const [turn, setTurn] = useState(1);
  const [picked, setPicked] = useState<{ id: PlotId; at: { x: number; y: number } } | null>(null);
  const changed = useMemo(() => (replay ? changedPlots(replay, turn) : []), [replay, turn]);
  if (error) return <pre style={{ padding: 16 }}>{error}</pre>;
  if (!replay) return null;
  const gens = replay.snapshots.length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12, padding: 12, height: '100vh', boxSizing: 'border-box', background: '#101418', color: '#fefadb', font: '13px monospace' }}>
      <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 8, minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setTurn((t) => Math.max(1, t - 1))} disabled={turn <= 1}>◀</button>
          <span>
            Generation {turn} of {gens} · {playerOf(replay, turn)} · {changed.length} changed
          </span>
          <button onClick={() => setTurn((t) => Math.min(gens, t + 1))} disabled={turn >= gens}>▶</button>
        </div>
        <div style={{ position: 'relative', minHeight: 0 }}>
          <ReplayWorld replay={replay} turn={turn} onPlotClick={(id, at) => setPicked({ id, at })} />
          {picked && <div style={{ position: 'absolute', left: picked.at.x - 3, top: picked.at.y - 3, width: 6, height: 6, background: '#fefadb', pointerEvents: 'none' }} />}
        </div>
      </div>
      <div style={{ overflow: 'auto' }}>
        <h3 style={{ margin: '0 0 6px' }}>{picked ? picked.id : 'Click a plot or tile'}</h3>
        {picked && <pre data-testid="history">{JSON.stringify(plotHistory(replay, picked.id), null, 1)}</pre>}
        <h3 style={{ margin: '12px 0 6px' }}>Changed this generation</h3>
        <pre data-testid="changed">{changed.join('\n')}</pre>
      </div>
    </div>
  );
}
