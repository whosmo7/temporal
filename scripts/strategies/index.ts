import { hoarder } from './hoarder';
import { looter } from './looter';
import { planter } from './planter';
import { quickFixer } from './quickFixer';
import { repairFirst } from './repairFirst';
import { skimmer } from './skimmer';
import type { Strategy } from './run';

export const STRATEGIES: Record<string, Strategy> = { hoarder, looter, planter, quickFixer, repairFirst, skimmer };

export { runLineup, runStrategy, type GenRow, type PlannedAction, type Strategy } from './run';
