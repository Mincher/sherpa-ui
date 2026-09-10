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

Most recent first. Each is a commit on `sherpa-reforged` with a long message
explaining the reasoning — `git log` is worth reading.

| Area | What changed |
|---|---|
| Charts | Hover tooltips on all five chart types; markers reveal on chart hover |
| Charts | Axes rebuilt as one CSS grid per Figma's own structure; both axes on all 2D charts; fixed-width truncating y-axis |
| Legend | Six-row cap with an "Other" roll-up + itemised breakdown menu; status swatches; horizontal legends wrap |
| Grid | Collapsible group rows; group-checkbox selection; selection survives sort/filter; three row states; sticky header; fixed-height scrolling container |
| Toolbar | Group + Sort chips; tri-state sort; multi-value chip filtering fixed |
| System | Focus rings are inset strokes (59 of them); nothing in the content area can sit above the nav |
