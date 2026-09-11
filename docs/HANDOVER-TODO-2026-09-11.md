# TODO — carried over from the 2026-09-11 session

Written at Will's request before the usage window closed. Everything below is
**not started** unless a line says otherwise. Items are ordered as Will raised
them.

Branch: `sherpa-reforged`. Nothing has been pushed.

---

## Running processes (restart these first)

Two background processes were up when the session ended. Restart both before
picking anything up:

```bash
npm run build:watch      # tsc watch + CSS/HTML asset watch → dist/
npm run serve:examples   # express template server on :4200
```

The examples SPA **needs** the express server — it fetches `/template/view/<name>`,
a route the static preview server does not have. Open
`http://localhost:4200/?view=dashboard` (or `?view=records`).

`npm run build:watch` was changed this session: it used to be `tsc --watch` only,
which never pushed CSS or HTML. It now runs `scripts/build-reforged.mjs --watch`
(tsc + assets). `npm run build:watch:ts` is the old tsc-only behaviour.

---

## 1. Data grid — sticky first two columns  ⬅ NEXT

**Will's words:** "The first 2 columns of the data grid aren't pinned. They should
be sticky and the other columns scroll under them. They have a drop shadow when
content is scrolled under them. Group header checkboxes and labels (and other
content) should not move on horizontal scroll either."

Three parts:

1. **Pin the first two columns.** In `records.js` those are the selection
   checkbox cell and `Name`. `data-selectable` prepends the checkbox cell, so the
   pinned set is "the selection cell + the first data column" — do NOT hardcode
   `nth-child(1), nth-child(2)`, because the offset changes when `data-selectable`
   is absent.
2. **Drop shadow when content scrolls under them.** Only while actually scrolled
   — so it needs to react to scroll position, not just exist. A CSS-only route:
   `scroll-state(scrollable: inline-start)` container query (Chromium 133+), which
   avoids a scroll listener entirely. Check support before committing to it; the
   fallback is a scroll listener setting one attribute on the host.
3. **Group header rows.** Their checkbox and label must not move on horizontal
   scroll either. A group row spans all columns, so its content needs to stick to
   the inline-start edge independently of the row's own width.

Files: `src/components/sherpa-data-grid/sherpa-data-grid.{css,html,ts}`.

The grid already scrolls horizontally (`overflow: auto` on the scroller,
`white-space: nowrap` on cells) — verified with 13 columns at 2296px in a 1132px
box, so there is a real overflow to test against.

---

## 2. Quick filter toolbars — missing action buttons

**Will's words:** "Both quick filter toolbars don't have the Add, Reset Filters,
Refresh Data, Configure buttons on the right. The View level quick filter toolbar
also doesn't have the fave/save/as button group on the right. Check the designs
and get to work."

- **Read the Figma design first** — Will said "check the designs". The Figma
  component is "Filter Toolbar", and `docs/COMPONENT-SPECS.md` records the code as
  deliberately simpler than Figma: the baked-in view chip, preset dividers and the
  action cluster (Add / AI / undo / refresh / star / Save / overflow) were all
  "delegated to slots". So this is a decision to REVERSE, not a bug — check
  whether the buttons should be built in or composed by the host.
- Figma has a `Type = data | view` variant axis that the code does not implement
  (recorded as a divergence). The "View level" toolbar Will mentions is the `view`
  type — so implementing this probably means implementing that axis.
- Two toolbars are in play on the dashboard/records views; confirm which two Will
  means before changing shared code.

Files: `src/components/sherpa-quick-filter-toolbar/*`, and whichever example views
mount them.

---

## 3. Dashboard — CSS grid layout for container content

**Will's words:** "We should use a simple CSS grid to layout content in containers
on the Dashboard. A 2 column grid with a 60/40 ratio split. The chart should take
up the 60%. For vertically stacked content, a 2 row grid with a 70/30 split. Again
the chart takes the larger cell."

- 2-column: `grid-template-columns: 3fr 2fr` (60/40), chart in the wide cell.
- 2-row: `grid-template-rows: 7fr 3fr` (70/30), chart in the tall cell.
- Applies to the containers on the **dashboard** view
  (`examples/templates/dashboard.html`). Check whether this belongs in the example
  or in a reusable layout utility — the layout layer already ships
  `.sherpa-view` and the layout tokens have 0 consumers, so there may be a
  home for it there rather than in one example.

---

## 4. Four new Figma icons → Font Awesome  (decision made, not yet applied everywhere)

Will added `group`, `sort-none`, `sort-ascending`, `sort-descending` to the Figma
Icons page (all 14×14, zero padding). Will chose **map to Font Awesome**, not a
local SVG icon set.

**Done this session** — the quick-filter toolbar's organise chips now use a single
named map (`SherpaQuickFilterToolbar.#icons`):

| Figma | Font Awesome |
|---|---|
| `group` | `fa-solid fa-layer-group` |
| `sort-none` | `fa-solid fa-bars` |
| `sort-ascending` | `fa-solid fa-arrow-up-wide-short` |
| `sort-descending` | `fa-solid fa-arrow-down-wide-short` |

