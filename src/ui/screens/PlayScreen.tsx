import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { playMusic, stopMusic } from '../../audio/sound';
import { CONFIG } from '../../engine/config';
import { gameHour, isNight } from '../../render/daylight';
import { PixiStage } from '../../render/PixiStage';
import { founderLook, type WorldLook, type WorldView } from '../../render/world-view';
import { useGameStore } from '../../store/game';
import { generateMap, isPresetName, type Biome, type TileMap } from '../../worldgen';
import { Clock } from '../hud/Clock';
import { InteractPrompt } from '../hud/InteractPrompt';
import { JournalModal } from '../journal';

/**
 * Local hot-seat world for now: `#/play?seed=123&biome=island&preset=small`. Once the engine and
 * Backend exist (`02`, `07`, `08`), this gets its world, journal pages and look from the claimed
 * turn and `visibleView()`. Dev params: `look=healthy|neglected` previews world states,
 * `turn=60` shortens the turn to 60 s, `fps=1` shows the frame rate.
 */
export function PlayScreen() {
  const [params] = useSearchParams();
  const seed = Number(params.get('seed') ?? 123);
  const biome: Biome = params.get('biome') === 'island' ? 'island' : 'forest';
  const presetParam = params.get('preset') ?? 'default';
  const preset = isPresetName(presetParam) ? presetParam : 'default';
  const lookParam = params.get('look');
  const turnSeconds = Number(params.get('turn') ?? CONFIG.turnSeconds);
  const showFps = params.get('fps') === '1';

  const map = useMemo(() => generateMap(seed, biome, preset), [seed, biome, preset]);
  const look = useMemo(() => previewLook(map, lookParam), [map, lookParam]);
  const [view, setView] = useState<WorldView | null>(null);

  const startTurn = useGameStore((s) => s.startTurn);
  const nearby = useGameStore((s) => s.nearby);
  const journalOpen = useGameStore((s) => s.journalOpen);
  const setJournalOpen = useGameStore((s) => s.setJournalOpen);
  useEffect(() => startTurn(turnSeconds), [map, turnSeconds, startTurn]);

  // Music: the day loop, crossfading to the dusk loop from 7 pm (decisions 012, 014).
  const night = useGameStore((s) => isNight(gameHour(s.t, s.turnSeconds)));
  useEffect(() => playMusic(night ? 'dusk' : 'day'), [night]);
  useEffect(() => () => stopMusic(), []);

  const atLectern = nearby === 'lectern';
  useEffect(() => {
    if (!atLectern || journalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' || e.code === 'Space') {
        e.preventDefault();
        setJournalOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [atLectern, journalOpen, setJournalOpen]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#101418' }}>
      <PixiStage map={map} look={look} onReady={setView} />
      <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <Clock />
      </div>
      {atLectern && !journalOpen && (
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)' }}>
          <InteractPrompt keyLabel="E" text="Read the journal" />
        </div>
      )}
      {journalOpen && (
        // Reading the journal stops the clock (decision 012). Pages come from the claimed world (08).
        <JournalModal mode="read" pages={[]} generation={1} author="" onClose={() => setJournalOpen(false)} />
      )}
      {showFps && view && <FpsReadout view={view} />}
    </div>
  );
}

/** Dev previews of a thriving and a neglected world, until visibleView() drives the look. */
function previewLook(map: TileMap, name: string | null): WorldLook {
  const base = founderLook(map);
  if (name !== 'healthy' && name !== 'neglected') return base;
  const healthy = name === 'healthy';
  const stage: Record<string, string> = healthy
    ? { field: 'ripe', orchard: 'fruiting', reservoir: 'full', well: 'clear', wild: 'many' }
    : { field: 'rotten', orchard: 'dead', reservoir: 'cracked', well: 'stagnant', wild: 'none' };
  return {
    plots: Object.fromEntries(map.plots.map((p) => [p.id, stage[p.kind] ?? base.plots[p.id]!])),
    store: healthy ? 'full' : 'rotting',
    weakened: !healthy,
    drought: !healthy,
  };
}

function FpsReadout({ view }: { view: WorldView }) {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFps(view.fps()), 500);
    return () => clearInterval(id);
  }, [view]);
  return (
    <div style={{ position: 'absolute', top: 12, left: 12, padding: '2px 6px', background: '#1f2027', color: '#fefadb', font: '12px monospace' }}>
      {fps.toFixed(0)} fps
    </div>
  );
}
