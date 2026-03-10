# Component Architecture Guidelines

> Guidance for AI agents, designers and developers working with the Apex component system.

---

## Philosophy

This component system follows a **progressive enhancement** approach: do as much as possible with **HTML first**, then **CSS**, and only reach for **JavaScript** when the first two cannot solve the problem.

- **HTML** owns structure, semantics, accessibility and content. Templates declare what exists.
- **CSS** owns all presentation — styling, states, variants, conditional display, responsiveness, transitions. CSS is the primary state engine.
- **JavaScript** owns data, lifecycle events, custom events and dynamic behaviour that HTML and CSS genuinely cannot express.
- **`data-*` attributes** are the bridge between all three layers. HTML declares them, CSS selects on them, JS reads and writes them.

The question when building any feature should always be: _"Can this be done in HTML or CSS before I write JS?"_ If a visual state, layout change or conditional display can be achieved with an attribute selector, container query, `:has()`, `<details>`, `<dialog>`, `popover`, or any other platform feature — use that instead of JavaScript.

### Responsibility Layers

Every component is split across three files. Each file owns **exactly one concern**. Never move responsibility to a different layer.

| Layer    | File            | Owns                                                                                                            | Examples                                                   |
| -------- | --------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **HTML** | `sherpa-*.html` | Structure, semantics, accessibility, content projection                                                         | `<template>`, `<slot>`, `<dl>/<dt>/<dd>`, `role`, `aria-*` |
| **CSS**  | `sherpa-*.css`  | All presentation — styling, state visuals, conditional visibility, variants, sizes, responsiveness, transitions | `:host([data-*])`, `@container`, `:has()`                  |
| **JS**   | `sherpa-*.js`   | Data, lifecycle, events, attribute coordination                                                                 | `onRender()`, `onConnect()`, `CustomEvent`, `dataset.*`    |

### Template Completeness Rule

> Every element the component will ever show **must exist in the HTML template from the start**. JS must never create structural DOM with `createElement()` or `innerHTML` for elements that could live in the template.

If an element is conditionally visible, it lives in the template and CSS hides/shows it via `:host([data-*])` selectors.

### CSS Visibility Pattern

CSS owns **all show/hide logic**. JS sets `data-*` attributes on the host; CSS selectors determine which internal elements are visible.

**Pattern — hide-by-default, show-via-attribute:**

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

**Anti-pattern — JS `.hidden` toggling:**

```js
/* ❌ NEVER do this on shadow DOM internals */
this.$(".close-button").hidden = shouldShow;

/* ✅ DO this instead — set the attribute, CSS handles visibility */
this.toggleAttribute("data-close-button", shouldShow);
```

The native `hidden` attribute is acceptable **only** on the `:host` itself (`:host([hidden]) { display: none; }`), never on internal shadow DOM elements.

### Scalability through standard HTML

Components load their templates via `fetch()` and inject standard HTML. There is no proprietary templating syntax, no JSX, no virtual DOM. Templates are plain `.html` files containing standard elements, `<slot>` elements and `<template>` blocks.

This deliberate choice means the architecture scales naturally to:

- **Server-side rendering** — templates can be served by any backend (Node, Python, PHP, .NET, Go).
- **Templating engines** — Handlebars, Jinja, Razor, Liquid, etc. can generate the same HTML the client currently fetches statically.
- **Edge rendering / SSR frameworks** — templates are already the right shape for streaming HTML.
- **Static site generators** — templates can be precompiled at build time.

Because the contract is _"give the component valid HTML with the right data attributes"_, the source of that HTML is irrelevant. The component system is transport-agnostic.

---

## Data Attributes

`data-*` attributes are the public API surface of every component. They communicate intent from HTML to CSS and JS without coupling the layers.

### Naming Conventions

