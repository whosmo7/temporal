import { useSyncExternalStore } from 'react';
import { isMuted, setMuted, subscribeMuted } from '../../audio/sound';
import { Button } from '../kit';

/** Sound on/off, remembered across visits (`08`). */
export function MuteToggle() {
  const muted = useSyncExternalStore(subscribeMuted, isMuted);
  return (
    <Button size="sm" variant="quiet" icon={muted ? 'muted' : 'sound'} iconOnly aria-pressed={muted} onClick={() => setMuted(!muted)}>
      {muted ? 'Sound off' : 'Sound on'}
    </Button>
  );
}
