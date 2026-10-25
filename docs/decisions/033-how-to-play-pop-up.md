# 033 — The tutorial is a "How to play" pop-up with four pictures

**Status:** decided 2026-10-25 by the user, built by B · **Changes:** `08` › Onboarding/tutorial (was a guided
tutorial scene, C's task) · **Settles:** `08` › Open question 1 (mandatory or skippable), and makes question 2 moot

## Decision

- **One pop-up, four pictures in a 2×2 grid**, each with the prompt you'd see there and one line on what to do:
  1. sow and water, 2. fill the can, 3. harvest (and that a crop left too long rots), 4. eat at the oven.
  A line beside the button says how to walk.
- **The pictures are live crops of the game**, drawn by the game's own renderer from a fixed tutorial world
  (`TUTORIAL_SEED` 123, Forest) with the tiles set to the right stages, so they keep up with the art. They're drawn
  once per page load, off-screen, the first time the pop-up opens.
- **When it shows:** by itself on a browser's first day of play (remembered in `localStorage`), and from a
  "How to play" button under the clock at any time. It closes with Got it or Esc. **While it's open the clock stops**
  and the lock's heartbeat runs, as for the journal. `#/tutorial` shows it on its own over the sky.
- **What it says:** how to act, never how long anything takes (`inheritance-player-facing` › Tutorial). Words are in
  `docs/content/flavour-text.md` › How to play.

## Consequences

- `08` "[C] Tutorial scene" is done this way, by B. C reviews the words.
- **Renderer (B):** the still (replay) mode gains `frame`, `player` and `mark`, and `src/render/snapshot.ts` draws one
  still to a PNG. **Store (B):** `helpOpen` stops the clock like `journalOpen`.
- **App shell (C):** the router gains the `tutorial` route. The kit is unchanged; the pop-up widens its own dialog
  from `src/ui/tutorial/how-to-play.css`.
