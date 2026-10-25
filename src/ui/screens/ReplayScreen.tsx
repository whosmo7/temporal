import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { backend, type JournalPage, type Replay } from '../../api';
import { asDrawing, StrokeRenderer } from '../journal';
import { Button, ButtonLink, Panel } from '../kit';
import type { PlotId } from '../../engine';
import { ReplayWorld } from '../replay';
import { explainGeneration, signed } from '../replay/causeSentences';
import { DUSK_LIGHT, IslandScene } from '../shell/IslandScene';
import { PlotPopover } from './replay/PlotPopover';
import { Timeline } from './replay/Timeline';
import { legacyOf, PACE_MS, type Pace } from './replay/words';

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'ready'; replay: Replay };

/** Where the viewer is: the title card, a generation (1..N), or the ending card. */
type At = 'title' | number | 'end';

const BIOME_NAME: Record<Replay['biome'], string> = { forest: 'A forest', island: 'An island' };

/**
 * `/world/:id/replay`. Public (decision 017). Title card → each generation → ending card, stepped
 * with the timeline, the arrow keys or Play. Each generation shows B's `ReplayWorld` beside that
 * player's page and what changed (`06`).
 */
export function ReplayScreen() {
  const { id = '' } = useParams();
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    let live = true;
    backend
      .getReplay(id)
      .then((replay) => live && setLoad({ state: 'ready', replay }))
      .catch(() => live && setLoad({ state: 'missing' }));
    return () => {
      live = false;
    };
  }, [id]);

  if (load.state === 'loading') return null;

  if (load.state === 'missing') {
    return (
      <Panel title="Nothing here" className="lost">
        <p>This world hasn’t ended, or it doesn’t exist.</p>
        <ButtonLink to="/gallery" icon="left">
          Gallery
        </ButtonLink>
      </Panel>
    );
  }

  return <ReplayViewer replay={load.replay} />;
}

export function ReplayViewer({ replay }: { replay: Replay }) {
  const generations = Math.max(replay.snapshots.length, replay.journal.length);
  const [at, setAt] = useState<At>('title');
  const page = (turn: number) => replay.journal.find((p) => p.turn === turn);
  const nameOf = useCallback(
    (turn: number) => replay.journal.find((p) => p.turn === turn)?.authorUsername ?? `Generation ${turn}`,
    [replay.journal],
  );

  const step = useCallback(
    (by: 1 | -1) =>
      setAt((a) => {
        const i = a === 'title' ? 0 : a === 'end' ? generations + 1 : a;
        const next = Math.max(0, Math.min(generations + 1, i + by));
        return next === 0 ? 'title' : next === generations + 1 ? 'end' : next;
      }),
    [generations],
  );

  // Auto-play: off until Play, steps on its own at the chosen pace, stops at the ending card.
  const [playing, setPlaying] = useState(false);
  const [pace, setPace] = useState<Pace>('normal');
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (at === 'end') setPlaying(false);
    if (!playing || held || typeof at !== 'number') return;
    const timer = window.setTimeout(() => step(1), PACE_MS[pace]);
    return () => window.clearTimeout(timer);
  }, [playing, held, pace, at, step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  if (at === 'title') {
    return (
      <div className="replay replay--card">
        <div className="replay__sky" aria-hidden />
        <p className="replay__kicker">
          {BIOME_NAME[replay.biome]} · {generations} {generations === 1 ? 'generation' : 'generations'}
        </p>
        <h1 className="replay__headline">Everyone who lived here is gone.</h1>
        <div className="replay__actions">
          <Button variant="primary" icon="right" onClick={() => step(1)} autoFocus>
            Begin
          </Button>
        </div>
      </div>
    );
  }

  if (at === 'end') return <EndingCard replay={replay} generations={generations} nameOf={nameOf} onAgain={() => setAt('title')} />;

  return (
    <GenerationView
      replay={replay}
      turn={at}
      generations={generations}
      page={page(at)}
      nameOf={nameOf}
      onHold={setHeld}
      timeline={
        <Timeline
          turn={at}
          generations={generations}
          nameOf={nameOf}
          onJump={setAt}
          onStep={step}
          playing={playing}
          onPlaying={setPlaying}
          pace={pace}
          onPace={setPace}
        />
      }
    />
  );
}

