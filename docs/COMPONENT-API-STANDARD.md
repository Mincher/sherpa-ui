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

| Tag        | Required | Format                                                        | Notes                                                                 |
| ---------- | -------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `@element` | ✅        | `@element sherpa-tag-name`                                    | Custom element tag name                                               |
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
 * @fires buttonclick — Fired when the main button area is clicked
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
3. `@attr` (grouped: `data-*` first, then native attributes)
4. `@slot`
5. `@fires`
6. `@method`
7. `@prop`
8. `@csspart`
9. `@cssprop`

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

## 5 Checklist

Before committing any component, verify:

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
