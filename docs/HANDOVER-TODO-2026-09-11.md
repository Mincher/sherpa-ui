# TODO — carried over from the 2026-09-11 session

Written at Will's request before the usage window closed. Everything below is
**not started** unless a line says otherwise. Items are ordered as Will raised
them.

Branch: `sherpa-reforged`. Everything from this session is COMMITTED (7 commits,
`1f0336c0`..`53383287`) but **nothing has been pushed** — pushing is Will's call.

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

## 3. CSS grid for the CONTENT AREA INSIDE a chart container

**Will's words:** "We should use a simple CSS grid to layout content in containers
on the Dashboard. A 2 column grid with a 60/40 ratio split. The chart should take
up the 60%. For vertically stacked content, a 2 row grid with a 70/30 split. Again
the chart takes the larger cell."

**Scope — read this carefully.** This is NOT the dashboard's own page layout. It
is the content area *within* each container that holds a chart. Will confirmed
this explicitly. The dashboard's grid of cards is not in scope.

On `examples/templates/dashboard.html` every chart container holds a chart AND a
legend, so the split is **chart vs legend inside one container**:

| Container | Chart | Second item |
|---|---|---|
| Alerts by category | `sherpa-barchart` | `sherpa-chart-legend` horizontal |
| Endpoints by OS | `sherpa-donut-chart` | legend, vertical, in its `legend` SLOT |
| Storage used | `sherpa-gauge-chart` | `sherpa-chart-legend` horizontal |
| Sessions vs. incidents | `sherpa-line-chart` | `sherpa-chart-legend` horizontal |

So the rule maps onto the legend's orientation:

- **Legend beside the chart** (vertical legend) → 2-column grid,
  `grid-template-columns: 3fr 2fr` (60/40), chart in the wide cell.
- **Legend below the chart** (horizontal legend) → 2-row grid,
  `grid-template-rows: 7fr 3fr` (70/30), chart in the tall cell.

Two things to check before writing it:

1. **The donut already does this itself.** Its legend is a real slot
   (`slot="legend"`), so `sherpa-donut-chart.css` owns that side-by-side layout
   internally — see its `.layout` flex rule. Decide whether the donut keeps
   owning it or is converted to the shared grid; do not end up with two
   competing layouts on the same component.
2. **Where the rule lives.** The other three legends are SIBLINGS of the chart
   inside the container, not slotted into it, so their layout belongs to whatever
   wraps them. Candidates: `sherpa-container`'s own content area (applies
   everywhere, needs an opt-in attribute), or a layout utility class in the
   `layout` cascade layer beside `.sherpa-view` — the layout tokens currently
   have 0 consumers, so there may be a home for it there rather than in one
   example file.

---

## 4. Button icon sizes don't match the Figma Structure size modes  ✅ DONE (bb0d6ea5)

**Will's words:** "Fix button icon sizes to match Figma structure modes icon
sizes."

The generated token region at the top of `sherpa-button.css` maps each
`[data-size]` to a `--sherpa-button-size-icon`. Those come straight from the
projector, so the SOURCE is Figma's `Structure.icon-size` per mode — which now
resolves:

| Structure mode | icon-size alias | px |
|---|---|---|
| `default` | `content/size/base` | 14 |
| `2xs` | `content/size/xs` | 10 |
| `xs` | `content/size/xs` | 10 |
| `sm` | `content/size/base` | 14 |
| `lg` | `content/size/large` | 16 |
| `xl` | `content/size/large` | 16 |

(The `sm` row is the one that changed this session — 12 → 14 — and the button's
generated region already picked it up.)

So check where the mismatch actually is before editing:

1. Compare the button's generated block against that table. If they agree, the
   region is fine and the bug is elsewhere.
2. The likely culprit is the **hand-written** `.icon` rule
   (`sherpa-button.css:165-168`), which sizes the glyph from
   `--sherpa-button-size-icon` with a `14px` fallback. A Font Awesome glyph is a
   FONT, so `inline-size`/`block-size` on the `<i>` box does not scale the glyph
   — `font-size` does. Check whether the rule sets font-size too, or only the box.
3. Read the real Figma Button node's `icon-start`/`icon-end` width/height
   bindings (`11:2463`) per Structure mode and compare. This session confirmed
   the Button set pins Structure=`default`, so its own instances render 14.

**Do not hand-edit the generated region** — it is regenerated by
`scripts/project-tokens.mjs`. If the values there are wrong, the Figma variable
is wrong.

---

## 5. Pagination — both inputs are too wide, and the select's arrow is wrong

**Will's words:** "Fix width of Row Count input and Current Page input on
Pagination. Too wide. Also fix the Row Count inputs dropdown button on the right.
Awkwardly flush with the right side. Not like design for select inputs."

### The widths

Both controls share ONE variable in `sherpa-pagination.css`:

```css
--_field: 88px;   /* .page-input and .rows both use it */
```

