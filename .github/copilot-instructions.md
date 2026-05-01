# Copilot Instructions — Sherpa UI Component Library

> These instructions apply to every code-generation and code-review task in this
> repository. Read them **before** writing or modifying any component code.

---

## 1 Responsibility Layers

Every component is split across three files (`.html`, `.css`, `.js`). Each file
owns exactly one concern. **Never move responsibility to a different layer.**

| Layer    | File            | Owns                                                                                                            | Examples                                                   |
| -------- | --------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **HTML** | `sherpa-*.html` | Structure, semantics, accessibility, content projection                                                         | `<template>`, `<slot>`, `<dl>/<dt>/<dd>`, `role`, `aria-*` |
| **CSS**  | `sherpa-*.css`  | All presentation — styling, state visuals, conditional visibility, variants, sizes, responsiveness, transitions | `:host([data-*])`, `@container`, `:has()`, `[hidden]`      |
| **JS**   | `sherpa-*.js`   | Data, lifecycle, events, attribute coordination                                                                 | `onRender()`, `onConnect()`, `CustomEvent`, `dataset.*`    |

### The Golden Rule

> _Can this be done in HTML or CSS before I write JS?_
>
> If the answer is **yes**, do it in HTML or CSS. JavaScript is the **last resort**.

---

## 2 HTML Templates

### Structure

- Every `.html` file wraps content in `<template id="default">`.
- Multi-variant components use additional `<template id="...">` blocks.
- Data-driven repeats use **cloning prototypes**: `<template class="...-tpl">` (no `id`).
- Templates are **logic-free** — no conditionals, loops, or expressions.
- Use semantic elements: `<dl>/<dt>/<dd>`, `<details>/<summary>`, `<header>/<footer>/<nav>`.
- Use `<slot>` for consumer content injection; named slots for positioned content.

### Template Completeness Rule

> Every element the component will ever show must exist in the HTML template
> from the start. JS must **never** create structural DOM with `createElement()`
> or `innerHTML` for elements that could live in the template.

If an element is conditionally visible, it lives in the template with
appropriate attributes and CSS hides/shows it. See §3.

---

## 3 CSS Visibility Pattern

### Rule

> **CSS owns all show/hide logic.** JS sets `data-*` attributes on the host;
> CSS selectors determine which internal elements are visible.

### Pattern: hide-by-default, show-via-attribute

```css
/* Element hidden by default */
.close-button {
  display: none;
}

/* Shown when host has the attribute */
:host([data-close-button]) .close-button {
  display: inline-flex;
}
```

### Anti-pattern: JS `.hidden` toggling

```js
/* ❌ NEVER do this */
this.$(".close-button").hidden = shouldShow;

/* ✅ DO this instead — set the attribute, CSS handles visibility */
this.toggleAttribute("data-close-button", shouldShow);
```

### When `hidden` attribute is acceptable

The native `hidden` attribute is acceptable **only** on the `:host` itself
(`:host([hidden]) { display: none; }`), never on internal shadow DOM elements.

---

## 4 CSS Patterns

### :host base

Every component starts with `:host` declaring display, fonts, colours, box model.
Always include `:host([hidden]) { display: none; }`.

### Data-attribute selectors (not classes, not JS)

```css
/* Variants */
:host([data-variant="secondary"]) { ... }

/* Sizes */
:host([data-size="small"]) { ... }

/* Conditional display of internal elements */
:host([data-icon-start]) .icon-start { display: inline-flex; }
:host(:not([data-label])) .label     { display: none; }
```

### Private custom properties

Use `--_` prefix for internal variables. Consume with fallback chains:

```css
:host {
  background: var(
    --_status-surface,
    var(--sherpa-surface-control-primary-default)
  );
}
```

### Tokens

- **Always use semantic tokens** (`--sherpa-*`), never core tokens (`--sherpa-core-*`).
- **Always provide hardcoded fallbacks**: `var(--sherpa-space-sm, 12px)`.
- Private vars (`--_*`) are internal — never in the public API.

### Container queries

Declare `container` on `:host` and use `@container` for responsive layout:

```css
:host {
  container: sherpa-card / inline-size;
}
@container sherpa-card (max-width: 200px) {
  .description {
    display: none;
  }
}
```

### Disabled styling

**Never use `opacity`** — use inactive tokens on individual properties.

### Shadow DOM selector form

Always use the functional form: `:host(:not([data-*]))`, never `:host:not(...)`.

---

## 5 JavaScript Patterns

### Base class

Extend `SherpaElement`. Declare `static get cssUrl()` and `static get htmlUrl()`.

### Lifecycle hooks

