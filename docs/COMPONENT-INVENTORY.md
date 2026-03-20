# Sherpa UI — Component Inventory

> Last updated 2026-06-18. Covers 35 of the 53 component directories under `components/`.
> Components added since the original audit (sherpa-accordion, sherpa-breadcrumbs,
> sherpa-callout, sherpa-chart-legend, sherpa-donut-chart, sherpa-file-upload,
> sherpa-gauge-chart, sherpa-input-date-range, sherpa-line-chart, sherpa-list-item,
> sherpa-loader, sherpa-panel, sherpa-popover, sherpa-product-bar, sherpa-progress-bar,
> sherpa-progress-tracker, sherpa-slider, sherpa-tabs) are not yet documented here.

---

## Base Classes

| Class | Location | Purpose |
|---|---|---|
| **SherpaElement** | `utilities/sherpa-element/sherpa-element.js` | Shared base for all components — template fetching, shadow DOM, multi-template support, slot presence detection, query helpers, status styling |
| **SherpaInputBase** | `utilities/sherpa-input-base/sherpa-input-base.js` | Abstract base for form inputs — label/description rendering, layout, disabled/readonly/required mirroring, value bridging, event re-dispatching |
| **ContentAttributesMixin** | `utilities/content-attributes-mixin.js` | Mixin for data-driven components — data provider registration, self-filtering via `containerfilterchange`/`globalfilterchange` events |

---

## Component Inventory

### 1. sherpa-barchart

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Adaptive bar chart with automatic orientation, stacked bars, category limiting, and responsive legend |
| **Base class** | `ContentAttributesMixin(SherpaElement)` |
| **Key attributes** | `data-orientation` (horizontal\|vertical), `data-compact`, `data-minimal`, `data-bar-count`, `data-series-count`, `data-loading` |
| **Events** | `sortchange`, `presentationchange` |
| **Maturity** | **Complete** |

---

### 2. sherpa-button

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Button with icon-start/end, label, menu trigger support; host IS the button (no inner `<button>`) |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-label`, `data-icon-start`, `data-icon-end`, `data-variant` (primary\|secondary\|tertiary), `data-size` (small\|default\|large), `data-menu`, `data-menu-template`, `data-event`, `disabled` |
| **Events** | `menu-select`, `menu-close`, `menu-open`, `menu-populate` |
| **Maturity** | **Complete** |

---

### 3. sherpa-card

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Card container with header (via internal sherpa-header), body, and footer slots |
| **Base class** | `SherpaElement` |
| **Key attributes** | `heading`, `description`, `selected`, `interactive`, `disabled`, `elevation` (none\|sm\|md\|lg), `status` (success\|critical\|warning\|info\|neutral) |
| **Slots** | `header`, default, `footer` |
| **Maturity** | **Complete** |

---

### 4. sherpa-data-viz-container

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` `config.json` |
| **Purpose** | Dashboard card with header and content area; content-agnostic layout with decoupled peer events |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-variant` (fit\|resizable\|fill), `data-col-span` (3\|6\|9\|12), `data-row-span`, `data-editable`, `title` |
| **Events** | Listens: `containerfilterchange`, `presentationchange`, `sortchange` |
| **Maturity** | **Complete** |

---

### 5. sherpa-container-pdf

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` `config.json` |
| **Purpose** | PDF export container — renders container data in a print-optimized layout (title, metrics, chart + table stacked) |
| **Base class** | `SherpaElement` |
| **Key attributes** | None (configured via `setData()` method) |
| **Maturity** | **Complete** |

---

### 6. sherpa-data-grid

| | |
|---|---|
| **Files** | `.html` `.css` `.js` |
| **Purpose** | Advanced data grid with grouping, selection, sorting, and pagination using native `<table>` |
| **Base class** | `ContentAttributesMixin(SherpaElement)` |
| **Key attributes** | Content attributes from mixin (`data-dataset`, `data-value-field`, etc.), plus grid-specific: selection, grouping, sorting, pagination state |
| **Events** | `selectionchange`, `sortchange`, `pagechange`, `groupexpand`, `groupcollapse`, `rowaction` |
| **Missing** | `component-doc.html` |
| **Maturity** | **Complete** (missing doc page only) |

