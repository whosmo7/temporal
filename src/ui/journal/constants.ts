import { palette } from '../theme/palette';
import { ERASE } from './strokes';

/**
 * Characters allowed on a journal page (decision 009). The server enforces the same limit when it
 * stores the page (`07`), so change both together.
 */
export const JOURNAL_CHAR_LIMIT = 400;

export type PenId = 'ink' | 'brown' | 'green' | 'blue' | 'eraser';

export const PENS: { id: PenId; label: string; color: string }[] = [
  { id: 'ink', label: 'Black pen', color: palette.ink },
  { id: 'brown', label: 'Brown pen', color: palette.ledge },
  { id: 'green', label: 'Green pen', color: palette.tree },
  { id: 'blue', label: 'Blue pen', color: palette.seaDeep },
  { id: 'eraser', label: 'Eraser', color: ERASE },
];

/** How long the wax seal press plays before the page hands off, in ms. */
export const SEAL_PRESS_MS = 320;
export const SEAL_HOLD_MS = 650;
