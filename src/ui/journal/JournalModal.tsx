import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { JournalPage } from '../../api/Backend';
import { Button, Dialog, PixelBitmap } from '../kit';
import { palette } from '../theme/palette';
import { JOURNAL_CHAR_LIMIT, PENS, SEAL_HOLD_MS, SEAL_PRESS_MS, type PenId } from './constants';
import { DrawingCanvas } from './DrawingCanvas';
import { StrokeRenderer } from './StrokeRenderer';
import { asDrawing, isBlank, type Drawing } from './strokes';
import './journal.css';

export interface SealedPage {
  text: string;
  drawing: Drawing;
}

type Props = {
  /** Earlier pages, any order. The world's whole journal so far. */
  pages: JournalPage[];
  /** The generation being played now. */
  generation: number;
  /** The current player's username. */
  author: string;
} & (
  | {
      /** End of turn: write and seal. Can't be closed, only sealed. */
      mode: 'write';
      onSeal: (page: SealedPage) => void;
    }
  | {
      /** From the lectern during play: read only. Esc or Close shuts it. */
      mode: 'read';
      onClose: () => void;
      /** Generation to open at (a gravestone's page). Defaults to the latest page. */
      openAt?: number;
    }
);

// The wax seal, 16 px. k = rim, r = wax, h = highlight from the top-left, e = the pressed sprout.
const SEAL = [
  '.....kkkkkk.....',
  '...kkrrrrrrkk...',
  '..krhhrrrrrrrk..',
  '.krhrrrrrrrrrrk.',
  '.krhrrrreerrrrk.',
  'krrrrrreeeerrrrk',
  'krrrrrrreerrrrrk',
  'krrrreerreerrrrk',
  'krrrrreeeerrrrrk',
  'krrrrrrreerrrrrk',
  'krrrrrrreerrrrrk',
  '.krrrrrreerrrrk.',
  '.krrrrreeeerrrk.',
  '..krrrrrrrrrrk..',
  '...kkrrrrrrkk...',
  '.....kkkkkk.....',
];
const SEAL_INKS = { k: palette.panelEdge, r: palette.food, h: palette.rose, e: palette.panelEdge };

function PageHeader({ generation, name }: { generation: number; name?: string }) {
  return (
    <header className="page__header">
      Generation {generation}
      {name && <> · {name}</>}
    </header>
  );
}

/** A page someone else left, exactly as they sealed it. */
function Letter({ page }: { page: JournalPage }) {
  const drawing = useMemo(() => asDrawing(page.drawing), [page.drawing]);
  const text = page.text.trim();
  return (
    <>
      <PageHeader generation={page.turn} name={page.authorUsername} />
      {text && <p className="letter__text">{text}</p>}
      {!isBlank(drawing) && (
        <StrokeRenderer className="letter__sketch" drawing={drawing} label={`Sketch by ${page.authorUsername}`} />
      )}
    </>
  );
}

