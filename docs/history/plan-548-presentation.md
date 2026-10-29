# Plan: one data, many presentations (TODO 548)

Will, 2026-10-29: *"I actually think it goes a long way towards unifying data
transformation and interaction."* This is the priority, because it changes
the base of the filtering and data-layer work.

## What Will asked for

1. **A presentation menu.** An icon-only menu button sits right of each chart container's header, and in a data grid's toolbar before its search. It offers: Default (what the definition says), Bar chart, Donut chart, Pie chart and Data Grid. A pick swaps the component for that one, over the SAME data.
2. **Group and Sort for every presentation.** A chart grouped by another field draws each segment SUBDIVIDED by that field: a stacked bar, or a split donut or pie section. The legend toggles those sections.
3. **A filter toolbar under each chart container's header**, with Group and Sort chips. A chart's Sort has no field menu: it cycles ascending, descending, none.
4. **A primary and a secondary field** for every presentation. The secondary is the chart's segmentation. The group is the sections inside each segment.
5. **The filter panel follows** a presentation change of its content.

## What exists today

- **Charts** (from a code map, 2026-10-29):
  - `sherpa-barchart` and `sherpa-radial-chart` (`data-type="donut|pie"`) draw ONE dimension: `{ label, value, colorIndex, matched }` per segment.
  - The only mark inside a segment is the highlight's `matched` part (TODO 441).
  - `sherpa-line-chart` draws several series. The gauge and the metric draw one number.
- **How a chart asks for data:** its `static asks` names a shape (`segments`, `series`, `aggregate`). The provider builds a `SummarySpec` from the chart's attributes and runs `summariseMarked`. The attributes are `data-segment-field`, `data-field`, `data-aggregate`, `data-over-field`, `data-bucket` and `data-bands`.
- **A summary takes no group and no sort today** (`aggregate.ts` `SummarySpec`).
- **A chart has no scope of its own.** Its legend is a picks part: the scope `picks:<legend id>` narrows the chart (`only`), and the panel draws it as one Simple filter.
- **Group and sort today** live in the Query, in the ONE scope that arranges ROWS (`arrangementOf`, TODO 523 S1). A summary's scope does not arrange (TODO 341).
- **A grid** is declared by `data-scope` and its columns in the page JSON (`ui.grid`).
- **Swapping today:** an element put in the page asks for its data by itself, and one taken out lets go. A View swaps content through allow-listed markup.
- **History:** TODO 52 once proposed chart arranging chips ("Segment by", "Measure", "Over"). Will chose a first, small shape: only the legend filter.

## The design (my proposal)

### 1. One SLOT per content, one scope per slot

Each content place on a page (a chart container, the grid) is a SLOT with a stable id and its own scope. The scope stays when the presentation changes. So the panel keeps ONE section per slot, and what that section shows follows the presentation (step 5).

### 2. The data layer: a summary that groups and sorts

`SummarySpec` gains `group` (a field) and `sort` (`asc`, `desc` or none). These reuse code that exists:
- `segments` with a group: each segment's rows go through the same `aggregateBy`, by the group field. A segment becomes `{ label, value, colorIndex, parts: [{ label, value, colorIndex }] }`. Its value stays the segment's total.
- `sort`: the segments are ordered by value, ascending or descending; none keeps the declared order.
- Grouping is still a DATA-LAYER concept (`T-a-group-is-a-data-layer-concept`). A chart is TOLD its parts and never works them out.

### 3. The charts draw parts

- **The bar chart** stacks a segment's parts. Each part takes its group value's colour.
- **The donut and the pie** split a section into its parts.
- **The legend** keeps listing the SEGMENT values and toggles whole segments (Will: B). A part's tip names its group value.
- **The highlight's `matched`** stays the inner mark of a part.

### 4. A filter toolbar per chart, and the presentation menu

- Each chart container gets a small filter toolbar under its header. It is the existing `sherpa-quick-filter-toolbar`, bound to the slot's scope, and shows only its Group and Sort chips.
- **Sort** is a chip with no menu. It cycles with `nextSort`, the same cycle the grid heading uses.
- **Group** offers the source's list fields, as `describe()` already decides (523 S5).
- **The presentation menu** is a `sherpa-menu` on an icon-only `sherpa-button`, in the container header and in the grid's toolbar. A pick is a REQUEST to the page; the component never swaps itself (one owner).

### 5. The swap

