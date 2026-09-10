# Handover — the queue

What is outstanding, and what "done" means for each. Ordered by size.

See [HANDOVER.md](HANDOVER.md) for the traps and the working method.

---

## Known regressions — fix these first

### The Sort chip has lost its tri-state toggle

**Reported by Will.** Two faults, probably one cause:

1. The chip body no longer cycles ascending → descending → suspended. It was
   working and verified (`asc` → `desc` → off-with-column-kept → back to `desc`)
   in commit `9f95c197`, so something since has broken it.
2. It is **not linked to the data grid's column-header sort**. Clicking a column
   header and picking a column in the chip are still two separate pieces of
   state, so they can disagree.

Fault 2 is exactly what the "bundle the toolbar into the grid" item below is
meant to solve — do not patch it twice. Fix the tri-state cycle first (it is a
regression in `sherpa-quick-filter-toolbar`'s `#cycleSort` / `#onChipClick`
path), then let the bundling make the two states one by construction.

Start by re-reading `#cycleSort`. Its subtlety: **the chip flips its own
`data-current` before emitting `quick-filter-click`**, so the cycle has to undo
that flip first. Getting that wrong makes the chip appear stuck on ascending —
every click flips it off and the "suspended → on" branch puts it straight back.
There is a passing spec for the whole cycle in
`test/e2e/reforged-quick-filter-toolbar.spec.ts` ("the leading Group / Sort chips
organise the grid"); if it still passes while the browser misbehaves, the spec is
driving the wrong element.

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

- The grid stamps its own toolbar and pager, gated by `data-toolbar` /
  `data-paginated`.
- The grid owns: sort, group, column filters, page, page size, selection.
- Slots let a host add its own chips or action buttons.
- One event out (`grid-change`) rather than the current five.
- The existing components stay usable standalone — the grid imports and composes
  them, it does not absorb their code.

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

### 4. Data grid: Add Customer does not add data

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
