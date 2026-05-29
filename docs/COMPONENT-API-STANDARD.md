# Component API Documentation Standard

> Every Sherpa component must document its public API surface using the format
> defined in this document. This format is both human-readable and
> machine-parseable — it feeds directly into the MCP server schema extraction
> pipeline.

---

## 1 JSDoc Header — JavaScript Files

Every `.js` file begins with a JSDoc block. The block uses `@`-prefixed tags
in a fixed order. This is the **only** accepted format.

```js
/**
 * sherpa-example.js
 * SherpaExample — Brief one-line description of the component.
 *
 * Extended description if needed. Explain architecture, multi-template
 * logic, delegation patterns, or anything a consumer needs to know.
 *
 * @element sherpa-example
 * @category control
 *
 * @attr {string}  data-label         — Text label
 * @attr {enum}    data-variant       — primary | secondary | tertiary
 * @attr {enum}    data-size          — small | medium | large
 * @attr {boolean} data-active        — Active/pressed state
 * @attr {string}  data-icon-start    — Leading icon (Font Awesome unicode)
 * @attr {number}  data-count         — Badge count
 * @attr {json}    data-filters       — JSON array of active filters
 * @attr {boolean} disabled           — Native disabled state
 *
 * @slot           — Default slot for main content
 * @slot actions   — Action buttons placed in the footer
 * @slot header    — Custom heading content (replaces default title)
 *
 * @fires example-click — Fired when the component is activated
 *   bubbles: true, composed: true
 *   detail: { }
 * @fires example-change — Fired when selected value changes
 *   bubbles: true, composed: true
 *   detail: { value: string, previousValue: string }
 *
 * @method show() — Programmatically show the component
 *   @param {object} [options] — Configuration options
 *   @param {string} options.position — Placement position
 *   @returns {void}
 *
 * @prop {string} value — Current value (read/write)
 * @prop {boolean} open — Whether the component is open (read-only)
 *
 * @csspart wrapper — Main wrapper element
 *
 * @cssprop --sherpa-example-gap — Gap between items (default: 8px)
 */
```

### 1.1 Tag Reference

| Tag         | Required | Format                                                        | Notes                                                                 |
| ----------- | -------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `@element`  | ✅        | `@element sherpa-tag-name`                                    | Custom element tag name                                               |
| `@category` | ✅        | `@category role`                                              | One of the roles in [COMPONENT-CATEGORIES.md](./COMPONENT-CATEGORIES.md) |
| `@attr`    | ✅        | `@attr {type} name — description`                             | One per observed attribute                                            |
| `@slot`    | ✅        | `@slot [name] — description`                                  | Omit name for default slot                                            |
| `@fires`   | ✅        | `@fires event-name — description` then indented bubbles/detail | One per dispatched CustomEvent                                        |
| `@method`  | if any   | `@method name(params) — description`                          | Public instance and static methods                                    |
| `@prop`    | if any   | `@prop {type} name — description`                             | Public getters/setters not reflected as attributes                    |
| `@csspart` | if any   | `@csspart name — description`                                 | Exposed `part` names for `::part()` styling                           |
| `@cssprop` | if any   | `@cssprop name — description`                                 | Public CSS custom properties consumers can set (not `--_` internals) |

### 1.2 Attribute Types

| Type      | Meaning                                              | Example                                  |
| --------- | ---------------------------------------------------- | ---------------------------------------- |
| `string`  | Free-form text                                       | `data-label`, `data-description`         |
| `boolean` | Presence/absence attribute (no value needed)          | `disabled`, `data-dismissible`           |
| `enum`    | One of a fixed set of values (list them after `—`)   | `data-variant — primary \| secondary`    |
| `number`  | Numeric value                                        | `data-count`, `data-duration`            |
| `json`    | JSON-serialised array or object                      | `data-filters`, `data-measures`          |

### 1.3 Attribute Naming Rules

| Category                      | Prefix   | Examples                                            |
| ----------------------------- | -------- | --------------------------------------------------- |
| Native HTML attributes        | _(none)_ | `disabled`, `open`, `readonly`, `required`, `name`  |
| Component-specific attributes | `data-`  | `data-label`, `data-variant`, `data-icon-start`     |