| Hook                                 | Use                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `onRender()`                         | Cache element refs (`this.$(...)`), set attribute defaults, register host-level listeners |
| `onConnect()`                        | One-time setup requiring DOM presence                                                     |
| `onDisconnect()`                     | Clean up timers, observers, external listeners                                            |
| `onAttributeChanged(name, old, new)` | Dispatch to `#sync*()` methods — each sync sets attributes/text, never visibility         |
| `onSlotChange(slotEl)`               | Override `super.onSlotChange()` for custom slot logic                                     |

### Observed attributes

Always spread super: `static get observedAttributes() { return [...super.observedAttributes, ...]; }`

### Query helpers

`this.$('.selector')` / `this.$$('.selector')` — never `this.shadowRoot.querySelector`.

### Events

`bubbles: true` on all custom events. Use `composed: true` if the event must
cross shadow boundaries to reach application code.

### Setting defaults

```js
onRender() {
  if (!this.dataset.variant) this.dataset.variant = 'primary';
  if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
}
```

---

## 6 Anti-Patterns — Hard Rules

| ❌ Never                                                | ✅ Instead                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| `element.hidden = bool` on shadow DOM internals         | CSS `:host([data-*]) .element { display: ... }`            |
| `element.style.display = '...'`                         | CSS attribute selectors                                    |
| `document.createElement()` for template-able structure  | Put the element in the HTML template                       |
| `element.innerHTML = '<markup>'` for structural DOM     | HTML template + cloning prototypes for repeats             |
| `element.classList.add/remove/toggle` for visual states | `data-*` attributes + CSS `:host([data-*])`                |
| `opacity: 0.5` for disabled                             | Inactive tokens per property                               |
| `:host:not(...)` (chained form)                         | `:host(:not(...))` (functional form)                       |
| Core tokens (`--sherpa-core-*`) in component CSS        | Semantic tokens (`--sherpa-*`) with fallbacks              |
| Bare custom attributes (`loading`, `pinned`)            | `data-` prefix (`data-loading`, `data-pinned`)             |
| Global/singleton state managers                         | Custom events with `bubbles: true`                         |
| Cross-shadow-boundary CSS selectors                     | `data-pdf-mode` attribute + `:host([data-pdf-mode])` rules |

---

## 7 Status System

Global `[data-status]` selectors define `--_status-*` custom properties that
inherit through shadow DOM. Components consume them via fallback chains:

```css
background: var(
  --_status-surface-strong,
  var(--sherpa-surface-control-primary-default)
);
color: var(--_status-text-on-color, var(--sherpa-text-default-on-color-body));
```

No per-component status blocks needed.

---

## 8 Exemplar Component: `sherpa-button`

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
.icon-start,
.icon-end {
  display: none;
}
:host([data-icon-start]) .icon-start {
  display: inline-flex;
}
:host([data-icon-end]) .icon-end {
  display: inline-flex;
}
:host(:not([data-label])) .label {
  display: none;
}
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

This pattern — **HTML declares structure, CSS controls visibility, JS manages data** —
is the canonical model for all components.

---

## 9 File Header Convention

Every `.css` and `.js` file starts with a JSDoc block following the canonical
format defined in `docs/COMPONENT-API-STANDARD.md`.

**JS files** use `@element`, `@attr`, `@slot`, `@fires`, `@method`, `@prop`,
`@csspart`, and `@cssprop` tags in that order. Every `@attr` must include a
type (`{string}`, `{boolean}`, `{enum}`, `{number}`, `{json}`). Every `@fires`
must document `bubbles`, `composed`, and `detail` on indented follow-up lines.

**CSS files** document host attributes consumed in selectors with
`{type}` annotations (e.g., `data-variant {enum} — primary | secondary`)
and note which `--_status-*` variables the component consumes.

---

## 10 Slot Guidelines

- Slots are for **consumer content injection only** — not structural scaffolding.
- Named slots (`<slot name="actions">`) allow positioned content projection.
- `SherpaElement` auto-detects slot content and sets `data-has-{name}` on the host.
- CSS can then show/hide wrapper elements: `:host([data-has-actions]) .actions-wrapper { display: flex; }`.

---

## 11 Quick Checklist

Before submitting any component change:

- [ ] All visual states handled in CSS via `:host([data-*])` selectors
- [ ] No `.hidden` toggling on shadow DOM internals
- [ ] No `createElement()` for elements that could be in the template
- [ ] No `innerHTML` for structural markup (only for text content like SVG illustrations)
- [ ] Events use `bubbles: true`
- [ ] Semantic tokens with hardcoded fallbacks
- [ ] `:host(:not(...))` functional form used throughout
- [ ] Template wrapped in `<template id="default">`
- [ ] `observedAttributes` spreads `super.observedAttributes`

---

## 12 Flow Patterns

CRUD flows (Add, Edit, Delete) are **composed from existing components** — no
special flow component exists. Each flow follows a shared lifecycle model,
orchestrated by **flow utility modules** in `components/utilities/`.

