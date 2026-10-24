import type { Biome } from './types';
import { deriveRng } from './rng';

// World names from the seed (07 open question 6, decision 020). Computed on the client, so
// worlds.name stays null and both backends show the same name for the same seed.

const ADJECTIVES = [
  'Hollow', 'Quiet', 'Long', 'Low', 'Old', 'Still', 'Bright', 'Grey', 'Wild', 'Deep',
  'Far', 'Green', 'Amber', 'Lone', 'High', 'Cold', 'Thorn', 'Ash', 'Bramble', 'Winter',
] as const;

const NOUNS: Record<Biome, readonly string[]> = {
  forest: ['Elm', 'Oak', 'Hollow', 'Glade', 'Thicket', 'Copse', 'Rowan', 'Birch', 'Fern', 'Dell'],
  island: ['Reach', 'Cove', 'Shoal', 'Strand', 'Tern', 'Skerry', 'Bay', 'Dune', 'Spit', 'Harbour'],
};

export function worldName(seed: number, biome: Biome): string {
  const rng = deriveRng(seed, 'name');
  const adjective = rng.pick(ADJECTIVES);
  let noun = rng.pick(NOUNS[biome]);
  // "Hollow Hollow" reads like a typo.
  if (noun === adjective) noun = rng.pick(NOUNS[biome].filter((n) => n !== adjective));
  return `${adjective} ${noun}`;
}
