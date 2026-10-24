import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PixiStage } from '../../render/PixiStage';
import { generateMap, isPresetName, type Biome } from '../../worldgen';

/**
 * Local hot-seat world for now: `#/play?seed=123&biome=island&preset=small`. Once the engine and
 * Backend exist (`02`, `07`, `08`), this gets its world from the claimed turn instead.
 */
export function PlayScreen() {
  const [params] = useSearchParams();
  const seed = Number(params.get('seed') ?? 123);
  const biome: Biome = params.get('biome') === 'island' ? 'island' : 'forest';
  const presetParam = params.get('preset') ?? 'default';
  const preset = isPresetName(presetParam) ? presetParam : 'default';

  const map = useMemo(() => generateMap(seed, biome, preset), [seed, biome, preset]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#101418' }}>
      <PixiStage map={map} />
    </div>
  );
}
