# Handover — the queue

What is outstanding, and what "done" means for each. Ordered by size.

See [HANDOVER.md](HANDOVER.md) for the traps and the working method.

---

## Known issue

### The Sort chip is NOT linked to the grid's column-header sort

Clicking a column header and picking a column in the Sort chip are still two
separate pieces of state, so they can disagree.

This is exactly what "bundle the toolbar into the grid" (below) is meant to
solve — do not patch it separately. Let the bundling make the two states one by
construction.

**The tri-state cycle itself is FIXED** (commit after `812436a2`). It was losing
the cycle after one full lap: `desc → suspended` left the direction on `desc`, so
the next "on" came back descending and the chip ping-ponged between descending and
off forever, never returning to ascending. `desc → suspended` now rewinds the
direction to `asc` while KEEPING the column, which is what makes "off" temporary
rather than a reset.

The spec now runs SIX clicks (two full laps). Three only proved the first lap,
which is why the bug shipped.

---

## In progress

### Show ALL tooltips on chart hover, de-overlapped

**Superseded — read the resolution below before doing anything here.**

Will's final ruling: **no visible markers, one tooltip.** The reader hovers the
chart's own visual (a donut segment, a gauge band, a bar) and gets that one tip.

Showing every tip at once was built and rejected: the donut's five covered its
own legend and the neighbouring panel, and a line chart showed sixteen tips with
twelve overlapping.

Done for the donut (hover the SVG slice), the gauge (invisible clip-path hit
wedges over each band) and the sparkline. **The line and bar charts still use
visible markers** — bring them in line with the others.

The radial trick is worth keeping and is already in
`radialArea()` (`src/core/format-tick.ts`): a tip pushed OUTWARD along its
marker's own radius clears the ring and cannot overlap its neighbours, because
markers on a ring fan out by construction. Verified zero overlaps on 8 markers.

---

## Queued

### 1. Bundle the toolbar + pagination INTO `sherpa-data-grid`

**Will chose:** "Grid owns both, slots for extras."

The problem this solves: the grid's column-header sort and the toolbar's Sort chip
are two separate pieces of state that can disagree. Bundling makes them one by
construction.

Shape agreed:

```html
<sherpa-data-grid data-toolbar data-paginated data-selectable data-filterable>
  <sherpa-quick-filter slot="filters" …></sherpa-quick-filter>
</sherpa-data-grid>
```

- The grid stamps its own toolbars and pager, gated by `data-toolbar` /
  `data-paginated`.
- The grid owns: sort, group, column filters, page, page size, selection.
- Slots let a host add its own chips or action buttons.
- One event out (`grid-change`) rather than the current five.
- The existing components stay usable standalone — the grid imports and composes
  them, it does not absorb their code.

**The ACTIONS toolbar is already DONE** — `data-toolbar` on the grid reveals a
real `sherpa-toolbar` above its header, with `actions-leading` /
`actions-trailing` slots. The records example's **Add customer** button lives
there now, out of the section header. What remains is folding in the QUICK-FILTER
toolbar and the PAGER:

```
┌ sherpa-toolbar              (DONE — data-toolbar)             ┐
├ sherpa-quick-filter-toolbar (still a sibling in the page)     ┤
├ the grid itself                                               ┤
└ sherpa-pagination           (still a sibling in the page)     ┘
```

Gating stays per bar: plenty of grids want filters with no page actions, or the
reverse.

Not started. This is a real rebuild; expect the examples' `records.js` wiring to
shrink a lot.

### 2. Pinned columns

- Checkbox column and the next column pinned LEFT by default.
- The actions column pinned RIGHT (the example grid has no actions column yet, so
  this needs one adding to demo it).
- A shadow on the pinned edge when content is scrolled under it.
- `position: sticky` per cell with `inset-inline-start`, and the pinned cells need
  their own opaque fill and a z-index above the scrolling ones — same lesson as
  the sticky header. **Remember `border-collapse` is now `separate`**, which is
  what makes cell z-index work at all.

### 3. Sparkline sub-pixel gaps

**Will:** use CSS `round()` to stop sub-pixel seams on the sparkline.

