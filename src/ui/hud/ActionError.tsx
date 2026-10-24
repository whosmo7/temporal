import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/game';
import { Panel } from '../kit';

/** How long a refused action's reason stays up. */
const SHOW_MS = 1600;

/** The engine's reason an action you just tried didn't happen ("Not enough stamina"), briefly. */
export function ActionError() {
  const last = useGameStore((s) => s.lastAction);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!last?.error) return setShown(null);
    setShown(last.n);
    const id = setTimeout(() => setShown(null), SHOW_MS);
    return () => clearTimeout(id);
  }, [last]);
  if (!last?.error || shown !== last.n) return null;
  return (
    <Panel cast={false} style={{ padding: '2px 10px' }} role="alert">
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 16, color: 'var(--peach)' }}>{last.error}</span>
    </Panel>
  );
}
