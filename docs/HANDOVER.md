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

## Where the work stands (2026-10-19, evening)

**Done today, each with tests, a TRAP, and both full suites green:**

| Item | What it gave | TRAP |
|---|---|---|
| 345 ph. 1–2, 351 | A page's source closes; a keyed save is patched into the held set | `T-a-closed-source-hears-nothing`, `T-a-held-set-takes-a-change-in-place` |
| 345 ph. 4.1–4.7 | Failure kinds; ONE held set per store; `planRead()`; a reopen shows at once and checks behind; a failed read keeps the set; `provider.reach`; the "Unable to reach data" banner (floats, CLS 0); `keepCache()` in IndexedDB | `T-a-failure-has-a-kind`, `T-a-store-has-one-cache`, `T-a-read-is-planned`, `T-a-failed-read-keeps-the-last-set`, `T-the-provider-says-the-pages-reach`, `T-a-reach-banner-takes-no-room`, `T-a-kept-set-is-checked-each-session` |
| 352 | Panel mode no longer shifts the page (CLS 0.554 → 0.013) | `T-the-filter-mode-is-set-before-the-page-paints` |
| 355 | The grid keeps its heading: INP at 4x tick 216 → 104 ms, saved filter 320 → 176, View pick 200 → 80 | `T-a-grid-draws-once-per-moment`, `T-a-heading-cell-is-kept` |
| 346, 353, 354, 356, 357 | One Send to; green chips everywhere; two filter races; favourites named after their View | `T-send-to-view-filters`, `T-a-pin-a-page-can-re-point`, `T-a-stale-draw-keeps-the-bars-own-change` |
| 348 W0–W1 | The bench counts scans; counts run only when something moved | — |

**Will's decisions, all recorded in `docs/TODO.md`:** 345 D1 A, D2 B, W1 A, W2 A;
346–349 D1–D5 A; 355 G1 A; the walk's Q1, Q2 A.

**Next:**
1. Read-only reviews of 355 C5 and 345 4.3–4.7 (agents hit a session limit at
   16:30; they reset at 17:30).
2. The walk (347–349): designed in `docs/history/plan-347-349-walk.md`, NOT yet
   checked against the code. Check it, then build it in its small commits.
3. 345 phases 3, 5, 6, 8, 9 (History after the walk; values on demand;
   always-fetch fields; the decision series widened; remote History).
4. 350 (performance): the leftovers from 355, and LCP (6.18 s at 4x when Will
   measured; 1.0–1.5 s in the probe here).

**Probes:** Demos `perf/inp.mjs`, `perf/cls.mjs`, `perf/profile.mjs` (against
:4200, Chromium, 4x). `node scripts/build-reforged.mjs --no-minify` for a
readable profile.

## Waiting on Will (❓ and looks)

305, 319, 321, 327, 338 (two UX choices), 293 (CLAUDE.md cut, old skill), 339
(Figma clean-up), 290 (rename `spoofRemote`), and looks by eye for 313, 323,
324 and 340. The stock-take's "What is still to do" lists each with a pick.
