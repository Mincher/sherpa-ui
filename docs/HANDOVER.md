# Handover — Sherpa-UI `sherpa-reforged`

**Read this before touching anything.** It is the knowledge that is *not* in the
code: the traps, the rulings, and the reasons behind decisions that look odd.

`CLAUDE.md` has the rules. This file has the *why*, and the list of things that
have bitten repeatedly.

| Doc | What it holds |
|---|---|
| [HANDOVER.md](HANDOVER.md) | This file — orientation, traps, working method |
| [HANDOVER-BACKLOG.md](HANDOVER-BACKLOG.md) | What is queued and what "done" means for each |
| [HANDOVER-FIGMA.md](HANDOVER-FIGMA.md) | Figma-side model, probe recipes, open flags |
| [BACKLOG.md](BACKLOG.md) | The Add-Customer data gap (older note) |

---

## 1. Ground rules that are easy to get wrong

### Will's working preferences

- **ELI5 replies.** Small words, short sentences. Say what you did, whether it
  worked, what is next. Two options maximum when he has to decide, with a
  recommendation.
- **Figma is the source of truth.** Code maps to it. If code and Figma disagree,
  Figma wins unless Will says otherwise — and then the divergence goes in the
  component's `.component.yaml` `_divergence:` block, not just a comment.
- **Never push.** Commit freely on `sherpa-reforged`; pushing is his call.
- **Judge with your eyes, not just numbers.** See §3.

### The golden rule

HTML → CSS → JS, in that order. JS is the last resort. If a thing can be a
`data-*` attribute plus a CSS selector, it must be.

---

## 2. Traps that have cost real time

These are all *silent* failures. Nothing throws; the result is just wrong.

### CSS anchor positioning

| Trap | Result | Fix |
|---|---|---|
| Anchor name crosses a shadow boundary | Tip lands in the viewport corner | Measure the trigger rect in JS (`sherpa-menu` does this) |
| **An SVG element as the anchor** | `anchor-name` computes fine and never resolves | Use a real HTML element as the mark |
| **An `position: absolute` MARK** | A `position: fixed` tip drops to the mark's own corner | The tip must be a SIBLING in a *static* layer, not a descendant. A wrapper around the pair does **not** help — it recreates the same absolute ancestor. |
| `--_anchor` never set | `position-area` is meaningless, tip goes wherever | Set the name on BOTH the mark and the tip |
| `block-start span-inline-end` in `position-try-fallbacks` | Browser prefers the span area over the plain centred one, so nothing renders centred | Use `@position-try` with self-alignment to *shift* the tip, not a different area |

The working pattern lives in `src/core/sherpa-base.css` under
"Chart mark tooltips". All five charts use it. Read that block before changing a
tooltip.

### Tables

- **`border-collapse: collapse` ignores `z-index` on cells.** Scrolling rows
  painted straight over a sticky header no matter how it was stacked. The grid
  uses `separate` + `border-spacing: 0`, which looks identical and paints
  correctly. This cost several wrong hypotheses (opaque fills, per-cell sticky).
- **A sticky offset is measured from the SCROLLPORT.** Giving a second header row
  `inset-block-start: <first row height>` applied it at scroll 0 too, leaving a
  phantom empty band. The whole `<thead>` sticks as one block instead.
- **`display: block` on a `<table>` breaks column layout.** To make a table
  scroll, wrap it in a scroll DIV.

### Shadow DOM

- **`*` does not match `:host`.** Every host was `content-box` until
  `sherpa-base.css` set it explicitly.