| Attribute          | Purpose                         | Example                                                   |
| ------------------ | ------------------------------- | --------------------------------------------------------- |
| `data-variant`     | Visual variant of the component | `"primary"`, `"secondary"`, `"tertiary"`                  |
| `data-size`        | Size preset                     | `"small"`, `"medium"`, `"large"`                          |
| `data-status`      | Apply status colour scheme      | `"error"`, `"warning"`, `"success"`, `"info"`, `"urgent"` |
| `data-type`        | Component sub-type              | `"icon"` (icon-only button)                               |
| `data-layout`      | Layout mode                     | `"horizontal"`, `"vertical"`                              |
| `data-active`      | Active/pressed state            | `"true"` / `"false"`                                      |
| `data-elevation`   | Shadow level                    | `"none"`, `"sm"`, `"md"`, `"lg"`                          |
| `data-selected`    | Selection state                 | `"true"` / `"false"`                                      |
| `data-icon-start`  | Leading icon class              | `"fa-solid fa-plus"`                                      |
| `data-icon-end`    | Trailing icon class             | `"fa-solid fa-chevron-down"`                              |
| `data-label`       | Text label (form controls)      | `"First name"`                                            |
| `data-description` | Helper description text         | `"As shown on your ID"`                                   |
| `data-helper`      | Instructional hint              | `"Must be at least 8 characters"`                         |

### When to use bare attributes

Native HTML attributes remain un-prefixed: `disabled`, `checked`, `hidden`, `readonly`, `required`, `open`, `name`, `value`, `placeholder`, `min`, `max`, `step`. These carry built-in browser behaviour and accessibility semantics that should not be duplicated.

**Rule of thumb:** if the browser already understands the attribute, keep it bare. If it is component-specific presentation or configuration, prefix with `data-`.

---

## HTML Templates

### Structure

Each component has an HTML file alongside its CSS and JS. Templates use standard elements and `<slot>` for content projection.

```html
<!-- Single template — tag -->
<template id="default">
  <span class="tag-wrapper" part="tag">
    <slot></slot>
  </span>
</template>
```

Every HTML file must be wrapped in a `<template id="default">` tag, even if it contains only one template.

```html
<!-- Multi-template — button -->
<template id="default">
  <i class="sherpa-icon icon-start" aria-hidden="true"></i>
  <span class="label"><slot>Button</slot></span>
  <i class="sherpa-icon icon-end" aria-hidden="true"></i>
</template>

<template id="icon">
  <i class="sherpa-icon" aria-hidden="true"></i>
</template>
```

### Conventions

- Use **semantic HTML** — `<dl>/<dt>/<dd>` for label-value pairs, `<details>/<summary>` for disclosure, `<header>/<footer>/<nav>` for landmark regions.
- Use **`<slot>`** for consumer-provided content. Named slots (`<slot name="icon">`) for positioned content.
- Use **`part="name"`** on elements that consumers may need to style externally via `::part()`.
- Use **`<template id="...">`** blocks when a component has distinct structural variants (e.g., text button vs icon-only button). JS selects the active template via the `templateId` getter.
- Keep templates **logic-free**. No conditionals, no loops, no expressions. The template is a static structure; CSS and JS bring it to life.

### Cloning Prototypes (data-driven components)

Components whose DOM is populated from data (e.g., stepper steps, list items) use `<template>` elements **without `id`** as cloning shapes. These are distinct from multi-template `<template id="...">` blocks:

```html
<!-- Rendered wrapper (stamped by SherpaElement bootstrap) -->
<div class="stepper-container" role="navigation" aria-label="Progress stepper">
  <div class="stepper-header" role="tablist"></div>
</div>

<!-- Cloning prototype: step item -->
<template class="step-item-tpl">
  <div class="step-item" role="tab">
    <div class="step-indicator"></div>
    <div class="step-label-container">
      <span class="step-label text-label"></span>
    </div>
  </div>
</template>
```

The wrapper is rendered by SherpaElement's bootstrap. The `<template>` elements live in the shadow DOM as invisible containers — JS clones them per data item:

```js
const itemTpl = this.$("template.step-item-tpl");
const frag = itemTpl.content.cloneNode(true);
const item = frag.querySelector(".step-item");
item.dataset.active = "";
header.appendChild(frag);
```

