# Plan 691 — Action descriptions, in menu headers and tooltips

Will, 2026-11-03: *"When active (on by default) show a description subheading in the
menu header for all menus triggered by action buttons."* A second setting, which
needs the first, "Also show descriptions in Tooltips": a tooltip reads Name;
Description; Value; then any other text a component adds.

---

## Where it starts (read 2026-11-03)

| | |
|---|---|
| **Menu header** | `sherpa-menu` has a `.heading` (`data-heading`) and a `header` slot; no description. `sherpa-container-header` has the pattern: `data-description` → `.description`, under the title |
| **Action buttons** | A `sherpa-button` with a slotted menu opens it (`menu.show(this)`); it tells the menu nothing. No button carries a description today: the Filters button, Saved, ⋮ More actions, a section's ⋮, Show as, the View's options, the canvas options, the grid's select-all and row actions, the legend's Breakdown, Notifications |
| **Tooltips** | One mechanism: a `.tip` popover after a `.sherpa-anchor` (`top-layer-tips.ts`). A button's is `data-tip`, or its `aria-label` where it shows no label; a filter chip's is one string joined by " - " (`#writeTip`). Only a chart's tip has lines (`.chart-tip-label`, `.sherpa-tip-value`) |
| **An app-wide setting** | A root attribute on `<html>` and an inherited custom property, as `data-toggle-shapes` → `--sherpa-toggle-shape`. Demos' Accessibility page exists; its switches are not wired |
| **A field's description** | None: a page definition's field has no `description` |

## What it does

| | |
|---|---|
| **Words** | An action button says what it does in `data-description` — Sherpa's own buttons in their templates, an app's on its own |
| **Menu header** | The menu a button opens shows that description under its heading, as a subheading |
| **Tooltip** | With the second setting, a tip has lines: the Name; the Description; the Value; any other text. Off, it reads as today |
| **Settings** | `<html data-no-action-descriptions>` hides the subheading (on by default); `<html data-description-tips>` shows the tip's description line. Demos: two switches on Settings › Accessibility, the second needing the first |

## Steps

| Step | What | Done when |
|---|---|---|
| S1 ✅ | **Done 2026-11-03:** `sherpa-menu`'s `data-description` → `.description`, under the heading in one `.titles` box; `sherpa-button`'s `data-description`, set on the menu it opens; `openMore` takes its trigger's; `html[data-no-action-descriptions]` → `--sherpa-action-description: none`, written by `project-tokens.mjs` into `page.css`. `sherpa-menu`: `data-description`, a subheading under the heading; `sherpa-button`: `data-description`, handed to the menu it opens; the root attribute and its custom property | Specs: a button's menu shows its description; the attribute hides it |
| S2 ✅ | **Done 2026-11-03:** Filters, Saved, ⋮, a section's ⋮, the View's options, Show as, the canvas options, the legend's Breakdown. Words for Sherpa's own action buttons | Each menu above shows one |
| S3 | Tooltips in lines — a button's, a filter chip's — with the description line on the second setting | Specs: the order Name, Description, Value, other; off, as today |
| S4 | Demos: the two switches on Settings › Accessibility | Demos green in three engines |

## Decisions for Will

Answered, 2026-11-03: both A.

| # | Question | A (my pick) | B |
|---|---|---|---|
| D1 | Where a description is written | On the ACTION BUTTON (`data-description`): its menu's header and its tooltip read the one string | On each MENU: the header reads it; the tooltip needs a second copy on the button |
| D2 | Which tooltips get a description line | Buttons and filter chips: a field may declare a `description` in its page definition, and its chip's tip says it | Buttons only, for now; a chip's tip stays as it is |
