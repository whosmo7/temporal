import { Application, ColorMatrixFilter, Container, Graphics, Rectangle, RenderTexture, Sprite, Texture, TextureSource } from 'pixi.js';
import { buildCollision, FOUNDER_STAGE, type House, type Plot, type PlotId, type TileMap } from '../worldgen';
import { cameraOffset, pickZoom } from './camera';
import { FIXED_STEP, TILE, VIEW_TILES_INSIDE, WALK_SPEED } from './constants';
import { KeyboardInput } from './input';
import { stepWalker, type CollisionGrid, type Walker } from './movement';
import { paintAtlas, paintPlot, VARIANTS } from './placeholder-art';

// Pixel art: never smooth when scaling.
TextureSource.defaultOptions.scaleMode = 'nearest';

/** Plots drawn flat on the ground. Everything else is y-sorted with the player. */
const FLAT_PLOTS = new Set<Plot['kind']>(['field', 'wild']);

/** Seconds the roof takes to lift (and the camera to zoom) when you go in or out. */
const ROOF_FADE = 0.35;
/** How dark the outside gets while you're in the house. */
const OUTSIDE_DIM = 0.6;

/**
 * What the world looks like: visual stages only, as `visibleView()` (02) will provide them. No
 * numbers, due dates or causes ever reach the renderer.
 */
export interface WorldLook {
  /** Stage per plot ID (`ids.md`). Plots left out keep their founder stage. */
  plots: Record<PlotId, string>;
  /** Food store stage, shown by the cabinet: full | half | empty | rotting. */
  store: string;
  weakened: boolean;
  drought: boolean;
}

export interface WorldView {
  setLook(look: WorldLook): void;
  /** Pause movement while a DOM overlay is open. */
  setInputPaused(paused: boolean): void;
  /** Frames per second, for the perf readout. */
  fps(): number;
  destroy(): void;
}

/** Founder looks: every plot at its gen-1 stage, store half full, no flags. */
export function founderLook(map: TileMap): WorldLook {
  return {
    plots: Object.fromEntries(map.plots.map((p) => [p.id, defaultStage(p)])),
    store: 'half',
    weakened: false,
    drought: false,
  };
}

function defaultStage(p: Plot): string {
  return FOUNDER_STAGE[p.kind] ?? (p.kind === 'wild' ? 'many' : 'default');
}

/**
 * Builds the playable world into an initialised Pixi `Application`:
 *   world (scaled + camera offset, colour filter for weakened/drought)
 *   ├─ ground    terrain, ponds, sea, flowers (+ drought cracks): baked into one RenderTexture
 *   ├─ flat      flat plots (fields, wild spot) and the house floor
 *   ├─ sorted    trees, bushes, rocks, structures, furniture, the house shell and the player,
 *   │            y-sorted by their bottom edge
 *   └─ dim       darkens everything but the house while you're inside
 */
