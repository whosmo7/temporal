// Dev-only page: renders a generated map as coloured squares, for picking demo seeds and making
// presets. Not player-facing, so it shows every number. Open with `npm run dev:worldgen`.
// When the `11` scaffold lands this moves to the hash route #/dev/worldgen.
import {
  buildCollision,
  founderState,
  isPresetName,
  PRESETS,
  walkDistance,
  type Biome,
  type FounderState,
  type PlotKind,
  type WorldgenPreset,
} from '../../src/worldgen';
import { FOUNDER_CONFIG } from '../../src/worldgen/__fixtures__/founder-config';

const COLOURS = {
  grass: '#6aa84f',
  dirt: '#a07850',
  sand: '#e8d590',
  water: '#4a90c8',
  path: '#cfc6b4',
  tree: '#24481f',
  sea: '#1d5480',
  rock: '#8d8d8d',
  bush: '#2f6b27',
  flower: '#f07ab0',
} as const;

const PLOT_COLOURS: Record<PlotKind, string> = {
  field: '#7a4f2a',
  orchard: '#c0392b',
  reservoir: '#2e86de',
  well: '#48c9b0',
  wild: '#f39c12',
  lectern: '#9b59b6',
  graveyard: '#7f8c8d',
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  seed: $<HTMLInputElement>('seed'),
  biome: $<HTMLSelectElement>('biome'),
  preset: $<HTMLSelectElement>('preset'),
  gens: $<HTMLInputElement>('gens'),
  zoom: $<HTMLSelectElement>('zoom'),
  overrides: $<HTMLTextAreaElement>('overrides'),
  showGrid: $<HTMLInputElement>('showGrid'),
  showCollision: $<HTMLInputElement>('showCollision'),
  showReach: $<HTMLInputElement>('showReach'),
  showLabels: $<HTMLInputElement>('showLabels'),
  error: $<HTMLDivElement>('error'),
  info: $<HTMLDivElement>('info'),
  events: $<HTMLUListElement>('events'),
  founder: $<HTMLDivElement>('founder'),
  plots: $<HTMLUListElement>('plots'),
  legend: $<HTMLDivElement>('legend'),
  canvas: $<HTMLCanvasElement>('map'),
};

for (const name of Object.keys(PRESETS)) ui.preset.add(new Option(name, name));
ui.legend.innerHTML = [...Object.entries(COLOURS), ...Object.entries(PLOT_COLOURS)]
  .map(([name, c]) => `<span><span class="swatch" style="background:${c}"></span>${name}</span>`)
  .join('');

// URL ⇄ controls, so a seed worth keeping is a link: /dev/worldgen/?seed=123&biome=island
const params = new URLSearchParams(location.search);
ui.seed.value = params.get('seed') ?? '123';
ui.biome.value = params.get('biome') === 'island' ? 'island' : 'forest';
ui.preset.value = isPresetName(params.get('preset') ?? '') ? params.get('preset')! : 'default';
ui.gens.value = params.get('gens') ?? String(FOUNDER_CONFIG.generationCount);
ui.overrides.value = params.get('opts') ?? '';

function currentPreset(): WorldgenPreset {
  const base = PRESETS[ui.preset.value as keyof typeof PRESETS] as WorldgenPreset;
  const text = ui.overrides.value.trim();
  return text ? { ...base, ...(JSON.parse(text) as WorldgenPreset) } : base;
}

function syncUrl(): void {
  const p = new URLSearchParams({ seed: ui.seed.value, biome: ui.biome.value });
  if (ui.preset.value !== 'default') p.set('preset', ui.preset.value);
  if (ui.gens.value !== String(FOUNDER_CONFIG.generationCount)) p.set('gens', ui.gens.value);
  if (ui.overrides.value.trim()) p.set('opts', ui.overrides.value.trim());
  history.replaceState(null, '', `?${p}`);
}

function render(): void {
  syncUrl();
  let state: FounderState;
  let ms: number;
  try {
    const start = performance.now();
    state = founderState(Number(ui.seed.value), ui.biome.value as Biome, { ...FOUNDER_CONFIG, generationCount: Number(ui.gens.value) }, currentPreset());
    ms = performance.now() - start;
    ui.error.hidden = true;
  } catch (err) {
    ui.error.hidden = false;
    ui.error.textContent = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return;
  }
  draw(state);
  const { map } = state;
  ui.info.textContent = `${map.width}×${map.height} · seed ${map.seed} · ${ms.toFixed(1)} ms`;
  ui.events.innerHTML = state.events.map((e) => `<li>gen ${e.turn}: ${e.kind}</li>`).join('');
  ui.founder.textContent =
    `food ${state.resources.food} · water ${state.resources.water} · stamina ${state.resources.stamina}\n` +
    `wild ${state.wildStock}/${state.wildCap}`;
  ui.plots.innerHTML = map.plots
    .map((p) => {
      const stage = state.plots[p.id]?.stage;
      return `<li><span class="swatch" style="background:${PLOT_COLOURS[p.kind]}"></span>${p.id} @ ${p.x},${p.y} (${p.w}×${p.h})${stage ? ` · ${stage}` : ''}</li>`;
    })
    .join('');
}

