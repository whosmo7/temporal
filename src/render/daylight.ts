// In-game time and light (decision 012). A turn is one day, 6 am to 6 am, whatever turnSeconds is.

/** Hour the turn starts at. */
export const DAY_START_HOUR = 6;

/** In-game hour (6 ≤ h < 30, so 2 am is 26) for `t` seconds into a turn of `turnSeconds`. */
export function gameHour(t: number, turnSeconds: number): number {
  const f = turnSeconds > 0 ? Math.min(1, Math.max(0, t / turnSeconds)) : 0;
  return DAY_START_HOUR + f * 24;
}

/** "6:00 AM", "12:30 PM", in 10-minute steps so the clock ticks like a game clock. */
export function clockLabel(hour: number): string {
  const totalMinutes = Math.floor((hour * 60) / 10) * 10;
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

export interface Light {
  /** Multiply tint over the world (0xffffff = none). */
  tint: number;
  /** How dark it is away from the player's light, 0..1. */
  darkness: number;
  /** Colour of the darkness. */
  shade: number;
}

/**
 * Light keyframes by hour, from the art direction: bright day, peach dusk, plum night, rose dawn.
 * Hours run 6..30 so the night doesn't wrap.
 */
const KEYS: [hour: number, light: Light][] = [
  [6, { tint: 0xffd9c4, darkness: 0.25, shade: 0x404363 }], // dawn
  [8, { tint: 0xffffff, darkness: 0, shade: 0x404363 }], // day
  [17, { tint: 0xffffff, darkness: 0, shade: 0x404363 }],
  [19, { tint: 0xffc19d, darkness: 0.2, shade: 0x6f4e4c }], // dusk (peach)
  [21, { tint: 0xb8b2d6, darkness: 0.62, shade: 0x404363 }], // night (plum)
  [28.5, { tint: 0xb8b2d6, darkness: 0.62, shade: 0x404363 }],
  [30, { tint: 0xffd9c4, darkness: 0.25, shade: 0x404363 }], // dawn again
];

export function lightAt(hour: number): Light {
  const h = Math.min(30, Math.max(6, hour));
  for (let i = 1; i < KEYS.length; i++) {
    const [h1, b] = KEYS[i]!;
    if (h <= h1) {
      const [h0, a] = KEYS[i - 1]!;
      const f = h1 === h0 ? 1 : (h - h0) / (h1 - h0);
      return { tint: mixColour(a.tint, b.tint, f), darkness: a.darkness + (b.darkness - a.darkness) * f, shade: mixColour(a.shade, b.shade, f) };
    }
  }
  return KEYS[KEYS.length - 1]![1];
}

/** True from 7 pm until 6 am (hour 30): the clock shows a moon. Time-up at 6 am is dawn, so a sun. */
export function isNight(hour: number): boolean {
  return hour >= 19 && hour < 30;
}

function mixColour(a: number, b: number, f: number): number {
  const ch = (c: number, s: number) => (c >> s) & 0xff;
  const mix = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * f);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}
