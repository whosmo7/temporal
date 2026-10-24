import type { ClaimedWorld } from '../../api';
import { visibleView } from '../../engine';
import { Button, Panel } from '../kit';
import type { TurnStart } from './Game';

/**
 * "You are inheriting…" (08): where you are, which generation, and who lived here before. Nothing
 * about the state of the world, except that you may wake up tired. The clock starts on Begin.
 */
export function Inheriting({ claim, start, onBegin }: { claim: ClaimedWorld; start: TurnStart; onBegin: () => void }) {
  const before = [...new Set(claim.gravestones.map((g) => g.username))];
  const tired = visibleView(start.world, 0).weakened;
  const line = { fontFamily: 'var(--font-ui)', fontSize: 18, margin: 0 };
  return (
    <Panel title="You are inheriting…" style={{ minWidth: 380 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <p style={line}>{claim.biome === 'island' ? 'An island.' : 'A clearing in the forest.'}</p>
        <p style={line}>
          Generation {claim.turn} of {claim.generationCount}
        </p>
        <p style={line}>{before.length ? `Before you: ${before.join(', ')}` : 'No one has lived here before.'}</p>
        {tired && <p style={line}>You wake up tired.</p>}
        <Button variant="primary" onClick={onBegin} autoFocus>
          Begin
        </Button>
      </div>
    </Panel>
  );
}
