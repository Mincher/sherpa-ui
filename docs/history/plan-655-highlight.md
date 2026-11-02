# Plan 655 — a hover's highlight is a broadcast, not the data layer's

Will, 2026-11-02: *"Highlighting should also just be a response to a broadcast 'on hover'
event from another UI component. I don't think there's any need to route through the
data layer for UI highlighting of matches."* And: *"the UI component should always use
its own calculations when handling highlighting."*

Part of [plan 652](plan-652-service-worker.md): the worker must see no presentation.

---

## Today

The highlight exists only while something is hovered (TODO 589 removed the kept one).

1. A chip, a chip's value, or a legend item is hovered. The bar asks `{ field, preview: true, value? }` through `bindSource`'s `ask`; the legend's `legend-hover` goes to the provider, which calls `query.preview()`.
2. `QueryContext` keeps it (`preview()`, `previewed`). It is never saved and never a `query-change`.
3. `compile()` reads it as `facts.highlight` and builds `Compiled.highlight`: the driver field's clause in its scope, from an empty scope when the scope is not made yet (TODO 513), and only where this source has the field (`facts.has`, TODO 458).
4. `DataSource` keeps that filter, publishes when it changes (`#marked`), and decides who it reaches: `highlightFor(scope, el)` and `#reaches` — every scope when `highlightAcross` is on, a View driver always, else the driver's scope, and a chart its own part (`only`, TODO 529).
5. Each binding draws it: a summary through `summariseMarked(…, highlightFor)` in the provider's `as:`, a grid through `el.drawHighlight(highlightFor)` in `bindSource`.

Five data layer pieces know about a hover: `QueryContext`, `compile`, `DataSource`, `bindSource`, and the `highlightAcross` setting on the source.

## After

The PROVIDER holds the hover and draws it. The data layer only compiles a reading into a
row test when asked: a library call, with no state.

| Step | Where | What |
|---|---|---|
| 1 | `bindSource` | A `preview` request is no longer the Query's: it goes to the host's `hover` callback, as `deliver` does. With no host, nothing is lit |
| 2 | provider | `#hovered: { scope, field, value? }`. Set by a bar's preview request and by `legend-hover`; cleared on leave. A whole chip's hover reads its own reading from the Query (State) |
| 3 | data layer | `source.matcher(scope, field, reading)`: one reading as a row test, by `scopeClauses` and `compileFilter`, or null where the source has no such field. From an empty scope where the scope is not made yet. Kept nowhere |
| 4 | provider | Who it reaches, as `#reaches` did: `highlightAcross` (now the provider's alone), a View driver, the driver's scope, a chart's own part |
| 5 | provider | Redraw only what it reaches, and what it reached before: a summary again from the rows it last gave that component (`summariseMarked` with the test); a grid's `drawHighlight(test)`. Nothing loads, nothing is published |

**Deleted in the same change** (plan 652's cleanup rule): `QueryContext.preview`,
`previewed`, `#preview`; `CompileFacts.highlight` and `Compiled.highlight`; `DataSource`
`#highlight`, `#marked`, `highlightFor`, `#reaches`, `highlightAcross`, `#across`;
`bindSource`'s `drawHighlight` call and its `preview` branch of `ask`.

**Kept as they are:** the 150 ms rest, `pointermove` not `pointerover` (TODO 463), a value
or a whole chip (TODO 459), "Highlight matches on hover" and "Highlight across every
scope" as settings, and every component's own `drawHighlight` and `matched` drawing.

## Tests

- `test/unit/a-hovered-chip-previews-the-highlight.test.mjs` tests `compile`'s highlight: it moves to `matcher`.
- `test/e2e/reforged-provider-summary.spec.ts` and Demos `reforged-highlight-matches.spec.ts`: a hover lights the same marks as before, in the same components, and loads nothing.
- Traps `T-a-hovered-chip-previews-the-highlight` and `T-the-highlight-reaches-the-whole-page` move their Sites to the provider and say the new owner.

## Risks

- **Several sources on a page.** Today each source compiles the driver for its own components (TODO 458). The provider asks each source for its own `matcher`, so that stays.
- **A summary needs its last rows.** The provider keeps them per component in a `WeakMap`, so nothing is fetched again.
- **Shared files.** `sherpa-provider.ts` and `sherpa-quick-filter-toolbar.ts` have other work in them; 655 starts after it is committed.
