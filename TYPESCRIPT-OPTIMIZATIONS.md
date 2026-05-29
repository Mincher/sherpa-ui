# TypeScript-Enabled Optimizations for Sherpa UI

**Status:** Analysis phase - identifying optimizations before implementation  
**Date:** 2026-05-29

## Overview

This document catalogs optimizations enabled by TypeScript's type system. These improvements either:
1. **Eliminate runtime code** - Replace runtime checks with compile-time type checking
2. **Improve type safety** - Catch errors at compile time instead of runtime
3. **Enhance developer experience** - Better IDE autocomplete, refactoring support, documentation

---

## 1. Decorator System Optimizations

### Current State ([decorators.ts:78-140](components/utilities/decorators.ts#L78-L140))

```typescript
export function property(options: PropertyOptions = {}) {
  return (target: any, propertyKey: string) => {
    // Uses 'any' types, no generic constraints
    // No compile-time validation of type/converter pairing
  };
}
```

### Optimization Opportunities

#### A. **Type-Safe Property Decorators with Generics**

**Benefit:** Catch type/converter mismatches at compile time

```typescript
// Before: No type checking between type parameter and actual property type
class Component {
  @property({ type: Number })  // No error if you set string value!
  count: string = "0";
}

// After: Type-checked decorator
@property<number>({ type: Number })
count: number = 0;  // Compiler enforces type consistency
```

**Implementation:**
```typescript
export function property<T>(options: PropertyOptions<T> = {}) {
  return (target: any, propertyKey: string) => {
    // Generic T constrains converter types
  };
}

interface PropertyOptions<T = unknown> {
  type?: TypeConstructor<T>;
  converter?: PropertyConverter<T>;
  // ...
}

interface PropertyConverter<T> {
  fromAttribute?(value: string | null): T | null;
  toAttribute?(value: T): string | null;
}
```

**Impact:** Eliminates entire class of runtime type errors

---

#### B. **Inferred Converters from Type Parameter**

**Benefit:** Reduce boilerplate, fewer opportunities for mistakes

```typescript
// Before: Manual converter specification
@property({ type: String, converter: stringConverter })
label: string;

// After: Converter inferred from type parameter
@property<string>()  // Automatically uses string converter
label: string;

@property<number>()  // Automatically uses number converter
count: number;
```

**Implementation:** Conditional types map PropertyType → converter

---

#### C. **Const Assertions for Default Converters**

**Benefit:** Better type inference, smaller compiled output

```typescript
// Before ([decorators.ts:41-62](components/utilities/decorators.ts#L41-L62))
const defaultConverters: Record<string, PropertyConverter> = {
  String: { fromAttribute: (v) => v, ... },
  // ...
};

// After
const defaultConverters = {
  String: { fromAttribute: (v) => v, ... },
  Number: { fromAttribute: (v) => v === null ? null : Number(v), ... },
  Boolean: { fromAttribute: (v) => v !== null, ... },
} as const;

// TypeScript infers exact types instead of generic Record
```

**Impact:** Better type checking, potential tree-shaking improvements

---

## 2. Event Type Safety

### Current State

```typescript
// Weakly-typed events
this.dispatchEvent(
  new CustomEvent("button-click", {
    bubbles: true,
    composed: true,
    detail: {},  // any
  }),
);
```

### Optimization: Typed Event System

**Benefit:** Autocomplete for event details, catch missing fields at compile time

```typescript
// Define event detail types
interface SherpaButtonEvents {
  'button-click': { timestamp: number };
  'menu-select': { item: Element; action: string };
  'menu-populate': { menu: SherpaMenu };
}

// Type-safe dispatch helper
protected dispatch<K extends keyof SherpaButtonEvents>(
  type: K,
  detail: SherpaButtonEvents[K]
): boolean {
  return this.dispatchEvent(
    new CustomEvent(type, {
      bubbles: true,
      composed: true,
      detail,
    })
  );
}

// Usage
this.dispatch('button-click', { timestamp: Date.now() });  // ✓ Type-checked
this.dispatch('button-click', {});  // ✗ Error: missing timestamp
this.dispatch('invalid-event', {});  // ✗ Error: unknown event type
```

