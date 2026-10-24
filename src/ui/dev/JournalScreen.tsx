import { useMemo, useState } from 'react';
import type { JournalPage } from '../../api/Backend';
import { JournalModal, type SealedPage } from '../journal/JournalModal';
import { StrokeRenderer } from '../journal/StrokeRenderer';
import { Button, Panel } from '../kit';
import { palette } from '../theme/palette';
import type { Drawing } from '../journal/strokes';

/**
 * Dev-only bench for the journal at `#/dev/journal`. The sample letters are made up for testing
 * layouts (text only, sketch only, empty, long); they aren't the founder pages (`10`).
 */

const MAP: Drawing = [
  // East fence
  { color: palette.ledge, width: 2.5, points: [[230, 30], [232, 80], [231, 130], [233, 175]] },
  { color: palette.ledge, width: 2.5, points: [[222, 50], [240, 50]] },
  { color: palette.ledge, width: 2.5, points: [[222, 110], [240, 110]] },
  // Something planted by it
  { color: palette.tree, width: 2.5, points: [[196, 92], [190, 80], [196, 70], [206, 72], [210, 84], [204, 94], [196, 92]] },
  { color: palette.ledge, width: 2.5, points: [[200, 94], [200, 112]] },
  // An X and a path from the house
  { color: palette.ink, width: 2.5, points: [[60, 150], [70, 160]] },
  { color: palette.ink, width: 2.5, points: [[70, 150], [60, 160]] },
  { color: palette.ink, width: 2.5, points: [[72, 150], [110, 132], [150, 118], [186, 104]] },
  { color: palette.seaDeep, width: 2.5, points: [[40, 40], [60, 34], [84, 40], [92, 56], [70, 66], [44, 60], [40, 40]] },
];

const WELL: Drawing = [
  { color: palette.ink, width: 2.5, points: [[140, 120], [140, 80], [180, 80], [180, 120]] },
  { color: palette.ink, width: 2.5, points: [[130, 120], [190, 120]] },
  { color: palette.seaDeep, width: 2.5, points: [[150, 112], [170, 112]] },
  { color: palette.ink, width: 2.5, points: [[160, 80], [160, 60]] },
];

const SAMPLES: JournalPage[] = [
  {
    turn: 1,
    authorUsername: 'mo',
    text: 'Dry first thing. I mended what I could of the big basin. The fish by the rocks come in the evening.',
    drawing: WELL,
  },
  { turn: 2, authorUsername: 'sheikh', text: '', drawing: MAP },
  { turn: 3, authorUsername: 'crisps', text: '', drawing: [] },
  {
    turn: 4,
    authorUsername: 'al',
    text: "I put something in by the east fence. Water it if you can. The well went green near the end and I didn't have the legs left to see to it, sorry. Ate most of the second field. There's a little in the store.",
    drawing: MAP,
  },
  {
    turn: 5,
    authorUsername: 'judge',
    text: 'Long day. '.repeat(40).trim(),
    drawing: [],
  },
];

const COUNTS = [0, 1, 4, 5, 16] as const;

export function JournalScreen() {
  const [count, setCount] = useState<(typeof COUNTS)[number]>(4);
  const [mode, setMode] = useState<'write' | 'read' | null>(null);
  const [sealed, setSealed] = useState<SealedPage | null>(null);
  const [run, setRun] = useState(0);

  const pages = useMemo(() => {
    if (count <= SAMPLES.length) return SAMPLES.slice(0, count);
    // Many generations: repeat the samples to test the stack compressing.
    return Array.from({ length: count }, (_, i) => ({ ...SAMPLES[i % 4], turn: i + 1 }));
  }, [count]);

  return (
    <div style={{ display: 'grid', gap: 24, width: 'min(760px, 100%)' }}>
      <Panel title="Journal bench">
        <p style={{ margin: '0 0 15px' }}>Earlier pages:</p>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 21 }}>
          {COUNTS.map((n) => (
            <Button key={n} size="sm" variant={n === count ? 'primary' : 'default'} onClick={() => setCount(n)}>
              {n === 0 ? 'None (gen 1)' : String(n)}
            </Button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 15 }}>
          <Button
            variant="primary"
            onClick={() => {
              setSealed(null);
              setRun((r) => r + 1);
              setMode('write');
            }}
          >
            Open to write
          </Button>
          <Button onClick={() => setMode('read')}>Open from the lectern</Button>
        </div>
      </Panel>

      {sealed && (
        <Panel title="Sealed page" tone="paper">
          <p className="font-hand" style={{ margin: '0 0 12px', fontSize: 23, whiteSpace: 'pre-wrap' }}>
            {sealed.text || '(no words)'}
          </p>
          <StrokeRenderer drawing={sealed.drawing} label="Sealed sketch" width={320} />
          <pre style={{ margin: '12px 0 0', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(sealed).length} bytes of JSON · {sealed.drawing.length} strokes
          </pre>
        </Panel>
      )}

      {mode === 'write' && (
        <JournalModal
          key={run}
          mode="write"
          pages={pages}
          generation={pages.length + 1}
          author="you"
          onSeal={(p) => {
            setSealed(p);
            setMode(null);
          }}
        />
      )}
      {mode === 'read' && (
        <JournalModal mode="read" pages={pages} generation={pages.length + 1} author="you" onClose={() => setMode(null)} />
      )}
    </div>
  );
}
