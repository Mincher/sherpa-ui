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

## In hand: TODO 344 — markup, default variants and text come from the `.html` and `.css`

Will, 2026-10-19: JS/TS must not provide a component's markup, default
variants or fixed text; the `.html` and `.css` do, and `SherpaElement` provides
the mechanism. Seven groups are done and tested; four are left. The TODO 344
section lists each with its commit. The plans — one per group, each checked by
a second agent, with exact code — are in `docs/history/plan-344/`.

**New base mechanisms, all in `src/core/ui/sherpa-element.ts`** (read their TRAPs):

| Mechanism | TRAP |
|---|---|
| A `content` prop's default is its target's own text in the template; `PropDef.default` is gone | `T-the-templates-text-is-the-default` |
| `data-swap-on` / `data-swap-*`: a value that follows a host attribute, written in the markup (`src/core/ui/swap.ts`) | `T-a-swapped-label-is-in-the-markup` |
| `<template class="words">` + `this.word(key)`: a fixed word the code hands on as data | `T-a-word-is-in-the-markup` |
| No attribute is the default variant; the projector's `unset` for the nav | `T-no-attribute-is-the-default-variant` |

**Left, in this order:**

1. **1b** nav-item's search highlight — `docs/history/plan-344/group-1-css-and-structure.md` (b).
2. **1c** the calendar's projected header as a `<sherpa-group>` — the same file, (c).
3. **1d + 3b(a)** helper-owned markup: the ⋮ menu rows (`src/core/ui/more-menu.ts`)
   and `menuFor()`'s menu and date calendar (`src/core/ui/filter-menu.ts`). The
   two plans (`group-1…` (d) and `group-3b…` (a)) propose two mechanisms. Use
   ONE: `static html` as a LIST of family files, as `static css` already is.
4. **1a** the toast stack: `static pageCss` adopted into the document, and
   `:state(stacked)` — `group-1…` (a).
5. Then: PRINCIPLES rule 17's exceptions, recounted; the TODO 344 row ✅.

After each: `node scripts/generate-component-spec.mjs <name>`, `npm run manifest`,
`npm run reference`, `npm run traps:write` (a TRAP's `Site:` must list every file
that cites it), `npm run map:write <file>`, then `npm run check:size -- --update-baseline`
if a file grew on purpose. At the end, `npm run check:weight -- --update-baseline`.

## Also asked for, not done: the stock-take

`docs/history/STOCKTAKE-2026-10-19.md` is Will's overview, with Mermaid
diagrams. He asked for two things:

1. **Update it with what 344 changed** once 344 is done: the new mechanisms
   above, the component diagram, and anything it says that is no longer true.
2. **Add Mermaid diagrams of how an APP, a VIEW and a UI COMPONENT are created
   at run time**, showing exactly how JSON, HTML, CSS and JS interact as
   contracts, templates and definitions. Drafts, each checked once against the
   code, are in `docs/history/stocktake-runtime-drafts/` (`app.md`, `view.md`,
   `component.md`). They were written while 344 was under way, so bring the
   component draft up to date.

Check every diagram renders before you commit: load
`mermaid@11.4.1` from cdn.jsdelivr.net in a Playwright page and call
`mermaid.render()` on each block. Will reads the file in Obsidian.

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

## Waiting on Will (❓ and looks)

305, 319, 321, 327, 338 (two UX choices), 293 (CLAUDE.md cut, old skill), 339
(Figma clean-up), 290 (rename `spoofRemote`), and looks by eye for 313, 323,
324 and 340. The stock-take's "What is still to do" lists each with a pick.
