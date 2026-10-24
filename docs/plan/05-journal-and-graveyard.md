# 05 — Journal, End-of-Turn Flow, Graveyard

**Owner:** Frontend/UI dev (wording from Game design)  
**Depends on:** `02` (`endTurn` summary), `04` (freeze, lectern, graveyard sprites), `07` (persistence).

## Decisions (locked)

- One shared **world journal**. **One page per player turn.** Earlier pages **can't be edited**.
- Pages hold **free text + a drawing** (single pen, a few colours, eraser).
- The journal is an **in-world object (lectern), openable any time**.
- The journal is the **only** information successors get about the past. The world never explains causes.
- **End flow: Freeze → Journal (write) → Cost summary → Gravestone.**
- **Cost summary shows only realised outcomes**: costs paid and immediate gains. **Pending benefits are left out.**
- **Gravestone**: name/initials, click to open that player's journal page.
- No moderation for the hackathon.

## End-of-turn flow

```
[Timer hits 0]
   │  world freezes (04), input locked, world dimmed
   ▼
[Journal: Write your page]
   - Read previous pages (left/back)
   - Your blank page (right): text area + drawing canvas
   - Character limit [PLACEHOLDER 400]
   - "Seal page" button → irreversible confirm
   - (Time limit for writing: team to define; see open questions)
   ▼
[Cost summary: "What you gave"]
   - Stamina spent, food/water spent, food/water gathered this turn
   - Upkeep: met / short by X
   - Planted / built: listed as COST ONLY ("Orchard: −25⚡ −5💧"). No mention of what it will become.
   ▼
[Gravestone]
   - Camera pans to the graveyard; your stone rises with your name
   - "Generation N is over." → Continue
   ▼
[Commit turn to server] (07) → back to landing / "Play again"
```

> The demo moment depends on this: the orchard planter's last screen says *"Orchard: −25⚡ −5💧"* and
> nothing else. Don't add any "this will pay off" hint here.

> Note: the commit to the server should happen **at "Seal page"** or at the end of the flow, at the latest
> before the lock TTL runs out (see `07`). Keep the cost summary + gravestone cosmetic, so a closed
> tab after sealing doesn't void the turn. **Open:** which step counts as "committed"?

## Journal UI

- Styled as an open book, using a pixel-art/paper texture from `09`.
- **Pages:** each shows author name, generation number and text + drawing. No auto-generated content (the world doesn't explain itself).
- **Navigation:** previous/next, page index by generation.
- **Drawing canvas:** fixed size (e.g. 320×200 logical px), pen width 2–3, **3–4 colours** + eraser + clear.
- **Storage format:** recommend saving **strokes as JSON** (`{color, points: [x,y][]}[]`). It's small, re-renders crisply at any scale, and could be animated in the replay. Alternative: a PNG data URL. See `07`.
- **Read-only enforcement:** client UI + server (a page can only be inserted once per turn, never updated). See `07` RLS.

## Graveyard

- One gravestone per **committed** turn (voided turns get none).
- Stone shows name/initials (and optionally "Gen N", open question). Hover → name. Click → opens the journal at that page.
- Repeat players get several stones.
- Stones fill a fixed graveyard plot in rows. Plan for overflow if generations are configured high (smaller stones or a second row).

## Tasks

- [ ] **[C]** Journal modal (book layout, page flip, prev/next)
- [ ] **[C]** Text input with limit + counter
- [ ] **[C]** Drawing canvas: pen, colours, eraser, clear; serialise strokes
- [ ] **[C]** Stroke renderer (reused by the replay `06` and gallery thumbnails)
- [ ] **[C]** "Seal page" confirmation; locks the page client-side
- [ ] **[C]** Cost summary screen from `endTurn().summary` (**realised only**)
- [ ] **[B]** Gravestone placement animation + camera pan
- [ ] **[B]** Graveyard rendering and interaction (with `04`)
- [ ] **[B]** Lectern interaction → read-only journal during play
- [ ] **[B]** Hand off to `07` commit; handle a commit failure (retry, keep the local copy)
- [ ] **[C]** Copywriting pass with Game design (tone: quiet, reflective, no moralising)

## Acceptance

- A player can read all earlier pages, write and draw their own, seal it, see a cost-only summary and watch their stone appear.
- After sealing, the page can't be edited from the UI or the API.
- Clicking any stone opens the right page.

## Open questions

1. Time limit for journal writing at end of turn? (You said "we will define".) Affects the lock TTL in `07`.
2. Is reading the journal *during* play free (timer paused) or does it use time?
3. Character limit for text?
4. Gravestone: show the generation number as well as the name?
5. Which step commits the turn: "Seal page" or the end of the gravestone animation?
6. Can a player skip writing (empty page)? If so, what does their page show ("They left no words")?