- **A custom property inherits across a shadow boundary; a SELECTOR does not.**
  `tokens.css` is light-DOM only, so `[data-status]` set on an element *inside* a
  shadow root never matches its cascade block. Name the target token directly
  (see the chart legend's status swatches).
- **`:host:not(…)` chained form is broken.** Use `:host(:not(…))`.
- **`stopPropagation` does not stop same-node listeners.** When a component
  listens on its own host for an event its children emit, use
  `stopImmediatePropagation` — otherwise a host listening on the same element
  still receives the raw child event.

### SVG

- **A `<circle>` cloned from an HTML `<template>` is an `HTMLUnknownElement`** in
  the XHTML namespace. It clones, appends, reports correct attributes, and paints
  nothing. Wrap the prototype in `<svg>` so the parser switches namespace, then
  clone the child.
- `stroke-linecap: round` adds a HALF-STROKE dome at each end. On a thick donut
  band that turns a small slice into a blob. Use butt caps plus a gap.

### CSS misc

- **`gap` cannot be negative.** Chromium returns `normal`. Use a negative
  `margin-inline-start` for snapped control pairs.
- **`margin-inline: auto` overrides `align-items: stretch`.** Needs an explicit
  `inline-size: 100%`.
- **`min-block-size: 0` is what lets a flex child shrink below its content** and
  scroll. Without it the child wins and the parent grows.
- Focus rings are **inset** strokes (`box-shadow: inset 0 0 0 2px`). An outer ring
  bleeds over neighbours in a snapped pair or a table cell.

### The projector (`scripts/project-tokens.mjs`)

- **A backtick inside a JS template literal kills the script silently** and leaves
  the PREVIOUS `tokens.css` in place. Two rounds of measurement tested stale
  output before this was found. If a token change seems to have no effect, check
  the projector actually ran.
- A Figma FLOAT **count** projects as `px` and voids `repeat()`. `COUNT_PATHS` in
  `walkLeaves` types counts as `number`.

---

## 3. The working method that actually works

Learned the hard way — the pagination width was asked for **three times** because
measurements said it was fine.

1. **Screenshot and look.** Numbers describe the box you measured, not the one on
   screen. Twice a probe reported the host at the right width while the controls
   inside bunched up; twice a probe said "aligned" while a band of a scrolling row
   showed through.
2. **Draw guide lines** when checking alignment — inject a red 1px div down the
   container's edges and compare visually.
3. **Reproduce in isolation** when a CSS feature seems not to work. The absolute-
   ancestor anchor bug was 20 lines of `page.setContent` and settled in one run,
   after three wrong guesses in the real component.
4. **Probe scripts live in the scratchpad**, and the harness is served by
   Playwright's own web server (`/test/reforged/harness.html`) — a plain
   `playwright` script cannot reach it. Put a throwaway spec in `test/e2e/` and
   delete it after.
5. **Fix tests honestly.** If an assertion is now wrong, update it *with the
   reason in a comment*. Never loosen one to make it pass. Timing failures get an
   awaited event (`transitionend`, the popover `toggle`), never a sleep.

### Commands

```bash
npm run build          # tokens → lint:css → tsc → copy assets
npm run type-check
npx playwright test    # 321 specs, ~15s
node server/index.mjs  # examples on :4200 (usually already running)
```

Examples route on **`?view=<name>`**, not a hash: `localhost:4200/?view=records`.
Views are `dashboard`, `records`, `settings`, `chat`.

### Known flaky specs

Two fail intermittently under full parallel load and pass alone. Not regressions
— re-run the single file before investigating:

- `reforged-nav.spec.ts` › "typing in search filters the rows and marks the matched text"
- `reforged-breadcrumbs.spec.ts` › "clicking a crumb fires breadcrumb-select"

---

## 4. Where the interesting code is

| Concern | File |
|---|---|
| Shared chart tooltips (anchor positioning) | `src/core/sherpa-base.css` |
| Tick positions shared by axis labels AND gridlines | `src/core/format-tick.ts` |
| The token projector | `scripts/project-tokens.mjs` |
| Grid: grouping, selection, filters, sticky header | `src/components/sherpa-data-grid/` |
| Toolbar: Group/Sort chips, tri-state, value chips | `src/components/sherpa-quick-filter-toolbar/` |
| Menu: measured placement + Apply/Cancel commit | `src/components/sherpa-menu/` |

### Patterns worth reusing

**Suspend but remember.** Three controls now share it: the Sort chip, the
value-filter chips, and the legend's "Other" row. Turning a control OFF stops it
applying but does NOT clear its selection, so turning it back on restores exactly
what the user last chose. Getters split into *applied* (`values`) and
*remembered* (`pickedValues`).

**State lives on the component, keyed by the record.** The grid holds selection as
a `Set<GridRow>` and the focused row as a record reference — not row indices, and
not read back off the DOM. Every re-render replaces the whole body, and an index
means something different once a sort or filter changes.

**One number to CSS, CSS does the geometry.** The chart markers are the clearest
case: the JS hands over one angle (donut, gauge) or an x/y percentage pair (line,
sparkline), and `cos()`/`sin()`/`calc()` place the dot. Nothing is measured, so
nothing re-runs on resize.

---

## 5. Figma-side flags (not yet fixed in Figma)

Carried forward — none block code work:

- **Data Viz `series/2`–`series/10` are DANGLING** after a colour rename.
- The Chart Legend binds deleted `Typography::` and `Snapping::` collections.
- The pagination Input Field hugs its content (89px, off-grid).
- No `--sherpa-theme-*` alias exists for the neutral **transparent +1/+2** steps,
  so the grid's focused row reaches for the (mode-aware) `display-mode` var
  directly.
- The Grid Cell's group variant binds `Style::style-surface/dark`, which is not
  one of the four projected `style-surface` vars. Probed what it PAINTS
  (`#e8e8f6`) — that is exactly `style-surface/base +1`, which is what the code
  uses.
- The header-cell Divider rectangles have `width` bound to `scale/0` and no fill,
  so they are invisible on canvas. **Will has confirmed this is a deliberate
  workaround** — code draws them at `border-width/sm` in `style-border/base`. No
  Figma change needed.