The comment above it already records why, and flags it as a Figma-side problem:
Figma's Input Field (atom) in the pagination row measures **89 × 32**, but 89 is
a HUG-derived width (value + stepper), not a designed step, and it is off the 8px
grid — so it was snapped to 88. The field is a hugging frame in Figma, so its
width drifts with its content.

Two ways to go, and it is Will's call:

- **Pin a real width in Figma** and re-read it. This is the "Figma is source of
  truth" answer and it also stops the row jittering.
- **Size them independently.** The page input holds 1–3 digits; the rows select
  holds "10"/"25"/"50"/"100". They do not need the same width, and 88px is
  clearly too much for either. Note they would then need separate variables.

### The select's dropdown arrow

`.rows` is a **native `<select>`**, so that arrow is the BROWSER's, not ours —
which is exactly why it sits flush to the right edge with no padding of its own.
The design's select inputs presumably show a chevron inset from the edge, with
the field's own padding respected.

Options, cheapest first:

1. `appearance: none` on `.rows`, then draw the chevron as a background-image (or
   a `::after` on a wrapper — a `<select>` cannot have generated content) and add
   `padding-inline-end` to clear it. This is the normal fix and keeps the native
   control.
2. Reuse whatever `sherpa-select` / the Input Field atom already does, if it has
   solved this — check before writing a second copy.

Check the Figma "Input Field (atom)" select variant for the chevron's glyph, size
and inset before choosing.

---

## 6. Four new Figma icons → Font Awesome  ✅ DONE (15f34470)

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

**Done (15f34470):** the data grid WAS the remaining case — it drew a pure-CSS
border triangle, which can only point up or down, so a sortable-but-unsorted
column showed nothing and read as unsortable. It now uses the same four pairs,
held as one public static (`SherpaDataGrid.icons`) with a test pinning them, so
the grid's arrow and the toolbar's chip cannot drift.

Swept the rest: the only other sort/caret glyphs are menu disclosure carets in
sherpa-chart-legend and sherpa-quick-filter, which are correct as they are.

**Noted, not done:** Figma's Grid Cell header (926:34238) carries its sort
control as a 16x16 icon Button in an `actions` frame beside a menu button. That
is a structural change to the header, larger than this item.

---

## 7. Full token sweep — pull CURRENT values from every collection, mode and extension

> **Note (2026-09-11):** a COMPONENT-level sweep is now done and tooled —
> `scripts/figma-harvest-colours.mjs`, which compares each component's CSS
> against the variable Figma actually BINDS (the question nothing was asking;
> see commits a14f985a and 8f5b4bce). That is a different axis from this item,
> which is about token VALUES per mode and extension. Both are still owed.

**Will's words:** "Do another pass of pulling current token values from all figma
variable collections, extension and modes and updating the CSS values where
needed."

This session only swept what Will named (Structure, then `style-content`). Both
times there WAS real drift, so assume the rest has drifted too.

### Scope

23 collections in `figma.tokens.json`, of which **9 are extensions** that carry no
leaves in the dump and are read from a separate cache
(`src/styles/tokens/figma.extensions.json`):

```
base collections   data-viz · display-mode · elevation · input · layout
                   layout-app-shell · layout-calendar-d · layout-calendar-m-y
                   navigation · primitives · structure · style · switch · theme
extensions         display-comfortable · display-compact · style-saturated
                   style-transparent · structure-snap-{all,top,bottom,left,right}-edge
```

Every collection × every mode. `display-mode` alone has light/dark; `style` has 8
status modes; `data-viz` has 15.

### Method that worked twice this session — do NOT re-export the whole file

`figma_export_tokens` on the whole file churns 800+ leaves and drags in the known
dangling-alias warnings, which buries the real changes. Instead, per collection:

1. **Read Figma** with `figma_execute`: resolve each variable's `valuesByMode`,
   turning a `VARIABLE_ALIAS` into `{collection.path.to.target}` (dots, not
   slashes) so it compares against the dump's reference format.
2. **Diff against the dump in Python**, normalising the reference prefix — the
   dump writes `{theme.content.size.small}` where the Figma side reads
   `{content.size.small}`. Strip a leading `theme.` / `display-mode.` /
   `primitives.` before comparing.
   **Ignore hex CASE** — a previous pass found 139 of 147 "differences" were case
   only.
   Remember the **primary mode lives in `$value`**, not in
   `$extensions[...].modes` (which only holds the non-primary modes). Missing that
   is why the first `style-content` patch attempt found nothing.
3. **Patch only the changed leaves** in `figma.tokens.json` — both `$value` (if
   primary) and `lastSyncedValue.<mode>.reference`, plus `modes.<mode>` for
   non-primary. Use a JSON round-trip with `ensure_ascii=True`, or the em dashes
   in every `$description` re-encode and the diff explodes to 132 lines.
4. **Re-project**: `node scripts/project-tokens.mjs`. It must report
   `✓ no warnings`. Check `git diff --stat` — a correct sync touches only the
   lines you patched.
