# Copilot Instructions — Sherpa UI Component Library

> **The single source of truth for agent guidance in this repository.**
> Read before writing or modifying any component code.

---

## 1 Philosophy

This component system follows a **progressive enhancement** approach: do as much
as possible with **HTML first**, then **CSS**, and only reach for **JavaScript**
when the first two cannot solve the problem.

- **HTML** owns structure, semantics, accessibility and content. Templates declare what exists.
- **CSS** owns all presentation — styling, states, variants, conditional display, responsiveness, transitions. CSS is the primary state engine.
- **JavaScript** owns data, lifecycle events, custom events and dynamic behaviour that HTML and CSS cannot express.
- **`data-*` attributes** are the bridge between all three layers — HTML declares them, CSS selects on them, JS reads/writes them.

### The Golden Rule

> _Can this be done in HTML or CSS before I write JS?_
>
> If the answer is **yes**, do it in HTML or CSS. JavaScript is the **last resort**.

### Responsibility Layers

Every component is split across three files. Each file owns **exactly one concern**.

| Layer    | File            | Owns                                                                                                            | Examples                                                   |
| -------- | --------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **HTML** | `sherpa-*.html` | Structure, semantics, accessibility, content projection                                                         | `<template>`, `<slot>`, `<dl>/<dt>/<dd>`, `role`, `aria-*` |
| **CSS**  | `sherpa-*.css`  | All presentation — styling, state visuals, conditional visibility, variants, sizes, responsiveness, transitions | `:host([data-*])`, `@container`, `:has()`, `[hidden]`      |
| **JS**   | `sherpa-*.js`   | Data, lifecycle, events, attribute coordination                                                                 | `onRender()`, `onConnect()`, `CustomEvent`, `dataset.*`    |

### Transport-Agnostic Templates

Components load their templates via `fetch()` and inject standard HTML. There is
no proprietary templating syntax, no JSX, no virtual DOM. Templates are plain
`.html` files containing standard elements, `<slot>` and `<template>` blocks.

This means the architecture scales to SSR, templating engines (Handlebars,
Jinja, Razor, Liquid), edge rendering, and static site generators — the
component contract is _"give me valid HTML with the right `data-*` attributes."_

---

## 2 Data Attributes

`data-*` attributes are the public API surface of every component.

### Naming Conventions

| Attribute          | Purpose                         | Example                                                   |
| ------------------ | ------------------------------- | --------------------------------------------------------- |
| `data-variant`     | Visual variant                  | `"primary"`, `"secondary"`, `"tertiary"`                  |
| `data-size`        | Size preset                     | `"small"`, `"medium"`, `"large"`                          |
| `data-status`      | Status colour scheme            | `"critical"`, `"warning"`, `"success"`, `"info"`, `"urgent"` |
| `data-type`        | Component sub-type              | `"icon"` (icon-only button)                               |
| `data-layout`      | Layout mode                     | `"horizontal"`, `"vertical"`, `"inline"`                  |
| `data-active`      | Active/pressed state            | `"true"` / `"false"`                                      |
| `data-elevation`   | Shadow level                    | `"none"`, `"sm"`, `"md"`, `"lg"`                          |
| `data-selected`    | Selection state                 | `"true"` / `"false"`                                      |
| `data-icon-start`  | Leading icon class              | `"fa-solid fa-plus"`                                      |
| `data-icon-end`    | Trailing icon class             | `"fa-solid fa-chevron-down"`                              |
| `data-label`       | Text label                      | `"First name"`                                            |
| `data-description` | Helper description text         | `"As shown on your ID"`                                   |
| `data-helper`      | Instructional hint              | `"Must be at least 8 characters"`                         |

### Bare vs `data-*`

Native HTML attributes stay un-prefixed: `disabled`, `checked`, `hidden`,
`readonly`, `required`, `open`, `name`, `value`, `placeholder`, `min`, `max`,
`step`. They carry built-in browser behaviour and accessibility semantics.

> **Rule of thumb:** if the browser already understands the attribute, keep it
> bare. If it is component-specific presentation or configuration, prefix with
> `data-`.

