import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { backend, type ClaimedWorld, type CommitInput } from '../../api';
import { useGameStore } from '../../store/game';
import { useSession } from '../../store/session';
import { generateMap, type TileMap } from '../../worldgen';
import { Button, Panel } from '../kit';
import { SkyBackdrop } from '../shell/SkyBackdrop';
import { Game, type SealedTurn, type TurnStart } from './Game';
import { Inheriting } from './Inheriting';
import { clearUnsaved, keepUnsaved, loadUnsaved, turnStart } from './turnStart';

type Phase =
  | { kind: 'loading' }
  /** A page sealed last time never reached the backend. */
  | { kind: 'unsaved'; input: CommitInput; error: string }
  | { kind: 'claimFailed'; error: string }
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
  const claim = useCallback(() => (running.current ??= next().finally(() => (running.current = null))), []);
  async function next() {
    setPhase({ kind: 'loading' });
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
      const claimed = await backend.claimWorld();
      const map = generateMap(claimed.seed, claimed.biome, claimed.preset);
      setPhase({ kind: 'inheriting', claim: claimed, map, start: turnStart(claimed) });
    } catch (e) {
      setPhase({ kind: 'claimFailed', error: message(e) });
    }
  }
  useEffect(() => void claim(), [claim]);

  const worldId = phase.kind === 'playing' ? phase.claim.worldId : null;
  const save = useCallback(
    async ({ page, log }: SealedTurn) => {
      if (!worldId) throw new Error('No world');
      const input: CommitInput = { worldId, actions: log, journal: page };
      keepUnsaved(input);
      await backend.commitTurn(input);
      clearUnsaved();
    },
    [worldId],
  );
  const endActions = useMemo(
    () => [
      { label: 'Play another', onClick: () => void claim() },
      { label: 'Home', onClick: () => navigate('/') },
    ],
    [claim, navigate],
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
