# ADR-003: CSS Owns Visibility via `:host([data-*])`

**Status:** Accepted  
**Date:** 2024 (initial architecture)  
**Deciders:** Design System Team  
**Linked Requirements:** REQ-04, REQ-05

## Context

Toggling visibility via JavaScript (`.hidden = true`, `.style.display = 'none'`) scatters visibility logic across the codebase and creates several problems:
- Visibility rules are split between CSS and JS
- FOUC (flash of unstyled content) when JS toggles before CSS loads
- Difficult to review what elements are conditionally shown
- Forces reading both `.css` and `.js` to understand visual behavior

## Decision

Visibility of internal shadow elements **SHALL** be driven by `:host([data-*])` selectors in CSS. JavaScript only sets/removes data attributes on the host element.

### Pattern

**CSS declares visibility rules:**
```css
.close-button {
  display: none;
}

:host([data-dismissible]) .close-button {
  display: inline-flex;
}
```

**JavaScript controls via attributes:**
```javascript
// ✅ Correct
this.toggleAttribute('data-dismissible', shouldBeDismissible);

// ❌ Wrong
this.$('.close-button').hidden = !shouldBeDismissible;
```

## Rationale

- **Single source of truth:** All visibility rules in one place (CSS)
- **Declarative:** Visual contract is readable in CSS
- **No flicker:** CSS-driven visibility is instant
- **Reviewable:** PR reviewer can see all conditional elements in CSS

## Consequences

### Positive

- ✅ **Declarative:** Visibility rules are explicit in CSS
- ✅ **No FOUC:** CSS applies before JavaScript runs
- ✅ **Easier review:** All visibility logic in one file
- ✅ **Performance:** No style recalculation from JS manipulation

### Negative

- ❌ **Template completeness required:** Every conditional element must exist in template from the start
- ❌ **Extra elements in DOM:** Hidden elements remain in DOM (vs creating/destroying)

## Implementation Notes

### Template Completeness Rule

Every element the component might show must be declared in the HTML template:

```html
<template id="default">
  <button class="close-button">×</button>
  <span class="badge"></span>
  <div class="error-message"></div>
</template>
```

### CSS Visibility Patterns

**Attribute presence:**
```css
:host([data-badge]) .badge { display: inline-block; }
```

**Attribute value:**
```css
:host([data-status="error"]) .error-message { display: block; }
```

**Combined conditions:**
```css
:host([data-dismissible][data-variant="primary"]) .close-button {
  display: inline-flex;
}
```

### Exception: `:host` itself

The native `hidden` attribute is acceptable **only** on `:host` itself:
```css
:host([hidden]) { display: none; }
```

## References

- [CSS-FILE-TEMPLATE.md](../CSS-FILE-TEMPLATE.md) — Section on visibility toggles
- [COMPONENT-TEMPLATE.md](../COMPONENT-TEMPLATE.md) — Template completeness rule