---

## 3 HTML Templates

### Structure

- Every `.html` file wraps content in `<template id="default">` — even single-template components.
- Multi-variant components use additional `<template id="...">` blocks.
- Data-driven repeats use **cloning prototypes**: `<template class="...-tpl">` (no `id`).
- Templates are **logic-free** — no conditionals, loops, or expressions.
- Use semantic elements: `<dl>/<dt>/<dd>`, `<details>/<summary>`, `<header>/<footer>/<nav>`.
- Use `<slot>` for consumer content injection; named slots (`<slot name="actions">`) for positioned content.
- Use `part="name"` on elements consumers may need to style externally via `::part()`.

### Template Completeness Rule

> Every element the component will ever show **must exist in the HTML template
> from the start**. JS must never create structural DOM with `createElement()`
> or `innerHTML` for elements that could live in the template.

If an element is conditionally visible, it lives in the template with appropriate
attributes and CSS hides/shows it (see §4).

### Multi-Template Example

```html
<!-- Button — text variant -->
<template id="default">
  <i class="sherpa-icon icon-start" aria-hidden="true"></i>
  <span class="label"><slot>Button</slot></span>
  <i class="sherpa-icon icon-end" aria-hidden="true"></i>
</template>

<!-- Button — icon-only variant -->
<template id="icon">
  <i class="sherpa-icon" aria-hidden="true"></i>
</template>
```

JS picks the active template via the `templateId` getter:

```js
get templateId() {
  return this.dataset.type === 'icon' ? 'icon' : 'default';
}
```

### Cloning Prototypes (data-driven repeats)

Components whose DOM is populated from data (stepper steps, list items) use
`<template>` elements **without `id`** as cloning shapes:

```html
<div class="stepper-container" role="navigation">
  <div class="stepper-header" role="tablist"></div>
</div>

<template class="step-item-tpl">
  <div class="step-item" role="tab">
    <div class="step-indicator"></div>
    <span class="step-label text-label"></span>
  </div>
</template>
```

```js
const itemTpl = this.$("template.step-item-tpl");
const frag = itemTpl.content.cloneNode(true);
header.appendChild(frag);
```

> **Key rule:** cloning prototypes use `class` (not `id`) so SherpaElement's
> multi-template parser (which looks for `template[id]`) ignores them.

---

## 4 CSS Patterns

### `:host` base

Every component starts with `:host` declaring display, fonts, colours, box model.
Always include `:host([hidden]) { display: none; }`.

```css
:host {
  display: inline-flex;
  align-items: center;
  gap: var(--sherpa-space-xs, 8px);
  height: var(--sherpa-size-2xl, 32px);
  padding-inline: var(--sherpa-space-sm, 12px);
  font: var(--sherpa-text-body-md);
  color: var(--sherpa-text-default-body);
}
:host([hidden]) { display: none; }
```

### Visibility — hide by default, show via attribute

> **CSS owns all show/hide logic.** JS sets `data-*` attributes on the host;
> CSS selectors determine which internal elements are visible.

```css
.close-button { display: none; }
:host([data-close-button]) .close-button { display: inline-flex; }
```

```js
/* ❌ NEVER toggle .hidden on shadow DOM internals */
this.$(".close-button").hidden = shouldShow;

/* ✅ Set the attribute; CSS handles visibility */
this.toggleAttribute("data-close-button", shouldShow);
```

The native `hidden` attribute is acceptable **only** on `:host` itself
(`:host([hidden]) { display: none; }`), never on internal shadow DOM elements.

### Variant, size, and state selectors

```css
:host([data-variant="secondary"]) { background: var(--sherpa-surface-control-secondary-default); }
:host([data-size="small"])        { height: var(--sherpa-size-xl, 28px); }
:host([data-icon-start])          .icon-start { display: inline-flex; }
:host(:not([data-label]))         .label      { display: none; }
:host(:hover)                     { background: var(--sherpa-surface-control-primary-hover); }
:host(:focus-visible)             { outline: 2px solid var(--sherpa-border-focus-default); }
:host([data-active="true"])       { background: var(--sherpa-surface-control-primary-active); }
```

