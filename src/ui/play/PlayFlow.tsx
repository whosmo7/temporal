import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { backend, type ClaimedWorld, type CommitInput } from '../../api';
import { isTimeUp, useGameStore } from '../../store/game';
import { useSession } from '../../store/session';
import { generateMap, type TileMap } from '../../worldgen';
import { Button, Panel } from '../kit';
import { SkyBackdrop } from '../shell/SkyBackdrop';
import { Game, type SealedTurn, type TurnStart } from './Game';
import { useHeartbeat } from './heartbeat';
import { Inheriting } from './Inheriting';
import { clearUnsaved, keepUnsaved, loadUnsaved, turnStart } from './turnStart';

/** The world just played, to claim back for its next generation (testing). */
interface Again {
  worldId: string;
  turn: number;
}

type Phase =
  | { kind: 'loading' }
  /** A page sealed last time never reached the backend. */
  | { kind: 'unsaved'; input: CommitInput; error: string }
  | { kind: 'claimFailed'; error: string }
  /** The lock ran out while the clock was stopped (a long read): the turn is gone. */
  | { kind: 'voided' }
  | { kind: 'inheriting' | 'playing'; claim: ClaimedWorld; map: TileMap; start: TurnStart };

/**
 * The play flow (08), for a signed-in player (the route guards it): claim a world → "You are
 * inheriting…" → the game → the turn is committed on the seal (decision 018) → back to the landing
 * page, or Play another. Refreshing mid-turn claims the same world again and starts the turn over.
 */
export function PlayFlow({ showFps }: { showFps: boolean }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const username = useSession((s) => s.user?.username ?? '');
  // Actions are logged under the profile id (ActionEntry.actorId); commit-turn stamps the same.
  const userId = useSession((s) => s.user?.id ?? '');
  const navigate = useNavigate();

  // One claim at a time (StrictMode runs the first effect twice; a double resend would fail).
  const running = useRef<Promise<void> | null>(null);
  const claim = useCallback(
    (again?: Again) => (running.current ??= next(again).finally(() => (running.current = null))),
    [],
  );
  /** `again`: claim this world back for its next generation, and check that's what came. */
  async function next(again?: Again) {
    setPhase({ kind: 'loading' });
    saving.current = 'idle';
    setSaved(false);
    try {
      const unsaved = loadUnsaved();
      if (unsaved) {
        try {
          await backend.commitTurn(unsaved);
          clearUnsaved();
        } catch (e) {
          return setPhase({ kind: 'unsaved', input: unsaved, error: message(e) });
        }
      }
      // TODO(B): testing only, remove before the demo. The admin API hands the world back:
      // claim_world otherwise steers a player away from the world they just played.
      if (again) await backend.forceAssign(again.worldId, username);
      const claimed = await backend.claimWorld();
      if (again && (claimed.worldId !== again.worldId || claimed.turn !== again.turn + 1)) {
        return setPhase({ kind: 'claimFailed', error: `Got generation ${claimed.turn} of another world back, not the one you played.` });
      }
      const map = generateMap(claimed.seed, claimed.biome, claimed.preset);
      setPhase({ kind: 'inheriting', claim: claimed, map, start: turnStart(claimed) });
    } catch (e) {
      const error = message(e);
      setPhase({ kind: 'claimFailed', error: again && error === 'Not allowed' ? 'Only an admin can play the same world again.' : error });
    }
  }
  useEffect(() => void claim(), [claim]);

  const worldId = phase.kind === 'playing' ? phase.claim.worldId : null;
  // `saving` is read by the heartbeat, which must not take the lock the commit just released for a voided turn.
  const saving = useRef<'idle' | 'saving' | 'saved'>('idle');
  const [saved, setSaved] = useState(false);
  const save = useCallback(
    async ({ page, log }: SealedTurn) => {
      if (!worldId) throw new Error('No world');
      const input: CommitInput = { worldId, actions: log, journal: page };
      keepUnsaved(input);
      saving.current = 'saving';
      try {
        await backend.commitTurn(input);
      } catch (e) {
        saving.current = 'idle';
        throw e;
      }
      saving.current = 'saved';
      setSaved(true);
      clearUnsaved();
    },
    [worldId],
  );

  // While the clock is stopped (journal open, end of the day) real time still runs against the
  // lock, so keep it alive until the turn is saved.
  const clockStopped = useGameStore((s) => s.journalOpen || isTimeUp(s));
  useHeartbeat(worldId, clockStopped && !saved, () => {
    if (saving.current !== 'idle') return; // the commit decides
    clearUnsaved(); // it can never be committed now
    setPhase({ kind: 'voided' });
  });
  const played = phase.kind === 'playing' ? phase.claim : null;
  const endActions = useMemo(
    () => [
      // Testing only (see `next`): the same world again, as its next generation, while it has one.
      ...(played && played.turn < played.generationCount
        ? [{ label: 'Next generation here (test)', onClick: () => void claim({ worldId: played.worldId, turn: played.turn }) }]
        : []),
      { label: 'Play another', onClick: () => void claim() },
      { label: 'Home', onClick: () => navigate('/') },
    ],
    [played, claim, navigate],
  );

  if (phase.kind === 'playing') {
    const { claim: claimed, map, start } = phase;
    return (
      <Game
        key={`${claimed.worldId}:${claimed.turn}`}
        map={map}
        start={start}
        author={username}
        save={save}
        endActions={endActions}
        showFps={showFps}
      />
    );
  }

  return (
    <Backdrop>
      {phase.kind === 'loading' && <Panel>…</Panel>}
      {phase.kind === 'inheriting' && (
        <Inheriting
          claim={phase.claim}
          start={phase.start}
          onBegin={() => {
            // Load the turn before the game mounts, so its first render doesn't see the last turn's clock.
            useGameStore.getState().loadTurn(phase.start.world, userId, phase.start.begun);
            setPhase({ ...phase, kind: 'playing' });
          }}
        />
      )}
      {phase.kind === 'unsaved' && (
        <Notice
          title="Your last page wasn't saved"
          text={phase.error}
          actions={
            <>
              <Button variant="primary" onClick={() => void claim()} autoFocus>
                Try again
              </Button>
              <Button
                onClick={() => {
                  clearUnsaved();
                  void claim();
                }}
              >
                Let it go
              </Button>
            </>
          }
        />
      )}
      {phase.kind === 'voided' && (
        <Notice
          title="Your day ran out"
          text="You were away too long, and the world moved on without you. Nothing from this day was kept."
          actions={
            <>
              <Button variant="primary" onClick={() => void claim()} autoFocus>
                Play another
              </Button>
              <Button onClick={() => navigate('/')}>Home</Button>
            </>
          }
        />
      )}
      {phase.kind === 'claimFailed' && (
        <Notice
          title="Couldn't find you a world"
          text={phase.error}
          actions={
            <>
              <Button variant="primary" onClick={() => void claim()} autoFocus>
                Try again
              </Button>
              <Button onClick={() => navigate('/')}>Home</Button>
            </>
          }
        />
      )}
    </Backdrop>
  );
}

/** The shell's sky behind the cards before and between games. */
function Backdrop({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <SkyBackdrop />
      <main className="shell__main">{children}</main>
    </div>
  );
}

function Notice({ title, text, actions }: { title: string; text: string; actions: ReactNode }) {
  return (
    <Panel title={title} style={{ maxWidth: 420 }}>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 16, margin: '0 0 12px' }}>{text}</p>
      <div style={{ display: 'flex', gap: 12 }}>{actions}</div>
    </Panel>
  );
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
