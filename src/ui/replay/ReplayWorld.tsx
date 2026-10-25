import { useEffect, useMemo, useRef, useState } from 'react';
import type { Replay } from '../../api';
import type { PlotId } from '../../engine';
import { PixiStage } from '../../render/PixiStage';
import { lookOf, type ReplayMode, type WorldView } from '../../render/world-view';
import { changedPlots, replayMap, stonesAt, viewAt } from './replayData';

/**
 * A read-only world for one generation of a replay (06): the map as it looked at the end of
 * generation `turn`, the graveyard's stones so far, and the plots and tiles that changed that
 * generation glowing. No player, no input, no clock. It fills its parent.
 *
 * `onPlotClick` gets the clicked plot or tile (`field-1:2,0`) and the click's position in CSS px
 * from this component's top-left, for anchoring a popover.
 */
export function ReplayWorld({
  replay,
  turn,
  onPlotClick,
}: {
  replay: Replay;
  turn: number;
  onPlotClick?: (plotId: PlotId, at: { x: number; y: number }) => void;
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 240 }}>
      <PixiStage map={map} look={look} onReady={setView} replay={mode} />
    </div>
  );
}