### Container queries

Declare `container` on `:host` and use `@container` for responsive layout. Container
queries cross shadow DOM boundaries, so they're ideal for size-driven layout state.

```css
:host { container: sherpa-card / inline-size; }

@container sherpa-card (max-width: 200px) {
  .description { display: none; }
}
```

### Disabled styling

**Never use `opacity`** for disabled — it compounds in dark mode and makes text
illegible. Use inactive tokens on individual properties:

```css
:host([disabled]) {
  cursor: not-allowed;
  pointer-events: none;
  color: var(--sherpa-text-inactive-default);
  background: var(--sherpa-surface-control-inactive-default);
  border-color: var(--sherpa-border-inactive-default);
}
```

### Shadow DOM selector form

Inside shadow DOM, `:host` compound selectors **must** use the functional form:

```css
/* ✅ Functional form */
:host(:not([data-pinned="true"])) { width: 48px; }
:host(:is([data-pinned="true"], [data-mode="edit"])) { width: 320px; }

/* ❌ Chained form — does NOT work in shadow DOM */
:host:not([data-pinned="true"]) { width: 48px; }
```

CSS nesting with `&` inside `:host {}` desugars to the chained (broken) form.
Put compound host selectors as standalone rules.

### Private custom properties with fallbacks

Use `--_` prefix for internal variables; consume with fallback chains so that
optional features (status, control groups) activate only when set:

```css
:host {
  background: var(--_status-surface-strong, var(--sherpa-surface-control-primary-default));
  color:      var(--_status-text-on-color,  var(--sherpa-text-default-on-color-body));
  border-radius: var(--_cg-border-radius,   var(--sherpa-border-rounding-base, 4px));
}
```

### Control group pattern

Components that can be grouped (buttons, inputs, filter chips) read two
inherited custom properties set by a `.grouped-component` wrapper:

```css
/* Inside the component */
:host {
  border-width:  var(--_cg-border-width,  var(--sherpa-border-width-xs, 1px));
  border-radius: var(--_cg-border-radius, var(--sherpa-border-rounding-base, 4px));
}

/* External wrapper */
.grouped-component {
  --_cg-border-width: 0;
  --_cg-border-radius: 0;
  display: inline-flex;
  border: var(--sherpa-border-width-xs) solid var(--sherpa-border-container-default);
  border-radius: var(--sherpa-border-rounding-base);
  overflow: hidden;
}
```

---

## 5 Token Architecture

Design tokens follow a 3-tier model. **Always consume semantic tokens with
hardcoded fallbacks.**

| Tier              | Prefix            | Source                                           | Example                                           |
| ----------------- | ----------------- | ------------------------------------------------ | ------------------------------------------------- |
| Core primitives   | `--sherpa-core-*` | `tokens/sherpa-primitives.css`                   | `--sherpa-core-colors-slate-600`                  |
| Semantic aliases  | `--sherpa-*`      | `tokens/sherpa-alias.css`, `sherpa-theme-*.css`  | `--sherpa-text-default-body`, `--sherpa-space-sm` |
| Component private | `--_*`            | Component CSS                                    | `--_status-surface`, `--_cg-border-radius`        |

### Rules

- **Never reference core tokens directly** in component CSS. Always use a semantic alias.
- **Always provide a hardcoded fallback** for semantic tokens: `var(--sherpa-space-sm, 12px)`.
- **Private vars (`--_*`) are internal** — never in any public API.
- **Composite shadow tokens** (`--sherpa-shadow-default-sm`, etc.) replace inline elevation chains.

### Cascade Layers (load order)

`css/styles/index.css` declares the cascade order:

```
reset → primitives → alias → platform → theme → density → status → components → utilities
```

### Theme Loading

All themes (base + extended) are bundled in `sherpa-themes.css`, always imported by
`css/styles/index.css`. The base theme (`apex-2-core`) requires no attribute. Extended
themes (`apex-2-purple/teal/blue/classic`) emit **diffs only** against the base via
`:where(:root[data-theme="<slug>"])`.

