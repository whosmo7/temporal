// "How to play" words, from docs/content/flavour-text.md › How to play (C reviews). Change them
// there first, then here. They say how to act, never how long anything takes (inheritance-player-facing).

export const TUTORIAL_TEXT = {
  sow: {
    title: 'Sow and water',
    text: 'Face a field tile and press E to sow. Water it from the can and it starts to grow.',
  },
  fill: {
    title: 'Fill the can',
    text: 'The can starts each day empty. Fill it at a pond, the sea, a well or the reservoir.',
  },
  harvest: {
    title: 'Harvest',
    text: 'Face a ripe crop and press E to bring it into the store. Left too long, it rots.',
  },
  eat: {
    title: 'Eat',
    text: 'Hungry? Go inside, face the oven and press E. Each meal takes one food from the store.',
  },
} as const;

export const HOW_TO_PLAY = {
  title: 'How to play',
  move: 'Walk with WASD or the arrow keys.',
  close: 'Got it',
  open: 'How to play',
} as const;
