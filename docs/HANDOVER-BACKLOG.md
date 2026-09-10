# Handover — the queue

What is outstanding, and what "done" means for each. Ordered by size.

See [HANDOVER.md](HANDOVER.md) for the traps and the working method.

---

## In progress

### Show ALL tooltips on chart hover, de-overlapped

**Asked:** hovering a chart's visuals shows every marker *and* every tooltip. If
two tips overlap, move the obscured one so it is readable.

Markers-all-visible is done (`:host(:hover) .hotspot::after`). Tooltips are still
per-marker.

This is the one place JS positioning is justified: overlap resolution needs
measured rects, and CSS cannot compare two boxes. Suggested shape:

- CSS keeps owning *placement* (anchor positioning puts each tip above its mark).
- On chart hover, reveal all tips, then one pass in JS: sort by position, and for
  each tip that intersects an already-placed one, push it along the block axis (or
  the inline axis for a horizontal run) until clear. Write the offset as a
  `--_nudge` custom property so CSS applies it — JS supplies a number, CSS moves
  the box, consistent with the rest of the chart code.
- Keep the single-marker hover behaviour: hovering one tip should still bring it
  to the front.

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

### 3. Data grid: Add Customer does not add data

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
