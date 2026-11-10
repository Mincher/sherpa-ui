# Plan 883 — feed the code back into the Figma library

Will, 2026-11-10: *"What we've neglected is feeding back components, their variants,
states, styling, as well as layouts, structures, and patterns back to the Sherpa-UI
library in Figma … compile a diff against the Figma library. Then … a plan on how best
to update the library's existing components & pages … and how to document everything
across the Figma file, as well as adding pages and content on concepts like the data
layer, presentation layer, filter queries and scopes, layouts etc."*

Read live on 2026-11-10, read only. Nothing in Figma was changed.

- Figma **Sherpa-UI** `UnBEepLWb6d7b9ykm33j2s` — every page, component, property and
  variable collection.
- Figma **ACP Module** `UaNDhhl1fawHB0K9KqJFxA` — the node look (page Node Graph
  Exploration) and its local parts.
- sherpa-ui at `659c83805` — all 75 `.component.json` specs, `state-pins.yaml`,
  `name-map.yaml`, the component CSS.
- Sherpa Demos — every Context, Settings page, View, template and app-side style.

---

## 0. The short version

| | Count |
|---|---|
| Code components | 75 |
| … that name a Figma twin in their spec | 57 |
| … with no Figma twin | 18 (3 of them draw nothing) |
| Figma components and sets (not icons) | 80, on 50 `✅` pages and the BACKLOG page `sherpa-app-shell` |
| … that no code component claims | 25: 17 atoms and wrappers, 3 the code has but does not link (Badge, Data Viz Header, Checkbox - Advanced), 2 to merge, 1 to check (View Header), 2 deprecated (§2.2) |
| Specs whose record of Figma is out of date (`resync-figma.mjs --check`) | 14 |
| Twins where the code shows parts, types or states Figma cannot | 43 of 57, and 3 more need only a disabled or drag-over example |
| State pins in `state-pins.yaml` (a code state and its Style mode) | 143, on 39 components; the docs frames show 3 of them (default, active, inactive) |
| Figma docs frames built before the last big change | all (built 2026-08-12) |
| Concept pages in Figma | 0 (Cover and Getting Started are empty) |
| Layout, pattern or page-template pages | 1 (App Showcase, 4 frames, older than Demos) |

Four gaps, largest first:

1. **Whole families are code only**: layout (5 components, the canvas among them),
   nodes (7), the Filter Panel.
2. **The filter system outgrew its Figma**: Filter Chip, Filter Toolbar and Menu have
   about 4 times the types and states Figma shows.
3. **Docs in Figma are stale everywhere**: events, props, collections and sizes in the
   docs frames and descriptions describe the August file.
4. **No concepts, layouts or patterns**: a designer cannot learn from the file what a
   Context, a View, a scope, a preset or a panel area is.

---

## 1. How it was measured, and how to measure again

