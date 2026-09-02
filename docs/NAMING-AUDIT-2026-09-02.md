# Sherpa-UI Naming-Alignment Audit + Proposed Standard

**Date:** 2026-09-02  **Scope:** all ~47 `sherpa-*` components — attribute names, variant values, state names, boolean props, modes.
**Status:** READ-ONLY analysis. No code, Figma, or config changed. Ratify §3 before any code pass.

**Guiding principle (fixed by user):** Use Figma axis names where it makes sense; use native HTML where a native equivalent exists (`disabled`/`name`/`value`/`required`/`readonly`/`checked`/`open`). One vocabulary across ALL components — if two components express the same concept, they use the same attribute name + pattern.

**Sources:** code = each component's HTML `Public API:` comment + `.ts` `@attr`/`@fires` + `.css` selectors + actual native elements in the template. Figma = `scripts/figma-data/live-components.json` (`variantAxes`, `booleanProps`, `textProps`). Mapping + TIER = each `*.component.yaml` `figmaName` and `scripts/figma-data/name-map.yaml` (`tier:`). Native basis = `scripts/figma-data/element-map.yaml` (`provides:`/`stateCss:`). Ratified baseline = `docs/COMPONENT-API-STANDARD.md §3.4` + `CLAUDE.md` "Naming contract (Phase 0.5)" + memory "Progressive enhancement is law".

**Three dimensions covered:** (1) naming — attributes/variants/states/booleans/modes; (2) TIER — standalone vs sub-component (design-only building block); (3) NATIVE-FIRST — the native HTML element + Web API each component should be built on, and where the native contract (`:checked`, `[open]`, `disabled`) dictates the naming.

---

## 1. Current vocabulary inventory (every distinct `data-*` in code)

### 1a. The "which kind of thing" concept — SPLINTERED across 4+ names (worst clash)

Figma names this axis **`Type`** on Button, Tag, Filter Toolbar, Container, Container Footer, Chat Message, Calendar, Grid Cell, Indicator. Code uses FIVE different attributes for the same concept:

| Code attribute | Components using it | Values | Figma axis it maps to |
|---|---|---|---|
| `data-variant` | button, container, donut-chart, line-chart, list, nav-item, sparkline | primary/secondary/tertiary (button) **mixed with** fill/fit (container), donut/pie, line/area, default/bordered/divided, promo, line/bar | **conflates look-tier AND Type** |
| `data-type` | button (icon), quick-filter (default/ai/populated), quick-filter-toolbar (data/view) | icon / default/ai/populated / data/view | Figma `Type` |
| `data-style` | input-text (minimal), switch (default) | minimal / default | Figma `Type`/variant |
| `data-role` | chat-message (assistant/user/system) | assistant/user/system | Figma `Type` = received/sent |
| `data-state` | container (loading/empty/error), progress-step-tracker (done/active/todo), switch (on/off) | loading/empty/error, done/active/todo, on/off | Figma `State` / `Value` |
| boolean `data-collapsed` | tag (dot indicator) | boolean | Figma Tag `Type` = dot/full |
| boolean `data-removable` | tag | boolean | Figma Tag `hasDismiss` |

**→ Same concept ("which kind") appears as data-variant, data-type, data-style, data-role, and even boolean data-collapsed. This is the single biggest inconsistency.**

### 1b. `data-variant` is overloaded — it means THREE different things

- **Look-tier / colour emphasis:** button `primary|secondary|tertiary|tertiary-on-color`.
- **Sub-type (a Figma `Type` axis):** donut `donut|pie`, line `line|area`, sparkline `line|bar`, nav-item `promo`.
- **Layout/fill behaviour:** container `fill|fit`, list `default|bordered|divided`.

Memory `sherpa-css-rewrite.md` already introduces **`data-look`** (`saturated`/`transparent`) internally as the look-tier routing in CSS, but it is NOT exposed as the public button attribute — button still ships `data-variant=primary|secondary|tertiary`. So look-tier lives under two names (`data-variant` public, `data-look` CSS-internal) that don't reconcile.

### 1c. `data-state` vs `data-status` overlap

- `data-status` = the status-cascade colour scheme (`critical|warning|success|info|urgent`). Used consistently by button, callout, tag, toast, progress-bar, gauge-chart, nav-item. **This one is healthy.**
- `data-state` = a grab-bag: container overlay (`loading|empty|error`), step tracker (`done|active|todo`), switch value (`on|off`). Three unrelated meanings under one name; also visually collides with `data-status`.

### 1d. Boolean-prop naming — inconsistent style + native-shadowing

| Concept | Code today | Figma | Native available? |
|---|---|---|---|
| expanded/collapsed | `data-collapsed` (container-header), `data-expanded` (list-item), `data-collapsed` (nav) | Container `expanded`, Accordion State | native `open`? no (not details) → but should be ONE name |
| dismissible | `data-dismissible` (callout, container-header), `data-removable` (tag) | `hasDismiss`, `hasClose` | none |
| selected | `data-selected` (list-item, select-card), `data-active` (list-item, quick-filter, nav-item) | — | none |
| checked | CSS `:checked` (select-checkbox/radio), `data-state=on` (switch) | `isChecked`, Switch `Value=on/off` | **native `checked`** |
| has-icon | `data-icon` (tag=boolean, but also glyph value elsewhere!), `data-has-icon` (auto) | `hasIcon` | none |
| multiple | `data-multiple` (select-card, select-group) | — | native `multiple` |
| draggable | `data-draggable` (container-header, list-item) | `hasDragHandle` | native `draggable` (diff meaning) |
| loading/busy | `data-loading`/`data-uploading`/`data-state=loading` | `hasLoadingBar` | none |

**`data-icon` is used for two different types:** a boolean toggle (tag: "show the leading icon slot") AND a glyph string value (nav-item, list-item, app-header, container-header). Type collision under one name.

### 1e. `data-active` vs `data-selected` vs `:checked` — the "on/selected" muddle

- `data-active` = pressed (button), selected chip (quick-filter), current row (list-item, nav-item), active tab is `data-active-id`.
- `data-selected` = selection (list-item, select-card).
- `:checked` = select-checkbox/radio (correct, native pseudo).
- `data-state=on` = switch.

Four names for "this thing is on/current/selected."

### 1f. Layout/orientation — three names for one axis

