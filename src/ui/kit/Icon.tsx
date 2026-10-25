import { palette } from '../theme/palette';

/**
 * UI glyphs drawn on a 12-pixel grid. `#` is the current text colour, so one glyph works on ink
 * and on paper; letters pick a palette colour. Resource and action icons come from the Kyrise
 * atlas (`09`) instead; these cover the controls the pack doesn't (close, undo, eraser, clear, sound).
 */
const GLYPHS = {
  close: [
    '............',
    '.##......##.',
    '.###....###.',
    '..###..###..',
    '...######...',
    '....####....',
    '....####....',
    '...######...',
    '..###..###..',
    '.###....###.',
    '.##......##.',
    '............',
  ],
  undo: [
    '............',
    '...##.......',
    '..###.......',
    '.#########..',
    '.##########.',
    '..###....###',
    '...##.....##',
    '..........##',
    '.........###',
    '...#######..',
    '...######...',
    '............',
  ],
  eraser: [
    '............',
    '.......####.',
    '......#rrrr#',
    '.....#rrrr##',
    '....#rrrr##.',
    '...#pppp##..',
    '..#pppp##...',
    '.#pppp##....',
    '.#ppp##.....',
    '..####......',
    '............',
    '............',
  ],
  clear: [
    '............',
    '....####....',
    '.##########.',
    '.##########.',
    '..#......#..',
    '..#.#..#.#..',
    '..#.#..#.#..',
    '..#.#..#.#..',
    '..#.#..#.#..',
    '..#......#..',
    '..########..',
    '............',
  ],
  left: [
    '............',
    '......##....',
    '.....###....',
    '....###.....',
    '...###......',
    '..###.......',
    '..###.......',
    '...###......',
    '....###.....',
    '.....###....',
    '......##....',
    '............',
  ],
  right: [
    '............',
    '....##......',
    '....###.....',
    '.....###....',
    '......###...',
    '.......###..',
    '.......###..',
    '......###...',
    '.....###....',
    '....###.....',
    '....##......',
    '............',
  ],
  sound: [
    '............',
    '.....#......',
    '....##...#..',
    '...###....#.',
    '######..#.#.',
    '######...#.#',
    '######...#.#',
    '######..#.#.',
    '...###....#.',
    '....##...#..',
    '.....#......',
    '............',
  ],
  muted: [
    '............',
    '.....#......',
    '....##......',
    '...###......',
    '######.#...#',
    '######..#.#.',
    '######...#..',
    '######..#.#.',
    '...###.#...#',
    '....##......',
    '.....#......',
    '............',
  ],
  play: [
    '............',
    '...##.......',
    '...####.....',
    '...######...',
    '...########.',
    '...#########',
    '...#########',
    '...########.',
    '...######...',
    '...####.....',
    '...##.......',
    '............',
  ],
  pause: [
    '............',
    '............',
    '..###..###..',
    '..###..###..',
    '..###..###..',
    '..###..###..',
    '..###..###..',
    '..###..###..',
    '..###..###..',
    '..###..###..',
    '............',
    '............',
  ],
} as const;

export type IconName = keyof typeof GLYPHS;

const INKS: Record<string, string> = {
  '#': 'currentColor',
  r: palette.rose,
  p: palette.paper,
};

interface Run {
  x: number;
  y: number;
  w: number;
  fill: string;
}

// Merge each row into horizontal runs of one colour, so a glyph is a dozen rects, not 144.
function runs(rows: readonly string[], inks: Record<string, string> = INKS): Run[] {
  const out: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') {
        x += 1;
        continue;
      }
      let w = 1;
      while (row[x + w] === ch) w += 1;
      out.push({ x, y, w, fill: inks[ch] ?? 'currentColor' });
      x += w;
    }
  });
  return out;
}

const RUNS = Object.fromEntries(
  Object.entries(GLYPHS).map(([name, rows]) => [name, runs(rows)]),
) as Record<IconName, Run[]>;

/**
 * A one-off pixel drawing (the wax seal, small props) from rows of characters, with `inks`
 * mapping each character to a colour. `.` is transparent. Decorative: hidden from screen readers.
 */
export function PixelBitmap({
  rows,
  inks,
  scale,
  className,
}: {
  rows: readonly string[];
  inks: Record<string, string>;
  scale: number;
  className?: string;
}) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  return (
    <svg
      className={['kit-icon', className].filter(Boolean).join(' ')}
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
      {runs(rows, inks).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}

export function Icon({
  name,
  scale = 2,
  label,
}: {
  name: IconName;
  /** Screen pixels per glyph pixel. Keep it an integer. */
  scale?: number;
  /** Accessible name. Leave it out when the icon sits next to visible text. */
  label?: string;
}) {
  const size = 12 * scale;
  return (
    <svg
      className="kit-icon"
      width={size}
      height={size}
      viewBox="0 0 12 12"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {RUNS[name].map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
