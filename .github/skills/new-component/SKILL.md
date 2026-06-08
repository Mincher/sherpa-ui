---
name: new-component
description: 'Create a new Sherpa UI web component from scratch using the 3-layer template. Use when: building a new custom component; scaffolding sherpa-*.html + sherpa-*.css + sherpa-*.js; writing the JSDoc API header; applying the Template Completeness Rule; using correct CSS section order with section banners; extending SherpaElement with all lifecycle hooks; choosing the correct @category value; running npm run schemas to generate the component schema.'
---

# New Component

## When to Use
- Building a net-new web component in the Sherpa system
- Scaffolding the 3-file structure for a new component
- Understanding the HTML / CSS / JS authoring rules

---

## The Prime Directive — use the system, don't invent

> **Sherpa components MUST be built exclusively from Sherpa design tokens, Sherpa CSS, and existing Sherpa components. Never invent styling.**

This rule overrides personal taste, convenience, and "I'll just hardcode it for now". If the system doesn't provide what you need, **stop and ask** — don't paper over the gap with a literal value, a one-off colour, or a re-implementation of an existing component.

### Forbidden without explicit instruction

- ❌ **Raw hex / rgb / hsl colours** anywhere — including fallbacks. Every colour is `var(--sherpa-…-default, <token-fallback>)`.
- ❌ **Hardcoded shadows** — use `var(--sherpa-shadow-*, …)` or `--shadow-*()` custom functions.
- ❌ **Hardcoded border-radius** — use `var(--sherpa-border-rounding-*, …)`.
- ❌ **Hardcoded font-family / font-size / font-weight / line-height** — use `--sherpa-fonts-context-*`, `--sherpa-fonts-scale-*`, `--sherpa-font-weight-*` (regular / medium / semibold / bold).
- ❌ **Off-grid spacing/sizing** — every padding / margin / gap / width / height must land on the 8px primary grid (4px sub-grid, 2px edge cases, 1px borders only). Allowed: 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64…
- ❌ **Re-implementing an existing component** — if `<sherpa-button>` exists, do not write a `<button class="my-fake-button">` with manual variant CSS. If `<sherpa-icon>` exists, do not drop a raw `<i class="fa-*">`. Compose, don't clone.
- ❌ **Inventing a "compact" / "small" / "muted" variant** because the design hints at one. Use the documented `data-size` / `data-variant` / `data-status` values that already exist.
- ❌ **Made-up gradients, transforms, animations, or custom easing** when not specified by the design.
- ❌ **Custom focus rings** — use `--focus-ring()`.

### Allowed literal values (narrowly scoped)

1. **Layout dimensions taken directly from the Figma source** (e.g. `width: 280px` for a calendar column) — must be on the 8/4/2px grid, and ideally annotated with a comment citing the Figma value.
2. **Token fallbacks** inside `var(--sherpa-*, <fallback>)` — the fallback is the documented token value, not a guess.
3. **Unitless ratios** like `aspect-ratio: 1`, `line-height: 1`, `flex-shrink: 0`.

### Decision flow when you reach for a literal

