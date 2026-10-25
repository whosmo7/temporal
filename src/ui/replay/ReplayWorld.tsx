import { useEffect, useMemo, useRef, useState } from 'react';
import type { Replay } from '../../api';
import type { PlotId } from '../../engine';
import { PixiStage } from '../../render/PixiStage';
import { lookOf, type ReplayMode, type WorldView } from '../../render/world-view';
import { ghostDay } from './ghosts';
import { changedPlots, replayMap, stonesAt, viewAt } from './replayData';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A read-only world for one generation of a replay (06): the map as it looked at the end of
 * generation `turn`, the graveyard's stones so far, and the plots and tiles that changed that
 * generation glowing. No player, no input, no clock. It fills its parent.
 *
 * `onPlotClick` gets the clicked plot or tile (`field-1:2,0`) and the click's position in CSS px
 * from this component's top-left, for anchoring a popover.
 *
 * With `ghosts` (on unless the viewer prefers reduced motion), a faint figure of that
 * generation's player replays their day on a loop (decision 038), the whole day in
 * `ghostSeconds` of real time when given.
 */
export function ReplayWorld({
  replay,
  turn,
  onPlotClick,
  ghosts = true,
  ghostSeconds,
}: {
  replay: Replay;
  turn: number;
  onPlotClick?: (plotId: PlotId, at: { x: number; y: number }) => void;
  ghosts?: boolean;
  ghostSeconds?: number;
}) {
  const map = useMemo(() => replayMap(replay), [replay]);
  const look = useMemo(() => lookOf(map, viewAt(replay, turn)), [map, replay, turn]);
  const [view, setView] = useState<WorldView | null>(null);

  const click = useRef(onPlotClick);
  click.current = onPlotClick;
  const mode = useMemo<ReplayMode>(() => ({ onPlotClick: (id, at) => click.current?.(id, at) }), []);

  useEffect(() => {
    view?.setStones(stonesAt(replay, turn));
    view?.setHighlights(changedPlots(replay, turn));
  }, [view, replay, turn]);

  useEffect(() => {
    view?.setGhost(ghosts && !reducedMotion() ? ghostDay(replay, map, turn) : null, ghostSeconds);
  }, [view, replay, map, turn, ghosts, ghostSeconds]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 240 }}>
      <PixiStage map={map} look={look} onReady={setView} replay={mode} />
    </div>
  );
}