**Key rule:** cloning prototypes use `class` (not `id`) to avoid triggering SherpaElement's multi-template parser, which looks for `template[id]`.

### Content Templates (application level)

Reusable content types live in `html/templates/content/`. Each file declares:

```html
<title>Regional Sales Overview</title>
<meta name="description" content="Sales performance by region." />

<slot
  data-presentation-type="metric"
  data-label="Total Revenue"
  data-query-src="/data/queries/regional-sales-overview.json"
  data-query-key="total-revenue"
  data-show-status="true"
></slot>
<slot
  data-presentation-type="table"
  data-label="Sales by Territory"
  data-query-src="/data/queries/regional-sales-overview.json"
  data-query-key="sales-by-territory"
></slot>
```

View templates in `html/templates/views/` are layout-only HTML files.
Each file contains one or more `<template id="...">` blocks.

The library provides a stamp helper that fetches, clones, and appends a
template in one call:

```js
import { stampViewTemplate } from "sherpa-ui";
await stampViewTemplate("app-shell", document.body);
```

The first template — `app-shell.html` — provides the full app shell:

```html
<template id="app-shell">
  <div class="sherpa-app-layout">
    <sherpa-nav data-pinned="false" data-editable data-searchable></sherpa-nav>
    <div class="sherpa-main-content">
      <header class="sherpa-view-header-group sherpa-scroll-under">
        <sherpa-view-header data-label=""></sherpa-view-header>
        <sherpa-filter-bar data-global></sherpa-filter-bar>
      </header>
      <div class="sherpa-main-content-slot">
        <div class="sherpa-content-area"></div>
      </div>
    </div>
  </div>
</template>
```

After stamping, consumers populate the shell: set `data-label` on the
view-header, add nav items, drop preset filter chips into the filter bar,
and place `sherpa-data-viz-container` elements into `.sherpa-content-area`.

New view layouts are added as additional files in `html/templates/views/`.

This separation means designers can compose layouts without touching data queries, and data authors can define queries without touching layouts.

---

## CSS Patterns

CSS is the workhorse of this system. It handles states, variants, responsiveness and conditional display — all without JavaScript.

### `:host` Base Declaration

Every component starts with a `:host` rule declaring display, font, colour and box model. Always include `:host([hidden])`.

```css
:host {
  display: inline-flex;
  align-items: center;
  gap: var(--sherpa-space-xs, 8px);
  height: var(--sherpa-size-2xl, 32px);
  padding-inline: var(--sherpa-space-sm, 12px);
  font: var(--sherpa-text-body-md);
  color: var(--sherpa-text-default-body);
  cursor: pointer;
}

:host([hidden]) {
  display: none;
}
```

### Variant, Size and State Selectors

Use `:host([data-attribute="value"])` to style variants. No classes, no JS toggling.

```css
/* Variant */
:host([data-variant="secondary"]) {
  background: var(--sherpa-surface-control-secondary-default);
  color: var(--sherpa-text-default-body);
}

/* Size */
:host([data-size="small"]) {
  height: var(--sherpa-size-xl, 28px);
  padding-inline: var(--sherpa-space-xs, 8px);
  font: var(--sherpa-text-body-sm);
}

/* Interactive states */
:host(:hover) {
  background: var(--sherpa-surface-control-primary-hover);
}
:host(:active) {
  background: var(--sherpa-surface-control-primary-down);
}
:host(:focus-visible) {
  outline: 2px solid var(--sherpa-border-focus-default);
}

/* Active toggle */
:host([data-active="true"]) {
  background: var(--sherpa-surface-control-primary-active);
}
```

### Private Custom Properties with Fallbacks

Components use private `--_` prefixed variables consumed with fallbacks so that optional features (status, control groups) activate only when set.

