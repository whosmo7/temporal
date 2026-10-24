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

Keep it short (target ≈ 30–45 s). A fixed tutorial seed, no timer pressure, nothing saved.
1. Move with WASD.
2. Walk to the field → plant crops → watch them ripen → harvest.
3. See the orchard plot. Planting it shows "This will take longer than you have." (open: is this hint allowed, given hidden effects?)
4. The lectern: "Those before you left words here."
5. The graveyard: "When your day ends, you join them."
6. Explain upkeep: "Before night falls, keep enough food and water to survive."
7. → Play.

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
- [x] **[B]** Play flow: claim → interstitial → game → end flow → back to landing / "Play another" *(`PlayFlow` in `src/ui/play/`: claim → `Inheriting` → `Game` → seal commits ([018](../decisions/018-commit-on-seal-refresh-restarts.md)) → Play another / Home. `#/play?seed=…` is an offline dev sandbox that saves nothing. **Testing only:** an "End turn (test)" button under the clock jumps to 6 am; remove it before the demo.)*
- [x] **[B]** Resume: if the user refreshes while holding a lock, put them back in (or void; open question) *(The same turn starts over at 6 am: `claimWorld` hands back the held world ([018](../decisions/018-commit-on-seal-refresh-restarts.md)).)*
- [ ] **[C]** Tutorial scene
- [x] **[C]** Gallery + replay routes (screens from `06`) *(see `06`)*
- [x] **[C]** Admin panel + guard *(`/#/admin` → `AdminScreen` behind `RequireAdmin`: logged out goes to `/auth` and back, a non-admin sees the not-found page. Force-assign first (pick a world, type a name, Enter; unlocked worlds listed first), then every world with its lock, next-Play user, editable generations and turn length, Clear lock and Skip to replay, then the defaults for new worlds and the inherit ratio. Admins get an Admin link in the header. `Profile.isAdmin` and the admin calls are on the `Backend` contract; in `LocalBackend`, signing up as `admin` makes an admin.)*
- [ ] **[B]** Error states: no network, claim failed, commit failed (retry + local backup) *(Claim failed and commit failed are done: Try again on both, and the local copy. No network waits for `SupabaseBackend`.)*
- [x] **[C]** Audio toggle (mute) in the shell (`09`) *(`MuteToggle` in the header, saved in localStorage.)*

## Acceptance

- A new visitor can sign up, finish the tutorial, play a generation and see their gravestone, with no help.
- An admin can force-assign the demo world to a judge's account in under 15 seconds.

## Open questions

1. Is the tutorial mandatory on first play, or skippable?
2. Is the "this will take longer than you have" hint OK, given pending effects are partly hidden?
3. ~~Refresh mid-turn: resume with the time remaining, or void?~~ Settled: the same turn starts over ([018](../decisions/018-commit-on-seal-refresh-restarts.md)).
