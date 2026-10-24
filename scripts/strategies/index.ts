import { hoarder } from './hoarder';
import { planter } from './planter';
import { quickFixer } from './quickFixer';
import { repairFirst } from './repairFirst';
import type { Strategy } from './run';

export const STRATEGIES: Record<string, Strategy> = { hoarder, planter, quickFixer, repairFirst };

export { runStrategy, type GenRow, type PlannedAction, type Strategy } from './run';