1. Is there a Sherpa token for this? → use it (with fallback).
2. Is there an existing Sherpa component for this? → nest it.
3. Is the design source explicit about this exact pixel value? → use the literal, snap to grid, leave a comment. *When working from Figma, step 3 is satisfied if the value appears in `figma_get_component_for_development` output. Apply the snapping rules from the [Figma-driven authoring workflow](#figma-driven-authoring-workflow) section before writing the literal.*
4. Otherwise → **stop and ask the user** before inventing anything.

If the system genuinely lacks something the design needs, surface that gap explicitly: *"The design calls for X but there is no Sherpa token / component for it — should I add one, or use the closest match Y?"*

---

## The 3 Files

Every Sherpa component is exactly 3 files in a `components/sherpa-{name}/` folder:

| File | Layer | Owns |
|------|-------|------|
| `sherpa-{name}.html` | Structure | Shadow DOM templates, slots, semantics |
| `sherpa-{name}.css` | Presentation | All styling — states, variants, visibility, motion |
| `sherpa-{name}.js` | Behaviour | Lifecycle, data, events, attribute coordination |

---

## Quick Start

1. Create: `components/sherpa-{name}/`
2. Copy the 3 starters from this skill's `assets/` folder
3. Rename files and replace every `example` / `Example` occurrence
4. Study a similar component: `get_component_source({ component: "sherpa-button" })` — if this returns an error or empty result, notify the user and proceed using only the patterns documented in this skill. Do not infer the missing component's API from its name or general web component conventions.
5. After updating JSDoc: run `npm run schemas`

---

## The Golden Rule

> **Can this be done in HTML or CSS before writing JS? If yes, do it there. JS is the last resort.**

| Layer | Owns | Examples |
|-------|------|---------|
| HTML | Structure, semantics, accessibility, slots | `<template>`, `<slot>`, `role`, `aria-*` |
| CSS | **All** presentation — visibility, states, variants, transitions | `:host([data-*])`, `:has()`, `@container` |
| JS | Data, lifecycle, custom events, attribute coordination | `onRender()`, `dataset.*`, `#emit()` |

**Never in JS:**
- `element.style.display = 'flex'` → use a CSS attribute selector instead
- `element.hidden = true` on shadow internals → use CSS `.class { display: none }` + `:host([data-x]) .class { display: ... }`
- `element.classList.toggle('active')` for visual state → use `dataset.*`
- `document.createElement()` for templatable structure → put it in the HTML template

---

## Template Completeness Rule

> Every element the component will **ever** show lives in the HTML template **from the start**. CSS hides optional elements — JS never creates new DOM nodes for presentational structure.

```html
<template id="default">
  <div class="wrapper">
    <!-- Optional icon: hidden by default, shown via :host([data-icon-start]) in CSS -->
    <i class="icon-start" aria-hidden="true"></i>
    <!-- Always present -->
    <span class="label"></span>
    <!-- Optional: hidden by default, shown via :host([data-description]) in CSS -->
    <span class="description"></span>
    <slot></slot>
    <slot name="actions"></slot>
  </div>
</template>
```

### Multi-Template Components

```html
<template id="default">…</template>
<template id="compact">…</template>
```

In JS, override `get templateId()` to return the right id:
```js
get templateId() {
  return this.dataset.type === 'compact' ? 'compact' : 'default';
}
```

### Data-Driven Repeats (Cloning Prototypes)

Use `class` (NOT `id`) on repeating templates so the multi-template parser ignores them:

```html
<div class="list" role="list"></div>

<template class="item-tpl">
  <div class="item" role="listitem">
    <span class="item-label"></span>
  </div>
</template>
```

```js
const frag = this.$('template.item-tpl').content.cloneNode(true);
frag.querySelector('.item-label').textContent = item.label;
this.$('.list').appendChild(frag);
```

---

## CSS Section Order

9 sections — always in this order, always with these exact banner comments:

```css
/* ── Host base ──────────────────────────────────────────────────── */
/* ── Internal elements ──────────────────────────────────────────── */
/* ── Compound host visibility toggles ───────────────────────────── */
/* ── Variants ───────────────────────────────────────────────────── */
/* ── Sizes ──────────────────────────────────────────────────────── */
/* ── Status ─────────────────────────────────────────────────────── */
/* ── Interaction states ─────────────────────────────────────────── */
/* ── Container queries ──────────────────────────────────────────── */
/* ── Motion / forced-colors / print ─────────────────────────────── */
```

Key CSS rules:
- Always include `:host([hidden]) { display: none; }` in Host base
- Functional pseudo selector form only: `:host(:not([data-x]))` — chained form `:host:not([data-x])` breaks in shadow DOM
- Hide by default, reveal via attribute: `.icon { display: none; }` + `:host([data-icon]) .icon { display: inline-flex; }`
- Disabled styling: use inactive tokens per property — **never** `opacity`
- All spacing/sizing values: `var(--sherpa-space-*, fallback)` — no raw literals except fallbacks

---

## JS Base Class Pattern

> **Note:** The code example below omits the JSDoc block for brevity. In the actual file, the JSDoc block precedes the `import` line — see the [JSDoc Header Format](#jsdoc-header-format) section.

```js
import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaName extends SherpaElement {
  static get cssUrl()  { return new URL('./sherpa-name.css',  import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-name.html', import.meta.url).href; }

  static get observedAttributes() {
    // Always spread super — inherits data-status, aria attrs, etc.
    return [...super.observedAttributes, 'data-label', 'data-variant'];
  }

  /* ── Private refs ─────────────────────────────────────────────── */
  #labelEl = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */
  onRender() {
    // Shadow DOM is populated. Cache element refs, set defaults, wire listeners.
    this.#labelEl = this.$('.label');
    if (!this.dataset.variant) this.dataset.variant = 'primary';
    this.#syncLabel();
  }

  onConnect() {
    // Runs once after first render. Use for DOM-presence-dependent setup.
  }

  onDisconnect() {
    // Clean up: remove external listeners, disconnect observers, clear timers.
  }

  onAttributeChanged(name, oldValue, newValue) {
    super.onAttributeChanged(name, oldValue, newValue);
    // When newValue is null, the attribute was removed — restore the property to its default value.
    // #syncLabel uses `?? ''` so it handles null safely; apply the same null-safe pattern to all attribute handlers.
    if (name === 'data-label') this.#syncLabel();
  }

  onStatusChanged(status) {
    // Called when data-status changes. Override to react to status changes.
  }

  /* ── Private ──────────────────────────────────────────────────── */
  #syncLabel() {
    if (this.#labelEl) this.#labelEl.textContent = this.dataset.label ?? '';
  }

  #emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }
}

customElements.define('sherpa-name', SherpaName);
```

**`this.$(selector)`** — shadow-root–scoped `querySelector`. Available from `SherpaElement`.
**`this.$$(selector)`** — shadow-root–scoped `querySelectorAll`.

---

## JSDoc Header Format

The JSDoc block goes first in the `.js` file, **before imports**. Tag order is strict:

```js
/**
 * sherpa-name.js
 * SherpaName — One-line description of what this component does.
 *
 * @element sherpa-name
 * @category control
 *
 * @attr {string}  data-label    — Visible label text
 * @attr {enum}    data-variant  — primary | secondary | tertiary
 * @attr {boolean} disabled      — Native disabled state
 *
 * @slot                         — Default slotted content
 * @slot actions                 — Action buttons (trailing)
 *
 * @fires name-click             — Fired when the component is activated
 *   bubbles: true, composed: true
 *   detail: { }
 *
 * @method show()                — Programmatically show the component
 *   @returns {void}
 *
 * @prop {string} value          — Current value (read/write)
 *
 * @csspart wrapper              — Main wrapper element
 *
 * @cssprop --sherpa-name-gap    — Gap between items (default: 8px)
 */
```

### Valid `@category` Values

`shell` | `nav` | `container` | `overlay` | `content` | `control` | `input` | `display` | `feedback` | `media` | `data`

---

## After Authoring

1. Add `export { SherpaName } from './sherpa-name/sherpa-name.js';` to `components/index.js`
2. Run `npm run schemas` to generate `schemas/components/sherpa-name.json`
3. Audit your demo HTML: `validate_usage({ component: "sherpa-name" })`

See [references/component-api-standard.md](./references/component-api-standard.md) for the full JSDoc tag reference and attribute type table.

---

## Composing nested Sherpa components

Web components compose. Inside one component's template, prefer nesting existing `sherpa-*` elements over re-implementing their visuals or behaviour.

### When to nest

- **Footer / action buttons** → `<sherpa-button>` (not raw `<button>` + manual variant styling)
- **Iconography (chevrons, status, action icons)** → `<sherpa-icon>` (not raw `<i class="fa-*">`)
- **Form fields inside composite controls** → `<sherpa-input-text>`, `<sherpa-input-select>`, etc.
- **Popover / dialog overlays** → `<sherpa-container-overlay>`, `<sherpa-dialog>` (don't re-implement positioning)

### When NOT to nest

- When you need a **unified, contiguously-bordered visual control** (e.g. a calendar header where prev / month-label / next share a single bordered pill). Three `<sherpa-button>`s here can't share a border. Use plain `<button>` elements with custom CSS inside that one bounded box. **This is the sole exception to the Prime Directive's no-plain-button rule** — it applies only when the visual requirement (a physically shared border or outline) makes separate `<sherpa-button>` instances impossible. If the design does not mandate a shared border, use `<sherpa-button>` per the Prime Directive.
- When nesting a Sherpa component would require more than 5 attribute bindings to replicate 1–3 CSS properties that are already constrained by the parent's design token context, a plain HTML element is acceptable. Document why in a comment.

### Listening for events from nested Sherpa components

`<sherpa-button>` fires `button-click` (not native `click`). Other Sherpa elements fire their own composed CustomEvents — check the source's JSDoc. These events are `composed: true`, so they cross the nested element's shadow boundary and bubble inside your own shadow root. `this.$('.btn-apply').addEventListener('button-click', …)` works exactly as you'd expect.

```js
// ✓ Correct
this.$('.btn-apply').addEventListener('button-click', () => this.#submit());

// ✗ Wrong — sherpa-button does NOT re-fire native 'click' as a public event
this.$('.btn-apply').addEventListener('click', () => this.#submit());
```

### Composition primitive cheat sheet

**`<sherpa-button>`** — most common nested control
- `data-variant`: `primary` | `secondary` | `tertiary`
- `data-size`: `small` | `base` | `large` | …
- `data-label`, `data-icon-start`, `data-icon-end`, `data-type`
- Fires: `button-click`

**`<sherpa-icon>`** — replaces all raw FontAwesome usage in component internals
- `name`: FA short name, e.g. `chevron-left`, `chevron-right`, `chevron-up`, `chevron-down`, `plus`, `xmark`
- `data-size`: `3xs` | `2xs` | `xs` | `sm` | `md` | `lg` | `xl` | `2xl` | `3xl` | `4xl` | `5xl` | `6xl`
- `data-weight`: `solid` | `regular` | `light`

If unsure of a Sherpa element's public API, read its JSDoc header (`get_component_source({ component: "sherpa-foo" })`) — that's the contract.

### Shared utilities (the 4th file exception)

The 3-file rule is per-component. Cross-component logic lives under `components/utilities/`. Example: `components/utilities/calendar-helper.js` exports `MONTH_NAMES`, `isoToDate`, `dateToIso`, `formatDateDisplay`, `renderCalendarGrid(container, tpl, viewDate, selectedIso, …)`. Reuse helpers like this; do not duplicate calendar-grid logic across components.

---

## Figma-driven authoring workflow

When the design source is Figma, drive sizing/spacing from the **actual extracted values**, then snap to the 8px grid (4px sub-grid; 2px edge-only; 1px borders).

1. **Visual reference**: `figma_get_component_image` (or `figma_capture_screenshot` on a frame) → save to `/tmp/<name>.png` and view it to understand the design intent.
2. **Numeric reference**: `figma_get_component_for_development` → JSON. Parse with `jq` to pull exact dimensions, e.g.:
   ```sh
   jq '.. | objects | select(.name == "Spinner") | {w:.absoluteBoundingBox.width, h:.absoluteBoundingBox.height, pad:.paddingLeft, gap:.itemSpacing}' content.json
   ```
3. **Snap to the grid**: any extracted value that's not in `{1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, …}` must be rounded to the nearest allowed value. Document the snap in a comment when it's non-obvious:
   ```css
   /* Figma: 241 → snap to 240 (8px grid) */
   width: 240px;
   ```
4. **Resolve to tokens**: prefer `var(--sherpa-space-*, <px-fallback>)`. Verify the token's underlying value (`2xs`=4, `xs`=8, `sm`=12, `default/md`=16) before using it — a token with the wrong underlying number is worse than a literal.

---

## Avoiding common authoring pitfalls

These are mistakes that have actually happened. Don't repeat them.

### Don't author source files via shell heredocs

Writing JS through `python3 -c "open('f.js','w').write('…')"` or `cat <<EOF` in zsh will silently mangle:
- `$(selector)` → interpreted as command substitution and stripped
- `${var}` → expanded
- Backticks → command substitution
- Backslash escapes inside template literals

**Always use the `create_file` tool** for new source files. For edits to existing files, use `replace_string_in_file`.

### `create_file` fails if the file exists

`create_file` is create-only. If a file already exists and you want to start over:
1. Delete first (`rm path/to/file.js` in a terminal — only when safe and intended), **then** `create_file`, or
2. Use `replace_string_in_file` to edit in place.

### Verify single `customElements.define` after edits

A partial `replace_string_in_file` match can leave the file with a duplicated class body and **two** `customElements.define` calls — the second one throws at runtime. After any non-trivial JS edit:

```sh
grep -c "customElements.define" components/sherpa-name/sherpa-name.js
# Must print exactly: 1
```

### Demo HTML must load FontAwesome

`<sherpa-icon>` resolves names like `chevron-left` to FontAwesome classes (`fa-chevron-left`). The demo page must include the FA stylesheet or all nested icons render as empty boxes:

```html
<link rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
      crossorigin="anonymous" referrerpolicy="no-referrer">
```

### Visually verify before declaring done

After authoring or editing, render the component in a browser (the demo file, or `python3 -m http.server` from the repo root) and screenshot it. Compare side-by-side with the Figma image. Common issues that only show up visually:
- Nested `<sherpa-icon>` rendering blank (missing FA stylesheet)
- Host stretching unexpectedly inside a `grid: 1fr` parent (set explicit child widths)
- Selected/active states using fill where the design wants outline-only
- Spinner / stepper layouts using stacked-vertical instead of value-left/chevrons-right

