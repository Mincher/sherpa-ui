# ADR-012: Status via CSS Cascade, Not Per-Component Blocks

**Status:** Accepted  
**Date:** 2026-06-05  
**Deciders:** Design System Team  
**Linked Requirements:** REQ-23, ADR-009

## Context

Many components need to reflect a status: `success`, `info`, `warning`, `critical`. A naïve implementation puts per-status CSS in every component:

```css
/* In sherpa-callout.css */
:host([data-status="success"]) { background: var(--sherpa-surface-success); }
:host([data-status="warning"]) { background: var(--sherpa-surface-warning); }
/* ... repeated in sherpa-tag.css, sherpa-metric.css, sherpa-badge.css ... */
```

This creates three concrete problems:

1. **Duplication:** Every component that supports status repeats the same color-mapping logic. If the success colour changes, every component's CSS must be updated.
2. **Inconsistency:** Different components' status colours drift over time because the mapping isn't shared.
3. **Theming complexity:** Adding a new status value (e.g. `urgent`) requires touching every component.

## Decision

Status is handled by a single cascade layer that maps `[data-status]` attribute values to private CSS custom properties (`--_status-*`). Components only reference the private properties — they never inspect `data-status` themselves.

### How it works

**`css/styles/sherpa-overrides.css`** (inside `@layer overrides`) defines the mapping:

```css
[data-status="success"] {
  --_status-surface:    var(--sherpa-surface-success);
  --_status-text:       var(--sherpa-text-on-success);
  --_status-icon:       var(--sherpa-icon-success);
  --_status-border:     var(--sherpa-border-success);
}
[data-status="warning"] { ... }
[data-status="critical"] { ... }
[data-status="info"]    { ... }
```

**Component CSS** consumes the private properties:

```css
/* In sherpa-callout.css */
:host {
  background: var(--_status-surface, var(--sherpa-surface-default));
  color:       var(--_status-text,    var(--sherpa-text-body));
  border-color: var(--_status-border, var(--sherpa-border-default));
}
```

The `[data-status]` attribute cascades to descendant components, so a parent element with `data-status="critical"` will colour all child components that consume `--_status-*` without each child needing its own `[data-status]` selector.

### Naming convention

- `--_status-*` (double-underscore-prefixed): private implementation variables, set by the overrides layer, consumed by component CSS. Not part of the public token API.
- `--sherpa-*`: public semantic tokens, defined in theme files, used as fallbacks inside `--_status-*` declarations.

## Consequences

### Positive

- ✅ **Single source of truth:** Status-to-colour mapping lives in one place (`sherpa-overrides.css`)
- ✅ **Inheritable:** Setting `data-status` on a container colours all descendant components automatically
- ✅ **Easy to extend:** Adding a new status value only requires updating `sherpa-overrides.css`
- ✅ **Consistent across components:** All components reference the same `--_status-*` variables
- ✅ **Theming-friendly:** Themes override `--sherpa-surface-success` etc.; no per-component overrides needed

### Negative

- ❌ **Implicit coupling:** A component's status appearance depends on an ancestor having `[data-status]` set. This is less visible than explicit per-component status selectors.
- ❌ **Private variable discipline required:** Component authors must use `--_status-*` variables and provide semantic token fallbacks — the pattern isn't enforced by the type system.

### Neutral

- ⚪ **No component API change:** `data-status` is still set on the component element itself; the cascade handles the rest transparently.

## Alternatives Considered

### Alternative 1: Per-Component Status CSS Blocks

Each component defines its own `[data-status="*"]` selectors with explicit colour values.

**Pros:** Self-contained; no dependency on cascade layer.  
**Cons:** Massive duplication; inconsistency accumulates over time; adding a status value requires touching every component.  
**Rejected because:** Already the status quo that created the inconsistency problem.

### Alternative 2: JS-Driven Status (Property Setter)

A `status` property setter on each component that applies CSS classes.

**Pros:** Explicit; no cascade magic.  
**Cons:** Violates ADR-003 (CSS owns visibility/presentation) and adds JS for a purely presentational concern.  
**Rejected because:** CSS is the right tool for presentation; JS should not be driving visual state.

### Alternative 3: CSS Custom Property Directly on Host

Set `--_status-surface` etc. directly on the host element from JS.

**Pros:** No cascade dependency.  
**Cons:** Requires JS; violates CSS-only presentation principle.  
**Rejected because:** Same as Alternative 2.

## Implementation Notes

- Status private variables are defined in `css/styles/sherpa-overrides.css` inside `@layer overrides` (see ADR-009)
- Components must always provide a semantic token fallback: `var(--_status-surface, var(--sherpa-surface-default))`
- Linting (`npm run lint:css`) will warn on direct `[data-status="*"]` selectors inside `components/`
- Valid status values: `success`, `info`, `warning`, `critical`

## References

- `css/styles/sherpa-overrides.css` — Status variable mappings
- [ADR-003: CSS Owns Visibility via `:host([data-*])`](0003-css-owns-visibility.md)
- [ADR-005: Semantic Tokens Only in Component CSS](0005-semantic-tokens-only.md)
- [ADR-009: Consolidate Override Layers](0009-consolidate-override-layers.md)
