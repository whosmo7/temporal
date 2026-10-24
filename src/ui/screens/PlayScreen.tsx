import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PixiStage } from '../../render/PixiStage';
import { founderLook, type WorldLook, type WorldView } from '../../render/world-view';
import { generateMap, isPresetName, type Biome, type TileMap } from '../../worldgen';

/**
 * Local hot-seat world for now: `#/play?seed=123&biome=island&preset=small`. Once the engine and
 * Backend exist (`02`, `07`, `08`), this gets its world from the claimed turn and its look from
 * `visibleView()`. Dev params: `look=healthy|neglected` previews world states, `fps=1` shows the
 * frame rate.
 */
export function PlayScreen() {
  const [params] = useSearchParams();
  const seed = Number(params.get('seed') ?? 123);
  const biome: Biome = params.get('biome') === 'island' ? 'island' : 'forest';
  const presetParam = params.get('preset') ?? 'default';
  const preset = isPresetName(presetParam) ? presetParam : 'default';
  const lookParam = params.get('look');
  const showFps = params.get('fps') === '1';

  const map = useMemo(() => generateMap(seed, biome, preset), [seed, biome, preset]);
  const look = useMemo(() => previewLook(map, lookParam), [map, lookParam]);
  const [view, setView] = useState<WorldView | null>(null);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#101418' }}>
      <PixiStage map={map} look={look} onReady={setView} />
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
    <div style={{ position: 'absolute', top: 8, right: 8, padding: '2px 6px', background: '#1f2027', color: '#fefadb', font: '12px monospace' }}>
      {fps.toFixed(0)} fps
    </div>
  );
}
