# Apex ↔ Sherpa-UI Diff Report

**Generated:** 2026-07-30
**Sources:**
- Apex Storybook index (`storybook.n-able.dev/index.json`) — full component/token/pattern taxonomy
- Apex 2.0 Core Figma library (`K9CTAzip5gwJmhOQpyfbvM`) — 20 variable collections, 1,036 variables, 322 components / 307 component sets
- Sherpa-UI codebase (`Projects/sherpa-ui`) — 73 `sherpa-*` web components, 3-tier token system, 13 patterns, 23-tool MCP server

> **Purpose of Sherpa-UI:** re-implement the Apex Design System as zero-dependency Web Components, dropping the Tailwind + DevExtreme (Angular/DevExtreme) dependencies while preserving functionality and styling, on top of a re-architected multi-theme / brandable token system.

---

## 1. Executive summary

| Dimension | Apex | Sherpa-UI | Verdict |
|---|---|---|---|
| **Delivery** | Angular components + DevExtreme + Tailwind | Web Components (Custom Elements + Shadow DOM), zero runtime deps | Sherpa achieves the core goal — no framework/DevExtreme/Tailwind |
| **Component count** | ~55 documented components + ~15 charts + ~7 patterns | 73 `sherpa-*` components + 13 patterns | Sherpa has broad parity, plus net-new families |
| **Public API style** | Angular `@Input`/`@Output`, DevExtreme config objects | `data-*` attributes + CSS selectors + CustomEvents | Different paradigm, functionally equivalent |
| **Tokens** | Figma Variables → 20 collections, 5 themes, 3 densities | 3-tier (`--core-*`→`--sherpa-*`→`--_*`), 5 themes, aliasing | Sherpa's aliasing model is the stated upgrade |
| **Theming** | Apex 2.0 (Core/Blue/Purple/Teal) + Classic, Light/Dark | apex-2-core/blue/purple/teal + classic, light/dark/hc | Matches Apex themes 1:1, adds `hc` mode |

**Headline gaps (Apex features not yet in Sherpa):** Treeview, Advanced SelectBox (server-backed grid dropdown), Sliding Popup / Worksheet pattern, Tabbed View (routed), Context/Standard Menus as first-class components, Color Bar & Status Bar charts, Asset View pattern, Form pattern (directive-driven validation), Saved Views in Page Header.

**Net-new in Sherpa (no Apex equivalent):** the entire **node-graph subsystem** (canvas/node/socket/edge), **AI surface** (chat-message, prompt-composer, panel `ai` variant, proposal-preview/op), **app-shell / nav** system, calendar, slider, stepper, code-block, filter-bar.

---

## 2. Component-by-component mapping

Legend: ✅ full equivalent · 🟡 partial / different scope · ❌ missing in Sherpa · ➕ Sherpa-only

### 2.1 Apex components → Sherpa

