import { Application, ColorMatrixFilter, Container, Graphics, Rectangle, RenderTexture, Sprite, Texture, TextureSource } from 'pixi.js';
import type { Gravestone } from '../api/Backend';
import { CONFIG, TILED_KINDS, tileId, tileOf, type ActionType } from '../engine';
import { isTimeUp, useGameStore } from '../store/game';
import { BASE_OPTIONS, buildCollision, FOUNDER_STAGE, type House, type Plot, type PlotId, type TileMap } from '../worldgen';
import { cameraOffset, pickZoom } from './camera';
import { FIXED_STEP, INDOOR_DARKNESS, NIGHT_LIGHT_TILES, TILE, VIEW_TILES_INSIDE, WALK_SPEED, WEAKENED_WALK } from './constants';
import { gameHour, lightAt } from './daylight';
import { createFx } from './fx';
import { layoutStones, nearestStone, type StoneSpot } from './graveyard';
import { KeyboardInput } from './input';
import { interactTarget } from './interact';
import { stepWalker, type CollisionGrid, type Walker } from './movement';
import { P, paintAtlas, paintPlot, VARIANTS } from './placeholder-art';

// Pixel art: never smooth when scaling.
TextureSource.defaultOptions.scaleMode = 'nearest';

/** Plots drawn flat on the ground. Everything else is y-sorted with the player. */
const FLAT_PLOTS = new Set<Plot['kind']>(['field', 'wild']);

/** Seconds the roof takes to lift (and the camera to zoom) when you go in or out. */
const ROOF_FADE = 0.35;
/** How dark the outside gets while you're in the house. */
const OUTSIDE_DIM = 0.6;
/** End of turn (05): seconds to pan to the graveyard, to wait, and for your stone to rise. */
const PAN_TIME = 1.4;
const RISE_DELAY = 0.4;
const RISE_TIME = 1.8;

/**
 * What the world looks like: visual stages and flags only, from `visibleView()` (02). No numbers,
 * due dates or causes ever reach the renderer.
 */
export interface WorldLook {
  /**
   * Stage per plot ID (`ids.md`), and per tile for fields and orchards (`field-1:0,2`, decision
   * 019). Plots and tiles left out keep their founder stage.
   */
  plots: Record<PlotId, string>;
  /** Food store stage, shown by the cabinet: full | half | empty | rotting. */
  store: string;
  weakened: boolean;
  drought: boolean;
  /** Hunger has run out: the player walks slower (decision 016). */
  hungry: boolean;
}

export interface WorldView {
  setLook(look: WorldLook): void;
  /** Pause movement while a DOM overlay is open. */
  setInputPaused(paused: boolean): void;
  /** The graveyard's stones, one per committed turn (05). */
  setStones(stones: Gravestone[]): void;
  /** End of turn: pans to the graveyard and raises this stone. Resolves once it has risen. */
  raiseStone(stone: Gravestone): Promise<void>;
  /** A pop or splash where an action landed. */
  actionFx(type: ActionType, plotId: PlotId | undefined): void;
  /** The next generation wakes up: player back at the spawn, camera back on them. */
  newTurn(): void;
  /** Frames per second, for the perf readout. */
  fps(): number;
  destroy(): void;
}

/** Founder looks: every plot (and field and orchard tile) at its gen-1 stage, store half full, no flags. */
export function founderLook(map: TileMap): WorldLook {
  return {
    plots: Object.fromEntries(map.plots.flatMap((p) => lookIds(p).map((id) => [id, defaultStage(p)]))),
    store: 'half',
    weakened: false,
    drought: false,
    hungry: false,
  };
}

/** The ids a plot's look is keyed by: its tiles for fields and orchards, itself otherwise. */
export function lookIds(p: Plot): PlotId[] {
  if (!TILED_KINDS.has(p.kind)) return [p.id];
  const ids: PlotId[] = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) ids.push(tileId(p.id, x, y));
  return ids;
}

function defaultStage(p: Plot): string {
  return FOUNDER_STAGE[p.kind] ?? (p.kind === 'wild' ? 'many' : 'default');
}