To activate an extended theme:

1. Set `<html data-theme="<slug>">` — no additional `<link>` needed, all themes are in `index.css`.

`ThemeManager` (`components/utilities/theme-manager.js`) handles this: it
sets the attribute and persists to `localStorage`. JS should
only ever **set attributes** — never inline styles.

### Mode (light / dark / hc)

Each theme file declares its light values plus nested `data-mode` / `prefers-*`
override blocks. There is **no `light-dark()`** in component CSS.

Set `<html data-mode="auto|light|dark|hc">` (default `auto`). Auto honours both
`prefers-color-scheme` and `prefers-contrast`.

### Density

Two density files (`sherpa-density-compact.css`, `sherpa-density-comfortable.css`)
are always loaded; they activate when `[data-density="compact|comfortable"]` is
set on any subtree.

---

## 6 Status System

`[data-status]` selectors define `--_status-*` custom properties on the host.
Because CSS custom properties inherit through shadow DOM, components consume
them directly via fallback chains — no per-component status blocks needed.

```css
/* sherpa-status.css (global) */
[data-status="critical"] {
  --_status-surface:        var(--sherpa-surface-context-error-subtle-default);
  --_status-surface-strong: var(--sherpa-surface-context-error-strong-default);
  --_status-border:         var(--sherpa-border-context-error-default);
  --_status-text:           var(--sherpa-text-context-error-default);
  --_status-text-on-color:  var(--sherpa-text-context-error-on-color);
  --_status-icon:           var(--sherpa-icon-context-error-default);
}

/* In a component */
:host {
  background: var(--_status-surface-strong, var(--sherpa-surface-control-primary-default));
  color:      var(--_status-text-on-color,  var(--sherpa-text-default-on-color-body));
}
```

### Available `--_status-*` variables

| Variable                   | Description                         |
| -------------------------- | ----------------------------------- |
| `--_status-surface`        | Subtle surface (default/hover/down) |
| `--_status-surface-strong` | Strong surface (default/hover/down) |
| `--_status-border`         | Border colour                       |
| `--_status-text`           | Text colour                         |
| `--_status-text-on-color`  | Text on strong surface              |
| `--_status-icon`           | Icon colour                         |

Components only consume the subset they need.

---

## 7 JavaScript Patterns

### Base class

Every shadow DOM component extends `SherpaElement`:

```js
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaTag extends SherpaElement {
  static get cssUrl()  { return new URL("./sherpa-tag.css",  import.meta.url).href; }
  static get htmlUrl() { return new URL("./sherpa-tag.html", import.meta.url).href; }

  onRender() { /* shadow DOM populated — wire up initial state */ }
}
customElements.define("sherpa-tag", SherpaTag);
```

### Lifecycle hooks

| Hook                                 | When                              | Use for                                                   |
| ------------------------------------ | --------------------------------- | --------------------------------------------------------- |
| `onRender()`                         | Shadow DOM populated, before slots | Cache refs (`this.$(...)`), set defaults, register host listeners |
| `onConnect()`                        | Once, after first render          | One-time setup needing DOM presence                       |
| `onDisconnect()`                     | Element removed from DOM          | Clean up timers, observers, external listeners            |
| `onAttributeChanged(name, old, new)` | Observed attribute changes        | Dispatch to `#sync*()` methods — set attrs/text, never visibility |
| `onStatusChanged(new, old)`          | `data-status` changes             | Status-specific icon or ARIA updates                      |
| `onSlotChange(slotEl)`               | Slotted content changes           | Override `super.onSlotChange()` for custom slot logic     |

### Observed attributes

Always spread `super` to inherit base observations:

```js
static get observedAttributes() {
  return [...super.observedAttributes, 'data-variant', 'data-size'];
}
```

### Shadow root queries

Use built-in helpers — never `this.shadowRoot.querySelector`:

```js
this.$('.label');     // querySelector
this.$$('.nav-item'); // querySelectorAll
```

### Event dispatching

Always `bubbles: true`. Add `composed: true` if the event must cross shadow
boundaries to reach application code:

