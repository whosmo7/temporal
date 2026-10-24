// visibleView (02 › Engine API): the only view the play UI gets. Plot stages, current stores and
// world flags; never pending numbers, due turns or causes (rule 4 in CLAUDE.md).

import { CONFIG } from './config';
import { clampT, eventAt } from './state';
import type {
  FastTrackOption,
  PlotState,
  PlotStage,
  StoreStage,
  VisiblePlot,
  VisibleWorld,
  WorldState,
} from './types';

export function visibleView(state: WorldState, t = 0): VisibleWorld {
  const time = clampT(state, t);
  const plots: Record<string, VisiblePlot> = {};
  for (const plot of Object.values(state.plots)) {
    const stage = visibleStage(state, plot, time);
    plots[plot.id] = stage
      ? { id: plot.id, kind: plot.kind, stage }
      : { id: plot.id, kind: plot.kind };
  }

  const fastTrackable: FastTrackOption[] = state.pending
    .filter((e) => e.status === 'pending')
    .map((e) => {
      const option: FastTrackOption = {
        effectId: e.id,
        kind: e.kind,
        committedTurn: e.committedAt.turn,
        cost: {
          stamina: Number(e.payload.stamina ?? 0) * CONFIG.fastTrackMultiplier,
          water: Number(e.payload.water ?? 0) * CONFIG.fastTrackMultiplier,
        },
      };
      if (e.plotId) option.plotId = e.plotId;
      if (e.sourceActorId) option.actorId = e.sourceActorId;
      return option;
    });

  return {
    turn: state.turn,
    biome: state.biome,
    resources: { ...state.resources },
    plots,
    store: storeStage(state.resources.food),
    weakened: state.weakened > 0,
    drought: !!eventAt(state, 'drought'),
    timeOfDay: state.turnSeconds > 0 ? time / state.turnSeconds : 0,
    fastTrackable,
  };
}

function visibleStage(state: WorldState, plot: PlotState, t: number): PlotStage | undefined {
  switch (plot.kind) {
    case 'field': {
      if (plot.stage !== 'sown') return plot.stage;
      // Halfway to ripe, a sown field shows as growing. The ripening time itself stays hidden.
      const crop = state.pending.find(
        (e) => e.plotId === plot.id && e.kind === 'cropRipe' && e.status === 'pending',
      );
      if (!crop) return 'sown';
      const start = crop.committedAt.t ?? 0;
      const end = crop.dueAt.t ?? start;
      return t >= (start + end) / 2 ? 'growing' : 'sown';
    }
    case 'orchard':
      return plot.stage === 'fruiting' && plot.wear >= CONFIG.wearHalveAt ? 'worn' : plot.stage;
    case 'wild':
      if (state.wildStock <= 0) return 'none';
      return state.wildStock * 2 > state.wildCap ? 'many' : 'few';
    default:
      return plot.stage;
  }
}

function storeStage(food: number): StoreStage {
  if (food <= 0) return 'empty';
  return food >= CONFIG.upkeepFood * 2 ? 'full' : 'half';
}
