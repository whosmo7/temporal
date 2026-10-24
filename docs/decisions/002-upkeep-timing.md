# 002 — Upkeep timing: keep the screen order, show the need in the HUD

**Status:** decided 2026-10-24 by C (game design) · **Section:** `01` Q1, `04` Q2

## Context
`01` asked whether upkeep should be checked *before* the journal, so a player knows whether they've failed while writing.
The end flow (freeze → journal → cost summary → gravestone) is locked in `00`.

## Options
1. Move the upkeep result before the journal. That changes a locked flow.
2. Keep the order and show nothing. The player finds out after sealing their page.
3. Keep the order, and show "Needed by nightfall: 12🍎 10💧" in the HUD during play.

## Decision
Option 3. The engine computes upkeep at freeze (`endTurn`). The cost summary shows the result after the journal.
During play the HUD shows what's needed by nightfall next to the current food and water counts.

## Consequences
- Players can tell from the HUD whether they're short, and can write about it in their page.
- This also answers `04` open question 2 (show the upkeep reminder: yes).
- No change to the locked end-flow order.
