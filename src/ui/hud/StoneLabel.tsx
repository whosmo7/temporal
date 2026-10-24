import { stoneLabel } from '../../render/graveyard';
import { useGameStore } from '../../store/game';
import { Panel } from '../kit';

/** The name over a gravestone under the mouse (05): "AL · Generation 2" (decision 014). */
export function StoneLabel() {
  const stone = useGameStore((s) => s.hoveredStone);
  if (!stone) return null;
  return (
    <div style={{ position: 'absolute', left: stone.x, top: stone.y - 6, transform: 'translate(-50%, -100%)', pointerEvents: 'none' }}>
      <Panel cast={false} style={{ padding: '2px 10px', whiteSpace: 'nowrap' }} role="tooltip">
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 16 }}>{stoneLabel(stone)}</span>
      </Panel>
    </div>
  );
}
