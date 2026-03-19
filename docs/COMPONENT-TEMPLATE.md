# Component Template — Canonical File Structure

> Reference showing the canonical `.html`, `.css`, and `.js` structure for a
> new Sherpa component. Copy this template when creating a new component.

---

## HTML — `sherpa-example.html`

```html
<template id="default">
  <!-- Semantic structure — every element the component will ever show lives here -->
  <div class="wrapper">
    <i class="icon-start" aria-hidden="true"></i>
    <span class="label"></span>
    <span class="description"></span>
    <i class="icon-end" aria-hidden="true"></i>
    <slot name="actions"></slot>
  </div>
</template>
```

### Key rules

- Wrap in `<template id="default">` — even single-template components.
- Every conditional element lives in the template (CSS hides it).
- Use semantic elements (`<dl>/<dt>/<dd>`, `<header>`, `<nav>`, etc.).
- `<slot>` for consumer content injection only.
- Data-driven repeats use `<template class="...-tpl">` (no `id`).

---

## CSS — `sherpa-example.css`

```css
/**
 * sherpa-example.css
 * Shadow DOM styles for the SherpaExample web component.
 *
 * Architecture:
 *   [describe layout and how internal elements are structured]
 *
 * Host attributes consumed:
 *   data-label       {string}  — text content (hides .label when absent)
 *   data-variant     {enum}    — primary | secondary | tertiary
 *   data-size        {enum}    — small | medium | large
 *   data-icon-start  {string}  — leading icon (Font Awesome unicode)
 *   data-icon-end    {string}  — trailing icon
 *   disabled         {boolean} — inactive state
 *
 * Status system:
 *   Consumes --_status-surface, --_status-text via fallback chains.
 */

/* ==========================================================================
   Host
   ========================================================================== */

:host {
  display: inline-flex;
  align-items: center;
  gap: var(--sherpa-space-xs, 8px);
  color: var(--sherpa-text-default-body, #1a1a1f);
}

:host([hidden]) {
  display: none;
}

/* ==========================================================================
   Internal elements — hidden by default, shown via host attributes
   ========================================================================== */

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

.description {
  display: none;
}
:host([data-description]) .description {
  display: block;
}

:host(:not([data-label])) .label {
  display: none;
}

/* ==========================================================================
   Variants — via :host([data-variant="..."])
   ========================================================================== */

:host([data-variant="secondary"]) {
  background-color: var(--sherpa-surface-control-secondary-default);
  color: var(--sherpa-text-default-label, #2c2c31);
}

/* ==========================================================================
   Sizes
   ========================================================================== */

:host([data-size="small"]) {
  gap: var(--sherpa-space-3xs, 2px);
  font-size: var(--sherpa-fonts-scale-sm, 12px);
}

/* ==========================================================================
   Disabled — never use opacity; use inactive tokens per property
   ========================================================================== */

:host([disabled]) {
  color: var(--sherpa-text-inactive-default);
  pointer-events: none;
  cursor: not-allowed;
}

/* ==========================================================================
   Status — fallback chains (auto-inherited from global [data-status])
   ========================================================================== */

:host {
  background-color: var(
    --_status-surface,
    var(--sherpa-surface-control-primary-default)
  );
  color: var(--_status-text, var(--sherpa-text-default-body));
}
```

### Key rules

- Start with JSDoc header documenting architecture and attributes.
- `:host` base declaration with `display`, fonts, colours, box model.
- Always include `:host([hidden]) { display: none; }`.
- Hide optional elements by default; show via `:host([data-*]) .element`.
- Use `:host(:not(...))` functional form — never `:host:not(...)`.
- Use semantic tokens (`--sherpa-*`) with hardcoded fallbacks.
- Private vars use `--_` prefix.
- Never use `opacity` for disabled states.

---

## JS — `sherpa-example.js`

```js
/**
 * sherpa-example.js
 * SherpaExample — [brief description].
 *
 * [Extended description if needed — architecture, multi-template logic,
 * delegation patterns, or anything a consumer needs to know.]
 *
 * @element sherpa-example
 *
 * @attr {string}  data-label       — Text label
 * @attr {enum}    data-variant     — primary | secondary | tertiary
 * @attr {string}  data-icon-start  — Leading icon (Font Awesome unicode)
 * @attr {boolean} disabled         — Native disabled state
 *
 * @slot           — Default slot for main content
 * @slot actions   — Action buttons
 *
 * @fires example-click — Fired when the component is activated
 *   bubbles: true, composed: true
 *   detail: { }
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaExample extends SherpaElement {
  static get cssUrl() {
    return new URL("./sherpa-example.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-example.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-label",
      "data-variant",
      "data-icon-start",
    ];
  }

  /* ── Private refs ─────────────────────────────────────────────── */

  #labelEl = null;
  #iconStartEl = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    // Cache element references
    this.#labelEl = this.$(".label");
    this.#iconStartEl = this.$(".icon-start");

    // Set defaults (CSS selectors activate immediately)
    if (!this.dataset.variant) this.dataset.variant = "primary";
    if (!this.hasAttribute("role")) this.setAttribute("role", "button");
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");

    // Initial sync
    this.#syncLabel();
    this.#syncIconStart();
  }

  onConnect() {
    // One-time setup (event listeners on external targets, observers, etc.)
    this.addEventListener("click", this.#onClick);
  }

  onDisconnect() {
    // Clean up external listeners, timers, observers
    this.removeEventListener("click", this.#onClick);
  }

  onAttributeChanged(name) {
    switch (name) {
      case "data-label":
        this.#syncLabel();
        break;
      case "data-icon-start":
        this.#syncIconStart();
        break;
    }
  }

  /* ── Sync helpers (data only — never visibility) ──────────────── */

  #syncLabel() {
    if (this.#labelEl) this.#labelEl.textContent = this.dataset.label || "";
  }

  #syncIconStart() {
    if (this.#iconStartEl)
      this.#iconStartEl.textContent = this.dataset.iconStart || "";
  }

  /* ── Events ───────────────────────────────────────────────────── */

  #onClick = () => {
    this.dispatchEvent(
      new CustomEvent("example-click", {
        bubbles: true,
        composed: true,
      }),
    );
  };
}

customElements.define("sherpa-example", SherpaExample);
```

### Key rules

- Extend `SherpaElement`; declare `static cssUrl` and `static htmlUrl`.
- Spread `super.observedAttributes` in `observedAttributes`.
- `onRender()`: cache refs, set defaults, sync data.
- `onConnect()`: one-time setup.
- `onAttributeChanged()`: dispatch to `#sync*()` methods.
- `#sync*()` methods set **text content / attributes only** — never visibility.
- Events use `bubbles: true`.
- Use `this.$()` / `this.$$()` — never `this.shadowRoot.querySelector`.
