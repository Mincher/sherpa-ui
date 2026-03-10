# Apex 2.0 → Sherpa UI — Component Implementation Plan

> Master plan for recreating all Figma [Apex 2.0] Core components as sherpa-ui
> web components. Based on the Figma inventory extracted 6 March 2026 and the
> existing 39-component sherpa-ui codebase.

---

## Table of Contents

1. [Coverage Map](#1-coverage-map)
2. [Gap Analysis](#2-gap-analysis)
3. [Architecture Blueprint](#3-architecture-blueprint)
4. [Implementation Phases](#4-implementation-phases)
5. [Per-Component Specs](#5-per-component-specs)
6. [Component Scaffold Checklist](#6-component-scaffold-checklist)
7. [Existing Component Upgrade Notes](#7-existing-component-upgrade-notes)

---

## 1. Coverage Map

### Figma → Existing sherpa-ui Mapping

| Figma Page | Figma Component | sherpa-ui Component | Status |
|---|---|---|---|
| Accordion | Accordion | — | **NEW** |
| Banner | Banner | sherpa-message | **Mapped** (rename / alias needed?) |
| Breadcrumbs | Breadcrumbs | — | **NEW** |
| Button | Button, Button (Icon only) | sherpa-button | **Built** ✅ |
| Card | Card, Radio Card | sherpa-card | **Built** ✅ |
| Checkbox & Radio | Checkbox, Radio, Radio Card | sherpa-check | **Built** ✅ |
| Chip | Chip | sherpa-filter-chip | **Built** ✅ |
| Data Grid | .Cell, Column Header, Filter Bar, Toolbar, Pagination | sherpa-data-grid, sherpa-filter-bar, sherpa-toolbar, sherpa-pagination | **Built** ✅ |
| Date & Time | Date Picker, Time Picker, Date Range Picker, Date and Time Picker | sherpa-input-date, sherpa-input-time | **Partial** — range/combo pickers missing |
| Dialog | Dialog | sherpa-dialog | **Built** ✅ |
| Empty State | Empty State | sherpa-empty-state | **Built** ✅ |
| Field Validation | Field Validation | (built into SherpaInputBase) | **Built** ✅ |
| File Uploader | File item, File drop zone, File uploader | — | **NEW** |
| Footer (Generic) | Footer - Generic | sherpa-footer | **Built** ✅ |
| Header (Generic) | Header - Generic | sherpa-header | **Built** ✅ |
| Input | Input (vertical/minimal/horizontal) | sherpa-input-text + variants | **Built** ✅ |
| Key Value Pair | Key Value Pair | sherpa-key-value-list | **Built** ✅ |
| List | List item | — | **NEW** |
| Loader | Loader, .spinner | — | **NEW** |
| Menu | Menu, Menu Item, Menu Section | sherpa-menu, sherpa-menu-item | **Built** ✅ |
| Navigation | Navigation Item/Section/Sub Item, Product Navigation | sherpa-nav, sherpa-nav-item | **Built** ✅ |
| Overlay | Overlay | — | **NEW** |
| Panel | Inline Panel, Overlay Panel | — | **NEW** |
| Popover | Popover | — | **NEW** |
| Product Bar | Product Bar | — | **NEW** (currently part of app shell CSS) |
| Progress Bar | Progress Bar | — | **NEW** |
| Progress Tracker | Progress Tracker, .milestone | — | **NEW** |
| Progress Steps | Progress Steps, .step | sherpa-stepper | **Built** ✅ |
| Scrollbar | Scrollbar | — | **NEW** (CSS utility, not component) |
| Section Header | Section Header | sherpa-section-header | **Built** ✅ |
| Slider | Slider, .Handle control | — | **NEW** |
| Switch | Switch | sherpa-switch | **Built** ✅ |
| Tab | Tabs, .Tab | — | **NEW** |
| Tag | Tag (status), Tag (general) | sherpa-tag | **Built** ✅ |
| Toast | Toast | sherpa-toast | **Built** ✅ |
| Tooltip | Tooltip | sherpa-tooltip | **Built** ✅ |
| View Header | View Header | sherpa-view-header | **Built** ✅ |
| Widget | Widget | — | **NEW** (dashboard widget wrapper) |
| Callout (tbc) | .Callout | — | **NEW** |
| AI / N-zo | — | — | Not designed yet |
| Charts | Bar/Area/Donut/Gauge/Line/Spline | sherpa-barchart, sherpa-sparkline | **Partial** |
| Axis & Legends | Grid, Legend, Label | — | **Partial** (part of chart internals) |

---

## 2. Gap Analysis

### New Components to Build (16)

| Priority | Component | Figma Variants | Complexity | Est. Effort |
|---|---|---|---|---|
| **P1 — Core UI** | | | | |
| 1 | sherpa-accordion | Collapsed/Expanded × Default/Hover | Medium | 1 day |
| 2 | sherpa-tabs | Tabs container + .Tab (5 states) | Medium | 1-2 days |
| 3 | sherpa-breadcrumbs | Expanded/Collapsed + .Breadcrumb | Simple | 0.5 day |
| 4 | sherpa-list-item | Default/Hover/Active/Inactive | Simple | 0.5 day |
| 5 | sherpa-loader | Horizontal/Vertical × Panel, .spinner (3 sizes) | Medium | 1 day |
| 6 | sherpa-progress-bar | Determinate/Indeterminate | Simple | 0.5 day |
| **P2 — Layout** | | | | |
| 7 | sherpa-panel | Inline (3 states) + Overlay (1 state) + Header + Action Bar | Complex | 2 days |
| 8 | sherpa-overlay | Scrim/backdrop component | Simple | 0.5 day |
| 9 | sherpa-popover | Popover with header, CSS anchor positioning | Medium | 1 day |
| 10 | sherpa-product-bar | Product branding bar (1 variant) | Simple | 0.5 day |
| **P3 — Form / Interactive** | | | | |
| 11 | sherpa-slider | Single/Dual × Active/Inactive, Handle control | Complex | 2 days |
| 12 | sherpa-file-upload | Drop zone (4 states) + File item (4 states) + wrapper | Complex | 2-3 days |
| 13 | sherpa-input-date-range | Date Range Picker composite | Complex | 2 days |
| **P4 — Informational** | | | | |
| 14 | sherpa-callout | 6 statuses × Expanded/Collapsed + Custom variants | Medium | 1 day |
| 15 | sherpa-widget | Dashboard widget wrapper | Medium | 1 day |
| 16 | sherpa-progress-tracker | Vertical tracker + .milestone (5 statuses) | Medium | 1 day |

### CSS-Only Additions (not full components)

| Item | Notes |
|---|---|
| Scrollbar styling | Custom scrollbar utility CSS class — add to sherpa-utilities.css |
| Banner alias | sherpa-message already covers this; align naming if needed |

### Existing Component Enhancements

| Component | Enhancement |
|---|---|
| sherpa-barchart | Add horizontal/vertical/stacked/grouped bar sub-types to match Figma |
| sherpa-input-date | Add date-range-picker mode or build sherpa-input-date-range |
| sherpa-data-grid | Verify Column Header, .Cell, Band Group Header match Figma spec |
| sherpa-stepper | Already built — verify parity with Figma "Progress Steps" |

---

## 3. Architecture Blueprint

Every new component follows the **three-file triad** with strict responsibility layers:

### File Structure

```
components/sherpa-{name}/
  sherpa-{name}.html        ← Structure, semantics, accessibility
  sherpa-{name}.css         ← All presentation, visibility, state, responsive
  sherpa-{name}.js          ← Data, lifecycle, events, attribute coordination
  component-doc.html        ← Demo/documentation page
```

### JS Skeleton

```js
/**
 * sherpa-{name}.js
 * Sherpa{Name} — {one-line description}.
 *
 * Attributes:
 *   data-{attr} — {description}
 *
 * @fires {event-name} — { detail }
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class Sherpa{Name} extends SherpaElement {

  static get cssUrl()  { return new URL('./sherpa-{name}.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-{name}.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-{attr}'];
  }

  // ── Cached refs ───────────────────────────────────────────
  #{ref}El = null;

  // ── Lifecycle ─────────────────────────────────────────────
  onRender() {
    this.#{ref}El = this.$('.{selector}');
    if (!this.dataset.variant) this.dataset.variant = 'default';
    this.#sync{Attr}();
  }

  onConnect() {
    // Event listeners
  }

  onDisconnect() {
    // Cleanup
  }

  onAttributeChanged(name) {
    switch (name) {
      case 'data-{attr}': this.#sync{Attr}(); break;
    }
  }

  // ── Sync methods ──────────────────────────────────────────
  #sync{Attr}() {
    if (this.#{ref}El) this.#{ref}El.textContent = this.dataset.{attr} || '';
  }
}

customElements.define('sherpa-{name}', Sherpa{Name});
```

### HTML Skeleton

```html
<!--
  sherpa-{name}.html — {Description}.

  Templates:
    • default — {what it renders}

  Host attributes:
    data-{attr} — {description}
-->
<template id="default">
  <!-- All elements that will ever be shown must exist here -->
  <div class="{name}-wrapper">
    <slot></slot>
  </div>
</template>
```

### CSS Skeleton

```css
/**
 * sherpa-{name}.css
 * Shadow DOM styles for the Sherpa{Name} web component.
 *
 * Attributes:
 *   data-{attr}: {values}
 */

/* ── Host ──────────────────────────────────────────────────── */
:host {
  display: {flex|inline-flex|block};
  /* tokens with fallbacks */
}

:host([hidden]) { display: none; }

/* ── Variants ──────────────────────────────────────────────── */
:host([data-variant="secondary"]) { }

/* ── Conditional visibility ────────────────────────────────── */
.optional-element { display: none; }
:host([data-show-optional]) .optional-element { display: flex; }
```

### Registration

```js
// components/index.js — add export
export * from "./sherpa-{name}/sherpa-{name}.js";
```

---

## 4. Implementation Phases

### Phase 1 — Core UI Components (Sprint 1, ~5 days)

Build the most commonly used missing components. These have no dependencies
on other unbuilt components.

| # | Component | Depends On | Figma Page |
|---|---|---|---|
| 1.1 | **sherpa-accordion** | sherpa-header (reuse) | Accordion |
| 1.2 | **sherpa-tabs** | — | Tab |
| 1.3 | **sherpa-breadcrumbs** | — | Breadcrumbs |
| 1.4 | **sherpa-list-item** | — | List |
| 1.5 | **sherpa-loader** | — | Loader |
| 1.6 | **sherpa-progress-bar** | — | Progress Bar |

**Deliverable**: 6 new components registered in index.js, each with doc page.

### Phase 2 — Layout Components (Sprint 2, ~4 days)

Panel/overlay/popover patterns — these compose together for slide-out,
modal, and floating UI patterns.

| # | Component | Depends On | Figma Page |
|---|---|---|---|
| 2.1 | **sherpa-overlay** | — | Overlay |
| 2.2 | **sherpa-panel** | sherpa-header, sherpa-footer, sherpa-overlay | Panel |
| 2.3 | **sherpa-popover** | — | Popover |
| 2.4 | **sherpa-product-bar** | — | Product Bar |

**Deliverable**: 4 new layout components. App shell composition possible.

### Phase 3 — Form & Interactive Components (Sprint 3, ~6 days)

More complex interactive components with form semantics.

| # | Component | Depends On | Figma Page |
|---|---|---|---|
| 3.1 | **sherpa-slider** | — | Slider |
| 3.2 | **sherpa-file-upload** | sherpa-button, sherpa-progress-bar | File Uploader |
| 3.3 | **sherpa-input-date-range** | sherpa-input-date | Date & Time |

**Deliverable**: 3 new components covering file upload and range inputs.

### Phase 4 — Informational & Specialist (Sprint 4, ~3 days)

Components that display status or track progress.

| # | Component | Depends On | Figma Page |
|---|---|---|---|
| 4.1 | **sherpa-callout** | — | Callout (tbc) |
| 4.2 | **sherpa-widget** | sherpa-header, sherpa-data-viz-container | Widget |
| 4.3 | **sherpa-progress-tracker** | — | Progress Tracker |

**Deliverable**: 3 new informational components.

### Phase 5 — Data Visualisation Expansion (Sprint 5+)

Extend the charting library to cover all Figma chart types.

| # | Component | Figma Page |
|---|---|---|
| 5.1 | sherpa-area-chart | Charts (Area Chart) |
| 5.2 | sherpa-donut-chart | Charts (Donut Chart) |
| 5.3 | sherpa-gauge-chart | Charts (Solid Gauge, Series Gauge) |
| 5.4 | sherpa-line-chart | Charts (Line Charts, Spline) |
| 5.5 | sherpa-chart-legend | Axis & Legends |
| 5.6 | sherpa-chart-axis | Axis & Legends |

**Deliverable**: Full data visualisation parity.

### Phase 6 — Polish & Documentation

| Task | Scope |
|---|---|
| Add missing `component-doc.html` | 5 existing + all new components |
| Populate COMPONENT-API.md | Auto-generate from component metadata |
| Scrollbar CSS utility | Add to sherpa-utilities.css |
| Verify sherpa-message ↔ Banner parity | Ensure Figma Banner maps cleanly |
| Audit all Figma variant coverage | Cross-check every Figma variant has a data-* selector |

---

## 5. Per-Component Specs

### 5.1 sherpa-accordion

**Maps to**: Figma "Accordion" (4 variants: Collapsed/Expanded × Default/Hover)

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-accordion>` |
| **Base class** | `SherpaElement` |
| **Semantics** | Uses `<details>`/`<summary>` native HTML |
| **Templates** | `default` — single accordion item with heading + content |
| **Host attributes** | `data-expanded` (boolean), `data-label` (heading text), `data-icon` (optional) |
| **Slots** | `heading` (override label), default (panel content) |
| **Events** | `toggle` — `{ expanded: boolean }` (bubbles, composed) |
| **CSS states** | `:host([data-expanded])` for open state; hover via `:host(:hover)` |
| **Token usage** | `--sherpa-surface-container-*` for background, `--sherpa-border-container-*` for dividers |
| **Notes** | Could also be used as a group — multiple `<sherpa-accordion>` in a parent `<div data-accordion-group>` for exclusive mode. Consider `data-exclusive` on a wrapper. |

### 5.2 sherpa-tabs

**Maps to**: Figma "Tabs" + ".Tab" (5 states)

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-tabs>` |
| **Base class** | `SherpaElement` |
| **Semantics** | `role="tablist"` on tab strip; each tab is `role="tab"` with `aria-selected`; panels are `role="tabpanel"` |
| **Templates** | `default` — tab strip + content area |
| **Host attributes** | `data-active-tab` (index or id), `data-variant` (default/underline) |
| **Slots** | Named slots per tab panel (`<div slot="tab-1">`) or dynamic via JS |
| **Events** | `tab-change` — `{ index, id, previousIndex }` |
| **CSS states** | Active tab via `:host([data-active-tab])` → `.tab[data-active]`; inactive uses opacity-based inactive tokens |
| **Approach** | Light-DOM tab buttons projected via slot; shadow DOM manages active indicator position. Tab panels are slotted light-DOM content switched by CSS visibility. |

### 5.3 sherpa-breadcrumbs

**Maps to**: Figma "Breadcrumbs" (Expanded/Collapsed) + ".Breadcrumb" (Historic/Current)

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-breadcrumbs>` |
| **Base class** | `SherpaElement` |
| **Semantics** | `<nav aria-label="Breadcrumb">` wrapping `<ol>` |
| **Templates** | `default` |
| **Host attributes** | `data-max-items` (number, triggers collapse), `data-separator` (default: chevron) |
| **Slots** | Default slot for `<a>` or `<span>` breadcrumb items |
| **CSS states** | Last child auto-styled as current (`:last-child` rule), collapsed middle items via CSS `:nth-child` when `data-collapsed` |
| **Events** | Standard anchor `click` — no custom events needed |

### 5.4 sherpa-list-item

**Maps to**: Figma "List item" (Default/Hover/Active/Inactive)

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-list-item>` |
| **Base class** | `SherpaElement` |
| **Templates** | `default` — icon + label + description + trailing content |
| **Host attributes** | `data-label`, `data-description`, `data-icon`, `data-active`, `data-interactive`, `disabled` |
| **Slots** | `leading` (icon/avatar), default (label override), `trailing` (badge/action) |
| **Events** | `click` (native, no custom event needed) |
| **CSS states** | `:host(:hover)`, `:host([data-active])`, `:host([disabled])` |

### 5.5 sherpa-loader

**Maps to**: Figma "Loader" (H/V × Panel) + ".spinner" (3 sizes)

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-loader>` |
| **Base class** | `SherpaElement` |
| **Templates** | `default` — spinner + optional label + optional panel |
| **Host attributes** | `data-size` (small/default/large), `data-label` (loading text), `data-panel` (boolean — show card panel), `data-orientation` (horizontal/vertical) |
| **Semantics** | `role="status"`, `aria-live="polite"`, `aria-label` |
| **CSS** | Spinner uses CSS `@keyframes` rotation. `--sherpa-surface-control-primary-*` for spinner track/fill. |

### 5.6 sherpa-progress-bar

**Maps to**: Figma "Progress Bar" (Determinate/Indeterminate)

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-progress-bar>` |
| **Base class** | `SherpaElement` |
| **Semantics** | `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |
| **Templates** | `default` — track + fill |
| **Host attributes** | `data-value` (0-100), `data-variant` (determinate/indeterminate), `data-status` (success/warning/critical), `data-label` (accessible text) |
| **CSS** | Fill width via `--_progress: attr(data-value type(<number>), 0)` or JS-set custom property. Indeterminate uses CSS `@keyframes`. Status colors via `--_status-*` token chain. |

### 5.7 sherpa-overlay

**Maps to**: Figma "Overlay"

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-overlay>` |
| **Base class** | `SherpaElement` |
| **Templates** | `default` — full-viewport scrim |
| **Host attributes** | `data-visible`, `data-opacity` (light/dark/none) |
| **Events** | `click` on scrim → `overlay-dismiss` |
| **CSS** | Fixed positioning, `z-index`, backdrop colour via `--sherpa-core-color-basic-transparent-*`. Fade-in/out via CSS transitions. |

### 5.8 sherpa-panel

**Maps to**: Figma "Inline Panel" (3 states) + "Overlay Panel" (1 state)

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-panel>` |
| **Base class** | `SherpaElement` |
| **Templates** | `inline`, `overlay` — two structural variants |
| **Host attributes** | `data-variant` (inline/overlay), `data-position` (left/right), `data-expanded`, `heading`, `data-width` |
| **Slots** | `header` (override), default (panel content), `footer` (action bar) |
| **Internal composition** | Uses `sherpa-header` and optionally `sherpa-footer` internally |
| **Events** | `panel-toggle` — `{ expanded }`, `panel-close` |
| **CSS** | Inline variant uses CSS grid column sizing. Overlay uses fixed positioning + `sherpa-overlay`. Collapse/expand via CSS transitions on `width`/`transform`. |

### 5.9 sherpa-popover

**Maps to**: Figma "Popover" + ".Popover Header"

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-popover>` |
| **Base class** | `SherpaElement` |
| **Semantics** | Uses native `popover` attribute (Popover API) |
| **Templates** | `default` — header + content area |
| **Host attributes** | `data-position` (top/bottom/left/right), `heading`, `data-anchor` (CSS anchor name) |
| **Slots** | `header`, default (content) |
| **CSS** | CSS anchor positioning (like sherpa-menu). Elevation shadow. Arrow/caret with CSS `:before`. |
| **Notes** | Distinct from sherpa-menu: general-purpose content container vs. structured menu items |

### 5.10 sherpa-product-bar

**Maps to**: Figma "Product Bar"

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-product-bar>` |
| **Base class** | `SherpaElement` |
| **Templates** | `default` — product icon + product name + nav items |
| **Host attributes** | `data-product-name`, `data-product-icon` |
| **Slots** | `icon`, `actions` (right-aligned items) |
| **CSS** | Uses `--sherpa-surface-app-product-bar-*` tokens (already defined in all 3 themes) |

### 5.11 sherpa-slider

**Maps to**: Figma "Slider" (Single/Dual × Active/Inactive)

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-slider>` |
| **Base class** | `SherpaElement` |
| **Semantics** | `role="slider"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |
| **Templates** | `default` — track + fill + handle(s) + optional labels |
| **Host attributes** | `data-type` (single/range), `data-min`, `data-max`, `data-step`, `data-value` (single), `data-value-low`/`data-value-high` (range), `disabled`, `data-show-labels` |
| **Events** | `input` (while dragging), `change` (on release) — `{ value }` or `{ low, high }` |
| **CSS** | Track/fill coloured via `--sherpa-surface-control-primary-*`. Handle uses `--sherpa-surface-control-*` with hover/active states. |
| **Complexity** | Pointer event handling for drag, keyboard support (arrow keys), dual-handle collision avoidance |

### 5.12 sherpa-file-upload

**Maps to**: Figma "File uploader" + "File drop zone" (4 states) + "File item" (4 states)

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-file-upload>` |
| **Base class** | `SherpaElement` |
| **Templates** | `default` — drop zone + file list area |
| **Host attributes** | `data-accept` (file types), `data-multiple`, `data-max-size`, `data-max-files`, `disabled` |
| **Internal elements** | `.drop-zone` (drag target), `.file-list` (repeat area with cloning prototype `.file-item-tpl`) |
| **Events** | `file-add` — `{ files }`, `file-remove` — `{ file }`, `file-upload-start`, `file-upload-progress`, `file-upload-complete`, `file-upload-error` |
| **CSS states** | `.drop-zone` states via `:host([data-drag-over])`, `:host([data-uploading])`, `:host([data-error])`. File items via `[data-state]` on cloned elements. |
| **Complexity** | Drag & drop API, File API, progress tracking, error states per file |

### 5.13 sherpa-input-date-range

**Maps to**: Figma "Date Range Picker"

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-input-date-range>` |
| **Base class** | `SherpaInputBase` |
| **Templates** | `default` — start date input + separator + end date input |
| **Host attributes** | Inherited input attrs + `data-value-start`, `data-value-end`, `min`, `max` |
| **Events** | `change` — `{ start, end }` |
| **Notes** | Composes two native date inputs. Consider reusing sherpa-input-date internally. |

### 5.14 sherpa-callout

**Maps to**: Figma ".Callout" (6 statuses × Expanded/Collapsed + Custom variants)

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-callout>` |
| **Base class** | `SherpaElement` |
| **Templates** | `default` — icon + heading + body + optional action |
| **Host attributes** | `data-status` (info/warning/critical/success/neutral/tip), `data-expanded` (for collapsible), `data-dismissible`, `heading` |
| **Slots** | `heading`, default (body content), `action` |
| **Events** | `dismiss`, `toggle` |
| **CSS** | Status-driven via standard `--_status-*` token chain. Expandable uses `<details>`/`<summary>` or CSS height transition. |
| **vs sherpa-message** | Message is for transient alerts/notifications; Callout is for persistent inline contextual information. Different visual treatment. |

### 5.15 sherpa-widget

**Maps to**: Figma "Widget"

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-widget>` |
| **Base class** | `SherpaElement` |
| **Templates** | `default` — header + content area |
| **Host attributes** | `heading`, `data-size` (small/medium/large), `data-loading` |
| **Slots** | `header`, default (widget content), `footer` |
| **CSS** | Card-like styling, elevation. Loading state shows sherpa-loader internally. |
| **vs sherpa-data-viz-container** | Container is for dashboard grid layout; Widget is a consumer-facing card with built-in loading state and sizing. |

### 5.16 sherpa-progress-tracker

**Maps to**: Figma "Progress Tracker" (Vertical) + ".milestone" (5 statuses)

| Aspect | Detail |
|---|---|
| **Tag** | `<sherpa-progress-tracker>` |
| **Base class** | `SherpaElement` |
| **Templates** | `default` — vertical timeline with milestone nodes |
| **Host attributes** | `data-orientation` (vertical, horizontal TBD) |
| **Internal** | Milestone items rendered from data via cloning prototype |
| **Methods** | `setMilestones([{ label, status, description }])` |
| **CSS states** | Milestones coloured via `[data-status]` (default/in-progress/success/warning/critical) on each milestone element |
| **vs sherpa-stepper** | Stepper is linear task progression (numbered steps). Tracker is status-oriented timeline (milestones with individual statuses). |

---

## 6. Component Scaffold Checklist

For **every** new component, verify before marking complete:

- [ ] **Files**: `.html` + `.css` + `.js` + `component-doc.html` in `components/sherpa-{name}/`
- [ ] **HTML**: Template wrapped in `<template id="default">`; all visible elements in template (no `createElement` for structural DOM)
- [ ] **CSS**: `:host` base + `:host([hidden]) { display: none; }` + semantic tokens with hardcoded fallbacks
- [ ] **CSS**: All visibility via `:host([data-*])` selectors, no `.hidden` toggling
- [ ] **CSS**: `:host(:not(...))` functional form throughout
- [ ] **CSS**: Private custom properties use `--_` prefix
- [ ] **JS**: Extends `SherpaElement` (or `SherpaInputBase`); `cssUrl` + `htmlUrl` static getters
- [ ] **JS**: `observedAttributes` spreads `super.observedAttributes`
- [ ] **JS**: `onRender()` caches refs via `this.$()`, sets defaults
- [ ] **JS**: `onAttributeChanged()` dispatches to `#sync*()` methods
- [ ] **JS**: Events use `bubbles: true` (and `composed: true` when crossing shadow boundaries)
- [ ] **JS**: No `element.hidden = bool` on shadow internals
- [ ] **Registration**: `customElements.define()` at bottom of JS file
- [ ] **Index**: Added to `components/index.js` export
- [ ] **Accessibility**: Appropriate ARIA roles, labels, keyboard navigation
- [ ] **Tokens**: Uses `--sherpa-*` semantic tokens, never `--sherpa-core-*`
- [ ] **Doc**: File headers with JSDoc (html comment, css/js JSDoc block)
- [ ] **Figma parity**: All Figma variants mapped to `data-*` attribute combinations

---

## 7. Existing Component Upgrade Notes

These existing components need adjustments to reach full Figma parity:

### sherpa-message ↔ Banner
- Figma has both "Banner" and what maps to sherpa-message
- Verify: are they the same component or distinct? Banner may be a full-width variant of message
- Action: Add `data-variant="banner"` to sherpa-message if they share structure, or create separate component if significantly different

### sherpa-card ↔ Radio Card
- Figma has "Radio Card" and "Radio Card - Type 6" — selectable card variants
- Current sherpa-card has `selected` and `interactive` attributes — verify visual parity
- May need `data-type="radio"` variant with radio-specific styling

### sherpa-stepper ↔ Progress Steps
- Already built and likely a match — verify variant naming parity
- Figma: Horizontal/Vertical × Current/Inactive/Complete states
- sherpa-stepper: `data-current-step`, step state management — likely 1:1

### sherpa-barchart → Chart expansion
- Currently supports bar charts only
- Figma Charts page has: Area, Donut, Gauge, Line, Spline, Number/KPI
- Phase 5 covers new chart components
- Consider shared chart base class for common axis/legend/tooltip behaviour

### Date inputs
- sherpa-input-date and sherpa-input-time exist
- Figma shows: Date Picker (calendar UI), Date Range Picker, Date and Time Picker, Day Selector
- Current inputs use native browser pickers — Figma has custom calendar UI
- Decision needed: build custom calendar components or keep native pickers?

---

## Timeline Summary

| Phase | Components | Est. Duration | Dependencies |
|---|---|---|---|
| **Phase 1** — Core UI | accordion, tabs, breadcrumbs, list-item, loader, progress-bar | ~5 days | None |
| **Phase 2** — Layout | overlay, panel, popover, product-bar | ~4 days | None |
| **Phase 3** — Form/Interactive | slider, file-upload, input-date-range | ~6 days | Phase 1 (progress-bar for file-upload) |
| **Phase 4** — Informational | callout, widget, progress-tracker | ~3 days | None |
| **Phase 5** — Data Viz | 6 chart components | ~8-10 days | None |
| **Phase 6** — Polish | Docs, audit, scrollbar CSS | ~3 days | All phases |
| **Total** | **16 new + 6 charts + polish** | **~29-31 days** | |

---

> **Next step**: Begin Phase 1. Start with `sherpa-accordion` — get the Figma
> design context, build the component triad, and register it. Use this as the
> template for all subsequent components.