| Step | Tool | Output |
|---|---|---|
| Code side | a script over every `.component.json`: `kind: style` and `kind: template` props and their values, and `kind: behaviour` props that take values (the overlay panel's four modes are one), `visibility` props, slots and what each accepts, states, events, `$extensions.sherpa` | one row per component |
| Figma side | one `figma_execute` read: every page, every top-level COMPONENT_SET and COMPONENT, its VARIANT, BOOLEAN, TEXT, INSTANCE_SWAP and SLOT properties, its description length, the page's top-level frames; then every variable collection | one row per Figma component |
| Spec records | `node scripts/resync-figma.mjs <live.json> --check` | 14 drifts (§2.5) |
| Colour states | `scripts/figma-data/state-pins.yaml` | §2.4 |
| Code-only tokens | every `var(--sherpa-…)` a component reads, against every `--sherpa-…:` the CSS declares | 26; 3 are dead names (§2.6) |
| Raw colours | literal colours in component CSS outside a `var()` | 0 — every colour is a token |
| Demos | an Explore pass over `app/` | §3 |
| Concepts | an Explore pass over `docs/` and `src/core` | §4 |

**Mode pins are not gaps.** Figma shows `data-status`, `data-look`, `data-size`,
`data-density`, `data-elevation`, active and inactive as **mode pins** on an instance
(Style, its Transparent and Saturated extensions, Structure, Display Mode's compact
and comfortable, Elevation). A code attribute that maps to a mode is counted as
covered. A gap is a part, a type, a structural state, or a colour state with no
example instance.

Step T1 in §6 makes this measurement a script, so it is run again at the end of each
phase and its output replaces §2.

---

## 2. The diff

### 2.1 Code with no Figma component (18)

| Code | What it is | Figma action |
|---|---|---|
| `sherpa-badge` | a small count | **Link** — Figma `Badge` (145:3385) is it; the spec has no `figmaName` and `name-map.yaml` still says "Indicator (atom)" |
| `sherpa-data-viz-header` | the header strip of a chart or metric card | **Link** — Figma `Data Viz Header` (1456:30467) is it; the spec does not say so |
| `sherpa-layout-grid` | the grid a view places its content on | **Build** — Layout Grid and `.Layout Grid Item` (ACP Module already has a local `.Layout Grid Item`) |
| `sherpa-layout-panels` | a panel AREA each side of the content; a docked panel fills it flush. Two panels in one area (`94e8ad74c`): fixed, they stack, each half the height; overlay or tab, they are a GROUP — each has its tab on the edge, one is open, and the open one stands beside the tab strip, inset by its width (2.5rem), not over it; a dropped floating panel joins as it is. A docked card is inset 8px at its sides and `--sherpa-panel-area-padding-block` top and bottom: 8px, but 16px in the App Shell (`--sherpa-layout-grid-padding`), so its top and bottom meet the first and last cards (`864b78b1b`); the dock preview takes the same inset | **Build** — show one panel, two stacked, and a group (one open overlay beside the other's vertical tab); and the layer order (§2.7) |
| `sherpa-layout-canvas` | an infinite canvas: pan, zoom, crosshair grid; slots `columns`, `rows`, `columns-end`, `toolbar`, `footer`, `banner`, minimap, edit mode | **Build** |
| `sherpa-group` | a row, column or grid of controls that reads as ONE object | **Build** — the Grouping collections exist; no component shows them |
| `sherpa-metric-group` | one row of 1 to 4 metrics across the layout grid; sticky | **Build** |
| `sherpa-filter-panel` | the content of a panel: every filter scope the page offers, a section each | **Build** — composes Filter Toolbar sections inside Overlay Panel |
| `sherpa-node` | one node: header, rows, footer, sockets, categories, run steps (with their caption tab, the "run label"), collapsed. Alt-drag draws a GHOST (`aa9962e73`): a dashed box the node's size, Style `surface-base` at 70%, a 1.5px `active-indicator-accent` stroke dashed 6 / 4, the node's name in 12px medium `content-secondary` — every value a live token | **Build** — from the code. ACP Module's local `node` set (2715:20841, 20 variants) and its `Graph / Node`, `Graph / Socket`, `Graph / Route`, `Graph / Frame` and `Graph / Portal` are the older source (plan 740) |
| `sherpa-node-row` | input socket, field, output socket | **Build**, with a `.Socket` atom (ACP Module has `socket`) |
| `sherpa-node-frame` | a frame round nodes: title, line, Release | **Build** |
| `sherpa-node-stage` | a workflow stage: a bar and a band across the canvas. Each stage's ⋯ (Edit, Remove) sits right after its name; Add stage and ⋯ Arrange stages are one icon-button group in the canvas's `columns-end` slot, top right (`f562dc6e3`). Stages are a flex row with a 16px gap (`0d94d99bb`) | **Build** — ACP Module's Harness screens draw the stage bar by hand today |
| `sherpa-node-lane` | a swimlane, or a junction | **Build** |
| `sherpa-node-list` | the node palette: two tabs, sticky category headings | **Build** — composes Tab Group and Menu List Item |
| `sherpa-node-toolbar` | the graph editor's icon buttons, and its toggles Collapse all, Hide unconnected and Swimlanes (`659c83805`) | **Build** — composes Toolbar and Button |
| `sherpa-outlet` | where the route's Context is drawn | **None** — a concept page explains it (§4) |
| `sherpa-provider` | the data layer over a subtree | **None** — concept page |
| `sherpa-router` | the one owner of the URL | **None** — concept page |

### 2.2 Figma with no code (25)

| Figma | Page | Proposed |
|---|---|---|
| Checkbox (Atom), Radio (Atom), Progress Step (atom), Connector (atom), Legend Swatch, Tab, File Item, Chart Axis, `time-clock`, Navigation Header | their parents' pages | **Keep as atoms.** Rename to the dot prefix (`.Tab`), the house rule for a sub-component |
| Input Text, Number, Select, Search, Date, Password, Text Area (937:*) | ✅ Input | **Keep.** They are the one-to-many wrappers of `sherpa-input-text`'s `data-type`; add Tags and Color (§2.3) |
| Checkbox - Advanced (1334:8173) | ✅ Checkbox | **Link** to `sherpa-select-checkbox data-advanced`; it has no description |
| Pagination v2 (1118:30032) | ✅ Pagination | **Merge** into Pagination, then delete one (❓ which is current) |
| Time Picker ×2 (239:6808, 239:6823) | ✅ Time Picker | **Merge** into one; the code's time is `sherpa-calendar data-has-time` |
| View Header (63:2025) | ✅ View Header | **Check**: the App Header's View row may have replaced it; delete or link (❓) |
| Dialog [Deprecated], Accordion [Deprecated] | DEPRECATED | **Delete** after Will's yes — the live Dialog and Accordion are on ✅ Containers |
| 11 empty DEPRECATED pages, 4 empty BACKLOG pages (Product Bar, Proposal Op, Proposal Preview, Scheduler) | | **Delete** after Will's yes |
| App Shell (1016:35752) | `sherpa-app-shell` (BACKLOG) | **Move** to a `✅ App Shell` page in a new LAYOUT section (§7) |

### 2.3 Both exist, and the code shows more

"Code has, Figma lacks" lists only parts, types and structural or colour states —
never a mode the instance can already pin. Size: **S** one sitting, **M** two, **L**
three or more.

**Filters and data**

| Component → Figma | Code has, Figma lacks | Size |
|---|---|---|
| `sherpa-quick-filter` → Filter Chip (atom) | types `ai`, `jump`, `key`; the eight KINDS (`data-kind`: boolean, single, multi, advanced, number, date, group, sort); the three layouts (`data-layout`: chip, section, values); sort direction asc / desc; parts: values, more, swatch, icon-only, label-start, full-value, plain; states: current, open, pending, failed, superseded, unavailable, unsupported, filters-nothing, spent, persistent, by-preset, solo, no-value. Figma has `State=menu/simple`, `hasBadge`, `hasIcon` | L |
| `sherpa-quick-filter-toolbar` → Filter Toolbar | orientation `portrait` (the portrait toolbar REPLACES the old panel); sections and section labels (Presets…), Organise labels; flags saveable, field-apply, suggest, no-actions, panel-mode; the Apply / Discard / Save / Save as footer; Reset graph; the node-editor entry. Figma has `Type=data/view` | L |
| `sherpa-menu` → Menu | `data-type="filter"` and its whole body: modes Simple and Advanced; bodies number and date; search; select all; conditions rows; range; min / max / step; solo; drill; removable rows; Apply / Discard / Clear footer; inline. Figma has `Type=List/Calendar` | L |
| `sherpa-data-grid` → Grid Cell + "Data Grid (template)" frame | a real composed **Data Grid** component (the template is a frame); the column-filter row; heading groups; heading hover; sorted asc / desc and filtered heads; a cell's filter chip, on and superseded; selectable rows and the selected row; group rows with their count badge; the row-actions menu with a danger row; slots `empty` and `no-matches` | L |
| `sherpa-barchart`, `sherpa-line-chart`, `sherpa-sparkline` → Data Field + Chart Axis | composed **Bar Chart**, **Line Chart** (line and area) and **Sparkline** (line and bar) components a designer can drop in; the legend slot and `no-legend`; held-out and hover states | M |
| `sherpa-radial-chart` → Donut Chart | `data-type="pie"`; legend slot | S |
| `sherpa-gauge-chart` → Gauge Chart | caption and legend slots | S |
| `sherpa-chart-legend` → Chart Legend | the item states a legend-as-filter needs: off, held out, hover | S |
| `sherpa-metric` → Metric | trend up / down / flat; status; has-values. **No docs frame** | S |

**Containers and panels**

| Component → Figma | Code has, Figma lacks | Size |
|---|---|---|
| `sherpa-overlay-panel` → Overlay Panel | the four modes (`data-mode`: fixed, overlay, floating with drag and resize handles, tab) and the side (`data-side`: start, end); the states maximised, minimised, collapsed, expandable, hover-open, updated; header slots breadcrumbs, icon, badge, description, actions, actions-end, overflow; the footer. Figma has `hasHeader`, `hasFooter` only | L |
| `sherpa-container` → Container | states loading, empty, error (each a slot); padding none…xl and padding-inline; row-span; fill. Figma has `hasHeader`, `hasFooter` | M |
| `sherpa-container-header` → Container Header | lead control, badge, close (bordered-close), collapsed chevron, dismissible; the card's filter bar (`data-filter-toolbar`: shown, shut, panel, off) | S |
| `sherpa-container-footer` → Container Footer | align start / end / between / stretch; dirty (Save shows on) | S |
| `sherpa-panel` → Panel | collapsed | S |
| `sherpa-dialog` → Dialog | `data-type="overlay"` beside modal; status | S |
| `sherpa-accordion` → Accordion | header badge, description, actions | S |
| `sherpa-stack` → Stack | align, gap (none…2xl), min-item, wrap, scroll, grow, fill. **No docs frame** | S |
| `sherpa-callout` → Callout | dismissible | S |
| `sherpa-toast` → Toast | auto-dismiss (duration); none else | S |
| `sherpa-empty-state` → Empty State | the six illustrations (data, empty, error, folder, search, success) as swap options | S |
| `sherpa-notifications` → Notifications | **No docs frame** | S |

**Navigation and the app frame**

| Component → Figma | Code has, Figma lacks | Size |
|---|---|---|
| `sherpa-app-shell` → App Shell | the regions as slots: nav, header, context-header, panel-start, panel-end, panel-float, overlay; no-header, no-nav, no-room; the five nav states (the Navigation collection has the modes). On a BACKLOG page today; **no docs frame** | L |
| `sherpa-app-header` → App Header | every optional part as a boolean: account, AI, back, help, Labs, loading bar, menu, notifications, theme toggle; slots breadcrumbs and filters (the View toolbar); the View chip, custom view, query and view actions. Figma has 3 slots and no booleans. **A consumer waits for it:** ACP Module's Harness screens (81 of them) compose this two-row header from Apex parts, because the library's cannot show it | M |
| `sherpa-nav` → Primary Navigation | searchable, large, menu, footer slot. The header's Pin button now shows the `sidebar` icon, not `thumbtack-angle` (sherpa-ui-1b, 2026-11-10, not yet committed; waits on Will): Navigation Header (1051:7815) swaps its Pin icon to match | S |
| `sherpa-nav-item` → Navigation Item | tiers 2 and 3; type promo; expanded; status dot | S |
| `sherpa-nav-section` → Navigation Section | collapsed | S |

**Controls**

| Component → Figma | Code has, Figma lacks | Size |
|---|---|---|
| `sherpa-input-text` → Input Field (atom) + wrappers | types tags and color (new, 2026-11-10), minimal, find (Figma: Search); states success and warning (Figma: error only); clearable ×; borderless; multiline | M |
| `sherpa-calendar` → Calendar | month and year views; the time row (`has-time`); embedded | M |
| `sherpa-calendar-cell` → Calendar Cell | selected, range-start, range-mid, range-end (Figma folds them into one `selected-range`); outside-month days | S |
| `sherpa-button` → Button | the badge (`hasBadge`); the menu trigger and its open state | S |
| `sherpa-list-item` → Menu List Item | type node (the palette row); category heading row; current and selected | S |
| `sherpa-select-card` → Select Card | radio and checkbox select modes; horizontal and vertical; checked; footer none | S |
| `sherpa-slider` → Slider | range (two thumbs); show-value | S |
| `sherpa-loader` → Loading Spinner (atom) | orientation; panel. **Conflict**: Figma sizes it by a `Size` VARIANT, the code by the Structure mode (`data-size`) — one must move (❓) | S |
| `sherpa-tag` → Tag | none beyond modes | — |
| `sherpa-chip` → Chip | none beyond modes | — |
| `sherpa-code-block` → Code Block | the copied state (the tick reads as success) | S |
| `sherpa-key-value-list` → Key Value Pair | vertical orientation | S |
| `sherpa-progress-bar` → Progress Bar | indeterminate; disabled (the inactive mode) | S |
| `sherpa-toolbar` → Toolbar | `data-type` plain and bordered | S |
| `sherpa-tooltip` → Tooltip (atom) | four placements; TODO 539 drops its arrow | S |
| `sherpa-tabs` → Tab Group | the tab detail slot (a badge) | S |
| `sherpa-pagination` → Pagination | merge v1 and v2 (§2.2) | S |
| `sherpa-prompt-composer`, `sherpa-transfer-list`, `sherpa-select-*`, `sherpa-switch`, `sherpa-chat-message`, `sherpa-breadcrumbs`, `sherpa-section-header`, `sherpa-progress-step-tracker`, `sherpa-list`, `sherpa-file-upload` | small: the disabled (inactive) look where `state-pins.yaml` says Figma has none; file-upload drag-over and loading | S each |

### 2.4 Colour states the code decided

`state-pins.yaml` holds each state's Style mode, many with "Will, TODO …" and some with
"refined in Figma later". No Figma instance shows them. Each becomes an example
instance, pinned to its mode, in its component's docs frame (§8) — no new variant.

| Component | States and their pins |
|---|---|
| Filter Chip | on = active (re-pointable as `--sherpa-filter-on-*`); persistent on; on with no values = warning; on by a preset = info; soloed = info (*"refined in Figma later"*); unavailable = inactive; superseded; pending; failed |
| Data Grid | a flagged head stays default; row action transparent, danger row transparent/critical; group count default; a cell's filter chip default, on = critical |
| Menu | current row transparent/active; disabled inactive |
| Node, Node Frame, Node Row | the input and output socket colours by type; current; step running / done / failed / skipped; branches; linked |
| Charts (sparkline, bar, line, radial, gauge) | held-out and trend pins |
| Code Block | copied = success |
| Progress Bar, Prompt Composer, Transfer List | disabled = inactive (*"No disabled variant in Figma"*) |

### 2.5 Records out of date

- **14 specs** record Figma wrongly (`resync-figma.mjs --check`): accordion, app-header,
  button, calendar, callout, chip, container, dialog, nav-item, nav-section,
  overlay-panel, panel, quick-filter, stack. After each build, run it without
  `--check`.
- **`name-map.yaml`** has rows for components that are gone (`sherpa-kanban-card`,
  `sherpa-message`, `sherpa-grid-column`, `sherpa-grid-column-header`) and old names
  (Badge as "Indicator (atom)"). It leaves with TODO 700 (memory
  `sherpa-figma-tooling-is-internal`); until then, correct it or let
  `$extensions.sherpa.figmaName` be the one record.
- **Descriptions** describe retired collections. Button's says "Controls extension,
  Button collection, 7 sizes"; all three are gone. 8 components have none: Menu, Chart
  Legend, Legend Swatch, Tab, Connector (atom), Checkbox - Advanced, time-clock,
  Navigation Header.
- **Docs frames** were built 2026-08-12. Their Events tables are older than the event
  renames: Button lists `menu-open`, `menu-select`…, the code fires `button-click`;
  Filter Toolbar lists 6 events (`quick-filter-toolbar-filter-change`…), the code fires
  19 (`filter-apply`, `filters-save`, …). 5 component pages have no docs frame: Stack,
  Notifications, Metric, Data Grid, App Shell.
- **Live mistakes** the build skill lists (`.claude/skills/build-figma-component/SKILL.md`
  §2, "Mistakes in the live file"): Badge `Type=count` binds a primitive radius; App
  Header padding binds a gap; Filter Chip corners and edges from two families; four
  instance overrides bind deleted variables; some text binds Theme colour, not Style;
  effects bind `Elevation/color`, which is not in the collection.

### 2.6 Side finding: three dead token names

A component reads a token that nothing declares, so it always shows its fallback, with
no error. Queued as TODO 884, not Figma work:

| Reads | File | Live name |
|---|---|---|
| `--sherpa-font-size-body-sm` | `sherpa-node-list.css:70`, `sherpa-tabs.css:134` | `--sherpa-font-size-body-small` |
| `--sherpa-style-content-base-1` | `sherpa-node-list.css:69,80` | none — `--sherpa-style-content-base` or a Style mode |
| `--sherpa-theme-surface-base` | `sherpa-list-item.css:164` | `--sherpa-theme-surface-default-base` |

The other 23 are page hooks on purpose (`--sherpa-filter-on-*`, `--sherpa-nav-scale`,
`--sherpa-toggle-shape`, `--sherpa-content-min-width`, …). Each needs one line in the
docs that a page or a setting sets it (§8). One more, which the scan could not count
because the App Shell declares it: `--sherpa-panel-area-padding-block` (Layout Panels
reads it; `864b78b1b`).

### 2.7 The layer order (new, `b18c0ee94`)

Figma has no page that shows what draws over what. The code's order, bottom to top:

1. the content;
2. the Context's fixed region and its sticky Metric Group;
3. the banners;
4. the panels — a tab's hover peek, an overlay panel, a fixed panel (the panels band);
5. a floating panel;
6. the toasts.

The nav and the dialogs stay above all of these. A tab's peek now draws over
the sticky metrics; before `b18c0ee94` the metric cards drew over it. The Layout
Panels page and concept C7 show this order as a stack picture.

### 2.8 Open, and not ours to settle

- Between a docked panel and the cards the gap is 8px; between two cards it is 16px.
  sherpa-ui-fe asked Will (2026-11-10). The Layout Panels page draws the answer.

---

## 3. Layouts, patterns and examples (from Demos)

Sherpa is app agnostic (Will's earlier ruling; memory `sherpa-is-app-agnostic`):
nothing about one app lives in the library. So the Figma
file gets two kinds of page:

- **PATTERNS** — the library's own, one per `patterns/*.json` (schema
  `schemas/pattern.v1.json`): `filter-scopes`, `records-list`, `settings-form`. A pattern
  page draws its JSON's `layout`, and one frame per entry in its `states` (loading,
  empty, no-matches, unreached, down). A Demos pattern with no JSON is drawn only when
  it becomes a library pattern (§3.2).
- **EXAMPLES** — Sherpa Demos' pages, marked as examples, with their generic content.
  The App Showcase moves here.

Paths in this section are in `../Sherpa Demos/app/`.

### 3.1 The examples, one page each

| Example | Its layout | Show also | Figma today |
|---|---|---|---|
| **The app frame** (`index.html`) | router › provider › App Shell: nav (Home, Assistant; Customers: Records, Devices; Workflows: Node Editor; Learn), App Header (AI, Labs, theme toggle, account, help, menu, View actions; breadcrumbs; the View toolbar), the panel area (the Filter Panel in an Overlay Panel, end), the outlet with its `context-header` region, the Settings overlay (a Dialog `data-type=overlay` with a back header and a Jump to chip) | the four panel modes (fixed, overlay, floating, tab) on the Details and Assistant panels; the Notifications popover; the shell's dialogs (Save view as, Save filters as, Manage saved filters, Reset all) | App Shell, one component |
| **Dashboard** (`templates/dashboard.html`) | context-header: three banners + a Metric Group of four; a layout grid: Bar, Donut and Gauge cards (medium, 4 rows), an area Line card (full), a Summary card (Key Value List) | View "Capacity planning" adds a histogram (`data-bands`) and a Data Grid card | "1 · Analytics Dashboard", older |
| **Records** (`templates/records.html`) | context-header: banners + metrics with sparklines; three chart cards, their header's filter bar shut; the Records card (§3.2 #2); the Add / Edit form dialog, the Delete confirm | View "Renewals" groups the grid by tier; the bulk-selection state | "2 · Records Table", older |
| **Devices** (`templates/devices.html`) | as Records: no Add, not selectable; the Details panel (laptop icon) | View "Servers" groups by customer | none |
| **Assistant** (`templates/chat.html`) | no app header; a Container: a thread Stack of Chat Messages (one holds a Code Block), a Loader, a Container Footer with the Prompt Composer | the same thread inside the Assistant overlay panel, the composer in its footer | "4 · AI Chat", older |
| **Node Editor** (`templates/node-editor.html`) | header with the View chip and the graph chip only; a Layout Canvas: banners, the Node Toolbar, the Nodes panel (start, Node List), the inspector (end); stages, lanes, frames, the minimap | the dialogs Save as Custom Node (with Tags), Edit stage (with Colour), Update all instances (critical); the four graph Views | none — after P7 |
| **Learn filtering** (`templates/learn-filtering.html`) | a demo column (a grid, a toolbar, charts, by lesson) + a doc rail (callout, small section headers, prose, live switches, "pictures" of chips, an accordion of code blocks) | lessons 6, 7, 11 and 12, the four demo layouts | none |
| **Settings** (`templates/profile.html`, `accessibility.html`, `appearance.html`, `application.html`, `filtering.html`) | a reading-width Stack of sections: Section Header + List of List Items with a trailing Switch; Appearance uses Fieldset radios; Profile is a form with its footer pinned below the scroll | a dependent switch (`data-setting-needs`) disabled | "3 · Settings Form (dark)", older |

### 3.2 The patterns

| # | Pattern | Library JSON | Its parts, outside in | Best seen at |
|---|---|---|---|---|
| 1 | **A View bar over a data bar** | `filter-scopes` | layout grid › View toolbar (`data-type=view`, full) › count Metric › status cards › the data cards | `templates/records.html` |
| 2 | **The records card** | `records-list` | Container (scope data, padding none, inline md, fill, grow) › Container Header (filter bar shown) › Stack (md) › Toolbar (Add, bulk actions; count, Find input) › data Filter Toolbar (saveable) › Data Grid (selectable, column filters) › footer Pagination | `templates/records.html:100-148` |
| 3 | **Settings as a form** | `settings-form` | Stack (fill) › scroll Stack › form › layout grid › reading Stack › sections; a pinned Container Footer | `templates/profile.html:3-45`, `templates/filtering.html:44-90` |
| 4 | A chart card | — | Container (medium, 4 rows) › header › card Filter Toolbar (no actions, no saves) › chart (grow) › Chart Legend in `slot=legend` | `templates/dashboard.html:55-62` |
| 5 | A metrics strip that stays in view | — | `context-header` › layout grid › banner Callouts (`data-listens`) › Metric Group of four | `templates/records.html:8-39` |
| 6 | A detail drawer | — | Overlay Panel (icon, breadcrumbs when maximised) › Group of step Buttons in `actions` › vertical Key Value List | `index.html:192-202` |
| 7 | A form dialog | — | Dialog › Stack of Input Text and Fieldset › Container Footer (Cancel, Save saturated) | `templates/records.html:154-176` |
| 8 | A confirm dialog, and its critical form | — | Dialog › message › footer; critical: the Delete button critical | `index.html:131-138`, `templates/records.html:181-191` |
| 9 | A chat thread and composer | — | thread Stack (scroll, measure, `role=log`) › Chat Messages; Prompt Composer in a footer — in a card or a panel | `templates/chat.html:8-92`, `index.html:663-675` |
| 10 | The filter panel in the panel area | — | Overlay Panel (side, searchable, floatable, minimisable) › Filter Panel (scopes "view data") | `index.html:83-87` |
| 11 | The banner trio | — | three Callouts `data-type=banner`, listening for app, data and lost, each dismissible with a small transparent button | `templates/dashboard.html:14-27` |
| 12 | The node editor canvas | — | Layout Canvas › banner, toolbar, Nodes panel, inspector; nodes, stages, lanes, frames | `templates/node-editor.html:7-34` |
| 13 | A demo and its doc rail | — | layout grid › demo card + a doc-rail Stack (scroll) | `templates/learn-filtering.html:4-76` |

Patterns 1–3 get a PATTERNS page each in P9. 4–13 are drawn on their EXAMPLE page, and
each is a candidate for a library pattern JSON; Will picks which become one.

**To settle first:** the same chart card has two headers. Dashboard uses Data Viz
Header and a visible card bar; Records uses Container Header with its filter bar shut
(`data-filter-toolbar=shut`) and a hidden bar. A pattern page draws one. ❓ in P9.

### 3.3 What the examples must show

- **Most used** (instances in Demos): Stack 84, Section Header 81, Switch 73, List Item
  51, Button 44, Container 43, Code Block 39, Container Header 38, Filter Chip 26,
  Callout 23, Input Text 22, Filter Toolbar 18, Data Grid 15, Chart Legend 14, Layout
  Grid 13, Metric 12, Dialog 11. Their pages come first in each phase.
- **Values Demos uses that Figma cannot show yet**: Container padding none with inline
  md; Container Header's filter bar shown and shut; Dialog `type=overlay`; Input Text
  find, tags, color, select; Line Chart area; a Bar Chart as a histogram
  (`data-bands`); Gauge invert and caption; Metric with a sparkline (`bucket=auto`).
- **Never placed by Demos**: Badge, Calendar, Chip, Empty State, File Upload, Layout
  Panels, Panel, Progress Bar, Progress Steps, Select Card, Select Radio, Slider,
  Sparkline, Tabs, Tag, Tooltip, Transfer List. Their pages are updated from the spec
  alone, and no example shows them.

### 3.4 What the app builds round the library

Each is app CSS or plain HTML that a library part could own. They are library work,
not Figma work; each becomes a TODO row when P9 reaches its example, if Will wants it.

| The app makes | Where | A library gap? |
|---|---|---|
| a bulk-selection bar and an "N selected" count in the toolbar | `templates/records.html:121-124`, `contexts/records.js:274-288` | a Toolbar selection state |
| a dialog's message as `<p style="margin:0">` | `index.html:133`, `index.html:169`, `templates/records.html:184`, `templates/node-editor.html:66` | a Dialog message part |
| a Find input 16rem wide | `templates/records.html:130`, `templates/devices.html:48` | an input width in a toolbar |
| the filter panel's width through a private `--_width: 29rem` | `index.html:85` | a public panel width |
| a full-bleed canvas Context through a wrapper grid | `templates/node-editor.html:6` | a layout grid fill, or a canvas Context |
| main + aside spans (5 + 3, 9 + 3) and fit rows at 8 columns | `templates/learn-filtering.css:5-32` | Layout Grid spans and fit rows |
| prose: paragraph, list, link and code styles | `templates/learn-filtering.css:34-44` | a prose (rich text) part |
| drawn menus, panel sections and condition rows, as plain spans | `views/learn-filtering-views.html:90-113`, `:570-576`, `:704-712` | a static specimen of a live component |
| an input and a Remove button in a row | `index.html:26-31` | an editable list row |
| a panel alone in a browser tab | `index.html:22-24` | the shell's panel-only state |

Two attribute slips found on the way, in TODO row 884: Demos writes
`data-side-setting` on the filter panel (`index.html:83`), which no spec lists and
`sherpa-usage.json` did not declare — `check-usage` reported it (exit 1), so Demos'
`npm test` stopped at its `pretest`. Fixed the same day in Demos `3c3e2e4`: it is
Demos' own marker (`app/panel-float.js:63`), now under `own`. And it writes `data-by-preset` bare,
where the spec takes the preset's name (`views/learn-filtering-views.html:770-771`).

### 3.5 What ACP Module draws by hand

ACP Module (the Harness design, a second consumer) does not use the Sherpa-UI library:
its screens draw these from Apex parts and plain frames. Each is a library part this
plan builds, so the Harness can swap to it.

| Drawn by hand in ACP Module | The library part | Phase |
|---|---|---|
| the two-row app header (back, breadcrumbs, title, Save ▾, Ask N-zo, Labs, theme, bell, account, help; the View chip, View Context, fixed chips, Filters, Refresh, ⋮) | App Header with every boolean, and its View toolbar | P3 |
| the data bar (Organise │ Presets │ Custom · Suggest · Filters · Save · Refresh · ⋮) | Filter Toolbar, its sections and actions | P2 |
| the two-half chip (field │ value) | Filter Chip, its body and caret halves | P2 |
| docked panels (Details, Filters, N-zo) with a header of mode buttons | Overlay Panel's header in each mode, inside Layout Panels | P3, P6 |
| stage bars | Node Stage | P7 |
| the zip-tie handle, route vectors | `.Zip Tie`, `.Route` | P7 |
| run labels | the node step caption | P7 |

---

## 4. Concepts

Read from PRINCIPLES, ARCHITECTURE, APP-GUIDE, DATA-SOURCE-RULES, QUERY-DESIGN,
PAGE-DEFINITION, PROVIDER-DESIGN, LEXICON and the traps. Each page says what the
concept is, in the docs' own words; what a designer must DO because of it; which
components show it; and one picture. A page is written from its source doc and cites
it, so a change to the doc is a change to the page (P11).

### 4.1 The pages, in reading order

| # | Page | What it teaches | Source | The picture |
|---|---|---|---|---|
| C1 | **Two layers, and the utility layer** | The data layer gets, sets and transforms rows and touches no DOM. The presentation layer shows what it is given, asks for what it wants, decides nothing about the data. Router, provider and outlet hold no rows and draw nothing. **So: never design a component that works out its own numbers; design the states the data puts it in** | PRINCIPLES "The two layers"; ARCHITECTURE §1 | two bands with the SOURCE as the seam; three utility boxes beside |
| C2 | **The words** | Section, Area, Context, View — one meaning each; Recent and Favorites are Areas that list Views; a graph is a View | PRINCIPLES 19 | an annotated nav and header; the tree app → Section → Context → Views |
| C3 | **The app frame** | `app.json` is the list; the shell's regions and slots; chrome variants (no header, Views only); Settings opens OVER the Context; the URL keys | APP-GUIDE §2–3 | an exploded slot map of App Shell |
| C4 | **Appearance: Style, look, pins, Structure** | Style modes; looks default / saturated / transparent; base, +1, +2 = default, hover, down; a state is a mode pin, never a colour rule; a pin does not reach a nested instance; disabled is the inactive mode, never opacity; size by the Structure mode, never by resizing | PRINCIPLES 3, 8; build rules "Figma" | the Button look × status matrix; the size ramp |
| C5 | **Mechanics: Grouping, grids, focus, Display Mode, density, elevation** | 21 Grouping positions; the 4px and 2px grids; the focus ring inside the box; light, dark, auto; compact, default, comfortable | PRINCIPLES 4–6; TRAP `T-grouping-is-an-attribute-and-a-class` | the 21-cell chart; light/dark × density grid |
| C6 | **Laying out a page** | layout grid (spans, breakpoints 768 / 1280 / 1920, 1–12 columns, grouped and resizable gutters); stack, group, toolbar, container — pick by job; metric group; the `context-header` row that stays in view | layout-grid and metric-group references; TRAP `T-a-context-has-a-fixed-region` | a column overlay per breakpoint; a four-up comparison |
| C7 | **Panel areas and panel modes** | a docked panel fills its area flush; the area draws the divider and resizes; two panels at most — fixed ones stack, overlay and tab ones are a group with one open; modes fixed, overlay, floating, tab; the docked card's inset; the layer order (§2.7); the dock target within 4rem; filter mode: the panel is the toolbar in a column | APP-GUIDE §2; TRAPs `T-a-panel-area-is-a-layout`, `T-the-panel-is-the-toolbar-in-a-column` | one panel through the four modes; the same filters as bars and as a panel |
| C8 | **Interaction rules** | report, don't derive; `data-locked`; off is not gone; every drag has a key or button twin; events are `noun-verb` | PRINCIPLES 10, 18, 21 | in → out arrows; on / off / cleared; a gesture ↔ key table |
| C9 | **Ask and answer** | a component asks in its own attributes (`data-scope`, `data-field`, `data-aggregate`, `data-segment-field`), the provider answers; five shapes: rows, aggregate, series, field values, view state; two components never speak | PROVIDER-DESIGN §2, §4 | a hub: the provider in the middle, one labelled arrow per component |
| C10 | **Page definition and fields** | one JSON per page: source, fields, scopes, saved filters, ui; the field kinds (list, number, date, text, tiered `child`, date range, status field) and how each is drawn; a schema's `oneOf` order keeps a category's colour slot | PAGE-DEFINITION §2–3; DATA-SOURCE-RULES §1 | a "page spec" card beside a screen; field kind × chip and menu |
| C11 | **Query and scopes** | one Query per Context, in the reader's terms; controls are views of the Query; applied and draft; the `view` scope narrows every component, another scope only the ones that name it; component rows = view AND component; superseded | QUERY-DESIGN §2–3; DATA-SOURCE-RULES §6 | the Query in the middle, four controls reading their slice; nested boxes page ⊃ card |
| C12 | **The filter chip, Simple and Advanced, Organise** | the chip kinds; the state matrix (§2.4); one menu, two modes, switching is not a reset; Group and Sort arrange, they do not remove; the sort cycle | DATA-SOURCE-RULES §2; TRAPs `T-a-filter-menu-has-two-modes`, `T-organise-chips-lead-the-bar` | the live menu in both modes; the chip state grid |
| C13 | **Presets, saved filters, Views, the View chip** | a preset is a boolean chip leading its scope; a saved filter saves every scope; the page's own cannot be saved over; the View chip is persistent and never empty; the bar's order | PAGE-DEFINITION §2; APP-GUIDE §8, §10; QUERY-DESIGN §7 | the annotated bar; the header with the View chip open |
| C14 | **Counts, Limit, Apply and pending** | a count is the rows that reach a chip, View first, then each scope in order; Limit greys what the filters before it rule out; local changes apply at once, remote ones wait for Apply; pending = warning | QUERY-DESIGN §5; TRAPs `T-one-walk-counts-and-limits-in-order`, `T-a-pending-chip-reads-as-a-warning` | a waterfall of three chips; draft → applied |
| C15 | **Data states, reach and news** | loading, empty, no-matches, error; reach ok, unreached, down; a notice waits for the reader — no grid moves under its reader | TRAP `T-a-container-shows-its-datas-state`; APP-GUIDE §4, §6 | one card four times, and the banner strip |
| C16 | **Settings and page state** | a setting is declared once, scoped app / page / component; `data-setting`; the settings that change a look (filter mode, results, section labels, toggle shapes, large nav, value borders) | APP-GUIDE §9 | a setting → visual-effect table |
| C17 | **Nodes: node, row, socket, route** | a node is a card at x and y; its header names and drags it; rows of input, field, output; socket types; a fork's True and False; step states | node references; APP-GUIDE | the node anatomy; the socket table |
| C18 | **The canvas: stages, lanes, frames, portals** | stages across the top, lanes down the side, junctions; frames behind lines, lines behind nodes; edit mode | APP-GUIDE "Stages", "Swimlanes" | an annotated canvas |
| C19 | **Entities, Custom Nodes, graph Views, Simulate** | an entity is a graph under a type; the graph chip; Update available; Open in Node Editor; Simulate writes nothing | APP-GUIDE "Entities", "Custom Nodes", §8 | the header with the graph chip; a lit simulation |

C17–C19 are written last, with P7: the node work is still moving, and the workflow
runner (TODO 616) is held.

### 4.2 The words page holds the lexicon

The words that must stay exact, and the old words to avoid, from `LEXICON.md`:
Section / Area / Context / View; Simple / Advanced (never Default / Conditional);
Preset, Preset Filter, saved filter, Organise (a heading, not a kind); off vs removed vs
cleared; `data-maximised` (never `data-expanded`, which means children shown);
`data-filters-nothing`; `-dismiss` for ✕; `data-label` for a control, `data-heading`
for a container; `checked` for a ticked control; `data-selected` any-of-many,
`data-current` one-of-many; Grouping `start / mid / end` (never `data-snap`); status
`critical` (never `error`); looks `saturated` / `transparent`; panel modes `fixed /
overlay / floating / tab`, sides `start / end`. Figma's layer and property names follow
the same list.

### 4.3 Found while mapping (to settle before the page is drawn)

- **Socket shapes moved on from ACP Module.** Its Figma draws a default or True
  output as a rounded triangle (plan 740). The code now draws an input as a D in its
  type's ink, an output value or boolean as a circle, an object as a diamond, False as
  a rounded square (`src/core/sherpa-node-sockets.css`, TODOs 713, 740, 874). P7 draws
  the code's shapes; ACP Module follows when it swaps to the library (D3).
- **`sherpa-input-text data-state`** → `data-status` (error → critical) is held for the
  Figma rename (LEXICON ❓). P5 is that rename: do it in both at once.
- **`sherpa-calendar-cell data-state`** or `data-day` (LEXICON ❓) — settle before P5.
- **Elevation** does not cross a shadow root from the page (a trap), so the Elevation
  page says: set it on each component.

---

## 5. Rules for the work

1. **Tokens still flow Figma → code.** A new variable is made in Figma first, then
   projected (PRINCIPLES 20). This plan adds few: no component CSS holds a raw colour.
2. **Structure flows code → Figma, this once.** Parts, slots, types and states are
   copied from the spec. Where the code and Figma disagree on a LOOK (a colour, a
   radius, a size), it is asked, once, as a ❓ (memory
   `sherpa-trust-will-on-figma-values`).
3. **Mode before variant.** A status, look, size, density, elevation, active or
   inactive is a mode pin on the instance (the build skill, §2 rule 2). A VARIANT is
   only for a change of structure: `data-type`, orientation, a view.
4. **One code name, one Figma name.** A `data-<part>` that shows a part is a BOOLEAN
   `has<Part>`; a slot is a SLOT named as the slot; `data-type` is the `Type` axis
   (PRINCIPLES 15: `data-type` IS the Figma Type axis).
5. **Every build follows `/build-figma-component`** and passes its gates A–F.
6. **Docs are generated, never written by hand** (§6 T2). The spec is the one source,
   as it is for `docs/components/`.
7. **Read data, not screenshots** — except gate E.
8. **One writer.** Only one agent writes the Sherpa-UI file at a time. The
   figma-console bridge also serves ACP Module, which a peer uses; pass `fileKey` on
   every call and never switch the active file.
9. **A restore point before each phase:** `figma.saveVersionHistoryAsync(<phase>)`.
   Nothing reaches a consumer until Will publishes the library.
10. **Deletes need Will's yes**, one list per phase.

---

## 6. The tooling, built first

| # | Tool | What it does | Lives in |
|---|---|---|---|
| T1 | `scripts/figma-diff.mjs` + `scripts/figma-data/read-live.js` | The read script (pasted into `figma_execute`) writes the live snapshot; the diff script reads it and every spec and prints §2: code only, Figma only, gaps per component, stale records, docs older than their spec | internal, not shipped, run by hand like `resync-figma.mjs` |
| T2 | `scripts/figma-docs.mjs` | Writes one docs JSON per component from its `.component.json` and `.example.json`: purpose, anatomy, the Figma ↔ code map (§8), props, slots and what each accepts, states with their pins, events and payloads, tokens, examples. It stamps the spec's hash | internal |
| T3 | `scripts/figma-data/build-docs.js` | The Figma half: draws a docs frame from T2's JSON, with LIVE instances, and stores the hash in the frame's plugin data, so T1 can say "docs stale" | internal |
| T4 | `resync-figma.mjs` (exists) | After each build, rewrites `$extensions.sherpa` | exists |

T2 and T3 replace the session-only `__buildDocs` of August (memory
`sherpa-figma-oncanvas-docs`), so a docs frame can be made again after any change.

---

## 7. The target file structure

New sections in **bold**. Pages keep the `✅ Title Case` name the build skill sets (its §6).

| Section | Pages |
|---|---|
| **START** | 📕 Cover · 🚀 Getting Started · **How to read a component page** · **Changelog** |
| **CONCEPTS** | C1–C19 (§4.1), one page each, in reading order |
| FOUNDATIONS | 🎨 Foundations, split into **Colour and Style modes**, **Type**, **Space and the two grids**, **Borders, rounding and Grouping**, **Elevation**, **Density and Display Mode**, **Layout breakpoints**, **Motion** · Icons · 📐 Variable Architecture |
| **LAYOUT** | ✅ App Shell (moved from BACKLOG) · **✅ Layout Grid** · **✅ Layout Panels** · ✅ Stack · **✅ Group** · **✅ Layout Canvas** |
| CONTROLS | as today |
| CONTAINERS | as today; Overlay Panel, Panel and Dialog get their own pages |
| NAVIGATION | as today |
| **DATA** (was DATA GRID) | ✅ Data Grid · Chart 2D · Donut · Gauge · Chart Legend · Metric · **✅ Metric Group** · Quick Filter Chip · Quick Filter Toolbar · Menu's filter body · **✅ Filter Panel** |
| **NODES** | **✅ Node** · **✅ Node Row and Sockets** · **✅ Node Frame** · **✅ Node Stage and Lane** · **✅ Node List** · **✅ Node Toolbar** |
| **PATTERNS** | one page per `patterns/*.json`: **A View bar over a data bar** (`filter-scopes`), **Find and act on records** (`records-list`), **Settings as a form** (`settings-form`) — each with a frame per state (§3.2) |
| **EXAMPLES** | from Sherpa Demos, marked as examples (§3.1): **The app frame**, **Dashboard**, **Records**, **Devices**, **Assistant**, **Node Editor**, **Learn filtering**, **Settings**; the 🖥️ App Showcase moves here and its four frames are replaced |
| BACKLOG / DEPRECATED | emptied (§2.2) |

Moving a page breaks no consumer: a component keeps its key.

---

## 8. The component page standard

Every component page holds, top to bottom:

1. **The header band**: the Figma name, the code tag (`sherpa-button`), and its state:
   ✅ matches the code, 🚧 known gaps (listed).
2. **The component or set.**
3. **The docs frame** (T3), from the spec:
   - *Purpose* — the spec's `$description`, with Use for / Not for.
   - *Anatomy* — each part and slot, and what each slot accepts (PRINCIPLES 12's
     vocabulary).
   - **The Figma ↔ code map** — the bridge a designer and a builder share: `Type=icon`
     ↔ `data-type="icon"`; `hasBadge` ↔ `data-badge`; Style `critical` ↔
     `data-status="critical"`; Structure `sm` ↔ `data-size="sm"`; Transparent ↔
     `data-look="transparent"`; slot `menu` ↔ `slot="menu"`.
   - *States* — one live instance per state, pinned to its mode (§2.4 fills this).
   - *Status, Size, Density* rows — live instances.
   - *Events* — name, when, payload; from the spec.
   - *Tokens* — the collections it binds; the page hooks it reads.
   - *Example* — live instances, and the markup from `.example.json`.
4. **The Variable Resolution frames**, light and dark (they exist; keep them).

The description field gets a short form of 3 (MCP clients read it): purpose, the map,
the code tag.

---

## 9. Phases, in order

Each phase ends when T1 shows its items closed, the build skill's gates passed, and a
Figma version is saved. Sizes are sittings (one `figma_execute` session each).

| Phase | Work | Exit check | Size |
|---|---|---|---|
| **P0 Ready** | Build T1–T4. Save a version. Fix the live mistakes (§2.5). Link Badge, Data Viz Header, Checkbox - Advanced. Run `resync-figma.mjs`. Correct `name-map.yaml`. Will's yes on the delete list; delete | T1: 0 stale records, 0 dead binds | M |
| **P1 Frame** | Make the sections and empty pages of §7. Cover and Getting Started. The page standard (§8) as a template frame | every page of §7 exists | S |
| **P2 Filters** | Filter Chip, Filter Toolbar (portrait), Menu's filter body, then the Filter Panel. Biggest gap, most used in Demos | T1: these four at 0 gaps | L |
| **P3 Containers and the app frame** | Overlay Panel states, Container states, Header, Footer, Panel, Dialog; App Shell, App Header, Nav | T1: 0 gaps | L |
| **P4 Data** | Data Grid as a composed component; Bar, Line, Sparkline; Donut pie; Legend states; Metric; Metric Group | T1: 0 gaps | L |
| **P5 Controls and the rest** | Input Text and its wrappers (with the `data-state` → `data-status` rename, §4.3), Calendar and Calendar Cell; then every S row of §2.3 still open, in one batch | T1: 0 gaps | M |
| **P6 Layout** | Layout Grid and Item, Layout Panels (one panel, two stacked, a group; the layer order, §2.7), Group, Stack docs, Layout Canvas | T1: 0 gaps | M |
| **P7 Nodes** | the NODES section, from the code, with the parts the graph draws and no element owns: `.Route` (with bend points), `.Zip Tie` handle, `.Portal` (In and Out); then ACP Module swaps its local `Graph / *` parts for library instances (❓ D3) | T1: 0 gaps | L |
| **P8 Docs** | T3 docs frames for every component; descriptions | T1: 0 stale docs | M |
| **P9 Patterns and examples** | the three PATTERNS pages from their JSON, a frame per state; the eight EXAMPLES pages (§3.1), from live instances; settle the chart card's header (§3.2); queue §3.4's rows that Will wants | each pattern JSON and each Demos Context has its page | L |
| **P10 Concepts** | §4's pages | each concept of §4 has its page | L |
| **P11 Keep it fresh** | a TODO item that changes a component's parts, types or states also queues its Figma row; T1 runs at the end of each such item | — | — |

P7 is late on purpose: the node editor changed on 2026-11-10 (stages, lanes,
collapsed nodes), and work in hand (713, 719, 557–562) will change it again. A Figma
copy made now would go stale first.

---

## 10. Decisions for Will

| # | Question | A (pick) | B |
|---|---|---|---|
| D1 | When code and Figma disagree on a look | **A:** the code wins on structure and states; each look is asked once, as a ❓ | B: the code wins on all of it |
| D2 | Where to do the work | **A:** in the live file, a saved version before each phase; you publish | B: a Figma branch (needs an Organization plan) |
| D3 | The node components | **A:** build them from the code, bound to Sherpa-UI variables; ACP Module swaps to them later | B: move ACP Module's `node` set into the library as it is |
| D4 | Where 883 sits in the TODO | **A:** P0–P6 now, in their own lane (they touch no node file); P7 after the node items | B: all of it after the node items |
| D5 | Loader size | **A:** the Structure mode, as the code and Button do; drop the `Size` variant | B: keep the variant; the code follows |

Smaller ❓s, asked in their phase: Pagination v1 or v2; View Header, keep or delete;
Container padding, a mode or a variant; Code Connect (Dev Mode shows the `sherpa-*`
markup) — only if your Figma plan has it.

---

## 11. Risks

| Risk | Guard |
|---|---|
| A long `figma_execute` writes half, then throws (memory `figma-execute-is-not-atomic-after-await`) | small batches; read back; a saved version per phase |
| A peer drives the same bridge | `fileKey` on every call; one writer; ListAgents first |
| A build drifts from the code while it waits | T1 run at the start and the end of each phase |
| Docs rot again | generated docs with a spec hash; P11 |
| A deleted page held something | Will's yes per list; the saved version |

---

## 12. What the other agents reported

The read was at `659c83805`. Will asked (2026-11-10) that the work other agents had
in hand be added when it was done. All four replied. `94e8ad74c`, `0d94d99bb` and
`aa9962e73` landed after the read; `b18c0ee94`, `864b78b1b` and `f562dc6e3` were in it,
and are listed so their Figma effect is not missed. Each item is also in its row above.

| From | Change | Where in this plan |
|---|---|---|
| sherpa-ui-1b (not yet committed; waits on Will) | `sherpa-nav`: the header's Pin button shows the `sidebar` icon, not `thumbtack-angle`; the spec, manifest and reference were made again. No other change | §2.3, Navigation |
| sherpa-ui-fe, `b18c0ee94` | a panel peeking from its tab draws over the fixed region and its sticky Metric Group; the layer order | §2.7 |
| sherpa-ui-fe, `864b78b1b` | `--sherpa-panel-area-padding-block` (8px; 16px in the App Shell): a docked card's top and bottom meet the first and last cards; the Layout Canvas keeps 8px; the dock preview follows | §2.1, §2.6 |
| sherpa-ui-f9 | `94e8ad74c` the panel group's look (above); `0d94d99bb` stages are a flex row with a 16px gap, a dragged node stays in its stage (behaviour); `aa9962e73` the Alt-drag ghost; `f562dc6e3` (before the read) Add stage and Arrange stages moved to the canvas's `columns-end`, a stage's ⋯ after its name, and `data-last` and the `stage-add` / `stage-arrange` events gone; `panel-mode-change` carries `{ mode, restore? }`. Its FYI on `659c83805` (stages, swimlanes, collapsed nodes, copy and paste, the toolbar toggles, Layout Canvas slots and `data-editing`, Input Text `data-type="color"`, workflow v2) was in §2.1 and §2.3 already. No Demos change since `3c5f523` | §2.1 |
| acp-module-d7 (Harness design) | No main component changed in either file. Its Harness screens use instances and hand-made frames: a two-row app header, a data bar of two-half chips, docked panels with mode buttons, stage bars, a zip-tie handle, run labels, all drawn locally from Apex parts. It names these as wanted library parts: **the stage bar, the zip-tie handle, the run label, the two-half chip, the panel-end header with its mode buttons**. Its notes: `acp-module/.working-notes/29-app-shell.md`, `30-sherpa-demos-patterns.md` | §2.1, §2.3, §3.5, P7 |
