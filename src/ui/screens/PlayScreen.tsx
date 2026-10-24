import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Gravestone, JournalPage } from '../../api/Backend';
import { playMusic, stopMusic } from '../../audio/sound';
import { CONFIG } from '../../engine/config';
import { gameHour, isNight } from '../../render/daylight';
import { PixiStage } from '../../render/PixiStage';
import { founderLook, type WorldLook, type WorldView } from '../../render/world-view';
import { isTimeUp, useGameStore } from '../../store/game';
import { generateMap, isPresetName, type Biome, type TileMap } from '../../worldgen';
import { Clock } from '../hud/Clock';
import { EndCard } from '../hud/EndCard';
import { InteractPrompt } from '../hud/InteractPrompt';
import { StoneLabel } from '../hud/StoneLabel';
import { JournalModal, type SealedPage } from '../journal';

/** End of turn (05): freeze → write your page → your stone rises → done. Cost summary (C) slots in after `write`. */
type EndStep = 'play' | 'freeze' | 'write' | 'stone' | 'over';
/** How long "The day is over." shows before the journal opens. */
const FREEZE_MS = 2200;

/**
 * Local hot-seat world for now: `#/play?seed=123&biome=island&preset=small`. Once the engine and
 * Backend exist (`02`, `07`, `08`), this gets its world, journal pages and look from the claimed
 * turn and `visibleView()`. Dev params: `look=healthy|neglected` previews world states,
 * `turn=60` shortens the turn to 60 s, `fps=1` shows the frame rate, `graves=AL,MO,KE` fills the
 * graveyard with earlier players (and their pages), `name=JO` is you.
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
  const look = useMemo(() => previewLook(map, lookParam), [map, lookParam]);
  const [view, setView] = useState<WorldView | null>(null);
  // Until the play flow (08) claims a real world, the journal and graveyard are local.
  const earlier = useMemo(() => previewHistory(gravesParam), [gravesParam]);
  const [pages, setPages] = useState<JournalPage[]>(earlier.pages);
  const [stones, setStones] = useState<Gravestone[]>(earlier.stones);
  useEffect(() => {
    setPages(earlier.pages);
    setStones(earlier.stones);
  }, [earlier]);
  const generation = earlier.stones.length + 1;
  useEffect(() => view?.setStones(stones), [view, stones]);

  const startTurn = useGameStore((s) => s.startTurn);
  const nearby = useGameStore((s) => s.nearby);
  const nearbyStone = useGameStore((s) => s.nearbyStone);
  const journalOpen = useGameStore((s) => s.journalOpen);
  const journalPage = useGameStore((s) => s.journalPage);
  const openJournal = useGameStore((s) => s.openJournal);
  const setJournalOpen = useGameStore((s) => s.setJournalOpen);
  const timeUp = useGameStore(isTimeUp);
  const [step, setStep] = useState<EndStep>('play');

  // Music: the day loop, crossfading to the dusk loop from 7 pm (decisions 012, 015).
  const night = useGameStore((s) => isNight(gameHour(s.t, s.turnSeconds)));
  useEffect(() => playMusic(night ? 'dusk' : 'day'), [night]);
  useEffect(() => () => stopMusic(), []);
  useEffect(() => {
    startTurn(turnSeconds);
    setStep('play');
  }, [map, turnSeconds, startTurn]);

  // The lectern opens the latest page; at the graveyard, E reads the nearest stone's page.
  const readable = step !== 'play' ? null : nearby === 'lectern' ? 'lectern' : nearby === 'graveyard' && nearbyStone ? nearbyStone : null;
  useEffect(() => {
    if (!readable || journalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' || e.code === 'Space') {
        e.preventDefault();
        openJournal(readable === 'lectern' ? undefined : readable.turn);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readable, journalOpen, openJournal]);

  useEffect(() => {
    if (!timeUp || step !== 'play') return;
    setJournalOpen(false);
    setStep('freeze');
  }, [timeUp, step, setJournalOpen]);
  useEffect(() => {
    if (step !== 'freeze') return;
    const id = setTimeout(() => setStep('write'), FREEZE_MS);
    return () => clearTimeout(id);
  }, [step]);

  const navigate = useNavigate();
  const onSeal = (page: SealedPage) => {
    // TODO(07): commit the turn here; TODO(C, 05): the cost summary goes between the seal and the stone.
    const stone = { turn: generation, username: author };
    setPages((p) => [...p, { turn: generation, authorUsername: author, ...page }]);
    setStep('stone');
    if (!view) return setStep('over');
    void view.raiseStone(stone).then(() => {
      setStones((s) => [...s, stone]);
      setStep('over');
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#101418' }}>
      <PixiStage map={map} look={look} onReady={setView} />
      <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <Clock />
      </div>
      {readable && !journalOpen && (
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)' }}>
          <InteractPrompt keyLabel="E" text={readable === 'lectern' ? 'Read the journal' : `Read ${readable.username}'s page`} />
        </div>
      )}
      {!journalOpen && <StoneLabel />}
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
      {step === 'over' && <EndCard text={`Generation ${generation} is over.`} action="Continue" onAction={() => navigate('/')} />}
      {showFps && view && <FpsReadout view={view} />}
    </div>
  );
}

/** Dev: earlier players for the graveyard and the journal, from `graves=AL,MO,KE`. */
function previewHistory(names: string): { stones: Gravestone[]; pages: JournalPage[] } {
  const players = names.split(',').map((n) => n.trim()).filter(Boolean);
  return {
    stones: players.map((username, i) => ({ turn: i + 1, username })),
    pages: players.map((authorUsername, i) => ({ turn: i + 1, authorUsername, text: `(Dev preview: ${authorUsername}'s page.)`, drawing: [] })),
  };
}

/** Dev previews of a thriving and a neglected world, until visibleView() drives the look. */
function previewLook(map: TileMap, name: string | null): WorldLook {
  const base = founderLook(map);
  if (name !== 'healthy' && name !== 'neglected') return base;
  const healthy = name === 'healthy';
  const stage: Record<string, string> = healthy
    ? { field: 'ripe', orchard: 'fruiting', reservoir: 'full', well: 'clear', wild: 'many' }
    : { field: 'rotten', orchard: 'dead', reservoir: 'cracked', well: 'stagnant', wild: 'none' };
  return {
    plots: Object.fromEntries(map.plots.map((p) => [p.id, stage[p.kind] ?? base.plots[p.id]!])),
    store: healthy ? 'full' : 'rotting',
    weakened: !healthy,
    drought: !healthy,
  };
}

function FpsReadout({ view }: { view: WorldView }) {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFps(view.fps()), 500);
    return () => clearInterval(id);
  }, [view]);
  return (
    <div style={{ position: 'absolute', top: 12, left: 12, padding: '2px 6px', background: '#1f2027', color: '#fefadb', font: '12px monospace' }}>
      {fps.toFixed(0)} fps
    </div>
  );
}