```css
:host {
  /* Consumed with fallback — default colours apply when no status is set */
  background-color: var(
    --_status-surface,
    var(--sherpa-surface-control-primary-default)
  );
  color: var(--_status-text, var(--sherpa-text-default-on-color-body));
  border-radius: var(
    --_cg-border-radius,
    var(--sherpa-border-rounding-base, 4px)
  );
}
```

### Container Queries

Declare `container` on the host and use `@container` queries for responsive child layout.

```css
:host {
  container: sherpa-nav / inline-size;
}

@container sherpa-nav (min-width: 320px) {
  .nav-product-name {
    display: block;
  }
}

@container sherpa-nav (max-width: 319px) {
  .nav-product-name {
    display: none;
  }
}
```

Container queries cross shadow DOM boundaries, making them ideal for layout-driven state that depends on the component's rendered size rather than the viewport.

### Disabled Styling

**Never use `opacity`** for disabled or inactive states. Use token-based colours on individual properties.

```css
/* ✅ Correct */
:host([disabled]) {
  cursor: not-allowed;
  pointer-events: none;
  color: var(--sherpa-text-inactive-default);
  background: var(--sherpa-surface-control-inactive-default);
  border-color: var(--sherpa-border-inactive-default);
}

/* ❌ Wrong — opacity compounds in dark mode, makes text illegible */
:host([disabled]) {
  opacity: 0.5;
}
```

### Control Group Pattern

Components that can be grouped (buttons, inputs, filter chips) read two inherited custom properties set by a `.control-group` wrapper:

```css
/* Inside the component */
:host {
  border-width: var(--_cg-border-width, var(--sherpa-border-width-xs, 1px));
  border-radius: var(
    --_cg-border-radius,
    var(--sherpa-border-rounding-base, 4px)
  );
}
```

The wrapper owns the visual framing:

```css
/* External wrapper */
.control-group {
  --_cg-border-width: 0;
  --_cg-border-radius: 0;
  display: inline-flex;
  border: var(--sherpa-border-width-xs) solid
    var(--sherpa-border-container-default);
  border-radius: var(--sherpa-border-rounding-base);
  overflow: hidden;
}
```

No position classes needed — children are simply placed inside the wrapper.

### Shadow DOM Selector Gotcha

Inside shadow DOM, `:host` compound selectors must use the **functional form**:

```css
/* ✅ Correct — functional pseudo-class */
:host(:not([data-pinned="true"])) {
  width: 48px;
}
:host(:is([data-pinned="true"], [data-mode="edit"])) {
  width: 320px;
}

/* ❌ Wrong — chained pseudo-class doesn't work in shadow DOM */
:host:not([data-pinned="true"]) {
  width: 48px;
}
```

CSS nesting with `&` inside `:host {}` desugars to the chained (broken) form. Put compound host selectors as standalone rules.

---

## Status System

The status system applies contextual colour schemes (critical, warning, success, info, urgent) across components.

### Architecture — Global Token Inheritance

**Global definitions** (`sherpa-status.css`)

`[data-status]` attribute selectors define `--_status-*` custom properties
on the host element. Because CSS custom properties inherit through shadow DOM
boundaries, these values are automatically available inside every web component.

```css
[data-status="critical"] {
  --_status-surface: var(--sherpa-surface-context-error-subtle-default);
  --_status-surface-strong: var(--sherpa-surface-context-error-strong-default);
  --_status-border: var(--sherpa-border-context-error-default);
  --_status-text: var(--sherpa-text-context-error-default);
  --_status-text-on-color: var(--sherpa-text-context-error-on-color);
  --_status-icon: var(--sherpa-icon-context-error-default);
  /* … plus -hover/-down variants for surface and surface-strong */
}
```

**Component consumption** (component CSS)

Each component uses `var(--_status-*, <default>)` fallback chains. When no
`data-status` is set, the `--_status-*` vars are undefined and the fallback
activates. No per-component status blocks needed.