function draw({ map }: FounderState): void {
  const z = Number(ui.zoom.value);
  const canvas = ui.canvas;
  canvas.width = map.width * z;
  canvas.height = map.height * z;
  const ctx = canvas.getContext('2d')!;
  const { terrain, boundary, deco } = map.layers;

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      ctx.fillStyle = COLOURS[boundary[i] ?? terrain[i]!];
      ctx.fillRect(x * z, y * z, z, z);
      const d = deco[i];
      if (d) {
        ctx.fillStyle = COLOURS[d];
        const inset = d === 'flower' ? z * 0.35 : z * 0.18;
        ctx.beginPath();
        ctx.arc(x * z + z / 2, y * z + z / 2, z / 2 - inset, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  for (const p of map.plots) {
    ctx.fillStyle = PLOT_COLOURS[p.kind];
    ctx.globalAlpha = 0.85;
    ctx.fillRect(p.x * z, p.y * z, p.w * z, p.h * z);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x * z + 0.5, p.y * z + 0.5, p.w * z - 1, p.h * z - 1);
  }

  const grid = buildCollision(map);
  if (ui.showReach.checked) {
    const dist = walkDistance(map, grid);
    const max = Math.max(...dist);
    for (let i = 0; i < dist.length; i++) {
      if (grid[i]) continue;
      const x = i % map.width;
      const y = (i - x) / map.width;
      const d = dist[i]!;
      ctx.fillStyle = d < 0 ? 'rgba(255,0,0,0.55)' : `rgba(255,255,255,${0.55 * (1 - d / max)})`;
      ctx.fillRect(x * z, y * z, z, z);
    }
  }
  if (ui.showCollision.checked) {
    ctx.fillStyle = 'rgba(255,40,40,0.4)';
    for (let i = 0; i < grid.length; i++) {
      if (!grid[i]) continue;
      const x = i % map.width;
      ctx.fillRect(x * z, ((i - x) / map.width) * z, z, z);
    }
  }
  if (ui.showGrid.checked) {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    for (let x = 0; x <= map.width; x++) ctx.moveTo(x * z + 0.5, 0), ctx.lineTo(x * z + 0.5, canvas.height);
    for (let y = 0; y <= map.height; y++) ctx.moveTo(0, y * z + 0.5), ctx.lineTo(canvas.width, y * z + 0.5);
    ctx.stroke();
  }
  if (ui.showLabels.checked && z >= 12) {
    ctx.font = `bold ${Math.round(z * 0.6)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of map.plots) {
      const label = p.id.replace('orchard-1', 'orchard').replace('field-', 'F');
      const cx = (p.x + p.w / 2) * z;
      const cy = (p.y + p.h / 2) * z;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(label, cx, cy);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, cx, cy);
    }
  }

  // Spawn marker
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc((map.spawn.x + 0.5) * z, (map.spawn.y + 0.5) * z, z * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function stepSeed(delta: number): void {
  ui.seed.value = String(Math.max(0, Number(ui.seed.value) + delta));
  render();
}

$('prev').addEventListener('click', () => stepSeed(-1));
$('next').addEventListener('click', () => stepSeed(1));
$('random').addEventListener('click', () => {
  ui.seed.value = String(Math.floor(Math.random() * 0x100000000));
  render();
});
$('copy').addEventListener('click', () => {
  try {
    void navigator.clipboard.writeText(JSON.stringify(currentPreset(), null, 2));
  } catch (err) {
    ui.error.hidden = false;
    ui.error.textContent = String(err);
  }
});
$('link').addEventListener('click', () => void navigator.clipboard.writeText(location.href));
$('controls').addEventListener('submit', (e) => e.preventDefault());
for (const el of [ui.seed, ui.biome, ui.preset, ui.gens, ui.zoom, ui.showGrid, ui.showCollision, ui.showReach, ui.showLabels]) {
  el.addEventListener('change', render);
}
ui.seed.addEventListener('input', render);
ui.overrides.addEventListener('input', render);
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
  if (e.key === 'ArrowLeft') stepSeed(-1);
  if (e.key === 'ArrowRight') stepSeed(1);
});

render();
