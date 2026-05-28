# ADR-009: Consolidate Override Layers (Density + Status → Overrides)

**Status:** Accepted  
**Date:** 2026-05-28  
**Deciders:** Design System Team  
**Linked Requirements:** Architectural simplification, reduced cognitive load

## Context

The CSS Cascade Layers architecture originally had separate layers for Density and Status overrides:

```css
@layer reset, primitives, alias, platform, theme, density, status, components, utilities;
```

This created several issues:
- **Cognitive overhead:** Developers needed to understand two separate override layers
- **Arbitrary separation:** Both layers serve the same purpose (attribute-driven token overrides)
- **Implementation complexity:** Token generation script had to handle layers separately
- **Documentation burden:** More layers to explain and maintain

Both layers share the same pattern:
- Applied via data attributes (`data-density`, `data-status`)
- Override base theme tokens
- Cascade to descendant components
- No interdependency between them

The separation was an implementation detail that leaked into the architecture without providing meaningful benefits.

## Decision

Consolidate the `density` and `status` layers into a single `overrides` layer.

### New Architecture

```css
@layer reset, primitives, alias, platform, theme, overrides, components, utilities;
```

The `overrides` layer contains:
1. **Theme corrections** — Hand-maintained fixes for Figma token values
2. **Density overrides** — `[data-density="compact|comfortable"]` spacing adjustments
3. **Status mappings** — `[data-status="..."]` → `--_status-*` private variable mappings

All three serve the same purpose: override base theme tokens based on runtime attributes or context.

## Rationale

### Simplification
- **Fewer layers to understand:** 8 layers instead of 9
- **Clearer mental model:** "Overrides come after theme, before components"
- **Unified purpose:** All attribute-driven overrides in one place

### No Loss of Functionality
- Cascade order preserved (overrides still beat theme, components still beat overrides)
- CSS specificity unchanged (still using `:where()` for minimal specificity)
- Same attribute pattern (`data-*`)
- Performance identical

### Better Alignment
- Matches the existing file structure (`sherpa-overrides.css` already contained both)
- Consistent with how developers think about overrides (not "density vs status" but "attribute overrides")
- Easier to extend (future attribute-driven overrides fit naturally)

## Consequences

### Positive

- ✅ **Simpler architecture:** One fewer layer to explain
- ✅ **Reduced cognitive load:** Developers think "overrides" not "is this density or status?"
- ✅ **Easier documentation:** Fewer cascade layers to document
- ✅ **Clearer intent:** "Overrides" is more semantic than separate "density" and "status"
- ✅ **Future-friendly:** Easy to add new attribute-driven overrides (e.g., `data-motion-reduced`)

### Negative

- ❌ **Migration effort:** Existing documentation references old layer names
- ❌ **Loss of granularity:** Can't insert a layer between density and status (not needed in practice)

### Neutral

- ⚪ **No performance change:** Same number of CSS rules, same cascade
- ⚪ **No breaking change:** Component CSS doesn't reference layer names

## Implementation

### Files Modified

**`css/styles/index.css`:**
```css
/* Before */
@layer reset, primitives, alias, platform, theme, density, status, components, utilities;

/* After */
@layer reset, primitives, alias, platform, theme, overrides, components, utilities;
```

**`css/styles/sherpa-overrides.css`:**
```css
/* Before */
@layer density { /* density rules */ }
@layer status { /* status rules */ }

/* After */
@layer overrides {
  /* theme corrections */
  /* density rules */
  /* status rules */
}
```

### Documentation Updates

- ✅ `css/TOKENS-USAGE-GUIDE.md` — Updated layer diagram
- ✅ `css/styles/index.css` — Updated layer comments
- ✅ `css/styles/sherpa-overrides.css` — Updated file header

### Testing

Verified that:
- Build completes successfully (`npm run build`)
- CSS loads without errors
- Density attributes still work (`data-density="compact|comfortable"`)
- Status attributes still work (`data-status="critical|warning|success|info|urgent"`)
- Theme corrections still apply
- Cascade order preserved (overrides beat theme, components beat overrides)

## Alternatives Considered

### Alternative 1: Keep Separate Layers

**Pros:**
- No migration needed
- Explicit separation of concerns

**Cons:**
- Arbitrary distinction (both are attribute-driven overrides)
- More complexity without meaningful benefit
- Harder to explain to new developers

**Rejected because:** The separation didn't provide value proportional to the complexity cost.

### Alternative 2: Create More Granular Layers

Separate into `corrections`, `density`, `status` (3 layers).

**Pros:**
- Even more granular control
- Clear purpose per layer

**Cons:**
- Even more complexity
- Over-engineering for the use case
- Would need to explain ordering between corrections, density, and status

**Rejected because:** Going in the wrong direction (more complexity, not less).

### Alternative 3: Merge into Theme Layer

Put density and status directly in the theme layer.

**Pros:**
- Fewer total layers

**Cons:**
- Theme layer is already complex (light/dark/HC variants)
- Loses semantic separation (overrides vs base theme)
- Harder to reason about cascade

**Rejected because:** Theme layer has a distinct purpose (color schemes), overrides serve a different role (attribute-driven modifications).

## Migration Guide

### For Component Authors

**No changes required.** Components consume tokens via `var(--sherpa-*)` or `var(--_status-*)`, which work identically.

### For Documentation Maintainers

Update any references to `@layer density` or `@layer status` to `@layer overrides`.

### For Token Generation Script

No changes required. The script already outputs to `sherpa-overrides.css`, which now uses `@layer overrides` internally.

## Future Considerations

### Potential New Overrides

The unified `overrides` layer makes it easy to add future attribute-driven token modifications:

- **Motion preferences:** `[data-motion="reduced"]` for prefers-reduced-motion
- **Contrast preferences:** `[data-contrast="high"]` for accessibility
- **Print styles:** `@media print` overrides
- **Locale-specific:** `[lang="ar"]` for RTL adjustments

All would fit naturally in the overrides layer without needing new cascade layers.

## References

- [CSS Cascade Layers Specification](https://www.w3.org/TR/css-cascade-5/#layering)
- [ADR-005: Semantic Tokens Only in Component CSS](0005-semantic-tokens-only.md)
- `css/styles/index.css` — Layer order declaration
- `css/styles/sherpa-overrides.css` — Implementation
- `css/TOKENS-USAGE-GUIDE.md` — Token system documentation
