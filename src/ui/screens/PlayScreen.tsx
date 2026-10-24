import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Gravestone, JournalPage } from '../../api';
import { beginTurn, CONFIG, createWorld, endTurn } from '../../engine';
import { founderLook, lookIds, type WorldLook } from '../../render/world-view';
import { useGameStore } from '../../store/game';
import { generateMap, isPresetName, type Biome, type PresetName, type TileMap } from '../../worldgen';
import { Game, type SealedTurn, type TurnStart } from '../play/Game';
import { PlayFlow } from '../play/PlayFlow';

/**
 * `#/play` claims a world from the backend and plays it (08). With `seed=` it's an offline dev
 * sandbox instead: `#/play?seed=123&biome=island&preset=small`, where Continue hands the same
 * world to the next generation and nothing is saved. Sandbox params: `turn=60` shortens the turn
 * to 60 s, `name=JO` is you, `graves=AL,MO,KE` plays that many idle generations first (their stones
 * and pages too), and `look=healthy|neglected` swaps the engine's look for a fixed preview.
 * `fps=1` shows the frame rate in both.
 */
export function PlayScreen() {
  const [params] = useSearchParams();
  const showFps = params.get('fps') === '1';
  return params.has('seed') ? <Sandbox params={params} showFps={showFps} /> : <PlayFlow showFps={showFps} />;
}

function Sandbox({ params, showFps }: { params: URLSearchParams; showFps: boolean }) {
  const seed = Number(params.get('seed') ?? 123);
  const biome: Biome = params.get('biome') === 'island' ? 'island' : 'forest';
  const presetParam = params.get('preset') ?? 'default';
  const preset = isPresetName(presetParam) ? presetParam : 'default';
  const lookParam = params.get('look');
  const turnSeconds = Number(params.get('turn') ?? CONFIG.turnSeconds);
  const author = params.get('name') ?? 'Player';
  const gravesParam = params.get('graves') ?? '';

  const map = useMemo(() => generateMap(seed, biome, preset), [seed, biome, preset]);
  const preview = useMemo(() => previewLook(map, lookParam), [map, lookParam]);
  const first = useMemo(
    () => localWorld({ seed, biome, preset, turnSeconds }, gravesParam),
    [seed, biome, preset, turnSeconds, gravesParam],
  );
  const [start, setStart] = useState(first);
  const [prevFirst, setPrevFirst] = useState(first);
  if (first !== prevFirst) {
    setPrevFirst(first);
    setStart(first);
  }

  // Nothing is saved; the sealed page joins the local journal for the next generation.
  const [sealed, setSealed] = useState<SealedTurn | null>(null);
  const save = useCallback(async (turn: SealedTurn) => setSealed(turn), []);

  const navigate = useNavigate();
  const onContinue = useCallback(() => {
    const world = useGameStore.getState().world;
    if (!world || world.turn > world.generationCount || !sealed) return navigate('/');
    const generation = world.turn - 1;
    const next = beginTurn(world);
    setStart((s) => ({
      world: next.state,
      begun: next.transitions,
      pages: [...s.pages, { turn: generation, authorUsername: author, ...sealed.page }],
      stones: [...s.stones, { turn: generation, username: author }],
    }));
  }, [sealed, author, navigate]);
  const endActions = useMemo(() => [{ label: 'Continue', onClick: onContinue }], [onContinue]);

  return (
    <Game map={map} start={start} author={author} save={save} endActions={endActions} previewLook={preview} showFps={showFps} />
  );
}

/**
 * Dev hot-seat world: a fresh engine world, plus one idle generation (no actions) per name in
 * `graves=AL,MO,KE`, so the graveyard, journal and world all agree on who came before.
 */
function localWorld(
  opts: { seed: number; biome: Biome; preset: PresetName; turnSeconds: number },
  graves: string,
): TurnStart {
  const players = graves.split(',').map((n) => n.trim()).filter(Boolean);
  let world = createWorld(opts.seed, {
    worldId: `local-${opts.seed}`,
    biome: opts.biome,
    preset: opts.preset,
    turnSeconds: opts.turnSeconds,
    generationCount: Math.max(CONFIG.generationCount, players.length + 1),
  }).state;
  for (let i = 0; i < players.length; i++) world = endTurn(beginTurn(world).state).state;
  const begun = beginTurn(world);
  const stones: Gravestone[] = players.map((username, i) => ({ turn: i + 1, username }));
  const pages: JournalPage[] = players.map((authorUsername, i) => ({
    turn: i + 1,
    authorUsername,
    text: `(Dev preview: ${authorUsername}'s page.)`,
    drawing: [],
  }));
  return { world: begun.state, begun: begun.transitions, stones, pages };
}

/** Dev previews of a thriving and a neglected world (`look=`), in place of the engine's look. */
function previewLook(map: TileMap, name: string | null): WorldLook | null {
  if (name !== 'healthy' && name !== 'neglected') return null;
  const base = founderLook(map);
  const healthy = name === 'healthy';
  const stage: Record<string, string> = healthy
    ? { field: 'ripe', orchard: 'fruiting', reservoir: 'full', well: 'clear', wild: 'many' }
    : { field: 'rotten', orchard: 'dead', reservoir: 'cracked', well: 'stagnant', wild: 'none' };
  return {
    plots: Object.fromEntries(map.plots.flatMap((p) => lookIds(p).map((id) => [id, stage[p.kind] ?? base.plots[id]!]))),
    store: healthy ? 'full' : 'rotting',
    weakened: !healthy,
    drought: !healthy,
    hungry: !healthy,
  };
}
