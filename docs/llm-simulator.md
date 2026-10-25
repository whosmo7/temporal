# LLM playthrough simulator

A developer tool, runnable from the admin page or the command line. Gemini plays the simulated players, one generation after another in the same
world. The engine stays the authority: the model only picks one of the choices it is shown, and `applyAction`, `tick`,
`beginTurn` and `endTurn` decide what happens. It is separate from the scripted balance runs (`npm run simulate`), the
browser game and Supabase.

## From the admin page

Signed in as `admin`, open **Admin → Simulated players**, set the generations, biome, seed, first player, call budget and
model, and press **Run simulation**. It runs on the live site's `llm-simulate` Edge Function, which uses the
`GEMINI_API_KEY` Supabase secret. It plays one generation per request, about a minute each, and shows a row per
generation as it goes. **Download trace** saves the JSONL described below. Nothing is saved on the server
([decision 040](decisions/040-simulated-players-from-the-admin-panel.md)).

**Watch it** opens the finished run in the replay viewer (`#/admin/simulation`, admins only): each generation's world,
the actions, the causes and the journal pages, labelled as simulated. **Watch a trace file** does the same for a
downloaded trace or one from `npm run simulate:llm` in `.sim/`. The engine rebuilds the run from its seed and action
log, in the browser only. Nothing is uploaded, and a refresh clears it.

The rest of this page is the command-line tool, for longer runs or runs without the live site.

## Set up the key

The simulator reads `GEMINI_API_KEY` from its own process environment. Pick one of these:

```bash
# For one terminal session (the key isn't echoed or saved)
read -s "GEMINI_API_KEY?Gemini API key: "; export GEMINI_API_KEY

# Or for every run: add this line to .env.local (git-ignored), and the simulator loads it
GEMINI_API_KEY=your-key
```

Never prefix it `VITE_`: Vite builds any `VITE_` variable into the public website. The Supabase secret of the same name is
what the admin page's Edge Function uses; the command line can't read it.

## Run

```bash
npm run simulate:llm -- --seed 1 --gens 6 --biome forest --persona pragmatic --model gemini-3.5-flash-lite --max-calls 250
```

| Flag | Default | Meaning |
|---|---|---|
| `--seed` | `1` | World seed |
| `--gens` | `2` | Generations to play |
| `--biome` | `forest` | `forest` or `island` |
| `--persona` | the list order | Comma-separated persona ids to start with. The rest follow, one distinct persona per generation: `pragmatic`, `cautious`, `builder`, `ambitious`, `frugal`, `curious` |
| `--model` | `gemini-3.5-flash-lite` | Gemini model id |
| `--max-calls` | `60` | Model calls for the whole run, journals included |
| `--out` | `.sim/llm-<seed>-<biome>-<time>.jsonl` | Trace file (`.sim/` is git-ignored) |
| `--no-journal` | off | Skip the end-of-day journal pages |

The defaults are small on purpose. A generation takes about 30 to 40 calls, so six generations need about 200 to 250.
When the budget runs out, the run stops before the next generation and keeps everything played so far.

## What the model sees

At each decision point it gets a short observation built from `visibleView`, plus that player's own day. That's the
stores, the can, hunger, plot stages counted, the daylight left, the night's food, what they've done today, the
gravestones and the earlier journal pages. It also gets a short list of choices with ids (`A1`…, `W1` wait, `F1` call
it a day), each with the time it takes.

It is never sent the seed, seeded events, pending effects, due dates, causes, replay data or anything from later
generations. Each generation is a fresh player with no access to an earlier player's conversation or reasoning. Only
the journal pages pass on, and they are marked as simulated.

## Limits

Each turn has firm limits (`DEFAULT_LIMITS` in `scripts/llm/play.ts`):
- 40 calls
- 120 accepted actions
- 3 answers in a row that don't happen
- 12 waits of 10 s each
- up to 8 repeats of one choice

An answer that isn't on the list, or that the engine refuses, is recorded in the trace and never swapped for something
else. A choice the engine refused leaves the list for the rest of that day. A quota or rate-limit error stops the run and
keeps what was written. Ctrl-C does the same.

## Output

- **The table:** food, water, upkeep, wild stock, reservoir, well, trees, field tiles, calls, actions, rejected choices,
  why the turn ended, and the locked player score. Then the totals and the journal pages.
- **The trace (JSONL), one event per line:**
  - `run`: model, prompt version, seed, biome, personas
  - `decision`: the observation, the candidates, the model's answer and private note, accepted actions or the
    rejection, token usage
  - `journal`
  - `turnEnd`: the realised summary and score
  - `final`: the accepted action log and the final state, which `replay()` rebuilds exactly

The trace is a local developer artifact of simulated players. Don't upload it to Supabase or present it as a real game.

## Tests

`scripts/__tests__/llm.test.ts` uses a fake `DecisionMaker`, so normal tests and CI never call Gemini. It checks that:
- the observation hides what it should
- ids that aren't on the list never act
- limits and quota errors end turns
- six generations finish in both biomes
- the accepted log replays to the same final state