**Impact:** Eliminates event naming typos, documents event contracts in code

---

## 3. Union Types for Variants/Sizes

### Current State ([sherpa-button.ts:76-99](components/sherpa-button/sherpa-button.ts#L76-L99))

```typescript
// No type constraint - any string accepted
get variant() {
  return this.getAttribute('data-variant') || 'primary';
}
set variant(value) {
  this.setAttribute('data-variant', value);  // 'xyz' accepted!
}
```

### Optimization: String Literal Union Types

**Benefit:** Invalid values caught at compile time

```typescript
type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'tertiary-on-color';
type ButtonSize = '2x-small' | 'x-small' | 'small' | 'base' | 'large';

@property<ButtonVariant>({ type: String, attribute: 'data-variant' })
variant: ButtonVariant = 'primary';

@property<ButtonSize>({ type: String, attribute: 'data-size' })
size: ButtonSize = 'base';

// Usage
button.variant = 'primary';    // ✓ Valid
button.variant = 'invalid';    // ✗ Type error
button.size = 'base';          // ✓ Valid
button.size = 'huge';          // ✗ Type error
```

**IDE Benefits:**
- Autocomplete shows all valid options
- Instant feedback on typos
- Refactoring updates all usages

**Impact:** Eliminates invalid attribute value bugs, self-documenting API

---

## 4. Template Literal Types for Data Attributes

### Current State

```typescript
// Accessing dataset properties via bracket notation
this.dataset['label']
this.dataset['variant']
// No type safety - typos silently fail
```

### Optimization: Typed Dataset Interface

**Benefit:** Catch typos in data attribute names

```typescript
interface SherpaButtonDataset extends DOMStringMap {
  type?: 'default' | 'icon';
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: string;
  iconStart?: string;
  iconEnd?: string;
  count?: string;
  menu?: 'true' | 'false';
  menuPosition?: 'top' | 'bottom' | 'left' | 'right';
  menuTemplate?: string;
}

// Type assertion in class
get dataset(): SherpaButtonDataset {
  return super.dataset as SherpaButtonDataset;
}

// Usage
this.dataset.label = "Click me";     // ✓ Type-checked
this.dataset.variant = "primary";    // ✓ Type-checked
this.dataset.typo = "oops";          // ✗ Error: unknown property
```

**Impact:** Catch data-attribute typos at compile time

---

## 5. Discriminated Unions for Multi-Type Components

### Current State ([sherpa-button.ts:103-109](components/sherpa-button/sherpa-button.ts#L103-L109))

```typescript
// templateId is string, no validation
get templateId() {
  const type = this.dataset.type;
  if (type === "button-menu") return "default";
  if (type === "icon-menu")   return "icon";
  return type || "default";
}
```

### Optimization: Discriminated Union

**Benefit:** Exhaustiveness checking ensures all cases handled

```typescript
type ButtonType = 'default' | 'icon';

interface DefaultButtonConfig {
  type: 'default';
  label: string;
  iconStart?: string;
  iconEnd?: string;
}

interface IconButtonConfig {
  type: 'icon';
  icon: string;
  label?: never;  // Not allowed for icon buttons
}

type ButtonConfig = DefaultButtonConfig | IconButtonConfig;

// TypeScript narrows type based on discriminant
function renderButton(config: ButtonConfig) {
  if (config.type === 'default') {
    config.label;      // ✓ Available
    config.icon;       // ✗ Error: doesn't exist
  } else {
    config.icon;       // ✓ Available
    config.label;      // ✗ Error: never type
  }
}
```

**Impact:** Compiler enforces component variant contracts

---

## 6. Readonly Types for Immutable Properties

### Current State

