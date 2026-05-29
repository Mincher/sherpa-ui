# ADR-007: Custom Events Bubble; Cross Shadow Only When Needed

**Status:** Accepted  
**Date:** 2024 (initial architecture)  
**Deciders:** Design System Team  
**Linked Requirements:** REQ-09

## Context

Web Components use Shadow DOM for style encapsulation, but this creates an event propagation boundary. Custom events dispatched inside a shadow tree don't automatically cross to the host's parent.

Event propagation options:
- **`bubbles: false`** — Event stops at target element (no propagation)
- **`bubbles: true`** — Event bubbles up the shadow tree but stops at shadow root
- **`bubbles: true, composed: true`** — Event crosses shadow boundaries

Without a consistent policy, event handling becomes unpredictable.

## Decision

All custom events **SHALL** set `bubbles: true`. Events that must reach application code outside the host's shadow tree **SHALL** also set `composed: true`.

### Event Categories

**All events (`bubbles: true`):**
- Internal component coordination
- Parent component communication
- Application-level handlers

**Application events (`bubbles: true, composed: true`):**
- Form submission events (`submit`, `change`, `input`)
- User interaction events (`click`, `select`, `delete`)
- State change notifications (`filter-change`, `tab-change`)
- Data events (`load`, `error`, `update`)

## Rationale

- **Predictable propagation:** All events bubble, some cross shadow boundaries
- **Event delegation:** Parent elements can listen for child events
- **Framework compatibility:** Composed events work with React/Vue event systems
- **Accessibility:** Events reach application-level analytics and monitoring

## Consequences

### Positive

- ✅ **Predictable:** Consistent bubbling behavior across all components
- ✅ **Composable:** Parent components can listen for child events
- ✅ **Framework-friendly:** Works with React's synthetic events
- ✅ **Debuggable:** Event path is traceable in DevTools

### Negative

- ❌ **Event noise:** All events bubble, even if not needed
- ❌ **Stopping propagation:** Consumers must explicitly stop if needed

## Implementation Notes

### Standard Event Pattern

```javascript
/**
 * @fires item-select — User selected an item
 *   bubbles: true, composed: true
 *   detail: { item: Element, value: string }
 */

this.dispatchEvent(new CustomEvent('item-select', {
  bubbles: true,
  composed: true,
  detail: { item, value: item.dataset.value }
}));
```

### When to Use `composed: true`

**Use `composed: true` when:**
- ✅ Application code needs to handle the event
- ✅ Event represents user action (click, select, submit)
- ✅ Event signals state change relevant to parent app
- ✅ Event might be used by analytics or monitoring

**Skip `composed: false` when:**
- ❌ Event is internal component coordination only
- ❌ Event is implementation detail
- ❌ Event is for shadow DOM communication only

**Example (internal coordination):**
```javascript
// ❌ Should NOT cross shadow boundary
this.dispatchEvent(new CustomEvent('internal-reflow', {
  bubbles: true,
  composed: false  // Internal only
}));
```

### Event Detail Structure

Always include relevant data in `detail`:

```javascript
// ✅ Good: Structured detail
this.dispatchEvent(new CustomEvent('filter-change', {
  bubbles: true,
  composed: true,
  detail: {
    filters: this.activeFilters,
    previousFilters: this.prevFilters,
    changed: diffFilters(this.prevFilters, this.activeFilters)
  }
}));

// ❌ Bad: No detail
this.dispatchEvent(new CustomEvent('filter-change', {
  bubbles: true,
  composed: true
}));
```

### Event Naming Conventions

- Use kebab-case: `item-select`, not `itemSelect` or `item_select`
- Be specific: `row-delete` not `delete`
- Include noun: `tab-change` not `change`
- Past tense for completed actions: `item-selected` vs `item-select` (both acceptable)

### JSDoc Documentation

```javascript
/**
 * @fires event-name — Description
 *   bubbles: true, composed: true
 *   detail: { propName: type, ... }
 */
```

## React Integration Note

React 17+ automatically handles composed events. For React 16 and earlier, composed events may require manual attachment:

```javascript
// React 16 workaround (not needed in React 17+)
componentDidMount() {
  this.elementRef.current.addEventListener('custom-event', this.handleEvent);
}
```

## References

- [DOM Events Specification](https://dom.spec.whatwg.org/#interface-event)
- [Shadow DOM and Events](https://javascript.info/shadow-dom-events)
- [COMPONENT-API-STANDARD.md](../COMPONENT-API-STANDARD.md) — Event documentation format