```css
/* Button primary — strong surface + on-colour text */
:host {
  background: var(
    --_status-surface-strong,
    var(--sherpa-surface-control-primary-default)
  );
  color: var(--_status-text-on-color, var(--sherpa-text-default-on-color-body));
}

/* Button secondary — subtle surface + default text */
:host([data-variant="secondary"]) {
  background: var(
    --_status-surface,
    var(--sherpa-surface-control-secondary-default)
  );
  color: var(--_status-text, var(--sherpa-text-default-label));
}
```

### Available Status Variables

| Variable                   | Description                         |
| -------------------------- | ----------------------------------- |
| `--_status-surface`        | Subtle surface (default/hover/down) |
| `--_status-surface-strong` | Strong surface (default/hover/down) |
| `--_status-border`         | Border colour                       |
| `--_status-text`           | Text colour                         |
| `--_status-text-on-color`  | Text on strong surface              |
| `--_status-icon`           | Icon colour                         |

Components only consume the subset they need — no obligation to use all variables.

---

## Token Architecture

Design tokens follow a 3-tier model. Always consume **semantic tokens** with **hardcoded fallbacks**.

### Tiers

| Tier              | Prefix            | Source                                                  | Example                                           |
| ----------------- | ----------------- | ------------------------------------------------------- | ------------------------------------------------- |
| Core primitives   | `--sherpa-core-*` | `sherpa-primitives.css`                       | `--sherpa-core-colors-slate-600`                  |
| Semantic aliases  | `--sherpa-*`      | `sherpa-alias.css`, `sherpa-theme-*.css`       | `--sherpa-text-default-body`, `--sherpa-space-sm` |
| Component private | `--_*`            | Component CSS                                           | `--_status-surface`, `--_cg-border-radius`        |

### Rules

- **Never reference core tokens directly** in component CSS. Always use the semantic alias.
- **Always provide a hardcoded fallback** for semantic tokens: `var(--sherpa-space-sm, 12px)`.
- **Private vars (`--_*`) are internal** — they should not appear in any public API.
- **Composite shadow tokens** (`--sherpa-shadow-default-sm`, etc.) replace inline elevation chains.
- Theme-sensitive values use `light-dark()`: `color: light-dark(var(--light-val), var(--dark-val))`.

---

## JavaScript Patterns

JS is the last resort — used only for data, lifecycle and events that HTML and CSS cannot handle.

### Base Class

Every shadow DOM component extends `SherpaElement`:

```js
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaTag extends SherpaElement {
  static get cssUrl() {
    return new URL("./sherpa-tag.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-tag.html", import.meta.url).href;
  }

  onRender() {
    // Shadow DOM is populated — wire up initial state
  }
}
customElements.define("sherpa-tag", SherpaTag);
```

### Lifecycle Hooks

| Hook                                 | When                               | Use for                                                   |
| ------------------------------------ | ---------------------------------- | --------------------------------------------------------- |
| `onRender()`                         | Shadow DOM populated, before slots | Register event listeners, set default attributes          |
| `onConnect()`                        | Once, after first render           | One-time setup that needs the component in the DOM        |
| `onDisconnect()`                     | Element removed from DOM           | Clean up timers, observers, external listeners            |
| `onAttributeChanged(name, old, new)` | Observed attribute changes         | React to attribute changes (data loading, template swaps) |
| `onStatusChanged(new, old)`          | `data-status` changes              | Status-specific icon or ARIA updates                      |
| `onSlotChange(slotEl)`               | Slotted content changes            | Toggle `data-has-{name}` on host                          |

### Observed Attributes

Spread from super to inherit base class observations:

```js
static get observedAttributes() {
  return [...super.observedAttributes, 'data-variant', 'data-size', 'data-icon-start'];
}
```

### Shadow Root Queries

Use the built-in helpers instead of `this.shadowRoot.querySelector`:

```js
this.$(".label"); // querySelector
this.$$(".nav-item"); // querySelectorAll
```

### Event Dispatching

Always `bubbles: true` so events cross shadow boundaries:

```js
#emit(name, detail = {}) {
  this.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
}

// Usage
this.#emit('navitemclick', { itemId, sectionId, route, label });
```

### Click Delegation