---

### 7. sherpa-dialog

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Modal dialog built on native HTML `<dialog>` with sherpa-header and sherpa-footer |
| **Base class** | `SherpaElement` |
| **Key attributes** | `heading`, `subtitle`, `size` (small\|medium\|large\|full), `open`, `dismissible`, `status` |
| **Slots** | `heading`, default, `footer` |
| **Events** | `open`, `close` |
| **Maturity** | **Complete** |

---

### 8. sherpa-empty-state

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` `config.json` |
| **Purpose** | Empty-state placeholder with illustration, heading, description, action buttons |
| **Base class** | `SherpaElement` |
| **Key attributes** | `heading`, `description`, `illustration` (empty\|search\|error\|etc.), `small-print`, `status` |
| **Slots** | `illustration`, `heading`, `description`, default, `actions`, `footer` |
| **Maturity** | **Complete** |

---

### 9. sherpa-filter-bar

| | |
|---|---|
| **Files** | `.html` `.css` `.js` |
| **Purpose** | Horizontal filter bar with zoned slot layout; reads column metadata from query bundle via centralised data store |
| **Base class** | `SherpaElement` |
| **Key attributes** | None host-level; layout via slot zones |
| **Slots** | `toggle`, `group`, `sort`, `presets`, default (dynamic chips), `actions` |
| **Events** | `filterchange`, `filterclear`, `containerfilterchange` |
| **Missing** | `component-doc.html` |
| **Maturity** | **Complete** (missing doc page only) |

---

### 10. sherpa-footer

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` `README.md` |
| **Purpose** | Reusable footer component with multi-template variants (action-bar, slot passthrough) |
| **Base class** | `SherpaElement` |
| **Key attributes** | `type` (action-bar\|slot), `cancel-label`, `apply-label`, `show-cancel`, `show-apply`, `apply-closes` |
| **Events** | `footer-cancel`, `footer-apply` |
| **Maturity** | **Complete** |

---

### 11. sherpa-input-date

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Date input using native browser date picker |
| **Base class** | `SherpaInputBase` |
| **Key attributes** | Inherited: `label`, `description`, `layout`, `status`, `disabled`, `readonly`, `required`, `name`, `value`, `placeholder`. Extra: `min`, `max` |
| **Events** | `input`, `change` |
| **Maturity** | **Complete** |

---

### 12. sherpa-input-number

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Numerical input with stepper buttons |
| **Base class** | `SherpaInputBase` |
| **Key attributes** | Inherited base attrs. Extra: `min`, `max`, `step` |
| **Events** | `input`, `change` |
| **Maturity** | **Complete** |

---

### 13. sherpa-input-password

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Password input with show/hide toggle button |
| **Base class** | `SherpaInputBase` |
| **Key attributes** | Inherited base attrs |
| **Events** | `input`, `change` |
| **Maturity** | **Complete** |

---

### 14. sherpa-input-search

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Search input with magnifying glass icon and clear button |
| **Base class** | `SherpaInputBase` |
| **Key attributes** | Inherited base attrs |
| **Events** | `input`, `change`, `search` |
| **Maturity** | **Complete** |

---

### 15. sherpa-input-select

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Dropdown select using native `<select>` with custom chevron |
| **Base class** | `SherpaInputBase` |
| **Key attributes** | Inherited base attrs |
| **Methods** | `setOptions([{ value, label, disabled? }])` |
| **Events** | `change` |
| **Maturity** | **Complete** |

---

### 16. sherpa-input-text

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Basic text input (thin wrapper over SherpaInputBase) |
| **Base class** | `SherpaInputBase` |
| **Key attributes** | Inherited base attrs: `label`, `description`, `layout`, `status`, `disabled`, `readonly`, `required`, `name`, `value`, `placeholder` |
| **Events** | `input`, `change` |
| **Maturity** | **Complete** |

---

### 17. sherpa-input-time

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Time input using native browser time picker |
| **Base class** | `SherpaInputBase` |
| **Key attributes** | Inherited base attrs. Extra: `min`, `max`, `step` |
| **Events** | `input`, `change` |
| **Maturity** | **Complete** |

---