| Apex component | Sherpa equivalent | Status | Notes |
|---|---|---|---|
| Buttons / Standard Button | `sherpa-button` | ✅ | Sherpa adds `data-count`, menu/split-button (`menu-*` events), status variants |
| Buttons / Dropdown Button | `sherpa-button` (`data-menu*`) + `sherpa-container-overlay` | 🟡 | Covered via button menu + overlay rather than a discrete component |
| Buttons / Floating Action Button | — | ❌ | No dedicated FAB |
| Buttons / Product Messaging Button | — | ❌ | No PM-specific button variant |
| Accordion | `sherpa-accordion` | ✅ | Native `<details>` based |
| Advanced Search | `sherpa-filter-bar` (partial) | 🟡 | Filter-bar covers field filtering; not a full search builder |
| Advanced SelectBox | `sherpa-input-select` (`data-template="tree"`) | 🟡 | Tree template exists; no server/grid-backed selection/toolbar |
| Treeview SelectBox / Treeview | `sherpa-input-select` tree | 🟡 | Basic tree only; standalone Treeview absent |
| Card / Default | `sherpa-container` | ✅ | Container = card/widget tile |
| Card / FeatureCard | `sherpa-container` (variant) | 🟡 | No dedicated FeatureCard styling |
| Card / KPI Card | `sherpa-metric` | ✅ | KPI value/trend/delta/sparkline |
| Card / UserCard | — | ❌ | No user/avatar card |
| Card / WizardCard | `sherpa-dialog` (`data-template="wizard"`) + `sherpa-stepper` | 🟡 | Wizard is a dialog template |
| Data Grid | `sherpa-data-grid` | 🟡 | Covers sort/group/select/actions/pagination. **Missing:** master-detail, filter builder, export, state-to-URL, virtual scroll, side panel, cell editing, nquery datasource |
| Date & Time / Date Picker | `sherpa-input-date` + `sherpa-calendar` | ✅ | |
| Date & Time / Date Range Picker | `sherpa-input-date-range` | ✅ | |
| Date & Time / Date Time Picker | `sherpa-calendar` (`data-mode="date-time"`) | ✅ | |
| Date & Time / Day Picker | `sherpa-select-group` (`data-template="weekdays"`) | 🟡 | Weekday selection; scheduler covers recurrence |
| Date & Time / Time Picker | `sherpa-input-time` | ✅ | |
| Dialog | `sherpa-dialog` | ✅ | Native `<dialog>`; sizes/status/wizard template |
| Divider | `sherpa-section-header` (`data-divider`) | 🟡 | No standalone `sherpa-divider` |
| Empty State | `sherpa-empty-state` | ✅ | |
| File Uploader | `sherpa-file-upload` | ✅ | Drag-drop + progress |
| Inputs / Number Box | `sherpa-input-number` | ✅ | |
| Inputs / Select Box | `sherpa-input-select` | ✅ | |
| Inputs / Text Area | `sherpa-input-text` (`data-multiline`) | ✅ | Auto-grow multiline |
| Inputs / Text Box | `sherpa-input-text` | ✅ | |
| Key-Value List | `sherpa-key-value-list` | ✅ | Semantic `<dl>` |
| Layout Grid (+ Item) | `sherpa-layout-grid` | ✅ | 12-col; adds editable/reorder |
| List | `sherpa-list` + `sherpa-list-item` | ✅ | Drag-drop, types, key-value |
| Loading / Load Panel | `sherpa-loader` (`data-panel`) + `sherpa-container-overlay` | 🟡 | Panel loader via attribute |
| Loading / Progress Bar | `sherpa-progress-bar` | ✅ | Determinate/indeterminate |
| Loading / Spinner | `sherpa-loader` | ✅ | |
| Menus / Context Menu | `sherpa-container-overlay` (`data-variant="menu"`) | 🟡 | Overlay covers menus; no right-click wiring |
| Menus / Standard Menu | `sherpa-container-overlay` + `sherpa-overlay-item` | 🟡 | |
| Message | `sherpa-message` | ✅ | Page/section banner |
| Page Header | `sherpa-view-header` | 🟡 | Title/favorite/edit/breadcrumbs/export. **Missing:** Saved Views |
| Page Title | `sherpa-view-header` / `sherpa-section-header` | ✅ | |
| Popover | `sherpa-container-overlay` (`data-variant="popover"`) + `sherpa-tooltip` | ✅ | |
| Scheduler | `sherpa-scheduler` | ✅ | Recurrence picker |
| Section Header | `sherpa-section-header` | ✅ | |
| Selection / Checkbox | `sherpa-select-checkbox` (+ `sherpa-select-group`) | ✅ | Indeterminate supported |
| Selection / RadioGroup | `sherpa-select-radio` + `sherpa-select-group` | ✅ | |
| Selection / Switch | `sherpa-switch` | ✅ | Simple + default variants |
| Sliding Popup | `sherpa-panel` (variant `overlay`) | 🟡 | Slide-in drawer; no maximize/minimize/full-screen/router-outlet |
| Tabs / Tab Panel | `sherpa-tabs` | ✅ | Lazy/eager load |
| Tabbed View (routed) | `sherpa-tabs` (partial) | 🟡 | No routing/load-mode/panel-content parity |
| Tag | `sherpa-tag` | ✅ | Adds brand status + collapsed |
| Toast | `sherpa-toast` | ✅ | |
| Toolbar | `sherpa-toolbar` | ✅ | |
| Tooltip | `sherpa-tooltip` | ✅ | Singleton |
| Transfer List | `sherpa-transfer-list` | ✅ | Two-pane shuttle |
| Treeview | — | ❌ | No standalone tree component |

