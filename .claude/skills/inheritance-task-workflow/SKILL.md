---
name: inheritance-task-workflow
description: Step-by-step workflow for doing a task from the INHERITANCE plan in the temporal repo. Covers finding the task and its owner tag ([A]/[B]/[C]), checking dependencies and shared contracts, branching, verifying, ticking the checkbox in docs/plan, writing the PR, and handling open questions with a recorded decision. Use this whenever someone says "do my next task", "work on [A]/[B]/[C] tasks", names a plan task or section number (01–12), asks to start, finish or PR some work, or hits a question the plan leaves open, even if they don't mention the plan.
---

# Working a plan task

The plan in `docs/plan/` has 133 tasks split between three people. This workflow keeps three
parallel Claude sessions from duplicating work, breaking each other's contracts or quietly
re-deciding things. Load `inheritance-core` too if it isn't already loaded.

## 1. Find the task

- Tasks are checkboxes in `docs/plan/01-…` to `11-…`, each tagged `**[A]**`, `**[B]**` or `**[C]**`.
  `docs/plan/12-team-split.md` lists them by person with effort points.
- If the user says "my next task" without naming one, ask which letter they are (once per session),
  then suggest the first unticked task for that letter whose dependencies are met. Section docs list
  tasks roughly in dependency order, and each doc's header says what it depends on.
- If the task belongs to a different letter, check with the user before starting, because the owner may
  already be working on it.

## 2. Check what it touches

Before writing code:
- Read the task's section doc (Spec, Acceptance and Open questions), not just the checkbox line.
- Load the area skill: `inheritance-engine`, `inheritance-world-ui`, `inheritance-backend`,
  `inheritance-assets`, `inheritance-balance`, and `inheritance-player-facing` for anything a player sees.
- **Shared contracts:** if the change touches `src/engine/types.ts`, the `TileMap` shape, `visibleView()`
  stage names, the `Backend` interface, the DB schema or `inheritance-core/references/ids.md`, it affects other people.
  Keep it backwards-compatible where you can, and call it out in the PR under "Contracts changed".

## 3. Branch

`feat/<area>-<thing>` (or `fix/…`) off the latest `main`. Use one branch per task, or per small group of tasks in the same
section. Short-lived branches merge more easily when three people push all weekend.

## 4. Build it

Follow the area skill. Keep the change to what the task needs. If you notice something else worth
doing, mention it in the PR or ask the user about a new task rather than widening this one.

## 5. Verify

Run what CI runs, then fix anything red before calling the task done:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

(If the scaffold from `11` doesn't exist yet, say so and run whatever exists.)

- Engine/worldgen changes need Vitest tests. See `inheritance-engine` for the required cases. For
  planning a larger test suite, use the `engineering:testing-strategy` skill if it is available.
- UI changes: launch the app and check the change works (use the `run` skill if available), and
  include a screenshot in the PR.
- Check the task's Acceptance line in its section doc.

## 6. Tick the task and update the plan

- Change `- [ ]` to `- [x]` for the task in its section doc, in the same PR.
- If you built something differently from the Spec, update the Spec text so the plan stays true.
  Other people's Claude sessions read it as fact.
- Rebuild `docs/plan/plan.html` with `python3 docs/plan/tools/build_page.py docs/plan docs/plan/plan.html docs/plan/tools/page-template.html`
  if pandoc is installed; otherwise say in the PR that it needs a rebuild.
- Don't edit the point estimates in `12-team-split.md` (they're for balancing, not tracking).

## 7. Open the PR

Use `.github/pull_request_template.md`. Title: `<type>(<area>): <summary>`. Fill in:
- **Task(s):** section number + checkbox text, plus the owner letter
- **What changed** and **how to check it**
- **Contracts changed:** IDs, types, interfaces or schema, or "none"
- **Player-facing check:** confirm nothing breaks `inheritance-player-facing` (or "n/a")

If available, run the `code-review` (or `engineering:code-review`) skill on the diff before asking a
teammate to review.

## Open questions

Each section doc ends with **Open questions**. If your task depends on one of them:

1. Don't pick an answer quietly. Stop and ask the user, laying out the options and what each one
   changes. They may need to check with the teammate who owns that decision (game design questions
   belong to C).
2. Once decided, record it as a short decision record in `docs/decisions/NNN-<slug>.md`
   (context, options, decision, consequences). Use the `engineering:architecture` skill to write it if
   it's available.
3. In the same PR, move the question out of the section doc's **Open questions**, write the answer
   into its **Decisions** or **Spec**, and add a row to `docs/plan/00-decisions-and-glossary.md`.

If the user is unavailable and you have to keep going, build it so the choice is a single config value
or flag, use the plan's recommendation if it has one, and list the assumption at the top of the PR.

## Example

> User (B): "start my next task"
>
> 1. B's first unticked task with its dependencies met is `03` "Seeded noise util". It depends on the `02` PRNG; if
>    the PRNG exists, go ahead, and if not, check with A or stub the interface.
> 2. Load `inheritance-engine` (worldgen follows engine purity rules).
> 3. Branch `feat/worldgen-noise`, implement, add a Vitest test that the same seed gives the same values.
> 4. Run the checks, tick the box in `03-world-generation.md`, and open a PR titled `feat(worldgen): seeded value noise`.
