import { describe, expect, it } from 'vitest';
import type { ActionType } from '../../../engine';
import { currentStep, STEPS, type Progress } from '../steps';

const progress = (over: Partial<Progress> & { types?: ActionType[] } = {}): Progress => ({
  moved: false,
  readJournal: false,
  atGraveyard: false,
  ...over,
  did: new Set(over.types ?? []),
});

describe('tutorial steps (08)', () => {
  it('starts with walking', () => {
    expect(STEPS[currentStep(progress())]!.id).toBe('move');
  });

  it('goes fill → sow → water → lectern → graveyard → harvest', () => {
    const ids = [
      progress({ moved: true }),
      progress({ moved: true, types: ['fillCan'] }),
      progress({ moved: true, types: ['fillCan', 'plantCrops'] }),
      progress({ moved: true, types: ['fillCan', 'plantCrops', 'water'] }),
      progress({ moved: true, readJournal: true, types: ['fillCan', 'plantCrops', 'water'] }),
      progress({
        moved: true,
        readJournal: true,
        atGraveyard: true,
        types: ['fillCan', 'plantCrops', 'water'],
      }),
    ].map((p) => STEPS[currentStep(p)]!.id);
    expect(ids).toEqual(['fill', 'sow', 'water', 'lectern', 'graveyard', 'harvest']);
  });

  it('counts things done early, and ends when everything is done', () => {
    expect(
      STEPS[currentStep(progress({ moved: true, readJournal: true, types: ['fillCan'] }))]!.id,
    ).toBe('sow');
    const all = progress({
      moved: true,
      readJournal: true,
      atGraveyard: true,
      types: ['fillCan', 'plantCrops', 'water', 'harvest'],
    });
    expect(currentStep(all)).toBe(STEPS.length);
  });

  it('never gives numbers or says what will come of anything', () => {
    for (const s of STEPS)
      expect(s.text).not.toMatch(/\d|later|generations? to come|will grow into/i);
  });
});
