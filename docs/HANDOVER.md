# Handover — 2026-10-26

For the next Claude session on sherpa-ui, now on ANOTHER Claude account. Read
`CLAUDE.md` and `docs/PRINCIPLES.md` first, as always; this says where the work
stands.

## Moving to another Claude account

The repo holds the rules, the TODO and the traps. These live OUTSIDE it:

| What | Where | Carries over? |
|---|---|---|
| Memory: ~300 notes on how Will works and the traps found | `~/.claude/projects/-Users-williammincher-Documents-My-synced-vault-Projects-sherpa-ui/memory/` (index: `MEMORY.md`) | Yes on this Mac: a new login keeps `~/.claude`. On another Mac, copy the folder to the same path |
| The ELI5 output style (ASD-STE100 replies) | `~/.claude/output-styles/eli5.md` | As memory |
| Settings, permissions, hooks | `~/.claude/settings.json` | As memory |
| User skills | `~/.claude/skills/` | As memory |
| claude.ai connectors (Figma, Claude Docs) | the claude.ai account | **No.** Connect them again in the new account |
| figma-console MCP | `.mcp.json` (not tracked) | Yes. Never read, edit or stage it: it holds a plaintext token |

## Where the code stands (2026-10-26)

- All four repos are clean: nothing uncommitted.
- `sherpa-data-layer` is 124 commits ahead of `origin` (last push 2026-10-21);
  `../Sherpa Demos` `main` is 65 ahead. Push is Will's call.
- `../Sherpa Starter` and `../Sherpa Gallery` have no git remote.
- Demos links sherpa-ui by `file:`: **run `npm run build` after each change**.
  Will runs Demos' server on :4200; never stop it.
- A peer session, `sherpa-demos-5a` (in Demos), was live on 2026-10-26. Never
  stash. Stage only your own files, and only when `git diff --cached` is empty.

## Where the work stands (2026-10-26)

**Done since 2026-10-22: TODO 396–441**, but for the rows below. Each item's
note is in its section of `docs/TODO.md`. The large ones:

| Item | What it gave | Plan / TRAP |
|---|---|---|
| 350 D1 | `dist/bundle/` (esbuild, split): Records 221 → 33 requests; Demos, Gallery and the Starter map to it | `T-a-page-loads-the-bundle` |
| 424 | ONE chip logic: the bar marks and greys a field's chips through `filter-host.ts` (`markField`, `limitField`); the old panel went in 476 | `docs/history/plan-424-one-chip-logic.md` |
| 425 | The toolbar in PORTRAIT (`toolbar-column.ts`) IS the filter panel, and the default; the classic panel is behind Settings › Application › Classic filter panel | `docs/history/plan-425-portrait-toolbar.md`, `T-the-panel-is-the-bar-in-portrait`, `T-a-shut-column-draws-nothing` |
| 426–428, 430–440 | Demos' Records on the column; Manage Saved Filters; Favorite, Save, Refresh and Suggest filters in the App Header; View Context label and container | — |
| 436 | Demos' Settings › Filtering: every filter switch on one page; `provider.switchable`, `contextLabel`, `sections`; `outlet.definition`, `outlet.reload` | — |
| 441 | Highlight matches: one chip drives it (`query.highlight`); grid rows tint; bar, slice, line and gauge draw the matched part | — |

**Open, in TODO order:**

- 🚧 425 — rounds 1 and 2 are done. **Waits on Will's look.**
- ⬜ 402 — `sherpa-metric-group`, and sticky metrics that work. The next item
  to build.
- ⬜ 415 — simplify the toolbar's and the panel's filter code. PLAN first, with
  Will.
- ⬜ 429 — a shareable Demos build. Built, then reverted at Will's word. To bring
  it back, revert the reverts of sherpa-ui `471b50a8` and Demos `d7d3914` — only
  when Will says.
- ⬜ 379–384 and 417 are "for later" (Will); 364 is deferred; 390 is a WebKit
  flake (~1 in 40).