For components with many interactive children, use a single host-level handler with `composedPath()`:

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

### Setting Defaults

Set default attribute values in `onRender()` so CSS selectors activate immediately:

```js
onRender() {
  if (!this.dataset.variant) this.dataset.variant = 'primary';
  if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
  if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
}
```

### Multi-Template Selection

Override `templateId` to choose between `<template>` blocks in the HTML file:

```js
get templateId() {
  return this.dataset.type === 'icon' ? 'icon' : 'default';
}
```

Call `this.renderTemplate(id)` for runtime template swaps.

### Dynamic Content Loading

Components that load content from URLs at runtime (e.g., navigation templates, container content) use `renderFromUrl(url)`:

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

`renderFromUrl(url)` fetches HTML from the URL, preserves `<link>` and `<style>` elements from the initial bootstrap, replaces the remaining shadow DOM content, then calls `onRender()` and re-wires slots. Returns `true` on success, `false` on error.

Unlike `renderTemplate(id)`, this fetches from an arbitrary URL (not the class-level cache). Set `htmlUrl` to `null` for components using this pattern — they don't need bootstrap HTML.

### Awaiting Render

External code can wait for a component to be ready:

```js
await myButton.rendered;
```

---

## Anti-Patterns

| Don't                                                   | Do Instead                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Use `opacity` for disabled states                       | Use `--sherpa-text-inactive-default` and other inactive tokens on individual properties      |
| Toggle classes in JS for visual states                  | Set `data-*` attributes; let CSS select on them                                              |
| Use `.hidden` on shadow DOM internals                   | CSS `:host([data-*]) .element { display: ... }` — `hidden` only on `:host`                   |
| Use `element.style.display = '...'`                     | CSS attribute selectors                                                                      |
| Use `createElement()` for template-able structure       | Put the element in the HTML template                                                         |
| Use `innerHTML` for structural DOM                      | HTML template + cloning prototypes for data-driven repeats                                   |
| Use `:host:not(...)` (chained)                          | Use `:host(:not(...))` (functional form)                                                     |
| Use `@container style(--prop)` on self                  | Use `:host([attr])` attribute selectors                                                      |
| Reference core tokens (`--sherpa-core-*`) in components | Use semantic tokens (`--sherpa-*`) with hardcoded fallbacks                                  |
| Create singleton/global state managers                  | Use custom events with `bubbles: true` for cross-component communication                     |
| Write JS for something CSS can do                       | Check if `:host()`, `:has()`, `@container`, `<details>`, `popover` solve it first            |
| Use bare custom attributes (e.g. `loading`)             | Prefix with `data-` (e.g. `data-loading`) — bare attrs are reserved for native HTML          |
| Build DOM entirely in JS                                | Create an HTML template; use cloning prototypes for data-driven repeats                      |
| Style child shadow DOM internals from outside           | Use `data-pdf-mode` attribute + `:host([data-pdf-mode])` rules inside the child's shadow CSS |

---

## Light DOM Exceptions

Most components extend `SherpaElement` and use shadow DOM. One component remains light DOM:

| Component          | Base Class    | Reason                                     |
| ------------------ | ------------- | ------------------------------------------ |
| `sherpa-data-viz-container` | `HTMLElement` | Orchestrates child components in light DOM |

This component loads its CSS via `components/index.css` (light DOM import) rather than via `SherpaElement.cssUrl`.

### Completed: Data-Viz → SherpaElement

The data-viz trio (`sherpa-data-grid`, `sherpa-metric`, `sherpa-barchart`) and `sherpa-view-header` and `sherpa-container-pdf` have been converted to shadow DOM:

- `ContentAttributesMixin(HTMLElement)` → `ContentAttributesMixin(SherpaElement)` for the data-viz trio
- `sherpa-view-header` and `sherpa-container-pdf` now extend `SherpaElement` directly
- All five use `static cssUrl` / `static htmlUrl` and shadow DOM queries (`$()` / `$$()`)
- External cross-shadow-boundary CSS selectors were removed; PDF-specific styling now uses the `data-pdf-mode` attribute pattern (see below)