```typescript
// templateId should be read-only but nothing enforces it
get templateId() { return this.dataset.type || "default"; }
// No setter - but nothing prevents adding one later
```

### Optimization: Readonly Property Declarations

**Benefit:** Document and enforce immutability

```typescript
class SherpaButton extends SherpaElement {
  readonly templateId: string;  // Prevents accidental mutation
  
  constructor() {
    super();
    this.templateId = this.dataset.type || 'default';
    this.templateId = 'other';  // ✗ Error: readonly
  }
}
```

**Impact:** Prevents accidental mutation, self-documenting API

---

## 7. Replace Runtime Validation with Type Guards

### Current State

```typescript
// Runtime check for menu element type
if (this.#menuEl) {
  this.#menuEl.show(this);  // Hope it has show() method
}
```

### Optimization: Type Guards + Type Narrowing

**Benefit:** Eliminate runtime type checks

```typescript
// Type guard with compile-time validation
function isSherpaMenu(el: Element | null): el is SherpaMenu {
  return el?.tagName === 'SHERPA-MENU';
}

#menuEl: Element | null = null;

// Usage
if (isSherpaMenu(this.#menuEl)) {
  this.#menuEl.show(this);  // ✓ TypeScript knows it's SherpaMenu
  // Autocomplete shows all SherpaMenu methods
}
```

**Impact:** Better type inference, removes need for type assertions

---

## 8. Utility Types for Configuration Objects

### Current State ([sherpa-button.ts:417-447](components/sherpa-button/sherpa-button.ts#L417-L447))

```typescript
// setMenuItems accepts complex config object
setMenuItems(items, opts = {}) {
  const { marker } = opts;  // opts is 'any'
  // ...
}
```

### Optimization: Typed Config with Utility Types

**Benefit:** Autocomplete, documentation, validation

```typescript
interface MenuItem {
  value: string;
  text?: string;
  selected?: boolean;
  disabled?: boolean;
  description?: string;
  keepOpen?: boolean;
  data?: Record<string, string>;
}

interface MenuSection {
  heading?: string;
  items: MenuItem[];
  group?: string;
  selection?: 'checkbox' | 'radio' | 'toggle';
  style?: string;
}

type MenuItems = MenuItem[] | MenuSection[];

interface MenuOptions {
  selection?: 'checkbox' | 'radio' | 'toggle';
  group?: string;
  append?: boolean;
  marker?: string;
}

// Typed method signature
setMenuItems(items: MenuItems, opts?: Partial<MenuOptions>): void {
  // Full autocomplete + type checking
}

// Usage
button.setMenuItems([
  { value: 'a', text: 'Option A', invalidProp: true }  // ✗ Error
], {
  selection: 'checkbox',  // ✓ Autocomplete shows options
  invalidOpt: 'x'         // ✗ Error
});
```

**Impact:** Self-documenting API, prevents configuration errors

---

## 9. Const Assertions for Static Configuration

### Current State ([status-mixin.ts:55-67](components/utilities/status-mixin.ts#L55-L67))

```typescript
static get statusIcons(): Record<Status, string | null> {
  return {
    success: 'fa-solid fa-circle-check',
    // ...
  };
}
```

### Optimization: Const Assertion + Satisfies

**Benefit:** Exact type inference, ensures all statuses covered

```typescript
static readonly statusIcons = {
  success: 'fa-solid fa-circle-check',
  error: 'fa-solid fa-circle-exclamation',
  critical: 'fa-solid fa-circle-exclamation',
  warning: 'fa-solid fa-triangle-exclamation',
  info: 'fa-solid fa-circle-info',
  neutral: 'fa-regular fa-circle',
  urgent: 'fa-solid fa-bolt',
  default: null,
  none: null,
} as const satisfies Record<Status, string | null>;
// ↑ Ensures all Status values present
// ↑ Infers exact literal types ('fa-solid fa-circle-check' not string)
```

**Impact:** Exhaustiveness checking, better autocomplete

---