function GenerationView({
  replay,
  turn,
  generations,
  page,
  nameOf,
  onHold,
  timeline,
}: {
  replay: Replay;
  turn: number;
  generations: number;
  page: JournalPage | undefined;
  nameOf: (turn: number) => string;
  /** True while a plot's history is open, so auto-play waits. */
  onHold: (held: boolean) => void;
  timeline: ReactNode;
}) {
  const changes = useMemo(
    () => explainGeneration(turn, { actions: replay.actions, transitions: replay.transitions, nameOf, biome: replay.biome }),
    [turn, replay, nameOf],
  );
  const drawing = asDrawing(page?.drawing);
  const world = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<{ id: PlotId; at: { x: number; y: number } } | null>(null);
  const close = useCallback(() => setPicked(null), []);

  useEffect(() => setPicked(null), [turn]);
  useEffect(() => onHold(picked !== null), [picked, onHold]);

  return (
    <div className="replay replay--generation">
      <div className="replay__sky" aria-hidden />
      <p className="replay__kicker">
        Generation {turn} of {generations} · {nameOf(turn)}
      </p>
      <div className="replay__stage">
        <div ref={world} className="replay__world">
          <ReplayWorld replay={replay} turn={turn} onPlotClick={(id, at) => setPicked({ id, at })} />
          {picked && (
            <PlotPopover
              replay={replay}
              turn={turn}
              plotId={picked.id}
              at={picked.at}
              bounds={{ width: world.current?.clientWidth ?? 0, height: world.current?.clientHeight ?? 0 }}
              onClose={close}
            />
          )}
        </div>
        <div className="replay__side">
          <Panel tone="paper" className="replay__page">
            {page?.text ? <p className="replay__text">{page.text}</p> : <p className="replay__text replay__text--none">They left no words.</p>}
            {drawing.length > 0 && <StrokeRenderer drawing={drawing} width={300} label={`Sketch by ${nameOf(turn)}`} />}
          </Panel>
          <Panel title="What actually changed" className="replay__causes">
            {changes.length === 0 && <p>Nothing changed.</p>}
            {changes.map((change) => (
              <section key={change.resource} className="replay__resource">
                <h3>
                  {change.label} {signed(change.net)}
                </h3>
                <ul>
                  {change.lines.map((line) => (
                    <li key={line.text} className={line.earlier ? 'replay__line replay__line--earlier' : 'replay__line'}>
                      <span className="replay__amount">{signed(line.amount)}</span>
                      <span>
                        {line.earlier && <span className="replay__mark" aria-hidden>← </span>}
                        {line.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </Panel>
        </div>
      </div>
      {timeline}
    </div>
  );
}

/** The dusk island with a stone for everyone who lived here, and their names in order. */
function EndingCard({
  replay,
  generations,
  nameOf,
  onAgain,
}: {
  replay: Replay;
  generations: number;
  nameOf: (turn: number) => string;
  onAgain: () => void;
}) {
  const light = useRef<HTMLDivElement>(null);
  const turns = Array.from({ length: generations }, (_, i) => i + 1);
  const legacy = useMemo(() => legacyOf(replay, nameOf), [replay, nameOf]);
  return (
    <div className="replay replay--card replay--end">
      <div className="replay__sky" aria-hidden />
      <div ref={light} className="replay__light" aria-hidden />
      <IslandScene lightRef={light} hold={{ light: DUSK_LIGHT, stones: generations }} />
      <h1 className="replay__headline">
        {generations} {generations === 1 ? 'generation' : 'generations'} lived here.
      </h1>
      <ol className="replay__names" aria-label="Who lived here">
        {turns.map((turn) => (
          <li key={turn}>
            <span className="replay__gen">{turn}</span> {nameOf(turn)}
          </li>
        ))}
      </ol>
      {legacy.length > 0 && (
        <Panel title="After they left" className="replay__legacy">
          <ul>
            {legacy.map((l) => (
              <li key={l.text}>{l.text}</li>
            ))}
          </ul>
        </Panel>
      )}
      <div className="replay__actions">
        <Button onClick={onAgain}>Watch again</Button>
        <ButtonLink to="/gallery" variant="primary" autoFocus>
          Gallery
        </ButtonLink>
      </div>
    </div>
  );
}
