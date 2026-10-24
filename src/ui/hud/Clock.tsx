import { clockLabel, gameHour, isNight } from '../../render/daylight';
import { useGameStore } from '../../store/game';
import { Panel, PixelBitmap } from '../kit';
import { palette } from '../theme/palette';

const SUN = [
  '.....s.....',
  '..s..s..s..',
  '...sssss...',
  '..sssssss..',
  'ssssssssss.',
  '..sssssss..',
  '...sssss...',
  '..s..s..s..',
  '.....s.....',
];
const MOON = [
  '...mmmm....',
  '..mmm......',
  '.mmm.......',
  '.mmm.......',
  '.mmm.......',
  '.mmmm......',
  '..mmmmm.mm.',
  '...mmmmmm..',
  '...........',
];

/**
 * Top-right clock: the in-game time of day (a turn runs 6 am to 6 am, decision 012) with a sun or
 * moon. Re-renders only when the label changes (every 10 in-game minutes).
 */
export function Clock() {
  const hour = useGameStore((s) => Math.floor(gameHour(s.t, s.turnSeconds) * 6) / 6);
  const night = isNight(hour);
  return (
    <Panel style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px' }} aria-label="Time of day">
      <PixelBitmap rows={night ? MOON : SUN} inks={night ? { m: palette.paper } : { s: palette.stamina }} scale={2} />
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 16, minWidth: '5.5em', textAlign: 'right' }}>{clockLabel(hour)}</span>
    </Panel>
  );
}
