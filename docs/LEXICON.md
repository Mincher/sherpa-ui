# The lexicon — one name per idea

**For Will's approval (TODO 278).** One row per idea. Your yes to this table is
the bulk-rename yes for **its rows**, and nothing outside it is renamed. A
unit test (279) then holds every spec to it, with a baseline that may only fall.

Rulings it rests on: D5 (anything generic is elevated), D6 (native names where
a native element does the same job), and the tier rule in CLAUDE.md (a control
takes `data-label`, a container `data-heading`). No alias is kept: a renamed
name drops the old one in the same change (`T-a-rename-drops-the-old-name`).

Each row: **Today** (read from the specs, 2026-10-15) → **Rule** → **Moves**.
A row marked **❓** has a choice only you can make.

---

## 1. Value, range, bounds — D6

**Today.** `value` is native on slider, switch, progress-bar and the select
controls, but `data-value` on gauge, metric, calendar and toast. The slider's
range ends are `value-start`/`value-end` (unprefixed, and no native element has
them); the calendar's are `data-value-start`/`data-value-end`. `min`/`max` are
native on slider and input-text, `data-min`/`data-max` on gauge, calendar and
the charts.

**Rule.** A native element does the job → its native name, unprefixed: `value`,
`min`, `max`, `step` on gauge, metric, progress-bar, slider, input-text and
calendar (`<meter>`, `<progress>`, `<input type=range>`, `<input type=date>`).
A range's two ends have no native name → `data-value-start`/`data-value-end`
on every component that has them. A chart's axis bound is not a `<meter>`'s
→ it keeps `data-min`/`data-max` (bar, line).

**Moves (9).** gauge `data-value|min|max` → `value|min|max`; calendar `data-value|min|max` → `value|min|max`;
slider `value-start|value-end` → `data-value-start|data-value-end`.
**Stays:** metric and toast `data-value` (each is the formatted TEXT shown; the metric's numeric `value` is a property already), calendar-cell
`data-value` (a date key), the menu's number body `data-min|max|step` (it hands
them to its slider, from the data) and chart axes.
**Cost.** Highest of the table: `data-value` is also what a provider writes onto
a tile. Gauge and metric read it from the `DataSource`, so those two get a
migration test of their own.

## 2. Dismiss

**Today.** Six events for one idea: `callout-dismiss`, `toast-dismiss`,
`header-dismiss`, `chip-remove`, `tag-remove`, `panel-close`. `data-dismissible`
is boolean on callout, container-header and overlay-panel, but a string on chip
and tag.

**Rule.** The reader pressed ✕ → **`<name>-dismiss`**, the host decides what
happens. `-remove` is for taking a member out of a list (`file-remove`,
`filter-remove`); `-close` is for a surface that reports its own open state
(`dialog-close`, `menu-close`, `accordion-close`). One gate: `data-dismissible`,
a **boolean**, everywhere.

**Moves (4).** `chip-remove` → `chip-dismiss`; `tag-remove` → `tag-dismiss`;
chip and tag `data-dismissible` string → boolean. **`panel-close` stays:** it
fires on every close, by the ✕ or by `hide()`, so it is a `-close` event.

## 3. Selection

**Today.** Checkbox, radio and switch: `checked`, and `change` carrying
`{ checked }`. Select-card: `data-selected` and `{ selected }`. The default
`value` is `'on'` on two and `''` on two.

**Rule.** A control that is ticked takes the native name: **`checked`**, with
`change{checked}`. `data-selected` and `data-current` stay for ROWS (any-of-many
and one-of-many, as CLAUDE.md says). The default `value` is **`'on'`**, as a
native checkbox and radio.

**Moves (3).** select-card `data-selected` → `checked`, its event detail
`selected` → `checked`; radio and select-card default `value` `''` → `'on'`.
**Cost.** Low: nothing else in the library reads select-card's `selected`.

## 4. `data-state`

**Today.** Three vocabularies under one name: input-text's validation
(`error|success|warning`), container's data state (`empty|no-matches|error`),
calendar-cell's day (`today|selected|range-start|…`).

**Rule.** `data-state` means the state of the DATA a surface shows
(container, which the provider writes). Validation is a STATUS, and
`data-status` already has `error`/`success`/`warning` values and the colour
cascade. A calendar day's own state keeps `data-state` — it is its only
state, read by nothing else.

