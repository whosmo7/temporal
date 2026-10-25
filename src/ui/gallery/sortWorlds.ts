// The gallery's orders (decision 037): newest first, or by world score. Pure, so it's tested.

import type { CompletedWorld } from '../../api';

export type GallerySort = 'recent' | 'highest' | 'lowest';

export const SORT_LABEL: Record<GallerySort, string> = {
  recent: 'Most recent',
  highest: 'Highest score',
  lowest: 'Lowest score',
};

/**
 * Sorted copy of `worlds`. By score, ties go newest first, and a world with no score (a backend
 * that didn't count it) goes last either way.
 */
export function sortWorlds(worlds: readonly CompletedWorld[], by: GallerySort): CompletedWorld[] {
  const newest = (a: CompletedWorld, b: CompletedWorld) => b.completedAt.localeCompare(a.completedAt);
  if (by === 'recent') return [...worlds].sort(newest);
  const sign = by === 'highest' ? -1 : 1;
  return [...worlds].sort((a, b) => {
    if (a.score === null || b.score === null) return a.score === b.score ? newest(a, b) : a.score === null ? 1 : -1;
    return sign * (a.score - b.score) || newest(a, b);
  });
}
