# Sherpa-UI Naming Standard (ratified 2026-09-02)

The one vocabulary across **Figma ↔ code ↔ spec**. Extends the Phase-0.5 ratified
contract in `CLAUDE.md` and `docs/COMPONENT-API-STANDARD.md`. Principle:
**Figma names where sensible, native HTML where sensible, consistent across ALL
components.** This is the Figma↔code PARITY work that precedes two-way sync.

Derived from a full audit of every component, 2026-09-02. 14 decisions ratified.
The audit's own proposal sections became the decisions below and were deleted
2026-09-16; its per-component gap table survives at the end of this file,
because that work is **not finished** — 14 files still use `data-variant`.

## Canonical names

| Concept | Canonical | Replaces | Native? |
|---|---|---|---|
| which kind (Figma `Type` axis) | `data-type` (Figma values, kebab) | data-variant(kind), data-role, data-style, tag data-collapsed | no |
| look-tier / colour emphasis | `data-look` = **`saturated` \| `transparent`** (unset = neutral) | button data-variant primary/secondary/tertiary | no |
| status colour cascade | `data-status` (KEEP) = critical\|warning\|success\|info\|urgent | — | no |
| toggle on/off | **native `checked` + `:checked`** | switch data-state=on/off | **yes** |
| selection (checkbox-style, may be multiple) | **`data-selected`** (native `:checked` where a real input exists) | data-active(as selected), data-state=on | prefer native |
| current/active item in a set (single) | **`data-current`** | data-active(as current) | no |
| pressed transient | native **`:active`** (no attr) | data-active(as pressed) | **yes** |
| dismissible | `data-dismissible` | data-removable, hasClose/hasDismiss | no |
| expand/collapse | boolean attr names the NON-DEFAULT opt-in state (native `[open]` rule): default expanded → keep `data-collapsed`; default collapsed → `data-expanded`. Prefer native `[open]` (`<details>`). | isMaximised (inv) | prefer native `[open]` |
| draggable | `data-draggable` | hasDragHandle | native where applicable |
| loading | `data-loading` | data-uploading, data-state=loading | no |
| icon glyph | `data-icon` / `data-icon-start` / `data-icon-end` (STRING) | tag boolean data-icon | no |
| primary text | **`data-heading`** | data-title, data-heading(nav-section) | no |
| secondary text | `data-description` | data-sublabel, data-helper | no |
| curated pictograph | `data-illustration` (KEEP, empty-state enum) | — | no |
| size | `data-size` = **`sm` \| `md` \| `lg`** (7-step only where Figma defines it) | small/default/large, sm/base/lg | no |
| orientation | `data-orientation` = horizontal \| vertical | data-layout, stacked | no |
| calendar view | `data-view` = day \| month \| year | data-layout(calendar) | no |
| form value/bounds | **native `value`/`min`/`max`/`step`** | data-value/min/max/step on form ctx | **yes** |
| fill/fit sizing | **pure CSS** (`fit-content`=hug, `stretch`=fill) — NO attr | container data-variant=fill/fit | CSS |
| overlay empty/error | **slot-driven** (`:has()`); loading via `data-loading` | data-state=loading/empty/error | CSS |
| bespoke data | keep distinct names where genuinely distinct data | — | — |