| Code | Components | Figma axis |
|---|---|---|
| `data-layout` | calendar (day/month/year — actually a *view mode*, not layout), key-value-list (horizontal/stacked), select-card (default/horizontal) | Input Text/Number/… `Layout` (vertical/horizontal) |
| `data-orientation` | chart-legend (horizontal/vertical), loader (horizontal/vertical) | Data Field/Chart Axis `Orientation` (vertical/horizontal) |
| — | | |

Figma itself is inconsistent: `Layout` on Input sets, `Orientation` on Data Field/Chart Axis. Code mirrors both. Also `stacked` (key-value-list) ≠ `vertical` (Figma) for the same idea.

### 1g. Title/heading text — inconsistent

`data-title` (app-header, callout, container-header, empty-state, section-header, list-item) vs Figma `heading` (Container Header, Callout, Section Header, Empty State) vs `data-label` (elsewhere) vs `data-heading` (nav-section). Figma textProp is `heading`; code says `data-title`.

### 1h. Full attribute inventory (concept → names in use)

- **label/title text:** data-label, data-title, data-heading, data-code, data-message, data-text, data-content, data-placeholder, data-value(chat none) — Figma: `label`, `heading`, `message`, `legend`.
- **description:** data-description, data-sublabel, data-helper, data-small-print(none) — Figma: `description`.
- **icon (glyph value):** data-icon, data-icon-start, data-icon-end, data-illustration — Figma: instanceProps `iconStart/iconEnd/glyph`.
- **icon (boolean toggle):** data-icon (tag), auto data-has-icon — Figma: `hasIcon`.
- **size:** data-size (button 2xs..3xl, loader small/default/large, empty-state/section-header sm/base/lg) — three different value scales!
- **status:** data-status (consistent) — Figma: Style status modes.
- **value/current:** data-value, data-current-page, data-current-step, data-active-id, data-state, checked.
- **layout/orientation:** data-layout, data-orientation, data-align, data-density, data-placement, data-panel.
- **sort:** data-sort-field/data-sort-direction (consistent, matches CLAUDE.md).

**Size-scale inconsistency:** button uses `2xs|xs|sm|md|xl|2xl|3xl`; loader uses `small|default|large`; empty-state/section-header use `sm|base|lg`. Three different enums for `data-size`.

---

---

## 1.9 Dimension A — Component TIER (standalone vs sub-component)

Some Figma components are **design-only building blocks** composed into a larger component, not standalone products. Signals: `(atom)`/`(Atom)` suffix, `Indicator`, "Item"/"Cell"/"Button"/"Section" leaf names, and `tier: sub-component` in `name-map.yaml`.

**Marked `sub-component` today** (name-map.yaml + figmaOnly atoms): `sherpa-list-item` (Menu List Item), `sherpa-chart-legend` (Legend Item), `sherpa-nav-section` (Navigation Section), `sherpa-nav-item` (Navigation Item), `sherpa-data-grid`/`sherpa-grid-cell` (Grid Cell). Figma-only atoms with no standalone code role: Indicator (atom), Checkbox (Atom), Radio (Atom), Progress Step (atom), Calendar Button, Data Field, Chart Axis, File Item, Tab, Connector (atom), Input Field (atom).

**Classification of the 47 TS components:**

| Tier | Components |
|---|---|
| **sub-component** (design-only leaf; composed INTO a parent, not used directly by app authors) | `sherpa-list-item`, `sherpa-nav-item`, `sherpa-nav-section`, `sherpa-chart-legend` (Legend Item), `sherpa-grid-cell`, `sherpa-select-checkbox`, `sherpa-select-radio` (atoms — Checkbox/Radio Atom), `sherpa-container-header`, `sherpa-container-footer` (Container parts), `sherpa-key-value-list`→ the *Pair* is the sub-component (list is composition), `sherpa-progress-step-tracker`→ Progress Step (atom) is the leaf |
| **standalone** (app authors drop it in directly) | button, tag, switch, container, callout, toast, tabs, tooltip, section-header, empty-state, breadcrumbs, toolbar, metric, code-block, loader, progress-bar, pagination, slider, file-upload, calendar, transfer-list, prompt-composer, app-header, nav (Primary Navigation), list, select-group (Fieldset), select-card, quick-filter, quick-filter-toolbar, data-grid, donut/line/bar/gauge/sparkline charts, chat-message, input-text |
| **ambiguous** (used both ways) | `sherpa-quick-filter` (Filter Chip atom — atom name but often used directly), `sherpa-tag` (atom-like but standalone), `sherpa-chart-legend` (Legend Item leaf, but chart-legend is the wrapper) |

**Proposed code convention for marking sub-components:**
1. **`static tier` on the class** — `static readonly tier = 'sub-component' | 'standalone'` (default `'standalone'` on `SherpaElement`). Cheap, introspectable, parseable by the MCP schema + the sandbox picker (which already hit this with grid-cell).
2. **Public index exclusion** — sub-components register their custom element (they must, to render inside parents) but are **omitted from the public component index / catalog / sandbox picker**. The sandbox lists only `tier==='standalone'`.
3. **JSDoc `@tier sub-component`** tag → MCP surfaces it on the schema (mirrors `@category`).
4. Keep the `name-map.yaml tier:` field as the source of truth; the `static tier` is generated from it in the compile step so the two never drift.

**Which current TS components to MARK as sub-component** (add `static tier='sub-component'` + `@tier` + exclude from picker): `sherpa-list-item`, `sherpa-nav-item`, `sherpa-nav-section`, `sherpa-grid-cell`, `sherpa-container-header`, `sherpa-container-footer`, `sherpa-chart-legend` (if it maps to Legend Item leaf), `sherpa-select-checkbox`, `sherpa-select-radio`. **Figma writes needed (follow-up):** add a sub-component marker (naming suffix already there for atoms; add a component-description `tier: sub-component` line) to: Menu List Item, Navigation Item, Navigation Section, Grid Cell, Container Header, Container Footer, Legend Item, Checkbox (Atom), Radio (Atom), Calendar Button, Progress Step (atom), Indicator (atom), Data Field, Chart Axis, File Item, Connector (atom), Tab, Input Field (atom).

---

## 1.10 Dimension B — Build on NATIVE HTML + Web APIs (progressive-enhancement basis)

Rule (from "PE is law" memory + `element-map.yaml`): **reach for the semantic native element and a Web API before a `<div>` + JS.** State should follow the native contract (`:checked`, `[open]`, `:disabled`, `:invalid`) — NOT a hand-rolled `data-state`.

