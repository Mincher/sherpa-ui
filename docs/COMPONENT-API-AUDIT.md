# The component API audit — one job, one name, one piece of code

TODO 86, for Will's review. 2026-09-29. **Nothing is changed until Will rules.**

Will, 2026-09-27: *"take a look at all of the functions and events for all UI
components to see where there is logical duplication but name, or
implementation, divergence. If it can make generic requests, expects generic
responses, and can be standardised in sherpa-element … then we should make
those optimisations. … Do the assessment first, for review."*

---

## 1. How it was measured

- Every component's public surface was read from its spec: **63 components,
  102 event names, 59 method names, 58 property names**.
- Five read-only reviews, one per family, each checked against the code with
  `file:line` references. Line counts are COUNTED (copies found by diff);
  anything not counted says so.
- `COMPONENT-AUDIT.md` (2026-09-23) is the earlier audit of the CODE; this one
  is of the public API. `PROVIDER-DESIGN.md` §9 was the first pass. Its open items are folded in
  here: 4, 5 and 7 are §2.1; 10 is §2.2; 12 is §2.4; 14 is §2.1; 15 is §2.6.

**Where the weight is:** the filter family is 7,655 lines in five components
(grid 2,037 · toolbar 1,946 · menu 1,474 · panel 1,405 · chip 793). Every other
component is under 500.

---

## 2. The findings

### 2.1 Filters — 718 copied lines

The bar, the panel and the grid headings each READ a field's answer out of a
menu, and each WRITE one back into a menu — three copies of each, plus a
fourth spelling of the answer (`ColumnFilter`).

| copied | where | lines |
|---|---|---:|
| menu → `FieldReading` | toolbar `#answers` · panel `#readingOf` · grid `#readColumnFilter` + `#columnReading` | 154 |
| `FieldReading` → menu | toolbar `setChipReading` + `setChipValues` · panel `setFieldReading` · grid `setColumnFilter` + `#heldFromClause` + a restore block + `#flushChains` | 162 |
| the grid's own filter menu | `#addColumnFilter` + `#addColumnValues` + the `data-column-values` parser — the bar and panel use the shared `menuFor()` | 211 |
| report an answer | three emitters, and a hand-built label where `filterFace` exists | 71 |
| clear one field · held above · forwarding · `ColumnFilter` | toolbar, panel, grid, app-header | 120 |

One act has several names, and one name has several meanings:

| act | today |
|---|---|
| an answer changed | `quick-filter-change` in three detail shapes · the grid's `column-filter-change` and `filter-change` |
| add, remove | the bar's `filter-add` / `filter-remove` report it is DONE; the panel's `filter-add-request` / `filter-remove` REQUEST it — one name, two meanings |
| condition mode | the menu's `filter-mode-change` (list or conditions) — the provider's `filter-mode-change` (panel or toolbars) is a different job with the same name |

**The source reads almost none of it.** It takes the panel's `readings`, the
grid's `field` and `reading`, and for a bar it IGNORES the event and reads the
bar's properties by duck typing. Dead detail keys: `picked`, `active`,
`clause`, `label`, `header`, `op`, `value`, `from`, `to`. Events with no
listener outside tests: `calendar-apply`, `calendar-cancel`, `filter-clear`,
`filter-condition-change`, `menu-cancel`, the menu's `filter-mode-change`.

**The standard:**

- **The MENU owns the answer**: `menu.reading`, get and set, as a
  `FieldReading` (`T-a-menu-owns-its-own-bodies`). The bar, the panel and the
  grid ask the menu — three readers and three writers become one.
- **Three members on every filter control**: `drawScope(slice)` (the whole
  scope, silent), `drawReading(field, reading)` (one field, silent — already
  the name on all three), and `readings` (keyed by FIELD everywhere).
- **One event per act, one detail**: `quick-filter-change { scope, readings,
  presets? }` — a JSON merge-patch of the scope's Query, `null` for cleared;
  `filter-add` / `filter-remove { scope, ids }`, always a REQUEST;
  `sort-change` / `group-change { field, direction }`. The menu's mode event
  becomes `condition-mode-change`.
