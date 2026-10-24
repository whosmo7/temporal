import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Gravestone, JournalPage } from '../../api/Backend';
import { playMusic, playSfx, stopMusic, type SfxName } from '../../audio/sound';
import { beginTurn, CONFIG, createWorld, endTurn, type Transition, type VisibleWorld, type WorldState } from '../../engine';
import { gameHour, isNight } from '../../render/daylight';
import { PixiStage } from '../../render/PixiStage';
import { founderLook, type WorldLook, type WorldView } from '../../render/world-view';
import { isTimeUp, useGameStore, type ActionRequest } from '../../store/game';
import { generateMap, isPresetName, type Biome, type PresetName, type TileMap } from '../../worldgen';
import { plotOptions, type ActionOption } from '../hud/actionOptions';
import { ActionError } from '../hud/ActionError';
import { Clock } from '../hud/Clock';
import { HOTBAR } from '../hud/copy';
import { EndCard } from '../hud/EndCard';
import { FastTrackMenu } from '../hud/FastTrackMenu';
import { Hotbar } from '../hud/Hotbar';
import { Hud } from '../hud/Hud';
import { InteractPrompt, type PromptRow } from '../hud/InteractPrompt';
import { StoneLabel } from '../hud/StoneLabel';
import { JournalModal, type SealedPage } from '../journal';
import { CostSummary } from '../summary/CostSummary';
import { costSummary, type CostSummaryView } from '../summary/summaryView';

/** End of turn (05): freeze → write your page → what you gave → your stone rises → done. */
type EndStep = 'play' | 'freeze' | 'write' | 'summary' | 'stone' | 'over';
/** How long "The day is over." shows before the journal opens. */
const FREEZE_MS = 2200;

/**
 * Local hot-seat world on the real engine: `#/play?seed=123&biome=island&preset=small`. Continue
 * after your stone rises hands the same world to the next generation. Once the Backend exists
 * (`07`, `08`), the world, pages and stones come from the claimed turn instead. Dev params:
 * `turn=60` shortens the turn to 60 s, `fps=1` shows the frame rate, `name=JO` is you,
 * `graves=AL,MO,KE` plays that many idle generations first (their stones and pages too), and
 * `look=healthy|neglected` swaps the engine's look for a fixed preview.
 */