**⏸ Held, 2026-10-15:** input-text's `data-state` is the attribute the Figma `input` collection projects its modes onto (`scripts/project-tokens.mjs`, and the generated block at the top of its CSS, which selects `[data-state="validation"]`). The rename is Figma's, so it waits for the Figma queue; the code never reads `error|success|warning`, which `data-error` does.

**Moves (1).** input-text `data-state` → `data-status` (values `critical`,
`success`, `warning`: `error` → `critical`, the cascade's word).
**❓ Calendar-cell:** keep `data-state` (my pick), or `data-day`.

## 5. Error, empty, help

**Today.** `data-error` (input-text, select-group) against container's
`data-error-message`. `data-empty` is the text on list, `data-empty-text` on
notifications, and a flag on the filter chip. File-upload has `data-helper`,
`data-accept`, `data-multiple`; select-group `data-multiple`; prompt-composer
`data-placeholder`.

**Rule.** A message is the attribute named for what it says: **`data-error`**
(text; its presence is the error), **`data-empty`** (text shown when there is
nothing). Help text is **`data-description`**, as everywhere. A native
attribute keeps its native name, unprefixed (D6): `accept`, `multiple`,
`placeholder`.

**Moves (6).** container `data-error-message` → `data-error`; notifications
`data-empty-text` → `data-empty`; file-upload `data-helper` →
`data-description`, `data-accept` → `accept`, `data-multiple` → `multiple`;
select-group `data-multiple` → `multiple`; prompt-composer `data-placeholder` →
`placeholder`.
**❓ The chip's `data-empty` flag** ("on but filtering nothing") collides with
`data-empty` as text. Page-level token CSS selects it. Rename it
`data-filters-nothing` (my pick), or leave the collision.

## 6. Padding

**Today.** `data-padding` is `none|sm|base|lg`; `data-padding-inline` is
`none|sm|md|lg`, and `sm` is not the same size in the two.

**Rule.** One scale, `none|sm|md|lg`, `md` the default, each step the same
pixels on both axes' tokens.
**Done as `none sm md lg xl` (0, 4, 8, 16, 20px), on both axes, and unset stays the
card's own `lg`** — `md` as the default would have shrunk every card. Old block
`sm` → `md`, `base` gone, block `lg` → `xl`.

**Moves (1 value + 1 size).** container `data-padding` value `base` → `md`; the
two `sm` steps made equal (the value is read from the tokens at the time, and
any visible change is reported, not hidden).

## 7. Slot names

**Today.** A leading icon is `icon`, `left`, `leading`, `brand-icon` or
`avatar`. A title is `title` (app-header, the charts) or `heading` (the
containers). Actions are `actions` (11 components) or `action` (empty-state).

**Rule.** `icon` = a glyph; `leading`/`trailing` = content at the ends of a
row; `avatar` = a person's image (not an icon); `heading` = the title, on
every component (the tier rule); `description` = text under it, `metadata` = a
second fact beside it (both stay); `actions` = controls, **always plural**.

**Moves (5).** data-viz-header `left` → `leading`; nav `brand-icon` → `icon`;
app-header and the four charts' `title` → `heading`; empty-state `action` →
`actions`. `data-has-*` states follow (`has-heading` and so on).

## 8. Item events

**Today.** `item-select` carries `{ label, href }` on nav-item and `{ label }`
on list-item.

**Rule.** One detail, a superset: `{ label, href? }` — `href` only where the
item links. **No rename**; list-item gains nothing it cannot have, and the
two details are documented as one.

## 9. Charts, and the filter family

Not names, so not this table: only bar and radial fire clicks, radial has no
legend or title slot, and the filter family declares `data-hide-unmatched`,
`data-remote`, `data-pending` and `data-locked` with different kinds. Those
are **gaps and duplicate declarations**, and go to Phase 5 (a shared
declaration, D5) and the TODO ledger.

---

## What a yes does

**Yes to the table** = the moves above, as one commit per row, each with its
spec regenerated, its tests moved and its trap line written; then a test that
fails when a spec uses a name the table retired. **Yes to a row with a ❓**
needs your pick of the two.

**Not touched by any row:** events other than the ones named, `data-*` of the
data layer (`data-sort-field`, `data-segment-field`, `data-scope`), the nav and
filter vocabularies (they were ratified separately), and everything Figma
names, which is a separate queue.

Totals: **about 27 renames across 20 components.**