**Native basis + PE-drift per component** (drift = reinvents something native provides):

| Component | Native element it SHOULD sit on | Web APIs | Uses today | PE-drift? |
|---|---|---|---|---|
| button | `<button>` | commandfor/popovertarget for menu/dialog | `<button>` | ✅ none |
| switch | **`<input type=checkbox role=switch>`** (or `<button role=switch aria-checked>`) → `:checked` | ElementInternals form-assoc | **`<button>` + data-state=on/off** | ⚠️ **DRIFT** — reinvents checkbox; should be `:checked`, native `checked` |
| select-checkbox / select-radio | `<input type=checkbox/radio>` + `<label>` → `:checked` | — | `<input>+<label>` | ✅ none |
| slider | `<input type=range>` | ElementInternals | `<input>` | ✅ (verify range) |
| input-text | `<input>` / `<textarea>` + `<label>` → `:invalid`,`:user-invalid` | ElementInternals form-assoc, constraint validation | `<input> <textarea> <label>` | ✅ none |
| container (dialog type) | **`<dialog>`** → `[open]`, `showModal()` | dialog modal/focus-trap/Esc; popover | **divs only** | ⚠️ **DRIFT** — dialog/overlay-panel Type should be native `<dialog>`; container has no dialog impl at all |
| container (accordion type) | **`<details><summary>`** → `[open]` | — | divs only | ⚠️ **DRIFT** — accordion Type → native details; use `[open]` not `data-expanded` |
| container-header / list-item (collapse) | `<button>` in a `<details>`/`aria-expanded` disclosure | — | `<button>` + data-collapsed/data-expanded | ⚠️ partial — disclosure could be `<details>` |
| progress-bar | **`<progress value max>`** → value-display | — | **divs only** | ⚠️ **DRIFT** — should wrap native `<progress>`; `data-value`→native `value` |
| gauge-chart | `<meter>` (or svg) | — | divs | minor — `<meter>` fits the value+status semantics |
| tooltip | **`popover` API** / anchor positioning | Popover API, CSS anchor | divs only | ⚠️ **DRIFT** — should use native `popover` not JS visibility |
| quick-filter menu / nav / any menu | **`popover`** + `command`/`commandfor` | Popover API | button/div | ⚠️ DRIFT where JS toggles a menu |
| toast | `<output role=status>` / `aria-live` region | — | `<button>`+div | minor — live-region semantics |
| callout / banner | `<aside role=note>` / `<div role=alert>` | — | div+button | minor |
| select-group (Fieldset) | **`<fieldset><legend>`** → group-disable | — | `<fieldset>` | ✅ none (good) |
| breadcrumbs | `<nav><ol><a>` | — | `<nav><a>` | ✅ (add `<ol>`) |
| nav / nav-item | `<nav>` + `<a>` (link) / `<button>` | — | `<nav><a>` / `<a>` | ✅ mostly |
| tabs | `<button role=tab>` + `role=tabpanel` | — | `<button>` | ✅ (verify roles) |
| pagination | `<nav>` + `<button>`/`<a>` | — | `<nav><button>` | ✅ |
| prompt-composer | `<form><textarea>` | constraint validation, submit | `<form><textarea>` | ✅ |
| file-upload | `<input type=file accept multiple>` | File API, drag-drop, DataTransfer | `<input>` | ✅ (native accept/multiple — see R10) |
| code-block | `<pre><code>` | Clipboard API for copy | button | ✅ (verify pre/code) |
| data-grid | `<table>` semantics (role=table) | — | button (sort headers) | ✅ (element-map has table roles) |
| calendar | `<button>` day cells; consider `<input type=date>` popover | — | `<button>` | ✅ |
| metric / key-value / chart-legend / empty-state / section-header / container-footer / toolbar / transfer-list / charts | divs / `<dl>`/`<dt>`/`<dd>` (key-value), `<table>` (grid) | container queries, structuredClone | divs | mostly OK — key-value should use `<dl>` |

**Biggest PE-drifts to fix (rank):** (1) **switch** — must become native checkbox+`:checked` (drives Decision D1 and removes `data-state=on/off`). (2) **container dialog/overlay-panel** — native `<dialog>` (missing entirely; drives D2). (3) **container accordion** — native `<details>` + `[open]`. (4) **progress-bar** — native `<progress>`. (5) **tooltip / menus** — native `popover` API instead of JS visibility toggles.

**Standard rule (native-first) to ratify:**
> Every component is built on the most specific native element that carries its behaviour (`element-map.yaml`). Where a native state exists, the PUBLIC API uses the native attribute and CSS keys off the native pseudo-class — `checked`/`:checked`, `open`/`[open]`, `disabled`/`:disabled`, `value`/`min`/`max`, `required`, `readonly`, `multiple`, `accept` — NOT a `data-*` re-invention. `data-*` is reserved for design-axis concepts with no native equivalent (`data-type`, `data-look`, `data-status`, `data-size`). Reach for a Web API (Popover, dialog, ElementInternals form-association, `:state()`, container queries) before hand-rolling JS.

---

## 2. Per-component gap table

Legend: **ALIGNED** (code = Figma), **RENAME** (concept ok, name differs), **MISSING** (Figma prop not in code), **EXTRA** (code-only, no Figma), **NATIVE-OK** (correctly native / correctly out-of-Figma-scope). Tier: **SA**=standalone, **SUB**=sub-component. Native/PE columns folded into the notes above (§1.10); the `PE-drift` flag is called out per row where relevant.

