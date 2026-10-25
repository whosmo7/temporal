# 05 — Journal, End-of-Turn Flow, Graveyard

**Owner:** Frontend/UI dev (wording from Game design)  
**Depends on:** `02` (`endTurn` summary), `04` (freeze, lectern, graveyard sprites), `07` (persistence).

## Decisions (locked)

- One shared **world journal**. **One page per player turn.** Earlier pages **can't be edited**.
- Pages hold **free text + a drawing** (single pen, a few colours, eraser).
- The journal is an **in-world object (lectern), openable any time**.
- The journal is the **only** information successors get about the past, besides the HUD's health bar and land level ([023](../decisions/023-world-health-and-level.md)). The world never explains causes ([026](../decisions/026-lift-no-explanation-rule.md)).
- **End flow: Freeze → Journal (write) → Cost summary → Gravestone.**
- **Cost summary shows only realised outcomes**: costs paid and immediate gains. **Pending benefits are left out.** Confirmed for `13` on 2026-10-25: it adds tiles sown and watered, seeds used and gathered, and the land's health and level **as they stand at day's end**, nothing still growing.
- **Gravestone**: name/initials, click to open that player's journal page. The hover label also shows the generation, and E reads the nearest stone ([014](../decisions/014-gravestones.md)).
- No moderation for the hackathon.
- Text is limited to **400 characters** ([009](../decisions/009-journal-character-limit.md)).

## End-of-turn flow

```
[Timer hits 0]
   │  world freezes (04), input locked, world dimmed
   ▼
[Journal: Write your page]
   - Read previous pages (left/back)
   - Your blank page (right): text area + drawing canvas
   - Character limit **400** ([009](../decisions/009-journal-character-limit.md))
   - "Seal page" button → irreversible confirm → **the turn is committed to the server** (07, [018](../decisions/018-commit-on-seal-refresh-restarts.md))
   - (Time limit for writing: team to define; see open questions)
   ▼
[Cost summary: "What you gave"]
   - Stamina spent, food/water spent, food/water gathered this turn
   - Upkeep: met / short by X
   - Planted / built: listed as COST ONLY ("Crops sown ×6", "Watered ×6"). No mention of what it will become.
   - Seeds: used and gathered today. The land: its health bar and level name at day's end (`13`).
   - Wording and templates: `docs/content/cost-summary.md`
   ▼
[Gravestone]
   - Camera pans to the graveyard; your stone rises with your name
   - "Generation N is over." (once the commit has landed) → "Play another" / "Home"
```

> The demo moment depends on this: the orchard planter's last screen says *"Orchard: −25⚡ −5💧"* and
> nothing else. Don't add any "this will pay off" hint here.

> The turn is committed **at "Seal page"** ([018](../decisions/018-commit-on-seal-refresh-restarts.md)). The cost
> summary and gravestone are cosmetic and run while it saves, so a closed tab after sealing doesn't void the turn.
> "Generation N is over." waits for the save; if it fails, the card offers Try again. A sealed turn is kept in
> localStorage until the backend has it, and sent first on the next Play.

## Journal UI

- Styled as an open book, using a pixel-art/paper texture from `09`.
- **Pages:** each shows author name, generation number and text + drawing. No auto-generated content (the world doesn't explain itself).
- **Navigation:** previous/next, page index by generation.
- **Drawing canvas:** fixed size (e.g. 320×200 logical px), pen width 2–3, **3–4 colours** + eraser + clear.
- **Storage format:** recommend saving **strokes as JSON** (`{color, points: [x,y][]}[]`). It's small, re-renders crisply at any scale, and could be animated in the replay. Alternative: a PNG data URL. See `07`.
- **Read-only enforcement:** client UI + server (a page can only be inserted once per turn, never updated). See `07` RLS.

## Graveyard

- One gravestone per **committed** turn (voided turns get none).
- Hover → "AL · Generation 2". Click → opens the journal at that page. At the graveyard, "E · Read AL's page" reads the nearest
  stone ([014](../decisions/014-gravestones.md)). The graveyard is solid, so stones are read from outside the fence.
- Repeat players get several stones.
- Stones fill the fixed graveyard plot in rows, oldest at the back left (`layoutStones` in `src/render/graveyard.ts`). Rows tighten
  as it fills, and past a dozen or so the stones halve in size, so 80 generations still fit.
- **End of turn:** after the seal, the camera pans to the graveyard (the roof goes back on if you were inside), the dim lifts,
  and your stone pushes up out of the ground with a little earth thrown up. Then "Generation N is over." → Continue.
  `WorldView.raiseStone(stone)` resolves when it has risen.

## Tasks

- [x] **[C]** Journal modal (book layout, page flip, prev/next) *(`src/ui/journal/JournalModal.tsx`, `mode: 'write' | 'read'`. Bench at `#/dev/journal` in dev.)*
- [x] **[C]** Text input with limit + counter
- [x] **[C]** Drawing canvas: pen, colours, eraser, clear; serialise strokes *(4 pens + eraser + clear, Ctrl+Z undoes a stroke. Format `{ color, width, points }[]` on 320×200; eraser strokes use `color: 'erase'`.)*
- [x] **[C]** Stroke renderer (reused by the replay `06` and gallery thumbnails) *(`StrokeRenderer` component, or `paintStrokes(ctx, drawing, scale)` for Pixi/offscreen use.)*
- [x] **[C]** "Seal page" confirmation; locks the page client-side *(Calls `onSeal({ text, drawing })` after the stamp; B's end flow takes it from there.)*
- [x] **[C]** Cost summary screen from `endTurn().summary` (**realised only**) *(`src/ui/summary/`: `costSummary()` builds the lines from the summary plus this turn's own actions and transitions, so a row only shows what that action changed this turn. `PlayScreen` shows it between the seal and the stone.)*
- [x] **[B]** Gravestone placement animation + camera pan *(`WorldView.raiseStone()`. `PlayScreen` runs it after the seal; the cost summary slots in before it.)*
- [x] **[B]** Graveyard rendering and interaction (with `04`) *(hover label, click and E open the page; `JournalModal` got an optional `openAt`. Dev: `#/play?graves=AL,MO,KE&turn=20`.)*
- [x] **[B]** Lectern interaction → read-only journal during play *(the world's pages are passed in by the play flow, `08`; for now the list is empty)*
- [x] **[B]** Hand off to `07` commit; handle a commit failure (retry, keep the local copy) *(`Game` in `src/ui/play/` calls `save` on the seal; `PlayFlow` commits through `backend` and keeps the copy, see `src/ui/play/turnStart.ts`.)*
- [ ] **[C]** Copywriting pass with Game design (tone: quiet, reflective, no moralising)

## Acceptance

- A player can read all earlier pages, write and draw their own, seal it, see a cost-only summary and watch their stone appear.
- After sealing, the page can't be edited from the UI or the API.
- Clicking any stone opens the right page.

## Open questions

1. Time limit for journal writing at end of turn? (You said "we will define".) Affects the lock TTL in `07`.
2. ~~Which step commits the turn?~~ Settled: "Seal page" ([018](../decisions/018-commit-on-seal-refresh-restarts.md)).
3. Can a player skip writing (empty page)? If so, what does their page show ("They left no words")?