/**
 * Builds the playable world into an initialised Pixi `Application`:
 *   world (scaled + camera offset, colour filter: time of day, weakened, drought)
 *   ├─ ground    terrain, ponds, sea, flowers (+ drought cracks): baked into one RenderTexture
 *   ├─ flat      flat plots (fields, wild spot) and the house floor
 *   ├─ sorted    trees, bushes, rocks, structures, furniture, the house shell, gravestones and
 *   │            the player, y-sorted by their bottom edge
 *   ├─ fx        blight motes, rot flies
 *   └─ dim       darkens everything but the house while you're inside
 *   night        screen-space darkness with a soft light round the player
 *   frozen       screen-space dim once time is up
 */
export function createWorldView(
  app: Application,
  map: TileMap,
  initialLook: WorldLook = founderLook(map),
  /** Frames from C's atlas (`loadWorldAtlas`); any name it lacks uses the painted placeholder. */
  art: Record<string, Texture> = {},
): WorldView {
  const atlas = buildAtlas(art);
  const frame = (name: string) => atlas.get(name) ?? atlas.get('missing')!;
  const variant = (base: string, x: number, y: number) => frame(`${base}-${1 + (tileHash(x, y) % (VARIANTS[base] ?? 1))}`);

  const world = new Container();
  const flat = new Container();
  const sorted = new Container({ sortableChildren: true });
  const dim = new Graphics();
  const groundSprite = new Sprite();
  const fx = createFx();
  // The faced tile's outline sits on the ground; the work bar over the player's head.
  const marker = new Graphics();
  const progress = new Graphics();
  world.addChild(groundSprite, flat, marker, sorted, progress, fx.layer, dim);
  const lightTexture = Texture.from(paintLightHole());
  lightTexture.source.scaleMode = 'linear'; // a smooth gradient, the one non-pixel-art texture
  const night = new Sprite(lightTexture);
  night.anchor.set(0.5);
  const frozen = new Graphics();
  frozen.alpha = 0;
  app.stage.addChild(world, night, frozen);
  const colour = new ColorMatrixFilter();
  world.filters = [colour];

  // Tall things on the sorted layer, each sorted by its bottom edge.
  const { boundary, deco } = map.layers;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      const tall = boundary[i] === 'tree' ? variant('boundary/tree', x, y) : deco[i] && deco[i] !== 'flower' ? variant(`deco/${deco[i]}`, x, y) : null;
      if (!tall) continue;
      const s = bottomAnchored(tall, x, y + 1);
      // Pack trees are two tiles wide: centre anything wider than a tile on its own tile.
      s.x -= (tall.width - TILE) / 2;
      sorted.addChild(s);
    }
  }

  // Plots: one sprite each, re-textured when their stage changes.
  // C's atlas has plot art for the default plot sizes (wild spots per biome); other sizes keep the
  // painted frames.
  const plotTextures = new Map<string, Texture>();
  const plotTexture = (p: Plot, stage: string) => {
    const std = BASE_OPTIONS.plotSizes[p.kind];
    const drawn = std.w === p.w && std.h === p.h ? (art[`${p.kind}/${stage}-${map.biome}`] ?? art[`${p.kind}/${stage}`]) : undefined;
    if (drawn) return drawn;
    const key = `${p.kind}/${stage}/${p.w}x${p.h}`;
    let tex = plotTextures.get(key);
    if (!tex) {
      tex = Texture.from(paintPlot(p.kind, stage, p.w, p.h, map.biome));
      plotTextures.set(key, tex);
    }
    return tex;
  };
  // Field and orchard tiles (decision 019): a field tile is its cell of the 3×3 field frame (edge
  // cells for edge tiles, so any size keeps its border); a tree is drawn on its own tile.
  // Cells cut from the atlas share its source, which the asset loader owns: they're released
  // without it (`atlasCells`), while painted tiles own theirs (`plotTextures`).
  const atlasCells = new Map<string, Texture>();
  const tileTexture = (p: Plot, x: number, y: number, stage: string) => {
    const tree = p.kind === 'orchard' ? art[`orchard/tree-${stage}`] : undefined;
    if (tree) return tree;
    const key = `${p.kind}/${stage}@${p.kind === 'field' ? `${edge(x, p.w)},${edge(y, p.h)}` : 'tree'}`;
    const cached = atlasCells.get(key) ?? plotTextures.get(key);
    if (cached) return cached;
    const whole = p.kind === 'field' ? art[`field/${stage}`] : undefined;
    if (whole) {
      const f = whole.frame;
      const cell = new Rectangle(f.x + edge(x, p.w) * TILE, f.y + edge(y, p.h) * TILE, TILE, TILE);
      const tex = new Texture({ source: whole.source, frame: cell });
      atlasCells.set(key, tex);
      return tex;
    }
    const tex = Texture.from(paintPlot(p.kind, stage, 1, 1, map.biome));
    plotTextures.set(key, tex);
    return tex;
  };
  const tileSprites = new Map<PlotId, { plot: Plot; x: number; y: number; sprite: Sprite }>();

  const plotSprites = new Map<PlotId, Sprite>();
  for (const plot of map.plots) {
    if (TILED_KINDS.has(plot.kind)) {
      // Row by row from the top, so a lower tile draws over anything overhanging from the row above.
      for (let y = 0; y < plot.h; y++) {
        for (let x = 0; x < plot.w; x++) {
          const s = bottomAnchored(tileTexture(plot, x, y, defaultStage(plot)), plot.x + x + 0.5, plot.y + y + 1);
          s.anchor.x = 0.5;
          s.label = tileId(plot.id, x, y);
          if (FLAT_PLOTS.has(plot.kind)) flat.addChild(s);
          else {
            s.zIndex -= 0.5;
            sorted.addChild(s);
          }
          tileSprites.set(s.label, { plot, x, y, sprite: s });
        }
      }
      continue;
    }
    // Bottom-centre, so art wider than the footprint (orchard canopies) spills evenly.
    const s = bottomAnchored(plotTexture(plot, defaultStage(plot)), plot.x + plot.w / 2, plot.y + plot.h);
    s.anchor.x = 0.5;
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

  // Graveyard: the stones sit just in front of the fenced plot and sort among themselves.
  const graveyard = map.plots.find((p) => p.kind === 'graveyard') ?? null;
  /** A plot's or tile's footprint in tiles. */
  const rectOf = (id: PlotId) => {
    const tile = tileOf(id);
    const p = map.plots.find((q) => q.id === (tile?.plot ?? id));
    if (!p) return null;
    return tile ? { x: p.x + tile.x, y: p.y + tile.y, w: 1, h: 1 } : p;
  };
  let markedTile: PlotId | null = null;
  const stoneLayer = new Container({ sortableChildren: true });
  if (graveyard) {
    stoneLayer.position.set(graveyard.x * TILE, graveyard.y * TILE);
    stoneLayer.zIndex = (graveyard.y + graveyard.h) * TILE - 0.4;
    sorted.addChild(stoneLayer);
  }
  let stones: Gravestone[] = [];
  let spots: StoneSpot[] = [];
  const stoneSprites = new Map<number, Sprite>();
  let hovered: StoneSpot | null = null;
  const setStones = (next: Gravestone[]) => {
    finishCeremony();
    stones = next;
    spots = graveyard ? layoutStones(graveyard, stones) : [];
    for (const sprite of stoneSprites.values()) sprite.destroy();
    stoneSprites.clear();
    hovered = null;
    for (const spot of spots) {
      const sprite = new Sprite(frame(spot.frame));
      sprite.anchor.set(0.5, 1);
      sprite.position.set(spot.x, spot.y);
      sprite.scale.set(spot.scale);
      sprite.zIndex = spot.y;
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';
      sprite.on('pointerover', () => (hovered = spot));
      sprite.on('pointerout', () => hovered === spot && (hovered = null));
      sprite.on('pointertap', () => !input.paused && store().openJournal(spot.stone.turn));
      stoneLayer.addChild(sprite);
      stoneSprites.set(spot.stone.turn, sprite);
    }
  };

  // Your stone at the end of the turn: the camera pans over, then it rises out of the ground.
  let panTarget: { x: number; y: number } | null = null;
  let panT = 0;
  let ceremony: { sprite: Sprite; mask: Graphics; baseX: number; baseY: number; t: number; dust: Dust[]; done: () => void } | null = null;
  const finishCeremony = () => {
    if (!ceremony) return;
    ceremony.sprite.mask = null;
    ceremony.sprite.position.set(ceremony.baseX, ceremony.baseY);
    ceremony.mask.destroy();
    ceremony.dust.forEach((d) => d.g.destroy());
    const { done } = ceremony;
    ceremony = null;
    done();
  };
  const raiseStone = (stone: Gravestone) =>
    new Promise<void>((resolve) => {
      if (!graveyard) return resolve();
      setStones([...stones.filter((s) => s.turn !== stone.turn), stone]);
      const sprite = stoneSprites.get(stone.turn)!;
      // Only what's above the ground line shows, so the stone seems to push up through the earth.
      const mask = new Graphics().rect(sprite.x - TILE, sprite.y - 3 * TILE, 2 * TILE, 3 * TILE).fill(0xffffff);
      stoneLayer.addChild(mask);
      sprite.mask = mask;
      const baseY = sprite.y;
      sprite.y = baseY + sprite.height;
      panTarget = { x: (graveyard.x + graveyard.w / 2) * TILE, y: (graveyard.y + graveyard.h / 2) * TILE };
      ceremony = { sprite, mask, baseX: sprite.x, baseY, t: 0, dust: [], done: resolve };
    });
  const updateCeremony = (dt: number) => {
    if (!ceremony) return;
    const c = ceremony;
    c.t += dt;
    const riseAt = PAN_TIME + RISE_DELAY;
    if (c.t >= riseAt && c.dust.length === 0) c.dust = spawnDust(stoneLayer, c.baseX, c.baseY);
    const f = Math.min(1, Math.max(0, (c.t - riseAt) / RISE_TIME));
    c.sprite.y = Math.round(c.baseY + (1 - ease(f)) * c.sprite.height);
    c.sprite.x = c.baseX + (f > 0 && f < 1 && Math.floor(c.t * 20) % 2 ? 1 : 0); // a slight grinding shake
    for (const d of c.dust) {
      d.vy += 40 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.g.position.set(Math.round(d.x), Math.round(d.y));
      d.g.alpha = Math.max(0, 1 - (c.t - riseAt) / 1.2);
    }
    if (f >= 1 && c.t >= riseAt + 1.2) finishCeremony();
  };

  const player = new Sprite(frame('player/walk-down-0'));
  player.anchor.set(0.5, 1);
  sorted.addChild(player);

  let groundTexture: RenderTexture | null = null;
  let bakedDrought: boolean | null = null;
  let look = initialLook;
  const setLook = (next: WorldLook) => {
    look = next;
    if (look.drought !== bakedDrought) {
      groundTexture?.destroy(true);
      groundTexture = bakeGround(app, map, variant, look.drought ? frame('terrain/cracks-1') : null);
      groundSprite.texture = groundTexture;
      bakedDrought = look.drought;
    }
    for (const [id, sprite] of plotSprites) {
      const plot = map.plots.find((p) => p.id === id)!;
      sprite.texture = plotTexture(plot, look.plots[id] ?? defaultStage(plot));
    }
    for (const [id, t] of tileSprites) t.sprite.texture = tileTexture(t.plot, t.x, t.y, look.plots[id] ?? defaultStage(t.plot));
    if (cabinet) cabinet.texture = frame(`store/${look.store}`);
    fx.setMotes(look.weakened);
    // One swarm per plot with anything rotten in it.
    const flySpots = map.plots
      .filter((p) => lookIds(p).some((id) => look.plots[id] === 'rotten'))
      .map((p) => ({ x: (p.x + p.w / 2) * TILE, y: (p.y + p.h / 2) * TILE }));
    if (cabinet && look.store === 'rotting') flySpots.push({ x: cabinet.x + TILE / 2, y: cabinet.y - 20 });
    fx.setFlies(flySpots);
  };
  setLook(initialLook);

  const grid: CollisionGrid = { width: map.width, height: map.height, blocked: buildCollision(map) };
  let walker: Walker = { x: map.spawn.x + 0.5, y: map.spawn.y + 0.9, facing: 'down', moving: false };
  let animTime = 0;
  let accumulator = 0;
  // 0 = outside, 1 = inside with the roof lifted; eased between the two.
  let insideT = house && isInside(house, walker) ? 1 : 0;
  const input = new KeyboardInput();

  let externallyPaused = false;
  let frozenT = 0;

  const update = () => {
    const dt = Math.min(app.ticker.deltaMS / 1000, 0.25);
    // The game loop owns the clock. It stands still while the journal is open (decision 012).
    const store = useGameStore.getState();
    store.advance(dt);
    const { t, turnSeconds, journalOpen } = useGameStore.getState();
    const timeUp = isTimeUp({ t, turnSeconds });
    // Acting takes real turn time: the player stands still while they work (04).
    const busy = t < store.busyUntil || store.fastTrack !== null;
    input.paused = externallyPaused || journalOpen || timeUp || busy;
    const speed = WALK_SPEED * (look.weakened ? WEAKENED_WALK : 1) * (look.hungry ? CONFIG.hungrySpeedMult : 1);

    accumulator += dt;
    while (accumulator >= FIXED_STEP) {
      walker = stepWalker(walker, input.direction(), speed, FIXED_STEP, grid);
      animTime = walker.moving ? animTime + FIXED_STEP : 0;
      accumulator -= FIXED_STEP;
    }
    const step = walker.moving ? Math.floor(animTime * 8) % 4 : 0;
    player.texture = frame(`player/walk-${walker.facing}-${step}`);
    player.position.set(Math.round(walker.x * TILE), Math.round(walker.y * TILE));
    player.zIndex = walker.y * TILE;
    const near = timeUp ? null : interactTarget(map, walker);
    store.setNearby(near, near === 'graveyard' && graveyard ? (nearestStone(graveyard, spots, walker)?.stone ?? null) : null);

    // Outline the tile an action would go to (or is going to), so you can see which one you face.
    const target = store.work?.request.plotId ?? (timeUp || externallyPaused ? null : near);
    const marked = target && tileOf(target) ? target : null;
    if (marked !== markedTile) {
      markedTile = marked;
      marker.clear();
      const r = marked ? rectOf(marked) : null;
      if (r) marker.rect(r.x * TILE + 0.5, r.y * TILE + 0.5, TILE - 1, TILE - 1).stroke({ width: 1, color: P.cloud, alpha: 0.9 });
    }
    // Work takes time (decision 019): a bar over your head fills until the action lands.
    const work = useGameStore.getState().work;
    progress.visible = !!work;
    if (work) {
      const done = Math.min(1, (t - work.from) / Math.max(work.until - work.from, 0.001));
      const [x, y] = [Math.round(walker.x * TILE) - 8, Math.round(walker.y * TILE) - 22];
      progress.clear().rect(x - 1, y - 1, 18, 4).fill(P.ink).rect(x, y, Math.max(1, Math.round(16 * done)), 2).fill(P.cloud);
    }

    if (house) {
      // During the end-of-turn pan the roof goes back on, so the camera can leave the house.
      const target = !panTarget && isInside(house, walker) ? 1 : 0;
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
    const walkFocus = house && e > 0 ? lerpPoint(playerFocus, { x: (house.x + house.w / 2) * TILE, y: (house.y + house.h / 2) * TILE }, e) : playerFocus;
    panT = approach(panT, panTarget ? 1 : 0, dt / PAN_TIME);
    const focus = panTarget ? lerpPoint(walkFocus, panTarget, ease(panT)) : walkFocus;
    const offset = cameraOffset(focus, view, { w: map.width * TILE, h: map.height * TILE }, zoom, dpr);
    world.scale.set(zoom);
    world.position.set(offset.x, offset.y);
    fx.update(journalOpen ? 0 : dt, focus);
    updateCeremony(dt);

    // The hover label is DOM (React); give it the stone's top in canvas px, following the camera.
    const hoverSprite = hovered && !input.paused ? stoneSprites.get(hovered.stone.turn) : undefined;
    if (hovered && hoverSprite) {
      const at = hoverSprite.getGlobalPosition();
      store.setHoveredStone({ ...hovered.stone, x: Math.round(at.x), y: Math.round(at.y - hoverSprite.height * zoom) });
    } else store.setHoveredStone(null);

    // Light: the day tint multiplies with the weakened/drought looks; night darkens round a soft light.
    const light = lightAt(gameHour(t, turnSeconds));
    colour.reset();
    if (look.weakened) {
      colour.saturate(-0.5, true);
      colour.tint(0xf0e0c0, true); // a tired ochre cast
    }
    if (look.drought) colour.tint(0xffe6cc, true); // warm, dry light
    if (light.tint !== 0xffffff) colour.tint(light.tint, true);
    const darkness = light.darkness * lerp(1, INDOOR_DARKNESS, insideT);
    night.visible = darkness > 0.01;
    night.alpha = darkness;
    night.tint = light.shade;
    night.position.set(offset.x + walker.x * TILE * zoom, offset.y + (walker.y - 0.6) * TILE * zoom);
    night.scale.set((NIGHT_LIGHT_TILES * TILE * zoom) / LIGHT_HOLE_RADIUS);

    // Time up: lock input (above) and dim the world; the end-of-turn flow (05) takes over from here.
    // The dim lifts again while your stone rises, so it can be seen.
    frozenT = approach(frozenT, timeUp && !panTarget ? 1 : 0, dt / 0.6);
    if (frozenT > 0) frozen.clear().rect(0, 0, view.w, view.h).fill(0x101418);
    frozen.alpha = 0.45 * frozenT;
  };
  app.ticker.add(update);

  return {
    setLook,
    setInputPaused: (paused) => {
      externallyPaused = paused;
    },
    setStones,
    raiseStone,
    actionFx: (type, plotId) => {
      const r = plotId ? rectOf(plotId) : null;
      const at = r ? { x: (r.x + r.w / 2) * TILE, y: (r.y + r.h / 2) * TILE } : { x: walker.x * TILE, y: (walker.y - 1) * TILE };
      fx.burst(SPLASH_ACTIONS.has(type) ? 'splash' : 'pop', at.x, at.y);
    },
    newTurn: () => {
      finishCeremony();
      panTarget = null;
      panT = 0;
      walker = { x: map.spawn.x + 0.5, y: map.spawn.y + 0.9, facing: 'down', moving: false };
      insideT = house && isInside(house, walker) ? 1 : 0;
    },
    fps: () => app.ticker.FPS,
    destroy: () => {
      app.ticker.remove(update);
      input.destroy();
      finishCeremony();
      store().setNearby(null);
      store().setHoveredStone(null);
      world.destroy({ children: true });
      night.destroy();
      frozen.destroy();
      lightTexture.destroy(true);
      colour.destroy();
      groundTexture?.destroy(true);
      for (const t of plotTextures.values()) t.destroy(true);
      for (const t of atlasCells.values()) t.destroy(false);
      atlas.destroyAll();
    },
  };
}

const store = () => useGameStore.getState();

/** Actions that put water in the ground get a splash; the rest a pop. */
const SPLASH_ACTIONS = new Set<ActionType>(['plantCrops', 'plantOrchard', 'digWell', 'repairReservoir']);

interface Dust {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** A few specks of earth thrown up round the stone's base. Fixed spread, no randomness needed. */
function spawnDust(layer: Container, x: number, y: number): Dust[] {
  return [-7, -4, -2, 2, 4, 7].map((dx, i) => {
    const g = new Graphics().rect(0, 0, 1, 1).fill(i % 2 ? P.dirt : P.ledge);
    g.zIndex = y + 1;
    layer.addChild(g);
    return { g, x: x + dx, y: y - 1, vx: dx * 2.5, vy: -18 - (i % 3) * 6 };
  });
}

/** Radius (canvas px) of the clear hole in the night texture; the texture is 16× wider than it. */
const LIGHT_HOLE_RADIUS = 64;

/** White everywhere except a soft round hole in the middle, for the night overlay (tinted and faded at runtime). */
function paintLightHole(): HTMLCanvasElement {
  const size = LIGHT_HOLE_RADIUS * 32;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, LIGHT_HOLE_RADIUS * 0.35, size / 2, size / 2, LIGHT_HOLE_RADIUS * 1.6);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
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

/** Which cell of a 3×3 frame a tile takes: the first cell for the first tile, the last for the last, the middle between. */
function edge(i: number, n: number): number {
  return i === 0 ? 0 : i === n - 1 ? 2 : 1;
}

function bottomAnchored(tex: Texture, x: number, bottomY: number): Sprite {
  const s = new Sprite(tex);
  s.anchor.set(0, 1);
  s.position.set(x * TILE, bottomY * TILE);
  s.zIndex = bottomY * TILE;
  return s;
}

function buildAtlas(art: Record<string, Texture>) {
  const painted = paintAtlas();
  const base = Texture.from(painted.canvas);
  const frames = new Map<string, Texture>();
  for (const [name, f] of Object.entries(painted.frames)) {
    frames.set(name, new Texture({ source: base.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }));
  }
  return {
    get: (name: string) => art[name] ?? frames.get(name),
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
