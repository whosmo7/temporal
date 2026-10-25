# 040: Simulated Gemini players run from the admin panel

**Status:** decided 2026-10-25 by the user · **Changes:** the LLM simulator brief's "local only, separate from Supabase"
(`docs/llm-simulator.md`) · **Builds on:** [036](036-admin-panel-scope.md), [039](039-competitive-scoring.md)

## Context

The LLM playthrough simulator (`npm run simulate:llm`) was built as a local command-line tool, with the Gemini key in
the developer's environment. The user wanted it easier to run: a button on the admin page. A browser can't hold the
key, so the simulation has to run somewhere that can.

## Options

| Where it runs | Chosen |
|---|---|
| **A Supabase Edge Function, using the `GEMINI_API_KEY` secret, from the deployed admin page** | **Yes** |
| A local dev-server endpoint, so the button exists only under `npm run dev` | No |

## Decision

- **Admin-only Edge Function `llm-simulate`**, from the admin panel's **Simulated players**.
  - It plays **one generation per request**. Edge Functions have a time limit, so each request stops choosing after
    110 s; that day ends as `deadline`. The page loops over the generations, sending the world state and the simulated
    journal pages forward.
  - The panel sets the generations, biome, seed, first persona, call budget and model, and can stop after the current
    generation.
- **Same simulator code as the command line.** `scripts/llm/` is bundled into `supabase/functions/_shared/sim.js`, with
  the Gemini SDK resolved by the function's `deno.json`. The engine still decides every outcome, and the model still
  sees only what a player could.
- **Nothing is written to the database.** No world, turn or trace rows are made. The result goes to the admin's browser
  only, marked as simulated, and **Download trace** saves the same JSONL format as the command line. Simulated runs
  never appear in the gallery, the Scores page or the admin's player scores.
- **The key stays a Supabase secret.** The browser build has no Gemini code or key. `LocalBackend` refuses, and points
  to `npm run simulate:llm`.

## Consequences

- **Contract (A):** `Backend.simulateGeneration(request)`, with the `SimulationRequest`, `SimulationStep` and
  `SimJournalPage` types. `npm run functions:deploy` now deploys `commit-turn`, `seed-demo` and `llm-simulate`.
- Each run spends the project's Gemini quota: a generation takes about 30 to 40 calls. The panel's call budget caps it.
- The command-line tool stays, for longer runs and for runs without the live site.