## Ratified decisions (D1–D14)
- **D1/D11 Switch → native `<input type=checkbox role=switch>` + `:checked`** (drops data-state; form-association + keyboard free). A real component rebuild.
- **D2/D12 Container splits into 5 SEPARATE components** (Figma AND code): container / dialog / panel / overlay-panel / accordion. dialog/overlay-panel → native `<dialog>`; accordion → native `<details>` (`[open]`, not data-expanded). NOT one component with a Type axis.
- **D3 Look-tier values = `saturated`/`transparent`** (Figma extension names) on `data-look`.
- **D4 One `data-selected`** for on/current; `data-active` retired; native `:active` for pressed.
- **D5 `data-heading`** for primary text (closer to Figma `heading`; pairs with `data-description`).
- **D6 Overlay states: slot-driven + `data-loading`** (no colliding data-content-state).
- **D7 fill/fit → pure CSS**, no public attr.
- **D8 `data-illustration` kept** separate from `data-icon`.
- **D9 Bespoke text props kept where genuinely distinct** (chat name/timestamp/message; KV key/value; metric value/delta) — align to heading/description only where it truly is heading/helper.
- **D10 Events de-prefixed to the concept** (`dismiss`, `item-click`, `back` — not container-header-dismiss).
- **D13 Sub-component tier:** base `SherpaElement` declares `static tier: 'standalone'|'sub-component' = 'standalone'`. A sub-component writes **`static override tier = 'sub-component' as const;`** (the `as const` is REQUIRED — a bare literal widens to `string` and fails to extend the base union) + `@tier sub-component` JSDoc. EXCLUDED from public catalog/sandbox picker (still registered to render inside parents). Source: `name-map.yaml tier:`.
- **Event de-prefix convention** (from D10 application): drop the element-name prefix, name by the CONCEPT. A row/item that fires on activation → `item-click`/`item-select`/`item-expand`/`item-drag` (list-item, nav-item, nav-section). Header actions → `dismiss`/`toggle`/`drag`. `view-header-back` → `back`. Components keep their own domain events (`nav-select`, `callout-dismiss`, `tab-change`).
- **D14 Native form attrs** (`value`/`min`/`max`/`step`) on form controls; drop data- prefix.

## Native-first (PE is law)
Build on the most specific native element (`element-map.yaml`); where a native state
exists, the public API IS the native attribute and CSS keys off the native pseudo
(`:checked`, `[open]`, `:disabled`, `:invalid`). Web APIs (Popover, `<dialog>`,
ElementInternals, `:state()`) before JS. `data-*` only for design axes with no native
equivalent. Native ALWAYS wins for: `disabled, hidden, required, readonly, name,
value, checked, open, multiple, min, max, step, placeholder, accept, draggable`.

### Known PE-drifts to fix (native-first rebuilds)
- switch → native checkbox (D1)
- container dialog/overlay-panel → `<dialog>`; accordion → `<details>` (D2)
- progress-bar → native `<progress>`
- tooltip / menus → Popover API

## Sub-component list (tier = sub-component)
list-item, nav-item, nav-section, grid-cell, container-header, container-footer,
chart-legend, select-checkbox, select-radio. (Ambiguous — confirm per component when
touched: tag, quick-filter.)

## Application order (lowest-risk first)
1. **Mechanical code-only renames:** data-title→data-heading, size→sm/md/lg,
   data-layout→data-orientation, boolean-verb unify, event de-prefix, `static tier`.
2. **Native-first rebuilds:** switch (checkbox), progress (`<progress>`), form-value
   attrs, tooltip/menu Popover.
3. **Structural / Figma-too:** container → 5 components (Figma split + code),
   calendar model (data-view + data-type single/range + native time), chat type.
4. Each step: update code + `*.component.yaml` spec + tests. Reforged e2e is 241/0 —
   renames re-fail attr/colour specs; budget a test sweep per step.

**Every rename must land in code AND the `*.component.yaml` contract AND (where noted)
Figma** — one vocabulary, all three surfaces.

---

## Per-component gap table — WHAT IS STILL OUTSTANDING

Carried over from the 2026-09-02 audit when the rest of it was deleted. This
is a worklist, not history.

**`data-variant` is DONE (2026-09-16)** — repo-wide count is 0. It took three
different answers, which is why it was not one rename: 8 components moved to
`data-type` (a kind), `sherpa-container`'s fill/fit became pure CSS with no
attribute, and `sherpa-transfer-list`'s four were inert attributes on child
buttons that had already moved to `data-look`.

**Still owed:** `data-title` → `data-heading` (2 files), and the rest of the
RENAME rows below.

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
