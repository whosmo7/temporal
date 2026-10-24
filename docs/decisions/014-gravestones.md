# 014: Gravestones show the name and generation, and can be read with E

**Status:** accepted (B, 2026-10-24) · **Settles:** `05` open question 3 · **Changes:** `05` › Graveyard, `03` › Collision

## Context

`05` asked whether a gravestone shows the generation number as well as the name. Stones are 16 px sprites, so any text has
to go in the hover label. The spec also only gave mouse access (hover → name, click → page), while the rest of the game is
played from the keyboard.

## Decision

- **The hover label reads "AL · Generation 2"**: the player's name and the generation they played. It tells a successor which
  page goes with which stone and in what order people came, and nothing about what they did.
- **Walking up to the graveyard and pressing E** opens the journal at the **nearest stone's page**. The prompt names the
  person: "E · Read AL's page". Clicking a stone does the same.
- **The graveyard is solid**, like the other structures, so you read the stones from outside the fence instead of walking
  over them.
- **Layout** (`src/render/graveyard.ts`): oldest at the back left, in rows. The spacing tightens as the plot fills, and past
  a dozen or so stones they're drawn at half size, so 80 generations still fit the fixed 4×3 plot. A stone only moves
  when the spacing changes.
- **Your stone** rises out of the ground at the end of your turn, after the camera pans to the graveyard (`05` › End-of-turn).

## Consequences

- The label is new player-facing text, along with the graveyard prompt and "Generation N is over." C may want to reword them
  (`docs/content/flavour-text.md`).
- `JournalModal` takes an optional `openAt` (a generation) in read mode, so a stone can open its own page.