- ❓ 350 (Will's look at the load), 388, 413 (not reproduced: needs Will's
  screenshot). 392 waits (Will: A).
- 🚧 older: 287 5b, 288 8b–10, 291 8 — plan again first, their plans predate
  366. Also 293, 321, 323.

## How Will works

- He reads replies in **ASD-STE100 Simplified Technical English**: small words,
  short sentences, active voice. A decision is **2 options at most**, your pick
  first, with the context to choose fast. Start a handover with "Written for: you, Will."
- **Keep churning the TODO** (`docs/TODO.md`). Do not wait for a go between
  items. A real decision becomes a ❓ row, and you move on.
- **Commit every item.** Push only when Will asks (he asked on 2026-10-17 and
  2026-10-19). Never push `backup/main-before-secret-fix`: it holds a Figma
  token. Never read, edit or stage `.mcp.json`: it holds a plaintext token.
- **Test 10x less** (Will, 2026-10-21). Per change: type-check, build, the
  pre-commit gates, and the ONE new or changed spec, in Chromium only. Full
  suites (every repo, every engine) only at the END of a TODO item.
- Bugs found mid-work are QUEUED in the TODO, not fixed in passing.
- A done item keeps its row and its section, marked ✅. Nothing is deleted.

## Where the code stood (2026-10-22)

- Branch `sherpa-data-layer`, pushed to `origin` on 2026-10-19.
- `../Sherpa Demos` (branch `main`) is pushed too. It links sherpa-ui by
  `file:`, so **run `npm run build` after each change** or Demos shows the old
  code. Will runs its server on :4200 — never stop it; Demos' Playwright reuses it.
- `../Sherpa Starter` has no git remote; its commit `1eb862f` is local only.
- A peer session (`sherpa-demos-a7`) may exist. Never stash. Stage only your
  own files, and only when `git diff --cached` is empty.

## Where the work stands (2026-10-22)

**TODO 345 is built: all nine phases.** A remote store is held once per store,
read only for the fields a page uses, and asked what moved instead of read
again whole. Each phase's note is in 345's section of `docs/TODO.md`.

| Phase | What it gave | TRAP |
|---|---|---|
| 5 | A remote store not held reads a field's values only when the field is needed; a menu says Loading | `T-a-field-reads-its-values-when-needed` |
| 6 | `"fetch": "server"` / `data-fetch-fields`: a field the store answers, asked once per answer for its keys | `T-a-server-field-is-asked-once-per-answer` |
| 7 | `LoadOptions.fields`, `Store.projects`, RestStore `fields=`; a projected row is checked on what it was sent | `T-a-projected-row-is-checked-on-what-it-was-sent` |
| 8 | A page from a definition reads only its fields: declared, held, answered, sorted, searched, and what its components name; a later column is read alone, joined by key | `T-a-held-set-reads-the-pages-fields` |
| 9 | `Store.changes(since)` (RestStore `changesUrl`): a reopen or a tab shown asks what moved and reads only those columns | `T-a-remote-store-says-what-changed` |

- 369 (tiered values) is done but for its remote part, TODO 392, which waits
  for Will (A).
- Commits since the push of 2026-10-21 are local. Push is Will's call.
- **Done 2026-10-22, after 345:** 391 (a tiered field is never drilled), 376
  (Hide invalid values is the ⋮ menu's header toggle), 389 and 390 (Demos
  flakes: a missed wait, and machine load). 350 measured: GOOD at 4x on
  localhost, held by Demos' `check:perf`; the slow first load is the network.
- **Waiting on Will:** 350 D1 (ship a bundle, or a modulepreload list), 321
  (one key for saved Views), 318 (toolbar arrow keys), 388, 392, and the
  "for later" rows 379–384.
- **In reach, but plan again first** (their plans predate 366): 287 step 5b,
  288 steps 8b–10, 291 step 8 (one compile per act).

## Where the work stood (2026-10-21)

**TODO 366 is ✅: one Query per app Context**, in 26 steps (`docs/history/plan-366-build.md`;
each step's note is in 366's section of `docs/TODO.md`). TODO 320 closed with it.

