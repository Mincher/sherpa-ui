# Plan 683 — a status field: each value named by a condition, worked out by the data

Will, 2026-11-02: *"Gauge chart legend items/chips are numerical range filters combined
with 1 or more other field conditions. We should take a look at unifying them with how
other chart legend/chip items work so that we can re-use all of the functionality we've
built."* Then: *"The Health field should be an Advanced field, in the data, that refers
to other fields in the data and applies conditions to them for each health status value
it holds. This is a pattern that will probably be used for other status fields in the
future so it should be agnostic of the concept of 'health'. Then we're also not relying
on the UI components to do this calculation and mutation work. It all comes from the
data."*

It is the data layer's first RULE — the first condition that matches gives the value —
so it serves the rules engine of [DATA-LAYER-PLAN](../DATA-LAYER-PLAN.md) too.

---

## Today

Health is a NUMBER, 40 to 100, that declares `thresholds` (TODO 150,
`T-a-threshold-is-a-fact-of-the-field`): At risk below 60, Watch below 80, Healthy to 100.

- **A banded number is a list of its bands** (TODO 477, `T-a-band-is-a-value-of-its-field`):
  the catalogue lists the band names, a pick compiles to its range, the walk counts a row
  under `bandOf`, and a saved filter names one, `{ health: { band: 'At risk' } }`.
- **The gauge** asks for the thresholds and draws them as zones; `data-invert` turns them
  round for "Mean risk". Its legend picks the bands; a pick highlights its zone (479).
- **A bar chart** over a banded number is cut at the thresholds (`bandEdges`).
- **A band can read one number only.** "High risk" (`health < 60` and `openTickets > 0`)
  is a preset, not a value, so no chip, legend or count can speak it.

The band code is about 60 lines in 15 files: `threshold.ts`, and a banded branch in
`filter-state`, `where`, `field-catalogue`, `walk`, `source-counts`, `aggregate`,
`chart-datum`, `filter-def`, `filter-menu`, `context`, `chart-parts`, `sherpa-menu`,
`sherpa-quick-filter`, `sherpa-provider` and `sherpa-gauge-chart`.

## After

A **status field** is defined once, with the data, as JSON:

```json
"health": {
  "label": "Health", "type": "status",
  "values": [
    { "value": "At risk", "status": "critical", "where": { "score": { "lt": 60 } } },
    { "value": "Watch",   "status": "warning",  "where": { "score": { "lt": 80 } } },
    { "value": "Healthy", "status": "success" }
  ]
}
```

- **The first value whose condition matches is the row's.** Its `where` is the one
  condition language every View and preset writes (`T-one-way-to-write-a-condition`), so it
  may read several fields: `{ "score": { "lt": 60 }, "openTickets": { "gt": 0 } }`. A value
  with no `where` takes every row the earlier ones left. A row none match has no value.
- **The data layer works it out**, at the store seam: `statusFields(store, defs)` wraps any
  store, as `fakeRemote` does. Every row it gives carries the value. A filter on it becomes
  conditions on the fields it reads — `health is Watch` is "not At risk, and score below 80"
  — so a server answers it and never hears of `health`. It says its values in order, each
  with its status, as the field's domain. A change to a field it reads is a change to it. A
  write that names it is refused: it is read-only.
- **Then it is a field like any other.** Chips, menus, legends, counts, Limit, the grid's
  column, a bar chart and the highlight all use what they use for a list field now. A gauge
  draws its zones from it.
- **Sorting and grouping by it** need its rows held — a local store, or a held set (in the
  worker, plan 652). A remote store that is not held cannot do either, and it says so.

## Decisions for Will

| # | Question | A (my pick) | B |
|---|---|---|---|
| D1 | Its name. A field's `advanced: true` already means "its filter offers Advanced conditions" | A **status** field: `"type": "status"`. Your word "Advanced" stays with the filter | An **advanced** field. Today's `advanced: true` is renamed in the same change |
| D2 | Where it is defined | With the **store**: the data's own definition, in the module the page and the worker both import (plan 652 D7). Every page, and the worker's held set, see one field | In each **page's** definition, beside its label. A page could define its own; the worker never sees it, so the page works it out over the rows it gets |
| D3 | Bands, after this | **Retire** `thresholds` and `band`: a banded number becomes a status field over it (Health over a `score`). One way to name a value by a condition. S5 deletes the band code and its two traps | **Keep both**: bands for one number's ranges, status fields for conditions on several fields |
| D4 | The gauge's zones | From the status field the gauge names: each value whose condition is a range of the gauge's own number is a zone. Its legend chips are that field's values, as every chart's are. A value with no such range has a chip and no zone | The gauge keeps its own `data-zones` to draw, and its legend chips are the status field's values. The two need not line up |

## The steps

Each step is measured in the running app. Each step deletes what it makes redundant (plan
652's rule): measure that nothing still needs it, delete it, and say so.

| Step | What | Done when | What it makes redundant |
|---|---|---|---|
| S1 | The data layer: the definition, `statusFields(store, defs)` — the value on each row, filters turned into conditions, the values and statuses as its domain, counts, changes, writes refused | Node: over an `ArrayStore`, a `fakeRemote` and the worker's `HeldStore`, a page filters, counts and sorts by a status field, and no filter that reaches a remote store names it | Nothing yet |
| S2 | The controls: the catalogue lists a status field's values, each in its status — chips, menus, legend swatches; an Advanced row on it asks *is* and *is not* | Records' chips, panel and legend pick Health's values, and the counts and Limit speak them | The catalogue's and the walk's banded branches |
| S3 | The gauge (D4) | The Records gauge's zones and legend come from Health; a legend pick filters Health and highlights its zone | The gauge's `thresholds` ask and the provider's banded legend binding |
| S4 | Demos: `score`, the number, and `health`, the status field, in `records-data.js`; the presets, Views, "At risk", the Learn Filtering pages; the Dashboard's storage gauge | Demos all green, in three engines | `thresholds` in Demos' definitions; `{ band: … }` in its Views |
| S5 | Cleanup: `threshold.ts`, `band`, `bandOf`, `bandCondition`, `bandEdges`, every banded branch; the two traps folded into the new one (D3 A) | No `thresholds` or `band` left in `src/`; `check:size` falls | — |

## Risks

- **A remote store that is not held cannot sort or group by a status field.** It says so,
  as a store that cannot project does. Demos' remote mode holds its set in the worker.
- **A count per value from a remote store not held** is one request per value.
- **A projection** must ask the fields a status field reads: the wrapper adds them.
- **A histogram cut at thresholds goes** (D3 A). A bar chart over the status field draws the
  same bands, as categories. Check no page needs the histogram.
