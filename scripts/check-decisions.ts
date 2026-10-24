// Fails if two decision records share a number (docs/decisions/NNN-<slug>.md). Three people add
// decisions in parallel, and twice two of them picked the same "next" number from stale copies.
// Runs in CI; `npm run check:decisions` locally. Prints the next free number either way.

import { readdirSync } from 'node:fs';

const files = readdirSync('docs/decisions').filter((f) => f.endsWith('.md'));
const byNumber = new Map<string, string[]>();
const misnamed: string[] = [];

for (const file of files) {
  const match = /^(\d{3})-[a-z0-9-]+\.md$/.exec(file);
  if (!match) {
    misnamed.push(file);
    continue;
  }
  byNumber.set(match[1]!, [...(byNumber.get(match[1]!) ?? []), file]);
}

const clashes = [...byNumber.entries()].filter(([, names]) => names.length > 1);
const highest = Math.max(0, ...[...byNumber.keys()].map(Number));
const next = String(highest + 1).padStart(3, '0');

for (const [number, names] of clashes) {
  console.error(`Decision ${number} is used twice: ${names.join(', ')}`);
}
for (const file of misnamed) {
  console.error(`Not named NNN-<slug>.md: ${file}`);
}
if (clashes.length > 0 || misnamed.length > 0) {
  console.error(`Renumber the newer one to ${next} (and its links), then re-run.`);
  process.exit(1);
}
console.log(`${files.length} decisions, no clashes. Next free number: ${next}`);
