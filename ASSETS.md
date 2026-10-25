# Assets and licences

Every art, audio and font asset in the repo has a row here, added in the same PR as the files.
Art direction: [`docs/art/art-direction.md`](docs/art/art-direction.md).

## In the repo

| File(s) | Source URL | Author | Licence | Credit required? | Modified? |
|---|---|---|---|---|---|
| `public/assets/atlas/world.png` + `world.json`: terrain, sea, wall trees, deco, gravestones (frames listed in `scripts/atlas-manifest.ts`) | https://pixel-boy.itch.io/ninja-adventure-asset-pack (`Backgrounds/Tilesets/TilesetFloor.png`, `TilesetWater.png`, `TilesetNature.png`, `TilesetElement.png`) | Pixel-Boy & AAA | CC0 1.0 | No (appreciated) | **Yes**: cropped, recoloured to the art-direction palette, one tile mirrored |
| `public/assets/atlas/world.png`: player walk frames | https://pixel-boy.itch.io/ninja-adventure-asset-pack (`Actor/Character/Villager4/SeparateAnim/Walk.png`) | Pixel-Boy & AAA | CC0 1.0 | No (appreciated) | Cropped only |
| `public/assets/atlas/world.png`: plot stages, house, furniture, food store, lectern, graveyard fence, drought cracks (composed in `scripts/art/compose.ts`) | https://pixel-boy.itch.io/ninja-adventure-asset-pack (`TilesetField.png`, `TilesetFloorDetail.png`, `TilesetElement.png`, `TilesetNature.png`, `TilesetHouse.png`, `TilesetWater.png`, `tileset_bed.png`, `Interior/TilesetInteriorFloor.png`, `Interior/TilesetWallSimple.png`, `Actor/Animal/WildBoar/SpriteSheet.png`) | Pixel-Boy & AAA | CC0 1.0 | No (appreciated) | **Yes**: cropped, recoloured, layered and partly redrawn; some frames (well, reservoir basin, fieldstone, fish) drawn by C |
| `public/assets/atlas/ui.png` + `src/ui/kit/ui-atlas.json`: food, crop and orchard, fish and bow icons | https://kyrise.itch.io/kyrises-free-16x16-rpg-icon-pack (`fruit_01a`, `leaf_01a`, `fish_01a`, `bow_01a`) | Kyrise | CC BY 4.0 | **Yes** (see Credits) | Centred on a 16 px square only |
| `public/assets/atlas/ui.png`: water, tool, hourglass, sun and moon icons | https://pixel-boy.itch.io/ninja-adventure-asset-pack (`Items/Resource/Water.png`, `Items/Tool/*.png`, `Items/Object/Hourglass.png`, `Ui/Skill Icon/Meteo/Sun.png`, `Moon.png`) | Pixel-Boy & AAA | CC0 1.0 | No (appreciated) | Centred only. The stamina bolt is drawn by C |
| `public/assets/audio/music/day`, `dusk`, `reflective` (`.webm` + `.mp3`) | https://pixel-boy.itch.io/ninja-adventure-asset-pack (`Audio/Musics/5 - Peaceful.ogg`, `9 - Quiet.ogg`, `16 - Melancholia.ogg`) | Pixel-Boy & AAA | CC0 1.0 | No (appreciated) | Re-encoded and loudness-normalised |
| `public/assets/audio/sfx.webm` + `sfx.mp3` + `src/audio/sfx-sprite.json` (sounds listed in `scripts/audio-manifest.ts`) | https://pixel-boy.itch.io/ninja-adventure-asset-pack (`Audio/Sounds/*`) | Pixel-Boy & AAA | CC0 1.0 | No (appreciated) | Normalised, gain-adjusted and joined into one sprite |
| `public/assets/journal/cover.png`, `paper.png`, `public/favicon-*.png`, `apple-touch-icon.png` | — | C (this repo) | Same as the repo | No | Drawn in code (`scripts/art/compose.ts`) |
| `public/assets/video/trailer.mp4`, `trailer-poster.jpg`: the presentation's trailer | — | The team (this repo): a screen recording of the game, so its art and sound are the rows above | Same as the repo | No | Re-encoded for the web (H.264, 6 MB); the poster is a frame at 8 s |
| `public/assets/fonts/NinjaAdventure-Normal.ttf` (from `Ui/Font/NormalFont.ttf`) | https://pixel-boy.itch.io/ninja-adventure-asset-pack | Pixel-Boy & AAA | CC0 1.0 | No (appreciated) | Renamed only |
| `public/assets/fonts/PatrickHand-Regular.ttf` (+ `PatrickHand-OFL.txt`) | https://github.com/google/fonts/tree/main/ofl/patrickhand | Patrick Wagesreiter | SIL OFL 1.1 | No (licence file ships with the font) | No |

## Rebuilding

The raw packs live in `art/source/` (git-ignored). With them downloaded, `npm run atlas` rebuilds the world and UI
atlases, the journal images and the favicons, and `npm run audio` rebuilds the music and SFX (it uses the
`ffmpeg-static` dev dependency).

## Credits (shown in the game)

- Icons by **Kyrise** (kyrise.itch.io), CC BY 4.0
- Art, music and sound from **Ninja Adventure** by Pixel-Boy & AAA (pixel-boy.itch.io), CC0
