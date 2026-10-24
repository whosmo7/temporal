import { Application, Container, Rectangle, RenderTexture, Sprite, Texture, TextureSource } from 'pixi.js';
import { buildCollision, FOUNDER_STAGE, type Plot, type TileMap } from '../worldgen';
import { cameraOffset, pickZoom } from './camera';
import { FIXED_STEP, TILE, WALK_SPEED } from './constants';
import { KeyboardInput } from './input';
import { stepWalker, type CollisionGrid, type Walker } from './movement';
import { paintAtlas, paintPlot, VARIANTS } from './placeholder-art';

// Pixel art: never smooth when scaling.
TextureSource.defaultOptions.scaleMode = 'nearest';

/** Plots drawn flat on the ground. Everything else is y-sorted with the player. */
const FLAT_PLOTS = new Set<Plot['kind']>(['field', 'wild']);

export interface WorldView {
  destroy(): void;
  /** Pause movement while a DOM overlay is open. */
  setInputPaused(paused: boolean): void;
}

/**
 * Builds the playable world into an initialised Pixi `Application`:
 *   world (scaled + camera offset)
 *   ├─ ground   terrain, ponds, sea, flowers: drawn once into a RenderTexture
 *   ├─ flat     flat plots (fields, wild spot)
 *   └─ sorted   trees, bushes, rocks, structures and the player, y-sorted by their bottom edge
 */
export function createWorldView(app: Application, map: TileMap): WorldView {
  const textures = buildTextures();
  const frame = (name: string) => textures.get(name) ?? textures.get('missing')!;
  const variant = (base: string, x: number, y: number) => {
    const n = VARIANTS[base] ?? 1;
    return frame(`${base}-${1 + (tileHash(x, y) % n)}`);
  };

  const world = new Container();
  const flat = new Container();
  const sorted = new Container({ sortableChildren: true });
  const ground = buildGround(app, map, variant);
  world.addChild(ground.sprite, flat, sorted);
  app.stage.addChild(world);

  // Tall things on the sorted layer. Trees only on the boundary's inner edge rows need sorting,
  // but every tree goes here so canopies overlap each other correctly too.
  const { boundary, deco } = map.layers;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      const tall = boundary[i] === 'tree' ? variant('boundary/tree', x, y) : deco[i] && deco[i] !== 'flower' ? variant(`deco/${deco[i]}`, x, y) : null;
      if (!tall) continue;
      const s = new Sprite(tall);
      s.anchor.set(0, 1);
      s.position.set(x * TILE, (y + 1) * TILE);
      s.zIndex = (y + 1) * TILE;
      sorted.addChild(s);
    }
  }

  const plotTextures: Texture[] = [];
  for (const plot of map.plots) {
    const stage = FOUNDER_STAGE[plot.kind] ?? (plot.kind === 'wild' ? 'many' : 'default');
    const tex = Texture.from(paintPlot(plot.kind, stage, plot.w, plot.h, map.biome));
    plotTextures.push(tex);
    const s = new Sprite(tex); // overhang (posts, roof) is baked into the texture's height
    s.anchor.set(0, 1);
    s.position.set(plot.x * TILE, (plot.y + plot.h) * TILE);
    s.label = plot.id;
    if (FLAT_PLOTS.has(plot.kind)) flat.addChild(s);
    else {
      s.zIndex = (plot.y + plot.h) * TILE - 0.5; // ties: the player in front
      sorted.addChild(s);
    }
  }

  const player = new Sprite(frame('player/walk-down-0'));
  player.anchor.set(0.5, 1);
  sorted.addChild(player);

  const grid: CollisionGrid = { width: map.width, height: map.height, blocked: buildCollision(map) };
  let walker: Walker = { x: map.spawn.x + 0.5, y: map.spawn.y + 0.9, facing: 'down', moving: false };
  let animTime = 0;
  let accumulator = 0;
  const input = new KeyboardInput();

  const update = () => {
    accumulator += Math.min(app.ticker.deltaMS / 1000, 0.25);
    while (accumulator >= FIXED_STEP) {
      walker = stepWalker(walker, input.direction(), WALK_SPEED, FIXED_STEP, grid);
      animTime = walker.moving ? animTime + FIXED_STEP : 0;
      accumulator -= FIXED_STEP;
    }
    const step = walker.moving ? Math.floor(animTime * 8) % 4 : 0;
    player.texture = frame(`player/walk-${walker.facing}-${step}`);
    player.position.set(Math.round(walker.x * TILE), Math.round(walker.y * TILE));
    player.zIndex = walker.y * TILE;

    const dpr = app.renderer.resolution;
    const view = { w: app.screen.width, h: app.screen.height };
    const zoom = pickZoom(view.w, view.h, dpr);
    const offset = cameraOffset({ x: walker.x * TILE, y: (walker.y - 0.5) * TILE }, view, { w: map.width * TILE, h: map.height * TILE }, zoom, dpr);
    world.scale.set(zoom);
    world.position.set(offset.x, offset.y);
  };
  app.ticker.add(update);

  return {
    setInputPaused: (paused) => {
      input.paused = paused;
    },
    destroy: () => {
      app.ticker.remove(update);
      input.destroy();
      world.destroy({ children: true });
      ground.texture.destroy(true);
      for (const t of plotTextures) t.destroy(true);
      textures.destroyAll();
    },
  };
}

function buildTextures() {
  const atlas = paintAtlas();
  const base = Texture.from(atlas.canvas);
  const map = new Map<string, Texture>();
  for (const [name, f] of Object.entries(atlas.frames)) {
    map.set(name, new Texture({ source: base.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }));
  }
  return {
    get: (name: string) => map.get(name),
    destroyAll: () => {
      for (const t of map.values()) t.destroy();
      base.destroy(true);
    },
  };
}

/** Draws the static ground once into a RenderTexture: one sprite to draw per frame instead of ~1000. */
function buildGround(app: Application, map: TileMap, variant: (base: string, x: number, y: number) => Texture) {
  const scratch = new Container();
  const { terrain, boundary, deco } = map.layers;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      const b = boundary[i];
      // Under boundary trees: grass, so the canopies sit on something.
      const base = b === 'sea' ? 'boundary/sea' : `terrain/${terrain[i]}`;
      const s = new Sprite(variant(base, x, y));
      s.position.set(x * TILE, y * TILE);
      scratch.addChild(s);
      if (deco[i] === 'flower') {
        const f = new Sprite(variant('deco/flower', x, y));
        f.position.set(x * TILE, y * TILE);
        scratch.addChild(f);
      }
    }
  }
  const texture = RenderTexture.create({ width: map.width * TILE, height: map.height * TILE });
  app.renderer.render({ container: scratch, target: texture });
  scratch.destroy({ children: true });
  return { sprite: new Sprite(texture), texture };
}

function tileHash(x: number, y: number): number {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}
