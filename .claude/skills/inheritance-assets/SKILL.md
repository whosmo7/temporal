---
name: inheritance-assets
description: Conventions for INHERITANCE art and audio in the temporal repo. Covers choosing free asset packs, recording licences in ASSETS.md, atlas and frame naming that matches engine stage IDs, tile size, palette and blight filters, the UI kit, fonts, music and SFX lists, and Howler audio sprites. Use this whenever you add, replace, name, pack or credit a sprite, tileset, icon, font, music track or sound effect, map tiles or plot stages to frames, or style UI to match the pixel art.
---

# Art & audio

The art has to make the world readable without any text (see `inheritance-player-facing`), and every
asset has to be legally usable at a public demo. Spec and full sprite/SFX lists are in `docs/plan/09-art-and-audio.md`.

## Licences first

- Use free packs only (decided). Prefer CC0 (Kenney, Ninja Adventure). For anything else, read the
  licence page before downloading. Some "free" packs forbid redistribution or need credits.
- **Every asset gets a row in `ASSETS.md`** in the same PR that adds it:

  | File(s) | Source URL | Author | Licence | Credit required? | Modified? |
  |---|---|---|---|---|---|

- If the licence is unclear, don't add the asset. Raise it with the user.

## One look

- **One pack family** for terrain, characters and structures, so the pixel size and palette match. The tile
  size (16 or 32 px) follows from that choice and is recorded in `ASSETS.md` and `src/render/constants.ts`.
- Mix in assets from another pack only after recolouring them to the main palette.
- Blight, drought and night are **filters on top of normal sprites** (desaturate, warm tint,
  darkening), not extra sprite sets. That keeps the art workload manageable and the states consistent.

## Naming (must match engine IDs)

Frame names come straight from `inheritance-core/references/ids.md`, so code never needs a lookup table:

```
terrain/<grass|dirt|path|sand|water-shallow|water-deep|shore-n|shore-ne|…>
boundary/<tree-1|tree-2|sea|wave-1|…>
deco/<rock-1|bush-1|flower-1|stump-1|…>
<plotKind>/<stage>      e.g. field/ripe, orchard/sapling, well/stagnant, reservoir/cracked, wild/few
store/<full|half|empty|rotting>
player/<walk|idle|work>-<down|up|left|right>-<frame>
grave/<1|2|3|4>
fx/<pop|splash|fly|mote>-<frame>
ui/<panel|button|button-pressed|icon-food|icon-water|icon-stamina|icon-harvest|…>
```

- Lowercase and hyphens, with no spaces or version suffixes.
- Any new stage in the engine needs a frame with the same name before it ships. Until then, use a
  clearly ugly placeholder frame named the same, so missing art is obvious, not silent.

## Packing

- Source images go in `art/source/`; packed atlases (`.png` + `.json`) go in `public/assets/atlas/`.
- Use a free packer (`free-tex-packer` or TexturePacker free) with padding ≥ 2 px and trimming off for tiles.
- Keep sizes power-of-two and at most 2048×2048 per atlas.

## UI kit and fonts

- `src/ui/kit/` components use `ui/*` frames (9-slice panels) and the pixel font, so DOM overlays match the world.
- Two fonts: a pixel font for UI and a handwriting-style font for journal text. Both need an OFL or similar
  licence, self-hosted in `public/assets/fonts/` and listed in `ASSETS.md`.

## Audio

- Music: a day loop, a night/dusk loop (crossfade near the end of the turn) and a reflective theme for the journal, graveyard and replay.
- SFX are packed into one Howler audio sprite (`public/assets/audio/sfx.webm` + `.mp3` + `sfx.json`), keyed by
  the action or event name in `ids.md` where one exists (`harvest`, `plantCrops`, `fastTrack`, …) plus `ui-click`,
  `deny`, `tick`, `bell`, `page`, `pen`, `seal`, `stone`, `footstep-1…n`.
- Start music only after the first click (browser autoplay rules). Mute state lives in `localStorage`, wrapped in try/catch.
- Normalise loudness so SFX sit clearly above music without clipping.
