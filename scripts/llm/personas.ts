// Simulated players' motives (scripts/simulate-llm.ts). Ordinary reasons a person might have; none
// of them is framed as right or wrong (inheritance-core › no moralising).

import type { Persona } from './types';

export const PERSONAS: Persona[] = [
  {
    id: 'pragmatic',
    motive: 'You deal with what is in front of you. You want a full store tonight and a day that was worth the effort.',
  },
  {
    id: 'cautious',
    motive: 'You worry about running short. You would rather keep a margin than gamble on something that might not pay off.',
  },
  {
    id: 'builder',
    motive: 'You like to leave things in working order. Fixing and planting appeal to you, even when the result is slow to show.',
  },
  {
    id: 'ambitious',
    motive: 'You want to come out of this with as much as you can for yourself. You know others played here before you and others will after.',
  },
  {
    id: 'frugal',
    motive: 'You dislike waste. You use what is already here before starting anything new, and you keep what you gather.',
  },
  {
    id: 'curious',
    motive: 'You want to see what this place can do. You try things you have not seen tried, and you read what others left behind.',
  },
];

/**
 * One distinct persona per generation. `first` names the ones to start with (comma-separated);
 * the rest follow in the list's order, then repeat if a world has more generations than personas.
 */
export function personasFor(gens: number, first?: string): Persona[] {
  const chosen = (first ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => {
      const persona = PERSONAS.find((p) => p.id === id);
      if (!persona) throw new Error(`Unknown persona "${id}". Try: ${PERSONAS.map((p) => p.id).join(', ')}`);
      return persona;
    });
  const order = [...chosen, ...PERSONAS.filter((p) => !chosen.includes(p))];
  return Array.from({ length: gens }, (_, i) => order[i % order.length]!);
}
