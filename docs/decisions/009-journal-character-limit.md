# 009 — Journal pages: 400 characters

**Status:** decided 2026-10-24 by C · **Section:** `05` Q3

## Context
A journal page holds free text plus a drawing. The text needs a limit so a page fits the right-hand page of the
book at 1280×720 without scrolling, and so the stored page stays small.

## Options considered
280 (tweet length, more room for the sketch), **400** (the plan's placeholder), 600 (a short letter; needs a
smaller font or scrolling).

## Decision
**400 characters**, as one constant: `JOURNAL_CHAR_LIMIT` in `src/ui/journal/constants.ts`.

## Consequences
- In Patrick Hand at 23 px, 400 characters fill about 8–9 lines of the right page above the 320×200 sketch box.
- The counter turns red at the limit, and the text area stops accepting input there (`maxLength`).
- The server should enforce the same limit when it stores the page (`07`: a `char_length(text) <= 400` check on
  `journal_pages`). Change both together.
