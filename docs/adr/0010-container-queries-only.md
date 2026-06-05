# ADR-010: Container Queries Only in Component CSS

**Status:** Accepted  
**Date:** 2026-06-05  
**Deciders:** Design System Team  
**Linked Requirements:** REQ-24, NFR-responsive

## Context

Components are consumed in many different layout contexts — full-width pages, side panels, dialogs, grid cells. Using viewport `@media` queries inside component CSS ties a component's responsive behaviour to the page dimensions it happens to occupy today, not to the space it is actually given.

This causes two concrete problems:

1. **Context blindness:** A card component that switches to a stacked layout at `max-width: 600px` will stack even when it's placed in a wide side-panel where it only occupies 280px, and will stay wide even when it's the only thing on a mobile screen.
2. **Encapsulation leakage:** Shadow DOM encapsulates DOM and styles, but viewport media queries bypass this — a component inside a shadow root reacts to the same viewport breakpoints as the host document. This makes it impossible to reason about layout from the component boundary alone.

Container queries (`@container`) solve both problems: a component responds to the width of its own containing box, regardless of where it is placed in the page.

## Decision

No viewport `@media` queries inside component CSS files. All responsive behaviour must use `@container` queries.

The containing context is established outside the component (by the layout or slot host), which is correct: the consumer controls how much space a component gets; the component controls what it does with that space.

Permitted uses of `@media` inside component CSS are limited to:
- `@media (prefers-reduced-motion: reduce)` — user preference, not layout
- `@media (forced-colors: active)` — Windows High Contrast mode
- `@media print` — print stylesheet

These are capability or preference queries, not dimension queries.

## Consequences

### Positive

- ✅ **True encapsulation:** Component layout responds to its own container, not the viewport
- ✅ **Composable:** The same component works correctly in a dialog, a sidebar, a full-width page, and a grid cell without conditional logic
- ✅ **Predictable:** Developers can reason about layout at the component boundary
- ✅ **Future-proof:** Container queries are baseline supported in all evergreen browsers (Chrome 105+, Firefox 110+, Safari 16+)

### Negative

- ❌ **Containment required:** The containing element must have `container-type` set. This is the layout consumer's responsibility, not the component's — but it's an additional thing for page authors to know.
- ❌ **No named containers without cooperation:** If a component needs to respond to a named ancestor container (e.g. a panel width set by an outer shell), that container must be named by the shell. This requires coordination between component and layout.

### Neutral

- ⚪ **Existing viewport media queries in non-component CSS are unaffected:** App-level layout CSS (`layouts/`, global stylesheets) may use `@media` freely — the restriction is component-scoped.

## Alternatives Considered

### Alternative 1: Allow Both @media and @container

**Pros:** Less migration effort for existing components; familiar syntax.  
**Cons:** Inconsistent behaviour across placement contexts; hard to reason about which breakpoint fires when.  
**Rejected because:** The whole point of component encapsulation is that the component doesn't know about the viewport. Mixing both mechanisms undercuts that.

### Alternative 2: Viewport @media Only, No Container Queries

**Pros:** Simpler mental model for developers who know media queries well.  
**Cons:** Context-blind layout; components misbehave in panels, dialogs, and grid cells.  
**Rejected because:** This is the status quo that motivated the decision — it demonstrably produces wrong layouts in multi-panel UIs.

## Implementation Notes

- Establish `container-type: inline-size` on layout containers in the pattern library (app-shell panels, dialog body, grid cells).
- Query via `@container (max-width: Npx)` inside component CSS — no named containers needed for the common case.
- The linter (`npm run lint:css`) flags bare `@media` width/height dimension queries inside `components/`.

## References

- [CSS Containment Module Level 3 — Container Queries](https://www.w3.org/TR/css-contain-3/)
- [ADR-001: Web Components + Shadow DOM, No Framework](0001-web-components-shadow-dom.md)
- `docs/CSS-FILE-TEMPLATE.md` — § Container queries
