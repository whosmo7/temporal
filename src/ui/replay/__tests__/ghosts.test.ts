import { describe, expect, it } from 'vitest';
import type { ActionEntry, Replay } from '../../../api';
import { CONFIG, createWorld, type ActionType } from '../../../engine';
import { WALK_SPEED } from '../../../render/constants';
import { ghostDay } from '../ghosts';
import { replayMap } from '../replayData';

// A one-generation replay with hand-placed actions, so each test knows where the ghost should be.
const SEED = 7;
const base = createWorld(SEED, { worldId: 'w', biome: 'forest', preset: 'default' }).state;

function replayWith(acts: { type: ActionType; plotId?: string; t: number }[]): Replay {
  const actions: ActionEntry[] = acts.map((a, seq) => ({
    id: `1-${seq}`,
    worldId: 'w',
    actorId: 'al',
    type: a.type,
    ...(a.plotId ? { plotId: a.plotId } : {}),
    committedAt: { turn: 1, t: a.t },
    dueAt: { turn: 1, t: a.t },
    seq,
  }));
  return {
    worldId: 'w',
    name: 'Test',
    seed: SEED,
    biome: 'forest',
    preset: 'default',
    snapshots: [{ ...base, turnSeconds: 120 }],
    actions,
    transitions: [],
    journal: [{ turn: 1, authorUsername: 'al', text: '', drawing: null }],
  };
}

const map = replayMap(replayWith([]));
const field = map.plots.find((p) => p.kind === 'field')!;
const reservoir = map.plots.find((p) => p.kind === 'reservoir')!;
const door = { x: map.spawn.x + 0.5, y: map.spawn.y + 0.9 };
const belowTile = { x: field.x + 1 + 0.5, y: field.y + 0 + 1 + 0.9 }; // stands under tile 1,0, facing it

describe('replay ghosts', () => {
  it('waits at the door, then works below the tile while the action is under way', () => {
    const plant = 40;
    const ghost = ghostDay(replayWith([{ type: 'plantCrops', plotId: `${field.id}:1,0`, t: plant }]), map, 1)!;
    expect(ghost.seconds).toBe(120);

    expect(ghost.poseAt(0)).toMatchObject({ ...door, moving: false, working: false });
    const mid = ghost.poseAt(plant - CONFIG.actionSeconds.plantCrops / 2);
    expect(mid).toMatchObject({ facing: 'up', working: true, moving: false });
    expect(mid.x).toBeCloseTo(belowTile.x);
    expect(mid.y).toBeCloseTo(belowTile.y);
  });

  it('walks at the player pace and arrives exactly when the work has to start', () => {
    const t = 60;
    const ghost = ghostDay(replayWith([{ type: 'repairReservoir', plotId: reservoir.id, t }]), map, 1)!;
    const arrive = t - CONFIG.actionSeconds.repairReservoir;
    const spot = { x: reservoir.x + reservoir.w / 2, y: reservoir.y + reservoir.h + 0.9 };
    const walk = Math.hypot(spot.x - door.x, spot.y - door.y) / WALK_SPEED;

    expect(ghost.poseAt(arrive - walk - 0.01)).toMatchObject({ moving: false, working: false }); // still at the door
    const halfway = ghost.poseAt(arrive - walk / 2);
    expect(halfway.moving).toBe(true);
    expect(halfway.x).toBeCloseTo((door.x + spot.x) / 2, 5);
    expect(ghost.poseAt(arrive)).toMatchObject({ working: true });
    expect(ghost.poseAt(arrive).x).toBeCloseTo(spot.x);
  });

  it('goes from one job to the next, and stays at the last one afterwards', () => {
    const ghost = ghostDay(
      replayWith([
        { type: 'plantCrops', plotId: `${field.id}:1,0`, t: 20 },
        { type: 'repairReservoir', plotId: reservoir.id, t: 90 },
      ]),
      map,
      1,
    )!;
    expect(ghost.poseAt(19.5)).toMatchObject({ working: true });
    expect(ghost.poseAt(19.5).x).toBeCloseTo(belowTile.x);
    // Between the two: somewhere on the way or waiting at the field, never back at the door.
    expect(ghost.poseAt(50).y).not.toBeCloseTo(door.y);
    expect(ghost.poseAt(89).working).toBe(true);
    const after = ghost.poseAt(119);
    expect(after).toMatchObject({ moving: false, working: false });
    expect(after.x).toBeCloseTo(reservoir.x + reservoir.w / 2);
  });

  it('eats at the oven, and works where it stands when an action has no place', () => {
    const oven = map.house!.furniture.find((f) => f.kind === 'oven')!;
    const ghost = ghostDay(
      replayWith([
        { type: 'eat', t: 10 },
        { type: 'fillCan', t: 30 }, // at a pond: no plot, so in place
      ]),
      map,
      1,
    )!;
    const eating = ghost.poseAt(9.8);
    expect(eating.working).toBe(true);
    expect(eating.x).toBeCloseTo(oven.x + oven.w / 2);
    const filling = ghost.poseAt(29.5);
    expect(filling.working).toBe(true);
    expect(filling.x).toBeCloseTo(eating.x);
  });

  it('follows the clock when the log order and the times disagree', () => {
    // Logged harvest-first, but the reservoir came first in the day (as in B's scripted bench world).
    const ghost = ghostDay(
      replayWith([
        { type: 'harvest', plotId: `${field.id}:1,0`, t: 70 },
        { type: 'repairReservoir', plotId: reservoir.id, t: 30 },
      ]),
      map,
      1,
    )!;
    const repairing = ghost.poseAt(28);
    expect(repairing.working).toBe(true);
    expect(repairing.x).toBeCloseTo(reservoir.x + reservoir.w / 2);
    const harvesting = ghost.poseAt(69.5);
    expect(harvesting.working).toBe(true);
    expect(harvesting.x).toBeCloseTo(belowTile.x);
    expect(ghost.poseAt(50).moving || ghost.poseAt(50).y !== door.y).toBe(true); // between jobs, not stuck
  });

  it('has no ghost for a generation nobody played, and is the same every time', () => {
    const replay = replayWith([{ type: 'plantCrops', plotId: `${field.id}:1,0`, t: 40 }]);
    expect(ghostDay(replay, map, 2)).toBeNull();
    const a = ghostDay(replay, map, 1)!;
    const b = ghostDay(replay, map, 1)!;
    for (const t of [0, 12.5, 38.9, 39.5, 80]) expect(a.poseAt(t)).toEqual(b.poseAt(t));
  });
});
