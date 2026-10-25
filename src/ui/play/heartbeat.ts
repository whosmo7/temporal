import { useEffect, useRef } from 'react';
import { backend } from '../../api';

/** How often to extend the lock while the clock is stopped. The server caps how far it goes. */
export const HEARTBEAT_MS = 60_000;

/**
 * Beats now and then every `every` ms until stopped. `beat` resolves to the new lock expiry, or
 * null when the turn was already voided: then `onVoided` is called once and the beating stops.
 * A beat that fails (no network) is skipped; the next one tries again.
 */
export function startHeartbeat(
  beat: () => Promise<string | null>,
  onVoided: () => void,
  every = HEARTBEAT_MS,
): () => void {
  let stopped = false;
  const once = () => {
    beat().then(
      (expiry) => {
        if (stopped || expiry !== null) return;
        stop();
        onVoided();
      },
      () => {},
    );
  };
  const id = setInterval(once, every);
  const stop = () => {
    stopped = true;
    clearInterval(id);
  };
  once();
  return stop;
}

/**
 * Keeps the claimed world's lock alive while `active` (journal open or end-of-turn flow: the
 * clock is stopped but real time runs on). Without it a long read voids the turn (07).
 * `onVoided` runs if the backend says the turn is gone.
 */
export function useHeartbeat(worldId: string | null, active: boolean, onVoided: () => void): void {
  const latest = useRef(onVoided);
  latest.current = onVoided;
  useEffect(() => {
    if (!worldId || !active) return;
    return startHeartbeat(
      () => backend.heartbeat(worldId),
      () => latest.current(),
    );
  }, [worldId, active]);
}