### 2.2 Apex charts → Sherpa

| Apex chart | Sherpa equivalent | Status | Notes |
|---|---|---|---|
| Charts / Area | `sherpa-line-chart` (`data-variant="area"`) | ✅ | |
| Charts / Bar | `sherpa-barchart` | ✅ | Stacked/orientation/sort |
| Charts / Line | `sherpa-line-chart` | ✅ | |
| Charts / Doughnut | `sherpa-donut-chart` | ✅ | Donut + pie variants |
| Charts / KPI | `sherpa-metric` | ✅ | |
| Charts / Icon Number | `sherpa-metric` | 🟡 | Multi-value support to verify |
| Charts / Gauges / Circular Gauge | `sherpa-gauge-chart` | ✅ | Semicircular; solid/series |
| Charts / Sparklines / Area Sparkline | `sherpa-sparkline` | ✅ | line/bar variants |
| Charts / Color Bar | — | ❌ | No color-bar chart |
| Charts / Status Bar | `sherpa-progress-bar` (partial) | 🟡 | Segmented status-bar not a 1:1 match |
| Charts / Widget (empty/loading/menu) | `sherpa-container` + `sherpa-empty-state` + `sherpa-loader` | 🟡 | Composed from primitives |
| — | `sherpa-chart-legend` | ➕ | Standalone legend |

### 2.3 Apex patterns → Sherpa

| Apex pattern | Sherpa equivalent | Status |
|---|---|---|
| Patterns / Form (directives + validation) | `patterns/flows/*` + `FormManager` | 🟡 — no declarative directive validation |
| Patterns / Dashboard | `patterns/layouts/dashboard-grid` | ✅ |
| Patterns / Panel | `sherpa-panel` + `patterns/layouts/view-with-rails` | ✅ |
| Patterns / Wizard | `patterns/wizard-dialog.html` + `sherpa-stepper` | ✅ |
| Patterns / Worksheet (split/tabs/main) | — | ❌ — not needed (dumb wrapper) |
| Patterns / Asset View | — | ❌ |
| Patterns / Action Popup | `sherpa-container-overlay` | 🟡 |
| — | flows: add / edit / delete (CRUD) | ➕ |
| — | feedback: confirmation-dialog / loading-state | ➕ |
| — | layouts: app-shell / list-view / detail-view / settings-form / flex-truncate-row | ➕ |

### 2.4 Sherpa-only components (➕ no Apex equivalent)

| Family | Components | Purpose |
|---|---|---|
| **Node graph** | `sherpa-node`, `-canvas`, `-row`, `-socket`, `-header`* | Visual flow/graph editor |
| **AI surface** | `sherpa-chat-message`, `-prompt-composer`, `panel` (`ai`), `-proposal-preview`, `-proposal-op` | AI chat, prompt input, diff-style proposals |
| **App chrome** | `sherpa-app-shell`, `-nav`, `-nav-item`, `-nav-section`, `-product-bar-v2`, `-product-bar`* | App shell + nav + product bar |
| **Extra primitives** | `sherpa-calendar`, `-slider`, `-stepper`, `-code-block`, `-filter-bar`, `-callout`, `-pagination`, `-progress-tracker`, `-container-*`, `-overlay-item`, `-view-header` | Standalone controls Apex lacks or bundles |

