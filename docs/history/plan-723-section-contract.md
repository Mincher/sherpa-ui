# Plan 723 — one SECTION contract (Will chose A, 2026-11-04)

Serves TODO 721 (panel toggle everywhere, chart Organise chips, a Filters button
per accordion) and 722 (hover fill). Read-only study first; no code yet.

## What is true today

- A field section is a chip with `data-layout="section"`. Its hover fill is one
  rule: `.chips > .chip[data-layout="section"]:hover` (toolbar css:640).
- Organise is NOT a chip run in `.chips`. It is `.organise-zone`, headed by a
  `::before` of `data-section`. Its chips are arrangements, not conditions.
- Presets are flat chips in `.chips`. `#markSections` heads the first one
  "Presets"; the rest follow. No wrapper, no `data-layout`.
- A chart's section is the PART scope (`picks:<id>`). Its Organise chips live on
  the card scope (`by-status`). The part scope knows no arrangement.
- The panel has ONE Filters button, in the column header
  (`.column-filters`, toolbar html:252).

## The contract

A **section** is a header and items. An item is one of three kinds:

| kind | items | answers |
|---|---|---|
| field | a field's values | a condition |
| preset | boolean chips | stacked conditions (`T-a-preset-is-its-own-part`) |
| arrangement | Group, Sort, Primary, Secondary | the Presentation |

One section element draws all three: heading, hover fill, label column, search
match, drag handle. The kind decides only its items.

## Steps, each one commit

1. **Section wrapper.** `#markSections` groups a run of chips into a section
   element; the hover fill moves to it. Fixes 722 for presets and Organise.
2. **Organise is a section** in `.chips` order, not a zone. Remove
   `.organise-zone`'s own label CSS (cleanup: delete what it replaces).
3. **The part scope carries its Presentation**: `describe(part)` adds
   `group/sort/chartFields` from the card; a change routes to the card scope.
   Will's ruling: the card is only a container (type, title).
4. **Filters button per accordion**, in its header; none when it holds one
   field section. The column header keeps Suggest, Save, Saved, ⋮, search.
5. **Panel toggle in every bar**: match a bar to its panel scope by
   `scopeOf(bar)`, and show the toggle with `data-no-actions` on.
   "Include View Context in the panel" still decides the View only.

## Gates and tests

Per step: type-check, lint, `lint:css`, `spec:check`, `check:map`, then the one
Demos spec `reforged-filter-column`. Full suites only at the end.
Step 5 is the one most likely to move other lanes' files: ask first.
