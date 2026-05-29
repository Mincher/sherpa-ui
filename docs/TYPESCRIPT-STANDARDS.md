# TypeScript Standards for Sherpa UI

This document establishes TypeScript coding standards for Sherpa UI components.

## Table of Contents

- [Event Handlers](#event-handlers)
- [Custom Events](#custom-events)
- [Dataset Interfaces](#dataset-interfaces)
- [Element Caching](#element-caching)
- [Avoiding `any`](#avoiding-any)
- [Type Imports](#type-imports)

---

## Event Handlers

### Use the EventHandler<E> Type Alias

All event handler methods and callbacks should use the `EventHandler<E>` type alias from `utilities/types.ts`.

**Rule:** Match the event type to the addEventListener event name.

```typescript
import type { EventHandler } from '../utilities/types.js';

class SherpaButton extends SherpaElement {
  // ✅ Good - Typed event handlers
  #onClick: EventHandler<MouseEvent> = (e) => {
    console.log(e.clientX, e.clientY); // Autocomplete works!
  };

  #onKeyDown: EventHandler<KeyboardEvent> = (e) => {
    if (e.key === 'Enter') { ... }
  };

  #onInput: EventHandler<InputEvent> = (e) => {
    const value = (e.target as HTMLInputElement).value;
  };

  // ❌ Bad - Untyped handlers
  #onClick = (e) => { ... };
}
```

### Common Event Types Reference

| Event Type | Use For |
|------------|---------|
| `MouseEvent` | `click`, `mousedown`, `mouseup`, `mousemove`, `mouseenter`, `mouseleave` |
| `KeyboardEvent` | `keydown`, `keyup`, `keypress` |
| `PointerEvent` | `pointerdown`, `pointerup`, `pointermove` (includes touch) |
| `FocusEvent` | `focus`, `blur`, `focusin`, `focusout` |
| `InputEvent` | `input`, `beforeinput` |
| `Event` | `change`, `submit`, `toggle`, generic handlers |
| `CustomEvent<T>` | Component-specific events with typed detail |

---

## Custom Events

### Create Detail Interfaces

All custom events must have detail interfaces defined in `utilities/types.ts` (or locally if component-specific).

**Rule:** Name interfaces `{EventName}EventDetail`.

```typescript
// In utilities/types.ts
export interface SortChangeEventDetail {
  field: string;
  direction: 'asc' | 'desc' | 'off';
}

// In component
import type { SortChangeEventDetail } from '../utilities/types.js';

dispatchEvent(new CustomEvent<SortChangeEventDetail>('sort-change', {
  bubbles: true,
  composed: true,
  detail: { field: 'name', direction: 'asc' }
}));
```

### Document in JSDoc

Use the `@fires` JSDoc block to document custom events:

```typescript
/**
 * @element sherpa-data-grid
 * 
 * @fires sort-change
 *   bubbles: true, composed: true
 *   detail: { field: string, direction: 'asc' | 'desc' | 'off' }
 */
```

### Shared vs Component-Specific Event Details

**Shared** (add to `utilities/types.ts`):
- Used by multiple components
- Generic event patterns (change, select, toggle)
- Part of the public API contract

**Component-Specific** (define locally):
- Used by only one component
- Highly specialized detail structure
- Internal implementation detail

```typescript
// Shared - multiple components dispatch selection events
export interface SelectionChangeEventDetail {
  selected: string[];
  count: number;
}

// Local - only sherpa-button fires this
interface ButtonClickEventDetail {
  timestamp: number;
}
```

---

## Dataset Interfaces

### When to Create a Dataset Interface

Create a dataset interface when a component has **≥3 dataset properties**.

**Rule:** Extend `DOMStringMap` and make all properties optional strings.

```typescript
interface SherpaDataGridDataset extends DOMStringMap {
  loading?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc' | 'off';
  pageSize?: string;
}

export class SherpaDataGrid extends SherpaElement {
  override get dataset(): SherpaDataGridDataset {
    return super.dataset as SherpaDataGridDataset;
  }
}
```

### Benefits

- ✅ Autocomplete for `this.dataset.` properties
- ✅ Typos caught at compile time (`this.dataset.srtField` → error)
- ✅ Self-documenting data attributes
- ✅ Zero runtime cost

### Dataset Properties Are Always Strings

Remember: dataset properties are always `string | undefined`, even for numbers/booleans.

```typescript
interface SherpaDataGridDataset extends DOMStringMap {
  pageSize?: string;  // ✅ Correct - will be "10", "20", etc.
  loading?: string;   // ✅ Correct - will be "" when present
}

// To use:
const pageSize = parseInt(this.dataset.pageSize ?? '10', 10);
const loading = this.dataset.loading !== undefined;
```

---

## Element Caching

### Use the cacheElements() Method

All components that query shadow DOM elements should use `this.cacheElements()` instead of manual field declarations.

**Rule:** Replace manual `#elNameEl = null` fields with a single `els` object.

```typescript
// ✅ Good - Element caching pattern
class SherpaButton extends SherpaElement {
  els = this.cacheElements({
    trigger: '.trigger',
    label: { selector: '.label', type: HTMLSpanElement },
    icons: { selector: '.icon', all: true }
  });

  override onRender(): void {
    // Elements auto-cached on first access
    this.els.trigger?.addEventListener('click', this.#onClick);
    this.els.label.textContent = 'Click me';
  }
}

// ❌ Bad - Manual field declarations
class SherpaButton extends SherpaElement {
  #triggerEl: HTMLElement | null = null;
  #labelEl: HTMLElement | null = null;

  override onRender(): void {
    this.#triggerEl = this.$('.trigger');
    this.#labelEl = this.$('.label');
  }
}
```

### Typed Element Caching

Specify element types for better autocomplete:

```typescript
els = this.cacheElements({
  // String shorthand - inferred as Element | null
  label: '.label',
  
  // Config object with type - typed as HTMLSpanElement | null
  heading: { selector: '.heading', type: HTMLSpanElement },
  
  // Query all - returns NodeListOf<Element>
  items: { selector: '.item', all: true },
  
  // Required element - throws if not found
  trigger: { selector: '.trigger', required: true }
});
```

---

## Avoiding `any`

### Prefer Specific Types Over `any`

The `any` type disables TypeScript's type checking. Avoid it unless absolutely necessary.

**Rule:** Use interfaces, type guards, or union types instead of `any`.

```typescript
// ❌ Bad
function processData(data: any): any {
  return data.value;
}

// ✅ Good - Use interfaces
interface DataItem {
  value: string;
  timestamp: number;
}

function processData(data: DataItem): string {
  return data.value;
}

// ✅ Good - Use unknown with type guards
function processData(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String((data as { value: unknown }).value);
  }
  return '';
}
```

### When `any` is Acceptable

1. **TypeScript decorator targets** - Required by TypeScript:
   ```typescript
   export function property<T>(options: PropertyOptions<T>) {
     return (target: any, propertyKey: string) => {
       // target must be any for decorators
     };
   }
   ```

2. **Third-party library gaps** - When library types are incomplete:
   ```typescript
   // Add a comment explaining why
   // @ts-expect-error - Library types don't include this property
   const value = externalLib.undocumentedProperty;
   ```

3. **Complex mixin return types** - When the exact type is too complex to express:
   ```typescript
   // Document that this is a design choice
   export function ComplexMixin<T>(Base: T): any {
     // Return type is intentionally any due to TypeScript limitations
   }
   ```

**Rule:** If using `any`, add a comment explaining why it's necessary.

---

## Type Imports

### Use `import type` for Type-Only Imports

When importing types that are not used at runtime, use `import type` to make the intent clear.

**Rule:** Use `import type` for interfaces, type aliases, and types used only in annotations.

```typescript
// ✅ Good - Type-only imports
import type {
  ComponentSize,
  ColorVariant,
  EventHandler,
  ChangeEventDetail
} from '../utilities/types.js';

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

// ❌ Bad - Mixed value and type imports
import {
  SherpaElement,
  ComponentSize,  // Type-only but not marked
  ColorVariant
} from '../utilities/types.js';
```

### Benefits

- ✅ Makes it clear which imports are compile-time only
- ✅ Helps bundlers with tree-shaking
- ✅ Prevents accidental runtime usage of types
- ✅ Clearer separation of concerns

---

## Component Checklist

When creating or updating a component, ensure:

- [ ] Event handlers use `EventHandler<E>` type alias
- [ ] Custom events have detail interfaces
- [ ] Dataset interface added if ≥3 properties
- [ ] Element caching uses `cacheElements()`
- [ ] No `any` types without justification
- [ ] Type-only imports use `import type`
- [ ] JSDoc `@fires` blocks document events
- [ ] Public methods have return types
- [ ] Private methods have return types (encouraged)

---

## Quick Reference

```typescript
// Event handler
#onClick: EventHandler<MouseEvent> = (e) => { ... };

// Custom event
dispatchEvent(new CustomEvent<SortChangeEventDetail>('sort-change', {
  detail: { field: 'name', direction: 'asc' }
}));

// Dataset interface
interface ComponentDataset extends DOMStringMap {
  variant?: string;
  size?: string;
}
override get dataset(): ComponentDataset {
  return super.dataset as ComponentDataset;
}

// Element caching
els = this.cacheElements({
  trigger: { selector: '.trigger', type: HTMLButtonElement },
  items: { selector: '.item', all: true }
});

// Type imports
import type { EventHandler, ComponentSize } from '../utilities/types.js';
```

---

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Sherpa UI Types Reference](../components/utilities/types.ts)
- [Element Cache Utility](../components/utilities/element-cache.ts)
- [Component API Standard](./COMPONENT-API-STANDARD.md)

---

**Last updated:** 2026-05-29  
**Applies to:** All Sherpa UI components