## 10. Extract Common Type Patterns into Shared Utilities

### Current Pattern

Every component duplicates size/variant/status types:

```typescript
// sherpa-button.ts
type ButtonSize = 'sm' | 'base' | 'lg';

// sherpa-input.ts
type InputSize = 'sm' | 'base' | 'lg';  // Duplicate!

// sherpa-badge.ts
type BadgeSize = 'sm' | 'base' | 'lg';  // Duplicate!
```

### Optimization: Shared Type Utilities

**Create:** `components/utilities/types.ts`

```typescript
// Common size scale
export type ComponentSize = '2x-small' | 'x-small' | 'small' | 'base' | 'large';

// Common variant palette
export type ColorVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost';

// Status types (already exist in status-mixin)
export type { Status } from './status-mixin.js';

// Layout orientation
export type Orientation = 'horizontal' | 'vertical';

// Selection modes
export type SelectionMode = 'checkbox' | 'radio' | 'toggle';

// Menu position
export type PopoverPosition = 'top' | 'bottom' | 'left' | 'right' | 'auto';

// Component event detail types
export interface ChangeEventDetail<T = unknown> {
  value: T;
  oldValue?: T;
}

export interface SelectEventDetail {
  item: Element;
  value: string;
}
```

**Impact:** Single source of truth, easier to update system-wide

---

## 11. Remove @ts-nocheck Files (Priority Targets)

### High-Impact Files to Refine

| File | Lines | Complexity | Impact | Priority |
|------|-------|------------|--------|----------|
| `sherpa-input-base.ts` | 501 | High | All inputs | **P0** |
| `content-attributes-mixin.ts` | 968 | Very High | Content components | **P1** |
| `sherpa-button.ts` | 544 | Medium | Universal | **P0** |
| `resize-behavior.ts` | 129 | Low | Containers | P2 |
| Component files (80) | ~200 avg | Low-Med | Various | P1-P2 |

### Refinement Strategy

**Phase 1: Core Infrastructure (sherpa-input-base, decorators)**
- Remove @ts-nocheck
- Add proper types to all methods
- Type all event handlers
- Type private fields with definite assignment

**Phase 2: High-Usage Components (button, input-text, container)**
- Apply union types for variants/sizes
- Type event details
- Type configuration objects

**Phase 3: Mixin Files (content-attributes, resize-behavior)**
- Complex dynamic properties - may need mapped types
- Type mixin return values properly

**Phase 4: Batch Component Refinement**
- Group by similarity
- Apply shared patterns
- Extract common types

---

## 12. Performance Optimizations Enabled by Types

### A. **Eliminate Runtime Type Coercion**

**Before:** Runtime type conversion in decorators

```typescript
// decorators.ts - runs on every property set
set(value: unknown) {
  // Runtime type check + conversion
  if (type === Number) value = Number(value);
  if (type === Boolean) value = Boolean(value);
  this[privateKey] = value;
}
```

**After:** TypeScript enforces types at compile time

```typescript
@property<number>()
count: number = 0;

// TypeScript prevents wrong types
button.count = "5";  // ✗ Compile error: Type 'string' is not assignable
button.count = 5;    // ✓ No runtime conversion needed
```

**Impact:** Skip runtime type checks when TypeScript guarantees type correctness

---

### B. **Tree-Shaking Dead Code**

**Before:** All converters loaded even if unused

```typescript
const defaultConverters: Record<string, PropertyConverter> = {
  String: { ... },
  Number: { ... },
  Boolean: { ... },
  Object: { ... },   // Unused in simple components
  Array: { ... },    // Unused in simple components
};
```

**After:** Import only needed converters

```typescript
// decorators.ts - Export individual converters
export const stringConverter = { ... };
export const numberConverter = { ... };
export const booleanConverter = { ... };
export const objectConverter = { ... };
export const arrayConverter = { ... };

// Component - Import only what's needed
import { property, stringConverter, booleanConverter } from '../decorators.js';

@property({ converter: stringConverter })
label: string;

@property({ converter: booleanConverter })
disabled: boolean;
// Object/Array converters not in bundle
```

