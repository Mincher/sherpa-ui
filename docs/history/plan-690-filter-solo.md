# Plan 690 — Solo a filter

Will, 2026-11-03: *"When this menu option is clicked all other filters are ignored
(shown as inactive) while the target filter is put into a Solo state with a distinct
styling for this state."* His answers: a solo respects its scope, with a second
setting, "Solo across all scopes", for user tests; it is for one tab, a temporary
draft; the icon is `solo` (an S in a box), drawn in Figma (node `1720:30462`).

---

## What it does

| | |
|---|---|
| **Settings** | "Allow filter soloing" (off by default), and "Solo across all scopes", which needs it |
| **Solo this filter** | A row in each chip's menu and each panel field's ⋮. Every OTHER filter in force in its scope — every scope, with the second setting — is switched off, its value kept; the soloed one is on, and in its Solo state |
| **Remove soloing** | The same menus, or the soloed chip's left half (its body). Switches back on ONLY what the solo switched off |
| **Per tab, never saved** | A View save, a draft and a kept entry read the Query as if no solo were on |

## How

| Layer | Change |
|---|---|
| **Data** (`QueryContext`) | `solo(scope, field, { across })`, `unsolo()`, `soloed`. One `batch()`: it suspends each other reading in force, raw — not `#standing`'s pruning, so a value is kept whole — and records which (as the bar Switch's `suspended: {fields}` does). `unsolo()` switches those back on, less any the reader switched on meanwhile. `export()` reads as if unsoloed. A View pick, a Reset or leaving the page ends it |
| **Provider** | `allowSolo` and `soloAcrossScopes`, offered to every bar and panel as `data-allow-solo` (as `data-move-filters` is) |
| **Toolbar** | The menu rows, gated on `data-allow-solo`; `#onMenuSelect` `solo` / `unsolo` → a `quick-filter-change` request → `bindSource` → the Query. It draws `data-solo` on the soloed chip; that chip's body click asks `unsolo` |
| **Chip** | `data-solo`: the `solo` icon at its start, and a Style mode pin in `state-pins.yaml` (`lint:css` forbids a colour rule) |
| **Demos** | The two switches on Settings › Filtering (`/filters/solo`, `/filters/soloAcross`, `data-setting-needs`), and `followSettings` |

## Steps

| Step | What | Done when |
|---|---|---|
| S1 ✅ | **Done 2026-11-03:** `QueryContext.solo`, `unsolo`, `soloed`; `export()` reads what a solo switched off as on; `setQuery` and `reset` end it; the `solo` icon in `src/icons/`. The data layer: `solo`, `unsolo`, `soloed`, `export()` without it | Node: a solo keeps every value whole, switches back only its own, and is never exported |
| S2 ✅ | **Done 2026-11-03:** `allowSolo`, `soloAcrossScopes` → `data-allow-solo`, `data-solo-across`; both rows in a chip's menu and a section's ⋮, CSS shows the one that applies; `{ solo, across }` / `{ unsolo }` requests; the scope's `soloed` marks the chip `data-solo` — the `solo` icon, the `info` pin; its body ends the solo. The provider, the toolbar, the panel, the chip | sherpa-ui specs: the rows show only with the setting; the Solo state; the body click ends it |
| S4 ✅ | **Done 2026-11-03, Will:** a third setting, "Place Solo button in Menu Header", which needs the first: Solo is an icon-only toggle in a filter menu's header, before its Advanced button, pressed while soloed; the menu stays open. Demos: soloing and the header toggle on by default (the library's stay off, as Move's) | Specs: no rows, the toggle before Advanced, pressed, the menu open; Demos green |
| S3 ✅ | **Done 2026-11-03:** Settings › Filtering's two switches (`/filters/solo`, `/filters/soloAcross`, which needs it), off by default; a spec on Records, three engines. Demos: the settings, and a spec on Records | Demos green in three engines |

## Decisions for Will

Answered, 2026-11-03: both A.

| # | Question | A (my pick) | B |
|---|---|---|---|
| D1 | A reload while soloed | The solo ends: every filter is back on. Nothing is written, so no filter is ever left off by a solo | The solo is kept in the tab's draft, and a reload keeps it |
| D2 | The Solo look | The `solo` icon at the chip's start, and a Style mode I pin now (`info`); you refine it in Figma after | You design the Solo chip in Figma first, and I wait |