```js
#emit(name, detail = {}) {
  this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
}
this.#emit('navitemclick', { itemId, route, label });
```

### Click delegation

For components with many interactive children, use a single host-level handler
with `composedPath()`:

```js
onRender() {
  this.addEventListener('click', (e) => this.#onHostClick(e));
}
#onHostClick(e) {
  const target = e.composedPath().find(
    n => n instanceof HTMLElement && n.tagName === 'SHERPA-NAV-ITEM'
  );
  if (!target) return;
  // Handle based on target's data attributes
}
```

### Setting defaults

Set default attribute values in `onRender()` so CSS selectors activate immediately:

```js
onRender() {
  if (!this.dataset.variant) this.dataset.variant = 'primary';
  if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
  if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
}
```

### Dynamic URL-based content

Components that load content from URLs at runtime use `renderFromUrl(url)`:

```js
async onConnect() {
  const url = this.dataset.src || this.#defaultUrl;
  await this.renderFromUrl(url);
}
onAttributeChanged(name, _old, newValue) {
  if (name === 'data-src' && newValue && this.#ready) {
    this.renderFromUrl(newValue);
  }
}
```

`renderFromUrl(url)` fetches HTML, preserves `<link>`/`<style>` from initial
bootstrap, replaces remaining shadow DOM, then re-runs `onRender()` and
re-wires slots. Set `htmlUrl` to `null` for components using this pattern.

### Awaiting render

External code can wait for a component to be ready:

```js
await myButton.rendered;
```

---

## 9 Slot Guidelines

- Slots are for **consumer content injection only** — not structural scaffolding.
- Named slots (`<slot name="actions">`) allow positioned content projection.
- `SherpaElement` auto-detects slot content and sets `data-has-{name}` on the host.
- CSS shows/hides wrapper elements: `:host([data-has-actions]) .actions-wrapper { display: flex; }`.

---

## 10 File Header Convention

Every `.css` and `.js` file starts with a JSDoc block following the canonical
format defined in [`docs/COMPONENT-API-STANDARD.md`](../docs/COMPONENT-API-STANDARD.md).

**JS files** use `@element`, `@attr`, `@slot`, `@fires`, `@method`, `@prop`,
`@csspart`, `@cssprop` tags in that order. Every `@attr` must include a type
(`{string}`, `{boolean}`, `{enum}`, `{number}`, `{json}`). Every `@fires` must
document `bubbles`, `composed`, and `detail` on indented follow-up lines.

**CSS files** document host attributes consumed in selectors with `{type}`
annotations (e.g., `data-variant {enum} — primary | secondary`) and note which
`--_status-*` variables the component consumes.

---

## 11 Anti-Patterns — Hard Rules

| ❌ Never                                                  | ✅ Instead                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| `element.hidden = bool` on shadow DOM internals           | CSS `:host([data-*]) .element { display: ... }`            |
| `element.style.display = '...'`                           | CSS attribute selectors                                    |
| `document.createElement()` for template-able structure    | Put the element in the HTML template                       |
| `element.innerHTML = '<markup>'` for structural DOM       | HTML template + cloning prototypes for repeats             |
| `element.classList.add/remove/toggle` for visual state    | `data-*` attributes + CSS `:host([data-*])`                |
| `opacity: 0.5` for disabled                               | Inactive tokens per property                               |
| `:host:not(...)` (chained form)                           | `:host(:not(...))` (functional form)                       |
| Core tokens (`--sherpa-core-*`) in component CSS          | Semantic tokens (`--sherpa-*`) with hardcoded fallbacks    |
| Bare custom attributes (`loading`, `pinned`)              | `data-` prefix (`data-loading`, `data-pinned`)             |
| `@container style(--prop)` on self                        | `:host([attr])` attribute selectors                        |
| Cross-shadow-boundary CSS selectors               | Avoid — query from the light DOM if needed         |
| Global/singleton state managers                           | Custom events with `bubbles: true`                         |
| `light-dark()` in component CSS                           | Theme files declare per-mode blocks; components are mode-agnostic |
| Inline styles set from JS                                 | JS sets attributes; CSS owns presentation                  |

