# Sherpa-UI Naming Standard (ratified 2026-09-02)

The one vocabulary across **Figma ↔ code ↔ spec**. Extends the Phase-0.5 ratified
contract in `CLAUDE.md` and `docs/COMPONENT-API-STANDARD.md`. Principle:
**Figma names where sensible, native HTML where sensible, consistent across ALL
components.** This is the Figma↔code PARITY work that precedes two-way sync.

Derived from the full audit (`/tmp/naming-audit.md`, 2026-09-02). 14 decisions ratified.

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