- A small app-layer element, `sherpa-presentation`, wraps one slot. Its template holds one prototype per kind: bar, donut, pie, grid. A pick clones that prototype in place of the old one (rule 17: everything it shows is in its template).
- The slot's attributes (primary and secondary field, scope) sit on the wrapper, and the component inherits them. The provider's existing ask (connect asks, disconnect lets go) binds the new component. There is no new binding path.
- **The panel follows** because the scope is the slot's. A chart presentation draws its legend field. A grid draws its local filters.

### 6. Primary and secondary in the definition

Each slot in the page JSON names `presentation` (the default), `secondary` (the segment field), `primary` (what is measured: `aggregate` and `field`, a count when none) and its grid columns. The Records and Dashboard pages in Demos are moved to it.

## Phase C and D in detail (2026-10-29, after Will's answers)

**A slot's presentation is ONE object in its scope**, not the row arrangement's keys:
- `ScopeQuery.presentation = { kind?, primary?, secondary?, group?, sort? }`.
- `kind` is bar, donut, pie or grid. `sort` is asc or desc; none is no key.
- Only what differs from the definition is kept.

Why not the existing `group` and `sort` keys? They are the ROW arrangement:
- They live in ONE scope per source (TODO 523 S1).
- Setting them strips them from every other scope.
- A chart's group and sort shape its SUMMARY, not the rows, so two charts and a grid each keep their own. A separate key keeps the row machinery as it is.

Saved Views, export and a reload carry it, as `definitionOf` carries any scope key (Will: A).

**The slot is the wrapper**, so phase D's `sherpa-presentation` comes before phase C's toolbar:
- It carries `data-scope`, the definition's `kind`, `primary` and `secondary`, and the chart attributes its child inherits.
- The provider reads the slot's `presentation` from the Query and builds the summary from it: the secondary is the segment, the primary is a `distinct` count unless an aggregate is named, and group and sort are passed straight through.
- A change of it asks again, as an attribute change does today.

**The chart toolbar** is the existing bar, bound to the slot's scope, showing only its organise zone: Compare, Group, Sort.
- Its chips send ONE request, `{ presentation: { … } }`, through the same `quick-filter-change` door as any chip, to a `QueryContext.present(scope, patch)` door.
- A Sort chip with no menu cycles with `nextSort`.

## Phases

| Phase | What | Proof |
|---|---|---|
| A ✅ | The data layer: `group` and `sort` on a summary (step 2) | Unit tests on `summarise`; check:bench |
| B ✅ | The bar stacks parts, the donut and pie split a slice by spokes, in the segment's own colour; tips list the parts; the legend is unchanged (Will: B) | e2e in 3 engines; pixels read back |
| C | `ScopeQuery.presentation` and `QueryContext.present` (data layer); the slot wrapper `sherpa-presentation`; the provider builds a chart's summary from it | unit tests; e2e: a grouped slot draws parts; a reload keeps them |
| D | The chart toolbar (Compare, Group, Sort) and the presentation menu; the swap; primary and secondary in the definition | e2e: each swap draws the same data |
| E | The panel follows a swap; Demos pages moved | Demos tests; full suites |

Each phase is its own commit series, test first. Each one ships without the ones after it.

## Will's answers, 2026-10-29

1. **A grouped chart's legend: B.** The legend keeps listing the segment values ("By status": the statuses) and toggles whole segments. The parts have no key of their own; a part's tip says its group value and its number.
2. **Where a slot's presentation, group and sort are kept: A.** In the Query, in the slot's scope. A saved View and a reload keep them.
3. **Primary: B, unless a definition says otherwise.** The primary defaults to the grid's leading column; a definition may name another, since "it wouldn't make sense to use Name field from the Customer Records grid as the Primary". **And a Compare chip**, before Group, lets the reader choose the two fields that drive the chart.

### What that means in the design (my reading, for now)

- **Primary:** what a chart COUNTS. Each segment's value is the number of DIFFERENT primary values among its rows, unless the definition names an aggregate (a sum of seats). It defaults to the grid's leading column. Records names `customer`, so "By status" counts the customers in each status.
- **Secondary:** the segmentation. One bar or one slice per value.
- **Group:** the parts inside each segment.
- **The chart's toolbar** under its header holds Compare, Group and Sort, in that order:
  - **Compare** picks the primary and the secondary (two lists in one menu).
  - **Group** picks the parts.
  - **Sort** cycles ascending, descending, none.

All three are kept in the slot's scope in the Query (answer 2).

## Choices for Will (asked 2026-10-29, answered above)

1. What a grouped chart's legend lists: A the group values; B the segment values, toggling whole segments.
2. Where a slot's presentation, group and sort are kept: A the Query; B the component only.
3. What "primary field" means: A what is measured; B the grid's leading column.