**Rule:** If the browser natively understands the attribute, keep it bare.
All component-specific attributes use `data-*`.

### 1.4 Event Documentation

Every `@fires` tag must include:
1. **Event name** — kebab-case
2. **Description** — what triggers it
3. **Bubbles/composed** — on the next indented line
4. **Detail structure** — on the next indented line, with property types

```js
 * @fires tab-change — Fired when the active tab changes
 *   bubbles: true, composed: true
 *   detail: { index: number, label: string, previousIndex: number }
```

If the event has no detail payload:

```js
 * @fires button-click — Fired when the main button area is clicked
 *   bubbles: true, composed: true
 *   detail: { }
```

### 1.5 Slot Documentation

```js
 * @slot           — Default slot for body content
 * @slot header    — Custom heading (replaces attribute-driven title)
 * @slot footer    — Footer action area
 * @slot icon      — Custom icon content
```

The unnamed slot is the default slot. Always document it if it exists.

### 1.6 Tag Order

Tags must appear in this order within the JSDoc block:

1. Filename + class description (free text)
2. `@element`
3. `@category`
4. `@attr` (grouped: `data-*` first, then native attributes)
5. `@slot`
6. `@fires`
7. `@method`
8. `@prop`
9. `@csspart`
10. `@cssprop`

### 1.7 Slot Allowlists (`data-accepts`)

A `<slot>` element in a component's HTML template may declare which component
roles it accepts via `data-accepts="role[,role]"`. The list is comma-separated
and uses the roles defined in [COMPONENT-CATEGORIES.md](./COMPONENT-CATEGORIES.md).
Slots without `data-accepts` are unconstrained.

```html
<slot name="actions" data-accepts="control"></slot>
<slot name="footer"  data-accepts="control,content"></slot>
```

The schema generator reads `data-accepts` from the template HTML and surfaces
it on each entry of `slots[].accepts` in the generated JSON. The JSDoc
`@slot` tag remains a free-text human description — it does **not** need to
repeat the accepts list.

---

## 2 JSDoc Header — CSS Files

Every `.css` file begins with a JSDoc block documenting the host attributes
that drive CSS selectors and the architectural approach.

```css
/**
 * sherpa-example.css
 * Shadow DOM styles for the SherpaExample web component.
 *
 * Architecture:
 *   Inline-flex layout with icon-start, label, and icon-end children.
 *   Icons hidden by default, shown via data-icon-* host attributes.
 *   Uses container query for responsive label hiding.
 *
 * Host attributes consumed:
 *   data-label       {string}  — Label text (hides .label when absent)
 *   data-variant     {enum}    — primary | secondary | tertiary
 *   data-size        {enum}    — small | medium | large
 *   data-icon-start  {string}  — Shows leading icon
 *   data-icon-end    {string}  — Shows trailing icon
 *   data-active      {boolean} — Active/pressed state
 *   disabled         {boolean} — Inactive state
 *
 * Status system:
 *   Consumes --_status-surface, --_status-text via fallback chains.
 *
 * Container:
 *   sherpa-example / inline-size
 */
```

### Key rules

- List all host attributes that appear in CSS selectors.
- Include the attribute type and a brief description.
- Note which `--_status-*` variables the component consumes.
- Note `container` declaration if responsive.
- Do **not** document `--_` private variables here — they are internal.

---

## 3 Naming Conventions

### 3.1 Events

| Convention          | Rule                                               | Examples                                         |
| ------------------- | -------------------------------------------------- | ------------------------------------------------ |
| Format              | `kebab-case`                                       | `tab-change`, `card-click`, `menu-select`        |
| Specificity         | Prefix with component concept when not obvious     | `buttonclick`, `chipremove`                       |
| Native re-dispatch  | Use native name when re-dispatching native events  | `input`, `change`                                |
| Always bubbles      | All custom events use `bubbles: true`              |                                                  |
| Composed when needed| Use `composed: true` for events that must cross shadow boundaries to reach application code |   |

### 3.2 Attributes

| Convention             | Rule                                                              | Examples                              |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| Format                 | `data-kebab-case`                                                 | `data-icon-start`, `data-active-tab`  |
| Boolean presence       | Attribute presence = true, absence = false                        | `data-dismissible`, `disabled`        |
| Enum values            | Pipe-separated list in docs                                       | `primary \| secondary \| tertiary`    |
| Shared vocabulary      | Use consistent names across components (see §3.4 shared names)    |                                       |