Each segment is a `clip-path` polygon on a flex child of fractional width, so two
neighbouring segments' edges land on fractional device pixels and a hairline of
background shows between them. Rounding the segment geometry to whole pixels
closes it.

Note the existing gotcha: `round()` was previously recorded as a **deliberate
no-op** in this codebase (see the modern-CSS upgrade memory), so check why before
assuming it works — it may need the value in a typed `@property` to round rather
than being dropped.

### 4. App header — another design review pass

**Will:** "still not to spec."

No specifics given, so start by data-matching it against Figma rather than
guessing: read the App Header node's own values (fills, padding, gaps, sizes,
text bindings) and diff them against `sherpa-app-header.css` property by
property. That method — Figma node DATA, not screenshots — is what found the
systemic drift in the earlier visual-diff pass.

Recent header work that may or may not be the issue: the bottom border was
removed, and it was made sticky with an elevation drop shadow on scroll-under
(CSS scroll-state). Check those first, then widen.

### 5. Data grid: Add Customer does not add data

Recorded in [BACKLOG.md](BACKLOG.md). A fix must cover five things: the whole
record via `FormManager`, where the row lands against the active sort, whether an
active filter hides it, the pagination totals, and the same gap in edit/delete.

---

## Specs declare an event's NAME but never its DETAIL

`schemas/component.v1.json:297` defines a `detail` field on an event. **Zero of
the 58 specs use it.** So the contract every agent and the MCP reads says
`quick-filter-change` exists and nothing about what it carries.

That is how three payload shapes hid behind one name until 2026-09-16: a bare
`string[]` from a chip, a `Record<id, string[]>` from the bar, and `[]` with an
`id` from an overflow toggle. Reading one as another emptied a grid on every
sort, and the fix — a `scope` marker — is invisible in the specs.

The generator would have to read the `emit()` call sites for their object
shape, which is harder than reading the event NAME (already done). Worth it:
the detail is the half of an event contract that a caller actually codes
against.

## Figma↔code translation — MEASURED 2026-09-16, narrower than feared

Will: *"The figma side was massively refactored but the translation etc. in the
codebase wasn't really kept in line."*

Measured rather than assumed, and the answer splits in two.

**The TOKEN path is current.** `figma.tokens.json` + `figma.extensions.json`
exported 15 September, `project-tokens.mjs` run the same day, `tokens.css`
rebuilt 16 September. The 9-layer order in the CSS matches the live Figma
collections. Nothing to do here.

**The COMPONENT contracts are broadly current.** `resync-figma.mjs --check`
against the 14 September Figma dump reports **1 drift in 58**, and it is a
case/order difference rather than a real mismatch:

    sherpa-container-header
      spec[Variant[Default,Panel,accordion]] vs live[Variant[Panel,accordion,default]]

**What HAD rotted was the SECONDARY data, and it is now dead weight only:**

| file | age | who reads it |
|---|---|---|
| `scripts/figma-data/variable-graph.json` | 14 Aug | `build-ontology.mjs` (output deleted), `lib/generation/data.mjs` |
| `scripts/figma-data/figma-read.json` | 25 Aug | `merge-figma.mjs` — RETIRED 2026-09-02 |
| `docs/ontology/*` | 25 Aug | **deleted 2026-09-16** |

So the drift was never in the live translation — it was in the artefacts built
FROM it, which nothing regenerated and nothing gated. See
[[sherpa-generated-artefacts-rot-silently]].

**Owed:** re-export `variable-graph.json` before the MCP rewrite rebuilds an
ontology from it, and decide whether `sherpa-container-header`'s variant casing
follows Figma or the code.

## Two deferrals rescued from VISUAL-DIFF.md (deleted 2026-09-16)

That doc was a completed by-eye pass (2026-09-08, "266 passed / 0 failed ✅"),
but it ended with two items nobody had picked up. They are recorded here so
they outlive the audit.

**1. The content-ink token needs ONE ratification, not per-component fallbacks.**
`style-content-base` / `theme-content-body-base` resolve to `#0c0b11`
(near-black) in code, where Figma binds `#35353d` (the softer secondary) for
body text. It recurs across metric, key-value-list, breadcrumbs, quick-filter
and the section-header title. Fixing it per component would scatter wrong
fallbacks; ratify the mapping once instead.

