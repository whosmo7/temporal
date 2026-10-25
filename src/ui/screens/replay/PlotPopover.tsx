import { useEffect, useRef } from 'react';
import type { Replay } from '../../../api';
import type { PlotId } from '../../../engine';
import { plotHistory, viewAt } from '../../replay';
import { historyLine, plotLabel } from './words';

const WIDTH = 360;

/**
 * A plot's or tile's story, generation by generation up to the one shown (06), anchored where it
 * was clicked in the replay world. Esc or a click anywhere else closes it.
 */
export function PlotPopover({
  replay,
  turn,
  plotId,
  at,
  bounds,
  onClose,
}: {
  replay: Replay;
  turn: number;
  plotId: PlotId;
  /** The click, in CSS px from the world's top-left. */
  at: { x: number; y: number };
  /** The world's size, to keep the popover inside it. */
  bounds: { width: number; height: number };
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const view = viewAt(replay, turn);
  const kind = view.plots[plotId]?.kind;
  const rows = kind ? plotHistory(replay, plotId).filter((g) => g.turn <= turn).map((g) => ({ turn: g.turn, text: historyLine(g, kind, replay.biome) })) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [onClose]);

  // Open to the right of the click, or to the left near the right edge; never past the bottom.
  const left = at.x + 12 + WIDTH > bounds.width ? Math.max(0, at.x - 12 - WIDTH) : at.x + 12;
  const top = Math.max(0, Math.min(at.y - 16, bounds.height - 40 - rows.length * 22));

  return (
    <div
      ref={box}
      className="replay__popover"
      role="dialog"
      aria-label={plotLabel(view, plotId)}
      style={{ left, top, width: WIDTH }}
    >
      <h3>{plotLabel(view, plotId)}</h3>
      <ol>
        {rows.map((r) => (
          <li key={r.turn} className={r.turn === turn ? 'replay__history replay__history--now' : 'replay__history'}>
            {r.text}
          </li>
        ))}
      </ol>
    </div>
  );
}
