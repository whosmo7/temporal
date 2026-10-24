// Prints a generated map as text, for picking seeds and trying presets before the
// /dev/worldgen page exists.
//   npm run worldgen -- --seed 123 --biome island --preset small
//   npm run worldgen -- --seed 7 --json '{"width":40,"fields":3,"pin":{"well":{"x":6,"y":6}}}'
import { parseArgs } from 'node:util';
import { ASCII_LEGEND, generateMap, isPresetName, PRESETS, toAscii, type Biome, type WorldgenPreset } from '../src/worldgen';

const { values } = parseArgs({
  options: {
    seed: { type: 'string', default: '1' },
    biome: { type: 'string', default: 'forest' },
    preset: { type: 'string', default: 'default' },
    json: { type: 'string' },
    timing: { type: 'boolean', default: false },
  },
});

if (values.biome !== 'forest' && values.biome !== 'island') {
  console.error(`--biome must be forest or island, got ${values.biome}`);
  process.exit(1);
}
if (!isPresetName(values.preset)) {
  console.error(`Unknown --preset ${values.preset}. Have: ${Object.keys(PRESETS).join(', ')}`);
  process.exit(1);
}
const biome: Biome = values.biome;
const preset: WorldgenPreset = { ...PRESETS[values.preset], ...(values.json ? JSON.parse(values.json) : {}) };
const seed = Number(values.seed);

const start = performance.now();
const map = generateMap(seed, biome, preset);
const ms = performance.now() - start;

console.log(toAscii(map));
console.log(`\nseed ${map.seed} · ${biome} · preset ${values.preset} · ${map.width}×${map.height}`);
console.log(map.plots.map((p) => `${p.id}@${p.x},${p.y}`).join('  '));
if (values.timing) console.log(`${ms.toFixed(1)} ms`);
console.log(`\n${ASCII_LEGEND}`);
