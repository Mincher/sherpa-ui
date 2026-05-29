# Component API Standard — JSDoc Quick Reference

Full standard: `docs/COMPONENT-API-STANDARD.md`

---

## JSDoc Block Order

The JSDoc block comes **first** in the `.js` file, before all imports. Tags must appear in this exact order:

1. `@element`
2. `@category`
3. `@attr` (all attributes, one per line)
4. `@slot` (all slots, one per line)
5. `@fires` (all custom events, one per line, with `bubbles/composed/detail` on the next lines)
6. `@method` (public methods, with `@returns`)
7. `@prop` (public JS properties)
8. `@csspart` (exposed shadow DOM parts)
9. `@cssprop` (exposed CSS custom properties)

---

## Tag Reference

| Tag | Required | Notes |
|-----|----------|-------|
| `@element` | **Yes** | Exact custom element tag name |
| `@category` | **Yes** | One of the valid category values (see below) |
| `@attr {type} name — description` | **Yes** (all public attrs) | Dash-prefixed for `data-*` attrs; bare for native (`disabled`, `name`, etc.) |
| `@slot name — description` | Yes (if slots exist) | Default slot: `@slot — description` (no name) |
| `@fires name — description` | Yes (if events exist) | Include `bubbles`, `composed`, `detail` shape on lines below |
| `@method name() — description` | Yes (if public methods exist) | Include `@returns` and `@param` as needed |
| `@prop {type} name — description` | Yes (if public JS properties exist) | |
| `@csspart name — description` | If applicable | Shadow parts exposed via `::part()` |
| `@cssprop --name — description` | If applicable | CSS custom properties the consumer can override |

---

## Attribute Types

| Type string | When to use |
|-------------|-------------|
| `{string}` | Free-form text value |
| `{boolean}` | Presence-based attribute (presence = `true`) |
| `{number}` | Numeric string value |
| `{enum}` | Fixed set of string values — list them in the description: `value1 \| value2` |
| `{json}` | JSON-serialised value (complex objects / arrays) |

---

## Attribute Naming Rules

| Attribute type | Convention | Example |
|----------------|------------|---------|
| Native HTML attributes | **Bare** (no prefix) | `disabled`, `required`, `name`, `value`, `checked` |
| Component-specific text/enum/number | `data-` prefix | `data-label`, `data-variant`, `data-size` |
| Component-specific boolean flags | `data-` prefix | `data-dismissible`, `data-searchable` |
| ARIA attributes | **Bare** | `aria-label`, `aria-expanded` |

---

## Event Documentation Format

```js
/**
 * @fires component-action — Fired when the user performs the action.
 *   bubbles: true, composed: true
 *   detail: { value: string, index: number }
 */
```

All custom events **must** declare `bubbles: true, composed: true`. Events that don't cross shadow boundaries are the exception and must be explicitly noted.

Naming convention: `{element-tag-without-prefix}-{action}` — e.g. `button-click`, `nav-item-click`, `dialog-close`.

---

## Valid @category Values

| Value | Role |
|-------|------|
| `shell` | Top-level page shells, app frames |
| `nav` | Navigation components |
| `container` | Layout containers, panels, dialogs |
| `overlay` | Floating overlays, tooltips, popovers |
| `content` | Content-level layout (tabs, toolbars, lists) |
| `control` | Interactive controls (buttons, toggles) |
| `input` | Form input components |
| `display` | Read-only display (metrics, charts, tags, badges) |
| `feedback` | Status and feedback (callout, message, loader, empty state, toast) |
| `media` | Rich media (image, video, code block) |
| `data` | Data-heavy components (grid, chart, key-value list) |

---

## CSS Custom Properties (`@cssprop`)

Only document CSS properties that are **intentionally exposed** for consumer theming. Do not document `--_*` private properties.

```js
/**
 * @cssprop --sherpa-button-min-width — Minimum button width (default: unset)
 * @cssprop --sherpa-button-gap       — Gap between icon and label (default: 8px)
 */
```
