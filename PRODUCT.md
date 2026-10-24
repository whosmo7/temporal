# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **OxHack judges** in a 5-minute demo slot, at a demo laptop (1280×720). An admin force-assigns them a pre-seeded world. They play one generation, write a line in the journal, then watch the replay. They are the audience the build is judged by.
- **Players**, mostly hackathon attendees and anyone sent a link. On desktop with keyboard and mouse, they log in with a username, are assigned a world, play one timed generation (10 minutes by default) and leave a journal page for a stranger. They may come back and play more generations.
- **Gallery visitors**, logged in or not, who browse completed worlds and watch their replays.

## Product Purpose

INHERITANCE is a browser game about what you inherit and what you leave. Each player governs a small seeded farming world for one generation, inherits whatever earlier players left, and leaves the world and a journal page to whoever comes next. When a world reaches its final generation, a public replay shows what each player caused.

Success is the demo moment: a judge inherits a flourishing orchard and discovers it was planted by someone whose own final screen showed only its cost.

## Positioning

Every player is one generation of the same world, and they never meet. Effects outlive the people who cause them: an orchard planted now fruits for someone else. During play the world never explains itself, and causes appear only in the replay. There is no score and no "good" button. Every choice has to be one a reasonable person would make.

## Operating Context

- Played in a desktop browser from GitHub Pages (hash routes), with Supabase for login, world assignment, turn commits, the gallery and replays. Async: one player holds a world at a time, and an abandoned turn is voided.
- A turn: inherit → act while day turns to night → freeze → write/draw the journal page → cost summary (realised costs only) → gravestone.
- Demo setting: venue Wi-Fi may fail, so an offline hot-seat build is the fallback. The full demo must run in under 5 minutes from a cold browser.
- Built by a team of three in a 48-hour hackathon, so scope has to stay finishable.

## Capabilities and Constraints

- Resources: food, water, stamina. Eight actions. Upkeep at nightfall. A missed upkeep weakens the next player (a soft fail, never game over). Decay, wear, seeded events (drought, good harvest, Island storm). Biomes: Forest and Island.
- **Hidden information is the core mechanic:** no numbers or due dates for pending effects, and no causes, until the replay. The cost summary shows only what was realised.
- The journal is the only message between generations: free text plus a drawing. Earlier pages can never be edited.
- Usernames + passwords only (no email shown). Desktop only. Free, licence-checked assets only.
- Full plan and game rules: `docs/plan/`. Game numbers: `docs/plan/01-game-design.md`.

## Brand Commitments

- Name: **INHERITANCE**.
- Voice: quiet, plain and observational, like a field notebook. Describe, don't judge. No moral labels, no score words, no "your successors will thank you". Rules in `.claude/skills/inheritance-player-facing/`.
- Binding visual references chosen by the user, recorded in `docs/art/art-direction.md`: a Pokémon Black/White-style bright overworld, peach-and-plum dusk, each world shown as a floating island, Ninja Adventure (CC0) as the pack family and Kyrise icons (CC BY) for the HUD.

## Evidence on Hand

- No real players, testimonials, statistics or press yet. Never fabricate them. Gallery and world counts may only show real Supabase data.
- The demo world will be real played or seeded data (`docs/plan/10-demo.md`). Founder journal pages are written by the team, and labelled as such if shown outside the game.

## Product Principles

1. **The world never explains itself.** Players learn the past only from the journal and from how the world looks.
2. **The cost is visible; the gift is not.** What you pay shows now. What it becomes shows later, to someone else.
3. **No good button.** Every option must be defensible, and nothing praises sacrifice or scolds selfishness.
4. **Readable by eye.** World states have to read from the art alone, without text.
5. **Small and finished beats big and broken.** Everything must survive a 5-minute demo built in 48 hours.

## Accessibility & Inclusion

- Keyboard-first controls (WASD/arrows, E/Space, 1–8 for the hotbar). UI text must fit at 1280×720 without clipping.
- World states must not depend on colour alone: each stage changes shape as well as colour.