- **The grid's headings use `menuFor()`**, their values from the source.
- **Deleted:** 18 public members (`setChipValues`, `setChipReading`,
  `setFieldReading`, `setColumnFilter`, `columnClause`, `columnReading`,
  `columnLabel`, `suspendColumnFilter`, `clearColumnFilter`, `supersede`,
  `superseded`, `supersedeColumns`, `savedReadings`, `presets`, `heldFields`,
  `active`, `panel.values`, the app-header's `values` and `available`), the
  events `column-filter-change`, `filter-add-request`, `filter-clear` and
  `filter-condition-change`, and the source's duck-typed reads.
- **Cost:** about 153 test sites call the members that go; 22 synthetic
  events need the new detail.

### 2.2 Form controls — 152 copied lines, and bug 61

Four components wrap a native control and copy the same code; ONE is part of a
`<form>`.

| copied | copies | lines |
|---|---|---:|
| `value` / `checked` get and set | 7 + 3 | 68 |
| mirror host → control | 4 wrapped + 3 others | 69 |
| the `change` re-emit | 4 | 37 |
| `focus()`, `checkValidity()`, re-sync on change | 5, 3, 3 | 33 |
| the radio untick | radio, select-card | 20 |

`ElementInternals` exists once (input-text). A `disabled` JS property exists
once (switch).

**The standard** (as proposed — Will's rule in §5 overrides the base class: a
component extends `SherpaElement` alone, so this becomes the same NAMES on
each, and an imported helper where one fits): `SherpaFormControl extends SherpaElement`, in
`src/core/ui/`. It owns form association, `value` / `checked`, `name`,
`disabled`, `required`, one validity report after EVERY write,
`checkValidity()` / `reportValidity()`, `focus(options)`, form reset and
restore, `formDisabledCallback`, and the `change` / `input` re-emit. Each
component keeps its own mirror list and its own extras.

**Bug 61 then needs almost no page code**: the Add customer dialog becomes a
`<form>` of named, required fields, and Save submits it — the browser blocks
it and focuses the first bad field. Four gaps stop that today: validity goes
stale (a field populated later reads empty), `type="email"` is not mirrored,
no field has a `name`, and `sherpa-button` cannot submit.

### 2.3 Open and close — about 120 copied lines

| job | names today |
|---|---|
| close | `hide()` on 4 components · `close()` on 5 |
| open | `show()` on 4 · `open()` on the filter panel |
| "it closed" | `close` · `menu-close` · `filter-panel-close` · the accordion's `toggle` |
| "open it, please" | `notifications-open` · the grid cell's `menu-open` · `view-menu-open` |

| copied | copies | lines |
|---|---:|---:|
| dialog and overlay panel, open and close | 2 — **already drifted**: the overlay lacks the late-close guard | 52 |
| `open` proxied to a native element | 4 | 30 |
| the trigger mirror (`data-open`, `aria-expanded`) | 3 | 26 |
| the expand flip | 5 | 15 |

**The standard:** `show(trigger?)`, `hide(reason?)`, `toggle(trigger?)`, with
`close()` kept as an alias of `hide()` (`T-one-verb-proxies-to-the-native-one`);
`open` as a read-write property reflected to the attribute; `<noun>-open` and
`<noun>-close { reason }`, fired from the STATE change, never from one path
(`T-every-close-reports-or-the-toolbars-stay-hidden`); a request to open is
`<noun>-click`. It lives in a new `src/core/ui/disclosure.ts` — only 9 of 63
components open, so the base class does not carry it. `<dialog>`, `popover`
and `<details>` stay underneath.

**Must land together:** the provider's `open()` loads a PAGE, and it calls
`panel.open?.()`. Give the panel an `open` boolean and that line throws.

### 2.4 Charts — 64 lines to delete, 76 lines of CSS copied

| finding | lines |
|---|---:|
| three "hide a series" doors (`setBarHidden`, `setSeriesHidden`, `setSliceHidden` and their getters): **no caller** outside tests, and every provider push clears them | 64 — delete |
| `legend-breakdown-change` repeats the `legend-item-click` fired after it | delete |
| bar and line chart layout CSS | 76 identical |
| bar and line value axis — one algorithm, two copies | 52 |
| tip text, anchor names, hue pairs, the ring arc (radial and gauge) | 37 |
| the line chart builds SVG with `createElementNS`; radial and gauge use a template | 13 |

Values print three ways: tips use `formatValue`, the legend prints the raw
number, the gauge tip and the `aria-label`s print it raw too.

**The standard:** delete the three doors and the repeated event; the legend's
`picked` is the one door, keyed by LABEL (a legend's index is not its chart's
index once a category is empty). A shared `src/core/ui/chart-parts.ts` holds
the value axis, the tip, the anchor pair and the series paint. The line chart
uses the SVG template. Status colours come from ONE list (`chart-datum.ts`).
Every value prints through `formatValue`.

### 2.5 Items, selection and remove — about 100 copied lines

| job | names today |
|---|---|
| pick one item | `nav-select` · `tab-change` · `breadcrumb-select` · `step-click` · `row-click` · `notification-click` · `item-click` — three endings, three ways to say which (id, index, label) |
| which is current | `data-current-id` + `currentId` (tabs) · `data-current-id`, no accessor (nav) · `currentStep` · the grid's `data-focused` (the house word is `data-current`) |
| `select()` | the tabs' fires an event; the grid's is silent; the source's is a different job |
| ticked set | the grid's `selectedKeys`, the transfer list's `getSelectedValues()` (0 callers) and `selected`, the list item's `selected` — `detail.selected` means row indices, values or a boolean |
| remove me | `chip-remove {}` · `tag-remove` (no detail) · `file-remove` |

| copied | lines |
|---|---:|
| mark the current child | 36 (5 components) |
| find an element on the event path — `pathFind` exists in the base, written again 4 times | 20 |
| the expand toggle | 17 |
| `sherpa-chip` and `sherpa-tag`: the TS differs by 2 lines, the template by its wrapper class | chip is 241 lines |

**The standard:** one CURRENT contract — the host holds `data-current-id` and
a silent `currentId`, respects `data-locked`, fires `<noun>-select { id,
index, label, href? }`, and marks its children; items report, hosts mark. One
TICKED contract — `selected: string[]`, silent, replaces the whole set;
`detail.selected` is always keys. `select()` is always silent. Two words for
going away: `<noun>-remove` (a request) and `dismiss()` + `<noun>-dismiss`
(the component removes itself).

### 2.6 The base class and the tools

| finding | fix |
|---|---|
| `emit()` sends `null` when given no detail; 4 emits do, 23 pass `{}` by hand | `emit()` sends `{}`; the 23 go |
| `renderList()` is `renderItems()` with a callback — 10 lines copied | fold it in (3 callers) |
| three ways to clone: `clone()` imports and upgrades, `renderList` / `renderItems` and 4 hand-written sites use `cloneNode`, which does neither | every clone through `clone()` — timing changes, test it |
| **the spec generator reads members with regular expressions**: it lists `populate` and `elements` on the provider and `show` / `hide` on the button, which neither has — so the MCP's `component_api` advertises them | read the TypeScript with its own parser (a dev dependency already) |
| **32 of 67 method descriptions stop mid-sentence** — only a comment's first line is kept | keep the whole summary sentence |
| **a spec's `$description` is never refreshed** — the provider's still says "region", renamed to "subtree" | re-derive it; `spec:check` cannot see the drift today, because it regenerates from the old spec |

---

## 3. Looks the same, and is NOT — keep

- `menu-change` and `quick-filter-change` are two LAYERS: a control's value,
  and a field's report.
- `menu-cancel` and `filter-discard`: Cancel restores the menu's own
  baseline; Discard drops a draft the SOURCE holds.
- `dismiss()` removes the element; `hide()` keeps it. Collapse is not close:
  a collapsed overlay panel is still open.
- `toggleMenu()` is not `toggle()`: on a chip, "toggle" means the filter on or
  off.
- `drawScopes()` is not `drawScope()` many times: it takes descriptions with
  labels and Add lists.
- The grid's three-state sort is deliberate (`T-one-cycle-for-one-value`).
- `data-open` on a trigger (button, chip, bell) means "my menu is open" and is
  a state pin; on the panel it means "I am open".
- The app header's eight click events come from one table and one loop —
  hosts route by event name (`PROVIDER-DESIGN.md` §8, decision 2). Keep them;
  only `notifications-open` is misnamed (it is a request).
- `page-change`, `menu.items()` and the transfer list's selection model stay.
- The DataSource's `selection-change` and the grid's share a name but fire on
  different targets.

---

## 4. Bugs found on the way

| bug | status |
|---|---|
| The Assistant panel shows no heading: `index.html` sets `data-title`, the overlay panel reads `data-heading` | **confirmed in the browser** — TODO 100 |
| The overlay panel lacks the dialog's late-close guard | read only — fixed by §2.3 |
| `aria-expanded` stays `true` after Escape or an outside click (select-checkbox, the grid's actions menu) | read only — fixed by §2.3 |
| The panel's per-field Clear clears ticks only, not condition rows or typed text | read only — fixed by §2.1 |
| A nested accordion re-emits a spurious `toggle` | reasoned, not run — fixed by §2.3 |
| Settings' `<form novalidate>` never blocks a bad email | read only — fixed by §2.2 |
| Stale: `qft.html`'s `Fires:` detail, the legend's header comment, a parity-sweep entry naming a now-private `setChipActive()` | fix in passing |
| Notification rows staying current after each click | **not reproduced** — dropped |

---

## 5. Building it — one commit each, safest first

**Will's rule, 2026-09-29:** *"UI components need to function in isolation
(they are web components) as extensions of only sherpa-element. So we need to
be careful with our consolidation. There may be duplication but as long as
naming is consistent for consumers of sherpa then we don't always have to
consolidate."*

- **A component extends `SherpaElement` and nothing else.** No family base
  class: shared code is a helper it IMPORTS (`chart-parts.ts`,
  `disclosure.ts`) or a sheet it ADOPTS, and it still works on its own.
- **Consistent NAMES first.** The public surface — methods, properties,
  events and their details — is what a consumer sees, and it must read one
  way. Code shared behind it is optional: keep a copy where sharing would
  couple two components.

| step | builds | lines out |
|---|---|---:|
| A1 ✅ | the tools: the spec generator reads TypeScript, keeps whole summaries, refreshes `$description` — 47 specs corrected (`T-a-spec-reads-the-class-by-its-parser`) | — (specs become true) |
| A2 ✅ | the base: `emit()` sends `{}` (26 empty details gone); `renderList` folds into `renderItems`, whose clone is imported as `clone()`'s is; the four `pathFind` copies go. The 20 hand-written clone sites move with their family (A3, A7) | 58 |
| A3a ✅ | charts: the three hide doors and the repeated legend event are deleted | 85 |
| A3b ✅ | charts: `static css` as a list; `sherpa-chart-axes.css` (16 rules the bar and line charts copied) and `sherpa-chart-segments.css` (the 4 frame rules the gauge copied). A spec lists only its OWN sheet's bindings | 56 |
| A3c ✅ | charts: `src/core/ui/chart-parts.ts` — ONE value axis (bar and line), `paintSeries`, `pairAnchor`, `fillTip`, used by five charts and the legend. The lines moved rather than fell: one place for each rule | +4 |
| A3d ✅ | charts: the line chart draws its series and gridlines from `<svg>` templates (no `createElementNS`); ONE status list (`STATUSES`, `statusVar`, `statusBorderVar`); every meter — gauge, progress bar, metric — takes `populate(number \| { value })` and a number `value`. Grows: the metric gains its `value` door | +39 |
| A4a ✅ | open and close: `DialogSurface` in `disclosure.ts`, IMPORTED by the dialog and the overlay panel — the overlay gains the late-close guard it lacked. `close` becomes `dialog-close` and `panel-close` | +30 |
| A4b ✅ | open and close: the NAMES — `accordion-open` / `-close` and `notifications-open` / `-close`; `notifications-click`, `menu-click` and `view-menu-click` for a request; the filter panel's `show()`, `hide(reason)` (with `close()` kept) and the `open` attribute and property, which the app shell and the provider now read. The trigger mirror stays copied | +20 |
| A5a ✅ | form controls: the same NAMES on all four, each in its own code — `value`, `checked`, `disabled`, `focus(options)`, `checkValidity()`, `reportValidity()`. The switch gains `value` (and sends it in `change`); a test holds the four to one surface | +60 |
| A5b ✅ | form controls: all four take part in a `<form>` through `FormValue` (`src/core/ui/form-value.ts`), which each IMPORTS; a radio submits under its shared `name` and REQUIRED is its group's (Will: A); a select group gives its `name` to its radios; the text field tells its form after every write. Bug 61 closed on a plain `<form>`. Grows: form support is new | +163 |
| A6 ✅ | items: "picked one" is `<noun>-select` (`tab-select`, `step-select`, `row-select`, `notification-select`, `item-select`) and a tick is `selection-change` (Will's ruling 2); the tabs' `select()` is silent; the grid's current row is `data-current`; `currentId` on the nav as on the tabs; `selected` on the grid as on the transfer list; `getSelectedValues()` goes; chip and tag already send `{}` (A2). Left: the grid's `selection-change` still sends row POSITIONS as `selected` — without a `key` it has no keys to send | +22 |
| A7 | filters: `menu.reading`, one event per act, the grid's headings on `menuFor()`, the 18 members go — with TODO 38 step 4 and 89, so the panel is rebuilt once | ~700 |

**About 1,300 copied lines out.** The net
saving is not measured: each step states its budget and reports the actual,
and the size gate holds it (`npm run check:size`).

---

## 6. Decided — Will, 2026-09-29

| # | question | ruling |
|---|---|---|
| 1 | Chip and Tag | **Two components, two purposes — always.** Never merged. Only their events align: `chip-remove` and `tag-remove` both send `{}`. |
| 2 | "select" | **A** — `<noun>-select` always means "picked one"; a tick is `selection-change`. |
| 3 | the meters' `value` | **A** — every meter takes a NUMBER through `populate()` and `value`. |
| 4 | sort and group in the panel | **A** — the source keeps the scope. Will: *"This probably relates to other reworks around the single query, filtersets, and filter scopes."* So it is built with 99 (the filterset) and 38's scope rename, not alone. |
| 5 | shared chart CSS | **Two sheets**: one for 2D charts with AXES (bar, line), one for SEGMENTED visuals (donut, pie, gauge, radar). A component's `static css` becomes a list, so a chart adopts its own sheet and its family's. |

Unless Will says otherwise: `calendar-apply` and `calendar-cancel` (no
listeners) are deleted, and the filter event keeps the name
`quick-filter-change` (renaming it touches 23 source and 48 test sites).