### Flow Utilities

| Module             | Import path                                          | Purpose                                                   |
| ------------------ | ---------------------------------------------------- | --------------------------------------------------------- |
| `FlowManager`      | `sherpa-ui/components/utilities/flow-manager.js`     | Dialog lifecycle, flow events, toast feedback              |
| `FormManager`      | `sherpa-ui/components/utilities/form-manager.js`     | Read/write/clear/validate named form fields                |
| `refreshDataset`   | `sherpa-ui/components/utilities/grid-refresh.js`     | Re-dispatch `datasetfiltered` after data mutations         |
| `initExportFlow`   | `sherpa-ui/components/utilities/export-flow.js`      | Wire view + container export dialogs                       |

### Lifecycle States

```
idle → started → in-progress → complete
                             → cancelled
                             → error
```

State is tracked by `FlowManager` in **JS memory** — not in DOM attributes.

### Flow Events

Five custom events carry the flow through its lifecycle. All use
`bubbles: true, composed: true`. `FlowManager` dispatches these automatically.

| Event          | Dispatched when                          | `detail` shape                                        |
| -------------- | ---------------------------------------- | ----------------------------------------------------- |
| `flow-start`    | Trigger clicked, dialog about to open    | `{ flow: "add"\|"edit"\|"delete", entity: string }`   |
| `flow-progress` | User submits (Save / Delete clicked)     | `{ flow, entity, data: object }`                      |
| `flow-complete` | API call succeeds                        | `{ flow, entity, data: object }`                      |
| `flow-cancel`   | User cancels (Cancel clicked or dismiss) | `{ flow, entity }`                                    |
| `flow-error`    | API call fails                           | `{ flow, entity, error: string }`                     |

### Composition

Each flow composes these existing components:

| Concern        | Component(s)                                   |
| -------------- | ---------------------------------------------- |
| Trigger        | `sherpa-button`                                |
| Dialog         | `sherpa-dialog` (native `<dialog>`, `::backdrop`) |
| Form fields    | `sherpa-input-text`, `sherpa-input-select`, etc. |
| Confirmation   | `sherpa-callout` (warning variant for delete)  |
| Feedback       | `SherpaToast.success()` / `.critical()`        |

### HTML-First Rule

> The trigger, dialog, form fields, and action buttons all live in the HTML
> template. JS opens the dialog, dispatches events, and calls APIs — it never
> creates structural DOM for flows.

### Typical Setup (Add/Edit)

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
    // Mutate dataset or call API here
    return values;
  },
  async onDelete(ids) {
    // Remove records, return count deleted
    return ids.length;
  },
  onRefresh: () => refreshDataset(contentArea, loader),
});

// Add trigger
addBtn.addEventListener('button-click', () => { form.clear(); flow.startAdd(); });

// Edit trigger (row action)
grid.addEventListener('row-action', (e) => {
  form.populate(e.detail.rowData);
  flow.startEdit(e.detail.rowData);
});

// Delete trigger (bulk selection)
deleteBtn.addEventListener('button-click', () => {
  const selected = grid.getSelectedRows() ?? [];
  flow.startDelete(selected, `Delete ${selected.length} device(s)?`);
});
```

### Export Wiring

```js
import { initExportFlow } from 'sherpa-ui/components/utilities/export-flow.js';

initExportFlow(contentArea, {
  title: 'Device Management Export',
  buildExportDialog,
  buildExportDialogForContainer,
  exportWithConfig,
});
```

### Backdrop

Dialogs use the **native `::backdrop`** pseudo-element (via `<dialog>.showModal()`).
No custom overlay elements or shim divs.

### Anti-Patterns for Flows

| ❌ Never                                            | ✅ Instead                                    |
| --------------------------------------------------- | --------------------------------------------- |
| Store flow state in DOM attributes                  | Use `FlowManager` (tracks state in JS memory) |
| Create dialog elements dynamically                  | Place dialog in template, toggle `data-open`  |
| Build custom backdrop overlays                      | Use native `::backdrop` via `showModal()`     |
| Use `window.confirm()` for delete confirmation      | Use `sherpa-dialog` + `sherpa-callout`         |
| Dispatch flow events without `composed: true`       | Always `{ bubbles: true, composed: true }`    |
| Manual `readForm()` / `populateForm()` per view     | Use `FormManager` — generic by `name` attr    |
| Inline export dialog boilerplate per view           | Use `initExportFlow()` one-liner              |
| Manual `flow()` event dispatch helper per view      | `FlowManager` dispatches automatically        |

### Pattern Files

- `patterns/flows/add.html` — trigger + form dialog + toast docs
- `patterns/flows/edit.html` — trigger + pre-populated form dialog + toast docs
- `patterns/flows/delete.html` — trigger + confirmation dialog + toast docs
