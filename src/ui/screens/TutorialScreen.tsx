import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ActionType } from '../../engine';
import { beginTurn, createWorld, endTurn } from '../../engine';
import { isTimeUp, useGameStore } from '../../store/game';
import { generateMap } from '../../worldgen';
import { Button, Panel } from '../kit';
import { Game, type TurnStart } from '../play/Game';
import { currentStep, markTutorialSeen, STEPS, UPKEEP_TEXT } from '../tutorial/steps';

/** A fixed forest world, so every tutorial is the same. */
const SEED = 123;
/** A short day: crops ripen in a quarter of it (decision 027), so about a minute after watering. */
const TURN_SECONDS = 240;
const BEFORE = 'Wren';
const BEFORE_PAGE = 'Reservoir wall is cracked but it still holds some. Sow, then water, or nothing comes up.';

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * `#/tutorial` (08): the real game on a fixed world, one hint at a time. No account needed and
 * nothing is saved. Shown before a first Play (decision 029) and linked from the landing page;
 * Skip is always there. `?then=play` goes on to Play afterwards, otherwise home.
 */
export function TutorialScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const then = params.get('then') === 'play' ? '/play' : '/';
  const leave = useCallback(
    (to: string) => {
      markTutorialSeen();
      navigate(to, { replace: true });
    },
    [navigate],
  );

  const map = useMemo(() => generateMap(SEED, 'forest'), []);
  const start = useMemo(tutorialWorld, []);
  const save = useCallback(async () => {}, []);
  const endActions = useMemo(() => [{ label: 'Play', onClick: () => leave('/play') }], [leave]);

  // What the player has done, from the game's own state.
  const [moved, setMoved] = useState(false);
  const [readJournal, setReadJournal] = useState(false);
  const [atGraveyard, setAtGraveyard] = useState(false);
  const log = useGameStore((s) => s.log);
  const journalOpen = useGameStore((s) => s.journalOpen);
  const nearby = useGameStore((s) => s.nearby);
  // If the day runs out first, the game's own end of day takes over (its last card offers Play).
  const over = useGameStore(isTimeUp);
  const did = useMemo(() => new Set<ActionType>(log.map((a) => a.type)), [log]);
  if (journalOpen && !readJournal) setReadJournal(true);
  if (nearby === 'graveyard' && !atGraveyard) setAtGraveyard(true);
  useEffect(() => {
    if (moved) return;
    const onKey = (e: KeyboardEvent) => MOVE_KEYS.has(e.code) && setMoved(true);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moved]);

  const at = currentStep({ moved, did, readJournal, atGraveyard });
  const done = at === STEPS.length;

  return (
    <>
      <Game map={map} start={start} author="You" save={save} endActions={endActions} />
      {!journalOpen && !over && (
        <div className="tutorial">
          <Panel title={done ? 'That’s the day' : `${at + 1} of ${STEPS.length}`} className="tutorial__card" aria-live="polite">
            <p>{done ? UPKEEP_TEXT : STEPS[at]!.text}</p>
            <div className="tutorial__actions">
              {done ? (
                <Button variant="primary" icon="right" onClick={() => leave('/play')} autoFocus>
                  Play
                </Button>
              ) : (
                <Button size="sm" variant="quiet" onClick={() => leave(then)}>
                  Skip
                </Button>
              )}
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}

/**
 * The tutorial world after one quiet generation, so the journal and the graveyard each have
 * someone in them. The player starts with the founder's stores, not what a night left of them.
 */
function tutorialWorld(): TurnStart {
  const founder = beginTurn(createWorld(SEED, { worldId: 'tutorial', biome: 'forest', turnSeconds: TURN_SECONDS, generationCount: 2 }).state);
  const begun = beginTurn(endTurn(founder.state).state);
  return {
    world: { ...begun.state, resources: founder.state.resources, weakened: 0 },
    begun: begun.transitions,
    pages: [{ turn: 1, authorUsername: BEFORE, text: BEFORE_PAGE, drawing: [] }],
    stones: [{ turn: 1, username: BEFORE }],
  };
}