| Component (figmaName) | Figma axes / bools / text | Code data-* / state | Verdict |
|---|---|---|---|
| **sherpa-button** (Button) | Type=icon\|label; State=Default; hasIconStart/hasIconEnd/hasBadge; label | data-variant=primary\|secondary\|tertiary\|tertiary-on-color; data-type=icon; data-size; data-active; data-status; data-icon-start/-end; data-label | **RENAME**: Figma `Type=icon\|label` but code splits — `data-type=icon` only (label implicit) AND look-tier under `data-variant`. Figma has NO look-tier axis (it is a Style extension: Saturated/Transparent). Propose: `data-type=icon\|label`; look-tier → `data-look`. Badge MISSING (`hasBadge`→data-badge). |
| **sherpa-tag** (Tag) | Type=dot\|full; hasIcon/hasDismiss; label | data-collapsed(bool), data-removable(bool), data-icon(bool), data-status, data-label | **RENAME**: Figma `Type=dot\|full` → code boolean `data-collapsed`. `hasDismiss`→`data-removable` (should be `data-dismissible`). `hasIcon`→`data-icon` boolean (collides w/ glyph). |
| **sherpa-switch** (Switch) [SA] | Value=off\|on; hasLabel; | data-state=on\|off; data-style=default | **RENAME + PE-DRIFT**: Figma `Value=off\|on` → code `data-state` on a `<button>`. Should be native `<input type=checkbox role=switch>` + `checked`/`:checked`. `data-style` EXTRA. |
| **sherpa-loader** (Loading Spinner) | Size=lg\|md\|sm; hasLabel; label | data-size=small\|default\|large; data-orientation; data-panel | **RENAME**: size enum mismatch (small/default/large vs sm/md/lg). data-orientation/data-panel EXTRA (not in Figma). |
| **sherpa-input-text** (Input Field atom) | State=error\|default; hasLeadingIcon/hasTrailingIcon/hasActions | data-style=minimal; data-borderless; data-multiline; data-label; data-description; data-error | **RENAME/MISSING**: Figma `State=error\|default` → code has `data-error` string (ok-ish) + `:user-invalid`. `hasLeadingIcon/hasTrailingIcon`→ should be data-icon-start/-end. data-style/borderless/multiline EXTRA (1:many wrapper). |
| **sherpa-container** (Container) [SA] | Type=default\|dialog\|panel\|overlay-panel\|accordion; expanded | data-variant=fill\|fit; data-elevation; data-state=loading\|empty\|error; data-padding | **RENAME + MISSING + PE-DRIFT**: Figma `Type` (5 values incl dialog/accordion) NOT in code — code `data-variant=fill\|fit` is a different (layout) concept. dialog/overlay-panel Type should be native `<dialog>` ([open]); accordion Type should be `<details>` ([open], not data-expanded). `expanded`→native `[open]`. `data-state` overlay EXTRA. |
| **sherpa-container-header** (Container Header) | Variant=Default\|Panel; hasDragHandle/hasActions/hasIcon/hasMetadata; heading | data-title, data-description, data-icon, data-draggable, data-dismissible, data-collapsible, data-collapsed | **RENAME**: `heading`→data-title; `hasDragHandle`→data-draggable; Variant=Default\|Panel MISSING; `hasMetadata` MISSING. dismissible/collapsible EXTRA vs Figma. |
| **sherpa-container-footer** (Container Footer) | Type=action-bar | data-align=start\|end\|between | **RENAME/EXTRA**: Figma `Type=action-bar` not represented; data-align is EXTRA (reasonable but undocumented in Figma). |
| **sherpa-chat-message** (Chat Message) | Type=received\|sent; hasAvatar; name/timestamp/message | data-role=assistant\|user\|system; data-author; data-time; data-content | **RENAME**: `Type=received\|sent` → `data-role=assistant\|user\|system` (name + value mismatch). `name`→data-author, `timestamp`→data-time, `message`→data-content. |
| **sherpa-calendar** (Calendar) | Type=single\|range; hasTime | data-layout=day\|month\|year; data-value; data-min; data-max | **RENAME/DIVERGE**: recorded divergence — code models picker view (day/month/year) not selection mode (single/range). Figma `Type`+`hasTime` MISSING; code `data-layout` is a different axis. |
| **sherpa-data-grid / grid-cell** (Grid Cell) | Type=cell\|header\|group\|filter; hasCheckbox/hasActions | data-sort-field/data-sort-direction | **MISSING**: Grid Cell `Type` axis not on the grid host (grid is a table wrapper; cell type lives per-row). sort attrs ALIGNED w/ CLAUDE.md. |
| **sherpa-callout** (Callout) | heading | data-status, data-title, data-dismissible | **RENAME**: `heading`→data-title. status/dismissible fine (EXTRA vs Figma but standard). |
| **sherpa-toast** (Toast) | hasClose/hasAction; heading/value | data-status, data-message, data-duration | **RENAME**: `heading`→? code uses data-message (not data-title). `hasClose`→ (always on). value MISSING. |
| **sherpa-list-item** (Menu List Item) | hasDescription/hasLeadingIcon/hasDragHandle/hasLeadingControl/hasLeading/hasExpand; label/description | data-title, data-description, data-icon, data-active, data-interactive, data-draggable, data-expandable, data-expanded, data-selectable, data-selected | **RENAME**: `label`→data-title; `hasLeadingIcon`→data-icon; `hasDragHandle`→data-draggable; `hasExpand`→data-expandable. data-active vs data-selected both present (muddle). |
| **sherpa-list** (List) | — | data-variant=default\|bordered\|divided; data-empty | **EXTRA**: data-variant is code-only (List has no Figma axis). Rename to data-look? no — it's a divider style. Candidate `data-divider`/`data-bordered`. |
| **sherpa-nav-item** (Navigation Item) | hasIcon/hasIndicator/isMaximised | data-icon, data-label, data-badge, data-status-dot, data-description, data-active, data-href, data-variant=promo | **RENAME**: `isMaximised`→(nav data-collapsed inverse); `hasIndicator`→data-badge/data-status-dot; data-variant=promo is a Type. |
| **sherpa-nav** (Primary Navigation) | — | data-active-id, data-collapsed, data-searchable | **EXTRA/NATIVE-OK**: nav-level state, no Figma axis. `data-collapsed` vs Figma `isMaximised` (inverse polarity) — reconcile. |
| **sherpa-nav-section** (Navigation Section) | isMaximised | data-heading, data-active-id | **RENAME**: `data-heading`→data-title (consistency). isMaximised MISSING. |
| **sherpa-quick-filter** (Filter Chip atom) | State=default; hasMenu/hasIcon/hasIndicator/hasLabel; label | data-type=default\|ai\|populated; data-active; data-label; data-count; data-menu | **RENAME**: data-type values (default/ai/populated) are code-invented (Figma has no such axis — it's look via brand). `hasMenu`→data-menu ok; `hasIndicator`→data-count. data-active = selected. |
| **sherpa-quick-filter-toolbar** (Filter Toolbar) | Type=data\|view | data-type=data\|view | **ALIGNED** ✅ (model to follow). |
| **sherpa-select-checkbox** (Select Checkbox) | hasDescription; label/description | data-label, data-description; :checked | **ALIGNED-ish**: `hasDescription`→auto data-has-description; checked native ✅. |
| **sherpa-select-radio** (Select Radio) | hasDescription; label/description | data-label, data-description; :checked | **ALIGNED-ish** ✅ |
| **sherpa-select-group** (Fieldset) | hasDescription/hasValidation; legend/description/validation | data-label, data-description, data-multiple | **RENAME**: Figma `legend`→data-label; `validation`/`hasValidation` MISSING. data-multiple EXTRA (native `multiple`?). |
| **sherpa-select-card** (Select Card) | (no axes) | data-label, data-description, data-selected, data-multiple, data-layout=default\|horizontal | **EXTRA**: no Figma axes; data-layout code-only. |
| **sherpa-section-header** (Section Header) | hasDivider/hasActions/hasDescription; heading/description | data-title, data-size, data-divider | **RENAME**: `heading`→data-title; `hasDivider`→data-divider ok; description MISSING attr (slot). |
| **sherpa-empty-state** (Empty State) | hasSmallPrint/hasActions; heading/description | data-title, data-description, data-illustration, data-size=sm\|base\|lg | **RENAME**: `heading`→data-title; `hasSmallPrint` MISSING. illustration EXTRA. |
| **sherpa-metric** (Metric) | label/value/delta | data-label, data-value, data-delta, data-trend | **ALIGNED-ish** ✅ (data-trend EXTRA — derived from delta sign). |
| **sherpa-code-block** (Code Block) | hasHeader/hasLineNumbers; language | data-code, data-language | **RENAME/MISSING**: `hasLineNumbers`/`hasHeader` MISSING. language ALIGNED. |
| **sherpa-tooltip** (Tooltip atom) | label | data-text, data-placement | **RENAME**: `label`→data-text. placement EXTRA. |
| **sherpa-slider** (Slider) | label | data-label, data-min/max/step/value, data-show-value, data-value-readonly | **ALIGNED-ish**: label ok; min/max/step/value → native `min`/`max`/`step`/`value`? (see decisions). |
| **sherpa-progress-bar** (Progress Bar atom) [SA] | (no axes) | data-value, data-indeterminate, data-label, data-status | **PE-DRIFT**: divs only; should wrap native `<progress value max>`. `data-value`→native `value`; indeterminate = `<progress>` with no value. |
| **sherpa-tooltip** (Tooltip atom) [SA] | label | data-text, data-placement | **RENAME + PE-DRIFT**: `label`→data-text; visibility should use native `popover` API + CSS anchor positioning, not JS toggles. placement→anchor. |
| **sherpa-list-item** (Menu List Item) [SUB] | see below | see below | Mark `static tier='sub-component'`; exclude from picker. (details in main row below.) |
| **sherpa-progress-step-tracker** (Progress Steps) | (no axes) | data-current-step; per-step data-state=done\|active\|todo | **EXTRA**: data-state per step = internal. |
| **sherpa-pagination** (Pagination) | hasResults; pageSize/currentPage/totalPages | data-total-pages, data-current-page | **RENAME**: Figma `totalPages`/`currentPage` (camel) → data-total-pages/data-current-page (kebab) ✅ ok; `pageSize`/`hasResults` MISSING. |
| **sherpa-app-header** (App Header) | hasNotifications/hasLoadingBar | data-title, data-icon, data-notifications, data-loading, data-favorite | **RENAME**: `hasLoadingBar`→data-loading ok; data-favorite EXTRA. |
| **sherpa-toolbar** (Toolbar) | (no axes) | data-variant=plain\|bordered, data-density=comfortable\|compact | **EXTRA**: variant/density code-only. |
| **sherpa-key-value-list** (Key Value Pair) | key/value | data-layout=horizontal\|stacked | **RENAME**: `stacked`→`vertical` (Figma `Orientation` vocab). Also list vs pair mismatch. |
| **sherpa-chart-legend** (Legend Item) | hasValue; label/value | data-orientation=horizontal\|vertical | **RENAME**: orientation ok; Figma `hasValue`/label/value MISSING (legend is the wrapper). |
| **sherpa-donut-chart** (Donut Chart) | (no axes) | data-variant=donut\|pie, data-label, data-sublabel | **RENAME**: data-variant=donut\|pie is a Type → data-type. sublabel→data-description. |
| **sherpa-line-chart** / **barchart** / **sparkline** (Data Field) | Orientation=vertical\|horizontal | data-variant=line\|area (line), data-variant=line\|bar (sparkline), data-label, data-min/max | **RENAME**: chart kind under data-variant → data-type. Orientation MISSING. |
| **sherpa-gauge-chart** (Gauge Chart) | (no axes) | data-value, data-label, data-status, data-min/max | **ALIGNED-ish** ✅ |
| **sherpa-transfer-list** (Transfer List) | (no axes) | data-source-heading, data-target-heading | **EXTRA/OK**. |
| **sherpa-prompt-composer** (Prompt Composer) | hasLeadingActions; placeholder | data-placeholder | **ALIGNED-ish**: placeholder→native `placeholder`? |
| **sherpa-breadcrumbs** (Breadcrumbs) | (no axes) | content-driven | **ALIGNED** ✅ |
| **sherpa-tabs** (Tab Group) | (no axes) | data-active-id | **ALIGNED-ish** ✅ |
| **sherpa-file-upload** (File Uploader) | (no axes) | data-label, data-helper, data-max-size, data-accept, data-multiple, data-uploading, data-dragover | **RENAME**: data-accept/data-multiple → native `accept`/`multiple`. data-helper→data-description. |

**Fully aligned today (models to copy):** sherpa-quick-filter-toolbar (`data-type=data|view`), sherpa-breadcrumbs, sherpa-data-grid sort attrs, select-checkbox/radio checked-native.

---

## 3. Proposed standard (the core deliverable)

Extends `COMPONENT-API-STANDARD.md §3.4` and the ratified Phase-0.5 contract. For each concept: ONE canonical name + the rule + what it replaces.

### R1 — Variant/sub-type axis → `data-type`
**Rule:** When a Figma component has a `Type` axis (or an equivalent "which kind of this component" axis: `Variant`, `Orientation`-as-kind, `Role`), expose it as **`data-type`** with Figma's values verbatim (lowercased, kebab).
**Replaces:** `data-variant` (donut/pie, line/area, line/bar, container fill/fit→see R9), `data-role` (chat-message → `data-type=received|sent`), `data-style` (input-text minimal, switch), boolean `data-collapsed` on tag (→ `data-type=dot|full`).
**Examples:** button `data-type=icon|label`; tag `data-type=dot|full`; chat-message `data-type=received|sent`; container `data-type=default|dialog|panel|overlay-panel|accordion`; filter-toolbar `data-type=data|view` (already correct); donut `data-type=donut|pie`; chart `data-type=line|area|bar`.

### R2 — Look-tier (colour emphasis) → `data-look`
**Rule:** The look-tier (visual emphasis / colour treatment) is **`data-look`**, values `saturated | transparent` (+ neutral default when unset), matching the Figma **Style extension** (Saturated/Transparent) — it is NOT a Figma variant axis, so it must have its own public name distinct from `data-type`.
**Reconcile with code:** button's current `data-variant=primary|secondary|tertiary` collapses to: `primary`→`data-look=saturated`, `secondary`→neutral (default, has border), `tertiary`→`data-look=transparent`. This aligns the public name with the CSS-internal `data-look` already introduced in `sherpa-css-rewrite.md`.
**Replaces:** button `data-variant` (as look-tier), any component using data-variant for colour emphasis.
**Open point:** whether to keep the human-friendly `primary/secondary/tertiary` values on `data-look` instead of `saturated/transparent` — see Decision D3.

### R3 — Status colour cascade → `data-status` (KEEP AS-IS)
**Rule:** `data-status = critical | warning | success | info | urgent` — drives the `[data-status]` cascade. Already consistent. No change.
**Replaces:** nothing. This is the reference-good pattern; do NOT overload it with component overlay/step meanings.

### R4 — Interaction state → native pseudo-classes first, else `data-*` (NOT `data-state`)
**Rule:** Retire the overloaded `data-state`. Map each meaning to its proper home:
- **on/off toggle** (switch) → native **`checked`** + `:checked` (like select-checkbox/radio already). Figma `Value=on/off` maps to `checked` presence.
- **selected / current** → **`data-selected`** (single canonical) for selection; retire `data-active` as a synonym for selected. Keep `data-active` ONLY for the pressed/armed transient (button). Active *item in a set* stays `data-active-id` on the container.
- **container overlay** (loading/empty/error) → rename to **`data-status`**? No — these aren't status colours. Use **`data-content-state=loading|empty|error`** (explicit, non-colliding) OR drive from slot presence. (Decision D6.)
- **step progress** (done/active/todo) → keep internal `data-state` on the *step* element only (not a public host API); it is per-item internal.

### R5 — Boolean props → native attr if one exists, else `data-<x>` (visibility toggle), consistent verb
**Rule:**
- Figma `hasX` that maps to a **native** attribute → use the native bare attribute: `disabled`, `required`, `readonly`, `multiple`, `checked`, `open`, `hidden`, `draggable`, `placeholder`, `accept`, `min`/`max`/`step`/`value` (form fields).
- Figma `hasX` with **no native** → `data-<x>` boolean, canonical verb chosen once:
  - dismissible → **`data-dismissible`** (retire `data-removable` on tag; `hasDismiss`/`hasClose` → `data-dismissible`).
  - expanded/collapsed → **`data-expanded`** (retire `data-collapsed`; pick ONE polarity — expanded=present. Figma `expanded`/`isMaximised`→`data-expanded`; nav `data-collapsed`→`data-expanded` inverse).
  - drag handle → **`data-draggable`** (Figma `hasDragHandle`).
  - has-icon (glyph value) → **`data-icon` = the glyph string** (never a boolean). Presence of the value shows the icon. Retire tag's boolean `data-icon`; tag uses `data-icon="<glyph>"` like everyone else, and the auto `data-has-icon` handles the empty case.
  - loading/busy → **`data-loading`** (retire `data-uploading`, `data-state=loading`).

### R6 — Icon glyphs → `data-icon` / `data-icon-start` / `data-icon-end` (string values, KEEP)
**Rule:** Leading/trailing glyphs stay `data-icon-start`/`data-icon-end` (Figma instanceProps `iconStart`/`iconEnd`). Single leading glyph = `data-icon`. These are ALWAYS string values; never repurpose as booleans. `data-illustration` (empty-state) is a distinct concept (built-in pictograph) — keep, or fold into `data-icon`. (Decision D8.)

### R7 — Primary/secondary text → `data-label` + `data-description` (Figma `heading`→`data-label`)
**Rule:** Primary text label = **`data-label`**. Secondary/helper text = **`data-description`**. Map Figma textProps: `heading`/`legend`/`title`/`name` → `data-label`; `description`/`sublabel`/`helper`/`small-print` → `data-description`; `message`/`value`/`key` keep their own names where they are genuinely distinct data (metric value, key-value pair).
**Replaces:** `data-title` (app-header, callout, container-header, empty-state, section-header, list-item), `data-heading` (nav-section), `data-sublabel` (donut), `data-helper` (file-upload), chat `data-author`→`data-label`? (name is distinct — Decision D9).
**NOTE:** This is a big rename (`data-title`→`data-label` on 6 components). Weigh against churn (Impact §4).

### R8 — Size → single canonical scale `data-size`
**Rule:** ONE size enum across all components. Recommend **`sm | md | lg`** (map Figma `Size=sm|md|lg` on Loader directly). Button's `2xs|xs|sm|md|xl|2xl|3xl` is the Figma Control size-extension set — keep the extended set ONLY where Figma actually defines 7 sizes, but rename `default`→`md`, `small`→`sm`, `large`→`lg`, `base`→`md` everywhere else so no component invents its own words.
**Replaces:** loader `small|default|large`, empty-state/section-header `sm|base|lg` → `sm|md|lg`.

### R9 — Layout / orientation → `data-orientation = horizontal | vertical`
**Rule:** The horizontal/vertical axis is **`data-orientation`** with values `horizontal | vertical` (Figma `Orientation` on Data Field/Chart Axis). Figma's `Layout=vertical|horizontal` on Input sets is the same concept → also `data-orientation`.
**Replaces:** `data-layout` (key-value-list horizontal/stacked → horizontal/vertical; select-card default/horizontal), `data-orientation` (already correct on chart-legend/loader). Retire the value `stacked` → `vertical`.
**EXCEPTION:** calendar `data-layout=day|month|year` is NOT orientation — it's a picker *view mode*. Rename to **`data-view=day|month|year`** and separately add Figma's `data-type=single|range` + native/`data-time`. (This resolves the recorded divergence.)
**EXCEPTION:** container `data-variant=fill|fit` is sizing behaviour, not orientation → **`data-fit=fill|fit`** or fold into layout tokens. (Decision D7.)

### R10 — Where native ALWAYS wins (never `data-*`, never `hasX`)
`disabled`, `hidden`, `required`, `readonly`, `name`, `value`, `checked`, `open`, `multiple`, `min`, `max`, `step`, `placeholder`, `accept`, `draggable`. Figma `isChecked`→`checked`; Figma `Value=on/off`→`checked`; Figma numeric text props on form fields → native `value`/`min`/`max`.

### R12 — Component tier → `static tier` + picker exclusion (Dimension A)
**Rule:** Every component declares `static readonly tier: 'standalone' | 'sub-component'` (default `standalone` on `SherpaElement`), generated from `name-map.yaml tier:`. Sub-components register their element (needed to render inside parents) but are **excluded from the public catalog / sandbox picker** and carry `@tier sub-component` in JSDoc. See §1.9 for the list.

### R13 — Native-first basis (Dimension B)
**Rule:** Build on the most specific native element from `element-map.yaml`; where a native state exists, the public API IS the native attribute + CSS keys off the native pseudo-class (`:checked`, `[open]`, `:disabled`, `:invalid`). `data-*` only for design axes with no native equivalent. Reach for a Web API (Popover, `<dialog>`, ElementInternals, `:state()`) before JS. See §1.10 for per-component basis + drift.

### R11 — Events (KEEP ratified rule) — unprefixed `noun-verb`
Already largely compliant. Two nits to fix in the code pass: several events ARE prefixed with the component name (`container-header-dismiss`, `nav-item-click`, `list-item-click`, `view-header-back`) — the ratified rule says unprefixed `noun-verb`. Normalize to the concept, not the element (`dismiss`, `item-click`, `back`), OR ratify that compound-noun components keep their prefix (Decision D10). `callout-dismiss`, `favorite-toggle`, `page-change`, `tab-change`, `nav-select` are fine.

### Canonical-name summary table

| Concept | CANONICAL | Replaces | Native? |
|---|---|---|---|
| which kind (Type axis) | `data-type` | data-variant(kind), data-role, data-style, tag data-collapsed | no |
| look-tier / emphasis | `data-look` (saturated\|transparent) | button data-variant(primary/sec/tert) | no |
| status colour | `data-status` | — (keep) | no |
| toggle on/off | native `checked` | switch data-state=on/off | **yes** |
| selected | `data-selected` | data-active(as selected) | no |
| pressed transient | `data-active` | — (narrow it) | no |
| dismissible | `data-dismissible` | data-removable, hasClose | no |
| expanded | `data-expanded` | data-collapsed, isMaximised (inv) | no |
| draggable | `data-draggable` | hasDragHandle | (native diff) |
| loading | `data-loading` | data-uploading, data-state=loading | no |
| icon glyph | `data-icon` / `-start` / `-end` (string) | tag boolean data-icon | no |
| primary text | `data-label` | data-title, data-heading | no |
| secondary text | `data-description` | data-sublabel, data-helper | no |
| size | `data-size` = sm\|md\|lg (7-step only where Figma defines) | small/default/large, sm/base/lg | no |
| orientation | `data-orientation` = horizontal\|vertical | data-layout, stacked | no |
| calendar view | `data-view` = day\|month\|year | data-layout(calendar) | no |
| form value/bounds | native value/min/max/step | data-value/min/max/step (form ctx) | **yes** |

---

## 4. Impact summary (blast radius, ranked)

**Components needing ANY rename:** ~38 of 47 (only breadcrumbs, quick-filter-toolbar, tabs, data-grid-sort, gauge-chart, metric, select-checkbox/radio, transfer-list are essentially clean).

**Highest-churn attributes (rank by # components touched):**
1. **`data-title` → `data-label`** — 6 components (app-header, callout, container-header, empty-state, section-header, list-item). Code-only + tests. *Highest blast radius single rename.*
2. **`data-variant` split into `data-type` + `data-look`** — 7 components (button, container, donut, line, sparkline, list, nav-item). Code + Figma-conceptual + tests. *Highest conceptual impact.* Note `sherpa-css-rewrite.md` already touched button CSS to `data-look` internally — partially staged.
3. **`data-state` retire** — 3 components (container, switch, step-tracker) + wherever CSS keys `[data-state="on"]` (8 CSS hits) / `[data-state="loading|empty|error"]`. Switch→native `checked` is also a JS/behaviour change.
4. **`data-layout`/`stacked`/`data-orientation` unify** — 5 components (calendar→data-view, key-value-list, select-card, chart-legend, loader).
5. **size enum unify** — 3 components (loader, empty-state, section-header).
6. **boolean verb unify** (dismissible/expanded/draggable/loading) — ~8 components.

**Split by change type:**
- **Code-only (attr rename in .ts/.html/.css, no Figma change):** data-title→data-label, size-enum, data-layout→data-orientation, data-state→data-content-state, boolean-verb unification, event de-prefixing. ~30 components.
- **Also Figma-rename / model-fix (Part 2 of DTCG naming pass):** calendar (add Type=single/range + hasTime; code models view) — this is a real Figma↔code MODEL divergence, already logged in calendar.thin.yaml. Container `Type` (5 values) is MISSING IN CODE entirely — code must ADD dialog/panel/overlay-panel/accordion, or Figma drops them. Chat `Type=received|sent` vs code role values — pick one side. These need the Figma leg, not just code.
- **Also test-updates:** every renamed public attr has e2e/unit assertions. `sherpa-css-rewrite.md` notes the reforged suite is 241/0 after the CSS rewrite; renames will re-fail colour/attr specs → budget a test-sweep. `.fallowrc.json` ts-suppression budget unaffected (rename ≠ suppression).

**Lowest-risk / do-first (pure code, high consistency win):** size-enum unify, `data-title`→`data-label`, boolean-verb unify, `static tier` marking (mechanical, 9 components). **Highest-risk / decide-first:** switch→native checked, container Type gap + native `<dialog>`/`<details>`, calendar model, button variant→type+look.

**Tier work (Dimension A):** ~9 TS components get `static tier='sub-component'` + `@tier` + picker exclusion (list-item, nav-item, nav-section, grid-cell, container-header, container-footer, chart-legend, select-checkbox, select-radio). Code-only + generator wiring; ~18 Figma components get a `tier` description marker (follow-up Figma write). Low code risk, unblocks the sandbox picker (which already broke on grid-cell).

**Native-first / PE-drift work (Dimension B):** 5 real drifts to fix — switch (→native checkbox, also a naming + JS-removal change), container dialog/overlay-panel (→`<dialog>`), container accordion (→`<details>`), progress-bar (→`<progress>`), tooltip/menus (→Popover API). Each is code + test; switch and container also touch Figma model. These are the highest-value quality wins and overlap the naming renames (native contract dictates the name, so doing them together avoids double-churn).

---

## 5. Open decisions for the human (ratify before code)

**D1 — Switch value: native `checked` or `data-state`/`data-checked`?**
Figma `Switch Value=off|on`. Native `checked` + `:checked` is cleanest (matches select-checkbox/radio) and lets CSS drive it with zero JS. But switch currently syncs `aria-checked` + emits change via JS. → **Recommend native `checked`.** Confirm.

**D2 — Container `Type` axis (dialog/panel/overlay-panel/accordion) is MISSING in code.**
Figma Container has 5 Type values; code `sherpa-container` only has `data-variant=fill|fit` (a different axis). Do we (a) build `data-type=default|dialog|panel|overlay-panel|accordion` in code (big feature add — dialog/accordion behaviours), or (b) accept these live as separate components / patterns and narrow Figma? This is the largest Figma↔code gap.

**D3 — Look-tier values: `saturated|transparent` (Figma extension names) or keep `primary|secondary|tertiary` (human-friendly)?**
`data-look` is agreed; the VALUES are the question. Figma Style extensions are named Saturated/Transparent. But `primary/secondary/tertiary` reads better and is what button ships. → Pick the value vocabulary.

**D4 — `data-active` vs `data-selected`: collapse to one, or keep two meanings?**
Proposal: `data-selected`=selection, `data-active`=transient pressed only. But quick-filter/nav-item/list-item currently use `data-active` for "selected/current." Confirm the split (renames those to `data-selected`), or keep `data-active` as the single "on/current" token.

**D5 — `data-title` → `data-label` (6 components) — worth the churn?**
Figma textProp is `heading`, code says `data-title`. Canonical is `data-label`. This is the single highest-churn rename. Ratify (a) rename all to `data-label`, (b) rename to `data-heading` (closer to Figma), or (c) keep `data-title` and ADD it to the shared vocab as the heading token.

**D6 — Container overlay state (loading/empty/error): `data-content-state`, keep `data-state`, or slot-driven?**
It collides with `data-status`. Pick the non-colliding name or drive from slot presence + `data-status` for error colour.

**D7 — Container `data-variant=fill|fit` (sizing): rename to `data-fit`, `data-layout`, or drop for CSS `fit-content`/`stretch`?**
`sherpa-css-rewrite.md` says `fit-content`=HUG, `stretch`=FILL — this could be pure CSS with no public attr. Decide if it stays a public API.

**D8 — `data-illustration` (empty-state built-in pictographs): keep separate or fold into `data-icon`?**
It's a curated enum (empty/search/folder/data/error/success), not an arbitrary glyph. Keep as its own attr, or unify under `data-icon` with reserved keywords.

**D9 — Chat-message `data-author`/`data-time` and Metric/Key-Value distinct text props: keep bespoke names or force `data-label`/`data-description`?**
Figma has `name`/`timestamp`/`message` (chat), `key`/`value` (KV), `value`/`delta` (metric). These are genuinely distinct data, not "label/description." Confirm they stay bespoke (recommend yes).

**D10 — Event names: de-prefix compound-noun components?**
Ratified rule = unprefixed `noun-verb`, but code has `container-header-dismiss`, `nav-item-click`, `list-item-click`, `view-header-back`. Ratify (a) strip to concept (`dismiss`, `item-click`), or (b) allow the element-name prefix for compound components as a documented exception.

**D11 — Switch as native `<input type=checkbox role=switch>` (+`:checked`) — accept the rewrite?**
This is both a naming decision (D1) AND a PE-drift fix: switch currently renders a `<button>` with JS-managed `data-state`. Native checkbox gives `:checked`, form-association, and keyboard for free. Confirm we rebuild switch on native checkbox (removes `data-state=on/off` entirely).

**D12 — Container dialog/overlay-panel → native `<dialog>`, accordion → native `<details>`?**
Ties to D2. The Figma `Type` values dialog/overlay-panel/accordion have native homes (`<dialog>` with `showModal()`/`[open]`; `<details><summary>` with `[open]`). Ratify that these Types are implemented on the native elements (state via `[open]`, not `data-expanded`), which also resolves the missing-in-code gap. Or keep them as separate pattern-level compositions.

**D13 — Sub-component marking mechanism: `static tier` + picker-exclusion + `@tier` JSDoc?**
Confirm the convention: `static readonly tier` on the class (generated from `name-map.yaml tier:`), omit `tier==='sub-component'` from the public catalog/sandbox picker, and add `@tier` to JSDoc for MCP. And confirm the sub-component LIST (§1.9): list-item, nav-item, nav-section, grid-cell, container-header, container-footer, chart-legend, select-checkbox, select-radio. Ambiguous ones to rule on: quick-filter (Filter Chip atom — atom-named but used directly), tag.

**D14 — Native form-value attrs (slider/progress/input/pagination): native `value`/`min`/`max`/`step` or keep `data-*`?**
slider uses `data-value/min/max/step` but sits on `<input type=range>` which has native `value`/`min`/`max`/`step`. Progress-bar `data-value` vs native `<progress value>`. Ratify: form-control numeric bounds use the NATIVE attribute (drops the `data-` prefix), per R10.

---

## Appendix — reference-good patterns to propagate
- `sherpa-quick-filter-toolbar`: `data-type=data|view` — exact Figma axis + values. **The template for R1.**
- `sherpa-data-grid`: `data-sort-field`/`data-sort-direction=asc|desc` — matches CLAUDE.md standard data attrs.
- `sherpa-select-checkbox`/`radio`: native `:checked` — **the template for R4/R10.**
- `data-status` cascade — **the template for R3** (leave untouched).