**Impact:** Smaller bundle size for components that only use primitive types

---

### C. **Inline Type Guards**

**Before:** Function call overhead

```typescript
function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

if (isElement(node)) {
  node.getAttribute(...);
}
```

**After:** TypeScript inlines simple type guards

```typescript
// Compiler can inline this check
if (node.nodeType === Node.ELEMENT_NODE) {
  (node as Element).getAttribute(...);
}
```

**Impact:** Zero runtime overhead for type narrowing

---

## 13. Developer Experience Improvements

### A. **JSDoc → TypeScript Type Annotations**

**Before:** JSDoc comments (not type-checked, can drift out of sync)

```typescript
/**
 * @param {Array} items - flat item array OR sections array
 * @param {{ selection?: "checkbox"|"radio"|"toggle", group?: string }} [opts]
 */
setMenuItems(items, opts = {}) { ... }
```

**After:** TypeScript signatures (enforced by compiler)

```typescript
setMenuItems(
  items: MenuItem[] | MenuSection[],
  opts?: Partial<MenuOptions>
): void { ... }
```

**Benefits:**
- IDE autocomplete works better
- Signature can't drift from implementation
- Refactoring tools understand the types

---

### B. **Extract Interface for Public API**

**Before:** No clear contract for component API

```typescript
class SherpaButton extends SherpaElement {
  // Public? Private? Unclear
  disabled: boolean;
  active: boolean;
  label: string;
  setMenuItems() { ... }
}
```

**After:** Explicit public interface

```typescript
export interface ISherpaButton {
  // Properties
  disabled: boolean;
  active: boolean;
  label: string;
  variant: ButtonVariant;
  size: ButtonSize;
  
  // Methods
  setMenuItems(items: MenuItems, opts?: MenuOptions): void;
  getSelectedValues(): string[];
  clearSelection(): void;
}

export class SherpaButton extends SherpaElement implements ISherpaButton {
  // Compiler enforces interface contract
}
```

**Impact:** Documents public API, catches breaking changes

---

## 14. Next Steps: Implementation Order

### Phase 1: Core Type System (Week 1)
- [ ] Enhance decorator system with generics
- [ ] Create shared type utilities file
- [ ] Refine SherpaElement base class
- [ ] Remove @ts-nocheck from sherpa-input-base.ts

### Phase 2: High-Impact Components (Week 2)
- [ ] Refine sherpa-button (most used)
- [ ] Refine input components (sherpa-input-text, etc.)
- [ ] Apply union types for variants/sizes system-wide
- [ ] Type all event details

### Phase 3: Mixins & Complex Files (Week 3)
- [ ] Refine StatusMixin (mostly done)
- [ ] Refine ContentAttributesMixin (complex dynamic properties)
- [ ] Type resize-behavior and other behaviors

### Phase 4: Batch Refinement (Week 4)
- [ ] Remove @ts-nocheck from all remaining components
- [ ] Apply shared type patterns
- [ ] Extract public API interfaces
- [ ] Document type-driven optimizations

---

## Summary

**Key Optimization Categories:**

1. **Type Safety** → Catch bugs at compile time
2. **Runtime Elimination** → Replace runtime checks with types
3. **Bundle Size** → Tree-shake unused code
4. **Developer Experience** → Better autocomplete, refactoring
5. **Documentation** → Types are always up-to-date

**Estimated Impact:**
- **100+ runtime errors** eliminated via compile-time checks
- **~5-10% bundle size reduction** from tree-shaking
- **50% faster refactoring** with type-aware tools
- **Zero documentation drift** - types are the documentation

**Metrics to Track:**
- TypeScript error count (`tsc --noEmit`)
- Bundle size before/after optimizations
- Developer feedback on IDE experience
- Runtime error reports (should decrease)
