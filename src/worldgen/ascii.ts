import type { PlotKind, TileMap } from './types';

const PLOT_CHAR: Record<PlotKind, string> = {
  field: 'F',
  orchard: 'O',
  reservoir: 'R',
  well: 'W',
  wild: 'H',
  lectern: 'L',
  graveyard: 'G',
};

export const ASCII_LEGEND =
  '# tree  ~ sea/pond  . grass  , dirt  : sand  = path  r rock  b bush  * flower  @ spawn\n' +
  'F field  O orchard  R reservoir  W well  H wild (fish/hunt)  L lectern  G graveyard';

/** Text rendering of a map, for tests, the preview script and eyeballing presets. */
export function toAscii(map: TileMap): string {
  const { terrain, boundary, deco } = map.layers;
  const rows: string[][] = [];
  for (let y = 0; y < map.height; y++) {
    const row: string[] = [];
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      const b = boundary[i];
      const d = deco[i];
      if (b) row.push(b === 'tree' ? '#' : '~');
      else if (d) row.push(d === 'rock' ? 'r' : d === 'bush' ? 'b' : '*');
      else row.push({ grass: '.', dirt: ',', sand: ':', water: '~', path: '=' }[terrain[i]!]);
    }
    rows.push(row);
  }
  for (const p of map.plots) {
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) rows[y]![x] = PLOT_CHAR[p.kind];
  }
  rows[map.spawn.y]![map.spawn.x] = '@';
  return rows.map((r) => r.join('')).join('\n');
}
