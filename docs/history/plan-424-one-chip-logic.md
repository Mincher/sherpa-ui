# TODO 424 (and 415) — one filter chip logic: the plan of 2026-10-22

Will, 2026-10-22: *"I really hope we don't have 2 bespoke implementations of
filter chips across the filter toolbar and filter panel with custom logic in
each. All filter chips should be variants of the filter chip component and all
logic centralised."* Then: *"2 go"*.

## What is true today

Every chip on both surfaces IS `sherpa-quick-filter`: the bar's field chip; the
panel's value, answer and tier-parent chips; both Organise chips. What is
written twice is the per-FIELD logic around the chips:

| Responsibility | Bar | Panel | Same? |
|---|---|---|---|
| A told reading | `drawReading`, `#drawChip`, `#paintReading` | `drawReading`, `#paint` | differs: the panel draws a suspended reading as empty, and has no open-draft guard |
| Pending | `#syncPending` marks the chip and its menu | marks the field box and the ONE answer chip | **differs — bug 424** |
| Failed | `#syncPending` | `#syncPending`, every chip | same intent, a different chip set from pending |
| Greying | `drawPresent`, `drawOffered`, `#markPresent` | the same, plus run chips and child menus | the menu half is the same code twice |
| Results | `drawResults` → `chip.results` | one chip, or `#headResults`; `#scopeResults` | the panel repeats the chip's badge text |
| None (403) | the chip's `reading` getter | `held.none`, `#fetches` | one rule, twice |
| Tiered | one chip, a tree menu | `#paintTiers`, `#flipParent`, `#takeKids` | two models |
| One field's Discard | `#onMenuDiscard` | `#onMenuDiscard`, `.field-discard` | panel menus never get `data-pending`: their Discard is always off |
| Waits | `menuFor({ waits, fetches })` | `#waits` by scope name | differs |
| A field's request | `#answers`, `#answerRequest` | `#readingOf`, `#report` | one shape, twice |
| Reset of one field | `#emptyChip` → `chip.clear(op)` | `#clearField`, `#empty` | differs: the panel keeps op, typing and mode |
| On after a commit | bar 1969–1977 | `#onAddCommit` | differs: the panel drops a typed answer and none |
| A report a frame on | `#onConditionChanged` | `#reportSoon` | same pattern twice |
| An answer into a new menu | `#keepAnswer` | `#fill`, `#settleAnswers` | same pattern twice |

## The target

- **Into the chip:** a `drafting` getter; `clear()` covers Group and Sort; ONE
  "on after a commit" rule; `reading=` holds an answer until its menu draws; a
  value chip is a variant (`data-value` with its field's `data-id`).
- **One shared module, `src/core/ui/filter-field.ts`:** `FilterField`, a helper
  class (as `MenuDrill`, `SavedSets`), one per drawn field, layout `chip`, `run`
  or `tiers`: `draw(reading)`, `reading`, `mark(pending, failed)`,
  `limit(present, offered)`, `results`, `valueResults`, `press`, `clear(op)`,
  `answered`. Both hosts keep a Map of them.
- **`filter-host.ts`:** one `waits`/`fetches` rule, `drawCount`, a frame batcher.
- **Stays in each host:** the bar's fold, Organise zone, View chip, Switch,
  supersede, Filters list; the panel's scopes, sections, headers and ⋮, inline
  bodies, search, scope badges and Apply.

## The order, one commit each

1. 424's fix through `markField` (pending and failed, every chip and menu).
2. The chip's `drafting`; the panel hears drafts as the bar does.
3. A shared `limit`.
4. `drawCount` and results.
5. `chip.clear()` covers Group and Sort.
6. One "on after a commit" rule — high risk.
7. `FilterField` run and tiers in the panel — highest risk.
8. `FilterField` chip layout in the bar — high.
9. The shared frame batcher and answer holder — high (timing, three engines).
10. The panel stops assuming only the View waits — needs Will.
11. Delete what is dead, after a probe.