---

## 12 Exemplar Component: `sherpa-button`

**HTML** — static template with icon + label elements always present:

```html
<template id="default">
  <i class="icon-start" aria-hidden="true"></i>
  <span class="label"></span>
  <i class="icon-end" aria-hidden="true"></i>
</template>
```

**CSS** — icons hidden by default, shown via host attribute:

```css
.icon-start, .icon-end { display: none; }
:host([data-icon-start]) .icon-start { display: inline-flex; }
:host([data-icon-end])   .icon-end   { display: inline-flex; }
:host(:not([data-label])) .label     { display: none; }
```

**JS** — only sets text content and attribute defaults:

```js
onRender() {
  this.#labelEl = this.$('.label');
  this.#syncLabel();
}
#syncLabel() {
  if (this.#labelEl) this.#labelEl.textContent = this.dataset.label || '';
}
```

This pattern — **HTML declares structure, CSS controls visibility, JS manages
data** — is the canonical model for all components.

---

## 13 Flow Patterns (CRUD)

CRUD flows (Add, Edit, Delete) are **composed from existing components** — no
special flow component exists. Each flow follows a shared lifecycle model
orchestrated by **flow utility modules** in `components/utilities/`.

### Flow utilities

| Module           | Import path                                       | Purpose                                              |
| ---------------- | ------------------------------------------------- | ---------------------------------------------------- |
| `FlowManager`    | `sherpa-ui/components/utilities/flow-manager.js`  | Dialog lifecycle, flow events, toast feedback        |
| `FormManager`    | `sherpa-ui/components/utilities/form-manager.js`  | Read/write/clear/validate named form fields          |
| `refreshDataset` | `sherpa-ui/components/utilities/grid-refresh.js`  | Re-dispatch `datasetfiltered` after data mutations   |

### Lifecycle states

```
idle → started → in-progress → complete
                             → cancelled
                             → error
```

State is tracked by `FlowManager` in **JS memory** — not in DOM attributes.

### Flow events

Five custom events carry the flow through its lifecycle. All use
`bubbles: true, composed: true`. `FlowManager` dispatches them automatically.

| Event           | When                                   | `detail` shape                                      |
| --------------- | -------------------------------------- | --------------------------------------------------- |
| `flow-start`    | Trigger clicked, dialog about to open  | `{ flow: "add"\|"edit"\|"delete", entity: string }` |
| `flow-progress` | User submits (Save / Delete clicked)   | `{ flow, entity, data: object }`                    |
| `flow-complete` | API call succeeds                      | `{ flow, entity, data: object }`                    |
| `flow-cancel`   | User cancels                           | `{ flow, entity }`                                  |
| `flow-error`    | API call fails                         | `{ flow, entity, error: string }`                   |

### Composition

| Concern      | Component(s)                                      |
| ------------ | ------------------------------------------------- |
| Trigger      | `sherpa-button`                                   |
| Dialog       | `sherpa-dialog` (native `<dialog>`, `::backdrop`) |
| Form fields  | `sherpa-input-text`, `sherpa-input-select`, etc.  |
| Confirmation | `sherpa-callout` (warning variant for delete)     |
| Feedback     | `SherpaToast.success()` / `.critical()`           |

### HTML-First Rule

> The trigger, dialog, form fields, and action buttons all live in the HTML
> template. JS opens the dialog, dispatches events, and calls APIs — it never
> creates structural DOM for flows.

### Typical setup (Add/Edit)

