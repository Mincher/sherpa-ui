# ADR-004: `data-*` Attribute Prefix Mandatory

**Status:** Accepted  
**Date:** 2024 (initial architecture)  
**Deciders:** Design System Team  
**Linked Requirements:** REQ-06

## Context

HTML5 is a living standard that continues to add new global attributes. Using bare custom attributes (like `variant`, `size`, `status`) creates several risks:
- **Collision with future HTML attributes:** What if HTML adds a native `variant` attribute?
- **CSS selector issues:** Bare attributes require escaping in some contexts
- **Semantic confusion:** Hard to distinguish component attributes from native ones

## Decision

All public component attributes **SHALL** use the `data-` prefix, except attributes with native HTML semantics.

### Categories

**Requires `data-` prefix:**
- Visual variants: `data-variant`, `data-size`, `data-status`
- Component behavior: `data-dismissible`, `data-active`, `data-selected`
- Content configuration: `data-label`, `data-description`, `data-helper`
- Icons and badges: `data-icon-start`, `data-count`, `data-badge`

**Bare (no prefix):**
- Native semantics: `disabled`, `readonly`, `required`, `hidden`
- ARIA attributes: `role`, `aria-label`, `aria-expanded`
- Global attributes: `id`, `class`, `slot`, `style`

## Rationale

- **Future-proof:** Won't collide with future HTML specs
- **Consistent:** Clear naming convention
- **Accessible via `dataset`:** JavaScript can use `element.dataset.variant`
- **Standard compliance:** Follows HTML5 `data-*` specification

## Consequences

### Positive

- ✅ **Future-safe:** Protected from future HTML attribute additions
- ✅ **Consistent selectors:** Standard attribute selector syntax works
- ✅ **Clear intent:** Distinguishes component attributes from native
- ✅ **Standard-compliant:** Uses HTML5 `data-*` specification

### Negative

- ❌ **Slightly verbose:** `data-variant="primary"` vs `variant="primary"`
- ❌ **Migration cost:** Changing existing bare attributes breaks consumers

## Implementation Notes

### JavaScript Access

```javascript
// ✅ Preferred: dataset API
const variant = this.dataset.variant;
this.dataset.variant = 'secondary';

// ⚠️ Allowed but verbose
const variant = this.getAttribute('data-variant');
this.setAttribute('data-variant', 'secondary');
```

### CSS Selectors

```css
/* ✅ Standard attribute selector */
:host([data-variant="primary"]) {
  background: var(--sherpa-surface-primary);
}

/* ✅ Attribute presence check */
:host([data-active]) {
  box-shadow: var(--sherpa-elevation-raised);
}
```

### TypeScript Type Safety

The `data-*` prefix allows TypeScript to infer types via `dataset`:

```typescript
interface SherpaButtonDataset {
  variant?: 'primary' | 'secondary' | 'tertiary';
  size?: '2x-small' | 'x-small' | 'small' | 'base' | 'large';
  active?: string; // boolean attribute
}
```

## Exceptions

**Native HTML Semantics (No Prefix):**
- Form-related: `disabled`, `readonly`, `required`, `name`, `value`
- Visibility: `hidden`, `open`
- Interactive: `tabindex`, `contenteditable`
- Global: `id`, `class`, `title`, `lang`, `dir`

**Rationale for exceptions:** These have well-defined browser behavior and won't change.

## References

- [HTML Standard: data-* attributes](https://html.spec.whatwg.org/multipage/dom.html#embedding-custom-non-visible-data-with-the-data-*-attributes)
- [COMPONENT-API-STANDARD.md](../COMPONENT-API-STANDARD.md) — Attribute naming rules