export function createWorldView(app: Application, map: TileMap, initialLook: WorldLook = founderLook(map)): WorldView {
  const atlas = buildAtlas();
  const frame = (name: string) => atlas.get(name) ?? atlas.get('missing')!;
  const variant = (base: string, x: number, y: number) => frame(`${base}-${1 + (tileHash(x, y) % (VARIANTS[base] ?? 1))}`);

  const world = new Container();
  const flat = new Container();
  const sorted = new Container({ sortableChildren: true });
  const dim = new Graphics();
  const groundSprite = new Sprite();
  world.addChild(groundSprite, flat, sorted, dim);
  app.stage.addChild(world);
  const colour = new ColorMatrixFilter();

  // Tall things on the sorted layer, each sorted by its bottom edge.
  const { boundary, deco } = map.layers;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      const tall = boundary[i] === 'tree' ? variant('boundary/tree', x, y) : deco[i] && deco[i] !== 'flower' ? variant(`deco/${deco[i]}`, x, y) : null;
      if (tall) sorted.addChild(bottomAnchored(tall, x, y + 1));
    }
  }

  // Plots: one sprite each, re-textured when their stage changes.
  const plotTextures = new Map<string, Texture>();
  const plotTexture = (p: Plot, stage: string) => {
    const key = `${p.kind}/${stage}/${p.w}x${p.h}`;
    let tex = plotTextures.get(key);
    if (!tex) {
      tex = Texture.from(paintPlot(p.kind, stage, p.w, p.h, map.biome));
      plotTextures.set(key, tex);
    }
    return tex;
  };
  const plotSprites = new Map<PlotId, Sprite>();
  for (const plot of map.plots) {
    const s = bottomAnchored(plotTexture(plot, defaultStage(plot)), plot.x, plot.y + plot.h);
    s.label = plot.id;
    if (FLAT_PLOTS.has(plot.kind)) flat.addChild(s);
    else {
      s.zIndex -= 0.5; // on ties the player is in front
      sorted.addChild(s);
    }
    plotSprites.set(plot.id, s);
  }

  // House: floor under everything, furniture sorted, the shell (roof + front wall) on top of both.
  const house = map.house;
  let cabinet: Sprite | null = null;
  let shell: Sprite | null = null;
  if (house) {
    const floor = new Sprite(frame('house/interior'));
    floor.position.set(house.x * TILE, house.y * TILE);
    flat.addChild(floor);
    for (const f of house.furniture) {
      const s = bottomAnchored(frame(f.kind === 'cabinet' ? 'store/half' : `furniture/${f.kind}`), f.x, f.y + f.h);
      if (f.kind === 'rug') flat.addChild(s);
      else sorted.addChild(s);
      if (f.kind === 'cabinet') cabinet = s;
    }
    shell = bottomAnchored(frame('house/exterior'), house.x, house.y + house.h);
    shell.zIndex -= 0.25;
    sorted.addChild(shell);
    drawDim(dim, map, house);
    dim.alpha = 0;
  }

  const player = new Sprite(frame('player/walk-down-0'));
  player.anchor.set(0.5, 1);
  sorted.addChild(player);

  let groundTexture: RenderTexture | null = null;
  let bakedDrought: boolean | null = null;
  const setLook = (look: WorldLook) => {
    if (look.drought !== bakedDrought) {
      groundTexture?.destroy(true);
      groundTexture = bakeGround(app, map, variant, look.drought ? frame('terrain/cracks-1') : null);
      groundSprite.texture = groundTexture;
      bakedDrought = look.drought;
    }
    for (const plot of map.plots) plotSprites.get(plot.id)!.texture = plotTexture(plot, look.plots[plot.id] ?? defaultStage(plot));
    if (cabinet) cabinet.texture = frame(`store/${look.store}`);
    colour.reset();
    if (look.weakened) {
      colour.saturate(-0.5, true);
      colour.tint(0xf0e0c0, true); // a tired ochre cast
    }
    if (look.drought) colour.tint(0xffe6cc, true); // warm, dry light
    world.filters = look.weakened || look.drought ? [colour] : [];
  };
  setLook(initialLook);

  const grid: CollisionGrid = { width: map.width, height: map.height, blocked: buildCollision(map) };
  let walker: Walker = { x: map.spawn.x + 0.5, y: map.spawn.y + 0.9, facing: 'down', moving: false };
  let animTime = 0;
  let accumulator = 0;
  // 0 = outside, 1 = inside with the roof lifted; eased between the two.
  let insideT = house && isInside(house, walker) ? 1 : 0;
  const input = new KeyboardInput();

  const update = () => {
    const dt = Math.min(app.ticker.deltaMS / 1000, 0.25);
    accumulator += dt;
    while (accumulator >= FIXED_STEP) {
      walker = stepWalker(walker, input.direction(), WALK_SPEED, FIXED_STEP, grid);
      animTime = walker.moving ? animTime + FIXED_STEP : 0;
      accumulator -= FIXED_STEP;
    }
    const step = walker.moving ? Math.floor(animTime * 8) % 4 : 0;
    player.texture = frame(`player/walk-${walker.facing}-${step}`);
    player.position.set(Math.round(walker.x * TILE), Math.round(walker.y * TILE));
    player.zIndex = walker.y * TILE;

    if (house) {
      const target = isInside(house, walker) ? 1 : 0;
      insideT = approach(insideT, target, dt / ROOF_FADE);
      shell!.alpha = 1 - insideT;
      dim.alpha = OUTSIDE_DIM * insideT;
    }

    const dpr = app.renderer.resolution;
    const view = { w: app.screen.width, h: app.screen.height };
    const e = ease(insideT);
    const outsideZoom = pickZoom(view.w, view.h, dpr);
    const zoom = house && e > 0 ? lerp(outsideZoom, pickZoom(view.w, view.h, dpr, VIEW_TILES_INSIDE), e) : outsideZoom;
    const playerFocus = { x: walker.x * TILE, y: (walker.y - 0.5) * TILE };
    const focus = house && e > 0 ? lerpPoint(playerFocus, { x: (house.x + house.w / 2) * TILE, y: (house.y + house.h / 2) * TILE }, e) : playerFocus;
    const offset = cameraOffset(focus, view, { w: map.width * TILE, h: map.height * TILE }, zoom, dpr);
    world.scale.set(zoom);
    world.position.set(offset.x, offset.y);
  };
  app.ticker.add(update);

  return {
    setLook,
    setInputPaused: (paused) => {
      input.paused = paused;
    },
    fps: () => app.ticker.FPS,
    destroy: () => {
      app.ticker.remove(update);
      input.destroy();
      world.destroy({ children: true });
      colour.destroy();
      groundTexture?.destroy(true);
      for (const t of plotTextures.values()) t.destroy(true);
      atlas.destroyAll();
    },
  };
}