*`sherpa-product-bar` and `sherpa-node-header` are deprecated (see [docs/DEPRECATIONS.md](docs/DEPRECATIONS.md)).

---

## 3. Missing in Sherpa (prioritised backlog)

**High-impact:** Data Grid parity (master-detail, virtual scroll, export, filter builder, state-to-URL, cell editing); Advanced SelectBox; standalone Treeview.
**Medium:** Asset View pattern; routed Tabbed View; Sliding Popup full parity; Page Header Saved Views; Form validation pattern.
**Lower:** FAB · UserCard · Product Messaging Button · standalone Divider · Color Bar / Status Bar charts · first-class Context Menu.

> Per project decisions: Data Grid is iterative/non-urgent; Advanced SelectBox + Treeview consolidate onto one `sherpa-tree` primitive; Worksheet is **not needed**; layout patterns are superseded by **App Shell v2** (see the plan).

---

## 4. Token architecture diff

| Aspect | Apex 2.0 (Figma) | Sherpa-UI (CSS) |
|---|---|---|
| **Tiers** | Primitives (396) → Alias (174) → per-component collections | `--core-*` → `--sherpa-*` → `--_*` |
| **Total variables** | 1,036 across 20 collections | generated from these |
| **Themes** | Core/Blue/Purple/Teal/Classic × Light+Dark (338 ea.) | apex-2-core/blue/purple/teal + classic × light/dark/**hc** |
| **Density** | Density (Alias): Base/Compact/Comfortable | density cascade layer |
| **Layout** | Layout: Large/Medium/Small (breakpoints) | container queries + `breakpoint/*` |
| **Status** | Status collection (info/critical/warning/urgent/success) | `[data-status]` → `--_status-*` inherited |
| **Brand** | `color/brand/*`, `color/accent/*`, adlumin-blue, `fonts/context/*` | `sherpa-brand-status.css` + aliasing |

**Alignment:** Apex alias names map directly onto Sherpa's `--sherpa-*` families. Multi-brand aliasing is the intended Sherpa upgrade and is present in Apex 2.0 too (Core/Blue/Purple/Teal + Classic).

**Flagged for Phase 1:** verify chart components consume the full `data-viz/*` palette (categorical 11 / sequential / divergent); map `fonts/context/{brand,mono,data}` typeface split; and reconcile `sherpa-platform.css` drift — font weights, motion, breakpoints **have Figma sources** but historically weren't generator-wired (breakpoints now are, via `token-overrides.json`).

---

## 5. Paradigm differences (intentional, not gaps)

| Concern | Apex | Sherpa |
|---|---|---|
| Component model | Angular + DevExtreme | Custom Elements + Shadow DOM |
| Config | `@Input`/`@Output`, DevExtreme options | `data-*` + CustomEvents (`composed`) |
| Visibility | Angular bindings, `*ngIf` | CSS `:host([data-*])`; JS never toggles display |
| Structure | Templates + directives | HTML `<template>` + cloning prototypes |
| Distribution | npm Angular packages | Zero-dependency ES modules |
| AI tooling | Apex MCP server | Sherpa MCP: 23 tools, 4 prompts, `sherpa://` resources |

---

## 6. Notes & caveats

- The Apex MCP docs page + live Storybook are client-rendered SPAs (WebFetch can't read them). This report is built from the machine-readable Storybook `index.json` + the Apex 2.0 Figma library (figma-console bridge) + direct reading of the Sherpa codebase. Per-component feature depth (e.g. every Data Grid capability) is inferred from the documented story/ADR list.
- Component counts: Apex "components" = documented Storybook entries, not Figma component-set variants (322/307 in Figma include icon/object/slot atoms).
