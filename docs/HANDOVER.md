# Handover — 2026-10-19

For the next Claude session on sherpa-ui. Read `CLAUDE.md` and
`docs/PRINCIPLES.md` first, as always; this says where the work stands.

## How Will works

- He reads replies in **ASD-STE100 Simplified Technical English**: small words,
  short sentences, active voice. A decision is **2 options at most**, your pick
  first, with the context to choose fast. Start a handover with "Written for: you, Will."
- **Keep churning the TODO** (`docs/TODO.md`). Do not wait for a go between
  items. A real decision becomes a ❓ row, and you move on.
- **Commit every item.** Push only when Will asks (he asked on 2026-10-17 and
  2026-10-19). Never push `backup/main-before-secret-fix`: it holds a Figma
  token. Never read, edit or stage `.mcp.json`: it holds a plaintext token.
- **Testing is on** (Will, 2026-10-17: keep testing until he says stop). Run
  focused specs per change, and the full suite at milestones.
- Bugs found mid-work are QUEUED in the TODO, not fixed in passing.
- A done item keeps its row and its section, marked ✅. Nothing is deleted.

## Where the code stands

- Branch `sherpa-data-layer`, pushed to `origin` on 2026-10-19.
- `../Sherpa Demos` (branch `main`) is pushed too. It links sherpa-ui by
  `file:`, so **run `npm run build` after each change** or Demos shows the old
  code. Will runs its server on :4200 — never stop it; Demos' Playwright reuses it.
- `../Sherpa Starter` has no git remote; its commit `1eb862f` is local only.
- A peer session (`sherpa-demos-a7`) may exist. Never stash. Stage only your
  own files, and only when `git diff --cached` is empty.

## Done since the first handover: TODO 344 and the stock-take

- **TODO 344 is ✅** (2026-10-19): a component's markup, default variants and
  text come from its `.html` and `.css`, never from TS. Every group passed its
  focused specs in three engines; its section in `docs/TODO.md` lists each
  commit. The base mechanisms, each with a TRAP:

| Mechanism | TRAP |
|---|---|
| A `content` prop's default is its target's own text in the template | `T-the-templates-text-is-the-default` |
| `data-swap-on` / `data-swap-*`: a value that follows a host attribute (`src/core/ui/swap.ts`) | `T-a-swapped-label-is-in-the-markup` |
| `<template class="words">` + `this.word(key)` | `T-a-word-is-in-the-markup` |
| No attribute is the default variant; the projector's `unset` | `T-no-attribute-is-the-default-variant` |
| `static html` as a LIST: family markup (`src/core/sherpa-filter-menu.html`, `src/core/sherpa-filter-more.html`) | `T-a-family-shares-markup` |
| `static pageCss`: a sheet adopted into the document (the toast stack) | `T-a-page-sheet-is-for-what-a-component-puts-in-the-page` |

- **The stock-take** (`docs/history/STOCKTAKE-2026-10-19.md`) is updated for
  344, and has Will's run-time diagrams: the kinds of file, an app, a Context
  and a View, and a UI component (sections 7 to 10). Every diagram renders
  (checked with `mermaid@11.4.1` in a Playwright page).

## Next: TODO 345 — fetch each field's values on demand, with a cache

Will doubts 340's "a remote source reads its whole set once" (up to 50,000 rows
on open). His design notes are in the TODO 345 section: the decision after
`compile()` is a SERIES (held? current? reachable?), the store keeps a History
table of delta times and field bitmaps, and the History starts again every
session ("ground zero"). It is EXPLORE: plan with Will before building.

## Then: TODO 346–349 — filters (Will, 2026-10-19)

One "Send to <component>" on a View field (346); the View scope first, and a
component scope only within its subset (347); a chip's count, and a menu's
viable fields and values, from that subset — its scopes and the filters BEFORE
it (348, 349). Each section says what the code does today and what to settle
with Will.

## After that: TODO 350 — performance (Will, 2026-10-19)

Sherpa is slow under 4x CPU throttling. Measure what costs, find the fixes and
the options, and look for redundant, legacy and convoluted code and composition
bottlenecks. Deferred until 345–349 are done, as they may help. Will measured
the worst: an INP of about 600 ms, from the quick filter toolbar. **While doing
345–349, fix any performance issue that is in reach** — 350 still runs on its own.

## Waiting on Will (❓ and looks)

305, 319, 321, 327, 338 (two UX choices), 293 (CLAUDE.md cut, old skill), 339
(Figma clean-up), 290 (rename `spoofRemote`), and looks by eye for 313, 323,
324 and 340. The stock-take's "What is still to do" lists each with a pick.