### 18. sherpa-key-value-list

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` `config.json` |
| **Purpose** | Semantic description list using native `<dl>`/`<dt>`/`<dd>` with layout and density options |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-layout` (horizontal\|vertical), `data-density` (compact\|base\|comfortable), `data-striped`, `data-bordered`, `data-truncate`, `data-key-width` |
| **Maturity** | **Complete** |

---

### 19. sherpa-menu

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Menu popover with light-DOM content projection; per-instance, CSS anchor positioning |
| **Base class** | `SherpaElement` |
| **Key attributes** | `popover` (auto) — uses native popover API |
| **Static API** | `SherpaMenu.getMenuTemplate(id)` — centralised menu templates (container, sort, filter, segment, timeframe) |
| **Events** | `menu-select` (with `data-event` auto-dispatch) |
| **Maturity** | **Complete** |

---

### 20. sherpa-menu-item

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Attribute-driven menu item with default/toggle/heading template variants |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-type` (heading\|default), `data-icon`, `data-action`, `value`, `data-selection` (radio\|checkbox\|toggle), `checked`, `disabled`, `data-description`, `data-group`, `data-keep-open`, `data-has-submenu` |
| **Maturity** | **Complete** |

---

### 21. sherpa-message

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Alert / notification message with status styling, heading, and action slots |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-status` (success\|critical\|warning\|info\|urgent), `data-dismissible`, `data-density` (compact\|comfortable) |
| **Slots** | `heading`, default, `action` |
| **Events** | `close` |
| **Maturity** | **Complete** |

---

### 22. sherpa-metric

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | KPI card with value, trend direction, delta, and sparkline |
| **Base class** | `ContentAttributesMixin(SherpaElement)` |
| **Key attributes** | `visible`, `metric-id`, `status`, `data-trend` (up\|down\|flat), `heading`, `value`, `delta`, plus content config attrs (`data-label`, `data-dataset`, `data-value-field`, `data-agg`, `data-segment-field`, `data-show-status`, etc.) |
| **Maturity** | **Complete** |

---

### 23. sherpa-nav

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` + nav template files (`dashboard-project-nav-template.html`, `n-central-nav-template.html`) |
| **Purpose** | Collapsible navigation sidebar with search, edit mode, drag-sort, accordion sections |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-src` (nav template URL), `data-home-href`. Wrapper attrs: `data-pinned`, `data-mode` (default\|search\|edit), `data-editable`, `data-searchable` |
| **Events** | `navhome`, `navsettings`, `navitemclick`, `navitemdelete`, `navpinchange`, `navmodechange`, `navsectionexpand`, `navsectionreorder`, `navfavoritechange`, `naveditconfirm`, `naveditcancel` |
| **Maturity** | **Complete** |

---

### 24. sherpa-nav-item

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Navigation item — attribute-driven with icon, label, badge; managed by parent sherpa-nav |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-variant` (section\|subsection\|child\|none), `data-state` (selected), `data-icon` (FA class), `data-badge` |
| **Parts** | `indicator`, `drag`, `icon`, `label`, `tag`, `chevron`, `delete` |
| **Maturity** | **Complete** |

---

### 25. sherpa-nav-promo

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Promotional callout for navigation footer with dismiss support |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-promo-title`, `data-promo-message`, `data-promo-link-text`, `data-promo-link-url`, `data-dismissed` |
| **Events** | `dismiss` |
| **Maturity** | **Complete** |

---

### 26. sherpa-pagination

| | |
|---|---|
| **Files** | `.html` `.css` `.js` |
| **Purpose** | Standalone pagination bar with page-size selector and page navigator |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-page`, `data-page-size`, `data-total-rows`, `data-allowed-sizes` |
| **Events** | `pagechange` |
| **Missing** | `component-doc.html` |
| **Maturity** | **Complete** (missing doc page only) |

---

### 27. sherpa-section-header

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Section heading with label, badge, description, and action slots |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-label`, `data-heading-level` (primary\|secondary\|tertiary), `data-divider` |
| **Slots** | `heading`, `badge`, `description`, `actions` |
| **Maturity** | **Complete** |

---

