# 09 — Art & Audio

**Owner:** Design/art/audio  
**Depends on:** `03` (tile list), `04` (sprite stages), `01` (actions).

## Decisions (locked)

- **Free asset packs** for art. Stardew-style ¾ top-down pixel art.
- **Music + SFX**.
- Strong visual states for world health (see the `04` table). The art has to make every state readable.

## Art

**Art direction:** [`docs/art/art-direction.md`](../art/art-direction.md) has the pillars, palette, filters, plot stages and the floating-island title.

**Chosen (open question 1, settled):** **Ninja Adventure** (CC0) as the one pack family, and **Kyrise's 16x16 icons** (CC BY 4.0) for the HUD. 16 px tiles at 3× scale. See `ASSETS.md`.

### Asset pack sourcing (check every licence before use)

Candidates to evaluate (confirm current licence terms. Some free tiers are non-commercial only):
- **Kenney.nl** top-down / RPG packs (CC0)
- **Sprout Lands** (Cup Nooble, itch.io): Stardew-like farming
- **Ninja Adventure** pack (CC0): characters, tiles, UI, also has music/SFX
- OpenGameArt farming tilesets

**Rule:** one pack family for terrain + characters, so the pixel scale and palette match.
Record every asset and its licence in `ASSETS.md` (credit requirements).

### Sprite list (must-have)

| Category | Sprites / states |
|---|---|
| Terrain | grass, dirt, path, sand, shallow + deep water, shoreline transitions |
| Boundary | Forest: dense tree tiles; Island: sea + waves |
| Deco | rocks, bushes, flowers, stumps |
| Player | 4-direction walk + idle; action pose (one generic "work" frame is enough) |
| Field | empty, sown, growing, ripe, rotten |
| Orchard | empty plot, sapling, young tree, fruiting tree, worn (yellow), dead stump |
| Reservoir | cracked/dry, low, full; crack overlay |
| Well | empty site, dug (clear), stagnant (green) |
| Wild spot | fish/deer abundance: many, few, none |
| Food store | full / half / empty / rotting (flies) |
| Lectern + open book | in-world object |
| Graveyard | fence, gravestone variants (3–4 shapes for variety) |
| Weather/event | drought cracked-ground overlay, rain particles |
| FX | harvest pop, splash, flies, blight motes |
| UI | pixel panel/frame, buttons, icons for food/water/stamina + 8 action icons, clock dial |
| Journal | book spread background, paper texture |
| Fonts | a pixel font for UI (e.g. a free OFL pixel font) + a handwriting-style font for journal text (check the licence) |

### Visual identity

- Palette: from the art direction (Pokémon BW-style bright day, peach/plum dusk). Blight = desaturation + ochre shift (done as a filter so no extra sprites are needed).
- Title, landing and gallery: each world shown as a **floating island** in a teal sky.
- Logo/title: "INHERITANCE" in a pixel display font, maybe with a sapling/gravestone motif.

## Audio

### Music
- **Day loop**: gentle acoustic/lo-fi farming loop.
- **Night/ending sting**: softer, as time runs out (crossfade at dusk).
- **Journal/graveyard theme**: quiet, reflective (piano/music box).
- **Replay theme**: can reuse the journal theme.

### SFX list

| SFX | Where |
|---|---|
| Footsteps (grass/dirt) | Walking |
| Dig / plant | Plant Crops, Plant Orchard, Dig Well |
| Harvest pop | Harvest |
| Splash / reel | Fish (Island) |
| Rustle / bow | Hunt (Forest) |
| Hammer / stone | Repair Reservoir, Maintain |
| Whoosh / chime | Fast Track |
| Denied buzz | Invalid action |
| Clock tick / bell | Last 10 seconds / time-up freeze |
| Page turn | Journal |
| Pen scratch | Drawing / typing in the journal |
| Seal thud | "Seal page" |
| Stone rise | Gravestone placement |
| UI click | Buttons |

Sources: Kenney audio packs (CC0), Freesound (check CC-BY attribution), OpenGameArt, the Ninja Adventure pack.

### Implementation notes
- Use **Howler.js** (or Web Audio) with an audio sprite sheet for SFX.
- Browsers block autoplay: start music on the first user interaction (Play button).
- A global mute toggle that persists in `localStorage`.

## Tasks

- [x] **[C]** Evaluate 2–3 packs and pick one family. Write `ASSETS.md` with licences.
- [x] **[C]** Build the Pixi spritesheet/atlas (TexturePacker free / `free-tex-packer`) + JSON *(Built by our own script instead: `npm run atlas` crops frames listed in `scripts/atlas-manifest.ts` from `art/source/`, recolours them to the palette and writes `public/assets/atlas/world.png` + `.json`. The renderer loads it in `src/render/atlas.ts`; any frame it lacks keeps B's painted placeholder.)*
- [x] **[C]** Map `03` tile types → atlas frames (agree the names with the engine dev) *(All `terrain`, `boundary` and `deco` IDs. Wall trees are 2×2 tiles, centred on their tile. The player is Villager4, chosen by C.)*
- [ ] **[C]** Map `04` visual states → frames
- [ ] **[C]** Gravestone variants + graveyard layout
- [ ] **[C]** Journal book art + fonts
- [ ] **[C]** UI kit: panel, button, icons (food/water/stamina + 8 actions)
- [ ] **[C]** Blight/drought filters (with frontend)
- [ ] **[C]** Pick music tracks (day, night, reflective) + licences
- [ ] **[C]** SFX set + audio sprite
- [ ] **[C]** Title/logo
- [ ] **[C]** Favicon

## Acceptance

- Every plot state in `04` has a distinct, readable sprite at 1× zoom.
- All assets are licensed for a public hackathon demo, with credits recorded.

## Open questions

1. Which pack family? (Decide early, because the tile size depends on it: 16×16 vs 32×32.)
2. Original music, or licensed free tracks only?
3. Should the avatar's appearance vary per player (colour tint by username hash)?