### 3.3 CSS Custom Properties

| Convention          | Rule                                                          | Examples                                    |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| Public tokens       | `--sherpa-*` prefix, semantic names                           | `--sherpa-space-sm`, `--sherpa-text-body`    |
| Component public    | `--sherpa-{component}-{property}` (only if needed)            | `--sherpa-card-padding`                      |
| Private internal    | `--_` prefix                                                  | `--_status-surface`, `--_cg-border-radius`  |
| Always fallback     | `var(--sherpa-token, hardcoded-value)`                        | `var(--sherpa-space-sm, 12px)`              |

### 3.4 Shared Attribute Names

These attribute names have **fixed meaning** across all components that use them.
Never repurpose them.

| Attribute           | Type      | Purpose                                       |
| ------------------- | --------- | --------------------------------------------- |
| `data-label`        | `string`  | Primary text label                             |
| `data-description`  | `string`  | Secondary descriptive text                     |
| `data-variant`      | `enum`    | Visual variant (primary, secondary, tertiary)  |
| `data-size`         | `enum`    | Size preset (small, medium, large)             |
| `data-status`       | `enum`    | Status colour scheme (error, warning, success, info, urgent) |
| `data-icon-start`   | `string`  | Leading icon (Font Awesome class)              |
| `data-icon-end`     | `string`  | Trailing icon (Font Awesome class)             |
| `data-active`       | `boolean` | Active/pressed toggle state                    |
| `data-selected`     | `boolean` | Selected state                                 |
| `data-elevation`    | `enum`    | Shadow level (none, sm, md, lg)                |
| `data-layout`       | `enum`    | Layout direction (horizontal, vertical)        |
| `data-type`         | `enum`    | Component sub-type / template selector         |
| `data-open`         | `boolean` | Open/expanded state                            |
| `data-dismissible`  | `boolean` | Can be dismissed by user                       |
| `disabled`          | `boolean` | Native disabled state                          |
| `hidden`            | `boolean` | Native hidden state                            |

---

## 4 Machine-Readable Schema

The JSDoc format defined above is the **source of truth**. The extraction
pipeline (`scripts/extract-component-schemas.js`) parses these annotations
and produces JSON files conforming to `schemas/component-schema.json`.

### Extraction rules

| JSDoc Tag   | Maps To                       |
| ----------- | ----------------------------- |
| `@element`  | `tagName`                     |
| `@attr`     | `attributes[]`                |
| `@slot`     | `slots[]`                     |
| `@fires`    | `events[]`                    |
| `@method`   | `methods[]`                   |
| `@prop`     | `properties[]`                |
| `@csspart`  | `cssParts[]`                  |
| `@cssprop`  | `cssProperties[]`             |

### Generated output per component

```json
{
  "tagName": "sherpa-example",
  "description": "Brief one-line description of the component.",
  "category": "core",
  "baseClass": "SherpaElement",
  "attributes": [
    {
      "name": "data-label",
      "type": "string",
      "description": "Text label",
      "default": null,
      "enumValues": null,
      "required": false
    },
    {
      "name": "data-variant",
      "type": "enum",
      "description": "Visual variant",
      "default": "primary",
      "enumValues": ["primary", "secondary", "tertiary"],
      "required": false
    }
  ],
  "slots": [
    { "name": "", "description": "Default slot for main content" },
    { "name": "actions", "description": "Action buttons" }
  ],
  "events": [
    {
      "name": "example-click",
      "description": "Fired when the component is activated",
      "bubbles": true,
      "composed": true,
      "detail": {}
    }
  ],
  "methods": [],
  "properties": [],
  "cssParts": [],
  "cssProperties": []
}
```

---

## 4.1 Phase 2: CSS Modernization (CSS Nesting)

**Status**: Active (as of May 2026)  
**Scope**: New component CSS files and refactored components  
**Migration**: Gradual rollout; existing flat CSS remains valid

### CSS Nesting Architecture

Phase 2 modernization uses **CSS Nesting** to reduce boilerplate and improve maintainability. All selectors are organized hierarchically under `:host` with the `&` selector.

**Pattern structure:**