### 28. sherpa-sparkline

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | CSS-driven sparkline using segmented clip-path polygons; JS sets CSS custom properties, CSS renders |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-values` (comma-separated or JSON array), `data-variant` (bar), `data-unit` |
| **Maturity** | **Complete** |

---

### 29. sherpa-stepper

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Horizontal/vertical step progress indicator with numbered steps |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-current-step`, `data-linear`, `data-show-step-numbers`, `data-src` |
| **Methods** | `setSteps()`, `nextStep()`, `previousStep()`, `goToStep()`, `completeStep()`, `setStepError()` |
| **Events** | `step-change`, `step-click` |
| **Maturity** | **Complete** |

---

### 30. sherpa-switch

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Toggle switch (on/off) with disabled state |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-state` (on\|off), `disabled` |
| **Events** | `change` |
| **Maturity** | **Complete** |

---

### 31. sherpa-tag

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Compact label/badge with variant and status support; can collapse to circular indicator |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-variant` (primary\|secondary), `data-status` (critical\|info\|success\|warning\|urgent), `data-collapsed` |
| **Maturity** | **Complete** |

---

### 32. sherpa-toast

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Toast notification with auto-dismiss timer, positioning, and static factory methods |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-status` (info\|success\|warning\|critical\|urgent), `data-label`, `data-value`, `data-duration`, `data-timer-dismiss`, `data-show-close`, `data-position` |
| **Static API** | `SherpaToast.show()`, `.success()`, `.critical()`, `.warning()`, `.info()` |
| **Events** | `close`, `action` |
| **Maturity** | **Complete** |

---

### 33. sherpa-toolbar

| | |
|---|---|
| **Files** | `.html` `.css` `.js` |
| **Purpose** | Generic horizontal toolbar with leading/center/trailing content zones and optional filters row |
| **Base class** | `SherpaElement` |
| **Key attributes** | None (pure layout) |
| **Slots** | `leading`, `center`, `trailing`, `filters` |
| **Missing** | `component-doc.html` |
| **Maturity** | **Complete** (missing doc page only) |

---

### 34. sherpa-tooltip

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | Singleton tooltip with CSS anchor positioning and JS fallback |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-visible`, `data-position` |
| **Static API** | `Tooltip.show(anchor, text)`, `Tooltip.hide()` |
| **Declarative** | `data-tooltip="Help text"` on any element |
| **Maturity** | **Complete** |

---

### 35. sherpa-view-header

| | |
|---|---|
| **Files** | `.html` `.css` `.js` `component-doc.html` |
| **Purpose** | View header toolbar with edit mode, toggles, and settings (auto-fill, theme, density) |
| **Base class** | `SherpaElement` |
| **Key attributes** | `data-show-metrics`, `data-label`, `data-show-debug-toggles`, `data-favorite`, `data-edit-mode`, `data-scrolled` |
| **Maturity** | **Complete** |

---

## Summary Table

