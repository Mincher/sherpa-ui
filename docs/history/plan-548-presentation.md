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
- **The legend** lists the GROUP values while grouped, and toggles those parts in every segment (question 1).
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

## Phases

| Phase | What | Proof |
|---|---|---|
| A | The data layer: `group` and `sort` on a summary (step 2) | Unit tests on `summarise`; check:bench |
| B | The bar, donut and pie draw parts; the legend toggles group values (step 3) | e2e in 3 engines; pixels read back |
| C | Each slot's scope; the chart toolbar's Group and Sort; where they are kept (question 2) | e2e; a reload keeps them |
| D | `sherpa-presentation` and the menu; primary and secondary in the definition (steps 5, 6) | e2e: each swap draws the same data |
| E | The panel follows a swap; Demos pages moved | Demos tests; full suites |

Each phase is its own commit series, test first. Each one ships without the ones after it.

## Choices for Will

1. **What a grouped chart's legend lists.** Example: "By status", grouped by Plan. Each Status bar stacks its Plan parts.
   - **A (my pick):** the legend lists the PLAN values, the parts' colours. A toggle hides that part in every bar. This is how a stacked chart is usually read.
   - **B:** the legend keeps listing the Status values and toggles whole bars. The parts have no key.
2. **Where a slot's presentation, group and sort are kept.**
   - **A (my pick):** in the Query, in the slot's scope. A saved View and a reload keep them, as they keep a grid's sort.
   - **B:** on the component only. A reload goes back to the definition.
3. **What "primary field" means.**
   - **A (my pick):** what is MEASURED: the aggregate and its field, a count when none. The secondary is the segmentation.
   - **B:** the grid's leading column, which a chart would count by.