/** One sliver per earlier letter along the book's outer edge. Click to turn to it. */
function LetterStack({
  pages,
  selected,
  onSelect,
}: {
  pages: JournalPage[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  if (pages.length < 2) return null;
  return (
    <nav className="stack" aria-label="Earlier pages">
      {pages.map((p, i) => (
        <button
          key={p.turn}
          type="button"
          className="stack__sliver"
          aria-current={i === selected ? 'page' : undefined}
          aria-label={`Generation ${p.turn}, ${p.authorUsername}`}
          onClick={() => onSelect(i)}
        >
          <span className="stack__tip" aria-hidden>
            Gen {p.turn} · {p.authorUsername}
          </span>
        </button>
      ))}
    </nav>
  );
}

export function JournalModal(props: Props) {
  const { pages: rawPages, generation, author, mode } = props;
  const pages = useMemo(() => [...rawPages].sort((a, b) => a.turn - b.turn), [rawPages]);

  const dialog = useRef<HTMLDialogElement>(null);
  const openAt = props.mode === 'read' ? props.openAt : undefined;
  const firstPage = () => {
    const i = pages.findIndex((p) => p.turn === openAt);
    return i >= 0 ? i : pages.length - 1;
  };
  const [selected, setSelected] = useState(firstPage);
  const [text, setText] = useState('');
  const [drawing, setDrawing] = useState<Drawing>([]);
  const [history, setHistory] = useState<Drawing[]>([]);
  const [pen, setPen] = useState<PenId>('ink');
  const [asking, setAsking] = useState(false);
  const [seal, setSeal] = useState<'open' | 'pressing' | 'sealed'>('open');
  const timers = useRef<number[]>([]);
  const counterId = useId();
  const textId = useId();

  const locked = seal !== 'open';
  const empty = text.trim() === '' && isBlank(drawing);
  const atLimit = text.length >= JOURNAL_CHAR_LIMIT;

  useEffect(() => {
    const el = dialog.current!;
    if (!el.open) el.showModal();
    // showModal focuses the first control (a letter sliver); typing should land on your page.
    el.querySelector<HTMLTextAreaElement>('.page__writing')?.focus();
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  // Re-pick only when a page is added or a different stone is clicked.
  useEffect(() => setSelected(firstPage()), [pages.length, openAt]);

  const commit = (next: Drawing) => {
    setHistory((h) => [...h, drawing]);
    setDrawing(next);
  };

  const undo = () => {
    if (locked || history.length === 0) return;
    setDrawing(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };

  const doSeal = () => {
    if (props.mode !== 'write') return;
    const { onSeal } = props;
    setAsking(false);
    setSeal('pressing');
    const page: SealedPage = { text: text.trim(), drawing };
    timers.current.push(
      window.setTimeout(() => setSeal('sealed'), SEAL_PRESS_MS),
      window.setTimeout(() => onSeal(page), SEAL_PRESS_MS + SEAL_HOLD_MS),
    );
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // In the writing area, Ctrl+Z is the browser's text undo. Elsewhere it takes back a stroke.
    const inText = (e.target as HTMLElement).tagName === 'TEXTAREA';
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !inText) {
      e.preventDefault();
      undo();
    }
    if (mode === 'read' && !inText) {
      if (e.key === 'ArrowLeft') setSelected((s) => Math.max(0, s - 1));
      if (e.key === 'ArrowRight') setSelected((s) => Math.min(pages.length - 1, s + 1));
    }
  };

  const current = pages[selected];
  const penColor = PENS.find((p) => p.id === pen)!.color;

  return (
    <dialog
      ref={dialog}
      className="journal"
      aria-label={mode === 'write' ? 'Journal: write your page' : 'Journal'}
      onCancel={(e) => {
        e.preventDefault();
        if (props.mode === 'read') props.onClose();
      }}
      onKeyDown={onKeyDown}
    >
      <div className="book">
        <LetterStack pages={pages} selected={selected} onSelect={setSelected} />

        <article className="page page--left on-paper">
          {/* Keyed so turning to another letter replays the page-turn. */}
          <div className="page__content" key={current?.turn ?? 'blank'}>
            {current ? <Letter page={current} /> : null}
          </div>
          {mode === 'read' && pages.length > 1 && (
            <div className="page__turns">
              <Button
                size="sm"
                variant="quiet"
                icon="left"
                disabled={selected === 0}
                onClick={() => setSelected((s) => s - 1)}
              >
                Earlier
              </Button>
              <Button
                size="sm"
                variant="quiet"
                icon="right"
                disabled={selected === pages.length - 1}
                onClick={() => setSelected((s) => s + 1)}
              >
                Later
              </Button>
            </div>
          )}
        </article>

        <article className={`page page--right on-paper${locked ? ' page--sealed' : ''}`}>
          <PageHeader generation={generation} name={author} />

          {mode === 'write' && (
            <>
              <label htmlFor={textId} className="visually-hidden">
                Your page
              </label>
              <textarea
                id={textId}
                className="page__writing"
                value={text}
                maxLength={JOURNAL_CHAR_LIMIT}
                onChange={(e) => setText(e.target.value)}
                readOnly={locked}
                spellCheck
                placeholder="Write to whoever comes next."
                aria-describedby={counterId}
              />

              <div className="sketch">
                <DrawingCanvas
                  drawing={drawing}
                  color={penColor}
                  disabled={locked}
                  onStroke={(s) => commit([...drawing, s])}
                />
              </div>

              <footer className="page__foot">
                <div className="pens" role="group" aria-label="Pens">
                  {PENS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`pen pen--${p.id}`}
                      style={p.id === 'eraser' ? undefined : { ['--pen' as string]: p.color }}
                      aria-pressed={pen === p.id}
                      aria-label={p.label}
                      title={p.label}
                      disabled={locked}
                      onClick={() => setPen(p.id)}
                    />
                  ))}
                  <span className="pens__gap" />
                  <Button
                    size="sm"
                    variant="quiet"
                    icon="undo"
                    iconOnly
                    disabled={locked || history.length === 0}
                    onClick={undo}
                    title="Undo last stroke (Ctrl+Z)"
                  >
                    Undo last stroke
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    icon="clear"
                    iconOnly
                    disabled={locked || isBlank(drawing)}
                    onClick={() => commit([])}
                    title="Clear sketch"
                  >
                    Clear sketch
                  </Button>
                </div>
                <span id={counterId} className={`counter${atLimit ? ' counter--full' : ''}`}>
                  {text.length} / {JOURNAL_CHAR_LIMIT}
                </span>
              </footer>

              <button
                type="button"
                className={`seal seal--${seal}`}
                onClick={() => setAsking(true)}
                disabled={locked}
                aria-label="Seal page"
              >
                <PixelBitmap rows={SEAL} inks={SEAL_INKS} scale={4} />
                <span className="seal__label" aria-hidden>
                  {seal === 'open' ? 'Seal' : 'Sealed'}
                </span>
              </button>
            </>
          )}
        </article>
      </div>

      {props.mode === 'read' && (
        <div className="journal__close">
          <Button icon="close" iconOnly onClick={props.onClose}>
            Close journal
          </Button>
        </div>
      )}

      {mode === 'write' && (
        <Dialog
          open={asking}
          tone="paper"
          title={empty ? 'Your page is empty. Seal it anyway?' : 'Seal this page?'}
          onClose={() => setAsking(false)}
          actions={
            <>
              <Button variant="quiet" onClick={() => setAsking(false)}>
                Keep writing
              </Button>
              <Button variant="primary" onClick={doSeal}>
                Seal
              </Button>
            </>
          }
        >
          <p className="seal-ask">You can't change it afterwards.</p>
        </Dialog>
      )}
    </dialog>
  );
}