| # | Component | .html | .css | .js | doc | Maturity |
|---|---|---|---|---|---|---|
| 1 | sherpa-barchart | ✅ | ✅ | ✅ | ✅ | Complete |
| 2 | sherpa-button | ✅ | ✅ | ✅ | ✅ | Complete |
| 3 | sherpa-card | ✅ | ✅ | ✅ | ✅ | Complete |
| 4 | sherpa-data-viz-container | ✅ | ✅ | ✅ | ✅ | Complete |
| 5 | sherpa-container-pdf | ✅ | ✅ | ✅ | ✅ | Complete |
| 6 | sherpa-data-grid | ✅ | ✅ | ✅ | ❌ | Complete (no doc) |
| 7 | sherpa-dialog | ✅ | ✅ | ✅ | ✅ | Complete |
| 8 | sherpa-empty-state | ✅ | ✅ | ✅ | ✅ | Complete |
| 9 | sherpa-filter-bar | ✅ | ✅ | ✅ | ❌ | Complete (no doc) |
| 10 | sherpa-footer | ✅ | ✅ | ✅ | ✅ | Complete |
| 11 | sherpa-input-date | ✅ | ✅ | ✅ | ✅ | Complete |
| 12 | sherpa-input-number | ✅ | ✅ | ✅ | ✅ | Complete |
| 13 | sherpa-input-password | ✅ | ✅ | ✅ | ✅ | Complete |
| 14 | sherpa-input-search | ✅ | ✅ | ✅ | ✅ | Complete |
| 15 | sherpa-input-select | ✅ | ✅ | ✅ | ✅ | Complete |
| 16 | sherpa-input-text | ✅ | ✅ | ✅ | ✅ | Complete |
| 17 | sherpa-input-time | ✅ | ✅ | ✅ | ✅ | Complete |
| 18 | sherpa-key-value-list | ✅ | ✅ | ✅ | ✅ | Complete |
| 19 | sherpa-menu | ✅ | ✅ | ✅ | ✅ | Complete |
| 20 | sherpa-menu-item | ✅ | ✅ | ✅ | ✅ | Complete |
| 21 | sherpa-message | ✅ | ✅ | ✅ | ✅ | Complete |
| 22 | sherpa-metric | ✅ | ✅ | ✅ | ✅ | Complete |
| 23 | sherpa-nav | ✅ | ✅ | ✅ | ✅ | Complete |
| 24 | sherpa-nav-item | ✅ | ✅ | ✅ | ✅ | Complete |
| 25 | sherpa-nav-promo | ✅ | ✅ | ✅ | ✅ | Complete |
| 26 | sherpa-pagination | ✅ | ✅ | ✅ | ❌ | Complete (no doc) |
| 27 | sherpa-section-header | ✅ | ✅ | ✅ | ✅ | Complete |
| 28 | sherpa-sparkline | ✅ | ✅ | ✅ | ✅ | Complete |
| 29 | sherpa-stepper | ✅ | ✅ | ✅ | ✅ | Complete |
| 30 | sherpa-switch | ✅ | ✅ | ✅ | ✅ | Complete |
| 31 | sherpa-tag | ✅ | ✅ | ✅ | ✅ | Complete |
| 32 | sherpa-toast | ✅ | ✅ | ✅ | ✅ | Complete |
| 33 | sherpa-toolbar | ✅ | ✅ | ✅ | ❌ | Complete (no doc) |
| 34 | sherpa-tooltip | ✅ | ✅ | ✅ | ✅ | Complete |
| 35 | sherpa-view-header | ✅ | ✅ | ✅ | ✅ | Complete |

---

## Gaps & Notes

1. **Missing `component-doc.html`** (3 components): `sherpa-data-grid`, `sherpa-filter-bar`, `sherpa-pagination`, `sherpa-toolbar`
2. **Extra files**: `sherpa-data-viz-container`, `sherpa-container-pdf`, `sherpa-empty-state`, `sherpa-key-value-list` have `config.json`. `sherpa-footer` has `README.md`. `sherpa-nav` has extra nav template HTML files.
3. **All 35 documented components have complete `.html` + `.css` + `.js` triads** — no stubs or partial implementations.
4. **18 additional components** exist in the codebase but are not yet documented in this inventory (see header note).
5. **Inheritance hierarchy**: 7 input components extend `SherpaInputBase` (which extends `SherpaElement`). Data components use `ContentAttributesMixin(SherpaElement)`. All others extend `SherpaElement` directly.

---

## Component Categories

| Category | Components |
|---|---|
| **Data Visualization** | sherpa-barchart, sherpa-data-grid, sherpa-metric, sherpa-sparkline |
| **Layout / Container** | sherpa-data-viz-container, sherpa-container-pdf, sherpa-card, sherpa-toolbar |
| **Navigation** | sherpa-nav, sherpa-nav-item, sherpa-nav-promo |
| **Form Inputs** | sherpa-input-text, sherpa-input-number, sherpa-input-date, sherpa-input-time, sherpa-input-password, sherpa-input-search, sherpa-input-select, sherpa-switch |
| **Filtering** | sherpa-filter-bar |
| **Headers / Footers** | sherpa-footer, sherpa-section-header, sherpa-view-header |
| **Feedback** | sherpa-message, sherpa-toast, sherpa-empty-state, sherpa-tooltip |
| **Interactive** | sherpa-button, sherpa-menu, sherpa-menu-item, sherpa-dialog, sherpa-stepper, sherpa-pagination |
| **Display** | sherpa-tag, sherpa-key-value-list |
