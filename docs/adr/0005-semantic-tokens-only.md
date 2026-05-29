# ADR-005: Semantic Tokens Only in Component CSS

**Status:** Accepted  
**Date:** 2024 (initial architecture)  
**Deciders:** Design System Team  
**Linked Requirements:** REQ-07, REQ-08

## Context

The design token system has two layers:
- **Core tokens** (`--core-*`): Raw color values, spacing primitives, font families
- **Semantic tokens** (`--sherpa-*`): Meaningful names tied to purpose (e.g., `--sherpa-surface-primary`, `--sherpa-text-body`)

If components consume core tokens directly, they become:
- Tightly coupled to specific color palettes
- Difficult to rebrand or theme
- Inconsistent across different product contexts

## Decision

Component CSS **SHALL** consume only semantic tokens (`--sherpa-*`). Core tokens (`--core-*`) are reserved for the alias/theme layers.

### Token Hierarchy

```
┌─────────────────────────────┐
│ Core Tokens (--core-*)      │  ← Raw values: #0066CC, 16px, Inter
├─────────────────────────────┤
│ Alias Tokens (--sherpa-*)   │  ← Semantic: --sherpa-color-primary
├─────────────────────────────┤
│ Component CSS                │  ← Consumes --sherpa-* only
└─────────────────────────────┘
```

## Rationale

- **Theming:** Switching themes only requires updating alias layer
- **Rebranding:** Change core tokens without touching components
- **Consistency:** Semantic names ensure visual coherence
- **Portability:** Components work with any theme that provides semantic tokens

## Consequences

### Positive

- ✅ **Theme-portable:** Components work with any theme
- ✅ **Rebranding-friendly:** Update core tokens, components adapt automatically
- ✅ **Semantic clarity:** Token names express intent (e.g., `--sherpa-surface-control-hover`)
- ✅ **Consistent:** All components use same semantic vocabulary

### Negative

- ❌ **Alias layer overhead:** Requires semantic token for every visual concept
- ❌ **Indirection:** More layers between component and final value

## Implementation Notes

### Component CSS Pattern

```css
/* ✅ Correct: Semantic tokens */
:host {
  background: var(--sherpa-surface-default);
  color: var(--sherpa-content-default);
  border: 1px solid var(--sherpa-border-subtle);
}

/* ❌ Wrong: Core tokens */
:host {
  background: var(--core-gray-50);
  color: var(--core-blue-700);
  border: 1px solid var(--core-gray-300);
}
```

### Private Tokens for Component-Specific Overrides

Components can define private tokens (`--_*`) for internal cascades:

```css
:host {
  --_status-color: var(--sherpa-content-default);
}

:host([data-status="error"]) {
  --_status-color: var(--sherpa-content-critical);
}

.status-icon {
  color: var(--_status-color);
}
```

### Token Fallback Chains

Components should provide fallbacks for robustness:

```css
:host {
  font-size: var(--sherpa-text-body-size, 14px);
  color: var(--sherpa-content-default, #1a1a1a);
}
```

## Token Generation

Semantic tokens are generated from Figma Variables via:
```bash
npm run tokens:extract  # Fetch from Figma API
npm run tokens:generate # Generate CSS
```

Output: `css/styles/sherpa-themes.css`

## Exceptions

**Shared utility classes** (in `css/styles/sherpa-utility-classes.css`) may use core tokens since they're part of the theming layer, not components.

## References

- [Design Token Specification](https://design-tokens.github.io/community-group/format/)
- `scripts/generate-css-tokens.js` — Token generation script
- `css/styles/tokens/` — Generated token files
