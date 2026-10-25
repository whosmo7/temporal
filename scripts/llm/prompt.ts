// Prompts for the LLM playthrough simulator. Short, plain, second person. They describe the
// player's motives and what they can see, never hidden effects, and never call a choice good or bad.
// Bump PROMPT_VERSION whenever the wording changes, so traces say which prompts produced them.

import type { ChoiceRequest, JournalRequest, Observation } from './types';

export const PROMPT_VERSION = 'llm-sim-1';

const RULES = [
  'You are one person living one day on a small farm that others lived on before you and others will after.',
  'You only know what you can see. Nobody tells you how things will turn out; make a plausible choice anyway.',
  'Each choice takes the time shown. When the day runs out, the night takes food from the store.',
  'Answer with one choice id from the list. You may ask to repeat it a few times in a row.',
].join(' ');

export function choicePrompt(req: ChoiceRequest): { system: string; user: string } {
  const lines = [
    describe(req.observation),
    '',
    'You can:',
    ...req.candidates.map((c) => `${c.id}: ${c.label}${c.seconds ? ` (${c.seconds} s)` : ''}`),
  ];
  if (req.lastRejection) lines.push('', `Your last choice didn't happen: ${req.lastRejection}`);
  lines.push('', 'Reply as JSON: {"choice": "<id>", "repeat": <1 or more>, "note": "<a few words on why>"}.');
  return { system: `${RULES} ${req.persona.motive}`, user: lines.join('\n') };
}

export function journalPrompt(req: JournalRequest): { system: string; user: string } {
  const lines = [
    `You are ${req.you}. Your day in generation ${req.generation} of ${req.generations} is over.`,
    `What you did: ${req.doneToday.length ? req.doneToday.join('; ') : 'nothing much'}.`,
    `How the day ended: ${req.summary.join(' ')}`,
    ...earlierPages(req.journal),
    '',
    'Write one to three sentences for the journal, for whoever lives here next. Write like a real person in a hurry:',
    'specific, a little uncertain, no advice about right and wrong. Reply as JSON: {"entry": "<text>"}.',
  ];
  return { system: `${RULES} ${req.persona.motive}`, user: lines.join('\n') };
}

/** The observation as a few lines of plain text. */
export function describe(o: Observation): string {
  const fields = Object.entries(o.land.fields).map(([name, stages]) => `${name}: ${stages_(stages)}`);
  const lines = [
    `You are ${o.you}, generation ${o.generation} of ${o.generations}, on a ${o.biome}. About ${Math.round(o.timeLeftSeconds)} s of daylight left.`,
    `Store: ${o.stores.food} food (looks ${o.stores.looks}), ${o.stores.water} water. Can: ${o.stores.can}/${o.stores.canCapacity} pours. Hunger: ${o.stores.hunger}/${o.stores.hungerMax}${o.hungry ? ' (you are hungry and slow)' : ''}.`,
    `Tonight the night takes ${o.nightNeedsFood} food.${o.wokeTired ? ' You woke up tired.' : ''}`,
    `Fields: ${fields.join('; ') || 'none'}.`,
    `Orchard: ${stages_(o.land.orchard) || 'none'}.`,
    `Reservoir: ${o.land.reservoir ?? 'none'}. Well: ${o.land.well ?? 'none'}. Wild spot: ${o.land.wild ?? 'none'}.`,
  ];
  if (o.doneToday.length) lines.push(`Done today: ${o.doneToday.join('; ')}.`);
  if (o.graveyard.length) lines.push(`Gravestones: ${o.graveyard.join(', ')}.`);
  lines.push(...earlierPages(o.journal));
  return lines.join('\n');
}

function stages_(stages: Record<string, number>): string {
  return Object.entries(stages)
    .map(([stage, n]) => `${n} ${stage}`)
    .join(', ');
}

function earlierPages(journal: Observation['journal']): string[] {
  if (journal.length === 0) return [];
  return ['Journal pages left by earlier people:', ...journal.map((p) => `- ${p.author} (generation ${p.generation}): "${p.text}"`)];
}
