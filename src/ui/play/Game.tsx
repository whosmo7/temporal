import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Gravestone, JournalPage } from '../../api/Backend';
import { playMusic, playSfx, stopMusic, type SfxName } from '../../audio/sound';
import type { ActionEntry, EndTurnResult, Transition, VisibleWorld, WorldState } from '../../engine';
import { gameHour, isNight } from '../../render/daylight';
import { PixiStage } from '../../render/PixiStage';
import { founderLook, lookOf, type WorldLook, type WorldView } from '../../render/world-view';
import { isTimeUp, useGameStore, type ActionRequest } from '../../store/game';
import type { Biome, TileMap } from '../../worldgen';
import { ovenOptions, plotOptions, waterEdgeOptions, type ActionOption } from '../hud/actionOptions';
import { ActionError } from '../hud/ActionError';
import { Clock } from '../hud/Clock';
import { HOTBAR } from '../hud/copy';
import { EndCard, type EndAction } from '../hud/EndCard';
import { FastTrackMenu } from '../hud/FastTrackMenu';
import { Hotbar } from '../hud/Hotbar';
import { Hud } from '../hud/Hud';
import { InteractPrompt, type PromptRow } from '../hud/InteractPrompt';
import { StoneLabel } from '../hud/StoneLabel';
import { Button, Dialog } from '../kit';
import { JournalModal, type SealedPage } from '../journal';
import { CostSummary } from '../summary/CostSummary';
import { costSummary, type CostSummaryView } from '../summary/summaryView';

/** One turn to play: the world after `beginTurn`, and the pages and stones of those before. */
export interface TurnStart {
  world: WorldState;
  begun: Transition[];
  pages: JournalPage[];
  stones: Gravestone[];
}

/** What the end of a turn hands to `save`: the sealed page, this turn's log, and the engine's `endTurn`. */
export interface SealedTurn {
  page: SealedPage;
  log: ActionEntry[];
  ended: EndTurnResult;
}

/** End of turn (05): freeze → write your page → what you gave → your stone rises → done. */
type EndStep = 'play' | 'freeze' | 'write' | 'summary' | 'stone' | 'over';
/** How long "The day is over." shows before the journal opens. */
const FREEZE_MS = 2200;

/**
 * One generation on the engine, from 6 am to the stone rising. The turn is saved when the page is
 * sealed (decision 018); the stone and the last card are for show. If `save` fails, the last card
 * offers to try again instead of moving on. A new `start` loads the next turn in the same world.
 */
