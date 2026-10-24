# 015 — Music: free pack tracks, not original

**Status:** decided 2026-10-24 by C · **Section:** `09` Q2

## Context

`09` asked whether the game gets original music or licensed free tracks. Nobody on the team is composing in the
48 hours, and the art pack we already use (Ninja Adventure, CC0) ships 40 music loops.

## Options

1. **Original music.** Most distinctive, but someone has to compose and mix three loops during the hackathon.
2. **Free licensed tracks from elsewhere** (Freesound, OpenGameArt). Wider choice, but each needs a licence check and
   usually a credit, and the style may not match the art.
3. **Tracks from the Ninja Adventure pack.** CC0, same authors as the art, so the mood matches; no credit required.

## Decision

Option 3. Three loops, chosen by title (not yet listened to by the team, so they may change):

| Slot | Track | Where |
|---|---|---|
| `day` | `5 - Peaceful` | During the turn |
| `dusk` | `9 - Quiet` | Crossfades in from 7 pm on the turn clock ([012](012-day-night-clock.md)) |
| `reflective` | `16 - Melancholia` | Journal, graveyard, replay |

## Consequences

- Swapping a track is one line in `scripts/audio-manifest.ts` and `npm run audio`.
- Music starts on the first click or key press (browser autoplay rules) and respects the mute toggle.
- If someone does compose later, the slots and the player stay; only the files change.