/** Inside = feet in the room or in the doorway, so the roof lifts as you step through. */
function isInside(house: House, w: Walker): boolean {
  const tx = Math.floor(w.x);
  const ty = Math.floor(w.y - 0.01);
  const r = house.interior;
  const inRoom = tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
  return inRoom || (tx === house.door.x && ty === house.door.y);
}

/** Everything but the house footprint, as four rectangles. */
function drawDim(g: Graphics, map: TileMap, h: House): void {
  const W = map.width * TILE;
  const H = map.height * TILE;
  const [x0, y0, x1, y1] = [h.x * TILE, h.y * TILE, (h.x + h.w) * TILE, (h.y + h.h) * TILE];
  g.rect(0, 0, W, y0).rect(0, y1, W, H - y1).rect(0, y0, x0, y1 - y0).rect(x1, y0, W - x1, y1 - y0).fill(0x101418);
}

function bottomAnchored(tex: Texture, x: number, bottomY: number): Sprite {
  const s = new Sprite(tex);
  s.anchor.set(0, 1);
  s.position.set(x * TILE, bottomY * TILE);
  s.zIndex = bottomY * TILE;
  return s;
}

function buildAtlas() {
  const painted = paintAtlas();
  const base = Texture.from(painted.canvas);
  const frames = new Map<string, Texture>();
  for (const [name, f] of Object.entries(painted.frames)) {
    frames.set(name, new Texture({ source: base.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }));
  }
  return {
    get: (name: string) => frames.get(name),
    destroyAll: () => {
      for (const t of frames.values()) t.destroy();
      base.destroy(true);
    },
  };
}

/** Draws the static ground once into a RenderTexture: one sprite per frame instead of ~1000. */
function bakeGround(app: Application, map: TileMap, variant: (base: string, x: number, y: number) => Texture, cracks: Texture | null) {
  const scratch = new Container();
  const { terrain, boundary, deco } = map.layers;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      // Under boundary trees: grass, so the canopies sit on something.
      const base = boundary[i] === 'sea' ? 'boundary/sea' : `terrain/${terrain[i]}`;
      const s = new Sprite(variant(base, x, y));
      s.position.set(x * TILE, y * TILE);
      scratch.addChild(s);
      if (deco[i] === 'flower') {
        const f = new Sprite(variant('deco/flower', x, y));
        f.position.set(x * TILE, y * TILE);
        scratch.addChild(f);
      }
      if (cracks && !boundary[i] && (terrain[i] === 'grass' || terrain[i] === 'dirt') && tileHash(x, y) % 3 === 0) {
        const c = new Sprite(cracks);
        c.position.set(x * TILE, y * TILE);
        scratch.addChild(c);
      }
    }
  }
  const texture = RenderTexture.create({ width: map.width * TILE, height: map.height * TILE });
  app.renderer.render({ container: scratch, target: texture });
  scratch.destroy({ children: true });
  return texture;
}

function tileHash(x: number, y: number): number {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

const approach = (v: number, target: number, step: number) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPoint = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
