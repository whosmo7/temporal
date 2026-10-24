import { palette } from '../theme/palette';

/**
 * The teal sky every screen outside the game floats in (art direction › Title, landing and
 * gallery). Two cloud layers drift at different speeds for parallax. Clouds are pixel bitmaps
 * turned into a repeating SVG tile, so they stay crisp at any integer scale.
 */

// c = cloud, s = cloud-shade (the underside, light from the top-left).
const BIG = [
  '..........cccccc................',
  '........cccccccccc.....cccc.....',
  '....cccccccccccccccc.cccccccc...',
  '..cccccccccccccccccccccccccccc..',
  '.cccccccccccccccccccccccccccccc.',
  'cccccccccccccccccccccccccccccccc',
  'csssscccccccccssssscccccccccsssc',
  '.ssssssssssssssssssssssssssssss.',
];

const SMALL = [
  '....cccc......',
  '..cccccccc.cc.',
  '.cccccccccccc.',
  'cccccccccccccc',
  '.ssssssssssss.',
];

function bitmap(rows: string[], ox: number, oy: number) {
  const fill = { c: palette.cloud, s: palette.cloudShade } as Record<string, string>;
  let out = '';
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
      out += `<rect x="${ox + x}" y="${oy + y}" width="${w}" height="1" fill="${fill[ch]}"/>`;
      x += w;
    }
  });
  return out;
}

function tile(w: number, h: number, body: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" shape-rendering="crispEdges">${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Wide, sparse tiles with off-grid placements, so the repeat doesn't read as wallpaper.
const NEAR = tile(460, 230, bitmap(BIG, 30, 22) + bitmap(SMALL, 300, 150) + bitmap(SMALL, 380, 40));
const FAR = tile(390, 190, bitmap(SMALL, 20, 30) + bitmap(BIG, 210, 110) + bitmap(SMALL, 120, 160));

export function SkyBackdrop() {
  return (
    <div className="sky" aria-hidden>
      <div className="sky__clouds sky__clouds--far" style={{ backgroundImage: FAR }} />
      <div className="sky__clouds sky__clouds--near" style={{ backgroundImage: NEAR }} />
    </div>
  );
}