```js
import { FlowManager } from 'sherpa-ui/components/utilities/flow-manager.js';
import { FormManager } from 'sherpa-ui/components/utilities/form-manager.js';
import { refreshDataset } from 'sherpa-ui/components/utilities/grid-refresh.js';

const dialog = document.getElementById('device-dialog');
const form = new FormManager(dialog);

const flow = new FlowManager({
  entity: 'device',
  contentArea,
  dialogs: { addEdit: dialog, delete: deleteDialog },
  async onSave(editingRecord, flowType) {
    const values = form.read();
    const missing = form.validate();
    if (missing.length) throw new Error('Please fill in all required fields.');
    return values;
  },
  async onDelete(ids) { return ids.length; },
  onRefresh: () => refreshDataset(contentArea, loader),
});

addBtn.addEventListener('button-click', () => { form.clear(); flow.startAdd(); });

grid.addEventListener('row-action', (e) => {
  form.populate(e.detail.rowData);
  flow.startEdit(e.detail.rowData);
});

deleteBtn.addEventListener('button-click', () => {
  const selected = grid.getSelectedRows() ?? [];
  flow.startDelete(selected, `Delete ${selected.length} device(s)?`);
});
```

### Backdrop

Dialogs use the **native `::backdrop`** pseudo-element (via `<dialog>.showModal()`).
No custom overlay elements or shim divs.

### Anti-patterns for flows

| ❌ Never                                          | ✅ Instead                                    |
| ------------------------------------------------- | --------------------------------------------- |
| Store flow state in DOM attributes                | Use `FlowManager` (state in JS memory)        |
| Create dialog elements dynamically                | Place dialog in template, toggle `data-open`  |
| Build custom backdrop overlays                    | Use native `::backdrop` via `showModal()`     |
| `window.confirm()` for delete confirmation        | Use `sherpa-dialog` + `sherpa-callout`        |
| Dispatch flow events without `composed: true`     | Always `{ bubbles: true, composed: true }`    |
| Manual `readForm()`/`populateForm()` per view     | Use `FormManager` — generic by `name` attr    |

### Pattern files

- `patterns/flows/add.html` — trigger + form dialog + toast docs
- `patterns/flows/edit.html` — trigger + pre-populated form dialog + toast docs
- `patterns/flows/delete.html` — trigger + confirmation dialog + toast docs

---

## 14 For Designers — Figma Mapping

| Figma Concept                                 | Code Equivalent                          |
| --------------------------------------------- | ---------------------------------------- |
| Component variant (Primary / Secondary)       | `data-variant="primary"` / `"secondary"` |
| Component property (Size = Small)             | `data-size="small"`                      |
| Boolean property (Active = true)              | `data-active="true"`                     |
| Status (Critical)                             | `data-status="critical"`                 |
| Design token (`space/sm`)                     | `--sherpa-space-sm` in CSS               |
| Colour token (`text/default/body`)            | `--sherpa-text-default-body`             |

When designing a new component state:

1. **Name the attribute** — `data-{descriptive-name}` with a clear set of allowed values.
2. **List the token changes** — which colour/spacing/typography tokens change per value.
3. **Note interaction states** — hover, active, focus, disabled.

This maps directly to CSS `:host([data-attribute="value"])` rules. No JS needed.

---

## 15 Quick Checklist

Before submitting any component change:

- [ ] Extends `SherpaElement` with `static cssUrl` / `static htmlUrl`
- [ ] All visual states handled in CSS via `:host([data-*])` selectors
- [ ] No `.hidden` toggling on shadow DOM internals
- [ ] No `createElement()` / `innerHTML` for structural DOM
- [ ] No `classList.add/remove/toggle` for visual states
- [ ] Events use `{ bubbles: true }` (add `composed: true` to cross shadow boundaries)
- [ ] Semantic tokens (`--sherpa-*`) with hardcoded fallbacks — never core tokens
- [ ] `:host(:not(...))` functional form used throughout — never `:host:not(...)`
- [ ] `:host([hidden]) { display: none; }` declared
- [ ] Template wrapped in `<template id="default">` (even single-template components)
- [ ] Cloning prototypes use `class` (not `id`)
- [ ] `observedAttributes` spreads `super.observedAttributes`
- [ ] Use `$()` / `$$()` for shadow root queries
- [ ] No `opacity` for disabled — inactive tokens per property
- [ ] No bare custom attributes — `data-` prefix for component-specific attrs
- [ ] No `light-dark()` in component CSS — themes own mode handling
- [ ] File header is a JSDoc block matching `docs/COMPONENT-API-STANDARD.md`