5. **Sweep the hardcoded fallbacks.** This is the step that is easy to skip and
   the reason the pass matters: CLAUDE.md requires every `var()` fallback to equal
   the value the token actually resolves to. The `style-content` change left **25
   stale fallbacks across 17 component CSS files**. For each changed token, grep
   `sherpa-<token-name>, *#` across `src/components/` and compare.

### Extensions need a different read

An extension override **writes fine but reads back EMPTY** from
`valuesByMode` — a long-standing Figma API quirk, already recorded in memory. Read
them by creating a scratch node, binding the variable, pinning the node to the
extension's mode, and reading the RESOLVED value off the node. That is how
`figma.extensions.json` was built; `scripts/` has prior art for the bound-probe.

### Known Figma-side problems that will show up as noise

- Dangling aliases to `VariableID:7:9xx` (~25 warnings on a full export) — these
  are cross-library references, not drift. Do not "fix" them.
- `DATA VIZ series/2-10` were deleted in an earlier rename pass and flagged, not
  fixed.
- Anything the diff reports as hex-case-only is not a change.

### Worth doing first

Write the diff as a **reusable script** rather than ad-hoc Python in the shell.
This is the third time the same compare has been hand-rolled, and it will be
wanted again. `scripts/resync-figma.mjs --check` already does the equivalent for
component specs — a `--check` mode for TOKENS belongs beside it.

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
npm test             326 passed   (stable across 3 runs — no flake)
```

Scratch spec files (`test/e2e/zz-*.spec.ts`) were used for browser checks. Delete
any that remain — they are not part of the suite:

```bash
rm -f test/e2e/zz-*.spec.ts
```

---

## 8. Date/time should use the JavaScript Temporal API

**Will's words:** "The date and time aspects of sherpa (like in calendar
components) should use the javascript temporal api to be modern, robust, and
future proof."

Today `sherpa-calendar` uses `Date` plus hand-rolled ISO string helpers
(`toIso`, `parseIso`, `datePart`, the `TIME_RE` / `ISO_RE` regexes) and does its
own month arithmetic in `#step()` and `#renderDays()`. That is the code Temporal
replaces: `Temporal.PlainDate`, `PlainYearMonth` and `PlainTime` carry the
calendar maths, the ISO parsing and the formatting.

Worth checking first:

1. **Browser support.** Temporal shipped in Chromium 143. The tests run
   Chromium, but a component library cannot assume it — decide whether this
   needs a polyfill dependency, which would be the branch's FIRST runtime
   dependency and is Will's call, not an implementation detail.
2. **Where the boundary sits.** `data-value` is an ISO string on the public API
   and should stay one — a `Temporal.PlainDate` cannot live in an attribute.
   Temporal belongs INSIDE the component.
3. **The range and time paths** are the ones that benefit most: `#pickRange`
   compares ISO strings lexically today (which works, but only by accident of
   the format), and `data-has-time` splits on "T" by hand.

Also affects: the Menu Calendar variant's `time-clock` region, which has no code
counterpart yet — worth building on Temporal from the start rather than porting
it twice.

---

## 9. Figma colour OPACITY variable refactor

**Will's words:** "let's focus on the Figma colour opacity variable refactor."

Queued by Will while item 6 was finishing. Scope to be confirmed with him before
starting — the obvious candidates are the `color-transparent/*` group (raw hex +
alpha, graded 10/20/30/40/50% per step) and the `*-transparent` semantic
aliases, but which way the refactor goes is his design decision.

Read first: `sherpa-color-transparent-group` and
`sherpa-transparent-follows-primitives` in memory — `color-transparent/*` is RAW
HEX and does NOT follow a primitive re-point, so an orphan probe is owed after
any ramp change.

**Two things Will asked to fold into this work** (2026-09-11):

1. **Chart series colours should be set by CSS, not JS.** `sherpa-barchart`
   currently writes them in TypeScript —
   `bar.style.setProperty('--_hue', 'var(--sherpa-data-viz-series-N)')` — which
   is the one place in the system where a colour is chosen by script rather than
   by a selector. It also means a CSS-only audit cannot see series 2 and 3.
   Check `sherpa-line-chart`, `sherpa-donut-chart` and `sherpa-gauge-chart` for
   the same pattern.

2. **Fix the ramps in Figma** at the same time.

**The opacity idiom, so it is not misread again.** A translucent mark is ONE
bound hue at a paint opacity — the Legend Swatch and all five Donut slices are
`data-viz/categorical/color N` at 60%, with the variable on the STROKE and the
fill taking the same hue. That is correct and deliberate. I reported it as
"unbound in Figma" during the sweep; Will: *"It's not a figma problem. We use
the transparent color ramps in figma correctly. You just interpreted it all
wrong."* The code already matches it
(`color-mix(in srgb, var(--_hue) 60%, transparent)`).
