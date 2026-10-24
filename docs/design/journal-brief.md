# Brief: journal

**Status:** approved by C, 2026-10-24 (shaped with `/impeccable shape`)
**Tasks:** `05` journal modal, text input + counter, drawing canvas, stroke renderer, seal confirmation · **Owner:** C
**World:** `docs/art/art-direction.md` · **Product:** `PRODUCT.md` · **Chosen layout:** "Letters left behind"

## Job and audience
- At the end-of-turn freeze, the player writes and draws one page for whoever comes next, after reading what was left for them. The same book opens read-only from the lectern during play. **Operate**, at an emotional moment: the tool disappears and the letter is what's left.

## Outcome
- A sealed page: text (up to the character limit) plus drawing strokes as JSON `{color, points}[]`, handed to the end-of-turn flow, then the cost summary.
- Success: the player reads the previous letter and leaves something in a minute or two without hunting for controls.

## Direction
- **Spread** over the dimmed frozen world in dusk colours (peach to plum):
  - **Left page:** the previous player's letter, read-only, with a header "Generation 2 · AL", their words in the handwriting font, and their sketch re-drawn from strokes.
  - **Outer edge:** a thin stack of earlier letters, one sliver per generation. Hover shows "Gen N · name", and a click turns to it.
  - **Right page:** your letter, with a writing area on top and a sketch box below (320×200 logical), a pen row at the foot (4 colours + eraser + clear, plus **Ctrl+Z to undo the last stroke**) and a character counter.
- **The seal:** a wax seal bottom-right. Pressing it asks "Seal this page? You can't change it afterwards." Confirming stamps it (a ~300 ms press), locks the page and moves on.
- **Shared, not private:** letters lie open (no envelopes), and every letter shows its generation and name, so it reads as a diary everyone after you will read, not private mail. This answers the layout's main risk.

## Scope
- Write mode (end of turn) and read mode (lectern). Text input + counter, drawing canvas + serialisation, the stroke renderer (reused by the replay and gallery), and the seal flow.
- **Not here:** cost summary screen, gravestone, server commit (B's handoff in `05`).

## States
- **Gen 1:** no previous letter. The left page is blank paper with the header "Generation 1" and nothing else. Nothing auto-written.
- Previous letter that's text only, drawing only, or empty (header plus blank paper).
- Long text at the limit, so the counter turns `food` red at the limit. Many generations: the stack compresses after ~12 slivers.
- Sealing an empty page: allowed, with the confirm text "Your page is empty. Seal it anyway?"
- Read mode: no pens, no seal, and Esc closes. Write mode can't be closed, only sealed.

## Interaction
- Typing goes to the writing area by default. The pens are keyboard-reachable. Drawing is with the mouse, at pen width 2–3. All controls have visible focus states.

## Constraints and open decisions
- The character limit is still `[PLACEHOLDER 400]` (`05`).
- Handwriting font (OFL; Patrick Hand or Caveat), chosen in the journal-art task.
- Whether there's a writing time limit is `05` open question 1. Nothing is shown until it's decided.