export function PlayScreen() {
  const [params] = useSearchParams();
  const seed = Number(params.get('seed') ?? 123);
  const biome: Biome = params.get('biome') === 'island' ? 'island' : 'forest';
  const presetParam = params.get('preset') ?? 'default';
  const preset = isPresetName(presetParam) ? presetParam : 'default';
  const lookParam = params.get('look');
  const turnSeconds = Number(params.get('turn') ?? CONFIG.turnSeconds);
  const showFps = params.get('fps') === '1';
  const author = params.get('name') ?? 'Player';
  const gravesParam = params.get('graves') ?? '';

  const map = useMemo(() => generateMap(seed, biome, preset), [seed, biome, preset]);
  const [view, setView] = useState<WorldView | null>(null);
  // Until the play flow (08) claims a real world, the world, journal and graveyard are local.
  const start = useMemo(
    () => localWorld({ seed, biome, preset, turnSeconds }, gravesParam),
    [seed, biome, preset, turnSeconds, gravesParam],
  );
  const [pages, setPages] = useState<JournalPage[]>(start.pages);
  const [stones, setStones] = useState<Gravestone[]>(start.stones);
  const [step, setStep] = useState<EndStep>('play');
  const loadTurn = useGameStore((s) => s.loadTurn);
  useEffect(() => {
    setPages(start.pages);
    setStones(start.stones);
    loadTurn(start.world, author, start.begun);
    setStep('play');
  }, [start, author, loadTurn]);
  useEffect(() => view?.setStones(stones), [view, stones]);

  // What the world looks like comes from visibleView(); re-texture only when a stage or flag changes.
  const lookKey = useGameStore((s) => lookSignature(s.view));
  const look = useMemo(() => {
    const preview = previewLook(map, lookParam);
    if (preview) return preview;
    const visible = useGameStore.getState().view;
    return visible ? toLook(map, visible) : founderLook(map);
    // lookKey stands in for the parts of the view the look depends on.
  }, [map, lookParam, lookKey]);

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
  const options = useMemo(() => {
    const plot = nearby ? map.plots.find((p) => p.id === nearby) : undefined;
    return vis && plot && playing ? plotOptions(vis, plot, check) : [];
  }, [vis, nearby, map, playing, check]);

  const act = useCallback(
    (request: ActionRequest) => {
      const s = useGameStore.getState();
      if (s.t < s.busyUntil) return; // still working on the last one
      const r = s.act(request);
      if (r.error) return playSfx('deny');
      playSfx(sfxFor(request, biome));
      view?.actionFx(request.type, request.plotId);
    },
    [view, biome],
  );

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
    if (!timeUp || step !== 'play') return;
    setJournalOpen(false);
    closeFastTrack();
    setStep('freeze');
  }, [timeUp, step, setJournalOpen, closeFastTrack]);
  useEffect(() => {
    if (step !== 'freeze') return;
    const id = setTimeout(() => setStep('write'), FREEZE_MS);
    return () => clearTimeout(id);
  }, [step]);

  const [summary, setSummary] = useState<CostSummaryView | null>(null);
  const [sealedStone, setSealedStone] = useState<Gravestone | null>(null);
  const onSeal = (page: SealedPage) => {
    // The engine ends the turn: crops left in the ground rot, upkeep is paid.
    // TODO(07): commit the turn (log, transitions, page) here.
    const ended = useGameStore.getState().finishTurn();
    const { log, transitions } = useGameStore.getState();
    setPages((p) => [...p, { turn: generation, authorUsername: author, ...page }]);
    setSealedStone({ turn: generation, username: author });
    if (!ended) return raise({ turn: generation, username: author });
    setSummary(costSummary({ summary: ended.summary, log, transitions, after: ended.state, biome, actor: author }));
    setStep('summary');
  };
  const raise = (stone: Gravestone) => {
    setStep('stone');
    if (!view) return setStep('over');
    void view.raiseStone(stone).then(() => {
      setStones((s) => [...s, stone]);
      setStep('over');
    });
  };

  const navigate = useNavigate();
  const world = useGameStore((s) => s.world);
  const lastGeneration = !world || world.turn > world.generationCount;
  const onContinue = () => {
    // Hot-seat: the next generation inherits this world as it was left.
    if (lastGeneration || !world) return navigate('/');
    const next = beginTurn(world);
    loadTurn(next.state, author, next.transitions);
    view?.newTurn();
    setStep('play');
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
      <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <Clock />
      </div>
      {step === 'play' && (
        <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {playing && rows.length > 0 && <InteractPrompt rows={rows} />}
          <ActionError />
          {vis && <Hotbar biome={vis.biome} options={options} />}
        </div>
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
      {step === 'summary' && summary && sealedStone && <CostSummary view={summary} onContinue={() => raise(sealedStone)} />}
      {step === 'over' && <EndCard text={`Generation ${generation} is over.`} action="Continue" onAction={onContinue} />}
      {showFps && view && <FpsReadout view={view} />}
    </div>
  );
}

/**
 * A hotbar key: the matching action at this plot if there is one (harvest stores rather than
 * eats), the Fast Track menu for 8, otherwise the action anyway so the engine says why not.
 */
function hotbar(
  type: ActionRequest['type'],
  options: ActionOption[],
  nearby: string | null,
  act: (r: ActionRequest) => void,
  openFastTrack: (plotId?: string | null) => void,
) {
  if (type === 'fastTrack') return openFastTrack(nearby);
  const here = options.find((o) => o.request.type === type && !o.request.eat);
  act(here ? here.request : nearby ? { type, plotId: nearby } : { type });
}

function sfxFor(request: ActionRequest, biome: Biome): SfxName {
  return request.type === 'fishHunt' ? `fishHunt-${biome}` : request.type;
}

/** The parts of the view the renderer draws, as a string that only changes when one does. */
function lookSignature(v: VisibleWorld | null): string {
  if (!v) return '';
  const plots = Object.values(v.plots).map((p) => `${p.id}:${p.stage ?? ''}`).join(',');
  return `${plots}|${v.store}|${+v.weakened}${+v.drought}${+v.hungry}`;
}

function toLook(map: TileMap, v: VisibleWorld): WorldLook {
  const base = founderLook(map);
  return {
    plots: Object.fromEntries(map.plots.map((p) => [p.id, v.plots[p.id]?.stage ?? base.plots[p.id]!])),
    store: v.store,
    weakened: v.weakened,
    drought: v.drought,
    hungry: v.hungry,
  };
}

/**
 * Dev hot-seat world: a fresh engine world, plus one idle generation (no actions) per name in
 * `graves=AL,MO,KE`, so the graveyard, journal and world all agree on who came before.
 */
function localWorld(
  opts: { seed: number; biome: Biome; preset: PresetName; turnSeconds: number },
  graves: string,
): { world: WorldState; begun: Transition[]; stones: Gravestone[]; pages: JournalPage[] } {
  const players = graves.split(',').map((n) => n.trim()).filter(Boolean);
  let world = createWorld(opts.seed, {
    worldId: `local-${opts.seed}`,
    biome: opts.biome,
    preset: opts.preset,
    turnSeconds: opts.turnSeconds,
    generationCount: Math.max(CONFIG.generationCount, players.length + 1),
  }).state;
  for (let i = 0; i < players.length; i++) world = endTurn(beginTurn(world).state).state;
  const begun = beginTurn(world);
  return {
    world: begun.state,
    begun: begun.transitions,
    stones: players.map((username, i) => ({ turn: i + 1, username })),
    pages: players.map((authorUsername, i) => ({ turn: i + 1, authorUsername, text: `(Dev preview: ${authorUsername}'s page.)`, drawing: [] })),
  };
}

/** Dev previews of a thriving and a neglected world (`look=`), in place of the engine's look. */
function previewLook(map: TileMap, name: string | null): WorldLook | null {
  if (name !== 'healthy' && name !== 'neglected') return null;
  const base = founderLook(map);
  const healthy = name === 'healthy';
  const stage: Record<string, string> = healthy
    ? { field: 'ripe', orchard: 'fruiting', reservoir: 'full', well: 'clear', wild: 'many' }
    : { field: 'rotten', orchard: 'dead', reservoir: 'cracked', well: 'stagnant', wild: 'none' };
  return {
    plots: Object.fromEntries(map.plots.map((p) => [p.id, stage[p.kind] ?? base.plots[p.id]!])),
    store: healthy ? 'full' : 'rotting',
    weakened: !healthy,
    drought: !healthy,
    hungry: !healthy,
  };
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
