# 08 — App Shell: Screens, Auth, Onboarding, Admin

**Owner:** Frontend/UI dev  
**Depends on:** `07` (auth, claim, admin RPCs), `04`/`05`/`06` (game, journal, replay screens).

## Decisions (locked)

- Screens: **Landing/title**, **Sign up / Log in**, **Onboarding/tutorial**, **Game**, **Gallery** (+ Replay).
- **Admin tools**: force-assign a world, configure turn length/generations, skip to replay.
- Desktop only.
- The gallery and replays are **public**: no login needed. Only Play needs an account ([017](../decisions/017-public-gallery.md)).
- Hosted on GitHub Pages, so use **hash routing** (`/#/…`) to avoid 404s on refresh.

## Routes

| Route | Screen |
|---|---|
| `/#/` | Landing: title, one-line premise, **Play**, **Gallery**, Log in/Sign up |
| `/#/auth` | Username + password, toggle between sign up and log in |
| `/#/tutorial` | Onboarding (first visit, or from a link on the landing page) |
| `/#/play` | Calls `claimWorld` → loading/"You are inheriting…" → Game |
| `/#/gallery` | Completed worlds |
| `/#/world/:id/replay` | Replay |
| `/#/admin` | Admin panel (only if `profiles.is_admin`) |

## Landing

- Pixel-art title "INHERITANCE", an ambient animated world in the background (a random seed, rendered by `04`, no avatar).
- Premise line, e.g. *"You have one day. What you plant, someone else will harvest."* (copy: Game design)
- Buttons: Play · Gallery · (Log in / username shown)

## "You are inheriting…" interstitial

- Shows: world name, biome, "Generation N of M", the names on existing gravestones. **No numbers about the world's state.**
- Variant for a new world: "No one has lived here before."
- Variant for a weakened start: "You wake up tired." (no explanation)
- Button: Begin. **The timer starts when the player presses Begin.**

## Onboarding/tutorial

**"How to play" pop-up** ([033](../decisions/033-how-to-play-pop-up.md)): four live pictures from a fixed tutorial world in a 2×2 grid, each with its prompt and
one line: sow and water, fill the can, harvest (left too long, it rots), eat at the oven. It opens by itself on a
browser's first day, and from a "How to play" button under the clock; the clock stops while it's open. `#/tutorial`
shows it on its own. Code in `src/ui/tutorial/`. It replaces the walkthrough tutorial of [032](../decisions/032-tutorial-first-play-skippable.md) (a first Play no longer redirects there).

## Admin panel

| Tool | Behaviour |
|---|---|
| **Force-assign world** | Pick a world + a username → sets `worlds.forced_for`. That user's next Play gets that world. |
| **Configure world** | Edit `turn_seconds`, `generation_count` on a world; edit global defaults + `inherit_ratio` |
| **Skip to replay** | Open any world's replay. Optionally mark an open world `complete`. |
| World list | All worlds with status, current gen, lock holder, lock expiry, and a "clear lock" button |

(Reset demo world isn't required. See `10` for the seed script.)

## Tasks

- [x] **[C]** Router (hash) + layout shell + pixel UI theme (shared components: Button, Panel, Modal in the `09` style) *(Kit in `src/ui/kit/`: `Button`, `ButtonLink`, `Panel`, `Dialog` (the Modal), `TextInput`, `Icon`; tokens in `src/ui/theme/`; sheet at `#/dev/kit` in dev. UI font is the pack's pixel font on a 9 px size grid.)*
- [x] **[C]** Landing page with a background world (a floating island over a teal sky, see `docs/art/art-direction.md`) *("One generation a minute" from `docs/design/app-shell-brief.md`: `IslandScene` composites the world atlas on a 2D canvas, with a 60 s multiply-light loop and one stone rising each nightfall. Reduced motion holds at dusk. It stands in for a live `04` render of a sample world, which can replace the canvas later.)*
- [x] **[C]** Auth screen + session persistence + logout + username display *(`/#/auth`, `?next=` returns the player where they were and `?mode=signup` opens on sign up. Session in `src/store/session.ts`, `RequireUser` guards `/play`. The app talks to `backend` from `src/api/index.ts`, `LocalBackend` until `SupabaseBackend` exists.)*
- [x] **[B]** Play flow: claim → interstitial → game → end flow → back to landing / "Play another" *(`PlayFlow` in `src/ui/play/`: claim → `Inheriting` → `Game` → seal commits ([018](../decisions/018-commit-on-seal-refresh-restarts.md)) → Play another / Home. While the clock is stopped (journal open, end of the day) it calls `backend.heartbeat` once a minute until the turn is saved; `null` means the turn was voided, and a "Your day ran out" card replaces the game (`src/ui/play/heartbeat.ts`). Home, on the inheriting card or mid-day, releases the world so the next Play is a fresh draw ([035](../decisions/035-home-releases-the-world.md)). `#/play?seed=…` is an offline dev sandbox that saves nothing. **Testing only, remove both before the demo:** an "End turn (test)" button under the clock jumps to 6 am, and "Next generation here (test)" on the last card claims the same world back for its next generation (admin force-assign, then a check that the same world and generation came back; non-admins get a message).)*
- [x] **[B]** Resume: if the user refreshes while holding a lock, put them back in (or void; open question) *(The same turn starts over at 6 am: `claimWorld` hands back the held world ([018](../decisions/018-commit-on-seal-refresh-restarts.md)).)*
- [x] **[C]** Tutorial scene *(built by B as the "How to play" pop-up, [033](../decisions/033-how-to-play-pop-up.md); C to review the words)*
- [x] **[C]** Gallery + replay routes (screens from `06`) *(see `06`)*
- [x] **[C]** Admin panel + guard *(`/#/admin` → `AdminScreen` behind `RequireAdmin`: logged out goes to `/auth` and back, a non-admin sees the not-found page. Force-assign first (pick a world, type a name, Enter; unlocked worlds listed first), then every world with its lock, next-Play user, editable generations and turn length, Clear lock and Skip to replay, then the defaults for new worlds and the inherit ratio. Admins get an Admin link in the header. `Profile.isAdmin` and the admin calls are on the `Backend` contract; in `LocalBackend`, signing up as `admin` makes an admin.)*
- [ ] **[B]** Error states: no network, claim failed, commit failed (retry + local backup) *(Claim failed and commit failed are done: Try again on both, and the local copy. No network waits for `SupabaseBackend`.)*
- [x] **[C]** Audio toggle (mute) in the shell (`09`) *(`MuteToggle` in the header, saved in localStorage.)*

## Acceptance

- A new visitor can sign up, finish the tutorial, play a generation and see their gravestone, with no help.
- An admin can force-assign the demo world to a judge's account in under 15 seconds.

## Open questions

1. ~~Is the tutorial mandatory on first play, or skippable?~~ Settled: it opens by itself on the first day and closes with Got it ([033](../decisions/033-how-to-play-pop-up.md)).
2. ~~Is the "this will take longer than you have" hint OK, given pending effects are partly hidden?~~ Moot: the pop-up gives no timings ([033](../decisions/033-how-to-play-pop-up.md)).
3. ~~Refresh mid-turn: resume with the time remaining, or void?~~ Settled: the same turn starts over ([018](../decisions/018-commit-on-seal-refresh-restarts.md)).