**2. Figma-side, not code:** the gauge-chart track binds a legacy
`_old_border/base` token. Needs a Figma cleanup pass.

## The token ontology was DELETED 2026-09-16 — rebuild it in the MCP rewrite

`docs/ontology/tokens.yaml` (522K) + `structure.yaml` described a design system
that no longer exists:

| check | result |
|---|---|
| knows the `display-mode` layer | **0 mentions** |
| knows the `structure` layer | **0 mentions** |
| still describes Typography | 52 mentions (collection DELETED) |
| still describes monochrome | 72 mentions (DELETED) |
| who read it | **only the MCP** |

Regenerating would not have helped: its source,
`scripts/figma-data/variable-graph.json`, is from 14 August and equally stale.

**A file that confidently describes deleted tokens is worse than no file** — an
agent reading it gets a wrong answer with no warning. `loadOntology()` is
double-guarded (`try/catch → null`, then `?? {}`), so everything degrades to an
empty object rather than failing.

Verified before deleting: the spec generator produces a **byte-identical**
spec without it, all 58 specs validate, and the MCP still imports.

`scripts/build-ontology.mjs` and `audit-ontology.mjs` were KEPT even though
nothing calls them — they are the only way to rebuild this from Figma, and the
rewrite will want them. Point them at a fresh `variable-graph.json` first.

## MCP server — a full rewrite, agreed 2026-09-16

Will: *"The MCP was created a long time ago so a lot of it will be outdated.
I'm fine with a full rewrite of the MCP later."*

**It currently tells agents to write a format that has no files.**
`scaffold_def`, `validate_def` and `compile_def` all produce or consume
`<name>.def.json`. There are **zero** such files in the repo; the component
contract is `<name>.component.yaml`, 58 of them. An agent that follows the MCP
writes a file nothing reads.

What is known wrong, from the 2026-09-16 sweep:

- the three `*_def` tools target the dead format
- `mcp-server/README.md` (26KB) documents ~19 tools; **10** are registered, and
  only ONE name overlaps
- `mcp-server/tools/generate.js` still points at `scripts/merge-figma.mjs`,
  retired 2026-09-02
- `mcp-server/lib/validation.js` hand-rolls a second notion of "valid
  component", independent of `schemas/component.v1.json` — two definitions that
  can drift
- the three docs it cited (`COMPONENT-DEFINITION-STANDARD`,
  `GENERATION-TOOLING`, `SYSTEM-OVERVIEW`) were deleted 2026-09-16 as they
  described the dead format. The reads are `existsSync`-guarded, so nothing
  crashes — the appendix is just empty.

A rewrite should start from `schemas/component.v1.json` and the 58 real specs,
not from what the old tools did.

## Owed from earlier passes

- **Sweep every component's projected properties for mode/extension resolution
  faults.** A cross-collection alias resolves at `:root` in the target's PRIMARY
  mode, so values can die silently. Fixed for the known cases via
  `MODE_ALIAS_TARGETS`; the full sweep was never done.
- **~20 components fail the def round-trip.** Pre-existing, from the def
  generator's old regex faults (now fixed). The defs need regenerating and
  checking.

---

## Recently finished (for context)

Most recent first. Each is a commit on `sherpa-data-layer` with a long message
explaining the reasoning — `git log` is worth reading.

| Area | What changed |
|---|---|
| Charts | Hover tooltips on all five chart types; markers reveal on chart hover |
| Charts | Axes rebuilt as one CSS grid per Figma's own structure; both axes on all 2D charts; fixed-width truncating y-axis |
| Legend | Six-row cap with an "Other" roll-up + itemised breakdown menu; status swatches; horizontal legends wrap |
| Grid | Collapsible group rows; group-checkbox selection; selection survives sort/filter; three row states; sticky header; fixed-height scrolling container |
| Toolbar | Group + Sort chips; tri-state sort; multi-value chip filtering fixed |
| System | Focus rings are inset strokes (59 of them); nothing in the content area can sit above the nav |
