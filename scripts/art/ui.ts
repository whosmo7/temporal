/**
 * The UI icon atlas (`09` › UI kit): HUD resources, the eight actions and the day/night dial, at
 * 16 px (the dial at 24 px). Names are `ui/icon-<resource>` and `ui/icon-<actionId>` with the
 * engine's action IDs, so code builds the name instead of looking it up. Fishing and hunting share
 * an action, so it has a frame per biome. Kyrise icons are CC BY 4.0: see ASSETS.md for the credit.
 */
import { palette } from '../../src/ui/theme/palette.ts';
import { PACK } from '../atlas-manifest.ts';
import type { Composed } from './compose.ts';
import { Img, INK, load } from './image.ts';

const KYRISE = "art/source/kyrise-icons/Kyrise's 16x16 RPG Icon Pack - V1.3/icons/16x16";
const TOOLS = `${PACK}/Items/Tool`;
const METEO = `${PACK}/Ui/Skill Icon/Meteo`;

/** A whole small image file, centred on a `size` square. */
function icon(path: string, size = 16): Img {
  const src = load(path);
  return new Img(size, size).draw(src, Math.floor((size - src.w) / 2), Math.floor((size - src.h) / 2));
}

/** Stamina: a lightning bolt in the stamina accent with an ink outline (neither pack has one). */
function bolt(): Img {
  const rows = [
    '................',
    '........####....',
    '.......#yyy#....',
    '......#yyy#.....',
    '.....#yyy#......',
    '....#yyyy####...',
    '...#yyyyyyyy#...',
    '...####yyyy#....',
    '.....#yyyy#.....',
    '....#yyy#.......',
    '....#yy#........',
    '...#yy#.........',
    '...#y#..........',
    '...##...........',
    '................',
    '................',
  ];
  const img = new Img(16, 16);
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '#') img.px(x, y, INK);
      if (c === 'y') img.px(x, y, palette.stamina);
    }),
  );
  // Highlight down the bolt's left edge.
  for (const [x, y] of [
    [8, 2],
    [7, 3],
    [6, 4],
    [5, 5],
    [4, 6],
  ] as const)
    img.px(x, y, '#fbe3a2');
  return img;
}

export function uiFrames(): Composed[] {
  return [
    { name: 'ui/icon-food', img: icon(`${KYRISE}/fruit_01a.png`) },
    { name: 'ui/icon-water', img: icon(`${PACK}/Items/Resource/Water.png`) },
    { name: 'ui/icon-stamina', img: bolt() },
    { name: 'ui/icon-harvest', img: icon(`${TOOLS}/Sickle.png`) },
    { name: 'ui/icon-plantCrops', img: icon(`${TOOLS}/Hoe.png`) },
    { name: 'ui/icon-plantOrchard', img: icon(`${KYRISE}/leaf_01a.png`) },
    { name: 'ui/icon-repairReservoir', img: icon(`${TOOLS}/Hammer.png`) },
    { name: 'ui/icon-digWell', img: icon(`${TOOLS}/Shovel.png`) },
    { name: 'ui/icon-fishHunt-island', img: icon(`${KYRISE}/fish_01a.png`) },
    { name: 'ui/icon-fishHunt-forest', img: icon(`${KYRISE}/bow_01a.png`) },
    { name: 'ui/icon-maintain', img: icon(`${TOOLS}/WateringCan.png`) },
    { name: 'ui/icon-fastTrack', img: icon(`${PACK}/Items/Object/Hourglass.png`) },
    { name: 'ui/icon-day', img: icon(`${METEO}/Sun.png`, 24) },
    { name: 'ui/icon-night', img: icon(`${METEO}/Moon.png`, 24) },
  ];
}
