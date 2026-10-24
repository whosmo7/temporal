/**
 * The art-direction palette (`docs/art/art-direction.md` › Palette), for code that can't read CSS
 * variables: canvas drawing, Pixi tints. `tokens.css` declares the same values as custom properties.
 */
export const palette = {
  // World / day
  grassLight: '#a4ed93',
  grass: '#91de89',
  grassShade: '#61aa81',
  tree: '#3a6757',
  shadow: '#3c5461',
  path: '#e7d7a1',
  pathShade: '#cebb99',
  dirt: '#bea479',
  ledge: '#956d42',
  // Sky / title
  cloud: '#fefadb',
  cloudShade: '#e0eddc',
  mist: '#b9dcca',
  sky: '#5fbfc7',
  skyMid: '#4596ae',
  skyDeep: '#36779b',
  rock: '#62606c',
  // Dusk / journal / replay
  peachLight: '#fccca7',
  peach: '#ffc19d',
  rose: '#ecaa8e',
  clay: '#b48471',
  bark: '#6f4e4c',
  plum: '#404363',
  sea: '#53c2db',
  seaDeep: '#4191a8',
  // UI
  ink: '#1f2027',
  panelEdge: '#563749',
  muted: '#87786b',
  highlight: '#bcc9a1',
  paper: '#fefadb',
  // Resource accents (HUD numbers and bars only)
  food: '#d95763',
  water: '#53c2db',
  stamina: '#f2b84b',
} as const;

export type PaletteKey = keyof typeof palette;