export function Game({
  map,
  start,
  author,
  save,
  endActions,
  previewLook,
  showFps,
  onLeave,
}: {
  map: TileMap;
  start: TurnStart;
  author: string;
  /** Saves the sealed turn (07). Rejects with the reason if it couldn't. */
  save: (turn: SealedTurn) => Promise<void>;
  /** The buttons under "Generation n is over.", once the turn is saved. */
  endActions: EndAction[];
  /** A fixed look in place of the engine's (dev previews). */
  previewLook?: WorldLook | null;
  showFps?: boolean;
  /** Back to the home page mid-day. Asks first, since the day is not kept. */
  onLeave?: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [view, setView] = useState<WorldView | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [pages, setPages] = useState<JournalPage[]>(start.pages);
  const [stones, setStones] = useState<Gravestone[]>(start.stones);
  const [step, setStep] = useState<EndStep>('play');
  const loadTurn = useGameStore((s) => s.loadTurn);
  useEffect(() => {
    setPages(start.pages);
    setStones(start.stones);
    loadTurn(start.world, author, start.begun);
    setStep('play');
    viewRef.current?.newTurn();
  }, [start, author, loadTurn]);
  useEffect(() => view?.setStones(stones), [view, stones]);

  // What the world looks like comes from visibleView(); re-texture only when a stage or flag changes.
  const lookKey = useGameStore((s) => lookSignature(s.view));
  const look = useMemo(() => {
    if (previewLook) return previewLook;
    const visible = useGameStore.getState().view;
    return visible ? lookOf(map, visible) : founderLook(map);
    // lookKey stands in for the parts of the view the look depends on.
  }, [map, previewLook, lookKey]);

  const vis = useGameStore((s) => s.view);
  const generation = vis?.turn ?? 1;
  const nearby = useGameStore((s) => s.nearby);
  const nearbyStone = useGameStore((s) => s.nearbyStone);
  const journalOpen = useGameStore((s) => s.journalOpen);
  const journalPage = useGameStore((s) => s.journalPage);
  const openJournal = useGameStore((s) => s.openJournal);
  const setJournalOpen = useGameStore((s) => s.setJournalOpen);
  const fastTrack = useGameStore((s) => s.fastTrack);
  const openFastTrack = useGameStore((s) => s.openFastTrack);
  const closeFastTrack = useGameStore((s) => s.closeFastTrack);
  const check = useGameStore((s) => s.check);
  const timeUp = useGameStore(isTimeUp);

  // Music: the day loop, crossfading to the dusk loop from 7 pm (decisions 012, 015).
  const night = useGameStore((s) => isNight(gameHour(s.t, s.turnSeconds)));
  useEffect(() => playMusic(night ? 'dusk' : 'day'), [night]);
  useEffect(() => () => stopMusic(), []);

  // The lectern opens the latest page; at the graveyard, E reads the nearest stone's page.
  const playing = step === 'play' && !journalOpen && !fastTrack;
  const readable = !playing ? null : nearby === 'lectern' ? 'lectern' : nearby === 'graveyard' && nearbyStone ? nearbyStone : null;
  // `nearby` is a field or orchard tile you face, or a whole plot (decision 019). With nothing else
  // to use, the can fills at a pond or the sea edge (027), and you eat at the oven (029).
  const facing = useGameStore((s) => s.facing);
  const options = useMemo(() => {
    if (!vis || !playing) return [];
    const plot = nearby ? vis.plots[nearby] : undefined;
    if (plot) return plotOptions(vis, plot, check);
    if (facing === 'oven') return ovenOptions(vis, check);
    return facing === 'water' ? waterEdgeOptions(vis, check) : [];
  }, [vis, nearby, facing, playing, check]);
  const biome = vis?.biome ?? map.biome;

  const act = useCallback((request: ActionRequest) => {
    const s = useGameStore.getState();
    if (s.t < s.busyUntil) return; // still working on the last one
    if (s.act(request).error) playSfx('deny');
  }, []);
  // An action takes its time (decision 019); its sound and burst come when it lands.
  const lastAction = useGameStore((s) => s.lastAction);
  useEffect(() => {
    if (!lastAction?.done) return;
    playSfx(sfxFor(lastAction.request, biome));
    view?.actionFx(lastAction.request.type, lastAction.request.plotId);
  }, [lastAction, view, biome]);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.code === 'Space' ? 'E' : e.code.startsWith('Digit') ? e.code.slice(5) : e.code.replace('Key', '');
      if (key === 'E' && readable) {
        e.preventDefault();
        return openJournal(readable === 'lectern' ? undefined : readable.turn);
      }
      const option = options.find((o) => o.key === key);
      if (option) {
        e.preventDefault();
        return act(option.request);
      }
      const slot = Number(key);
      if (slot >= 1 && slot <= HOTBAR.length) {
        e.preventDefault();
        return hotbar(HOTBAR[slot - 1]!, options, nearby, act, openFastTrack);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, readable, options, nearby, act, openJournal, openFastTrack]);

  useEffect(() => {
    // Check the live clock: on the first render after a finished turn, `timeUp` can still be the old turn's.
    if (!timeUp || step !== 'play' || !isTimeUp(useGameStore.getState())) return;
    setJournalOpen(false);
    closeFastTrack();
    setStep('freeze');
  }, [timeUp, step, setJournalOpen, closeFastTrack]);
  useEffect(() => {
    if (step !== 'freeze') return;
    const id = setTimeout(() => setStep('write'), FREEZE_MS);
    return () => clearTimeout(id);
  }, [step]);

  // Saving runs alongside the stone; the last card waits for both.
  const sealed = useRef<SealedTurn | null>(null);
  const [saving, setSaving] = useState<{ state: 'saving' | 'saved' } | { state: 'failed'; error: string }>({ state: 'saved' });
  const trySave = useCallback(() => {
    const turn = sealed.current;
    if (!turn) return;
    setSaving({ state: 'saving' });
    save(turn).then(
      () => setSaving({ state: 'saved' }),
      (e: unknown) => setSaving({ state: 'failed', error: e instanceof Error ? e.message : String(e) }),
    );
  }, [save]);

  const [summary, setSummary] = useState<CostSummaryView | null>(null);
  const onSeal = (page: SealedPage) => {
    // The engine ends the turn: crops left in the ground rot, upkeep is paid. Then it's saved.
    const ended = useGameStore.getState().finishTurn();
    if (!ended) return;
    const { log, transitions } = useGameStore.getState();
    sealed.current = { page, log, ended };
    trySave();
    setPages((p) => [...p, { turn: generation, authorUsername: author, ...page }]);
    setSummary(costSummary({ summary: ended.summary, log, transitions, after: ended.state, biome, actor: author }));
    setStep('summary');
  };
  const raise = () => {
    const stone = { turn: generation, username: author };
    setStep('stone');
    if (!view) return setStep('over');
    void view.raiseStone(stone).then(() => {
      setStones((s) => [...s, stone]);
      setStep('over');
    });
  };

  const rows: PromptRow[] = readable
    ? [{ keyLabel: 'E', text: readable === 'lectern' ? 'Read the journal' : `Read ${readable.username}'s page` }]
    : options.map((o) => ({ keyLabel: o.key, text: o.label, cost: o.cost, error: o.error }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#101418' }}>
      <PixiStage map={map} look={look} onReady={setView} />
      <div style={{ position: 'absolute', top: 12, left: 12 }}>
        <Hud />
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <Clock />
        {onLeave && step === 'play' && (
          <Button size="sm" variant="quiet" icon="left" onClick={() => setLeaving(true)}>
            Home
          </Button>
        )}
        {/* TODO(B): testing only, remove before the demo. Jumps the clock to 6 am. */}
        {playing && (
          <Button size="sm" onClick={() => useGameStore.setState((s) => ({ t: s.turnSeconds }))}>
            End turn (test)
          </Button>
        )}
      </div>
      {step === 'play' && (
        <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {playing && rows.length > 0 && <InteractPrompt rows={rows} />}
          <ActionError />
          {vis && <Hotbar biome={vis.biome} options={options} />}
        </div>
      )}
      {onLeave && (
        <Dialog
          open={leaving}
          title="Leave this day?"
          onClose={() => setLeaving(false)}
          actions={
            <>
              <Button variant="primary" onClick={() => setLeaving(false)} autoFocus>
                Stay
              </Button>
              <Button onClick={onLeave}>Home</Button>
            </>
          }
        >
          <p>Nothing from this day is kept.</p>
        </Dialog>
      )}
      {!journalOpen && <StoneLabel />}
      {fastTrack && vis && step === 'play' && (
        <FastTrackMenu
          view={vis}
          focusPlot={fastTrack.plotId}
          check={(effectId) => check({ type: 'fastTrack', targetEffectId: effectId })}
          onPick={(o) => {
            closeFastTrack();
            act({ type: 'fastTrack', targetEffectId: o.effectId });
          }}
          onClose={closeFastTrack}
        />
      )}
      {journalOpen && step === 'play' && (
        // Reading the journal stops the clock (decision 012).
        <JournalModal
          mode="read"
          pages={pages}
          generation={generation}
          author={author}
          openAt={journalPage ?? undefined}
          onClose={() => setJournalOpen(false)}
        />
      )}
      {step === 'freeze' && <EndCard text="The day is over." />}
      {step === 'write' && <JournalModal mode="write" pages={pages} generation={generation} author={author} onSeal={onSeal} />}
      {step === 'summary' && summary && <CostSummary view={summary} onContinue={raise} />}
      {step === 'over' && saving.state === 'saving' && <EndCard text="Saving your page…" />}
      {step === 'over' && saving.state === 'failed' && (
        <EndCard text={`Your page wasn't saved. ${saving.error}`} actions={[{ label: 'Try again', onClick: trySave }]} />
      )}
      {step === 'over' && saving.state === 'saved' && <EndCard text={`Generation ${generation} is over.`} actions={endActions} />}
      {showFps && view && <FpsReadout view={view} />}
    </div>
  );
}

/**
 * A hotbar key: the matching action at this plot if there is one, the Fast Track menu for 8,
 * otherwise the action anyway so the engine says why not.
 */
function hotbar(
  type: ActionRequest['type'],
  options: ActionOption[],
  nearby: string | null,
  act: (r: ActionRequest) => void,
  openFastTrack: (plotId?: string | null) => void,
) {
  if (type === 'fastTrack') return openFastTrack(nearby);
  const here = options.find((o) => o.request.type === type);
  act(here ? here.request : nearby ? { type, plotId: nearby } : { type });
}

function sfxFor(request: ActionRequest, biome: Biome): SfxName {
  if (request.type === 'fishHunt') return `fishHunt-${biome}`;
  // No sounds of their own yet: a splash for watering, the well's for filling the can, the harvest's for a meal.
  if (request.type === 'water') return 'fishHunt-island';
  if (request.type === 'fillCan') return 'digWell';
  if (request.type === 'eat' || request.type === 'take') return 'harvest';
  return request.type;
}

/** The parts of the view the renderer draws, as a string that only changes when one does. */
function lookSignature(v: VisibleWorld | null): string {
  if (!v) return '';
  const plots = Object.values(v.plots).map((p) => `${p.id}:${p.stage ?? ''}`).join(',');
  return `${plots}|${v.store}|${+v.weakened}${+v.drought}${+v.hungry}`;
}

function FpsReadout({ view }: { view: WorldView }) {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFps(view.fps()), 500);
    return () => clearInterval(id);
  }, [view]);
  return (
    <div style={{ position: 'absolute', bottom: 12, left: 12, padding: '2px 6px', background: '#1f2027', color: '#fefadb', font: '12px monospace' }}>
      {fps.toFixed(0)} fps
    </div>
  );
}