That also fixed a real bug: the OFF state wore the ascending arrow, so a
suspended sort looked identical to an active ascending one.

**Still to do:** check whether anything else in the codebase shows a group or sort
glyph and should use the same map (the data grid's own sortable headers are the
obvious candidate — they may draw their own indicator).

---

## Done this session (for context — no action needed)

- **Icons page:** cleared padding + gap on 208 icon component sets in Figma. The
  3 frames under "Icon — Docs" were zeroed too; Will said that frame is outdated
  so it was left.
- **Quick filter chip label:** one value picked → `Field: Value` using the row's
  visible text. Two or more → bare field name.
- **Count badge:** only at 2+ picked values, so it never reads `1`. Removed
  `count` from the toolbar's `populate()` API entirely — on a toggle chip it could
  only mean a result count, which a server-side query does not know up front.
- **Badge tooltip:** hovering the count badge lists the chosen values in a bubble
  above it. CSS-only reveal; the same list is on the badge's `aria-label` because
  the bubble is `aria-hidden`.
- **Active-but-empty chip:** a value chip that is ON with no values picked paints
  the WARNING look (#FFF4E1 / #FFC44C) instead of purple. JS sets `data-empty`.
- **Structure `icon-size` at `sm`: 12 → 14.** Diffed the whole Structure
  collection against Figma; that was the only change. Patched
  `figma.tokens.json`, re-projected. Also fixed the quick-filter caret, which
  hardcoded the old 12px.
- **Records example:** 30 rows/6 columns → **100 rows/13 columns**, 10 pages.
  `spend` is now a real number (it sorted as text before, putting $90 after
  $1,000); data uses a seeded PRNG so it looks unpatterned but is reproducible;
  the `owner` chip now filters (it had no matching column).
- **CLAUDE.md:** removed every stale claim — nonexistent npm scripts, the
  `@function` library, `FlowManager`/`FormManager`, the MCP tool counts (really 10
  tools / 4 resources / 3 prompts), `.fallowrc.json`, `css/styles/`,
  `patterns/`, `docs/SLOT-CONTRACTS.md`.
- **2D charts:** the top axis value had no gridline in BOTH the barchart and the
  line chart. Line chart: the loop ran `1..bands-1`, now `1..bands`. Barchart: a
  `repeating-linear-gradient` cannot place a line at 100%, so the top line is now
  the box's own `border-block-start`.
- **Gauge chart:** rebuilt as **half a donut** — stroked SVG arcs, one per band,
  same primitive as a donut slice. This fixed the inaccurate hit targets Will
  reported: the old target was an HTML wedge clipped from the HUB to the rim, so
  the hollow centre was hittable and the band's outer edge was not. Now the
  stroke IS the target. Verified: each band lights its own tip, and the hollow
  centre lights none. The full-length grey track is gone; the remainder is one
  grey band from the same code path.

- **Gauge segments:** now the hue at 60% with a solid 1px outline, matching the
  donut. The outline is two thin arcs tracing the band's inner and outer edge
  (one stroked circle carries one paint), `pointer-events: none` so it never
  competes with the band for the tooltip. Hover lifts the band to the full hue.
- **Token sync — `style-content/base` and `/secondary`:** Will re-pointed both in
  the Figma Style collection's `default` mode. Diffed the whole `style-content`
  group; exactly two changes:
  `base` `content.body.+1` → `content.body.base` (#35353D → **#0C0B11**) and
  `secondary` `content.body.+2` → `content.body.+1` (#B3B3C3 → **#35353D**).
  Patched `figma.tokens.json`, re-projected, and swept **25 stale hardcoded
  fallbacks across 17 component CSS files** (`--sherpa-style-content-base`'s
  fallback still said `#35353d`). Audited every `theme-content-body-*` fallback
  too — those alias unchanged ramp steps, so none needed touching.

### Gauge geometry — traps worth not re-learning

Three attempts failed before the arcs landed. All three are now written into the
comments, but in short:

- `viewBox="0 50 100 50"` shows the **bottom** half. SVG's y grows downward, so
  the top half is `0 0 100 50`.
- `preserveAspectRatio="none"` on a 2:1 box **stretches the circle**, so no dash
  length can trace a true arc. Remove it; the viewBox is already 2:1.
- Rotating the circle to move the dash origin to 9 o'clock does not work with
  `transform-box: fill-box` — `transform-origin: 50% 50%` resolves against the
  circle's own 92×92 fill box, which is not its centre in viewBox coordinates, so
  the whole ring swings. Bake the half-turn into `stroke-dashoffset` instead:
  `-(0.5 + from * 0.5) * circumference`.
- Playwright's `.hover()` on a band **misses**: a band is a full `<circle>`, so
  its bounding-box centre is the hollow middle. Use `getPointAtLength` to sample
  a real point on the visible run.

---

## Verification state at end of session

```
npm run type-check   clean
npm run lint         clean
npm run lint:css     55 files · 0 errors · 0 warnings
npm test             327 passed
```

Scratch spec files (`test/e2e/zz-*.spec.ts`) were used for browser checks. Delete
any that remain — they are not part of the suite:

```bash
rm -f test/e2e/zz-*.spec.ts
```