```css
/**
 * sherpa-example.css — Phase 2 Modernization (CSS Nesting)
 * Shadow DOM styles organized under :host with & nesting.
 * 
 * Architecture:
 *   All host selectors and child rules nested under :host {} block.
 *   Child elements always nested (& .element).
 *   Variants/states organized by feature section.
 *   Use comments to separate logical sections.
 */

:host {
  /* ── Host-level defaults ────────────────────────── */
  display: inline-flex;
  gap: var(--sherpa-space-xs, 8px);
  color: var(--sherpa-text-default-body);
  transition: background var(--sherpa-motion-duration-fast, 0.15s);

  /* ── Variant 1: Primary ────────────────────────── */
  &[data-variant="primary"] {
    background: var(--sherpa-surface-control-primary-default);
  }

  /* ── Variant 2: Secondary ─────────────────────── */
  &[data-variant="secondary"] {
    background: var(--sherpa-surface-control-secondary-default);
  }

  /* ── Size variants ────────────────────────────── */
  &[data-size="small"] {
    height: var(--sherpa-size-xl, 28px);
    padding-inline: var(--sherpa-space-xs, 8px);
  }

  &[data-size="large"] {
    height: var(--sherpa-size-3xl, 40px);
    padding-inline: var(--sherpa-space-sm, 12px);
  }

  /* ── Interactive state ────────────────────────── */
  &[data-interactive="true"]:hover {
    background: var(--sherpa-surface-control-primary-hover);
  }

  /* ── Disabled state ───────────────────────────── */
  &[disabled] {
    cursor: not-allowed;
    pointer-events: none;
    color: var(--sherpa-text-inactive-default);
    background: var(--sherpa-surface-control-inactive-default);
  }

  /* ── Child elements ───────────────────────────– */
  & .icon {
    display: none;
    width: var(--sherpa-size-sm, 16px);
    height: var(--sherpa-size-sm, 16px);
  }

  &[data-icon-start] .icon {
    display: inline-flex;
  }

  & .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Hidden state ────────────────────────────── */
  &[hidden] { display: none; }
}
```

### Benefits

1. **Reduced boilerplate** — 30%–54% fewer lines vs flat selectors
2. **Improved readability** — Related rules grouped hierarchically
3. **Maintained scope** — Child elements naturally scoped under :host
4. **Better organization** — Features organized into logical sections
5. **100% compatibility** — Identical rendering to flat CSS

### Migration Path

**For new components:**
- Use CSS nesting from the start
- Organize under `:host` block
- Use comments to mark sections

**For existing components:**
- Continue using flat `:host()` selectors (no breaking changes)
- Refactor incrementally when modifying existing CSS
- Follow Phase 2 Testing Guide before merging

### Progressive Enhancement

**Browser support:**
- ✅ Modern (Chrome 112+, Firefox 117+, Safari 17.5+, Edge 112+): Native nesting
- ✅ Older (Chrome 99+, Firefox 97+, Safari 15.4+, Edge 99+): PostCSS fallback (if configured)

**Fallback strategy:**
- Build system flattens nesting to flat `:host()` selectors for pre-Chrome-112 support
- No runtime cost; purely build-time transformation
- Use `@supports (selector(:has(*)))` and similar feature queries for progressive enhancement

### When NOT to Use Nesting

Avoid nesting in these cases:

1. **Global CSS** (not in shadow DOM components)
   - Use flat selectors or CSS modules
   - Nesting is for scoped shadow CSS only

2. **Light DOM components**
   - Use flat selectors or BEM methodology
   - Nesting has no scope advantage in light DOM

3. **Pseudo-elements requiring :host isolation**
   - Use compound selectors: `:host(:not([disabled]))`
   - Functional form required (see Copilot Instructions §15)

### CSS Nesting vs Flat Selectors

**Before (flat):**
```css
:host { display: flex; }
:host([data-variant="primary"]) { background: #color1; }
:host([data-variant="secondary"]) { background: #color2; }
:host([disabled]) { cursor: not-allowed; }
:host([disabled]) .label { color: #gray; }
.label { min-width: 0; }
:host([hidden]) { display: none; }
```

