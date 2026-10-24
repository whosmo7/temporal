import { palette } from '../theme/palette';

/**
 * The logo's sapling (C, 2026-10-24: "a small sapling growing out of one letter"), shared by the
 * Logo component and the favicon build (`scripts/art/compose.ts`). `.` is transparent.
 */
export const SAPLING = [
  '......kkk..',
  '.kkk.kGGGk.',
  'kGGGkkGGDk.',
  'kDGGDkGDk..',
  '.kDDkBkk...',
  '..kkkBk....',
  '....kBk....',
  '....kBk....',
] as const;

export const SAPLING_INKS: Record<string, string> = {
  k: palette.ink,
  G: palette.grassLight,
  D: palette.grassShade,
  B: palette.bark,
};