| What it gave | TRAP |
|---|---|
| A `QueryContext` holds the Query — applied and draft — and every declaration; sources join it, and `source.query` IS it. The provider makes one per page; a Context gets it as `ctx.query` | `T-a-context-holds-the-only-query` |
| The arrangement and the search are in the Query; a superseded chip's own answer too (`ScopeQuery.superseded`) | `T-one-query-one-owner`, `T-a-superseded-chip-suspends-it-is-never-removed` |
| One-field doors (`setReading`, `suspend`, `take`, `reset`, `batch`); a request whose answer is in force is a no-op; one `query-change` per change | `T-one-query-one-owner` |
| Every filter control — the bar, the panel, a grid heading — sends ONE request per act and paints only what it is drawn; a bound bar locks its chips | `T-a-control-sends-one-request`, `T-locked-chip-relays-and-nothing-else` |
| The page keeper hears `query-change` and reads `by`; `ProviderState` is v2 | `T-a-view-keeps-a-draft`, `T-a-page-goes-out-as-json` |
| Several sources may share one Query: each compiles only its own scopes and the fields it has | `T-a-source-compiles-only-what-it-has` |

- The branch is NOT pushed since 2026-10-19; Demos has local commits too.
  Push is Will's call.
- Known flakes, both older than 366: TODO 389 (Demos layout resize) and 390
  (WebKit Settings overlay, about 1 in 40).
- **Next:** 369's remaining parts (the panel, the grid, Demos' child link, the
  remote lazy read); 345's phases; 350 (performance); the ❓ rows.

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
| Reviews of 355 C5, 345 4.3–4.7, 357 | 24 faults fixed: a cleared heading menu, row checkboxes, a set too big now, a late kept copy, a 401 copy, offline saves, a blocking reopen, `clearKept()`, the banner's words, focus and z-index; two favourites of one name | `T-a-kept-set-is-checked-each-session`, `T-a-reach-banner-takes-no-room` |
| **347, 348, 349 — the walk** (C0–C10 + its review) | ONE order (saved filters, then fields, each set together); ONE walk per key gives every count, grey, set-aside and serial offer; a chip counts within the filters before it; the earlier filter limits the later; with Limit off the View still limits a component scope; the Add list greys a spent field. Bench `records/report` scans 32 → 3, distinct 10 → 0. INP at 4x: every act under 200 ms | `T-one-walk-counts-and-limits-in-order`, `T-a-chip-counts-within-the-filters-before-it`, `T-a-ruled-out-value-is-greyed` |

**Will's decisions, all recorded in `docs/TODO.md`:** 345 D1 A, D2 B, W1 A, W2 A;
346–349 D1–D5 A; 355 G1 A; the walk's Q1, Q2 A.

**Next:**
1. 345 phases 3, 5, 6, 8, 9 (History — the walk is in, so it is unblocked; values
   on demand; always-fetch fields; the decision series widened; remote History).
   The walk's seam for History: each scope's tested and tallied fields
   (`docs/history/plan-347-349-walk.md` §0.H).
2. 350 (performance): the leftovers from 355; LCP (6.18 s at 4x when Will
   measured); `perf/inp.mjs` needs panel-mode acts (it hangs in panel mode);
   the walk made "a second value" 88 → 112 ms and "a View pick" 80 → 96 ms —
   look at what a draw sends every control.
3. The ❓ rows waiting on Will (305, 319, 321, 327, 338, 293, 339, 290).

**Probes:** Demos `perf/inp.mjs`, `perf/cls.mjs`, `perf/profile.mjs` (against
:4200, Chromium, 4x). `node scripts/build-reforged.mjs --no-minify` for a
readable profile.

## Waiting on Will (❓ and looks)

305, 319, 321, 327, 338 (two UX choices), 293 (CLAUDE.md cut, old skill), 339
(Figma clean-up), 290 (rename `fakeRemote`), and looks by eye for 313, 323,
324 and 340. The stock-take's "What is still to do" lists each with a pick.
