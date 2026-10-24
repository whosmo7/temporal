# Brief: app shell and landing

**Status:** approved by C, 2026-10-24 (shaped with `/impeccable shape`)
**Tasks:** `08` router + layout shell + pixel UI theme, landing page, auth screen, audio toggle · **Owner:** C
**World:** `docs/art/art-direction.md` (pinned) · **Product:** `PRODUCT.md` · **Chosen layout:** "One generation a minute"

## Job and audience
- Judges at the demo laptop, players arriving from a link, gallery visitors. Landing = **Persuade**: understand the premise in one viewport, then press **Play** (or **Gallery**). Auth and chrome = **Operate**.

## Outcome and proof
- In seconds, a visitor knows this is a game where you inherit a world and leave it to a stranger, and presses Play.
- The proof is the island itself, living through a generation. No stats, testimonials or claims (`PRODUCT.md` › Evidence).

## Direction
- **First viewport:** a teal sky, with the floating island centred at about half the viewport height. Over a slow ~60 s loop the light moves from morning to peach dusk to plum night and back. At each nightfall a small gravestone rises in the island's graveyard. The **INHERITANCE** wordmark sits above the island, with one premise line below it, then **Play** (primary) and **Gallery**.
- **Premise line (confirmed):** "You inherit a world. You leave it to a stranger."
- **Signature moment:** the stone rising at nightfall, the one beat that hints at the game without explaining it.
- **Motion grammar:** slow world motion (cloud parallax, island bob ±2 px over ~4 s, 60 s sky cycle). UI transitions 150–200 ms, no page-load choreography.
- **Shell:** log in / sign up is a pixel panel floating over the same sky, so the island stays in view and it doesn't feel like a separate site. A small header shows the username, mute and log out once signed in.

## Scope
- Routes `/#/` (landing) and `/#/login`. Layout shell, UI kit (`Button`, `Panel`, `Dialog`, `TextInput`, `Icon`) styled from the art-direction tokens, mute toggle.
- **Not here:** game screen, gallery contents (`06`), admin panel, tutorial.
- **Anti-goals:** feature grids, "how it works" strips, hype copy, bouncing or glowing UI, anything that praises or scolds.

## States
- Logged out: Play leads to login/sign-up, then straight into claiming a world. Logged in: Play claims directly ("Finding a world…").
- Sign-up: username taken (`username_available`), invalid username (3–20 lowercase letters, digits or `_`), password too short. Wrong password on login.
- Claim failed or offline: a quiet message with Retry.
- Reduced motion: no sky cycle. The scene holds at dusk, and the stone appears without rising.
- Island render: a static pixel composite from the pack until B's renderer (`04`) can draw a live sample world.

## Layout and interaction
- Designed at 1280×720 first, centred, with nothing clipped. Enter = Play. Visible focus states on every control.

## Constraints and open decisions
- Wordmark: text in the pack's pixel font until the logo task (`09`).
- Music starts on the first click, and mute is remembered.