### PDF Mode Pattern

Components rendered inside `sherpa-container-pdf` for print/export receive a `data-pdf-mode` attribute on the host. Each component's shadow CSS includes `:host([data-pdf-mode])` rules that override layout, colours and typography for PDF output:

```css
/* Inside sherpa-barchart shadow CSS */
:host([data-pdf-mode]) .content-header {
  display: none;
}
:host([data-pdf-mode]) .chart-content {
  min-height: 220px;
}
:host([data-pdf-mode]) .chart-legend {
  display: flex !important;
}
```

PDF colour variables (`--_pdf-bg-white`, `--_pdf-bg-header`, etc.) are defined on `sherpa-container-pdf`'s `:host` and cascade through shadow boundaries via CSS custom property inheritance — no `::part()` needed.

### Retired: sherpa-content-area

`sherpa-content-area` was retired as a custom element. Its grid layout CSS now lives in `css/styles/sherpa-layout-classes.css` as a utility class. All usage was already `<div class="sherpa-content-area">` — the element was never instantiated.

---

## For Designers

### Mapping to Figma

| Figma Concept                                 | Code Equivalent                          |
| --------------------------------------------- | ---------------------------------------- |
| Component variant (e.g., Primary / Secondary) | `data-variant="primary"` / `"secondary"` |
| Component property (e.g., Size = Small)       | `data-size="small"`                      |
| Boolean property (e.g., Active = true)        | `data-active="true"`                     |
| Status (e.g., Critical)                       | `data-status="critical"`                 |
| Design token (e.g., `space/sm`)               | `--sherpa-space-sm` in CSS               |
| Colour token (e.g., `text/default/body`)      | `--sherpa-text-default-body`             |

### Specifying New States

When designing a new component state:

1. **Name the attribute** — use `data-{descriptive-name}` with a clear set of allowed values.
2. **List the token changes** — which colour, spacing, or typography tokens change per value.
3. **Note interaction states** — hover, active, focus, disabled variants.

This maps directly to CSS `:host([data-attribute="value"])` rules. No JS needed for visual states.

---

## For AI Agents

### Quick-Reference Checklist

When creating or modifying a component:

- [ ] Extend `SherpaElement` — declare `static get cssUrl()` and `static get htmlUrl()`
- [ ] Use `data-*` attributes for all non-native configuration
- [ ] CSS handles **all visual states** — variants, sizes, status, disabled, active, hover, focus
- [ ] JS only for data fetching, lifecycle setup, attribute defaults and event dispatch
- [ ] Always ask: can HTML or CSS do this before writing JS?
- [ ] Custom events use `bubbles: true`
- [ ] Use semantic tokens (`--sherpa-*`) with hardcoded fallbacks — never core tokens
- [ ] Use `:host([data-*="..."])` selectors — never toggle classes for state
- [ ] Use `:host(:not(...))` functional form — never `:host:not(...)`
- [ ] Never use `opacity` for disabled styling — use inactive tokens per property
- [ ] Use `$()` / `$$()` for shadow root queries
- [ ] Spread `super.observedAttributes` when adding observed attributes
- [ ] Register event listeners in `onConnect()`, remove in `onDisconnect()` — or register once in `onRender()` on the host element
- [ ] Templates are static HTML — no logic, no expressions
- [ ] Keep the component's HTML template logic-free and transport-agnostic (could be served statically, from a templating engine, or from a server)
- [ ] Every HTML template file must be wrapped in `<template id="default">` — even single-template components
- [ ] For data-driven repeats, use cloning prototypes (`<template class="...-tpl">` without `id`)
- [ ] For PDF-export styling, use `:host([data-pdf-mode])` rules inside the component's shadow CSS — never cross-shadow selectors
- [ ] For dynamic URL-based content, use `renderFromUrl(url)` with `htmlUrl` set to `null`
- [ ] Never use bare custom attributes — `data-*` prefix for all component-specific attributes
