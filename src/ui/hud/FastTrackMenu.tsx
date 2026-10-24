import { useEffect } from 'react';
import type { FastTrackOption, PlotId, VisibleWorld } from '../../engine';
import { Button, Panel } from '../kit';
import { plotName, stageName, tileName } from './copy';
import { Cost } from './InteractPrompt';

/**
 * "Hurry something along" (04, flavour-text): every pending effect, anyone's, with who started it
 * and when, how it looks now and what hurrying costs. No due dates and no yields. Field and
 * orchard tiles are one row each (decision 019).
 */
export function FastTrackMenu({
  view,
  focusPlot,
  check,
  onPick,
  onClose,
}: {
  view: VisibleWorld;
  /** Opened from this plot: its row comes first. */
  focusPlot: string | null;
  check: (effectId: string) => string | null;
  onPick: (option: FastTrackOption) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = [...view.fastTrackable].sort((a, b) => Number(b.plotId === focusPlot) - Number(a.plotId === focusPlot));
  const name = (id: PlotId) => {
    const plot = view.plots[id]!;
    if (!plot.tile) return plotName(plot.kind, view.biome);
    const { plot: of } = plot.tile;
    const tiles = Object.values(view.plots)
      .filter((p) => p.tile?.plot === of)
      .sort((a, b) => a.tile!.y - b.tile!.y || a.tile!.x - b.tile!.x);
    return tileName(plot.kind, tiles.indexOf(plot) + 1);
  };
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <Panel title="Hurry something along" style={{ minWidth: 420, padding: '10px 14px' }}>
        {rows.length === 0 && <p style={{ fontFamily: 'var(--font-ui)', fontSize: 16 }}>Nothing to hurry</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((o, i) => {
            const plot = o.plotId ? view.plots[o.plotId] : undefined;
            const error = check(o.effectId);
            return (
              <Button key={o.effectId} onClick={() => onPick(o)} disabled={!!error} autoFocus={i === 0}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <span>
                    {plot ? name(plot.id) : 'Work'} — started by {o.actorId ?? 'someone'}, Generation {o.committedTurn}
                    {plot && ` · ${stageName(plot.kind, plot.stage, view.biome)}`}
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
                    <Cost cost={o.cost} />
                    {error && <span style={{ color: 'var(--peach)' }}>{error}</span>}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
        <div style={{ marginTop: 10, textAlign: 'right' }}>
          <Button onClick={onClose}>Close</Button>
        </div>
      </Panel>
    </div>
  );
}