**After (nesting):**
```css
:host {
  display: flex;
  
  &[data-variant="primary"] { background: #color1; }
  &[data-variant="secondary"] { background: #color2; }
  
  &[disabled] {
    cursor: not-allowed;
    & .label { color: #gray; }
  }
  
  & .label { min-width: 0; }
  
  &[hidden] { display: none; }
}
```

**Size comparison:**
- Flat: 7 selectors × ~50 chars = ~350 chars
- Nested: 1 :host + 6 & selectors = ~280 chars (20% reduction)
- Large components see 30%–54% reduction

### Documentation Requirements

Update CSS file JSDoc header to note Phase 2 status:

```css
/**
 * sherpa-example.css — Phase 2 Modernization (CSS Nesting)
 * Shadow DOM styles for SherpaExample component.
 * 
 * Phase 2 patterns:
 *   - CSS Nesting under :host with & selector
 *   - All host attributes nested hierarchically
 *   - Sections organized by feature (variants, states, children)
 *   - Progressive enhancement via @supports (if needed)
 *
 * Host attributes consumed:
 *   data-variant    {enum}    — primary | secondary | tertiary
 *   data-size       {enum}    — small | medium | large
 *   data-active     {boolean} — Active state
 *   disabled        {boolean} — Disabled state
 */
```

---

## 4.5 TypeScript Requirements

All Sherpa UI components are written in TypeScript with strict mode enabled. Follow these standards for consistent type safety across the codebase.

See **[TYPESCRIPT-STANDARDS.md](./TYPESCRIPT-STANDARDS.md)** for comprehensive guidelines.

### Event Handlers

**Requirement:** Use the `EventHandler<E>` type alias for all event handler methods.

```typescript
import type { EventHandler } from '../utilities/types.js';

class SherpaButton extends SherpaElement {
  #onClick: EventHandler<MouseEvent> = (e) => {
    // TypeScript knows e.clientX, e.target, etc.
  };
  
  #onKeyDown: EventHandler<KeyboardEvent> = (e) => {
    if (e.key === 'Enter') { ... }
  };
}
```

### Custom Event Detail Interfaces

**Requirement:** All custom events must have typed detail interfaces.

```typescript
// In utilities/types.ts (shared) or component file (local)
export interface SortChangeEventDetail {
  field: string;
  direction: 'asc' | 'desc' | 'off';
}

// In component
dispatchEvent(new CustomEvent<SortChangeEventDetail>('sort-change', {
  bubbles: true,
  composed: true,
  detail: { field: 'name', direction: 'asc' }
}));
```

**Shared event details** (add to `utilities/types.ts`):
- Generic patterns used by multiple components
- Part of the public API contract

**Local event details** (define in component file):
- Used by only one component
- Highly specialized structure

### Dataset Interfaces

**Requirement:** Components with ≥3 dataset properties must define a dataset interface.

```typescript
interface SherpaDataGridDataset extends DOMStringMap {
  sortField?: string;
  sortDirection?: 'asc' | 'desc' | 'off';
  pageSize?: string;  // Always string, even for numbers
}

export class SherpaDataGrid extends SherpaElement {
  override get dataset(): SherpaDataGridDataset {
    return super.dataset as SherpaDataGridDataset;
  }
}
```

**Benefits:**
- Autocomplete for `this.dataset.` properties
- Typos caught at compile time
- Self-documenting data attributes

### Element Caching

**Requirement:** Use `this.cacheElements()` instead of manual field declarations.

```typescript
// ✅ Correct
class SherpaButton extends SherpaElement {
  els = this.cacheElements({
    trigger: '.trigger',
    label: { selector: '.label', type: HTMLSpanElement },
    icons: { selector: '.icon', all: true }
  });

  override onRender(): void {
    this.els.trigger?.addEventListener('click', this.#onClick);
  }
}

// ❌ Incorrect - Manual fields
#triggerEl: HTMLElement | null = null;
#labelEl: HTMLElement | null = null;

override onRender(): void {
  this.#triggerEl = this.$('.trigger');
  this.#labelEl = this.$('.label');
}
```

### Type Imports

**Requirement:** Use `import type` for type-only imports.

```typescript
// ✅ Correct
import type {
  ComponentSize,
  ColorVariant,
  EventHandler
} from '../utilities/types.js';

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

// ❌ Incorrect - Mixed imports
import {
  SherpaElement,
  ComponentSize  // Type, not marked as such
} from '../utilities/types.js';
```

