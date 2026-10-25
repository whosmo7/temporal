// The tutorial's steps (08): what to try next, and how we know it's been done. Wording follows
// inheritance-player-facing: how to move and act, that upkeep exists, and nothing about what
// anything will become later.

import type { ActionType } from '../../engine';

/** What the player has done so far in the tutorial. Facts only ever become true. */
export interface Progress {
  moved: boolean;
  did: ReadonlySet<ActionType>;
  readJournal: boolean;
  atGraveyard: boolean;
}

export interface Step {
  id: string;
  text: string;
  done: (p: Progress) => boolean;
}

export const STEPS: readonly Step[] = [
  { id: 'move', text: 'Walk with WASD or the arrow keys.', done: (p) => p.moved },
  {
    id: 'fill',
    text: 'Your can starts each day empty. Walk up to the reservoir or a pond and fill it.',
    done: (p) => p.did.has('fillCan'),
  },
  {
    id: 'sow',
    text: 'Find the field. Face a tile of tilled earth and sow it.',
    done: (p) => p.did.has('plantCrops'),
  },
  {
    id: 'water',
    text: 'Seeds wait for water. Water the tile you sowed.',
    done: (p) => p.did.has('water'),
  },
  {
    id: 'lectern',
    text: 'While it grows: the journal stands by the house. Those before you left words here. Press E to read it.',
    done: (p) => p.readJournal,
  },
  {
    id: 'graveyard',
    text: 'Find the graveyard. When your day ends, you join them.',
    done: (p) => p.atGraveyard,
  },
  {
    id: 'harvest',
    text: 'Go back to your field. When the crop is ripe, harvest it.',
    done: (p) => p.did.has('harvest'),
  },
];

/** The last card, once every step is done. */
export const UPKEEP_TEXT =
  'Before night falls, keep enough food in the store to get through the night. When the day ends, you write a page for whoever comes next.';

/** Index of the first step not yet done; `STEPS.length` once all are. */
export function currentStep(p: Progress): number {
  const i = STEPS.findIndex((s) => !s.done(p));
  return i === -1 ? STEPS.length : i;
}

const SEEN_KEY = 'inheritance.tutorialSeen';

/** Whether this browser has finished or skipped the tutorial. Missing storage counts as seen. */
export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private mode: it shows again next time, which is fine.
  }
}
