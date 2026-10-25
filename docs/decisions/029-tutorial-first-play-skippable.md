# 029: The tutorial runs before a first Play, can be skipped, and gives no hint about delays

**Status:** decided 2026-10-25 by the user · **Settles:** `08` open questions 1 and 2

## Context

`08` left two questions about the tutorial: whether it is mandatory, and whether planting an orchard may say
"This will take longer than you have." Since `13`, orchards are emergent and the tutorial teaches sow, water, fill the
can and harvest instead.

## Options

1. **First Play, skippable, no hint.**
2. First Play, skippable, with the hint.
3. Never forced: a link on the landing page only.

## Decision

Option 1. The first Play on a browser opens `#/tutorial?then=play`; Skip is always on screen and goes straight on to
Play. Finishing or skipping is remembered in `localStorage` (`inheritance.tutorialSeen`); if storage is blocked it isn't
shown. The landing page has a **How to play** link to it at any time. **No line hints at hidden effects**: nothing
says how long anything takes or what it will become.

## Consequences

- The tutorial is the real game on a fixed forest world (seed 123) with a 4-minute day, so a watered tile ripens about
  a minute later. The journal and graveyard steps fill that wait. It runs to about two minutes, longer than the 30–45 s
  `08` hoped for; a shorter day would make the crop ripen sooner but leave less time to walk.
- One quiet generation is played first so the journal and the graveyard have someone in them ("Wren"). The player
  starts with the founder's stores.
- Nothing is saved and no account is needed.
- Wording: `docs/content/flavour-text.md` › Tutorial.