### Avoiding `any`

**Requirement:** No `any` types without justification.

**Acceptable uses:**
1. TypeScript decorator targets (required)
2. Third-party library type gaps (document with comment)
3. Complex mixin return types (document as design choice)

```typescript
// ✅ Acceptable - Decorator target
export function property<T>(options: PropertyOptions<T>) {
  return (target: any, propertyKey: string) => {
    // target must be any for decorators
  };
}

// ✅ Acceptable - With explanation
// Type cast required due to third-party library limitation
const value = (externalLib as any).undocumentedProperty;

// ❌ Unacceptable - Lazy typing
function process(data: any): any {
  return data.value;
}
```

### TypeScript Checklist

When creating or updating components:

- [ ] Event handlers use `EventHandler<E>` type alias
- [ ] Custom events have detail interfaces (shared or local)
- [ ] Dataset interface defined if ≥3 properties
- [ ] Element caching uses `cacheElements()`
- [ ] Type-only imports use `import type`
- [ ] No `any` types without justification
- [ ] Public methods have return type annotations
- [ ] Override methods use `override` keyword

---

## 5 Checklist

Before committing any component, verify:

**API & Documentation:**
- [ ] JS file has `@element` tag with correct tag name
- [ ] Every observed attribute has an `@attr` tag with correct type
- [ ] Every `<slot>` in the HTML template has a matching `@slot` tag
- [ ] Every `new CustomEvent()` call has a matching `@fires` tag with bubbles/composed/detail
- [ ] Every public method has a `@method` tag with `@param`/`@returns`
- [ ] Every public getter/setter not reflected as attribute has `@prop`
- [ ] CSS file has JSDoc header listing all host attributes consumed in selectors
- [ ] Attribute names follow shared vocabulary (§3.4) where applicable
- [ ] No bare custom attributes — all component-specific attributes use `data-*`
- [ ] Events use `bubbles: true`; `composed: true` only when crossing shadow for app code
- [ ] Tag order follows §1.6

**Phase 2 CSS Modernization (if using CSS Nesting):**
- [ ] CSS file header includes "Phase 2 Modernization (CSS Nesting)" annotation
- [ ] All host selectors organized under single `:host { }` block
- [ ] Child element rules nested with `& .class` pattern
- [ ] Variants/states organized into logical comment-separated sections
- [ ] All tokens use fallback chains: `var(--sherpa-token, hardcoded-value)`
- [ ] No bare custom attributes in selectors (use `data-*`)
- [ ] `:host()` compound selectors use functional form: `:host(:not([disabled]))`
- [ ] Disabled state uses inactive tokens, not opacity
- [ ] `:host([hidden]) { display: none; }` declared
- [ ] CSS syntax valid (brace balance = 0)

**Testing (Phase 3):**
- [ ] Visual parity verified across baseline browsers (Chrome 99+, Firefox 97+, Safari 15.4+, Edge 99+)
- [ ] All states tested (hover, active, focus, disabled, variants)
- [ ] Slot projection works correctly
- [ ] No console errors or warnings
- [ ] Responsive behavior intact
- [ ] File size reduction verified (if refactored from flat CSS)

---

## 6 Migration Guide

For existing components being updated to this standard:

1. **Replace the JSDoc header** with the canonical format from §1.
2. **Add `@element`** tag if missing.
3. **Convert narrative attribute lists** to `@attr {type} name — description` format.
4. **Add type annotations** to all `@attr` tags (string, boolean, enum, number, json).
5. **Enumerate enum values** after the `—` separator: `@attr {enum} data-variant — primary | secondary | tertiary`.
6. **Document event bubbling** — add `bubbles:` and `composed:` lines under each `@fires`.
7. **Document event detail** — add `detail:` line with property types under each `@fires`.
8. **Add `@slot` tags** for every `<slot>` in the HTML template.
9. **Add `@method`/`@prop` tags** for public API not covered by attributes.
10. **Update CSS JSDoc header** to list all host attributes consumed in selectors.
11. **(Phase 2) Refactor CSS to use nesting** — Organize under `:host { }`, nest child rules with `& .class`, organize variants/states into sections.
