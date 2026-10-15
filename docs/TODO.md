# TODO

The list of open work. One file. Add to it, tick items off, do not start a second one.

Status: `[ ]` open · `[~]` in progress · `[x]` done. A done item KEEPS its row
and its section, marked ✅ — git and `docs/TRAPS.md` keep the detail.

**A bug is queued like any other item.** Will, 2026-09-26: bugs do not demand
immediate attention. Add it here, in its place in the order, and carry on.

---

## At a glance

**Open:** every ⬜, 🚧 and ❓ row below — never a hand-typed count. Reassessed 2026-09-29, after the Query (73), the provider (85)
and the page definition (92) were built: what is left of the foundation first
— the audit, the rename, the one builder — then the bugs, then the filter
features, which now stand on it. Numbers are ids, not order; the table IS the
order.

**Status:** ✅ done · 🚧 in progress · ⬜ not started · ❓ waits on a ruling from Will.
A done item KEEPS its row and its section, marked ✅ — nothing is deleted.

| | Pri | # | Item | Kind |
|:-:|---:|---:|---|---|
| | | | **B — The foundation: what is left** | |
| ✅ | 1 | 86 | AUDIT — every component's functions and events: one request, one response, standardised in `SherpaElement` | explore |
| ✅ | 1a | 102 | Simple AND Advanced answers are both kept, so a filter switches mode at any time | foundation |
| ✅ | 2a | 103 | Rows with no key get one from the data layer — Sherpa's own, never sent out | foundation |
| ✅ | 3 | 38 | One model, one builder, one owner — what is left | refactor |
| ✅ | 4 | 74 | EXPLORE — the Query builds every group, sort and filter menu; a menu shows its sub-query | explore |
| ✅ | 5 | 37 | Components are AGNOSTIC of the data and of the example app | refactor |
| ✅ | 5a | 113 | EXPLORE — state first, then render, in every component; a skeleton while the first render waits | explore |
| | | | **C — Contained bugs** | |
| ✅ | 5b | 142 | The shell's panel areas must not scroll with the page: they sit outside the scrolling wrapper | quick |
| ✅ | 6 | 112 | An Equals row in Advanced will not open its value list — and every Advanced row kind is checked | bug |
| ✅ | 7 | 45 | A picked date does not show in the chip | bug |
| ✅ | 8 | 82 | A number chip set by a View shows no value on its face | bug |
| ✅ | 9 | 83 | Calendar menu: a picked date leaves Apply and Discard looking off — yet they work | bug |
| ✅ | 10 | 94 | A number (and range) filter menu needs Apply and Cancel buttons | bug |
| ✅ | 11 | 43 | The toolbar ⋯ overflow menu shows nothing | bug |
| ✅ | 12 | 16 | Favourite and Save apply to the Context, not the View | bug |
| ✅ | 13 | 54 | A one-value filter's row in the Filters menu: its tick means On | bug |
| ✅ | 14 | 95 | Firefox: a remote chip holding a draft is not marked pending | bug |
| ✅ | 15 | 96 | A grid with few columns leaves an empty band on the right of its card | bug |
| ✅ | 16 | 64 | A collapsed accordion section fills with the down (+2) surface | quick |
| ✅ | 16a | 100 | The Assistant panel shows no heading | quick |
| ✅ | 16b | 106 | A click between a menu's items reaches what is behind it — an accordion toggles | bug |
| ✅ | 16c | 108 | A Filters menu row's scope is a DESCRIPTION under its label, with no "in" | quick |
| ✅ | 16d | 114 | About 1 time in 20, a folded Advanced-only filter's row in the Filters menu opens nothing | bug |
| ✅ | 16e | 119 | The panel header's Reset menu button wears the grouping `end` style; it takes none | bug |
| ✅ | 16f | 127 | A number input: `Enter a value`, right-aligned, Sherpa's own steppers — it came back native | bug |
| ✅ | 16g | 130 | Filter panel chips show no tooltip: the tip belongs to the CHIP — and check what else does | bug |
| ✅ | 16h | 131 | Switching a number filter to Range fires no update, so the range is not used | bug |
| ✅ | 16i | 132 | Back from a changed Range, a number filter has lost the Simple value typed before | bug |
| ✅ | 16j | 137 | A number RANGE filter's values do not match between the filter panel and the filter toolbar | bug |
| ✅ | 16k | 147 | A chip switched off under the pointer leaves an EMPTY tooltip: the whole tooltip hides | bug |
| ✅ | 16l | 148 | After a Reset, a date chip's value label reads `Unassigned` | bug |
| ✅ | 16m | 151 | A filter moved across scopes does not keep its Simple or Advanced mode | bug |
| ✅ | 16w | 168 | A filter sent from scope A to the View, then down to scope B, shows in A again: a filter is in ONE scope at any time | bug |
| ✅ | 16x | 169 | "Reset to default", and a View pick, take the saved filter chips off the bar | bug |
| ✅ | 16v | 167 | A Reset in a component scope clears a chip's "moved to the View" state and its inactive look | bug |
| ✅ | 16u | 166 | A saved filter's badge shows its count only while it is ON — the count is not always known before | bug |
| ✅ | 16t | 165 | A filtered grid's group row badge shows the group's TOTAL rows, not the rows shown | bug |
| ✅ | 16s | 160 | Ungrouped, a page still holds fewer rows than the pager says: a row the schema refuses is dropped AFTER the page is cut | bug |
| ✅ | 16n | 152 | Data grid pages do not keep to the row count set in the pagination: the count varies from page to page | bug |
| ✅ | 16p | 155 | The change-scope buttons show on a panel filter only after its first edit; they must always show | bug |
| ✅ | 16q | 157 | Tooltips are clipped by other elements: they must sit in the top layer, above everything | bug |
| ✅ | 16r | 158 | A data viz filter sent up to the View cannot be sent back down | bug |
| ✅ | 16o | 153 | In a fixed-row layout grid, the data grid and its container change height with the row count; the container must keep its height and the grid fill it | bug |
| ✅ | 16s | 201 | In Chromium on Linux the nav rail opens to hover by itself, so 5 closed-rail tests fail every run | bug |
| ✅ | 16t | 202 | Sherpa Demos: 7 Chromium tests time out — the rail opens under the pointer and covers the filter panel | bug |
| ✅ | 16t1 | 203 | sherpa-ui: 135 of 136 specs load the page without the pointer park — one fixture, as in Demos? | bug |
| ✅ | 16t2 | 204 | WebKit: a `page.reload` in the Demos nav favourites spec never fires `load` — 1 run in 80 | bug |
| ✅ | 16t3 | 206 | Firefox: "closing the dialog fires a composed close event" sees no event, 1 to 2 runs in 10 | bug |
| ✅ | 16t4 | 228 | The donut chart's legend lets EVERY item be switched off; one must stay on — and a value filter limiting greyed out may not be counted | bug |
| ✅ | 16t5 | 229 | The legend's switched-off items are lost on a page refresh | bug |
| ✅ | 16t7 | 231 | "Reset all to default" and "Reset" are inactive while the filters already ARE the View's default | bug |
| ✅ | 16t8 | 232 | The delete customer dialog is critical all over — borders and labels; only its footer's confirm button is | bug |
| ✅ | 16t9 | 233 | In the filter panel, a filter section's header inside an accordion aligns to the TOP: label, count badge and the accordion button | quick |
| ✅ | 16t10 | 234 | A filter moved up to the View: its menu's FIRST option is "Return to X", its own scope, apart from the other scopes | quick |
| ✅ | 16t11 | 235 | "Return to X" survives a reload: the Query keeps where a View field came up from | feature |
| ✅ | 16t12 | 236 | Read-only Advanced condition rows: the value text is too dark, and the row × shows though nothing can be removed | bug |
| ✅ | 16t13 | 237 | A tile's own `data-where` on a field the View's bar holds narrows nothing, and says nothing | bug |
| ✅ | 16t14 | 238 | The data grid's "Select all rows" does not select every row on every page | bug |
| ✅ | 16t15 | 239 | A chip given a typed Advanced answer in its def does not wear `data-condition` — since the templates went into the JS (199) | bug |
| ✅ | 16t6 | 230 | Reset all filters dialog: "Save filters before reset" sits in a grey border; it is plain form content | quick |
| | | | **C2 — Consumers: frameworks, apps and agents** (planned 2026-10-12) | |
| ✅ | c1 | 225 | `settled()` hangs on an infinite animation — a loader, an indeterminate bar — and waits on the whole document when given a part | bug |
| ✅ | c2 | 224 | Silent failures, round 2: a linked View drops its report; View gaps skip `onReport`; `open()` hangs on an undefined tag; a 200 that is not the file is stamped; and five more | bug |
| ✅ | c3 | 207 | Import anywhere: a base class that loads on a server, and a `define()` that checks first — two copies of the library no longer throw | foundation |
| ✅ | c4 | 209 | The package surface for ONE component: `sideEffects`, `./package.json`, and the extensionless import TypeScript accepts but the page cannot load | tooling |
| ✅ | c5 | 211 | Booleans and data the way frameworks bind them: `data-x="false"` is OFF; a `data` property beside `populate()`; the grid's `rowKey` | foundation |
| ✅ | c6 | 215 | Trusted Types and a strict CSP: one policy for the five HTML sinks; the calendar's inline styles into CSS | foundation |
| ✅ | c7 | 220 | Weight per component, gated: JS and fetched CSS per entry may only fall, and no app module in a component's graph | tooling |
| ✅ | c8 | 226 | Docs and agent text, round 2: CLAUDE.md on the shared sheets and the provider, three Fires blocks, the MCP's dead tokens and "Rule 9", the old def flow | docs |
| ✅ | c9 | 227 | Sherpa Demos, round 2: a refused save is silent; seed lists kept twice; "Items per page" does nothing; `settled()` for its 62 waits | bug |
| ✅ | c10 | 218 | Framework fixtures — measure, never infer: Vite + React 19 and 18, Next, Vue, Angular, SvelteKit, webpack, a CDN page, a CSP page | tooling |
| ✅ | c11 | 195 | The spec becomes the whole contract: props only, slots, `populate()` shape, typed events; a usage gate | tooling |
| ✅ | c12 | 210 | Framework typings from the manifest: the tag map, React 19 JSX, Vue and Svelte types, editor data — after 195 | tooling |
| ✅ | c13 | 213 | Only a component's OWN events leave it: an inner `button-click` stops at its host | foundation |
| ✅ | c14 | 212 | Markup paths for the list components — tabs, breadcrumbs, a select's options, key-value pairs — so plain HTML and React 18 can fill them | feature |
| ✅ | c15 | 214 | Forms complete: `<fieldset disabled>`, reset on every control, and the five controls that submit nothing | foundation |
| ✅ | c16 | 208 | The text in the JS, not fetched: templates and sheets inline at build, URLs only in a dev build — with 199 | refactor |
| ✅ | c17 | 199 | A smaller download: minify the JS (a new dev tool) and load icons on demand | refactor |
| ✅ | c18 | 216 | Tokens safe to embed: the page rules out of `tokens.css`, a default mode, the `[data-status]` reach documented | foundation |
| ✅ | c19 | 219 | The framework guide, steps not history, served as `sherpa://frameworks`; an `AGENTS.md` in the package | docs |
| ✅ | c20 | 217 | React 18 and Angular adapters, generated from the manifest — small, and dependency-free | tooling |
| ✅ | c21 | 197 | ONE way to write a filter condition in a definition or a View: readings, or a plain `{ field: { gt: 0 } }` | foundation |
| ✅ | c22 | 190 | A Context contract and ONE `app.json`: the Contexts, the default, the Settings pages — the nav, router and server read it | foundation |
| ✅ | c23 | 191 | Library parts that empty `contexts/`: dialog prompt/confirm, saved filters in the provider, `data-setting`, store seeds | foundation |
| ✅ | c25 | 221 | `sherpa-ui/app` and the app boundary: the app layer stays OPT-IN, so one button never pays for it | foundation |
| ✅ | c26 | 194 | A Context loader beside `sherpa-router`: `<sherpa-outlet>` reads `app.json`; `index.html` becomes config | foundation |
| ✅ | c27 | 193 | ONE app guide, steps not history, served to agents as `sherpa://app-guide` — after 190 | docs |
| ✅ | c28 | 192 | Ship the agent path: the MCP with its real dependencies and files, a pack smoke test, registered in both projects | tooling |
| ✅ | c29 | 222 | The starter: `npx sherpa-ui init my-app` and a `scaffold_app` tool — one folder, about 8 files, no build step | tooling |
| ✅ | c30 | 196 | ONE filter surface and a smaller DataSource: `bind()` out of the data layer; one helper for bar and panel | refactor |
| ⬜ | c31 | 223 | DEFERRED — server rendering with declarative shadow DOM, after 208 | explore |
| | | | **D — Filters: Will's features, on the foundation** | |
| ✅ | 17 | 99 | EXPLORE — a FILTERSET: filters in serial, in parallel, or both; and a group of chips | explore |
| ✅ | 18 | 89 | Every filter added to the panel starts SIMPLE: chips, one chip with a menu, or a number input or range | feature |
| ✅ | 19 | 90 | Any filter switches to ADVANCED: condition rows, with options per field type | feature |
| ✅ | 19a | 110 | In Advanced rows, AND is serial and OR is parallel: an AND row offers only what the rows before it leave | feature |
| ✅ | 20 | 21d | EXPLORE — conditions for a DATE field | explore |
| ✅ | 21 | 98 | One action row per panel filter — Reset, Apply, Discard; Apply all and Discard all in a footer; the actions column goes | feature |
| ✅ | 21a | 105 | "Save filters" saves EVERY scope under one name; a "Saved" chip shows it, warns when edited, and undoes it | feature |
| ✅ | 21b | 109 | Reset has a label, and a menu button: "Reset to default" puts back the View's own filters | feature |
| ✅ | 22 | 97 | A filter panel section shows an icon for WHAT it filters: View, Chart, Grid, Form, List | quick |
| ✅ | 22a | 115 | Figma: a chart glyph and a table glyph for the panel's section icons | figma |
| ✅ | 22b | 154 | A data viz section in the filter panel has a chart icon | quick |
| ✅ | 23 | 60 | Once applied, a chip's badge shows the number of results | feature |
| ✅ | 24 | 49 | A preset Advanced chip shows its conditions, read-only | feature |
| ✅ | 25 | 50 | A reader's saved Advanced chip shows its conditions, editable | feature |
| ✅ | 26 | 48 | A child menu opens on hover or click of its row | feature |
| ✅ | 27 | 21c | A condition's matches must ALL highlight | feature |
| ✅ | 28 | 21f | "Send to view filters" | feature |
| ✅ | 29 | 21b | Which header chips carry over between views | feature |
| ✅ | 30 | 20b | The Date filter should be a view-scope date RANGE | feature |
| ✅ | 31 | 52 | A data viz scope in the filter panel: one Simple filter, a chip per legend item, with its swatch | feature |
| ✅ | 31ab | 159 | A data viz filter held by the View: a legend click changes the VIEW's values, and toggles the item | feature |
| ✅ | 31aa | 149 | A chart legend's items ARE swatch chips: move `sherpa-chart-legend` onto `sherpa-quick-filter` | refactor |
| ✅ | 31a | 107 | A filter can apply LIVE, debounced — an opt-in; the default stays once per act | feature |
| ✅ | 31b | 124 | The Filters button and menu move to the filter panel HEADER: one menu for every scope | feature |
| ✅ | 31c | 122 | Email starts SIMPLE, with a switch to Advanced; over 20 values it is one chip with a multi-select menu | feature |
| ✅ | 31d | 120 | A view-scope filter gets "Send to `<scope name>`", the counterpart of "Send to view filters" | feature |
| ✅ | 31e | 121 | Clear and Send to are ONE button group, with the grouping classes | quick |
| ✅ | 31f | 123 | An inactive chip KEEPS its match count badge; it goes only when every value and condition is removed | feature |
| ✅ | 31g | 125 | The sort tooltip names the direction as well as the field | quick |
| ✅ | 31h | 126 | "Filter applied at higher scope" becomes "Filter moved to `<scope name>` scope" | quick |
| ✅ | 31i | 129 | "Reset all to default", with a confirm dialog and a "Save filters before reset" switch | feature |
| ✅ | 31j | 133 | The results count badge shows at the right of a filter panel SECTION header, where it fits | feature |
| ✅ | 31k | 134 | A number filter menu has Reset, not Clear: its field and slider handles go back to their original values | feature |
| ✅ | 31l | 135 | A calendar with limited dates: a Month or Year with no date to pick is inactive too | feature |
| ✅ | 31m | 138 | Advanced filters go back to the INFO status styling, from success | quick |
| ✅ | 31ma | 156 | Advanced filters use the DEFAULT ACTIVE styling — no colour of their own | quick |
| ✅ | 31n | 139 | An Advanced toolbar chip's value half shows its VALUES, truncated — not the condition labels | quick |
| ✅ | 31o | 140 | Every Sherpa input a reader types into shows the Clear button — not a number stepper, not a text area | feature |
| ✅ | 31p | 141 | Advanced is an icon button again — f(x), at the right of the section or menu header, active when on | quick |
| ✅ | 31q | 144 | A View's filters survive a swap to another View — a draft per View, for the session, and across sessions; two settings, on by default | feature |
| ✅ | 31r | 171 | The filter panel's search matches FIELD labels as well as value labels | feature |
| ✅ | 31s | 172 | In the filter panel, each chip of a multi-value filter shows its own count badge | feature |
| ✅ | 31t | 173 | BUG: a panel section header's count badge ADDS its values' counts; it should be the UNIQUE results of them all | bug |
| ✅ | 31u | 174 | Two View fields that share no rows return NOTHING, though each badge has a count; a filterset's fields should limit each other's options | bug |
| ✅ | 31v | 176 | A greyed-out chip says WHY in its tooltip, in a few simple words | feature |
| ✅ | 31w | 180 | A picked value a LATER filter rules out goes inactive and leaves the query; the latest filter wins | feature |
| ✅ | 31x | 179 | Every place a ruled-out value shows is inactive — a chart legend's item too | bug |
| ✅ | 31y | 178 | The filter panel's header gets an overflow (⋯) menu; "Limit matching filters" is an item in it and in the toolbar's | feature |
| ✅ | 31z | 181 | A saved filter's menu shows its condition rows, read-only — the Advanced menu, not a bespoke one | refactor |
| ✅ | 31z2 | 186 | Saved filter card: six small choices left from 181, each built one way | feature |
| ✅ | 31z3 | 205 | With "Limit to matching filters" on, both ⋮ menus offer "Hide unmatching filters"; the old name is renamed | feature |
| ✅ | 31z4 | 240 | A filter set is drawn quietly: no heading or link icon on the bar, no nesting in the panel | quick |
| ✅ | 31z5 | 241 | A set's chips on the bar are plain chips, side by side — not grouped | quick |
| ✅ | 31aa2 | 182 | The filter panel's search: more room above it, and the full width of the header less its padding | bug |
| | | | **E — Views and navigation** | |
| ✅ | 32 | 15 | Save a View, and the Save split-button menu | feature |
| ✅ | 33 | 17b | At the mobile breakpoint the nav becomes a menu | feature |
| ✅ | 33a | 116 | `sherpa-nav` binds to a Store: its entries as data, drawn and redrawn | refactor |
| ✅ | 34 | 34 | Figma: use the Navigation terms | figma |
| ✅ | 35 | 79 | Nav header: Settings and Pin are one Button group in an Actions slot | component |
| ✅ | 35d | 164 | At the mobile breakpoint the app header shows no nav hamburger: it does not get narrow enough to trigger it | bug |
| ✅ | 35b | 161 | The app header's shadow FADES in, very quickly, as the Context scrolls under it | quick |
| ✅ | 35c | 163 | The app shell's panel areas are 150% of their width today, at the least | quick |
| ✅ | 35a | 146 | The app shell's FIXED panel areas resize by dragging their inner edge; the content reflows; two levels of container query | feature |
| ✅ | 35b3 | 200 | Sherpa Demos: "a record added on one Context changes the summary on another" flakes in WebKit — the summary reads 0 | bug |
| ✅ | 35b2 | 198 | A direct link to a View with cards of its own (`?view=capacity`) draws the default View's cards | bug |
| ✅ | 35b | 177 | AFTER the example app moves (37) — an app setting: resize layout grid content by handles in its gutters, snapping to columns and rows | feature |
| ✅ | 35c | 183 | REVIEW — how a consumer builds an app on Sherpa: use, configure, extend, scaffold, the data layer; and for AI agents | explore |
| ✅ | 35c3 | 187 | Make the docs and the MCP text TRUE: `rows:'all'`, the provider in PRINCIPLES, dead names, prompt and scaffold text | docs |
| ✅ | 35c4 | 188 | Fix the bugs 183 found, and run the gates we have: IdbStore update, Edit saves Plan, one badge writer, double `input`, provider reports and Fires; lint and node tests in the hook | bug |
| ✅ | 35c5 | 189 | Readiness and a smaller download: export `settled()`, shared sheets on single imports, minify, icons on demand | refactor |
| ✅ | 35c2 | 185 | Sherpa Demos: `definitions/` becomes `views/` (JSON, templates in HTML by id), `view-schemas/`; rethink `contexts/` | refactor |
| ✅ | 35d | 184 | INVESTIGATE — does sherpa-ui need Node to ship? A CDN, a script or a small zip may suit it better | explore |
| | | | **F — Data states and charts** | |
| ✅ | 36 | 58 | Loading, empty and error states in a container | feature |
| ✅ | 37 | 9b | A Data Viz header, for metrics and chart containers | component |
| ✅ | 38 | 80 | Container and Data Viz headers: Figma's new button styling and grouping | component |
| ✅ | 39 | 14 | An example of real-time data | feature |
| ✅ | 39a | 128 | A gauge's tooltip names the segment as the legend does | quick |
| ✅ | 39c | 162 | A chart and its legend go from side by side to stacked as their container narrows — container queries | feature |
| ✅ | 39b | 150 | EXPLORE — how the example gauge's risk score is worked out; THRESHOLDS in the central Query | explore |
| ✅ | 40 | 59 | EXPLORE, later — Will's own loading pattern | explore |
| ✅ | 40a | 143 | EXPERIMENT, later — scrolled-past metrics become a compact sticky header; a toggle in Settings › Experiments | explore |
| ✅ | 40b | 175 | LATER — the sticky metrics keep a small sparkline, tighter gaps, a larger value; a slow scroll must still gather them | feature |
| | | | **G — Overlay panels** | |
| ✅ | 41 | 22 | The `Ask N-zo` panel — wider, and resizable | feature |
| ✅ | 42 | 23 | A focused grid row opens a details panel | feature |
| ✅ | 42a | 145 | The details panel, tidied: Figma's Panel header, no scrim, a selected row paints the active base | quick |
| | | | **H — The accessibility gate** | |
| ✅ | 43 | 24 | Playwright tests accessibility — WCAG 2.1 AA | gate |
| ✅ | 43a | 117 | Clear the accessibility baseline — 11 of 12 done; the accordion is ruled, and waits on 124 | bug |
| ✅ | 43b | 118 | Four texts fail colour contrast — re-point the alias chain to a darker shade, no new hex | figma |
| | | | **I — The big builds** | |
| ✅ | 44 | 67 | A UTILITY layer: `sherpa-router`, on the Navigation API | feature |
| ✅ | 45 | 68 | `sherpa-templater`: templates fetched and swapped live, out of `SherpaElement` | refactor |
| ✅ | 45a | 136 | A FIND input: jump to the next or previous match; an optional Find & Replace menu | component |
| ✅ | 46 | 27 | A consumer can supply their OWN templates and CSS | feature |
| ✅ | 47 | 25 | `sherpa-layout-canvas` + minimap | component |
| ✅ | 48 | 26 | A `Grouped` mode for the content area, and plain grid templates? | feature |
| ⬜ | 48a | 170 | MAJOR, LAST, and only when Will says — the data layer runs on the client, the server, or both, whole or in parts | explore |
| | | | **J — Tidy-ups and renames** | |
| ✅ | 49 | 11 | `sherpa-group`: what is left | tidy |
| ✅ | 50 | 28 | A Figma component is NOT always a web component | tidy |
| ✅ | 51 | 30 | Do we still need `icon-paths.ts` and `render-icon.ts`? | tidy |
| ✅ | 52 | 33 | Density as step offsets, and a breakpoint step | tokens |
| ✅ | 53 | 36 | CSS: compiled where it should inherit? | tidy |
| ✅ | 54 | 11d | `data-type` means nine things; `data-empty` means three | tidy |
| ✅ | 55 | 84 | Use the platform: Intl for money, units and deltas; Temporal in the calendar | refactor |
| ✅ | 56 | 81 | Component contracts move from YAML to JSON | refactor |
| ✅ | 56a | 111 | A spec types every JS property as `string` — `reading`, `conditions`, `open` | tidy |
| ✅ | 57 | 29 | Rename `src/index.ts` to `src/app.ts` — dead last | rename |
| | | | **K — Agentic UI: much later** | |
| ⬜ | 58 | 76 | FUTURE (Will, 2026-10-14) — WebMCP: agents do UI tasks through Sherpa's own contracts — not critical now | explore |
| ⬜ | 59 | 77 | LATER, important — UX patterns DEFINED by contract, so a consumer adds its own; never baked into Sherpa | explore |
| ⬜ | 60 | 78 | LATER, large — node components and their logic in Sherpa; the workflow creator is an app on the canvas and nodes | explore |
| | | | **L — The code review** | |
| ✅ | 61 | 242 | The code review of every component — the plan is `docs/CODE-REVIEW-PLAN.md`, ruled; its work is rows 256–296 | explore |
| ✅ | 61a | 243 | BUG: a MOVED component stops marking its slots, and its slider, tooltip, nav and dialog listeners go dead | bug |
| ✅ | 61b | 244 | BUG: five events are missing from the specs, and two phantom events are in them | bug |
| ✅ | 61c | 245 | BUG: a deleted saved View comes back from IndexedDB | bug |
| ✅ | 61d | 246 | BUG: `RestStore` does not say it is remote, so a real backend has no draft and loads on each pick | bug |
| ✅ | 61e | 247 | BUG: a prop's text erased the slot beside it — container-header's icon, toast's heading, gauge's caption | bug |
| ✅ | 61f | 248 | BUG: two icons are drawn as CSS classes, which paint nothing | bug |
| ✅ | 61g | 249 | BUG: a bar's report writes over the source's saved filters | bug |
| ✅ | 61h | 250 | BUG: `export()` and `viewQueryOf` put sort and group in different scopes | bug |
| ✅ | 61i | 251 | BUG: `data-refresh` guesses a source when it does not know which | bug |
| ✅ | 61j | 252 | The calendar calls `Temporal`, which Safari does not have yet — KEPT, by Will's D7 | bug |
| ✅ | 61k | 253 | BUG: nav-item's search highlight carries its own colour in TS, where `lint:css` cannot see it | bug |
| ✅ | 61l | 254 | The line chart's area: `opacity: .14` on the 50% series colour draws about 7% — KEPT, by Will | design |
| ✅ | 61m | 255 | The calendar on an iPhone: every iOS browser is WebKit, so none has `Temporal` — a stand-in where it is missing | bug |
| ✅ | 62.01 | 256 | Phase 1.1 — close `check:props`' loophole: each host attribute JS writes is declared, or a `:state()` | gate |
| ✅ | 62.02 | 257 | Phase 1.3 — `data-accepts` on every content slot — one vocabulary of categories, gated | gate |
| ✅ | 62.03 | 258 | Phase 1.4 — `lint:css` and CLAUDE.md agree on `prefers-reduced-motion` | gate |
| ✅ | 62.04 | 259 | Phase 1.5 — no hand-typed counts in the rule docs | docs |
| ✅ | 62.05 | 260 | Phase 7 — `sherpa-ui serve` replaces the unpinned `npx --yes serve` | tooling |
| ✅ | 62.06 | 261 | Phase 7 — the docs say what Sherpa needs: `Temporal` for the calendar, the Inter font, the browsers; `engines` and an honest browserslist | docs |
| ✅ | 62.07 | 262 | Phase 7 — `dist/` stops shipping the inlined `.html` and `.css`, and the build strips `data-accepts` | package |
| ✅ | 62.08 | 263 | Phase 7 — drop autoprefixer, cssnano, prettier and husky; eslint 9; `@types/node` for the scripts only | tooling |
| ✅ | 62.09 | 264 | Phase 7 — a phone check: one small Playwright project at a phone size, with touch | test |
| ✅ | 62.10 | 265 | Phase 7 — SPIKE — open a dialog from markup alone with invoker commands | explore |
| ✅ | 62.11 | 266 | Phase 2 — D4: the stored-data shims go, and the docs and comments that use Demos as the reference | tidy |
| ✅ | 62.12 | 267 | Phase 2 — Q1: the starter, `init` and `scaffold_app` move to their own sibling project | move |
| ✅ | 62.13 | 268 | Phase 2 — Q2: the hook stops checking Demos; `check-usage` ships as a consumer tool | tooling |
| ✅ | 62.14 | 269 | Phase 2 — old filter names, data-API leftovers, component aliases | tidy |
| ✅ | 62.15 | 270 | Phase 2 — dead code, icon leftovers, repo strays, `Some things to address.md` | tidy |
| ✅ | 62.16 | 271 | Phase 8.3 — one example per component ships beside its spec; the a11y gate and the MCP read it | docs |
| ✅ | 62.17 | 272 | Phase 8.3 — `../Sherpa Gallery`: native pages, CSF stories, the fake data layer | build |
| ✅ | 62.18 | 273 | Phase 4 — elevate form plumbing and focus delegation into `SherpaElement` (D5) | refactor |
| ✅ | 62.19 | 274 | Phase 4 — default role and ARIA through `ElementInternals`; boolean accessors and forwarding from `static props` | refactor |
| ✅ | 62.20 | 275 | Phase 4 — private host state as `:state()` (D3) — `data-has-*` last | refactor |
| ✅ | 62.21 | 276 | Phase 4 — one write door, `set()`; `num()`, `mirrorAttrs`, `writeIcon` used; `emit({ cancelable })`; a smaller base | refactor |
| ✅ | 62.22 | 277 | Phase 4 — state first: the five hold-until-rendered queues become one rule | refactor |
| ✅ | 62.23 | 278 | Phase 3 — the lexicon — one name per idea — for Will's approval | explore |
| ✅ | 62.24 | 279 | Phase 3 — the lexicon's moves, held by a test | rename |
| ✅ | 62.25 | 280 | Phase 5 — the filter family's async root: the menu keeps op and text as it keeps `want` | refactor |
| ⬜ | 62.26 | 281 | Phase 5 — toolbar and panel: one helper for each part written twice | refactor |
| ⬜ | 62.27 | 282 | Phase 5 — each component's own type imported — no hand-typed casts | refactor |
| ⬜ | 62.28 | 283 | Phase 5 — charts: one frame sheet, shared hotspots, no `:has()` caps, shared axis code | refactor |
| ⬜ | 62.29 | 284 | Phase 5 — a roving-focus helper: the keyboard reaches step-tracker, breadcrumbs, transfer-list, calendar and the charts | a11y |
| ⬜ | 62.30 | 285 | Phase 5 — controls, containers, templates: one radio grouping, one header chrome, one dismiss, prototypes | refactor |
| ⬜ | 62.31 | 286 | Phase 6 — the bench: loads, compiles and clones per act, against a baseline that may only fall | gate |
| ⬜ | 62.32 | 287 | Phase 6 — split `data-source.ts` along its seams | refactor |
| ⬜ | 62.33 | 288 | Phase 6 — one copy of each data helper | refactor |
| ⬜ | 62.34 | 289 | Phase 6 — each layer its own job: one publish protocol; the provider answers asks; data meaning leaves the UI | refactor |
| ⬜ | 62.35 | 290 | Phase 6 — honest entry points: `sherpa-ui/data` is DOM-free | package |
| ⬜ | 62.36 | 291 | Phase 6 — faster: one batch per report, a counts cache, `Store.distinct`, fewer clones | perf |
| ⬜ | 62.37 | 292 | Phase 6 — one door per job, and the missing read-backs | api |
| ⬜ | 62.38 | 293 | Phase 8.1 — the doc set: a TRAPS index, TODO's head, the reviews to history, the rules doc, CLAUDE.md to pointers | docs |
| ⬜ | 62.39 | 294 | Phase 8.2 — a component reference, generated from the specs | docs |
| ✅ | 62.40 | 295 | Phase 8.5 — `custom-elements.json` and VS Code's HTML data, from the specs | tooling |
| ⬜ | 62.41 | 296 | Phase 8.4 — a README front door | docs |
| ✅ | 62.42 | 297 | BUG (Will, 2026-10-14): the calendar's header content is misaligned | bug |
| ✅ | 62.43 | 298 | Phase 7 — the MCP package carries its own copy of the generation libraries, so sherpa-ui ships no tooling | package |
| ✅ | 62.44 | 299 | BUG: the breadcrumb separator and the chat avatar draw Font Awesome glyphs, from a font nothing loads | bug |
| ✅ | 62.45 | 300 | BUG (Will, 2026-10-15): not every tooltip is in the top layer; some are clipped by the boxes they sit in | bug |
| ✅ | 62.46 | 301 | BUG (Will, 2026-10-15): menu items without a tick box have no horizontal padding; a hovered item mixes the active and grey colours | bug |
| ⬜ | 62.47 | 302 | Phase 5 — the filter family's last frame waits, tried one by one in Will's next test run | refactor |
| ⬜ | 62.48 | 303 | BUG (Will, 2026-10-15): the app header shows breadcrumbs when an overlay panel opens; they belong in the panel's header, in full-overlay mode, with maximise / minimise buttons | bug |
| | | | **✅ Done — newest first** | |
| ✅ | – | 104 | A number filter never applies what is typed or dragged | bug |
| ✅ | – | 75 | Filter modes are SIMPLE and ADVANCED, not Default and Conditional — every file | refactor |
| ✅ | – | 101 | ADVANCED: a condition row will not add in a chip's menu; in the panel, changing a row's condition drops the row | bug |
| ✅ | – | 61 | Add customer saves with required fields empty | bug |
| ✅ | – | 92 | Navigating SETS UP the content — its definitions, data layer, filters and state — not only swaps the template | foundation |
| ✅ | – | 85 | `sherpa-provider`: a component ASKS for data, a scope, a query, a View or a template | foundation |
| ✅ | – | 73 | EXPLORE — one compiled QUERY, built as the reader sets it up, run on Apply | explore |
| ✅ | – | 70 | EXPLORE — a view definition bundles its filters; one JSON renders the page | explore |
| ✅ | – | 47 | More than 20 values: one chip, not a run | feature |
| ✅ | – | 93 | A grid-scope filter narrows the charts and tiles too | bug |
| ✅ | – | 91 | The APP SHELL switches Filter toolbar and Filter panel modes, for any View in the content area | foundation |
| ✅ | – | 62 | Apply and Discard only for a REMOTE fetch; a debug flag spoofs one | feature |
| ✅ | – | 46 | A PENDING state: changed, not yet applied | feature |
| ✅ | – | 66 | The footer owns "nothing to save": Save and Cancel wait for a change | feature |
| ✅ | – | 39 | The panel header gets Reset all filters | quick |
| ✅ | – | 53 | A conditional chip's tip says "X conditions applied" | quick |
| ✅ | – | 40 | A switch has no accessible name | quick |
| ✅ | – | 17 | Breadcrumbs are for workflow, not for the nav | quick |
| ✅ | – | 57 | The filter panel's width is a hard-coded 400px | quick |
| ✅ | – | 65 | A horizontal legend has a max width, and is centred | quick |
| ✅ | – | 41 | A conditional filter applies for Owner only | bug |
| ✅ | – | 63 | A conditions-only field shows the Conditional switch | bug |
| ✅ | – | 69 | The main header has a back button | bug |
| ✅ | – | 56 | A view change leaves a lit chip that filters nothing | bug |
| ✅ | – | 21e | A reload keeps a filter nothing on screen shows | bug |
| ✅ | – | 55 | The At risk view's own column filter never applies | bug |
| ✅ | – | 44b | A heading holds a whole reading, so a CHAIN shows and applies | bug |
| ✅ | – | 71 | The chart legend's Other menu does not open; check it filters the chart | bug |
| ✅ | – | 72 | Adding a second conditional filter resets the first | bug |
| ✅ | – | 44c | A heading shows an answer held at VIEW scope | bug |
| ✅ | – | 42 | A legend toggle filters the whole view | bug |

**Why this order** (reassessed 2026-09-29).

- **B — what is left of the foundation.** 86 first: an ASSESSMENT for Will to
  rule on, so it costs no code while he reads it. Its last step, A7, is built
  WITH 102 (agreed 2026-09-29): the menu owns the reading, so both answers are
  kept in one place. 75 (done) came before any filter feature, so 89, 90, 98
  and 99 are built in the new words. 38's one builder is built WITH 89 (see D).
- **C — Contained bugs.** Each is fixable in its own component or page. In
  pairs where one fix serves both: 45 and 82 (a chip's face after a silent
  set), 83 and 94 (a menu's footer).
- **C2 — Consumers** (2026-10-12). Will: *"Sherpa needs to be easy for
  consumers (developers and agents) to work with. Its components also need to
  support individual components being used with other frameworks as well as
  serving up its own app layer/boilerplate for pure sherpa app projects."*
  Three runs, in order. FIRST the small items that wait on no ruling (c1–c9),
  then the fixtures that prove them (218). THEN the framework track, on 195's
  manifest: typings, events, markup, forms, inline text, tokens, the guide, the
  adapters. LAST the app layer, which waits on 183's choices: one grammar (197),
  `app.json` (190), the library parts (191), the opt-in entry (221), the outlet
  (194), the app guide (193), the MCP (192), the starter (222). 196 is XL and
  runs beside or after the app layer, as 183 chose. The re-check is
  `docs/CONSUMER-REVIEW.md` §5–6.
- **D — Filters.** The panel is rebuilt ONCE: 99 designs how filters group
  first, then 89 (Simple, with 38 step 4's one builder), 90 (Advanced, on
  102's two kept answers) and 21d (its date half), then 98 (the action
  row, on 90). Then 60; 49 before
  50; 20b before any date condition ships.
- **E — Views and navigation.** 15's save is built (`provider.saveView`); what
  is left is Records' dialog and the split button.
- **F** uses the remote flag to show its states. **H** comes after the markup
  settles, before new components, so they must pass it. **I**: 68 and 27 are
  one door; 67 takes over the router's `open()`. **J**: 29 dead last — it
  touches every import.

---

## B — The foundation: what is left

### `[x]` ✅ 86 — AUDIT: every component's functions and events — one request, one response, standardised in `SherpaElement`

**Assessed and decided 2026-09-29 — `docs/COMPONENT-API-AUDIT.md`.** About
1,300 copied lines in six families; seven build steps (A1–A7), one commit
each. Will's rulings are its §6: chip and tag stay two components; `-select`
means picked one; meters take a number; sort and group keep their scope (with
99); two shared chart sheets.

Will, 2026-09-27: *"Once the provider approach is completed, it might be a
good idea to take a look at all of the functions and events for all UI
components to see where there is logical duplication but name, or
implementation, divergence. If it can make generic requests, expects generic
responses, and can be standardised in sherpa-element (communicating with
sherpa-provider etc.) then we should make those optimisations. Take care to
not only add code but rewrite, or refactor, existing code. We can also remove
redundant code, too. Do the assessment first, for review, before executing
these changes."*

After P5. Assessment FIRST, for Will's review; nothing is changed before he
rules. `PROVIDER-DESIGN.md` §9 is its first pass (the filter family, the
base class, the wrapped controls, the charts). Still to cover: every public
method and every event of all 63 components, side by side — same job,
different name or different code.

**Open from §9, and part of this:** 4 (the grid builds its filter menu by
hand, and the page sets its `data-column-values` — read both from the
source), 5 and 7 (ONE event shape, `{ readings, presets }`, which retires the
grid's `ColumnFilter`), 10 (the wrapped native control, four times), 12
(chart axes), 14 (the app-header re-exposes the bar) and 15 (leftovers). Item
8 is 68; item 11 is 84.

**Measured 2026-09-30 — the grid's headings on `menuFor()`.** It is not a
plain move. Today a NUMBER heading has an operator select ("Greater than")
in its Simple body; a number CHIP, built by `menuFor()`, has none since 90 —
it answers with Advanced rows where the field offers them. And a heading is
drawn from the page's column (`ui.grid.columns`), which does not say
`advanced`; the chip is drawn from the source's field, which does. On
`menuFor()` the heading's date calendar code goes too: the menu reads and
writes a date body itself. The dead Range switch handler goes either way.

**❓ One choice:**
- **A (my pick): the heading is the chip's menu.** It is built from the
  source's own field (`advanced` included), so "Greater than" is an Advanced
  row there, as on the chip. One field, one menu.
- **B: keep the heading's operator select**, and build only the rest on
  `menuFor()`.

**✅ Will, 2026-10-01: A — built.** A grid heading now opens the chip's own
menu: the grid asks its provider for each column's FILTER
(`DataAsk.filters`, which replaced `values`), and `menuFor()` builds it from
`source.filterDef()`. So a heading follows its field: Region shows
"Americas" (the value's name), Owner offers Advanced and Region does not, a
number asks "at least" as an Advanced row, and Created is the menu's own
date body. The grid's calendar code, its dead Range switch handler and two
templates are gone. A grid with no source builds the def from its column.
`T-a-heading-opens-the-chips-menu`

**Left of A7:** one event per act, and the 18 members go — still built with
89.

**A7 build, from 2026-10-13** — measured first (a read-only agent): all 18
members and the 8 events are still there; 13 calls in `src`, about 101 in
sherpa-ui's tests and 28 in Sherpa Demos' tests. Each stage ships with
behaviour unchanged.

| | stage |
|---|---|
| ✅ | 1. Events: the menu's `filter-mode-change` becomes `condition-mode-change` (the provider's has the same name); `filter-clear` and `filter-condition-change` go — a field's mode is in its answer. **Kept:** `calendar-apply` and `calendar-cancel`, a lone calendar's only report of its own footer's buttons |
| ✅ | 2. The bar's `quick-filter-change` carries its whole answer — `{ scope, readings, presets, holds, active, values }` — and its `filter-add` / `filter-remove` carry `holds`, so the binder reads the event, never the bar. `savedReadings` goes (`presets` says it). **Kept, found while building:** `active` is a field-less toggle chip's only report; `presets` and `heldFields` are read-backs (State ownership), and the provider's Add list reads `heldFields` |
| ✅ | 3. `filter-add` / `filter-remove { scope, ids }`, always a REQUEST: the panel's `filter-add-request` folds in. Done: the panel asks with `filter-add { scope, ids, from? }`; the binder tells a panel's ask from a bar's report by the binding's scope list, as it did for `filter-remove`. A bar still adds its own chip, then reports its `holds` |
| ✅ | 4. KEPT by Will's B (2026-10-13) — The grid: its heading's answer is `quick-filter-change { scope, readings }`; `column-filter-change` and the six column members go; `supersedeColumns` is drawn as the bar is |
| ✅ | 5. KEPT by Will's B (2026-10-13) — The toolbar's `setChipValues`, `setChipReading`, `supersede`, `superseded`, the panel's `setFieldReading` and `values`, and the app-header's `values` and `available` go — `drawReading` and `drawScope` are the doors |

**❓ Will — stages 4 and 5, found while building.** They delete doors that
the State ownership rule asks for: CLAUDE.md names `grid.columnClause(field)`
as THE read-back getter, and `setColumnFilter` / `setChipValues` are what "a
caller with no pointer would type" (the parity sweep). They cost about 60
test sites in sherpa-ui and 20 in Demos. Stages 1–3 already met the audit's
aim: one event name per act, and a binder that reads only events. And the
grid's `column-filter-change` names ONE field, where `quick-filter-change` is
a WHOLE answer, so renaming it changes what it means.
- **A:** delete them as the audit planned; `drawReading`, `drawScope` and
  `readings` are the only doors.
- **B:** keep them as the doors and read-backs, and close A7 at stage 3.
My pick: B.

**✅ Will, 2026-10-13: B** — the doors stay, and A7 closes at stage 3. 86 is done.


### `[x]` ✅ 74 — EXPLORE: the Query builds every group, sort and filter menu; a menu shows its sub-query

Will, 2026-09-27: *"The query language, and single query object, can be used
to construct group, sort, and filter menus both in their simple list
presentation mode and the conditional mode. It also allows us to expose the
sub-query, that defines the conditions, for any filter menu."*

So a menu is DRAWN from its field's slice of the Query — its values, its
picks, its rows — in either mode, and the bar, the panel and a heading stop
building their own. And any filter menu can SHOW the sub-query behind it: the
conditions it compiles to, readable, perhaps editable. Explore with 49 and 50
(an Advanced chip shows its conditions), which are this seen from a chip.

**No query LANGUAGE — JSON.** Will, 2026-09-27: *"I don't think we should
construct a query language for it. We're probably best served using JSON. As
long as the whole situation is captured and can be recreated then we're
good."* The sub-query IS the field's slice of the Query — its `FieldReading`,
condition rows and all — shown and saved as JSON, and restored by
`setQuery`. No grammar, no parser, no second spelling of a condition.

**✅ Explored 2026-09-29 — the answer, as built in 102 and 103:**

- **A menu is drawn from its field's slice of the Query.** That slice is a
  `FieldReading` — both answers, the mode, the mirror — and it is the menu's
  own `menu.reading` (get and set). The source draws it (`drawReading`) into
  the bar, the panel and a grid heading, and each reads its menu the same way;
  the grid's own fourth spelling (`ColumnFilter`) is gone. No host builds an
  answer out of a menu's parts any more.
- **A group and sort menu** already draws from the Query's arrangement
  (`ScopeQuery.group` / `sort`); nothing new is needed there.
- **The sub-query is shown as the reading**, in the reader's words: the rows
  a chip or a heading holds (`spellConditions`) and, for a machine, its JSON.
  Showing and editing it on a chip is 49 (read-only, a preset) and 50
  (editable, the reader's own) — feature work in D, on this.
- **Left for A7 (86):** the grid's headings built by `menuFor()`, so every menu
  is made one way as well as read one way.

### `[x]` ✅ 103 — Rows with no key get one from the data layer — Sherpa's own, never sent out

Will, 2026-09-29: *"If we get grid data without keys then the data layer
should give it keys. Means selection always works with keys. Keys are only
for Sherpa's capabilities so we need to make sure we don't pollute any data
we are ever sending out of the data layer to external sources (databases
etc.)."*

Today a grid with no `key` cannot name a row: `selectedKeys` is EMPTY, and
`selection-change` sends row POSITIONS as `selected` (left open by the API
audit's A6, `docs/COMPONENT-API-AUDIT.md`).

- **The data layer gives a keyless row a key**, so selection — and anything
  else that names a row — always works by key, and `selection-change` sends
  keys.
- **The key never leaves the data layer.** Not in a store's insert or update,
  not in `export()`, not in a saved View's JSON, not in anything sent to an
  external source. A field on the row would leak through every one of those,
  so it is kept BESIDE the row (a symbol, or a map by row), never on it.
- **Settle first:** how long a made-up key lives. A key the data never had is
  stable only while the rows are, so a saved View keeps a selection only over
  a real key — say so rather than restore the wrong rows.

**✅ Done 2026-09-29:** every store keys the rows it hands out — by the row's
own key field, or by a made-up `sherpa:<load>:<n>` held in a `WeakMap` BESIDE
the row (`src/core/data/row-key.ts`), so nothing is ever written on a row and
nothing leaks into JSON, a store write or an export. `ArrayStore` carries each
key from its own row to the copy it hands out, so a key is the same on every
load; a made-up key also finds, updates and removes its row. The grid selects
by key always, and `selection-change` sends keys. A made-up key lives for one
page load: a stale one from a saved View is dropped and reported
(`stale-made-up-key`), never matched to the wrong row.
`T-a-made-up-key-never-leaves-the-data-layer`

### `[x]` ✅ 38 — One model, one builder, one owner: what is left

Will, 2026-09-25: *"I'm juggling bugs here between the filter panel and filter
toolbar when the overlap is considerable so the code should be singular, and
reused, where possible."* The full review is `docs/FILTER-REVIEW.md`.

Will's taxonomy stands: **six KINDS** — group, sort, boolean, single, multi,
advanced. "Organise" is a label, never a kind.

**Done:** steps 1, 2, 5, 5.5 and 6; step 3 — the data layer coordinates — is
done by the provider (85): the panel asks for its scopes, every component finds
its source by asking, and `records.js` carries nothing between the panel and
the bars. A component declares the data it needs (P2). The size gate is
built (`npm run check:size`).

**Left:**

- **Step 4 — ONE field-row builder.** The panel keeps its own `#draw`,
  `#drawSection` and `#drawField`. The bar and the panel differ by the layout
  DIRECTION and whether values EXPLODE into a run — two flags (89's 16-value
  line is the second), not two implementations. Do it WITH 89, which redraws
  the panel's fields anyway, and 99, which groups them. **❓ Waits on 89 and 99**, which each wait on one choice.
- ✅ **"Scope" means one thing now — measured 2026-09-30.** A SCOPE is a
  named place in the Query (`view`, `data`, a chart's part); the app's
  surfaces ARE those places. Which rows a bind gets is `rows: 'page' | 'all'`,
  and how far an answer goes is `reach`. Nothing is left to rename.
- ✅ **Left from 44c — done 2026-09-29:** a heading that ALREADY held its own
  filter when the View took its field applies none of it — the Query answers a
  View-held field in the View alone (`compile`) — and the grid now marks the
  View's matches, not the heading's old ones; the heading keeps its answer for
  when the View lets go (`T-a-view-held-heading-shows-and-refuses`).

Rules for the work: MOVE code, never rewrite it; delete the replaced path in
the same commit; no helper with one caller; state the budget up front and
report the actual.

**✅ Will, 2026-10-12 — all my picks:** Unblocked: 89 (16) and 99 (a `sherpa-filterset`) are ruled.

**✅ Closed 2026-10-13, measured.** 89 and 99 are built, and the shared half of
"one builder" is in `src/core/ui/` already: `menuFor()` makes every filter
menu, `kindOf()` and `oneChipList()` say what a filter is and whether it
explodes, and `FilterDef`, the ⋮ menu, the saved-filter card, `MenuDrill` and
`sherpa-filterset` are one each (196). The bar's `#addMenu` and the panel's
`#giveMenu` both call `menuFor()`; what is left differs by host — the bar's
chips against the panel's field boxes — not a copy. `docs/FILTER-REVIEW.md`
§Step 4 measured the same: it landed at −21. Closed as Will closed 196 stage 6
(2026-10-13: B); say so to reopen it.

### `[x]` ✅ 113 — EXPLORE: state first, then render, in every component; a skeleton while the first render waits

Will, 2026-09-29, asking why a menu dropped a reading set before it had drawn:
*"Wouldn't it make sense for all components to load, set state and conditions
etc, then render? Isn't this covered by the web component life cycle already?"*
Asked A "state first, in every component" / B "remove the wait (templates in
the built JS)", he chose **A**, and added: *"It would also be good if we could
display skeleton loading of content in case there are any delays in the
initial, state based, content rendering."*

**Why it is needed.** The platform's hooks run at once. Sherpa adds its own wait:
`SherpaElement` fetches each component's HTML and CSS, so the first render
comes later. And many components keep their state IN their elements — a ticked
box IS the pick, a row element IS the condition — so a value written before
those elements exist is lost. One cause behind a family of traps:
`T-custom-element-upgrade`, `T-a-rebuilt-row-reads-empty-for-a-tick`, the
"a composed field fills async" rule, and `menu.reading`'s early-reading hold
(102 step 3b).

**The model.** A component keeps its state as plain DATA and draws its elements
from it. A setter stores the data and asks for a draw; the first render draws
whatever is there, so nothing set early is lost, and a read never has to wait
for the page. A composed child is handed its data the same way.

**The skeleton.** While the first render waits, the component shows a skeleton
of its content, not an empty box. Design it with 58 (loading, empty and error
states) and 59 (Will's own loading pattern), so a component and a container
say "loading" one way.

Explore first: measure which components keep state in their elements, pick the
order (the menu first — A7 already moves its answer into `menu.reading`), and
say what `SherpaElement` gives every component (a state field and one draw).

**Measured 2026-09-29** (a read-only sweep of all 63 components):

- **36 have public state; 12 of them keep it in their elements, or partly** —
  in elements: app-header, filter-panel, menu, prompt-composer,
  quick-filter-toolbar, select-group; mixed: file-upload, input-text, nav,
  nav-item, notifications, quick-filter. The other 24 keep it in attributes
  or fields and are safe.
- **Riskiest five:** the toolbar (about 9 setters that write elements before
  they exist, 10 getters that read state out of them; every restore goes
  through it), the menu (`values`, `conditions`, `setCount`, `open`), the
  panel (`readings` read chips; `setFieldReading` writes an empty `#held`),
  the chip (`values`, `valueLabel`, `column`), and select-group (`value` is
  lost before populate and on every re-render).
- **Where early writes come from:** `applyState()` sets accessors at once;
  the provider's `#configure` awaits only `whenDefined`; `persist-view.ts`
  says "deferred to `rendered`" but `applyElements` does not await it (a bug
  to fix first); the source's `#draw` calls `drawReading` directly.
- **What the base class already has:** the `rendered` promise (always
  settles; `populate()` chains on it); `static config` with `#settings` —
  accessors that STORE and redraw after render, used only by the grid, the
  nearest thing to "state first"; attribute replay. No queue for method calls.
- **Models to copy:** the grid (state in fields, `#wantedKeys`), the menu's
  `#early` reading, progress-step-tracker's `rendered.then` setter.

**Proposed order:** fix `persist-view`'s missing await; then the menu, the
toolbar, the panel and the chip — the filter family, built with A7 — then
select-group, input-text and prompt-composer. The mechanism: `static config`
widened for every component (state in `#settings`, one draw), not a family
base class.
Keep each component standing alone — Will's rule, `docs/COMPONENT-API-AUDIT.md`
§5: it extends `SherpaElement` and nothing else, no family base class.

**✅ Step 1 done 2026-09-29 — `persist-view` waits.** A saved View applied to
a component that has not drawn yet now waits for its `rendered` (and for its
tag's definition); a drawn one is applied at once, so a report is still read
straight away. `SherpaElement` gained `hasRendered`, the answer NOW beside the
`rendered` promise. `onViewPicked` reports, and calls `after`, once every
element has its state — so the provider's `view-change` comes after a View's
content is configured. Proved on `sherpa-prompt-composer`, whose value was
lost before. **Not fixed by it**, as the sweep said: the toolbar's `values`
and select-group's `value` are still lost, because they write into elements
a later step (menus stamping, `populate()`) replaces — that is the component
work below, the filter family with A7.

**✅ select-group done 2026-09-29.** Its value is DATA (`#picked`) and the
ticks are drawn from it: a value set before `populate()` waits for the
options, a reader's tick survives new options, and a read before anything
drew answers what was set. Done by hand with a private field, as the grid
does — not the `static config` widening: select-group's `populate()` takes an
ARRAY, which `config` does not merge into. Widen `config` when three
components want the same shape. `T-a-value-is-data-the-ticks-are-drawn`

**✅ prompt-composer and input-text done 2026-09-29.** The composer HOLDS a
value set before its first render and writes it in at the end of `onRender`
— the textarea owns the live text once it exists
(`T-a-value-before-the-first-render-is-held`). input-text already kept an
early value (probed); nothing to do. **Left of 113:** the filter family —
menu, toolbar, panel, chip — built with A7 and 89; and the skeleton, with 58
and 59.

**Split 2026-10-12** (a read of the code): 89 redraws only the PANEL's fields,
so the menu, the chip and the toolbar can be done now; the panel waits for 89.

**✅ Menu and chip done 2026-10-12.** The menu HOLDS what it cannot draw yet:
`values` until its rows exist (their stamp draws them over each item's
`selected`), and `conditions` and `setCount` until it draws. Once drawn, its
rows stay the live answer, because a drill moves them. Items that name their
own picks are newer than held ones. The chip sets its picks THROUGH the menu
— a borrowed menu's and an unstamped one's too — and holds its `valueLabel`.
A hold, not a data copy (`T-a-value-before-the-first-render-is-held`).

**✅ Toolbar done 2026-10-12.** It holds `values`, `setChipValues`,
`setChipReading` and `supersede` given before `populate()` drew a chip, and
`#render()` replays them in order; `values` and `superseded` read the held
steers back; the last `drawResults` reaches rebuilt chips. And the ROOT of
`T-a-rebuilt-bar-reads-empty-until-its-menus-stamp`: a menu that has not
stamped answers from its items' `selected`, and the bar asks the menu for a
chip's picks rather than reading `input:checked`. A rebuilt bar now reads its
picks in the same task.

**Left:**
- the waits that root made redundant — six `#settled()` sites in the toolbar
  and `#pendingAnswers` in `readings`; each removal needs its own proof;
- the panel — with 89;
- ✅ 2026-10-12, the four the 09-29 sweep called "mixed": nav (state in
  attributes and fields), nav-item (attributes; `highlight()` is a search act
  after render) and notifications (`#items`) are clean. file-upload kept each
  file's status only in its row, so an add or a remove lost it — now data,
  kept by file;
- the skeleton. **❓ Will — two choices:** (1) its look: A one shimmer in the
  host's box for every component, B one per component (grid rows, chart bars)
  from Figma — my pick A; (2) when it shows: A only if the first render still
  waits after 300 ms, as a container's loading state does (58), B from the
  first frame — my pick A. First a measurement: how long a first render waits
  on a cold load. If it never reaches 300 ms, the skeleton may not be needed.

**✅ Will, 2026-10-12 — all my picks:** A and A — one skeleton, a shimmer in the host's box, for every component; shown only if the first render still waits after 300 ms.

**✅ Skeleton done 2026-10-13.** Measured first: on a cold load with a 4×
slow CPU, 797 elements on Records, NOT ONE painted a frame between its
upgrade and its first draw — the stamp follows in microtasks. So the skeleton
is the PAGE's: `page.css` shimmers an element whose code has not loaded
(`:not(:defined)`), after 300 ms, and hides its bare children.
`T-a-skeleton-is-the-pages`.

**✅ Panel done 2026-10-13.** `setFieldReading` before the first `populate()`
is held by `scope:field`: `readings` reports it, and the field draws it when
it comes.

**✅ Closed 2026-10-13 — the waits stay.** The proof went the other way: a
TYPED row still fills late — one frame, and up to four on a busy page (the
condition chip test failed 1 in 5 at a load of 30 until the chip asked for
four frames). The bar's four `#settled()` waits and `#pendingAnswers` cover
that gap, so none is redundant. `T-a-rebuilt-row-reads-empty-for-a-tick`.

### `[x]` ✅ 37 — Components are AGNOSTIC of the data, and of the example app

Will, 2026-09-25:

> All sherpa UI components should be agnostic of the data. The data layer
> should provision and inform them. They also shouldn't have any bespoke logic
> in them specific to the example views. [...] For example toggling to the
> filter panel, from the filter toolbar, should be a custom button added to the
> actions slot [...] In fact, we should probably separate the example app to
> it's own codebase and have it use the sherpa-ui framework library as a
> dependency.

1. ✅ **Find the bespoke logic — done 2026-09-29 for the mode toggles.** Both
   were built in — `data-act="configure"` in the toolbar (emitting
   `filter-configure`) and `.to-toolbars` in the panel. The provider, which
   owns the mode, now puts its own button in each bar's `actions` slot while a
   panel is on the page, and in the panel's new `actions` slot; both built-in
   buttons and `filter-configure` are gone
   (`T-the-mode-switch-is-the-pages-own`).
2. **Components take PARAMETERS, never data shapes.** A component should not
   know a field is called `openTickets`. Measure what still does.
   ✅ **The grid's heading values — done 2026-09-29.** The PAGE set them
   (`data-column-values`, in `records.js`). Now the grid's request names the
   text columns that need a whole value list (`DataAsk.values`) and the
   provider sends them with every page of rows; `records.js` does nothing.
   ✅ **Measured 2026-09-29: no component names an example field** —
   `openTickets`, `spend`, `owner` and the rest appear in `src/components`
   only as the `data-status` attribute or in comments.
3. ✅ **Extension, not forking — done 2026-09-30, by 27.** A consumer gives a
   component their own markup and sheets with `useTemplate`, without a fork
   or a subclass (`T-a-templater-owns-the-files`).
4. **Split the example app into its own repo**, LAST. Anything it cannot do
   from outside the library is a boundary the library has not drawn. Its
   pages are JSON now (`examples/definitions/`, Will 2026-09-29), so the folder
   moves with it. **Will, 2026-10-01:** *"There's no repo just yet. Just a
   local, sibling, folder to sherpa-ui called 'Sherpa Demos'."* So the
   example app moves to `../Sherpa Demos`, last. **Will, 2026-10-01: "go on
   37".**

   ✅ **Done 2026-10-01.** The app is `../Sherpa Demos`: `app/` (the old
   `examples/`), its own server, and the tests that drive it. It takes
   sherpa-ui as a dependency (`file:../sherpa-ui`) and imports it BY NAME —
   `sherpa-ui` and `sherpa-ui/data`, through an import map in the browser and
   `node_modules` in Node — as any consumer would. Nothing in it reaches into
   the library's files. 25 test files moved whole and 12 were split: their
   component tests stay here, their app tests went. sherpa-ui's own suite
   needs no app server now. The 9 traps only the app meets moved to
   `Sherpa Demos/docs/TRAPS.md`. Checked: the app loads with no errors (100
   records, 1,284 alerts); the Demos suite passes 359 tests in three engines;
   the library's split files pass 192.

---

## C — Contained bugs

### `[x]` ✅ 301 — BUG: two small menu-item faults

Will, 2026-10-15: *"The horizontal padding on menu items that don't have check
boxes is non-existent. The hover colour of a menu item seems to be mixing the
active colour and a grey colour. Grey for hover/focus. Active for selected.
Only a mix when hover/focus on an active item."*

**✅ Done 2026-10-15.** Both were real, and neither showed on a bare page — a
scan of all 57 menus in Demos found them. **Padding:** the base sheet's
`:where(button) { padding: 0 }`, adopted into the toolbar's and panel's shadow
roots, beat the menu's `::slotted` padding (an outer-tree rule wins, even at no
specificity), so "Save view as", "Delete view", "Reset all to default" and
"Replace all" had none. The reset skips a menu's own buttons. **Hover:** rows
shaded a `--_surface` the host had set, and their own ink; the menu pins its
own surface and a row mixes it with the neutral body ink (a red row's hover
had been red-tinted). After the fix no menu row in Demos has a tinted hover. A
selected row has no fill of its own in a menu, so "only a mix on an active
item" holds. `T-a-tree-rule-beats-slotted`.

### `[x]` ✅ 300 — BUG: not every tooltip is in the top layer

Will, 2026-10-15: *"Not all tooltips are on the CSS top layer and are getting
clipped by other elements and containers. Could be related to anchoring of
tooltips to other components?"*

**✅ Done 2026-10-15.** Not the anchoring: every `.sherpa-tip` and
`.chart-tip` is lifted, and a probe over all 66 gallery pages found each opens.
The defect was `sherpa-tooltip`, whose ordinary mode — the one an app gets —
never showed at all: its bubble is a popover, a closed one is `display: none`,
and only `data-floating` opened it (the filter chip's count tip, the one use
in the library). It is always a top-layer popover now, placed on any of four
sides with a flip when its side does not fit, and the arrow follows the side
(a custom state). `data-floating` is gone. Three tests, in three engines: it
shuts and opens on hover, it shows whole above an `overflow: hidden` box, it
flips. `T-a-tooltip-is-always-in-the-top-layer`.

### `[x]` ✅ 299 — BUG: two glyphs still come from Font Awesome

Found in 270's icon pass, 2026-10-14. `sherpa-breadcrumbs` draws its
separator as `content: "\f054"` and `sherpa-chat-message` its avatar as
`"\f544"`, each in `font-family: "Font Awesome 6 Free"`. Nothing loads that
font since the icons became SVGs (`installIcons()` was a no-op), so each draws
a private-use character in the fallback font: a box, or nothing. Draw each
from the icon set (`chevron-right`, a robot or person glyph) the way every
other icon is drawn, and test the pixels.

**✅ Done 2026-10-15.** Each crumb's prototype carries an `<i class="separator">`
with `data-icon="chevron-right"`; CSS hides the first crumb's. The chat avatar's
default is `microchip-ai` (the set has no robot), inside the `avatar` slot as
before, so a slotted avatar still replaces it. Both tests now ask for a drawn
`<svg>`, not a font. **Not run yet** — Will's next test run.

### `[x]` ✅ 64 — A collapsed accordion section fills with the down (+2) surface

Will, 2026-09-26: a COLLAPSED `sherpa-accordion` section takes the Style
surface's DOWN step — `base +2`, `--sherpa-style-surface-base-2` — as its
background fill. (base / +1 / +2 are default / hover / down.) Bind the Style
name, never a Theme colour: a state is the mode's own step. Open sections keep
today's fill.

**✅ Done 2026-09-29:** `.root:not([open])` binds
`--sherpa-style-surface-base-2` (`#b3b3c3` under the accordion's default pin);
open, the root paints nothing and the card's base shows. The filter panel's
shut scopes take it too. Test in `reforged-accordion.spec.ts`.

### `[x]` ✅ 43 — BUG: the toolbar ⋯ overflow menu shows nothing

The ⋮ `overflow` button ("More actions") opens no items. With every action
overflowed, the menu is, from the top:

- Suggest filters
- Reset filters
- Show Filter Panel
- *(divider)*
- Favorite
- Save view
- Save view as
- Refresh view

**✅ Done 2026-09-29:** the ⋮ opens a menu of every action folded away at this
width, in that order, and a row does what its button does; the page's own
buttons (the panel switch) are listed with the filter actions. `filter-overflow`
is gone — nothing heard it. Found on the way: on a VIEW bar the ★ · Save · ▾
group never folded (its display rule came after the fold steps).
`T-the-more-menu-holds-what-folded`

### `[x]` ✅ 45 — BUG: a picked date does not show in the chip

After a pick in the calendar the chip's right half stays empty. The formats:

| picked | reads |
|---|---|
| one day | `DD Mmm YYYY` |
| a range | `DD Mmm YYYY to DD Mmm YYYY` |
| a range in one year | `DD Mmm to DD Mmm YYYY` |
| a range in one month | `DD to DD Mmm YYYY` |

Build ONE shared formatter in the data layer, DOM-free, beside
`format-tick.ts`, so every date label reads the same. More formats will join
it later; this is the first. (The range chip reads `02 Jan - 11 Dec, 2024`
today — a third spelling.)

**✅ Done 2026-09-29:** a picked date already showed (`#syncDateLabel`, fixed
before 82 was written). The format is now ONE DOM-free `formatDate()` in
`src/core/data/format-date.ts`, exported from `sherpa-ui/data`: `03 Sep 2026`;
`03 to 15 Sep 2026`; `03 Sep to 15 Oct 2026`; `18 Dec 2026 to 03 Jan 2027`.
Read in UTC, day first whatever the locale. `T-a-date-reads-one-way`

### `[x]` ✅ 82 — BUG: a number chip set by a View shows no value on its face

Found in step 7 (2026-09-27). The At risk view gives the bar an Open tickets
chip with `> 2`: the chip holds it (its menu reads `2`, op `gt`), the rows
obey it (13), and a report keeps it — but the chip's face shows no value.
The number body's value reaches the menu without the chip's label being
re-derived for a number. Same family as 45 (a picked date showed nothing),
fixed for dates by `#syncDateLabel`.

**✅ Done 2026-09-29:** the chip built its face from its menu's parts, and
only for a `filter` menu — a number chip's menu is not one, so "> 2" read as
"equals nothing ticked". A number body's face now comes from `menu.reading`,
whatever the menu's type: At risk's Tickets chip reads `2`. Found on the way,
same View: the old "Status is not churned" reading also ticked "churned" as
Simple's answer — the opposite filter; an op's picks are no longer Simple's.
`T-both-answers-are-kept`

### `[x]` ✅ 83 — BUG: a calendar menu's picked date leaves Apply and Discard looking off

Will, 2026-09-27: selecting a date does not remove the inactive styling from
the calendar menu's Apply and Discard — yet they are still clickable and they
work. TWO faults:

- **From step 6e (23094c86).** `sherpa-menu` re-reads its draft for the footer
  on `input` and `change` only; a calendar pick fires `datetime-change` and
  `range-select`, so the footer is never told the draft changed and keeps its
  pair `disabled`. Listen for those too (`T-the-footer-owns-nothing-to-save`).
- **A disabled button still acts.** A `sherpa-button` with `disabled` looks
  inactive but a click still reaches its handler — the look and the behaviour
  disagree. The button must refuse the click while disabled, or the footer's
  "off" is only paint.

**✅ Done 2026-09-29:** the menu re-reads its draft on `datetime-change` and
`range-select` too, so a picked day turns Apply and Discard on. A disabled
`sherpa-button` refuses the click on its host — no listener, no ancestor —
as a native button does (`T-a-disabled-button-acts-on-nothing`). That showed
two more gaps, now closed: a draft set from code (`values`, `conditions`,
`mode`, typed text) did not tell the footer, and a switch between Simple and
Advanced was not a change to the draft. Eight tests pressed Apply on a menu
they never opened; they open it first, as a reader must.

### `[x]` ✅ 112 — BUG: an Equals row in Advanced will not open its value list

Will, 2026-09-29: *"Equals conditions in advanced filters don't allow a
selection from value. Dropdown doesn't show a menu on click."*

The row's value field is a `sherpa-input-text data-type="select"` filled by
`populate()` (`#fillRow`, `T-equals-answers-with-the-fields-own-values`).

**Probed 2026-09-29 on the Records page, with a real mouse click:** the select
is visible, on top at its centre, enabled, with 9 options. It OPENS (`:open`)
in the bar's Owner menu (Chromium) and in the panel's Owner field (Chromium and
WebKit); the menu stays open and the select keeps focus. Firefox reports
`:open` false — maybe only how Firefox reports it. **❓ Waits on Will:** which
surface (bar, panel or grid heading), which browser, and the steps.

**DEFERRED — Will, 2026-10-13.** Not in the churn until he brings it back.

**Back, Will 2026-10-14:** *"This bug applies to any advanced filter's
condition input that has a dropdown (select) for an 'equals' condition. The
list isn't populated or shown when interacting with the dropdown. As part of
fixing this we should check that all input row permutations are working
correctly for advanced filters."*

**✅ Done 2026-10-14.** Reproduced on Records: **Name** answers by conditions
only (`advanced: 'only'`), so its values are never listed — its Equals select
was EMPTY, not even "Select…", and WebKit would not open it. Owner and Email
opened on the bar, the panel and a grid heading in Chromium and WebKit
(Firefox reports no select as open, so it cannot be read). Now a row with NO
list to pick from types its Equals and Not equals, as a number does, and
answers as the one value it picks; rows, and the host's mirror, ask again
when the values come or go.

**Every permutation checked** (`reforged-advanced-rows.spec.ts`, three
engines): 30 single rows — a list, a list with none, a number, a date, a date
with time, each condition each offers — show the inputs that condition takes,
and answer the clause it says; two rows join by Or and by And, and the cross
takes one away. One more was wrong and is fixed: on a field with TIMES a
minute was exact, so "On 3 Sep at 14:00" missed 14:00:23 — now a minute is
all of that minute, as a day is all of that day, and Between reaches the end
of its last day or minute. Demos checks Owner and Name on all three surfaces.
`T-one-number-is-a-pick-under-equals` · `T-a-relative-date-stays-relative`.

### `[x]` ✅ 114 — BUG: about 1 time in 20, a folded Advanced-only filter's row opens nothing

Found 2026-09-29 while checking a flaky test: "a FOLDED advanced-only filter
opens its own menu, not a blank drill" (`reforged-quick-filter-toolbar.spec.ts`)
fails about 1 run in 15–20, on the code before 102 as well as after. Its fixed
120 ms wait is now a poll for the menu's `open` — and in a failing run the
chip's own menu is still shut after 60 frames. So it is not slow; it never
opens.

Pressing the row opens the chip's own menu while the Filters menu closes. Two
`auto` popovers in one moment, so a guess: the Filters menu's light-dismiss or
`hidePopover()` lands after the chip's menu opened and closes it too. Check
the order in `#onMenuSelect` / the drill path, and try the same with a real
pointer.

**✅ Done 2026-09-29:** not the drill. EVERY re-fold of the bar shut the
Filters menu and built a new one, even when it folded the same chips — so a
late re-fold threw away a menu opened just before it, and the test's row
named nothing. WebKit runs the bar's last settling re-fold a frame later, so
there it failed EVERY time (60 of 60); Chromium only under load. A re-fold
that moves nothing now leaves the open menus alone. WebKit 30/30, a new test
(fails on the old bar), Chromium 856/856.
`T-a-reflow-that-moves-nothing-keeps-its-menus`

### `[x]` ✅ 108 — A Filters menu row's scope is a DESCRIPTION under its label, with no "in"

Will, 2026-09-29: *"In filter menu items we have the scope of the filter on the
right side. This should be the description label on the row below the menu
item's main label. We can also remove the 'in' prefix from this label."*

Today the source writes ``note: `in ${scopeLabel}` `` (`data-source.ts`,
`addable`), and the menu draws `data-note` at the row's right. Make it the
row's description line — the same second line a menu row with a description
already has, if one exists; check the Figma Menu set first — and drop "in".

**✅ Done 2026-09-29:** Figma's Menu List Item has it: a `description` line,
12/16, 2px under the 14/20 label. A noted row is a two-row grid now, and its
`::after` note is the second row, in the label's column. The source writes
the scope's name alone. The colour stays Style `content-secondary` — the same
`rgb(53, 53, 61)` as Figma's Theme `content/body/+1`, with no new Theme read.

### `[x]` ✅ 106 — BUG: a click between a menu's items reaches what is behind it

Will, 2026-09-29: *"Clicking the space between menu items causes the
accordion behind the menu to expand or collapse. The menu needs to block this
from happening. I suspect it could allow clicking of any element behind a menu
and not just accordions."*

Likely cause, not yet proved: a click BUBBLES through the DOM, not through
what is drawn. A popover menu is drawn in the top layer, but in the DOM it is
still inside the accordion's header, so a click on the card's empty space
reaches the header. A row click is handled; a gap click is not. Check every
host that holds a menu, not only the accordion.

**✅ Done 2026-09-29:** the cause was as guessed. The fix is in the MENU, so
it holds for every host: a click in a popover menu that lands on no control
is the menu's own — `preventDefault()` so no `<summary>` or link acts,
`stopPropagation()` so no listener behind hears it. A row is a native
control, so it still does its job. Test (real pointer, three browsers):
padding and gap clicks toggle nothing and reach no host; a row still ticks.
`T-a-gap-click-is-the-menus-own`

### `[x]` ✅ 94 — A number (and range) filter menu needs Apply and Cancel buttons

Will, 2026-09-27: *"Numerical (and range) filter menus need apply/cancel
buttons."* A number is TYPED, so applying each keystroke filters on "1" on
the way to "150". Locally a PICK applies at once (Will's ruling on 62, "No
Apply locally"); a number body is the exception — it waits for Apply, and
Cancel puts back what was applied. The calendar's footer is the pattern, and
83 is its bug, so fix the two together.

Will, 2026-09-29, after 104: *"Regarding the slider changes, and perhaps any
filter selection/value changes, we might want to debounce the event to
update."* Today a number applies on `change` — a handle let go, Enter, or
leaving the field — so one act is one update, and there is nothing to debounce.
A LIVE drag (on `input`) would need one. **Will chose once per act**, with live
as a configurable option for later — that is 107.

**✅ Done 2026-09-29:** every number menu waits for Apply — single or range,
local or remote — and Cancel puts back what was applied (`menuFor()`:
`data-commit` + `data-commit-fixed`, so the Range switch cannot turn it off; a
definition that names `commit` still wins). Built on 83's footer fix. On the
Records page: typing 172 leaves 100 rows until Apply, then 1.
`T-a-number-waits-for-apply`

### `[x]` ✅ 16 — BUG: Favourite and Save apply to the Context, not the View

The ★ stars the Context (`examples/index.html` ~396, the `view-favorite`
listener), so it applies to every View in that Context. It must apply to the
one View.

**✅ Done 2026-09-29:** the ★ stars the View on screen — a favourite's key is
`context:view`, the first View's the Context alone — and re-syncs when another
View is picked; a View favourite reads `Records › At risk` in the rail and
opens that View. Favourites stored before keep meaning the first View. Save
is 15's. `T-a-favourite-is-a-view`

### `[x]` ✅ 54 — BUG: a one-value filter's row in the Filters menu: its tick means On

Will: a row in the Filters menu's Added section gets a child menu only when
its field has MULTIPLE values. A one-value filter (a preset, a toggle) has
nothing to drill into — today it drills into a menu of one row, `On`
(`onOffMenu()` in `src/core/ui/filters-button.ts`, `DRILL_FLAGS`,
`filtersMenuItems()`).

**Will's rule, 2026-09-26: a tick on a value means that value is ON — in
every filter.** A one-value filter's row IS its value, so its tick turns it
on; there is no caret. A filter that is OFF with its value on is the same as
an inactive chip holding a value — suspended, not cleared.

This changes what a tick means in the Added section, where it means HELD
today (untick removes). Settle, when it starts: how a one-value filter is
removed from this menu, and whether a multi-value row's tick keeps meaning
held. Update `T-the-add-menu-is-the-whole-list` and the test "a folded BOOLEAN
filter opens On".

**❓ Will, 2026-09-29 — pick one.** A menu row has no remove button today
(`sherpa-menu`'s item row is a tick and a label). If the tick means On, the
row needs another way to take the filter off.

- **A (my pick):** a one-value row — tick = On. It gets a small × at its end
  that removes it. A multi-value row keeps tick = held (untick removes), as
  its row is a FILTER, not a value. Least change; one new row part.
- **B:** every Added row — tick = On (a multi-value row is ticked while it
  holds a pick), and every row gets the ×. One meaning in the whole section;
  more change, and the multi-value tick no longer removes.

**✅ Will, 2026-10-12 — all my picks:** A — a small × on one-value rows only; a multi-value row keeps its tick as held.

**✅ Done 2026-10-12.** An on/off chip's row and a preset's row have no caret
now: the box is its on/off, and a removable one has a × (`menu-row-remove`).
`onOffMenu()` and the built "On" menus are deleted. Apply flips only a row the
reader changed, and a chip pressed elsewhere re-ticks the shut menu's row. A ×
rebuilds the menu, so it opens again. One change you may notice: the tick now
waits for the Filters menu's Apply, as every other row there does — the "On"
row applied at once. `T-the-add-menu-is-the-whole-list`

### `[x]` ✅ 95 — Firefox: a remote chip holding a draft is not marked pending

Found 2026-09-27 by the full Firefox run: `test/e2e/reforged-pending-chip.spec.ts:10`
fails in Firefox every time — after a tick in a remote chip's open menu, the
chip has no `data-pending`. Chromium and WebKit pass. Not the provider work:
the toolbar as committed before P3b fails the same way. Start at the menu's
`dirty` and the bar's `#queuePending` (TODO 46, `T-a-pending-chip-has-no-fill`).

**✅ Done 2026-09-29:** the menu took its baseline in `toggle`, which Firefox
fires AFTER the tick — so the tick became the baseline, and was no draft. The
baseline is taken in `show()` now. The test passes in all three browsers.
`T-the-baseline-is-taken-at-show`

### `[x]` ✅ 96 — A grid with few columns leaves an empty band on the right of its card

Seen 2026-09-27 in the Dashboard's Capacity planning View: five columns at the
default 160px make an 800px table in a 1350px card. The grid is a FIXED table
whose width is the sum of its `<col>`s (`inline-size: 0`,
`T-col-width-not-inline-size`), so a column never grows to fill. Decide what
fills the slack — the last column, or every column in proportion — without
breaking a dragged width or the pinned edges.

**❓ Will, 2026-09-29 — pick one.** Both keep the table at its columns' sum
when the card is narrower, so nothing changes where it already scrolls.

- **A (my pick):** every column the reader has NOT dragged grows in
  proportion to fill the card. A dragged column and the pinned edges keep
  their width. Reads as one table; a drag re-divides the rest, as most grids
  do.
- **B:** the last unpinned column takes all the slack. Simplest; the other
  columns never move, but one column can grow very wide.

**✅ Will, 2026-10-12 — all my picks:** A — every column the reader has not dragged grows in proportion; dragged and pinned ones keep their width.

**✅ Done 2026-10-12.** The grid writes the free columns' `<col>` widths to
share the slack — on render, when its scroll box resizes, and while a column is
dragged. Narrower than the sum, nothing grows and it scrolls. A filled column
can pass the 480px maximum, so a drag starting there shrinks it without a jump.
Two older tests now run in a box narrower than their columns.
`T-col-width-not-inline-size`

### `[x]` ✅ 100 — The Assistant panel shows no heading

Found by the API audit (86), 2026-09-29, and confirmed in the browser: the
Assistant `sherpa-overlay-panel` in `examples/index.html` sets
`data-title="Assistant"`, but the overlay panel reads only `data-heading`
(`sherpa-overlay-panel.ts`, its `observed` list). A CONTAINER takes
`data-heading` (CLAUDE.md, the tier rule). Rename the attribute in the page,
and check no other page sets `data-title` on a container that reads
`data-heading`.

**✅ Done 2026-09-29:** the page sets `data-heading="Assistant"`; no other
page or template sets `data-title`. An app test reads the heading, and fails
on the old attribute.

### `[x]` ✅ 119 — BUG: the panel header's Reset menu button wears the grouping `end` style

Will, 2026-09-30: *"The 'reset' filters menu, in the filter panel header, has
the grouping 'end' styling applied. It should have no grouping applied at
all."*

**✅ Done 2026-09-30.** The menu inherited its button's grouping, so its card
had square left corners. A menu now states its own edges, so no grouping
reaches it — in the panel, and in the toolbar's Reset and Save menus, which
had the same fault. `T-a-menu-takes-no-grouping`

### `[x]` ✅ 127 — BUG: a number input is native again — placeholder, alignment and steppers

Will, 2026-09-30: *"Numerical inputs should have a placeholder of 'Enter a
value'. Their input text should be right aligned. They should also be
sherpa-inputs that use the sherpa style up and down stepper buttons rather
than the native appearance. We've already fixed this before but seem to
reintroduce the mistake."*

It came back once, so the fix is not done until a test holds it: every number
input a filter draws is a `sherpa-input-text`, right-aligned, with the
placeholder and Sherpa's own steppers.

**✅ Done 2026-09-30.** `sherpa-input-text data-type="number"` is Figma's
`Input Number`: right-aligned, "Enter a value" when empty, and two composed
`sherpa-button`s (`chevron-up`, `chevron-down`, Transparent) in place of the
native spinner. A filter menu's number body uses it. A unit test now fails on
any component template with a bare `<input type="number">`, so it cannot come
back unseen. Two are left as they are, each with its reason in that test: the
slider's value box and the pagination's page box — say if you want those
changed too. One difference from Figma: the steppers sit flush to the right
edge, as slotted actions already do; Figma leaves 8px.
`T-a-number-input-wears-sherpas-steppers`

**More, Will 2026-09-30.** *"all numerical inputs should use Sherpa's style"*:
the slider's value boxes and the pagination's page box are the same field
now, and the gate allows no other. The slider's fields sit UNDER the track in
one row, half each, and never stack — also in a filter menu and a narrow
panel, where the steppers shrink so the digits show. A stepper with no value
to step to is inactive. Figma draws the pagination's page box with no
steppers; yours has them, as you said.

### `[x]` ✅ 130 — BUG: filter panel chips show no tooltip — the tip belongs to the CHIP

Will, 2026-09-30: *"Filter panel chips don't display tooltips. This
functionality should be on the filter chip component and not on the
filter-toolbar or filter-panel components. Also check for any other
functionality, or features, that should be at the chip level rather than the
parent toolbar or panel."*

Two parts. Move the tooltip into `sherpa-quick-filter`, so a chip shows it
wherever it is drawn. Then AUDIT the toolbar and the panel for everything else
a chip should own, and list it here before moving it.

Will, 2026-09-30, a tweak: *"Filter chip tooltips (which we are fixing in
another item already) should have " - X matches" appended. X is the result
count."*

Will, 2026-09-30, a bug: *"Numeric and Date filter chips don't show a
tooltip."*

**🚧 2026-09-30 — the tooltip is done; the audit's moves are not.** The tip
was the chip's already, but it read only a list menu. Now, on a bar, in the
panel and on a grid heading alike:

| Chip | Its tip |
|---|---|
| a list | `active, trial - 49 matches` |
| a number | `37 to 120 - 28 matches`, or `12 - 1 match` |
| a date | `05 Jan to 06 Feb 2024 - 10 matches` |
| conditions | `2 conditions applied - 5 matches` |
| a saved filter | `4 matches` |
| Sort, Group | `Name, descending` · `Plan` |
| a grid heading's sort button | `Sorted by Name, descending` |

The matches show while the chip is on and applied, as its badge does (123
will change both together). A chip that is OFF says nothing — it filters
nothing (147); one a scope above holds still says where its filter went. Three things moved INTO the chip to do this: a
date's label (it was the toolbar's, so a panel date chip showed no days), the
Group and Sort steer (`arrangeBy` — the panel had none, so its Group and Sort
never followed the toolbar or a grid heading), and the wording of a range.

**A panel VALUE chip** is one value of a run, and has no count of its own.
The field's header carries the field's count instead (133). A count per
value is not asked for.

**The audit — what else belongs on the chip.** Still written twice, in the
toolbar and in the panel, each asking "a list, a number or a date?":

| Job | Toolbar | Panel |
|---|---|---|
| READ a chip's answer | `#answers()` | `#readingOf()` |
| DRAW an answer into it | `setChipReading()` | `setFieldReading()` |
| EMPTY it | `#emptyChip()` | `#empty()` |
| is it ON | `#chipPicks()` + typed check | `data-current` per value chip |

Five of the seven holes in 137 were one of these done differently in two
places. The fix is one door on the chip — `reading` get and set, `clear()` —
which its menu already has. That is a refactor of both hosts; say when.
`T-a-chip-says-its-own-answer`

**✅ Done 2026-09-30 — the second half.** Will: *"130: Good. A."* The chip
has the one door: `reading` (read and draw), `clear()` and `answered`. The
toolbar's three kinds of draw, its two kinds of empty and its own
typed-answer check are gone; the panel's date chip uses the same door.
Nothing changes on screen, with one fix found on the way: packing or
unpacking a saved filter now empties a number or a date field too, as it
did a list. The panel's run of value chips has no one chip, so its field
still reads its inline menu's own `reading`.

### `[x]` ✅ 131 — BUG: switching a number filter to Range fires no update

Will, 2026-09-30: *"Switching a numerical filter to Range mode doesn't fire an
update event to start using the range parameters."*

Seen in the code: the switch reports `menu-range-change` only, never the
values, so nothing re-filters until an end is moved.

**✅ Done 2026-09-30.** The switch is reported as a value change is. In a
panel the rows follow at once; in a toolbar chip the draft is dirty, so Apply
takes it. `T-range-switch-swaps-not-rebuilds`

### `[x]` ✅ 132 — BUG: back from a changed Range, the Simple value is gone

Will, 2026-09-30: *"Switching a numerical filter back to Simple mode, from a
modified range, does not retain any original simple values that were input
before switching to Range."*

Seen in the code: when a range is written back to the menu, `#setBodyValues`
empties the single field. Both shapes must keep what they hold
(`T-range-switch-swaps-not-rebuilds`).

**✅ Done 2026-09-30.** The reading keeps both shapes: the one in force, and
the other as `kept`. It had to be in the data, not only in the menu — a
filter panel rebuilds a field's menu when its answer changes. Switch to Range
and back, and the value typed before is there and applies again; the ends are
kept the same way. Cancel puts the shape back too. `T-both-shapes-are-kept`

### `[x]` ✅ 137 — BUG: a number range's values differ between the panel and the toolbar

Will, 2026-09-30: *"Numeric range filter values don't match between the
filter-panel and filter-toolbar. I'm worried that we're not using a
centralised condition query etc. to coordinate filters and such. Look at this
first, and any other filter coordination items/issues, before moving on to
130."*

**✅ Done 2026-09-30.** There IS one owner: the Query, in the `DataSource`. A
toolbar, the header bar, the filter panel and a grid heading are views of it;
each reports what a reader did, and the source draws the answer back into
every one. The views had holes. Seven, all found by setting an answer in one
control and reading it in the others:

| # | What was wrong | Why |
|---|---|---|
| 1 | The panel opened on OLD answers, and its next change wrote them back over the Query. This is the bug reported: the toolbar said 37 to 120, the panel 4 to 240, and typing 60 in the panel made it 60 to 240 | a shut panel ignored every `drawReading`, and nothing refilled it on open — the page did once, and that went when the provider took the page over |
| 2 | A number chip drew VALUES only, so the shape in force and the kept shape were lost on the way to the toolbar | `setChipReading` cut a number reading down to its values |
| 3 | A rebuilt panel field dropped a number's answer | `#fill` kept only rows, a mode or a mirror |
| 4 | A chip switched OFF showed as ON in the panel | the source skipped a suspended answer when it drew |
| 5 | Reset did not empty a number chip: it switched it off and left the value, so the Query kept a suspended answer | Reset emptied list chips only |
| 6 | The panel's Reset and a field's Clear did not empty a number field | they cleared value chips and rows only |
| 7 | A date range set IN THE PANEL filtered nothing: the panel sent the chip's own id, `created`, as the day | a date is one chip, and a ticked chip's value is its id |

And one in the source: a panel report that switched a saved filter drew the
bars mid-way, from a copy of the scope, so a Reset's cleared fields came back
on the toolbar a moment later.

All are fixed, and `test/e2e/reforged-filter-coordination.spec.ts` holds
them: one Records page, forty steps — a list, OFF and ON, a number in both
shapes, conditions, a saved filter, a date range both ways, a grid heading,
Reset from each side — and after EACH step every control must hold what the
Query holds, the panel open or shut. A reload, a View change and remote mode
(drafts, pending, Apply) were probed the same way and agree.

**One choice is yours.** A chip switched OFF keeps its value. The panel has no
"off" for a run of value chips, so it shows that field as not answered; the
Query keeps the value for the chip. Say if the panel should show it another
way — for example the values drawn, dimmed.

`T-a-panel-follows-the-query-open-or-shut` · `T-a-suspended-answer-is-drawn-as-off`
· `T-empty-is-every-kind-of-answer` · `T-a-panel-date-answers-with-its-days`
· `T-a-bar-is-drawn-the-scope-as-it-ends`

**For 130 — what else belongs on the chip.** Seen while here: the toolbar and
the panel each have their own code to READ a field's answer, to DRAW one and
to EMPTY one, and each asks "is it a list, a number or a date?". Five of the
seven holes above were one of those three jobs done differently in two
places. The chip (with its menu) should answer all three itself — `reading`
get and set, and one `clear()` — so a host never asks what kind it is. Also
the toolbar's: the date label on a chip's face (`#syncDateLabel`).

### `[x]` ✅ 147 — BUG: a chip switched off under the pointer leaves an empty tooltip

Will, 2026-09-30: *"When I set a filter chip to inactive while it's tooltip
is visible then only the tooltip content is hidden. The whole tooltip should
be hidden."*

**✅ Done 2026-09-30.** `sherpa-tooltip` owns it: when its text goes while the
bubble shows, the bubble shuts; when the text changes, the bubble is placed
again for its new width. And every chip agrees now — OFF says nothing. A
number or a date chip kept its answer in the tip while off, where a list chip
did not. The tip comes back the next time the pointer enters the chip.

### `[x]` ✅ 148 — BUG: after a Reset, a date chip's value label reads `Unassigned`

Will, 2026-09-30, a minor bug for later: *"When filters are reset, a date
chip shows 'Unassigned' in it's value label. Not needed."*

**✅ Done 2026-09-30.** The word on the chip was `undefined`, not Unassigned:
the header bar's Reset emptied the Date chip's RANGE calendar, and the menu
wrote "no first day" into it as a day. A kept range with no ends holds none
now. It came in with 137 (an emptied date keeps its range shape). If you did
see the word `Unassigned` on a date chip, say where — I could not make it.

### `[x]` ✅ 158 — BUG: a data viz filter cannot be moved back down from the View

Will, 2026-09-30: *"I can't move data viz filters back down from the view
scope."*

**✅ Done 2026-09-30.** On Records a chart's field is the grid's field too
(Status, Plan), so TWO scopes may take it. I had offered the ↓ button only
where there was ONE scope, or where the source remembered which scope the
field came up from — and it forgets that on a reload. So after a reload
there was no button.

The ↓ button now always shows where a scope below has the field. One scope:
it sends there, and says where. More than one: it opens a menu — "Send to
Customer records", "Send to By status" — and you pick. The scope the field
came up from is first.
`T-send-to-view-filters`

### `[x]` ✅ 157 — BUG: tooltips are clipped by other elements

Will, 2026-09-30: *"Tooltip are getting clipped by other elements. Tooltips
should be at the top level in CSS so that they sit above everything else."*

**✅ Done 2026-09-30.** Every button tip and every chart tip is a `popover`
now, lifted to the browser's TOP LAYER while it shows. Nothing is above the
top layer, so no card or panel can cut it. I saw the bug on the panel's new
buttons: "Send Region to Customer records" was cut at the panel's edge.

CSS still shows and places the tip; one small listener on the page lifts it.
A filter chip's tooltip was in the top layer already. One thing left as it
was: `sherpa-tooltip` with no `data-floating` still draws in the page —
nothing in the library or the examples uses it that way.
`T-a-tip-lives-in-the-top-layer`

### `[x]` ✅ 155 — BUG: the change-scope buttons show only after the first edit

Will, 2026-09-30, a minor issue: *"Change scope buttons only appear on
filters after the first edit. This action should always be available."*

**✅ Done 2026-09-30.** Send to (↑ or ↓) shows on a field from the start.
Clear still comes once there is something to clear, and joins it as one
group. Before that, Send to stands alone with all its corners. I had tied
the pair to the answer in 121; only Clear belongs to it.

### `[x]` ✅ 168 — BUG: a filter moved A → View → B shows in A again

Will, 2026-09-30: *"If I send a filter from component scope A to View scope
then back to component scope B then the filter shows again in component scope
A. A filter should only ever be in 1 scope at any time."*

**✅ Done 2026-09-30, for a grid's scope.** When a filter went up from scope
A, A kept its place for it ("Filter moved to View scope"). Sent down to B, the
View let go — and A's kept place came back to life beside B's. Now, as a
filter lands in B, every other scope below lets go of it first. It is in B
alone: in the Query, in the panel, and on A's own bar. A reader can add it to
A again from A's Filters menu.

❓ **One case is not the same: a CHART.** A chart's section is only its
legend's filter. Send that filter up, then down to the grid, and the chart's
section shows its legend's chips again — not answered.

- **A (as built, my pick):** leave it. That is the chart's OWN filter, a
  different one from the filter that moved; it is there on a new page too,
  beside the grid's.
- **B:** the chart's section says "Filter moved to Customer records scope"
  until the filter is sent back to the chart.
`T-send-to-view-filters`

### `[x]` ✅ 169 — BUG: "Reset to default" and a View pick take the saved filter chips off the bar

Found 2026-09-30, with 167. On Records the grid's bar shows three saved
filters at rest. After "Reset to default", or after any View is picked, they
are gone — unless the View names one as ON. A View keeps the FIELD chips a
scope holds; it does not keep its saved filters.

**✅ Done 2026-09-30.** A View pick keeps a scope's saved filter chips: each
stays on its bar, off, unless the View turns it on. So "At risk" (the View)
now shows `At risk` on, with `Has open tickets` and `Unassigned` beside it,
off — before, it showed `At risk` alone.
`T-a-view-keeps-the-saved-filter-chips`

### `[x]` ✅ 167 — BUG: a Reset in a component scope clears a chip's "moved to the View" state

Will, 2026-09-30: *"Resetting filters in a component scope clears the
elevated to view scope state, and inactive styling, from filter chips."*

**✅ Done 2026-09-30.** A bar's Reset emptied EVERY chip, the ones the View
holds too. Such a chip lost the value it showed and went to "off", while the
View went on filtering. A chip the View holds is not that bar's to reset: it
is left as it is — its look, its value, the picks it keeps. What I saw was the
value going; the grey look stayed in my runs. If the look still goes for you,
say which button you pressed.

**Found on the way, 169:** "Reset to default" and a View pick take the saved
filter chips (Has open tickets, At risk, Unassigned) off the bar.

### `[x]` ✅ 166 — A saved filter shows its count only while it is on

Will, 2026-09-30, a minor fix: *"Preset filters always show their badge with
count. We won't always know this number before activating the filter so we
should only show it when active."*

This takes back the "A for now" of 123: a saved filter that is OFF shows no
number. A field chip that is off still keeps its badge.

**✅ Done 2026-09-30.** The source counts a saved filter only while it is on.
At rest the Records bar reads `Has open tickets`, `At risk`, `Unassigned`,
with no number.

### `[x]` ✅ 165 — BUG: a filtered grid's group badge counts rows that are not shown

Will, 2026-09-30, a minor one: *"The badge count on a filtered data grids
group rows should show the number of actual rows shown. Right now it show the
total row count for the group regardless of visibility."*

**✅ Done 2026-09-30.** Two causes, both fixed. With a chart bound beside the
grid, the source counted the groups from the View's rows, so a filter on the
grid's own bar did not reach the badge. And the grid's filter row hides rows
the source does not know of: while that row holds a filter, the grid counts
the rows it shows.

### `[x]` ✅ 160 — BUG: ungrouped, a page still holds fewer rows than the pager says

Will, 2026-09-30, on 152: *"All customers. Row count was set to 25. Not all
data grid pages had 25 rows."*

**✅ Done 2026-09-30.** The store cut the page of 25 first, and THEN dropped
any row its rules refuse. So each bad row left its page one short.

I could not see it because my browser's data is new, and all of it is good.
Yours has lived: it holds rows that an older build saved and today's rules
refuse — a customer with no organisation, from before that was required. The
store now checks every row first and cuts the page after. Each page holds 25
of the good rows, and the page count does not move as you page.

Those old rows are still in your browser's database, and still not shown.
`source.result.dropped` says how many. To get a clean set, clear the site's
data for `localhost:4200` — or say, and I will make the page report them.
`T-a-refused-row-never-shortens-a-page`

### `[x]` ✅ 152 — BUG: data grid pages do not keep to the pagination's row count

Will, 2026-09-30: *"Data grid pages don't respect the row count value set in
the pagination. When i change pages I see varying row counts."*

**✅ Done 2026-09-30.** I could make this happen only with the rows GROUPED.
Ungrouped, every page held the pager's count in each case I tried: sizes 10,
25 and 50, sorted, filtered, through the pager's own controls.

Grouped, a page was 25 screen LINES, and each group heading was a line. So
the pages held 24, 24, 23, 23 and 6 rows — and there were five pages, where
the same rows ungrouped make four. That was the rule of 2026-09-17 ("visual
paging"); your report changes it:

- **A page is 25 ROWS, grouped or not.** An open group's heading costs
  nothing. Records grouped by Plan: 25, 25, 25, 25, on four pages.
- **A SHUT group is still one slot**, whatever it holds — so shutting a group
  still pulls the next rows up.

❓ If you saw it with NO grouping, say which page and size: that is a second
bug, and I could not make it.

**Will, 2026-09-30:** *"All customers. Row count was set to 25. Not all data
grid pages had 25 rows."* So it WAS a second bug, with no grouping — it is
160.
`T-grid-collapsed-group-is-one-slot`

### `[x]` ✅ 153 — BUG: the grid and its container change height with the row count

Will, 2026-09-30: *"The data grid, and it's container, in a fixed row count
layout grid also changes height to fit the row count. This isn't desirable.
The container should stay the same height and the grid should fill the
available height."*

**✅ Done 2026-09-30. My mistake, in 142.** When I moved the scroller to the
Context's frame I dropped the rule that makes the Context FILL that frame.
So the Context was as tall as its content, and the "fit" grid fitted the
content: the Records card was 586 px with ten rows and 632 px with fifty, and
the pager moved with it. The rule is back. The card keeps one height at ten
rows, fifty rows and a short last page; the grid fills it; the pager stays at
its foot. No test had caught it, because every test page was taller than its
frame — two do now.
`T-a-fit-grid-needs-a-sized-parent`

### `[x]` ✅ 151 — BUG: a filter moved across scopes does not keep its mode

Will, 2026-09-30, a minor bug to queue: *"Moving a filter across scopes
doesn't retain the simple/advanced mode state."*

**✅ Done 2026-09-30. Two causes, both fixed.**

- **Sent DOWN, the mode went back.** As the View let go of the field, the
  toolbar below was freed and reported the answer IT had kept from before the
  field went up. That old answer replaced the one that came down. The View's
  answer now wins, whole — its mode and its rows.
- **After any move, f(x) did not hold.** A move redraws the field. A field
  drawn Simple has no menu; its first f(x) press builds one. That menu then
  took the answer as it was DRAWN, a tick later — Simple — and undid the
  press. The button read on, the Query read Simple. A menu built at a press
  now takes the answer as it stands.

The test uses a reader's own presses: tick, Advanced, "is not", Simple, send
up, Advanced, send down.
`T-a-late-built-menu-takes-the-answer-as-it-stands` · `T-send-to-view-filters`

### `[x]` ✅ 142 — The shell's panel areas stay put while the page scrolls

Will, 2026-09-30: *"The filter panel area, in the app shell, shouldn't scroll
with the other page content. So it needs to be outside of that scrollable
wrapper element so that it stays fixed on the left. This will be the same
requirement for the right panel area (that we don't leverage yet). Should be a
simple fix so we can bump it up near the top of the queue. :)"*

**✅ Done 2026-09-30.** Only the Context scrolls now. The header and both
panel areas stay put, and a panel taller than its area scrolls inside itself.
CSS only: the markup is the same, the scroller moved from `.content` to
`.context-frame`. The header still takes its shadow while something is
scrolled under it, from the scroller's timeline — in Chromium and WebKit;
Firefox draws none. `T-only-the-context-scrolls`

### `[x]` ✅ 201 — BUG: in Chromium on Linux the nav rail opens to hover by itself

Found 2026-10-02, on the first run on Will's Linux machine. These fail in
Chromium on every run, and all pass in Firefox:

- `reforged-nav.spec.ts:125` — the rail starts collapsed (state reads `hover`)
- `reforged-nav.spec.ts:912` — the collapsed rail is the density's `size/3xl`
- `reforged-app-shell.spec.ts:257` ×3 — the closed rail is 36 / 40 / 48 (reads 320)
- `reforged-layout-grid.spec.ts:616` failed once too, then passed on a re-run

The nav opens on `pointerenter` or `focusin` (`#onEnter` in `sherpa-nav.ts`),
and no test moves the mouse. Best guess, NOT measured: Chromium keeps its
pointer at (0, 0), and a rail drawn under it gets a `pointerenter`. On the Mac,
`:125` was "the known nav flake" (2026-09-21) — likely the same cause, seen
less often.

First step: log which event opens the rail. If it is the pointer, the fix is in
the tests (move the mouse off the rail first), not in the nav.

**✅ Done 2026-10-02:** it is the pointer. A probe logged a trusted
`pointerenter` at (0, 0) on a new rail, with no test touching the mouse. The
nav is right; the tests were not. `gotoHarness()` now parks the pointer at
(-1, -1). The layout-grid test was the same bug through the shell, which copies
its rail's `hover` over a `pinned` set by the test: 31 failures in 40 under
load before, 40 of 40 after, once that spec used `gotoHarness()`. 58 specs
still load the page with their own `page.goto` and do not get the park.
`T-chromium-pointer-starts-on-the-page`

### `[x]` ✅ 202 — BUG: 7 Sherpa Demos tests time out in Chromium under an open rail

Found 2026-10-02, first Demos run on Linux (`PORT=4300 npm test`): 384 passed,
7 failed, all Chromium, all a click into the left filter panel. Each says
`<sherpa-nav … data-nav-state="hover"> … intercepts pointer events` — the same
cause as 201. The rail opens under a pointer at (0, 0) and covers the panel,
and Playwright never moves the pointer while it waits for the target.

Measured in `reforged-panel-apply.spec.ts`, 4 tests × 5 runs: 10 of 20 failed
as is, 20 of 20 passed with `await page.mouse.move(-1, -1)` after the
`page.goto`.

Demos has no shared harness: 40 specs call `page.goto` themselves (~75 calls).

**❓ Will:** (A) add `test/e2e/fixture.ts` to Demos, whose `page` parks the
pointer after every `goto`, and change the import line in all 40 specs — it
covers every test, now and later; or (B) park the pointer only in the 4
failing specs — fewer files, but the next test that clicks near the rail
fails the same way. A is a 40-file change, so it waits for your yes.

**✅ Will, 2026-10-12: A — built** (Demos `c3997b1`). `test/e2e/fixture.ts`
gives every test a `page` whose `goto` parks the pointer at (-1, -1);
`parkThePointer()` does the same for a page a spec opens itself (two specs
do). All 40 specs import `test` from `./fixture`, and
`test/unit/e2e-fixture.test.mjs` fails a spec that does not. Full run on the
Mac: 390 passed, 1 WebKit flake that HEAD has too (204).
`T-chromium-pointer-starts-on-the-page`

---

### `[x]` ✅ 203 — sherpa-ui: 135 of 136 specs load the page without the pointer park

Found 2026-10-12, with 202. Only `reforged-layout-grid.spec.ts` uses
`gotoHarness()`; the other 135 call `page.goto` themselves, so a spec that
draws something hover-aware at (0, 0) can fail as 201 and 202 did.

**❓ Will:** (A) the Demos fix here too — a `test/e2e/fixture.ts` whose `page`
parks the pointer after every `goto`, and the import line changed in all 135
specs, with a node test that keeps it so; or (B) leave it — only the specs
that draw the nav or the shell at (0, 0) have failed so far. My pick: A, for
the reason you gave for 202. It is a 135-file change, so it waits for your yes.

---

**✅ Will, 2026-10-12 — all my picks:** A — one fixture in sherpa-ui whose `page` parks the pointer after every `goto`, the import line in every spec, and a node test that keeps it so.

**✅ Done 2026-10-12.** `test/e2e/fixture.ts`, as in Demos; `harness.ts` builds
on it, so its 87 specs park on every `goto` too; the other 58 import from it;
`test/unit/e2e-fixture.test.mjs` keeps every spec on one of the two.

### `[x]` ✅ 204 — BUG: WebKit — a `page.reload` in the nav favourites spec never fires `load`

Found 2026-10-12, with 202. In Sherpa Demos,
`reforged-nav-favorites-recents.spec.ts` reloads the page in its
`beforeEach` and in two tests. In WebKit, about 1 run in 80 times out in
`page.reload` "waiting for navigation until load", though the snapshot shows
the page drawn. Measured on HEAD without 202 too: 1 failure in 80 both ways,
so it is not the fixture. The retry hides it.

Seen again 2026-10-12 in `reforged-nav-pin-persist.spec.ts`'s `beforeEach`
— the same `page.reload` in WebKit, passing on its retry.

First step: log which request is still open when it hangs — a live feed or a
fetch that never ends would hold `load` back. If one is, the test can wait for
`domcontentloaded` and the app's own ready signal instead.

**✅ Done 2026-10-12** (Demos `fddb4dc`). Not Sherpa and not the server: a
logged server answered every request, and the hung reload's document never
loaded. WebKit stalls a reload sent while fetches are still open — every hang
was a reload as the page booted — and the open `/live/files` stream made it
about three times as likely. Demos' fixture now waits for quiet before a
reload and gives test pages no stream; two `beforeEach` hooks no longer reload
at all, as a test's context starts with empty storage. Measured in WebKit over
1520 boot-time reloads: about 9 hangs before, 1 after. The one retry covers
that last one. sherpa-ui's own fixture is unchanged: its pages saw no hang.

---

### `[x]` ✅ 206 — BUG: Firefox — a dialog's close event is sometimes not seen

Found 2026-10-12, with 113. `reforged-dialog.spec.ts:52` ("closing the dialog
fires a composed close event") counts 0 events in Firefox, 2 runs in 10 —
and 1 in 10 on HEAD before 113, so it is not 113. It calls `show()` and
`close()` at once, then waits for `__settled()`. The native close event comes
on a task; in Firefox it may come after `__settled()` resolves, or it may be
the late close that `T-a-reopened-dialog-hears-a-late-close` drops.

**✅ Fixed by 225's follow-up, 2026-10-12.** It was the first: the native close
is a TASK, and `settled()` waited for frames and microtasks only. It waits one
task now — 30 of 30 in Firefox, and no failure in the full runs since.

---

### `[x]` ✅ 228 — BUG: every item in the donut chart's legend can be switched off

Will, 2026-10-12: *"The donut chart allows all legend items to be toggled
off. There should always be at least 1 active legend item. Perhaps it isn't
taking into account items set to inactive by filter limiting?"* A legend
toggle is a FILTER (`T-legend-toggle-is-a-filter`), so the last item on must
refuse to go off — and an item greyed by "Limit to matching filters" (180) is
already off for this count.

**✅ Done 2026-10-12 — your guess was right.** The floor counted a greyed,
ruled-out row as on, though it draws nothing and cannot be pressed. It counts
only rows that DRAW now — not ruled out, not emptied to 0 by a filter — and
holds nothing when none does. A host's write keeps the old floor (only every
row off is refused): a chip over the same field may pick a value no row has
now. `T-a-legend-keeps-one-row-on`

### `[x]` ✅ 229 — BUG: the legend's switched-off items are lost on a refresh

Will, 2026-10-12: *"They don't retain state on page refresh."* A legend's
toggles are a filter, so they belong in the kept Query or the View's draft,
as every other filter does (`T-a-view-keeps-a-draft`).

**✅ Done 2026-10-12.** The kept Query DID hold the pick — the legend lost it.
On a reload the provider draws `picked` before the legend has rows, and the
rows come in parts, so the pick was read against the first rows as "all on".
The legend keeps a host's pick as data and redraws its off-set as rows arrive;
a click or an `off` write replaces it. A Demos test switches a row off,
reloads, and finds it off. `T-a-value-before-the-first-render-is-held`

### `[x]` ✅ 231 — "Reset all to default" and "Reset" are inactive at the default

Will, 2026-10-12: *"Reset all to default shouldn't be an active item if the
filters are already at the view default. Same goes for Reset, too,
actually."* The provider knows the View's own answer (`resetView()` puts it
back), so it can say whether anything differs; the menu items and the Reset
buttons follow it — in the panel and in the bar.

**✅ Done 2026-10-12.** The source answers both, and asking applies nothing:
`atDefault(initial, view)` compares what filters now (compiled, so the same
filter reads the same), which filters each scope holds — Will, the same day:
a filter taken off, or moved to another scope, is a change too — and the
arrangement the View names with what a Reset to default gives; `answered(scope?)` says whether anything is left to clear. After
every load the provider sets `data-at-default` and `data-nothing-to-reset` on
each bar and panel; their Reset buttons, the menu trigger and the ⋮ rows go
inactive. The Query builder lost a side effect on the way: it no longer
arranges the rows itself. `T-reset-to-default-is-the-views-own`

### `[x]` ✅ 232 — BUG: the delete customer dialog is critical all over

Will, 2026-10-12: *"The delete customer dialog has critical styling applied
to it's borders and text labels but the only item that needs to have critical
status styling is the footer's apply button."* Likely a `data-status` on the
dialog that the status cascade carries to everything inside
(`[data-status]` pins at any depth); it belongs on the one button.

**✅ Done 2026-10-12** (Demos). It was: `data-status="critical"` on the dialog.
It is on the Delete button now, and the generic confirm (deleting a saved
View) puts it on its action. Two tests that read the dialog's status read the
button's; a new one checks the dialog's text takes none.

### `[x]` ✅ 233 — Filter section headers inside accordions align to the top

Will, 2026-10-12: *"Align accordion header labels & any count badges to the
top of the header row container."* — *"Accordion button, too."* — *"I meant
filter sections within accordions. Align their headers to top."* The filter
panel's field sections, inside each scope's accordion: the label, any count
badge and the accordion's button sit at the top of the header row.

**✅ Done 2026-10-12.** The field header row, its label and count, and its
buttons align to the top (they shared the bottom line, Will 2026-09-26). A
test measures each against the row's top; it failed on the old CSS.

### `[x]` ✅ 239 — A chip with a typed Advanced answer in its def reads as Simple

Found 2026-10-13 while testing 90: `reforged-one-condition-system.spec.ts`
("a TYPED condition in list mode is Advanced") fails, every run, in Chromium.
Measured by building old commits in a worktree: it passed on 2 October and
first fails at `39dd3612` (199). It passes on a DEV build, where the files are
fetched, and fails on a build with the templates in the JS, minified or not.
So the chip now reads its menu BEFORE the menu holds its answer, and nothing
asks it again: its menu reads Advanced (`contains Da`), the chip has no
`data-condition`.

**✅ Fixed 2026-10-13.** With the templates in the JS the menu draws, and
says `menu-items`, before the chip listens; and when the chip connects, the
menu's condition rows have not filled yet (a composed field fills a frame
later). The chip now asks again once its menu has drawn and a frame has
passed — the empty check's own pattern — and `menu-items` redraws a typed
answer as well as a ticked one. `T-a-rebuilt-row-reads-empty-for-a-tick`

**Worth a full run.** This one hid because no focused run had this spec in
it; other specs may have failed since 199 the same way.

### `[x]` ✅ 238 — "Select all rows" in the data grid misses rows on other pages

Will, 2026-10-13: *"Bug: 'Select all rows' in the data grid component doesn't
select all rows, on all pages, as expected."*

**✅ Done 2026-10-13:** a grid its source pages holds one page, so "Select all
rows" ticked that page alone. It now ASKS: `select-all-request`, with an
`answer(rows)` callback. The binder answers with `source.allRows(el)` — every
row under that grid's filter, unpaged — and the grid ticks their keys, on
other pages too. Unbound, it ticks what it holds, as before.
`T-select-all-is-the-visible-rows`

### `[x]` ✅ 237 — A tile's own filter on a View-held field is lost, silently

Found building the starter (222), 2026-10-13. A metric with
`data-where='{"status":{"eq":"active"}}'`, on a page whose View scope holds
`status`, counted every row: its own filter narrowed nothing, and nothing was
reported. On a field no bar holds it narrows as it should (the Demos Critical
tile). A field lives in ONE scope, so the View's chip likely supersedes the
tile's own scope — but a tile's own filter is not a chip. Find which, then
make it narrow, or report.

**✅ Done 2026-10-13.** It was the View's answer winning: `compile()` set aside
the tile's own scope's reading of the View-held field. A component's own scope
is now `fixed` — compile never sets one aside, and the View's own answer
narrows the tile under it. `declareDefault` marks the scope before its first
write compiles. The starter's Active tile is the case, in three engines.
`T-a-component-default-outlives-a-view`

### `[x]` ✅ 236 — Read-only Advanced condition rows: value text too dark, a × not needed

Will, 2026-10-13: *"Read only advanced filter conditional input rows have
some issues: The value text is too dark. The delete button is shown but this
is not required."* This turns 186 choice 4 to B for the row ×: it goes when a
row is read-only — in the grid's held heading too.

**✅ Part 1 done 2026-10-13 — the "delete" buttons.** A read-only row shows no
row ×, and its fields are `readonly`, so the value's own clear button (⌫) goes
too — that was the one on screen in a one-row card. The value takes the row's
rounded end. The saved filter card and the grid's held heading both.

**❓ Will — part 2, the value text.** Today the operator and the value both
draw in near-black `#0C0B11`, the ink of an editable field. The ramp has no
step between `#35353D` and the placeholder grey `#B3B3C3`.
- **A:** the whole read-only row — operator and value — takes `#35353D`, the
  ink a disabled field uses. A small lift; it passes contrast (about 12:1).
- **B:** the placeholder grey `#B3B3C3`. Clearly lighter, but about 2:1 — below
  the 4.5:1 that WCAG AA asks of text a reader must read.
My pick: A. Figma was not connected, so I could not read a read-only input there.

**✅ Will, 2026-10-13:** A — a lighter grey, an existing text colour token.
**✅ Done 2026-10-13:** a read-only row's operator, join and value take
`--sherpa-style-content-secondary` (`#35353D`), through each field's
`::part(control)` — the Style name Figma binds, never Theme.

### `[x]` ✅ 235 — "Return to X" survives a reload

Will, 2026-10-12 (A): the scope a View field came up from is kept with the
Query, so "Return to X" leads after a reload too. Today the source knows it for
the session only (`#cameFrom`, `T-send-to-view-filters`).

**✅ Done 2026-10-12.** The View scope of the Query carries `from` — each held
field's origin — so the kept Query and a draft hold it; a send back down
forgets it. A node test restores a kept Query in a fresh source and finds the
return; the Demos test reads "Return to By status" after its reload.

### `[x]` ✅ 234 — A filter moved up to the View offers "Return to X" first

Will, 2026-10-12: *"If a filter is moved up to the view scope then the first
menu option should be 'Return to X' to differentiate it from other available
component scopes that weren't the original scope before being elevated to the
view scope."* The send-down menu (TODO 120, `T-send-to-view-filters`) lists
the component scopes; the one the filter came from leads, worded "Return to
<its scope>", and the others follow.

**✅ Done 2026-10-12.** The source already listed the scope a field came up
from first; it now marks it `origin`, and the panel words it "Return to X"
(and the single button "Return Status to X"). The source knows it for the
session only, by design (`T-send-to-view-filters`): after a reload both rows
read "Send to". Say if it should outlive a reload — the Query would carry it.

### `[x]` ✅ 230 — The Reset all filters dialog: its switch is plain form content

Will, 2026-10-12: *"The 'Save filters before reset' in the Reset All Filters
dialog is contained within a grey border. The switch, label, and description
should just be form content in the content area of the dialog. No need to
encapsulate them in any custom way."*

The border is the `sherpa-list` around one `sherpa-list-item` (Sherpa Demos
`app/index.html`, `#reset-confirm`). `sherpa-switch` has no label of its own,
and the app has no stylesheet — so plain form content needs one of:

**❓ Will:** A `sherpa-switch` takes `data-label` and `data-description`, drawn
as `sherpa-select-checkbox` draws its own — any form or dialog, in any
framework, needs no CSS; it wants a matching Figma variant. B in this dialog
only, a native `<label>` holding the text and the switch, laid out by a few
inline styles. My pick: A.

---

**✅ Will, 2026-10-12 — all my picks:** A — `sherpa-switch` takes `data-label` and `data-description`, drawn as `sherpa-select-checkbox` draws its own.

**✅ Done 2026-10-12.** One `<label>` holds the track and the words, so a click
on them toggles it; no words, no text column. The words take Theme ink, as the
checkbox's: ON pins the host's Style mode to saturated/success. The Demos
dialog drops its `sherpa-list` for the plain switch.

## C2 — Consumers: frameworks, apps and agents

Planned 2026-10-12 from three read-only reviews: 183's problems re-checked
against the code, and a new one for other frameworks. Findings and file:line
evidence are `docs/CONSUMER-REVIEW.md` §5–6. Each item says what it fixes;
the review holds the detail.

### `[x]` ✅ 225 — BUG: `settled()` can hang, and waits on the whole document

`settled(root)` (189) awaits `.finished` on every document-timeline
animation (`src/core/ui/settled.ts`). An infinite one never finishes, and
Sherpa has three: `sherpa-loader`, an indeterminate `sherpa-progress-bar`, the
app header's `data-loading`. And given a part of the page, it still waits on
every animation in the document. Skip infinite animations; limit to `root`.

**✅ Done 2026-10-12.** Only running animations with an end are awaited, and
under `root` alone. Two more found on the way, both in all three engines:
`document.getAnimations()` does not list a shadow root's animations, so a
transition INSIDE a component was never waited for — each shadow root is asked
now; and Firefox never ticks an animation in a closed `<details>`, so a wait
also ends when its element is no longer drawn (`checkVisibility()`).
`T-settled-waits-for-renders-not-transitions`

**Follow-up, same day:** it made `reforged-saved-filter.spec.ts:476` flaky in
Firefox (1 in 20; 0 in 20 before — bisected). A popover's `toggle`, which a
menu writes `open` from, comes a task later than the frames it waited for.
It waits one task too now: 30 of 30.

### `[x]` ✅ 224 — Silent failures, round 2

Each is small, and each says nothing when it goes wrong:
- a View opened by a LINK builds an `ApplyReport` and drops it
  (`persist-view.ts`, the `void applyElements(…)` path, new in 198);
- a View's gaps go to `console.warn`, not to `report()`, so an app's
  `onReport()` never hears them; the provider passes no `onIncomplete`;
- `provider.open()` waits on `customElements.whenDefined` for each `ui` id:
  a tag never imported hangs it for ever, a plain `<div>` rejects it;
- `provider.import()` skips a source name it does not have;
- `LocalStore.update` neither moves nor refuses a changed key, and the
  "every store" contract test covers 2 of 5 stores;
- the templater keeps a FAILED sheet in its cache and drops it with no report;
- a missing file served as `index.html` with status 200 (any SPA fallback) is
  stamped into a shadow root: check the `content-type`;
- `scope: ['all']` (the array form) is not caught by `bind()`;
- a setter that threw is reported as "#id has no X" — refused, not missing.

**✅ Done 2026-10-12** — all nine. New report codes: `provider-undefined-element`
(`open()` no longer waits for it), `provider-refused-setting`,
`provider-unknown-source`, `view-gaps`, `sheet-failed`, `template-failed`; a
fallback page is refused in place of a missing file; `LocalStore` keeps the
changed-key contract, and the contract test runs over 4 stores (`RestStore`'s
server answers for itself). 6 tests, each failing before.
`T-a-broken-assumption-reports`

### `[x]` ✅ 207 — Import anywhere: a server-safe base class, and a checked `define()`

Any import in Node throws `HTMLElement is not defined`, so Next.js, Nuxt,
Angular SSR and SvelteKit must defer every import. Measured: with only
`HTMLElement` and `customElements` stubbed, all 65 modules load — so the base
class extends `globalThis.HTMLElement ?? class {}`. And none of the 65
`customElements.define` calls checks first: a second copy of the library
(micro-frontends, Storybook beside the app, a CDN copy) throws at its first
define and loses its whole import graph. One exported `define(tag, Class)`:
nothing without `customElements`, nothing when the tag is held by this class,
a report when another class holds it. The spec tooling finds a class by the
`customElements.define(` text, so those regexes move with it. A node test
imports every dist module in bare Node. 189 left the guard out on purpose;
framework hosting is where two copies are common.

**✅ Done 2026-10-12.** `SherpaElement` extends `globalThis.HTMLElement ??
Object`; `define(tag, Class)` is exported, and all 65 components register
through it. The three spec patterns and the def compiler read and write the
new line; all 65 specs stay fresh. A node test imports every `dist/` module
with no DOM, and proves `define()` registers once and reports `tag-taken`.
`T-a-component-imports-anywhere`

### `[x]` ✅ 209 — The package surface for one component

- `sherpa-ui/components/sherpa-button/sherpa-button` (no `.js`) passes
  TypeScript, which finds the `.d.ts`, and fails in the page;
- no `sideEffects` field, so a bundler cannot tell what it may drop;
- `sherpa-ui/package.json` is not exported, and tools that read it fail;
- the pattern maps `….component.json`, which is not shipped.

**❓ Will — the name of one component's import:** A
`sherpa-ui/components/button` — the top level stays free for `data`, `app`,
`css` and `types`; B `sherpa-ui/button`. My pick: A. The rest needs no ruling.

**✅ The rest, done 2026-10-12.** The pattern is `./components/*.js`, so an
import without `.js` is refused by Node AND by TypeScript, and the `.js` form
gets its own `.d.ts`; `./package.json` is exported; `sideEffects` keeps the
component modules, `index.js`, the base class and the CSS. A node test
resolves each in Node and in TypeScript (bundler and nodenext). Only the
short name is left, for your ruling.

**✅ Will, 2026-10-12 — all my picks:** A — `sherpa-ui/components/button`.

**✅ Done 2026-10-12.** `./components/*` maps the short name to
`dist/components/sherpa-*/sherpa-*.js` and its `.d.ts`; the long `.js` form
still works. The package test resolves both in Node and in TypeScript.

### `[x]` ✅ 211 — Booleans and data the way frameworks bind them

- Every framework writes `data-x={false}` as `data-x="false"`, and Sherpa
  reads PRESENCE, so false means on. A declared `type: 'boolean'` prop set to
  `"false"` is removed. Checked: no host uses a literal `"false"` today.
- `populate()` is a method, so React 19, Vue and Svelte cannot bind data to
  it, and React 18 can set no property at all. A property beside it.
- `key` is reserved by React and Vue, so the grid's row key cannot be bound:
  a `rowKey` alias.

**❓ Will — the property's name:** A `data` — a metric and a line chart take
an object, not a list; B `items`. My pick: A. The boolean half needs no ruling.

**✅ The boolean half, done 2026-10-12.** A declared `type: 'boolean'` prop set
to `"false"` is removed, before the first render and after; a string prop
keeps `"false"`. Only declared booleans — the ones still in `observed` follow
when 195 declares them. `T-false-is-off`. Left: the `data` property (its name)
and the grid's `rowKey`.

**✅ Will, 2026-10-12 — all my picks:** A — the property is `data`.

**✅ Done 2026-10-12.** Every component has `data`: setting it is `populate()`,
reading it gives what was last given, and a value set before the element
upgrades is kept and drawn. With the boolean half and `rowKey`, 211 is whole.
`T-false-is-off`

### `[x]` ✅ 215 — Trusted Types and a strict CSP

Under `require-trusted-types-for 'script'`, five HTML sinks throw
(`sherpa-element.ts` stamping, `render-icon.ts`, two in `templater.ts`,
`view-markup.ts`). One `sherpa-ui` policy for the first four; `view-markup`
keeps its allow-list under its own. Three `style="…"` in `sherpa-calendar.html`
move into CSS. A harness page with a meta CSP proves it.

**✅ Done 2026-10-12.** The five sinks go through `trusted-html.ts`: the
`sherpa-ui` policy for Sherpa's own files, `sherpa-ui-view` for a View's markup;
a page that allows neither gets a report. The calendar's three styles are set
through the CSSOM as its header lands — they could not be CSS, because the clone
lives in its host's light DOM. `test/reforged/csp.html` (strict CSP, Trusted
Types) draws a button with an icon, an embedded calendar and a View's markup
with no refusal; it failed on the old code in Chromium and Firefox.
`T-sherpa-runs-under-a-strict-csp`

### `[x]` ✅ 220 — Weight per component, gated

One `<sherpa-button>` is 9 JS files (374 KB, 314 KB of them icons) and 12
fetched files (191 KB, 161 KB of them `sherpa-style-modes.css`). input-text
pulls in 20 files and 7 elements. A gate walks each entry's import graph,
records JS and fetched CSS bytes, and lets them only fall — as `check:size`
does for lines. It also fails when an app module (router, provider, session)
enters a component's graph, which keeps 221's boundary honest.

**✅ Done 2026-10-12.** `npm run check:weight` (`scripts/check-weight.mjs`)
walks each of 67 entries' import graph in `dist/` — the package, the data
layer, every component alone — and records JS bytes, module count and fetched
`.css`/`.html` bytes in `scripts/weight-baseline.json`; growth fails until it
is recorded on purpose. It fails too when a display component reaches the app
layer (provider, router, session, saved Views and drafts); none does today.
`npm test` runs it as a node test after its build. One button: 10 files,
378 KB of JS, 191 KB fetched. Not yet in the hook: it reads `dist/`, which the
hook does not build. The bar's `saved-filters.js` is not counted as app layer
until 191 moves it into the provider.

### `[x]` ✅ 226 — Docs and agent text, round 2

- CLAUDE.md says `src/index.ts` puts the eight shared sheets in place; since
  189 `sherpa-element.ts` does. It names `sherpa-provider` 0 times.
- `DATA-SOURCE-RULES.md`, served as `sherpa://data-rules`, names the provider
  0 times and teaches only `bind()`.
- `T-shared-sheets-settle-independently` explains a wait by code that is gone.
- `Fires:` blocks miss events the code emits: `sherpa-menu` (`menu-range-change`,
  `menu-items`, `menu-back`), `sherpa-quick-filter` (`group-change`,
  `sort-change`), `sherpa-filter-panel` (`filter-condition-change`).
- The MCP: `control-content` and `container-*` tokens (0 exist), a "Rule 9"
  (the rules end at 8), ontology checks that no longer run, a dead `readDoc`.
- The `generate_component` prompt and the skill's description still sell the
  `*.def.json` flow; the skill links a missing `GENERATION-TOOLING.md`.
- PRINCIPLES.md:118 says the default `populate()` "still shows data" (195).
- README: `npm test` runs the node tests too; npm readers are sent to
  `../Sherpa Demos`, CLAUDE.md and docs/, which the package does not ship; no
  `repository` field.

**✅ Done 2026-10-12.** Every line above: CLAUDE.md on the shared sheets and
the provider; DATA-SOURCE-RULES names the provider; PRINCIPLES says the default
`populate()` writes DECLARED props only; the stale trap explains the wait that
is still needed; the three `Fires:` blocks list every event (the specs had
them); the MCP says Rule 8, checks no roles, and claims no Rule 4 check; the
dead `readDoc` is gone; the skill's description says it is out of date, and
its four dead links and its `@fires` line are fixed; the README links what the
package does not ship, and `package.json` has a `repository`.

### `[x]` ✅ 227 — Sherpa Demos, round 2

- A refused or invalid save (a taken email, the schema) is an unhandled
  rejection: the dialog stays open, no toast. `T-a-failed-mutation-must-reach-the-reader`.
- `customerOrgs` and the regions are kept twice (`records-data.js`,
  `dashboard-data.js`); the chips need them to agree.
- Settings › "Items per page" writes and reads nothing; `records.json` says 25.
- `dashboard.js` declares a `provider` it never uses.
- 30 `whenDefined` calls in `app/` and 32 `waitForTimeout` in `test/`, and 0
  uses of the `settled()` that 189 shipped. After 225.

**✅ The first four, done 2026-10-12** (Demos `66a7905`): a refused save shows
a critical toast with its reason and keeps the dialog open; the two lists live
once, in `seed-lists.js`; Items per page keeps `/grid/pageSize` and Records
pages by it; the unused provider is gone. **Left:** the 62 waits — each needs
reading, as a `whenDefined` may be there for a reason `settled()` does not
cover.

**✅ The waits, done 2026-10-12** (Demos `245cdc2`). All 32 `waitForTimeout`
are gone, and a node test fails a spec that adds one: 26 are `settle(page)`
(sherpa-ui's `settled()`, in the page), 2 samplers are `expect.poll`, 2
negatives are proved rather than waited out (the applied Query is unchanged;
no alerts feed is asked for), and 2 wait for the real result. The 30
`whenDefined` in `app/` stay — each waits for a class before its methods are
called, which `settled()` does not do.

### `[x]` ✅ 218 — Framework fixtures: measure, never infer — CLOSED

Four rows of the review are reasoned, not run: Vite dev's pre-bundling (likely
breaks the `new URL` fetch), webpack's CSS rule catching it, Next.js, and
whether React fires `onChange` for a custom element. Fixtures: Vite + React 19
and 18, the Next app router, Vue (Vite and Nuxt), Angular SSR, SvelteKit,
webpack 5, a CDN page and a CSP page. Each draws a button, an input-text in a
form, a dialog and a grid with rows, and asserts the events. It becomes the
gate for 207–216.

**❓ Will — where it lives:** A a sibling project, as Sherpa Demos is; B
`test/frameworks/` inside sherpa-ui. My pick: A — each fixture has its own
`node_modules`. Until you rule, one throwaway fixture outside the repo
checks the unverified rows.

**✅ Will, 2026-10-12 — all my picks:** A — a sibling project, as Sherpa Demos is.

**✅ Closed by Will, 2026-10-12:** *"These framework tests are ridiculous. We just want to focus on the quality of Sherpa web components. Their nature of being web components means that I have no concerns about them working with other frameworks."*

Before that, three fixtures (Vite 8 + React 19, Vite 6 + React 18, webpack 5)
measured three of the four reasoned claims, and one fix for the components
came of it and is kept — `T-a-bundler-can-turn-a-file-into-a-module`:

- **Vite dev** — Vite 8 works; Vite 6 draws nothing (its pre-bundle breaks each
  `new URL`; `optimizeDeps.exclude` fixes it). And EVERY Vite dev answered a
  sheet fetch with JavaScript: sherpa-ui now asks with `Accept: text/css`.
- **webpack's CSS rule** — true: it turns every sheet into a module, unstyled
  and silent. The fix is `dependency: { not: ['url'] }` on the rule.
- **React's `onChange`** — React 19 hears `change`; React 18 hears nothing from
  JSX, so a ref.

A sheet is asked for as CSS, and each failure says its fix.

### `[x]` ✅ 210 — Framework typings from the manifest — CLOSED

**✅ Closed by Will, 2026-10-12:** *"These framework tests are ridiculous. We just want to focus on the quality of Sherpa web components. Their nature of being web components means that I have no concerns about them working with other frameworks."*

Nothing declares `HTMLElementTagNameMap`, so `querySelector('sherpa-switch')`
is an `Element`; there are no JSX, Vue or Svelte types, and Angular has only
`CUSTOM_ELEMENTS_SCHEMA`. After 195 emits `custom-elements.json`, one script
writes `dist/types/`: the tag map, per-element event maps, React 19 JSX
(attributes, properties, `on<event>`), Vue `GlobalComponents`, Svelte
elements, VS Code custom data and web-types. No runtime dependency.

### `[x]` ✅ 213 — Only a component's own events leave it

An inner `<sherpa-button>`'s composed `button-click` leaves its composite with
the composite as its target. `sherpa-chip` stops it; `sherpa-toast`,
`sherpa-container` and `sherpa-app-header` do not. So a page listening for
`button-click` hears every app-header action and every container Retry. 23
templates hold a `<sherpa-button>`. A sweep test: the events that leave a host
are the ones its spec lists. First, find any Demos listener that relies on a
leak.

**❓ Will:** A stop each inner event at its host; B keep them, and document
filtering by `event.target`. My pick: A.

**✅ Will, 2026-10-12 — all my picks:** A — each inner event stops at its host.

**✅ Done 2026-10-12.** `emit()` from a part inside a Sherpa composite's
shadow root stops at the composite's host, after the composite's own
listeners. No Demos listener relied on a leak; one component did — the menu,
whose number field, slider and condition rows are parts, so it passes on a
plain `input` and `change` for each now. The sweep `reforged-only-own-events.spec.ts` presses every
button in every bare component: 24 leaks without the stopper, 0 with it.
`T-an-inner-event-stops-at-its-host`

### `[x]` ✅ 212 — Markup paths for the list components

React 18, server HTML and a plain page can set only attributes and children.
These take data only through `populate()`: the tab strip, breadcrumbs, an
input-text select's options, key-value pairs. Each gets a children path (the
panels' `data-tab`/`data-label`, `<a>` children, `<option>` children, slotted
pairs). After 195 lists the slots.

**✅ Done 2026-10-12.** Each reads its own children as its data while no
`populate()` gave any: the tabs' panels (`data-tab`, `data-label`), `<a href>`
crumbs, `<option>`s, and `<dt>`/`<dd>` pairs — one `childData()` hook in the
base class, which follows the children as they change and draws only when
what they say changed. `T-a-list-takes-its-children-as-data`

### `[x]` ✅ 214 — Forms complete

Four controls join a form (`FormValue`). Missing: `formDisabledCallback`
everywhere, so inside `<fieldset disabled>` the inner control still works;
reset on switch, checkbox and radio, which write their current state into
`checked` and keep no default; and five controls that submit nothing — slider,
select-card, calendar, file-upload, transfer-list. Angular needs
ControlValueAccessors for all but input-text (217).

**❓ Will — what `checked` means:** A native — the attribute is the default,
the property the current state; B keep reflecting, and remember the first
value as the reset default. My pick: B, less change.

**✅ Will, 2026-10-12 — all my picks:** B — `checked` keeps reflecting; the first value is the reset default.

**✅ Done 2026-10-12.** Every form control reads `:disabled`, so a disabled
`<fieldset>` disables it; a reset puts back its first state (the file upload
empties). The slider, select card, calendar, file upload and transfer list
join their form and submit their values — a range and a list as one entry
each. Angular's ControlValueAccessors are out, with 217.
`T-a-form-control-follows-its-fieldset`

### `[x]` ✅ 208 — The text in the JS, not fetched

Templates and sheets are fetched at run time from `new URL(…, import.meta.url)`.
That works on a plain ESM page and a file-serving CDN, and breaks under Vite's
dev pre-bundling, a CDN that rebuilds modules, and a CSP `connect-src`; a
button makes about 21 requests before it draws. The build turns each
`new URL('./x', import.meta.url)` into an imported string; the source keeps its
pattern, so the spec tooling is untouched; `reload()` keeps URL mode for the
dev build. Built with 199 — the same build step. It also removes the first
render's wait, which is what 113's skeleton is for.

**❓ Will:** A inline by default, URLs only in a dev build; B fetch by default,
inline as an opt-in subpath. My pick: A. NOTE: on 2026-09-29 you chose
"state first" over "templates in the built JS" for 113 — this is not instead
of that; 113's state work is done either way.

**✅ Will, 2026-10-12 — all my picks:** A — inline by default, URLs only in a dev build.

**✅ Done 2026-10-12.** After `tsc`, the build wraps each `new URL('./x.css' |
'./x.html', import.meta.url)` in `inlined(…, text)`: 142 files, and a button
and a grid draw with no request. `npm run build:watch` and `build:dev` keep the
URLs for live reload; a reload fetches fresh in any build. The package entry
now fetches only `tokens.css`, its page sheet. `T-the-text-is-in-the-js`

### `[x]` ✅ 216 — Tokens safe to embed

`tokens.css` also styles the page — `html, body` margins, the body's font and
colours, a `body > sherpa-app-shell` rule — so a host that links it changes.
With no `data-mode` it follows the OS, so a light-only app on a dark machine
shows dark controls; and mode is set on `:root` only. Bare `[data-status]`,
`[data-look]` and `[data-density]` match anywhere: a host's own
`<tr data-status="active">` re-tints every Sherpa control in it. 502
`::part()`s, 0 `exportparts`. No `@font-face` for Inter. The page rules move to
a generated `sherpa-ui/css/page` that the app layer and the starter link.

**❓ Will — the default mode with no `data-mode`:** A light, with `auto` as an
opt-in (the starter sets it); B follow the OS, as now. My pick: A.

**✅ Will, 2026-10-12 — all my picks:** A — light when no `data-mode` is set; `auto` is an opt-in (the starter sets it).

**✅ Done 2026-10-13.** The page rules are `page.css` (`sherpa-ui/css/page`),
generated beside `tokens.css`, which styles no page now; Sherpa Demos and the
test pages link both. No `data-mode` is light; dark follows the OS only under
`data-mode="auto"`. The `[data-status]` reach is written down. Not done: an
`@font-face` for Inter, and `exportparts`. `T-tokens-are-safe-to-embed`

### `[x]` ✅ 219 — The framework guide — CLOSED

**✅ Closed by Will, 2026-10-12:** *"These framework tests are ridiculous. We just want to focus on the quality of Sherpa web components. Their nature of being web components means that I have no concerns about them working with other frameworks."*

`docs/FRAMEWORKS.md`, about 200 lines of steps: install, one import, tokens, a
recipe per framework, attributes vs properties, events, forms, CSP, server
rendering, and the `:not(:defined)` rule for the time before the JS loads.
Served as `sherpa://frameworks`, with a short `AGENTS.md` in the package.
After 207–215. The app guide (193) is its sibling.

### `[x]` ✅ 217 — React 18 and Angular adapters — CLOSED

**✅ Closed by Will, 2026-10-12:** *"These framework tests are ridiculous. We just want to focus on the quality of Sherpa web components. Their nature of being web components means that I have no concerns about them working with other frameworks."*

React 18 can set no property and hear no custom event without a ref; Angular
needs ControlValueAccessors. Both generated from the manifest: a small
`createComponent` that takes React as an argument (no dependency), and CVA
directives for switch, checkbox, radio, slider and select-group. After 210
and 214.

**❓ Will:** A their own packages (`sherpa-ui-react`, `sherpa-ui-angular`); B
subpaths with optional peer dependencies. My pick: A, as for the MCP (183
choice 2) and 184.

**✅ Will, 2026-10-12 — all my picks:** A — their own packages, `sherpa-ui-react` and `sherpa-ui-angular`.

### `[x]` ✅ 221 — `sherpa-ui/app` and the app boundary

No display component imports app code today. Make it structural: a
`sherpa-ui/app` entry (router, provider, outlet, session, View files, saved
Views and drafts, `app.json`, `ContextModule`) and a `sherpa-ui/components`
entry; a lint boundary like rule 13 — `src/components/**`, except the
provider, router and outlet, may not import app modules; 220's gate proves it.
A component feature stays a component: `SherpaDialog.prompt()` (191) is for
React users too.

**❓ Will:** A the root `sherpa-ui` still re-exports the app layer — one line
on a CDN; B the root holds components and data only. My pick: A. Waits on 183
choice 1.

**✅ Will, 2026-10-12 — all my picks:** A — the root `sherpa-ui` still re-exports the app layer.

**✅ Done 2026-10-13.** `src/app.ts` is `sherpa-ui/app`, `src/components.ts`
is `sherpa-ui/components`, and `src/index.ts` is the two and the data layer,
three lines; every name it had is still there (94 checked). A lint override
refuses an app import from a display component, and `check:weight` lists
four more app modules and weighs both new entries. The outlet joins
`sherpa-ui/app` with 194. `T-the-app-layer-is-opt-in`

### `[x]` ✅ 222 — The starter

One folder, about 8 files, on any static host with no build and no Express:
`index.html` (import map, tokens, router, provider, shell, outlet — about 40
lines), `app.json`, a Context template that asks, its page definition, seed
rows, an optional Context module, `package.json`, and an `AGENTS.md` that says
where each kind of file goes. Three ways in, one source — a `starter/` folder
versioned with the library: `npx sherpa-ui init my-app` (a bin with no
dependencies), `scaffold_app` and `validate_app` in the MCP (192), later
`npm create sherpa-app`. Needs 197, 190, 194, 221, 193; 192 for the MCP way;
207 so `check` runs in Node.

**❓ Will:** A the template inside sherpa-ui, with `npx sherpa-ui init`; B a
separate `create-sherpa-app` package. My pick: A.

**✅ Will, 2026-10-12 — all my picks:** A — a `starter/` folder in sherpa-ui, with `npx sherpa-ui init`.

**✅ Done 2026-10-13.** `starter/` is 11 files — `index.html` (39 lines, 13
of them script), `app.json`, the Records Context's template, page
definition, Views, store and module, `package.json`, `.mcp.json`, `.gitignore`
and `AGENTS.md`. `npx sherpa-ui init <folder>` (`bin/sherpa-ui.mjs`) copies it;
the MCP's `scaffold_app` returns it (19 tools). An e2e test boots it in three
engines; a node test checks what `init` makes against both schemas, `checkApp`
and the usage gate. `validate_page` reads an `app.json` as well, so there is
no separate `validate_app`. Found on the way: 237. `T-a-starter-is-one-folder`

### `[ ]` 223 — DEFERRED: server rendering with declarative shadow DOM

A `sherpa-ui/ssr` that renders `<template shadowrootmode>`, and a constructor
that keeps a declarative root instead of re-stamping it. Needs 208. Until
someone needs SEO or pages without JS.

## D — Filters: Will's features, on the foundation

### `[x]` ✅ 99 — EXPLORE: a FILTERSET — filters in SERIAL, in PARALLEL, or both; and a group of chips

Will, 2026-09-29: *"Customers and Regions are closely related. 1 customer can
operate in many regions. A region can only contain a customers data for that
region. This isn't something that Sherpa logic needs to contend with
literally. However, it would be good to have the option to configure filters
to run in serial, parallel, or both modes."*

| mode | a filter's options |
|---|---|
| **parallel** — the default, and today | every value, whatever the other filters pick |
| **serial** | only the values the rows still have after the picks ABOVE it in the chain |
| **both** | a serial group sits beside filters that run in parallel |

*"A nice way to achieve serial groups is some sort of wrapper element like the
native HTML fieldset… Perhaps a filterset element? Actually, we can also use
this to group filters/chips together, too."*

- **`filterset`** groups filters — and chips: it can also put Group and Sort
  under "Organise".
- **`data-filter-mode="serial"`** chains the filters in it;
  **`data-filter-mode="parallel"`** runs them side by side. No filterset, or no
  attribute, is parallel, as today.
- **The example app:** Customer and Region in serial, everything else in
  parallel. Sherpa never knows that a customer has many regions — the ROWS
  answer it, through the chain.

**Design first**, for Will's review:

1. **The JSON.** A scope's sets in the page definition — for example
   `"sets": [{ "mode": "serial", "fields": ["customer", "region"] }]` — so the
   markup and the definition say one thing (`T-a-page-is-its-definition`).
2. **The data layer.** A field in a serial set takes its options from the rows
   the fields ABOVE it allow — `filterDef()` for that field, narrowed. Show an
   unavailable value dimmed below a divider
   (`T-unavailable-value-sorts-below-a-divider`), or remove it?
3. **A pick that is no longer offered.** Region = APAC, then Customer = one
   with no APAC rows: keep the pick, suspend it, or drop it? Suspend is not
   clear — never lose a reader's answer silently.
4. **Sort and group keep their scope** in the source (Will, 2026-09-29,
   ruling 4 of the API audit) — design it here, with the filterset.
5. **The bar and the panel draw a set as ONE group** — 38 step 4's one
   builder, and `.sherpa-group` for the joins. Do it before 89 redraws the
   panel, so the panel is rebuilt once.

**Design, 2026-09-29 — for Will's review.** Found first: every filter is
PARALLEL today. A field offers all its values (`filterDef()`), and the rows
are the AND of every pick. `available: false` exists on an option, but
nothing sets it. So SERIAL changes what a field OFFERS, never how rows
match. 110 (an AND row offers only what the rows before it leave) is the same
chain inside one field — build both on one helper.

1. **The JSON** — a scope lists its sets; a set's order IS the chain:
   ```json
   "view": { "holds": ["customer", "region", "created"],
             "sets": [{ "id": "account", "label": "Account", "mode": "serial",
                        "fields": ["customer", "region"] }] }
   ```
   `mode` defaults to `parallel` — a set that only GROUPS chips. A set's
   fields must be ones the scope holds; `openSource` reports one that is not.
   Organise is a set too, in a component's scope:
   `{ "label": "Organise", "organise": ["group", "sort"] }`.
2. **The data layer** — `source.optionsFor(field)`: a field in a serial set
   offers the values of the rows that the picks of the fields ABOVE it allow
   (only those — a parallel filter outside the set does not narrow it). One
   helper narrows rows by a list of readings; 110 reuses it for AND rows.
   The source redraws a field's options when a field above it changes. Local
   stores answer from their rows; a remote store needs one new call —
   distinct values of a field under a filter — added to
   `docs/DATA-SOURCE-RULES.md`. Narrowed-out values are REMOVED, not dimmed:
   serial exists to offer less, and the way back out is the field above.
3. **A pick no longer offered** — see ❓ below.
4. **Sort and group keep their scope** — the source keeps an arrangement PER
   scope, not one; a panel's `sort-change` reaches its own component
   (ruling 4). Built with 38's scope rename.
5. **Drawing** — see ❓ below. Either way the bar and the panel stamp a set
   from the JSON; nobody writes one by hand, so the definition stays the one
   list (`T-a-page-is-its-definition`).

**Build order:** 1 the JSON and `openSource` checks; 2 the narrowing, with
headless tests; 3 sort and group per scope; 4 the drawing, with 38 step 4 and
before 89; 5 the example app — Customer then Region, serial; 6 110 on the
same helper.

**❓ Will — two choices.**

- **Q3, a pick the chain no longer offers** (Region = APAC, then a Customer
  with no APAC rows):
  - **A (my pick): keep it, ticked and listed** — the DO NOT DROP rule
    (`T-unavailable-value-sorts-below-a-divider`). The rows may go to zero;
    the reader sees why, and unticks it. Nothing lost.
  - **B: drop it, and say so** — a toast "Region APAC removed — no rows for
    this Customer", with Undo.
- **Q5, how a set is drawn:**
  - **A (my pick): a `sherpa-filterset` component**, like `<fieldset>` —
    your idea. Stamped by the bar and the panel from the JSON: a label, its
    chips joined as one group, and a small chain mark when serial. One
    component, so the bar and the panel cannot draw a set two ways.
  - **B: no new component** — a `.sherpa-group` wrapper with a label, drawn
    by each of the bar and the panel.

**✅ Will, 2026-10-12 — all my picks:** Q5 A — a `sherpa-filterset` component. (Q3 was overtaken by 180.)

**Build, from 2026-10-13:**

| | step |
|---|---|
| ✅ | 1. The JSON: `sets` on a scope, `declareSets()` / `sets()`, `describe()` carries them; `openSource` reports a set field not held, `declareSets` a field in two sets |
| ✅ | 2. Serial narrowing: a field offers what the fields above it leave; a pick the chain rules out is set aside, as 180 does. `source.offered(scope)`; `drawOffered` on the bar and the panel, `offered` on the menu; a value not offered is removed, a pick kept greyed. A field is never ruled out by one below it, Limit on or off |
| ✅ | 3. The `sherpa-filterset` component, stamped by the bar and the panel — **✅ Will, 2026-10-13: A.** Built: a heading, its filters (joined with `.sherpa-group` in the bar, stacked in the panel), and a `link-simple` mark when serial. A set whose chips all fold is parked, as they are. Records in Sherpa Demos draws its Account set |
| ✅ | 4. **Done 2026-10-13:** `arranges` per scope (page JSON or `declareScope`; left out, a grid's or a list's scope does, the View does not); the source remembers which scope arranged the rows — its chips alone show it, `export()` writes it there. Sort and group per scope — the Organise set. **✅ Will, 2026-10-13: B** — *"Only certain component scopes, and possibly view scope, will have group and sort. Not all component scopes."* **❓ Will, found while building:** a source has ONE arrangement today — one sort, group and page, loaded once — and `export()` writes it in the View scope. A real arrangement PER scope means each grid on a source gets its own sorted page: the source loads once per arranged scope. No page in Sherpa Demos has two arranged components on one source yet. **A:** build it now — one load per arranged scope, each grid its own sort, group and page. **B:** the source records WHICH scope arranged the rows (from `sort-change`'s `scope`): a scope's Organise chips show only its own sort, and a saved View keeps the arrangement in that scope — still one load, until a page has two arranged grids. My pick: B |
| ✅ | 5. Sherpa Demos: Customer then Region, serial — on Records. The Dashboard stays parallel: in a chain Region can never set Customer aside, and the Dashboard is where 180's "a later answer wins" shows |

### `[x]` ✅ 89 — Every filter added to the panel starts SIMPLE

Will, 2026-09-27: *"Let's start all filters added to the panel in 'Simple'
mode."* Its content is one of three, by the field:

| the field has | Simple draws |
|---|---|
| 16 values or fewer | each value as its own chip — exploded |
| more than 16 values, or it is a date | ONE chip with a menu — a list, or a calendar menu for a date |
| numbers | a number input, or range slider inputs |

**16 replaces 47's 20** — one line for the bar and the panel, set once (the
builder's explode-or-menu flag, 38 step 4). 47 (more than 20 values, one chip)
is merged here. Mode words: TODO 75.

**Plan, 2026-09-30** (a second agent read the code; nothing built yet).
NOT built: there is no "16 values" line anywhere in `src/`. Every field with
options is a run of chips; only a date, Group and Sort are one chip. The
line belongs in `src/core/ui/filter-kind.ts` (DOM-free), read by the panel
and the bar. Two fixes ride with it: a one-chip field's picks are its MENU's
values, not the chip's on/off (`#picked`), and its Advanced switch is the
chip menu's own, as the inline body is never built for it.

**❓ One number.** 89 says 16, and that it replaces 47's 20. 122, later, says
"over 20 unique values".
- **A (my pick): 16** — 89 calls it the one line for the bar and the panel.
- **B: 20.**

**✅ Will, 2026-10-12 — all my picks:** A — 16 values.

**✅ Done 2026-10-13:** `EXPLODE_AT = 16` and `oneChipList()` in
`src/core/ui/filter-kind.ts`. A panel field with more than 16 values is ONE
chip with its values in its menu, as a date is. Its picks and its answer are
the chip's, its greyed look is the chip's, and its Advanced switch is in its
menu, not the field header. 16 or fewer is a run, and a number keeps its own
input or range. The bar was one chip per field already. `T-only-group-and-sort-stay-one-chip`

### `[x]` ✅ 102 — Simple AND Advanced answers are both kept, so a filter switches mode at any time

**Progress, 2026-09-29.** ✅ Step 1: a reading keeps both answers, and `mode`
says which filters (a696700e). ✅ Step 2: `menu.reading`, and Advanced mirrors
Simple until a row is edited (c3b280b2). ✅ Step 3a: the bar and the chip read
and write through `menu.reading` — Will's "can't switch back" bug is fixed, on
the Records page too (22fbcb41). ✅ Step 3b: the panel — its chips are
Simple's answer, its menu's rows Advanced's; its switch carries the chips over
and they mirror until edited; a redraw keeps the reader's mode (75d23450). ✅
Step 3c: the grid heading holds the menu's whole reading — `ColumnFilter` is
gone — and a redraw is held as it is, not through a clause. **Left:** the rest
of A7 (one event per act, the headings on `menuFor()`, the 18 members go),
which is 86's.

**✅ Done 2026-09-29:** a filter keeps its Simple picks AND its Advanced rows,
and `mode` says which filters; the first switch to Advanced copies the picks
(X and Y become Equals X OR Equals Y) and keeps copying until a row is edited;
the switch works both ways in the bar, the panel and a grid heading, and a
redraw keeps the reader's mode. A saved View and the session's kept Query carry
both answers (`READING_KEYS`); a saved FILTER still saves the answer in force —
105 reworks saving. `T-both-answers-are-kept`

Will, 2026-09-29: *"Switching to an advanced filter, in the filter toolbar
chip menu, prevents me from toggling back to a simple filter if a value has
been input. Both simple and advanced mode conditions need to be tracked and
stored to allow switching at any point. May require rework to the query
building in the data layer as well as component fixes."*

Today the menu's mode switch carries the picks INTO the condition rows
(`#seedFromPicks`, `T-a-mode-switch-carries-the-answer-over`) and nothing
keeps them going back — one answer, two views of it.

- **The reading holds BOTH answers and which mode is in force.** A
  `FieldReading` keeps its `picked` list and its condition rows side by side,
  and a `mode`. The Query compiles only the mode in force; switching changes
  the mode and loses nothing.
- **The switch is never blocked**, whatever either mode holds. Switching back
  shows Simple's own picks.

**Will, 2026-09-29, later:** *"The initial switch from simple filter to
advanced should carry over the conditions. e.g. X and Y are selected becomes
Equals X OR Equals Y. As soon as the advanced conditions deviate from the
simple conditions then that mirroring should be disabled. Users should still
be free to toggle between simple and advanced modes at any point and have
their parameters maintained."*

- **Advanced MIRRORS Simple until the reader changes it.** The first switch
  turns picks X and Y into `Equals X` OR `Equals Y` (today's
  `#seedFromPicks`). While the rows are still that mirror, a change to the
  picks re-draws them.
- **The first edit to a row ends the mirror**, for good: from then on each
  mode keeps its own answer, and switching shows it. The reading records
  whether the rows still mirror the picks.
- **Every writer and reader of a reading follows**: the menu, the bar, the
  panel, a grid heading, a saved filter and a saved View (JSON), and the
  session's kept Query. Design it with 90, which builds Advanced on it, and
  with 75's rename (the mode is `simple` / `advanced`).

### `[x]` ✅ 110 — In Advanced rows, AND is serial and OR is parallel

Will, 2026-09-29: *"Advanced filter conditions: AND is serial. OR is
parallel. So AND row options should be restricted by preceding conditional row
conditions."*

A row joined by AND narrows what the rows before it left, so its value list
offers only the values still present under them — the SERIAL idea of 99's
filterset, inside one field's rows. A row joined by OR starts again: every
value. AND binds tighter than OR (`T-many-conditions-are-one-reading`), so an
AND row looks back only as far as the last OR.

The data layer has the tool: `present` is the values a row still carries under
the other filters. Build with 90 (options per field type) and 99 (serial /
parallel for whole filters), so "serial" means one thing in both.

**Plan, 2026-09-30** (a second agent read the code; nothing built yet).
`FieldReading.present` is READ (a value not in it shows as unavailable) but
NOTHING writes it: the data layer has the type, not the sum. Needed: a
DOM-free rule in `filter-state.ts` (walk back to the last OR), a source
method that answers "which values are left under these rows", and a way for
a row to ask — the menu reads its own DOM today, and a remote store is
async. Build with 99.

**❓ One choice.** In an AND row, a value the rows before it rule out is:
- **A (my pick): hidden** — "offers only what the rows before it leave".
- **B: shown, dimmed, and not pickable** — as an unavailable value reads
  elsewhere.

**✅ Will, 2026-10-01: B.** A value the rows before it rule out stays in the
list, greyed out, and cannot be picked. The same rule for 174.

**✅ Done 2026-10-01.** An AND row's value list greys what the rows before it
rule out — back to the last OR — and says "No matches with the rows above."
on hover; an OR row offers every value. With Tier = Silver in row one, an AND
row offers Silver alone and greys Gold. It needs no data: every row is on the
same field, so the menu tests the field's own values against the rows above.
`T-an-and-row-offers-what-the-rows-before-it-leave`

### `[x]` ✅ 90 — Any filter switches to ADVANCED: condition rows, with options per field type

Will, 2026-09-27: *"Any filter should be able to be toggled to 'Advanced',
using simple switch, to build a multi condition scenario using conditional
input rows. We'll need different conditional options for numeric, and date,
field types."*

A plain switch on every filter turns Simple into Advanced: condition input
rows, several of them. The operators follow the field's TYPE — text, number
and date each get their own list (21d is the date half). Switching back to
Simple keeps what it can show and says what it cannot, never drops a
condition silently. **The word is Advanced** — Will chose it over
*Complex*, 2026-09-27 (75).

**Plan, 2026-09-30** (a second agent read the code; nothing built yet).
DONE: Advanced rows on a TEXT field, both answers kept, the f(x) switch.
LEFT: the operators do not follow the type — `menuFor` gives every Advanced
menu the text list, and a number or date menu returns before it gets rows.
`OPS_FOR_TYPE` has the number list already (a grid heading uses it). So:
number rows first; a date waits on 21d's two open choices.

**🚧 2026-09-30 — numbers are done; dates wait on 21d.** A number field that
opts in (`advanced: true`) gets the f(x) button, on a toolbar chip and in the
panel. Advanced shows condition rows with the number questions (=, ≠, >, ≥,
<, ≤), every value typed. Switching over carries the number in: `37` stays
`= 37`, and a range `20 to 80` becomes `At least 20` AND `At most 80`.
Switching back finds the Simple answer as it was. On Records the four number
fields opt in (Seats, Spend, Tickets, Health). Advanced is still opt-in per
field (`T-conditions-are-opt-in-per-field`): say if EVERY field should offer
it.

**✅ Will, 2026-10-12 — all my picks:** Unblocked: 21d is ruled — no weekday now, a time input only where the field holds a time.

**Dates, from 2026-10-13** (21d's design, as ruled):

| | step |
|---|---|
| ✅ | 1. The data: On, Before, After and Between are `eq`, `lt`, `gt` and `between`; In the last and In the next are `last` / `next { n, unit }`, kept RELATIVE in the clause and in a saved View (`{ "last": 7 }`) and worked out when matched — a `RestStore` sends the `between`. A field with `time: true` takes a day alone as all of it. The words: `Before 03 Sep 2026`, `In the last 7 days` |
| ✅ | 2. The menu: a date filter's Advanced rows — a date box (and a time box where the field holds times), two for Between, a count and a unit for In the last and In the next; the f(x) switch beside the calendar. A date that opts in is a FILTER menu, as a number is; the calendar keeps its card; the switch carries a day over as On, two as Between; the chip's face reads the rows |
| ✅ | 3. Sherpa Demos: Created opts in — a Demos test answers "before 1 April 2024" and finds the header chip's rows and the records follow |

### `[x]` ✅ 98 — One action row per panel filter — Reset, Apply, Discard; Apply all and Discard all in a footer; the actions column goes

Will, 2026-09-29: *"If there is at least 1 advanced (conditional) filter in
the filter panel then we should show Apply and Discard buttons in the same row
as the Add condition button but on the right side. Clicking these will apply
or discard changes to that specific filter only. We should also show a footer
at the bottom of the panel to Apply All or Discard All changes. We can just
tweak the labels (and any required logic) on the panel footer that we used to
use for applying filters."*

- **Per filter:** an Advanced filter shows Apply and Discard at the RIGHT of
  its Add condition row. They apply or discard THAT filter only.
- **Whole panel:** a footer with Apply all and Discard all, shown while at
  least one Advanced filter is in the panel.
- **The footer comes back**: it was removed in `c92adec0` (step 6c, "no
  footer; a field applies as it changes"). Take its markup back from there and
  change the labels. A Simple filter still applies as it changes.
- Build on 90 (Advanced mode). The source already hears `filter-apply` and
  `filter-discard`; a per-field one must name its field.

**Update, Will 2026-09-29:** *"Let's also move the reset filter button from the
section header to the last row alongside Apply/Discard… We can keep this as an
icon only button for now. Increase its size to match the other buttons on the
row. We can also add this row, with the updated remove button, to simple
filter sections. That way we have 1 action row, per section, regardless of
simple or advanced filter mode. With this change we can also get rid of the
column that we had reserved in the filter panel for actions on the right side.
This gives us some more horizontal space for content."*

- **ONE action row per field section**, last in the section, in Simple AND
  Advanced mode. It holds the Reset button (`.field-clear`,
  `arrow-rotate-left`, icon only) and, where the field has them, Apply and
  Discard at the right. In Advanced mode it is the Add condition row.
- **Reset leaves the section header** and takes the row's button size, not
  `data-size="sm"`. The remote Apply and Discard icons (`.field-apply`,
  `.field-discard`) leave the header too.
- **The actions column goes**: the panel's reserved right-hand column
  (`.field-acts`, from `24c3a57c`) is deleted, and its width goes to the content.

**Plan, 2026-09-30** (a second agent read the code; nothing built yet).

- DONE already: the actions column (the field is one column now), and the
  per-field Apply and Discard — but they show only while a REMOTE change
  waits, and they sit in the header.
- Left: one `.field-row` after the field's body holding Reset, Discard and
  Apply; in Advanced it is the Add condition row (the menu needs a public
  `addCondition()`, as its own button is in its shadow root); and a footer
  with Apply all and Discard all. The source must hear an apply with no
  field (it ignores one today).
- It changes later rulings on purpose: 62's "no footer" trap and test, and
  121's Clear + Send to group (Send to stays in the header, alone).

**❓ One choice.** On a LOCAL source an Advanced row applies as you edit it
(62), so Apply and Discard have nothing to do.
- **A (my pick):** keep that. Apply, Discard and the footer show only while
  a remote change waits. The row still holds Reset and Add condition.
- **B:** Advanced rows are a DRAFT until Apply, on every source, as 98 says
  word for word. The menu has a draft model, but only for an open popover,
  not an inline one.

**✅ Will, 2026-10-12 — all my picks:** A — a local source keeps live-apply; Apply, Discard and the footer show only while a remote change waits.

**✅ Done 2026-10-13.** Each field ends with ONE action row: Add condition in
Advanced (the inline menu's own goes; `menu.addCondition()` is the door),
Reset at the row's button size, and — on a remote source, once changed —
Discard and Apply at the right. The row is drawn only while it holds a
button. Send to stays in the header, alone. While any change waits, the
footer shows Apply all and Discard all, which name no field; the binder
commits or discards everything. `T-apply-and-discard-wait-for-a-change`

### `[x]` ✅ 241 — A set's chips on the bar are not grouped

Will, 2026-10-14: *"Don't group Customer and Region filter chips in the toolbar."*

**✅ Done 2026-10-14.** The bar draws a set's chips together, in the set's
order, as plain chips — no `sherpa-filterset` round them, so they are not
joined. The parking of a fully folded set went with it. A set is now only an
ORDER on screen, in the bar and the panel; the serial chain is unchanged.
`sherpa-filterset` was then used by nothing in Sherpa. **✅ Will,
2026-10-14: A** — deleted: the component, its export and its a11y fixture.
`T-a-filter-set-groups-or-chains`.

### `[x]` ✅ 240 — A filter set is drawn quietly

Will, 2026-10-14: *"I don't like the 'Account' and link icon before Customer
and Region filters in the toolbar. I also don't like the nesting of Customer
and Region filter sections in the filter panel."*

**✅ Done 2026-10-14.** The bar still joins a set's chips, in the set's
order, but stamps its `sherpa-filterset` with no heading and no chain mark.
The panel only orders a set's fields where its first stands — no box. The
serial chain is unchanged: Region still offers only the picked Customers'
regions. `sherpa-filterset` keeps its heading and mark for a page that asks.
Found while checking it: 105's "Save filters" pushed the panel's own title
off its header; narrow, the button now reads "Save" (its name stays "Save
filters"). `T-a-filter-set-groups-or-chains`.

### `[x]` ✅ 105 — "Save filters" saves EVERY scope under one name; a "Saved" chip shows it

Will, 2026-09-29: *"'Save filter', in the filter panel and filter toolbar,
creates a Preset advance filter chip to reuse later. However this button should
be a 'Save filters' (plural) button that saves a definition of the current
state of the filter scopes."* … *"We have definition saving mechanisms for
Views already. Perhaps there's overlap and reusable functionality here."*

Today "Save filter" packs ONE scope's fields into one preset Advanced chip
(`filter-save`, `packFilter`; `T-save-packs-the-fields-into-one-chip`,
`T-a-saved-filter-is-its-readings`).

| | Will's rule |
|---|---|
| **Save filters** | Saves ONE definition: the state of ALL scopes, under the name the reader gives. One button, in the panel HEADER (its toolbar actions menu) — no Save per scope |
| **Save as** | A grouped menu button right of Save, as for Views |
| View labels | `Save view` and `Save view as` (see 15) |
| Filters menu | The section is `Saved filters`, not `Custom filters` (`CUSTOM_SECTION`, `T-saved-filters-are-the-custom-section`) |
| The chip | The applied definition is an ACTIVE chip in the panel header. Field label `Saved`, value its name |
| Edited after applying | The chip turns WARNING and its value gets ` *`. Save again, or Save as, clears both until the next edit |
| Overwrite | A dialog asks to confirm |
| Dismiss | The chip's right button DISMISSES — it is not a menu. Dismiss takes the definition off the scopes and puts them back as they were BEFORE it was applied |

Build with 15: one Save split button, one name dialog, one overwrite confirm,
and one store shape — a saved filter set is the filter half of a View
definition (JSON, `T-a-page-is-its-definition`). Dismiss needs the Query as it
was at apply time; the provider already keeps it under `/filters/<id>`.

Settle when it starts:
- Will wrote "all contexts". Read as all filter SCOPES (the panel's sections),
  not nav Contexts — confirm.
- What becomes of the saved preset chips already stored: read them as
  one-scope definitions, or drop them.
- Still kept per DATA (`T-a-saved-filter-lives-with-its-data`)?

**✅ Step 1 done 2026-09-29:** the Filters menu's section is `Saved filters`
(`SAVED_SECTION`). The rest is built with 15 and waits on the choices below.

**❓ Will — two choices** (and I read "all contexts" as all filter SCOPES —
the panel's sections; say if you meant nav Contexts).

- **The saved preset chips already stored:**
  - **A (my pick): read each as a one-scope definition** — nothing a reader
    saved is lost; it applies to its one scope.
  - **B: drop them.**
- **Where a saved filter set is kept:**
  - **A (my pick): per PAGE, beside its Views** — it saves every scope, and
    the scopes are the page's, so it is the filter half of a View
    definition, stored the same way.
  - **B: per DATA, as saved filters are today**
    (`T-a-saved-filter-lives-with-its-data`) — every page over the same data
    sees it, but a scope another page lacks is dropped on apply.

**✅ Will, 2026-10-12 — all my picks:** A and A — an old preset chip is read as a one-scope set; a saved set is kept per page, beside its Views. "All contexts" means all filter scopes.

**Plan, 2026-10-13** — a saved SET is `{ label, query }`, the query in a View's
JSON form, kept per page beside its Views. The Filters menu's `Saved filters`
lists the sets; applying one keeps the Query from before (for Dismiss) and
shows the `Saved: <name>` chip in the panel header; an edit turns it warning
with ` *`; Save (or Save as) clears it; Dismiss puts the Query back. App
presets from a definition stay preset chips.

**❓ Will — two choices, found while planning:**
- **In toolbar mode**, the panel is hidden, so its header's Save filters is too.
  - **A (my pick):** the View bar's Save ▾ also offers "Save filters" and
    "Save filters as", and the Saved chip shows on the View bar.
  - **B:** Save filters is the panel's alone.
- **A reader's saved chip today** sits in one scope, with its edit-in-place
  card (Edit filter, Delete filter, its change kept — 49, 50, 181). Old ones
  become one-scope SETS by your ruling, so:
  - **A (my pick):** the set replaces it — a set is changed by changing the
    filters and saving again, and deleted from the Save ▾ menu, as a View is.
    The per-scope card goes, and 186 closes with it.
  - **B:** keep both: sets for every scope, and the per-scope saved chip and
    its card as they are.

**✅ Will, 2026-10-13:** (1) neither — *"An option in the toolbars overflow
menu"*: in toolbar mode, Save filters is a row in the filter toolbar's ⋮
menu. (2) A — the set replaces the per-scope saved chip and its card.

**✅ Done 2026-10-13.** A set is `{ label, query }` — each scope's filters in a
View's JSON form, no arrangement — kept per page (`sherpa:filter-sets:<page>`).
- **Save**: the panel header's Save filters split button (Save filters as,
  Delete filters), folded into its ⋮ when narrow; in toolbar mode, rows in a
  saving bar's ⋮. Each asks (`filters-save`, `filters-save-as`,
  `filters-delete`); Demos names it, asks before it saves over a name, and
  asks before Delete. The provider: `saveFilters(label?)`, `deleteFilters()`,
  `savedFilters`, `savedFilterSets`.
- **Apply**: a set's row in the Filters menu's Saved section
  (`filters-apply`) — each scope it names takes its filters, the rest stay.
  The Saved chip (`sherpa-quick-filter data-dismiss`) names it in the panel
  header and on a saving bar; ` *` and the warning look once changed.
- **Dismiss**: its cross (`filters-dismiss`) — back to the filters before the
  first set applied, or, for one saved from the screen, the View's own. The
  tab remembers the set on screen, so a reload keeps the chip.
- **Old saved filters** move into the page's sets once, each over the first
  scope below the View. **Gone**: the per-scope Save, `filter-save`,
  `packFilter`, `filter-delete`, the saved chip's Edit filter / Save /
  Discard / Delete rows, `preset-edit`, a Query's `edits`, `editPreset`,
  `editable`, the chip's `data-edited` and the menu's Save filter button.
  `T-saved-filters-are-every-scope`.

### `[x]` ✅ 109 — Reset has a label, and a menu button: "Reset to default" puts back the View's own filters

Will, 2026-09-29: *"The reset button in the filter panel and toolbar should
have a label. It should also be in a button group with a secondary menu
button. This menu button shows a 'Reset to default' option that restores to
the Views initial defined filtering state. The current reset button just
resets all added filters to their default state like it does currently."*

| control | does |
|---|---|
| **Reset** (now with its label) | what it does today — every added filter back to its own default |
| its menu button → **Reset to default** | the scopes go back to the View's DEFINED state: its definition's `ui` and `readings`, or a saved View's Query as it was saved |

The same split button as Save view (15) and Save filters (105) — build the
three together. A default is not an empty value
(`T-a-default-is-not-an-empty-value`); the provider already holds the View's
own Query (`provider.open`, `T-a-page-is-its-definition`). Settle: whether
Reset to default also removes filters the reader ADDED since.

**✅ Done 2026-09-29.** Reset reads "Reset", joined with a ▾ in one
`.sherpa-group` (as Save and its ▾), in the bar and the panel header; the ▾'s
menu has "Reset to default", and folded, the ⋮ lists both. It sends
`view-reset`; `provider.resetView()` puts back the page's first Query (kept
at `open()`), then the View's own, as a pick does. **Settled by your words**
("the View's initial defined filtering state"): a filter the reader added
since goes. On Records: At risk 13 rows → Reset 100 → Reset to default 13,
the same Query, the added filter gone. 15 and 105 reuse the group.
`T-reset-to-default-is-the-views-own`

### `[x]` ✅ 97 — A filter panel section shows an icon for WHAT it filters

Will, 2026-09-29: *"The accordion header for filter panel sections should have
an icon before the heading label, and after caret, that indicates the type of
content being filtered."*

| section filters | icon |
|---|---|
| the View | `monitor` |
| a chart | a chart icon |
| a data grid | a grid or table icon |
| a form | `file-lines` |
| a list | `list` |

The order in the header is caret, icon, label. `monitor`, `file-lines` and
`list` are in `src/core/ui/icon-paths.ts`. **No chart icon and no table icon are
there** (only `table-columns`), so get them from Figma first. The KIND comes
from the component that the scope's fields belong to, so the source must
report it with each scope (`describe(scope)`). The panel must not find it by
tag name.

**✅ Done 2026-09-29.** `sherpa-accordion` takes `data-icon` (an icon before
its title); in the panel the order is caret, icon, label. A component says
what it shows in `asks.shows` (the grid `grid`, the four charts `chart`); the
provider passes it to `source.bind()`, and `describe(scope)` reports `shows`
(`view` for the View). On Records: View filters `monitor`, Customer records
`table-columns`. **Figma has no chart glyph and no table glyph** (searched the
whole file) — so a chart's section shows none, and `table-columns` stands in:
that is 115. `T-a-scope-says-what-it-shows`

### `[x]` ✅ 174 — Two answered fields return nothing; a filterset's fields should limit each other

Will, 2026-10-01: *"We also need to check the logic. I have set the following
conditions: Customer - Adventure Works (Badge count 160), Region - America
(Badge count 321). Customer section badge shows 160 result count. However
there is nothing being returned for any of the component scoped
data/filters. This may be because Customer and Region need to be in a
filterset?*

*Also we've only really talked about filtersets being serialised. We haven't
done anything about symbiotic serial filtersets. For example, choosing a
Customer filter should limit the Region options. Inversely, choosing a Region
filter should limit the Customer filters in the filterset. There's
potentially a need for limiting filter options to trickle down to the
component scope, too. Perhaps this should be configurable. We can also make
it an app setting."*

Builds on 99 (filtersets) and 110 (an AND row offers only what the rows
before it leave).

**Found, 2026-10-01 — the logic is right; the DATA was wrong. Fixed.** View
fields are joined by AND, so the rows must be Adventure Works AND Americas.
The numbers (160, 321) are the Dashboard's 1,284 alerts. Its seed gave each
row `customer = orgs[i % 8]` and `region = regions[i % 4]`, and 4 divides 8:
so every customer had ONE region. Adventure Works was always EMEA, and
Adventure Works + AMER was 0 rows. The comment said "coprime strides"; they
were not. Now each region holds a list of customers
(`examples/contexts/dashboard-data.js`): Contoso works in all four regions,
Fabrikam and Litware in one. Region counts do not change (321 each). Probed
in the live Dashboard: Adventure Works 208, AMER 321, both **64** (was 0). A
filterset is not needed for AND — the View already joins its fields.

The `:4200` server imports the same file for its live feed, so a restart
gives NEW live alerts the new customers. Old rows are not affected.

**The symbiotic part is not built.** Today every option is offered, whatever
the other fields pick (99 calls this PARALLEL). Will's ask, as a design:

- **One helper in the data layer**: the values a field's rows still hold
  under the OTHER answers that limit it. 99 (serial) and 110 (AND rows) use
  the same helper.
- **Both ways** in the View: Customer limits Region, and Region limits
  Customer — each field is limited by every other View field.
- **Trickle down**: a component's fields offer only the values in the rows
  the View leaves.
- **Configurable**: an app setting first — Settings › Application, "Limit
  filter options to matching rows", off by default, so nothing changes until
  it is on. Later a filterset (99) can set it per group.
- **A pick already made stays ticked** — 99's Q3, my pick A.

**❓ Waits on 110's choice:** a limited-out value is **hidden** (110 A, my
pick) or **shown but not pickable** (110 B). Today's rule is "never drop a
value" (`T-unavailable-value-sorts-below-a-divider`); "limit the options"
breaks it for a limited field, so it is your call. Answer 110 and I build
this.

**✅ Will, 2026-10-01: B** (on 110) — a limited-out value is shown, greyed
out, and cannot be picked. To build.

**✅ Built 2026-10-01 — "Limit filter options".** Settings › Application ›
Filtering has a new switch, off by default. On, every list filter offers only
the values the rows still hold under the OTHER filters in its scope: Customer
limits Region and Region limits Customer, and the View limits a component's
filters (the trickle down). A ruled-out value stays in its place, greyed, and
cannot be picked — in a toolbar chip's menu, a grid heading's menu, and the
panel's value chips. Its tooltip says "No matches with your other filters."
(176). The data layer answers it: `source.present(scope)`, once per applied
Query, told to each control as `drawPresent`. Probed on the Dashboard: with
Customer = Adventure Works, Latin America is greyed.
`T-a-ruled-out-value-is-greyed`

**✅ Closed 2026-10-01.** Every part Will asked for is built: the AND logic
checked, the data fixed, both-ways limiting, the trickle down, the setting
(Settings, and the ⋮ menus — 178), a later answer setting an earlier pick
aside (180), and legends (179). Grouping fields into a FILTERSET is 99, which
still waits on its two choices.

### `[x]` ✅ 180 — A picked value a later filter rules out goes inactive and leaves the query

Will, 2026-10-01: *"If a filter is active but a subsequent filterset filter
makes it unviable (e.g. Customer A is selected but made unviable by Region C
being activated) then the unviable filter needs to be made inactive and
ignored in the query."*

And: *"The previous scenario becomes possible if Customer B makes Region C
viable again and selectable even if Customer A made it unviable."*

So: Customer A and B picked; B makes Region C viable; the reader picks C; A
has no C rows, so A goes inactive and the query ignores it. B stays. This
replaces 174's first rule that a picked value always stays in force.

**✅ Done 2026-10-01.** With "Limit filter options" on, the LATER answer wins.
On the Dashboard: Adventure Works and Contoso picked, then Latin America —
Adventure Works stays ticked, greyed, and says "Not applied: no matches with
your other filters."; the Alerts tile counts Contoso's Latin America alerts
alone. Untick it, or let Latin America go, and it is back. The reader's
picks stay in the Query (a saved View keeps them); only the filter leaves the
set-aside value out. A chip whose every pick is set aside is greyed too.
Works in the header's menus, the panel's chips and the grid headings.
`T-a-later-answer-sets-an-earlier-pick-aside`

### `[x]` ✅ 179 — Every place a ruled-out value shows is inactive — a legend item too

Will, 2026-10-01: *"Finally, we need to make other representations of
non-viable filter options to inactive in the view. Legend items are a good
example. It can be inactive in the panel but toggleable in the data viz
legend. This might be the only edge case we haven't covered, actually."*

**✅ Done 2026-10-01.** A chart legend greys a value the other filters rule
out, says why on hover ("No matches with your other filters."), and refuses
a press. On the Dashboard, Customer = Fabrikam greys CPU in the bar chart's
legend. Every place a value shows now follows the same rule: a toolbar chip's
menu, a grid heading's menu, the panel's chips, and a legend.

Will, 2026-10-01: *"Inactive legends and menu items need a tooltip explainer
about limited filters."* Done the same day: a greyed value says, on hover,
"Limited by your other filters: no matches." — a legend item, a menu row and
a chip alike; a set-aside pick says "Limited by your other filters: not
applied." (The words before were "No matches with your other filters.")

### `[x]` ✅ 182 — The filter panel's search: more room above it, and full width

Will, 2026-10-01, a todo: *"Gap above search input in filter panel is too
small. Search input should span the width of the header, excluding header
padding. Right now it's inset on the left."*

**✅ Done 2026-10-01.** The search row spans the whole header, under its icon
too — 8 px in from each edge, the header's own padding — with 8 px above it
(it was 4). Done in the panel's CSS, through the header's `metadata` part, so
other headers are unchanged.

### `[x]` ✅ 181 — A saved filter's menu shows its condition rows, read-only

Will, 2026-10-01, a todo: *"The preset/saved filter menus should show the
condition input rows, in read only mode, rather than just text labels.*

*This means we can use the same advanced menu logic and styling for these
menus rather than a bespoke menu solution."*

**Found, 2026-10-01.** The parts exist: `sherpa-menu` already draws IN THE
FLOW (`data-inline`) and READ-ONLY (`data-readonly`). So a saved filter's menu
can show one inline, read-only Advanced menu per field — its condition rows,
under the field's name — built by `menuFor()` as every other filter menu is.
A Simple answer shows as its rows ("is EMEA" OR "is APAC").

**❓ One choice — how a reader's own saved filter is changed:**
- **A (my pick): Edit filter makes those rows editable, in place,** with
  Save filter and Discard changes below — today's per-line drill into a
  second editor goes. One menu, the Advanced menu's own logic.
- **B: keep today's editor:** a field's rows, pressed, open its editor, as a
  line does now.

**✅ Will, 2026-10-01: A.**

**✅ Done 2026-10-01.** A saved filter's card shows each field's OWN menu,
read-only: its condition rows, or a date's calendar. A field the control has
no definition for stays a line of words. Edit filter keeps the card open and
makes the rows editable where they are; Save filter and Discard changes show
in place of Edit and Delete. The change is sent once, when the card closes,
Save filter is pressed, or the bar or panel rebuilds. The bar and the panel
share one helper, `src/core/ui/saved-filter-menu.ts`. The old per-line editor,
`unpackFilter` and the panel's `filter-edit` are gone. A folded saved chip
shows its card at the Filters button. `T-a-saved-chip-lists-its-conditions`
`T-a-saved-filter-keeps-its-edit` `T-a-nested-menu-answers-for-itself`
`T-an-action-row-can-keep-its-menu-open`

### `[x]` ✅ 186 — Saved filter card: six small choices left from 181

Each is built the first way. Say the word to change one.

1. **Closing the card while editing** (click away, Escape) — **A (built):**
   keeps the change, unsaved, and the chip shows it. **B:** Escape throws it
   away; only a click away keeps it.
2. **When the rows on screen follow an edit** — **A (built):** when editing
   ends. **B:** live, as each row changes (the panel would first need to stop
   redrawing every scope on each change).
3. **Unpack is gone** — putting a saved filter's answer back into its field
   chips. Edit filter now shows the rows in place. **A (built):** gone.
   **B:** bring it back as its own row, "Put back into fields".
4. **Read-only rows still show their select carets and a dead row ×**, as the
   grid's held heading does. **A (built):** leave them. **B:** hide them when
   read-only (this changes the grid's heading too).
5. **Limit matching filters does not grey values inside a saved filter's
   rows.** **A (built):** no. **B:** grey them as a chip's menu does.
6. **A saved date shows its whole calendar**, so the card is tall. **A
   (built):** the calendar. **B:** a line of words until Edit filter.

And: a field the control has no definition for stays words, read-only even
while editing, and is reported (`unknown-filter`). The source could hand its
definitions over in `describe()` if that should change.

**✅ Will, 2026-10-12 — all my picks:** A for all six, as built.

**✅ Closed 2026-10-13** by that ruling: nothing to change.

### `[x]` ✅ 178 — An overflow menu in the filter panel's header, with "Limit matching filters"

Will, 2026-10-01: *"Add an ellipsis overflow menu button to the top of the
filter panel header, after the toggle toolbar button.*

*Other header buttons reflow into the menu of this button. Similar to the
filter toolbard overflow button.*

*Add a single menu item to this button, by default, to toggle the 'Limit
matching filters' capability.*

*This menu item should be in the filter toolbar overflow button's menu
also."*

**✅ Done 2026-10-01.** The filter panel's header has a ⋮ after the toggle
toolbar button. When the panel is narrow (≤ 380px) Reset and Reset all to
default fold into it, and so do the host's own buttons when they fold. Both
the panel's ⋮ and the toolbar's ⋮ end in a check row, "Limit matching
filters"; the bar's ⋮ now shows at any width while the provider offers it.
Ticking it in either place turns the setting on or off for the whole page —
the provider owns it, and the Demos app keeps it in its session, beside the
Settings switch (renamed "Limit matching filters" to match).
`T-the-more-menu-holds-what-folded`

### `[x]` ✅ 205 — "Hide unmatching filters", and "Limit to matching filters"

Will, 2026-10-12: *"In the filter panel and toolbar overflow menus, when
'Limit matching filters' is enabled, show a menu item to toggle 'Hide
unmatching filters'. Rename 'Limit matching filters' to 'Limit to matching
filters'."*

- The rename: the label is in the panel's and the toolbar's `.html` and
  `.ts`, and in Sherpa Demos' Settings page, `index.html`, `settings.js` and
  `reforged-limit-options.spec.ts`.
- The new row shows in both ⋮ menus only while Limit is on. Like Limit, the
  provider owns it, so ticking it in either menu changes the whole page, and
  Demos keeps it in its session.
- What it hides: the values the other answers rule out, which are greyed today
  (`T-a-ruled-out-value-is-greyed`). A ruled-out value that is still PICKED
  stays shown, greyed (180), so the reader can untick it. This also answers
  174's old question, hidden or greyed: greyed by default, hidden on request.

**✅ Done 2026-10-13.** `openMore()` draws the Hide row under Limit while
Limit is on; `switchesOf()` reads both. A bar or panel emits
`hide-unmatched-change`, and the provider's `hideUnmatched` writes
`data-hide-unmatched` on each. A menu with `data-hide-unavailable` marks a
ruled-out row `data-removed`; the panel hides a ruled-out value chip. A picked
value stays. Demos keeps it at `/filters/hideUnmatched`, and the label is
"Limit to matching filters" everywhere.

### `[x]` ✅ 176 — A greyed-out chip says WHY in its tooltip

Will, 2026-10-01: *"If a chip is greyed out (inactive) then it's tooltip
should explain why in a few simple words."*

Builds with 174 (a value the other answers rule out) and covers every greyed
chip: one the View took (superseded), one that is disabled.

**✅ Done 2026-10-01.** A ruled-out value says "No matches with your other
filters." — on a chip's tooltip, and on a menu row for a screen reader. A
disabled chip says "Not available here." A chip the View took already said
where its filter went ("Filter moved to View scope."), so it is unchanged.

### `[x]` ✅ 173 — BUG: a panel section header's count adds its values' counts

Will, 2026-10-01: *"To investigate: The total count badge, in filter panel
section headers, totals the count from each active filter value in that
section. However this should be the total number of unique results across
all active filter values."*

And, the same day: *"Active filter value counts should be showing the total
number of matches for that filter value. I think this is the case but I want
to validate in light of the section total investigation."*

**✅ Done 2026-10-01 — no bug; both counts were right.** The header asks the
store ONE question, "rows that match any of these values", so each row counts
once. It looks like a sum because a row holds ONE value of a field: an EMEA
row is never also an APAC row, so `27 EMEA` + `29 APAC` = `REGION 56`, and
56 is the unique count too. Where rows CAN overlap — two Advanced conditions
that match the same row — the header counts that row once: the new test has
two rows that match both conditions, and the header says 2, not 4.

Each value chip is the rows that ONE value matches, within what its scope can
see (for a component scope, inside the View's filter). It is not narrowed by
the field's other values, or by the scope's other fields — that is 174.
`test/unit/a-field-counts-unique-rows.test.mjs`

### `[x]` ✅ 172 — In the filter panel, each value chip shows its own count

Will, 2026-09-30: *"For multi value filters in the filter panel each chip
should show their own count badge."*

Until now a value chip had no count: the field's header carries the field's
count (133), and 130 noted "a count per value is not asked for". Now it is.

**✅ Done 2026-09-30.** Each PICKED chip shows the rows its one value
matches: with EMEA and APAC picked, `27 EMEA`, `29 APAC`, and the header
still says `REGION 56`. A chart's own chips do the same. A chip that is not
picked shows no number — the same rule as a saved filter that is off (166).

**❓ One choice, if you want it:** a number on EVERY value, picked or not
(what picking it would give). I built picked-only: it matches 166, and it
asks the store once per picked value, not once per value of every field.

### `[x]` ✅ 171 — The filter panel's search matches field labels too

Will, 2026-09-30: *"Search in the filter panel should search field labels as
well as value labels."*

**✅ Done 2026-09-30.** A field whose name matches shows whole, with every
value of it: `own` shows Owner with Dana and Ravi. A section heading counts
too (`preset` shows every preset). A value still matches on its own, and
keeps its field's label. One fix on the way: a field with a body of its own
— a number — had no chips to match, so any search hid it, and it stayed
hidden when the box was emptied. It is found by its name now, and comes back.

### `[x]` ✅ 154 — A data viz section in the filter panel has a chart icon

Will, 2026-09-30, a minor one: *"An accordion for data viz filters, in the
filter panel, should have a chart icon."*

**✅ Done 2026-09-30.** A chart's section wears `reports` — three bars. It is
the one chart glyph in the icon set now; the others near it are `gauge`,
`dashboard` (four squares) and `insights` (a light bulb). If you draw a chart
glyph in Figma (115), it is one word to change in `SHOWS_ICON`.

### `[x]` ✅ 115 — Figma: a chart glyph and a table glyph for the panel's section icons

Found building 97, 2026-09-29: Figma's Icons section (`17:3931`) has neither,
and nothing else in the file does. **❓ Will:** add a chart glyph — and a
table glyph, if `table-columns` is not the one you want for a grid — then
`npm run icons`, and one line each in `SHOWS_ICON`
(`sherpa-filter-panel.ts`).

**✅ Will, 2026-10-12 — all my picks:** B — keep the stand-ins: `reports` for charts, `table-columns` for grids.

**✅ Closed 2026-10-13** by that ruling: `SHOWS_ICON` already draws the stand-ins.

### `[x]` ✅ 60 — Once applied, a chip's badge shows the number of results

Will, 2026-09-26: when a filter change is APPLIED and its results are fetched,
the chip's badge shows the NUMBER OF RESULTS. It replaces what the badge says
today — a count of picks, or `fx` (`T-a-condition-badge-says-that-not-which`,
which changes with it) — and it replaces Will's first ask, a count of
conditions (the tip says that now). The picks stay in the tip.

**Decided, Will 2026-09-26: the rows THIS chip's own answer matches** — not
the whole filter's total, which would put one number on every chip. Counted
out of what the chip's scope can see: a component chip counts within the
rows the View already allows. A pending chip (46) has no results yet, so it
shows no number until Apply. Read the count from the source
(`debugState().total` is the measure; the pager reports pages only).

**✅ Done 2026-09-29.** `source.results(scope)` counts, from the APPLIED
Query, the rows each answered field or saved filter matches — within the
View's rows for a component scope — with `store.totalCount()`; after every
load it draws them onto each scope-bound bar (`drawResults`), and the bar
hands each chip its `results`. The badge shows it only while the chip is on
and not pending, in the reader's digits (`1,234`); the picks count and `fx`
are gone from the chip (a grid heading keeps its `fx` glyph). The picks stay
in the tip, and now also reach a screen reader as the button's
`aria-description`. On Records › At risk (13 rows): At risk 27, Status 75,
Tickets 75. Not drawn: a bar bound with no scope, and the panel's values.
`T-a-chip-counts-its-own-results`

### `[x]` ✅ 49 — A preset Advanced chip shows its conditions, read-only

A PRESET Advanced chip (a saved filter the app ships) gets the `fx` button
in the Success look. It opens a menu of its condition rows, read-only. It sits
on the chip in the toolbar, in the section header in the panel, and on a column
heading — only those three. Everywhere else a filter changes mode with the
Advanced switch (done 2026-09-26).

**Later, with 50:** Success is the look of a WORKING condition. Warning and
critical are free for a condition that cannot apply, or a filter that failed
to — Will's note, not asked for yet.

**❓ Will, 2026-09-29 — one choice.** A preset can span TWO fields (a test's
"Risky and unowned": Health < 60 AND Owner = Unassigned), but a menu's
condition rows belong to ONE field — they have no field column. The shipped
presets on Records are one field each.

- **A (my pick): one read-only menu, a heading per field** with its rows
  under it (`HEALTH` · Less than 60; `OWNER` · Equals Unassigned). One click
  shows the whole preset. The menu learns to stack a field's rows under a
  heading — 50 then edits the same shape.
- **B: the `fx` menu lists the preset's fields**, and a field's row drills
  into that field's own rows (as the Filters menu drills into a chip). No new
  menu shape; two clicks to read a two-field preset.

**Will, 2026-09-30:** *"Any preset or saved filter chip should have a menu
button to show a menu with the conditions applied."* So: EVERY preset and
saved filter chip, not only the Advanced ones, and a MENU button (the chip's
own ▾), not an `fx` button. The A / B choice above — how a two-field filter
reads in one menu — is still open; I will build A unless you say B.

**✅ Done 2026-09-30, as A.** Every preset and saved filter chip has the ▾
now, on a bar and in the panel. Its menu lists the conditions, read-only,
with a heading per field: `HEALTH` · Less than 60, `OWNER` · Equals
Unassigned. A reader's own saved filter keeps Edit filter and Delete filter
under the lines. The chip is still a toggle: its body switches it. The
source makes the words, so a field has its real name. Not built: the `fx`
button on a column heading — Will's later words ask for chips only.

### `[x]` ✅ 50 — A reader's saved Advanced chip shows its conditions, editable

The same `fx` button, with rows that can be edited. On a filter the reader SAVED
that is applied, an edit is a temporary DRAFT; the saved filter does not
change. When the draft differs, the menu and the panel section header offer
Save. Needs 49, and 46's pending look for the draft.

**✅ Done 2026-09-30.** On a reader's own saved chip, each line in its ▾ menu
now opens that field in the field's own menu, holding what the filter
applies. Apply is the change. The rows follow at once; what is saved does
not. The chip wears the pending look (46) and keeps its count, and its menu
adds **Save filter** (the page's name dialog, its own name offered) and
**Discard changes**. Bar and panel alike. The change lives in the Query, so
a reload keeps it. A shipped preset still only lists its lines.
`T-a-saved-filter-keeps-its-edit`

Two things differ from the words above:

- **No Save in the panel section's header.** 117 ruled that a scope's
  header holds nothing to press. Save is in the chip's menu.
- **Edit filter stays.** It still unpacks the filter into its fields — the
  only way to ADD a field to a saved filter. Say if it should go.

### `[x]` ✅ 48 — A child menu opens on hover or click of its parent row

Not from a caret button nested in the row: the whole row is the door, as in an
OS menu. The panel's drill is click-only on purpose (a passing pointer drilled
the list away), so give hover a short delay, or rule per host.

**✅ Done 2026-09-29.** In `sherpa-menu`, so every host has it: a click
anywhere on the row but its tick box, a pointer that RESTS on it for 500 ms,
or ArrowRight opens its child menu (ArrowLeft goes back). A pointer passing
over opens nothing, and a touch never hovers; the box still ticks and opens
nothing. The caret stays, as the mark and a focus target.
`T-a-row-opens-its-child-menu`

### `[x]` ✅ 21c — A condition's matches must ALL highlight

Will, 2026-09-24: *"there will be multiple strings to match and highlight. Not
just one."*

`.cell mark.match` marks ONE substring. `filterNeedles` keeps one needle per
field (`store.ts:255`, `seen.has(field)`), and the grid marks one hit
(`sherpa-data-grid.ts` `markNeedle`). A field answered by
`Contains "ab" or Starts with "R"` has two strings; a three-row chain has
three. The mark is already Success green, matching the chip
(`T-a-conditioned-chip-reads-as-active`), so only the FINDING changes.

**✅ Done 2026-09-29.** `filterNeedles` keeps every substring clause (an
identical one once); `markNeedles` (replacing `markNeedle`) marks each hit of
each — a `contains` every time, a `startswith` at the start and an `endswith`
at the end — joining hits that overlap or touch; the grid passes all of a
field's rows, not the first. `T-a-condition-marks-every-match`

### `[x]` ✅ 21f — "Send to view filters"

Will, 2026-09-24:

> Add an option to 'Send to view filters' for local scope filters. This will
> elevate them from their component toolbar to the app-header toolbar and allow
> it trickle down across all view components/data. Include this next to clear
> and remove buttons in the panel.

A third action in a data-scope field's header, beside Clear. `source.move()`
is the one call that does the promotion, and the header's `filter-add`
already uses it. The values travel with the field — a field promoted while
filtering by `active` keeps that. Promoting Status must not give the header
TWO Status chips: the move consumes the header's available entry.

The reverse trip is not asked for. Leave it until it is.

**✅ Done 2026-09-29.** An `arrow-up` button, "Send Status to view filters",
beside Clear on a component scope's field (Remove is gone from the panel
since; the View's own fields have none). It sends the panel's ordinary
`filter-add-request` with the View's scope — `source.move()` is not needed:
holding it in the View carries the answer and leaves the chip below
suspended. On Records › At risk: Status goes up with "not churned", the rows
stay 13, and the header has one Status chip. `T-send-to-view-filters`

### `[x]` ✅ 21b — Which header chips carry over between views

Will, 2026-09-24:

> App header filters shouldn't carry over between preset or custom views unless
> already set in the initial view definition. The View chip is obviously a
> different scenario altogether. Which chips carry over should be CONFIGURABLE
> though, in case we do want to persist things like Customer and Region later.

A chip def gains one flag, two answers: reset on a view change (the default),
or SURVIVE it. The View chip is neither; it IS the thing that changed. **The
default is built** (56, 2026-09-26): `onViewPicked` resets the reporting bar
before a view applies (`T-a-view-change-resets-the-header-chips`). What is
left is the flag: `clearAll()` skips a chip that SURVIVES, and its part stays
applied through `setState`, which clears every part today.

**✅ Done 2026-09-29.** The flag is `carryOver: true` on a field (its
declaration, so the page JSON takes it — the schema knows it). A JSON View
(`setQuery`, `holds: 'keep'`) keeps a carry-over field's answer unless it
answers the field itself; an old snapshot View keeps it too (`clearAll({
carry: true })`, and `setState` keeps its reading). Plain Reset and a restore
still clear it. **Nothing on Records carries over yet** — say which fields
(Customer and Region were your example), and it is one line each in
`records.json`. `T-a-field-can-carry-over-views`

### `[x]` ✅ 20b — The Date filter should be a view-scope date RANGE

Will, 2026-09-23: a top-level date range that slices the records across the
whole view. It is at view scope now — "Date", over `source.timeField`
(cae7e964) — but still `kind: 'date'`, single by default with a Range switch,
over a list of `availableDates` — the days the records carry (`declareFromRows`).

A VIEW-scope date wants range by default; a component-scope one keeps single,
where one day is the common case. Settle whether `kind: 'date'` gains a range
variant or the chip takes the menu's `data-range`. A range wants bounds —
`dates[0]` and `dates.at(-1)` — not a set of days.

**✅ Done 2026-09-29.** Settled: the chip takes the menu's range — no new
kind. `describe(VIEW)` marks a date field `range: true`, so the header's Date
opens with its Range on; a component's date stays one day. In range mode the
calendar takes only its BOUNDS from `data-available` (the first and last days
with records), so an empty day between can be an end. On Records: a range
over 2024-01-02 to 2024-12-11. `T-a-range-is-bounded-by-the-data`

### `[x]` ✅ 21d — EXPLORE: conditions for a DATE field

Will, 2026-09-24. **Design before code.** A date is not a string, and the text
ops say nothing about one:

| condition | takes |
|---|---|
| On | a date |
| Before / After | a date **and** a time |
| Between | two dates **and** two times |
| Last X / Next X | a DURATION — `7 days`, `3 months` |
| Includes | a toggle per weekday? |

Will: *"Much more complicated than current conditional filters."* A row shows
ONE control per `OP_TAKES` answer (`list`, `text`, `range`); these want a
calendar, a time (no control exists), two of each, or a number-and-unit. And
`Includes` may be a second axis, not a condition. `OPS_FOR_TYPE['date']` is
`[]` on purpose today; this item reopens that.

**Design, 2026-09-29 — for Will's review.** Found first: a clause is data,
`[field, op, value]`, and most date conditions are ops the store already
answers. Only Last and Next are new — they must stay RELATIVE in a saved
View, or "last 7 days" freezes on the day it was saved. And no time control
is needed: `sherpa-input-text` passes `type` to its `<input>`, so
`type="date"` and `type="time"` are the platform's own pickers.

| condition | in the query | the row shows | saved as |
|---|---|---|---|
| On | `between` the day's start and end | a date | `"2026-09-03"` |
| Before | `lt` | a date, and a time | `"2026-09-03"` or `"2026-09-03T14:00"` |
| After | `gt` | a date, and a time | as Before |
| Between | `between` | two dates, two times | `["…", "…"]` |
| In the last N | `within`, turned into `between` when the Query is built | a number and a unit (days, weeks, months) | `{ "last": 7, "unit": "day" }` |
| In the next N | as Last, forward | as Last | `{ "next": 3, "unit": "month" }` |

- **Simple stays the calendar** (a day, or a range) — only Advanced gains
  these rows, on 102's two kept answers.
- **`OP_TAKES` gains `date`, `dates` and `duration`** beside `list`, `text`
  and `range`: each a `<template>` in the menu's condition row, composed from
  `sherpa-input-text` and `sherpa-select`.
- **Days are UTC**, as `formatDate` reads them (`T-a-date-reads-one-way`); a
  relative date is worked out once per load, with `Temporal` where the
  browser has it.
- **The chip's face** reads `Created: last 7 days`, `Created: before 03 Sep
  2026`, through `formatDate`.
- **Build after 20b** (the ledger's rule) and with 90.

**❓ Will — two choices.**

- **Includes (a weekday):**
  - **A (my pick): not now.** It is a second axis — the weekday OF a date —
    so it is a derived field a set filter answers, its own later item.
  - **B: a condition** with seven day toggles in the row.
- **The time input:**
  - **A (my pick): only where the field holds a time** —
    `declareField(f, { type: 'date', time: true })`. Records' `created` holds
    days (`2024-07-01`), so it shows none.
  - **B: always**, and a blank time means the day's start or end.

**✅ Will, 2026-10-12 — all my picks:** A and A — no weekday condition now; a time input only where the field holds a time.

**✅ Built 2026-10-13, in 90** — its three steps are there. `T-a-relative-date-stays-relative`

### `[x]` ✅ 107 — A filter can apply LIVE, debounced — an opt-in; the default stays once per act

Will, 2026-09-29, choosing A of "once per act" / "live while dragging, with a
debounce": *"A but save it as a configurable option to support later. Apps
with large datasets in the data layer will probably thank us."*

The default does not change: a filter applies once per act — a handle let go,
Enter, leaving a field, a tick. The OPTION applies while the reader is still
moving, and waits a set time after the last move before it asks the data
again.

A place to start: components stay reporters — they already send `input`
while a value moves and `change` when it settles. The SOURCE owns the rule
(`applyOn: 'change' | 'input'`, `debounce` in ms), so one app can choose per
source, and a large or remote dataset keeps the default. Settle: per source,
per field, or both; and whether a remote source may choose live at all.

**❓ Will, 2026-09-29 — two choices** (it is an option "to support later", so
it waits on these rather than guess). How it would work: the source sets
`data-apply-on="input"` on what it binds, as it sets `data-remote`; a menu
then reports while a value moves, and the source waits `debounce` ms after
the last report before it loads.

- **Chosen for:**
  - **A (my pick): per source** — one line in the page JSON,
    `"source": { "applyOn": "input", "debounce": 300 }`.
  - **B: per source AND per field** — a slow field can stay on Apply.
- **A remote source:**
  - **A (my pick): stays on Apply** — live would send a request per pause,
    and remote already waits for Apply by design.
  - **B: may choose live too**, with the debounce.

**✅ Will, 2026-10-12 — all my picks:** A and A — set per source; a remote source always stays on Apply.

**✅ Done 2026-10-13.** `new DataSource({ applyOn: 'input', debounce })`, or
`"applyOn": "input"` in the page JSON's source (schema too). `source.applyOn`
is `'change'` for a remote source, whatever was asked. A live filter change
loads `debounce` ms (default 300) after the last one; everything else still
coalesces on the tick. The binder writes `data-apply-on="input"` on a scope's
control; bar, panel and grid pass `live` to `menuFor()`, so a number menu does
not wait for Apply and its body reports on `input`. A panel's CARD menus keep
committing (`T-a-chip-menu-in-the-panel-commits`); only its inline bodies go
live.

### `[x]` ✅ 52 — A data viz scope in the filter panel

A legend toggle IS a filter (42, done: `only` narrows one component), so a chart could have its own component
scope in the panel. It may want chips for its AXES or its AGGREGATION, the way
the grid has Group and Sort. Larger; design first. After 42, and after 38
step 3, which puts scopes in the data layer.

**Design, 2026-09-29 — for Will's review** (42 and 38 step 3 are done).
Found: most of it exists. A scope with `narrows: ["bar"]` already filters one
component alone, and a legend's toggles already narrow their chart (42). A
chart says what it summarises in attributes — `data-segment-field`,
`data-aggregate` + `data-field`, `data-over-field` + `data-bucket` — which the
provider reads into its summary.

- **The scope:** a chart's own scope in the page JSON, `narrows` its id. The
  panel draws it as a section with the chart icon (97; the glyph is 115).
  Its filters narrow the chart alone; the legend's field is one of them.
- **Its arranging chips**, as Group and Sort are a grid's: **Segment by** (a
  field), **Measure** (Count, or Sum / Mean / Min / Max of a number field),
  **Over** (a date field, by day, month or year) — each only where the chart
  has that axis (a bar or donut segments, a line runs over).
- **Who owns them:** the chart REPORTS; the provider writes its attributes.
- **Build after** 99's drawing (a set can hold them, as Organise holds Group
  and Sort) and ruling 4's per-scope arrangement.

**❓ Will — two choices.**

- **Where a chart's arrangement is kept:**
  - **A (my pick): in the Query, per scope** — as sort and group are
    (ruling 4). A saved View keeps "segmented by OS", and a reload too.
  - **B: on the chart only** — the panel steers its attributes, and a View
    does not remember them.
- **Which chips first:**
  - **A (my pick): all three** — Segment by, Measure, Over — each where the
    chart has that axis.
  - **B: Segment by only**, and the rest when asked.

**✅ Ruled, Will 2026-09-30 — a first, small shape. Do it after 130.** *"I
think it would be really neat to see the data viz component scopes in the
filter panel. I'd expect them between the view and grid scope accordions.
They will only have 1 filter section. Each is just a Simple filter with a
chip per legend item (might be nice to include the swatch where the left icon
usually is). I don't think Advanced filters make sense for chart data just
yet. As per previously established rules, component scope filters don't
affect other component scopes. Filters should be elevated to view scope to
achieve that."*

So, for now: no arranging chips (Segment by, Measure, Over) and no Advanced —
the two choices above wait. One section per chart, between the View's and the
grid's, holding ONE Simple filter: the legend's field, a chip per legend
item, with its swatch.

**And a thought of Will's, the same day:** *"legend items could just be a
boolean filter chip variant. It's just style differences and a swatch instead
of an icon. Functionally they are the same. That keeps all representation of
simple filters using filter chips of some kind. This could lead to cleaner,
consolidated, code, too."* So the panel's chip and the legend's item should be
ONE chip, with a swatch — build the panel's that way, and then look at moving
`sherpa-chart-legend` onto it.

**✅ Done 2026-09-30 — the first, small shape.** Each chart with a legend has
a section in the panel, after the View's and before the grid's, named as its
card is ("Alerts by category"). It holds ONE filter: the legend's field, a
chip per legend item, each with its swatch — the same colour the chart
paints. No Advanced, no Filters button, no Save.

- **One answer, two views.** A chip and the legend's item are the same
  answer: press either and the other follows. It narrows that chart ALONE —
  on Records the grid holds `status` too, and its chips, its rows and the
  other chart do not move.
- **Sent up.** The field's ↑ sends the answer to the View filters: every
  component narrows, and the chart's section says where the filter went.
  Take the field off the View and the chart's chips come back.
- **The chip.** `sherpa-quick-filter` takes `data-swatch="<series>"`: it leads
  with that series' swatch where its icon goes.
- **The data layer.** `source.declarePart(scope, { field, only, label })` —
  the provider declares it for each legend — and `describe(scope)` gives the
  panel the one filter. The dashboard's JSON names the three fields
  (Category, OS, Severity).

Two things to know. A panel shows EVERY value; the legend folds the seventh
and later into "Other". And with no chip on, every series shows — so the
panel's chips all read off where the legend's items all read on. That is how
every filter chip reads; 149 is where the two become one control.
`T-a-chart-scope-is-its-legend-field`

The arranging chips (Segment by, Measure, Over) and the two choices above
still wait.

### `[x]` ✅ 159 — A data viz filter in the View scope: a legend click changes the View's values

Will, 2026-09-30: *"When a data viz filter is added to the view scope then
clicking on a legend item should adjust values at the view scope as well as
toggling the legend item active state."*

Today a legend always writes its chart's OWN scope, even while the View holds
the field — so the two can disagree.

**✅ Done 2026-09-30.** While the View holds a chart's field, its legend
shows the View's answer, and a press on a legend item changes the View's
values. So the View's chips follow, and EVERY component narrows — the item
toggles as it did. When the View lets go of the field, the legend answers for
its own chart again. The chart keeps no answer of its own while the View
holds the field: two answers to one field, one of them hidden, was the fault.
`T-a-legend-follows-the-view-when-it-holds-the-field`

### `[x]` ✅ 149 — A chart legend's items ARE swatch chips

Will, 2026-09-30 (with 52): *"legend items could just be a boolean filter
chip variant. It's just style differences and a swatch instead of an icon.
Functionaly they are the same. That keeps all representation of simple
filters using filter chips of some kind. This could lead to cleaner,
consolidated, code, too."*

The chip has its swatch now (52), so the panel's half is done. What is left
is `sherpa-chart-legend` itself: draw each item as a `sherpa-quick-filter
data-swatch`. Four things a legend item has that a chip does not, to settle
when it is built:

- its VALUE (the count at the right, in a shared column);
- the "Other" roll-up row and its menu;
- read-only mode (a gauge's zones: a key, not a filter);
- "every item on" as the rest state, where a chip's is "every chip off".

**Plan, 2026-09-30** (a second agent read the code; nothing built yet).

- The legend COMPOSES one `sherpa-quick-filter` per item, in its own
  template. It keeps the layout (the value column, the 3-by-2 grid), the
  "Other" roll-up and its menu, its off-set, `legend-item-click`,
  `populate` — so charts, the provider and the gauge change nothing. The
  other way — no legend, a chart slots a run of chips — moves all of that
  into four charts for no gain.
- The chip needs: a `key` kind (no border, mono 12px, 16px tall, its label
  truncates); `data-readonly` (a gauge's key: not a control); a STATUS
  swatch (a gauge's zones); and `aria-pressed` on a boolean chip, which no
  chip sets today — a real gap for the panel's chips too.
- The VALUE stays the legend's own cell beside the chip, so the column still
  lines up. A click on the number then does nothing.

**❓ One choice.** A legend chip is ON when its value is SHOWN, and at rest
every one is on. A panel chip is ON when its value is PICKED, and at rest
every one is off. The same value reads the two ways round.
- **A (my pick): leave it.** The legend says what the chart shows; the panel
  says what you picked. Each is true where it is.
- **B:** the legend follows the panel — at rest no chip is on, and all read
  in full ink.

**✅ Will, 2026-10-12 — all my picks:** A — leave each as it is: each is true where it is.

**✅ Done 2026-10-13.** Each legend row is a `sherpa-quick-filter
data-type="key"` (swatch and slotted label), `data-locked`, with the legend's
`.value` beside it. The chip gained the `key` type (no border, mono 12 on 16,
the label truncates), `data-readonly`, a STATUS swatch (`data-swatch` takes a
status name), and `aria-pressed` on every toggle chip — the panel's too. The
legend keeps its layout, roll-up, off-set and `legend-item-click`; the grid is
three tracks now: entry, value, button. Charts, the provider and the gauge
change nothing. `T-a-legend-row-is-a-key-chip`.

### `[x]` ✅ 124 — The Filters button and menu move to the filter panel HEADER

Will, 2026-09-30: *"Let's move the 'Filters' button, and menu, to the filter
panel header. This will consolidate the filter menu for all scopes into 1
menu. We already show the scope for filters in the menu item description so
we can leverage that for all filter menu items. We can still separate Added
and Available filters. Filters will get added to their default scope. It's
then up to the user to move their scope. Filter toolbars still maintain their
own filter buttons and menus."*

**✅ Done 2026-09-30.** One Filters button, in the panel's header, left of
Reset. Its menu lists every scope: Added filters, Available filters, Saved
filters. Each row says its scope under its name. A shut scope's filters lead
the list with a caret each, and the badge counts them, as before.

A filter not held yet is listed ONCE, and is added to its default scope. I
read "default scope" as the scope of the component that offers it (on
Records: Customer records); a field no component offers goes to the View.
You then move it with its ↑. Say if the default must come from the page's
definition (so Region, taken off, would come back in View filters).

Found on the way: a long menu squeezed its rows until a row's description
ran under the next row. A row keeps its height now, and the list scrolls.

### `[x]` ✅ 122 — Email starts SIMPLE; over 20 values it is one chip with a multi-select menu

Will, 2026-09-30: *"The 'Email' filter should be a simple filter, initially,
with the option to switch to advanced. When in simple mode, as it over 20
unique values, then it should show as a filter chip with a multi-select
menu."*

Part of 89 (every panel filter starts Simple) and 90 (any filter switches to
Advanced). Today `email` is declared `"advanced": "only"` in `records.json`.

**Plan, 2026-09-30.** `email` is `"advanced": "only"`, so the source never
reads its values. Changing it to `"advanced": true` collects them; then 89's
line draws it as one chip with a multi-select menu, and the chip menu's f(x)
switches to Advanced. Waits on 89's number.

**✅ Will, 2026-10-12 — all my picks:** Unblocked: 89 rules the line at 16 values.

**✅ Done 2026-10-13:** Sherpa Demos declares Email `"advanced": true`, so its addresses are read; over 16 of them, the panel draws one chip with a multi-select menu, and its f(x) is in that menu (89). A Demos test checks it.

### `[x]` ✅ 120 — A view-scope filter gets "Send to `<scope name>`"

Will, 2026-09-30: *"'Send filter to View' should have a counterpart button in
the view context to 'Send to &componentScopeName' with a down arrow icon."*

The other way of 21f. The name is the scope the field came from.

**✅ Done 2026-09-30.** A View field in the panel has a ↓ button beside
Clear, in the same group: "Send Region to Customer records". The View lets
go of the field, and its answer goes with it — so the rows do not move. The
header bar loses the chip and the grid's bar gets it.

Which scope: every scope that has the field (a grid's, or a chart's own).
With one, the button sends there. With more, it opens a menu and you pick —
the source will not guess (158 added the menu; there was no button before).
On Records that is every View field today: Customer, Region and Date all go
to "Customer records". A field sent up from a chart (52) goes back to that
chart. The button shows from the start, as ↑ does (155).
`T-send-to-view-filters`

### `[x]` ✅ 121 — Clear and Send to are ONE button group

Will, 2026-09-30: *"The 'clear' and 'send to' buttons should be in a button
group with grouping style classes applied."*

**✅ Done 2026-09-30.** In a panel field's header the two are one
`.sherpa-group`: joined, with the inner corners square. The group is by
POSITION, so Clear alone — a View field has nowhere to send to — keeps both
its corners. Send to shows from the start (155); Clear joins it once the
field has an answer. 120's
"Send to `<scope>`" button goes in this group when it is built.

### `[x]` ✅ 123 — An inactive chip KEEPS its match count badge

Will, 2026-09-30: *"Don't hide the match count badge when a filter chip is
set to inactive. Only remove the badge when all values/conditions are removed
from the filter."*

Changes 60, which shows the badge only while the chip is on.

**✅ Done 2026-09-30.** A chip switched off keeps its badge: the rows its
answer WOULD match. Empty it and the badge goes. A chip with a change that
waits for Apply still shows none. The tooltip follows 147: off, it says
nothing.

❓ **One thing to see — saved filters.** A saved filter always holds its
conditions, so by your rule it always shows its count, before it is ever
switched on. On Records the bar now reads `90 Has open tickets`, `27 At
risk`, `15 Unassigned` at rest.

- **A (as built, my pick):** keep it — the number says what the switch will
  give, before the press.
- **B:** a saved filter shows its count only while it is on.

**✅ Ruled, Will 2026-09-30: "A for now."** A saved filter shows its count at
rest. **Then B, the same day (166):** only while it is on.

`T-a-chip-counts-its-own-results`

### `[x]` ✅ 125 — The sort tooltip names the direction as well as the field

Will, 2026-09-30: *"Sort tooltip should show direction (e.g ascending) as well
as the field name."*

**✅ Done 2026-09-30, with 130.** A Sort chip's tip reads `Name, descending`,
on a bar and in the panel. A grid heading's sort button reads `Sort by Name`,
then `Sorted by Name, descending`. `T-a-chip-says-its-own-answer`

### `[x]` ✅ 126 — "Filter applied at higher scope" becomes "Filter moved to `<scope name>` scope"

Will, 2026-09-30: *"Change the 'Filter applied at higher scope' to 'Filter
moved to $scopeName scope'."*

**✅ Done 2026-09-30.** A chip's tooltip and the panel's note say the same
sentence, from one function (`movedTo`): `Filter moved to View scope.` — and
on a chip that still holds picks, `… This chip holds active, churned.` My
pick: the View's heading is "View filters", so the sentence drops "filters"
and says "View scope", not "View filters scope". Will, 2026-09-30: "That's
ok." `T-an-inactive-chip-says-where-its-filter-went`

### `[x]` ✅ 129 — "Reset all to default", with a confirm dialog and "Save filters before reset"

Will, 2026-09-30: *"'Reset to default' in filter toolbars should be renamed to
'Reset all to default'. It should throw a confirmation sherpa dialog informing
the user that it will reset all filters across all scopes to the view default.
Include a simple switch to 'Save filters before reset' that will reveal a text
input that allows the user to name the filter definition. When this save
filters before reset feature is enabled, and a valid name entered, on
confirming reset then the current filter configuration should be saved, using
the provided name, before all filters are reset."*

Builds on 109 (the Reset menu). The save is 105's "every scope under one
name", which still waits on a ruling.

**✅ Done 2026-09-30.** The row reads "Reset all to default" on a bar, in the
panel and in the ⋮ menu. It opens a Sherpa dialog: "This resets every
filter, in every scope, to the View's default", Cancel and Reset all. The
switch "Save filters before reset" shows a Name field. On, with no name,
Reset all stays open and says "Enter a name to save the filters under". With
a name, the filters on screen are saved first, then everything resets, and
the page stays on its own View.

**One thing to know:** the save is a saved VIEW — the View chip lists it
under your own Views, and picking it puts every scope's filters back. It is
the one store that holds every scope under one name today. When you rule on
105 (saved filter sets), the save moves there.

In the library: `view-reset` is cancelable, and `provider.saveView(name,
{ stay: true })` saves without leaving the View on screen. The dialog is the
example app's (`#reset-confirm`, `resetPrompt`), as the Save view dialogs are.

### `[x]` ✅ 133 — The results count badge, at the right of a filter panel section header

Will, 2026-09-30: *"The results count badge should show to the right of the
filter panel section header where appropriate."*

The chip's badge from 60, for a field drawn in the panel with no chip to
carry it.

**✅ Done 2026-09-30.** A panel field drawn as a run of chips, a number body
or Advanced rows shows its results in a badge right of its title: `REGION
27`. It shows once the field has an applied answer — on or off, as 123 — and
goes when the field is emptied or a change waits for Apply. A chart's own
field has one too. A field drawn as ONE chip (a date, Group, Sort) and a
saved filter keep the number on the chip.

Also fixed on the way: a panel redraw (a field added, a filter sent up) lost
every results number until the next load. The panel keeps the last ones now.
`T-a-chip-counts-its-own-results`

### `[x]` ✅ 134 — A number filter menu has Reset, not Clear

Will, 2026-09-30: *"Numeric filter menus have a 'Clear' button but this isn't
appropriate. It should be a reset button that resets inputs and slider handles
to their original values."*

**✅ Done 2026-09-30.** A number menu's footer reads **Reset**, with the ↺
icon. It empties the field and puts both handles back on the bounds — both
shapes, the one in force and the one kept — and the chip goes off at once.
A list menu keeps Clear.

**What I found:** Clear did NOTHING to a number. It looked for the slider
among the menu's slotted children, and the number body lives inside the menu
now. So the button was there and the filter stayed. My reading of "original
values" is where they started — empty, and the handles on the bounds. Cancel
is still the way back to what was last applied.
`T-a-number-is-reset-not-cleared`

### `[x]` ✅ 135 — A calendar's Month and Year views mark what has no date to pick

Will, 2026-09-30: *"In calendars, where the viable selectable dates are
limited, the Month and Year modes should set Months and Year buttons with no
viable selectable dates to inactive, too."*

The day view already does this, from `data-available`, `data-min` and
`data-max`.

**✅ Done 2026-09-30.** A month or a year with no day to pick is drawn
inactive, and a press on it does nothing. One rule answers a day, a month and
a year, so the three views cannot disagree. A RANGE calendar is bounded by the
data, not dotted by it: every month from the first day with records to the
last stays active. With no limit set, every month and year is active, as
before.

### `[x]` ✅ 138 — Advanced filters use the info status styling again

Will, 2026-09-30, a future small one: *"Move advanced filters back to using
the info status styling rather than the success status styling."*

**✅ Done 2026-09-30.** An Advanced chip's edge, ink and `fx` badge are info
blue, on a bar, in the panel and on a grid heading. The text a condition
matched in a grid cell is marked in the same blue, so a reader still follows
one colour from the chip to the cell. One pin changed
(`scripts/figma-data/state-pins.yaml`), and the trap is renamed to match.
`T-a-conditioned-chip-reads-as-active`

### `[x]` ✅ 156 — Advanced filters use the default active styling

Will, 2026-09-30, a minor one: *"Let's use the default active styling for
advanced filters instead of diverging to use the info styling."*

**✅ Done 2026-09-30.** An Advanced chip is active purple, as a Simple chip
is: no state pin and no CSS of its own. The text a condition matched in a
grid cell is marked in the active colour too, so the chip and its matches
still read as one colour. What still tells them apart: the f(x) button is
pressed in the menu and in the panel, and a grid heading shows the f(x)
glyph. This replaces 138's info blue.
`T-a-conditioned-chip-reads-as-active`

### `[x]` ✅ 139 — An Advanced chip's value half shows its values, not the condition labels

Will, 2026-09-30: *"Actually ignore that improvement. The values should be
shown, truncated, but not the condition labels."* (He first asked for the
f(x) icon and the ▾ alone, then took that back.) So `Owner: Starts with: U
or Contains: an` reads `Owner: U, an`, cut short where it is long.

**✅ Done 2026-09-30.** A chip with two or more condition rows shows what each
row answers with — typed text, or the picked values by their labels — joined
by commas: `U, an`. The chip cuts it short as it does any long value. The
tooltip still says `2 conditions applied`. A grid heading's
`column-filter-change` label keeps the full words (`Contains: Da or Starts
with: R`); that is a label for a host, not the chip's face.

### `[x]` ✅ 140 — Every typed Sherpa input shows the Clear button

Will, 2026-09-30, a future one: *"Any sherpa input that I type into, that
isn't a numeric stepper or text area, should show the clear input button like
we do in the sherpa text input."*

Today it is opt-in: `data-clearable` on `sherpa-input-text`.

**✅ Done 2026-09-30.** A text field shows Clear by itself while it holds
something. Not a number (it has steppers), not a text area, not a select,
and not a field that is read-only or disabled. `data-no-clear` turns it off
for one field; `data-clearable` still turns it on for a text area or a
select. The other typed inputs had a Clear already: the nav's search, the
grid's filter row, a menu's search and its condition value. Not done: the
`minimal` variant (a bare inline field, used nowhere in the library or the
examples) — it has no row to hold a button.

### `[x]` ✅ 141 — Advanced is an f(x) icon button, not a switch

Will, 2026-09-30, a minor one to queue: *"Instead of a simple switch for
'advanced' let's go back to a button on the right of the filter panel
section, and toolbar chip menu, header that is icon only, uses the f(x) icon,
and is active when advanced, default when simple."*

**✅ Done 2026-09-30.** The switch and its "Advanced" word are gone. A chip
menu's header and a panel field's header each end in an f(x) icon button,
named "Advanced" (in the panel, "Advanced Owner"). It is pressed — the
active look — in Advanced, and plain in Simple. In the panel it sits after
the Clear and Send to group, and shows before the field has an answer.

**A bug this showed, fixed.** In the panel, the flip to Advanced reported the
field BEFORE its new rows were drawn: "Advanced, no rows". So every row came
back until the next edit. The switch hid it — its own `change` event made a
second, late report. The flip now reports once, when the rows are drawn.
`T-a-filter-menu-has-two-modes` · `T-a-rebuilt-row-reads-empty-for-a-tick`

### `[x]` ✅ 144 — A View's filters survive a View swap: a draft per View

Will, 2026-09-30: *"Filter configurations should survive view swaps during a
session, even if not saved as a definition. We can leverage the definition
functionality to support drafts, per view, for the session. It would be cool,
actually, if they could persist across sessions, too. This will save the user
from absolute headaches on app crashes etc. These should be configurable
options for filtering (on by default) and we should expose toggles in the app
settings nav & content. Potentially something we can do as we work on an
adjacent filtering item."*

Today the session keeps ONE Query per Context, with the View it was made on
(`/filters/records`), and a View pick starts from that View's own filters.
So: keep a draft Query per View; two settings, both on by default — keep
drafts for the session, keep them across sessions — in Settings ›
Application.

**Plan, 2026-09-30** (a second agent read the code; nothing built yet).

- Today: ONE kept Query per page (`/filters/<page>`), tagged with its View,
  and restored only if the View matches. A pick throws it away. It is kept
  in localStorage already, so it outlives the tab.
- A draft per View: a new `src/core/browser/view-drafts.ts` beside the saved
  Views — a map per page, View id → `{ query, sig }`. `sig` is the View's own
  definition as it was; a draft whose `sig` no longer matches is dropped, so
  a changed preset is not hidden by an old draft.
- Written on the same frame-debounced path that keeps the page's Query now,
  and FLUSHED before a pick — the View's id changes only after an async
  write, so a pending frame would save the new View's filters under the old
  name. No draft while the Query is the View's own.
- Read inside the pick, in place of the View's own Query (no flash), and at
  open, so a reload or a link to a View restores its draft. A draft is a
  RESTORE: exact, so it wins over carry-over.
- Cleared by Reset all to default, by Save (the saved View owns them now),
  and by Delete.
- Two switches in Settings › Application, a "Filtering" section, both on:
  keep each View's filters while I switch Views (the tab); keep them across
  sessions. The provider takes them as an option; an app that gives none
  gets no drafts.
- Tests that pin "a fresh View resets" (`reforged-view-chips.spec.ts`) then
  mean "on a first visit".

**✅ Done 2026-09-30, as planned.** Change a filter on a View, go to another
View, come back: your filters are there. A View you never changed opens on
its own filters. Reset all to default, Save and Delete clear a View's draft.
Settings › Application has a new "Filtering" section with two switches, both
on: "Keep each view's filters while I switch views", and "Keep them across
sessions" (a new tab, or a crash). The second is off and greyed while the
first is off. In the library: `provider.open(…, { drafts })`, and
`src/core/browser/view-drafts.ts`.

---

## E — Views and navigation

### `[x]` ✅ 15 — Save a View, and the Save split-button menu

Measured 2026-09-29: `provider.saveView(label)` saves the current View of
ANY page opened from a definition, and puts it on the View chip (D1). Only the
Dashboard calls it (`dashboard.js`, after its name dialog); Records has no
`view-save` handler and no name dialog (G3 in `PROVIDER-DESIGN.md` §10).
`viewOptions` is a flat list.

**Save** writes the current View — layout, content and its WHOLE filter
configuration — to a view definition. **Load** from the View chip's menu, in a
`Custom Views` section at the BOTTOM. **A name clash** in `Presets` or
`Custom Views` appends ` - Copy-001`.

**Labels** (Will, 2026-09-29): `Save view` and `Save view as`. Build with 105,
which needs the same split button, name dialog and overwrite confirm.

**The menu button, right of Save:**

| Option | What it does |
|---|---|
| `Save As` | A dialog. The user edits the View name, then saves or cancels. |
| `Delete View` | Critical style. A dialog asks to confirm. ONLY a custom View. |

**✅ Done 2026-09-29, on every page.** The Save ▾ opens "Save view as" and —
on the reader's own View only, critical — "Delete view". The SHELL answers
the three requests with one name dialog and one confirm (`ask-name.js`:
`namePrompt`, `confirmPrompt`); the Dashboard's own handler and dialog are
gone. The provider: `saveView(name)` saves a new View, a clashing name
getting ` - Copy-001`; `saveView()` saves over the reader's View on screen —
Save on a preset asks for a name; `deleteView()` deletes and goes to the
first View; the bar is marked `data-custom-view`. The View chip lists
`Presets`, then `Custom views` at the bottom. 105 reuses the dialogs.
`T-a-saved-view-is-the-readers-own`

### `[x]` ✅ 17b — At the mobile breakpoint the nav becomes a menu

Not started. At mobile width the rail is GONE and a menu takes its place.

- **The trigger:** a menu button in the App Header, RIGHT of the Context title.
- **The rail:** hidden, and its padding on the header and content goes to `0`.
- **The menu:** fills the viewport; no `Pin`; `Settings` at the BOTTOM; a
  footer `Cancel` that closes it and goes nowhere.
- **A Context row** closes the menu AND navigates.

**Put the nav on the data layer while you are here.** `sherpa-nav` has
`renderData()` but never calls `bind()` — a one-shot draw. Bind it to a Store,
so the rail and the menu are two renderings of one nav model.

**✅ Done 2026-09-29.** At 480 px — the header's own phone width, where its
filters go — the shell hides the rail (by `visibility`, so the menu can come
back) and drops its inset; the header shows a `menu` button right of the
Context title. The menu is the SAME `sherpa-nav`, `openMenu()`ed into the top
layer: the whole screen, open, no Pin, Settings at the bottom, Cancel that
goes nowhere; an Area only opens, a Context row closes it as it goes; Escape
closes it. One element in two presentations, so they cannot disagree — which
meets "one nav model" without a second copy; binding the nav to a Store is
now its own item, 116. **Found on the way:** the header's
`container-type: inline-size scroll-state` was dropped whole by Firefox and
WebKit, so its 480 px rule never ran there — fixed
(`T-a-second-container-type-drops-the-first`). No Figma design exists for
the phone; the look follows the rail's. `T-the-nav-is-a-menu-on-a-phone`

### `[x]` ✅ 116 — `sherpa-nav` binds to a Store: its entries as data, drawn and redrawn

Split from 17b, 2026-09-29. `sherpa-nav` has `renderData()` but is never
bound — the app re-`populate()`s it by hand when Favorites or Recent change.
Bind it to a Store (its sections and entries as rows), so a change to the
data redraws it, as every other data component. The phone menu is the same
element (17b), so it follows for free.

**❓ Will, 2026-09-29 — one choice.** Measured: the app redraws the nav from
three places (Favorites, Recent, the Views-as-rows switch) through ONE
`refreshNav()`, and its only real pain is that a redraw rebuilds every row,
so the app must read back the reader's OPEN Areas first. A Store would mean a
second data source just for the nav, fed from the two session lists.

- **A (my pick): the nav keeps its own open Areas** across a redraw — state
  it owns, as the grid keeps its scroll — and the app's read-back goes. Less
  code, and the one real bug class closes.
- **B: the full Store binding** as written: nav entries as rows in a Store,
  the app writing rows, `bind()` redrawing. More code, and the lists are
  already the data layer's (`SessionList`).

**✅ Will, 2026-10-12 — all my picks:** A — the nav keeps its own open Areas across a redraw.

**✅ Done 2026-10-13.** The nav keeps each Area's open or shut by id: an
open Area stays open across a populate, and an entry's `expanded: true` may
open more. The outlet's read-back of `expandedIds` is gone; it only opens the
Area that holds the page. `expandedIds` stays, as the read-back door.

### `[x]` ✅ 34 — Figma: use the Navigation terms

The code moved to Section / Area / Context / View on 2026-09-24 (CLAUDE.md
"Navigation terms"). Figma still uses the old words. Rename there, then resync:

- App Header: the `View title` layer is the Context title. Code parts are
  `row-context` and `context-icon`.
- Navigation: a parent row is an Area; a leaf row is a Context. A Section is
  the label + divider only.
- Any `Views` section label, or frame named for a page, is a Context.
- Keep `View` only for the View chip and its View group (★ · Save · ▾).
- `sherpa-dialog data-type="overlay"` and `sherpa-app-shell`'s `overlay` slot
  do not exist in Figma yet.
- Navigation: collapsed `nav-layout/width` is pinned to 40px. Bind it to
  `size/3xl` so the closed rail follows density (36 / 40 / 48), then drop the
  override in `sherpa-nav.css`.

Each code-only difference is also in that component's `_divergence` block.

**✅ Done 2026-09-29, in Figma.** App Header (150:3690): `View Details` →
`Context Details`, `view-icon` → `context-icon`, `View title` → `Context
title` (layer names only — no property or variant changed, so nothing in the
specs moved). The Navigation components hold no old word (`hasChildren` is a
property), and the only "View" text on their page is the View chip, which
keeps it. `nav-layout/width` in the collapsed mode is an ALIAS of `size/3xl`
now (it was a raw 40); the export was patched to match
(`{display-mode.size.3xl}`), re-projected, and the code's override and its
`_divergence` note are gone — a test holds 36 / 40 / 48. **Left for you:**
the `overlay` slot and `data-type="overlay"` dialog still have no Figma
design (the shell's `_divergence` says so).

---

### `[x]` ✅ 79 — Nav header: Settings and Pin are one Button group in an Actions slot

Will, 2026-09-27, from Figma: in the Navigation Panel's header the Settings
and Pinning buttons are now GROUPED and use the DEFAULT button style. Settings
takes the Grouping START class, Pinning the Grouping END class — Settings
first, then Pin, the reverse of the code today. Button size is unchanged. The
group is a SLOT called `Actions`, so more buttons can join it later.

Today `sherpa-nav.html` draws both as raw `<button class="hdr-btn …">`. So:
COMPOSE two `sherpa-button`s (never a re-drawn button), wrapped in
`.sherpa-group` (start/end by position), inside a `<slot name="actions">` in
the header — the default content being these two. Resync the nav's spec and
check the pixels against Figma.

**✅ Done 2026-09-29.** Read live from Figma's Navigation Header (1051:7815):
an `Actions` frame, 48 × 24, two 24 px icon Buttons with no gap, Style
default, Structure sm, Grouping start and end — the SAME in every state, so
no pressed look — and the pin glyph is `thumbtack-angle`. The nav now
composes two `sherpa-button`s (Settings `data-group="start"`, then Pin
`end`) in `.actions`, with an `actions` slot after them so more can join;
the raw `.hdr-btn`s, their CSS and their two state pins are gone. A host's
`aria-pressed` now reaches the inner button, as `aria-label` does (the bar's
★ gains it too). The old test that read a 12 px glyph off the host now
measures the button's own sm icon: 14 px, as Figma's Structure collection
projects it.

### `[x]` ✅ 164 — BUG: at the mobile breakpoint the app header shows no nav hamburger

Will, 2026-09-30: *"The breakpoint for mobile mode isn't wide enough. Also at
the mobile breakpoint the nav hamburger menu appears but the collapsed nav
sidebar isn't hidden."* Then, a moment later: *"Actually the mobile breakpoint
is hit. It's just that the app header doesn't show the nav hamburger menu as
it doesn't get narrow enough to trigger it."*

So the second message is the bug: the shell goes to mobile, and the header's
own rule for the hamburger reads the HEADER's width, which is still too wide.

**✅ Done 2026-09-30.** Mobile now starts below 768px, where the layout grid
goes to mobile. The shell hides the rail there and tells the header to show
the menu button, so the two turn together. Before, each read its own width at
480px: a desktop window cannot go that narrow, and from 481 to 520 the button
showed beside the rail. The header's filters still go at its own 480px.

### `[x]` ✅ 161 — The app header's shadow fades in as the Context scrolls under it

Will, 2026-09-30, a minor one: *"Add a very quick fade transition to the app
header shadow on scroll under."*

**✅ Done 2026-09-30.** The shadow fades in and out in 100ms. The first pixel
of scroll still decides it, with no JS: it now flips a property on the
header's area, and the header's shadow follows that with a transition.
Chromium and WebKit; Firefox has no scroll timeline and draws no shadow, as
before.

### `[x]` ✅ 163 — The app shell's panel areas: 150% of their min width

Will, 2026-09-30, a minor one: *"Increase the min width of panel areas, in
the app shel to 150% of their current min width."*

**✅ Done 2026-09-30, second try.** The first build made the WIDTH 1.5 times
bigger at every size. Will: *"You made the width of the panel area 150%
bigger and not the min-width."* Now the width is three grid columns again,
and the area has a MIN width of 464px. That is 150% of the 310px it is at
1280, which is its narrowest (on the 4px grid). So the panel card is 448px
at 1280 and at 1600, and from about 1900 the three columns are wider and
take over (454 at 1920).

### `[x]` ✅ 184 — Does sherpa-ui need Node to ship?

Will, 2026-10-01, to investigate later: *"How much does sherpa actually need
nodejs? Does it need nodejs to ship to consumers?*

*A CDN, script, or even a small zip might be a much better approach for
sherpa-ui."*

Found while moving the app (37): the package ships `dist/`, but not
`schemas/` — a consumer cannot check a page definition against the page
schema without the repo.

**Investigated 2026-10-01 — a consumer needs no Node at all.** Measured on
`dist/`:
- **No runtime dependency.** Every import in `dist/` is relative; the only
  `'sherpa-ui'` strings are in comments. No external host either.
- **It runs from any static host.** 66 components load their `.html` and
  `.css` by `new URL('./x', import.meta.url)`, so `dist/` copied anywhere —
  a CDN such as jsDelivr (which sends CORS headers), a web server, a zip
  unpacked into a site — works as it is. Sherpa Demos already proves it:
  its pages import `/dist/index.js` through an import map.
- **Size:** 3.3 MB on disk, of which `.d.ts` types are part; the JS, CSS and
  HTML are about 550 KB gzipped. The JS is not minified and carries its
  comments; the CSS is minified.
- **Node is only for MAKING it:** the TypeScript build, the CSS transform,
  the gates, the tests, the MCP server, the token projector.

So the ways to ship, none needing Node from the reader: a zip of `dist/`, a
CDN URL to `dist/index.js` (from an npm release, or a git tag), or npm for
those who want the types. Smaller wins, if wanted: minify the JS, and ship
`schemas/`.

**✅ Done 2026-10-02.** The answer is no: Node makes sherpa-ui, and a
consumer needs none. The package now ships `schemas/`, and
`sherpa-ui/schemas/page.v1.json` resolves by name; a node test packs it to
prove it. Minifying the JS and icons on demand are 199's.

### `[x]` ✅ 187 — Make the docs and the MCP text true

Found by 183. `DATA-SOURCE-RULES.md` (served to agents) and a TRAPS entry say `scope: 'all'` where the option is `rows: 'all'`; a wrong call passes the type check and a chart counts one page. `PRINCIPLES.md:26` says the join is `bind()` and nothing else; the app joins through `sherpa-provider`. CLAUDE.md names a `ThemeManager` that does not exist; the README links a deleted doc; the MCP prompts use `data-variant` and read a missing file; `scaffold_def` suggests token names that do not exist. Fix each, and make `bind()` report `scope: 'all'`. `docs/CONSUMER-REVIEW.md` §3.1.


**✅ Done 2026-10-01.** `DATA-SOURCE-RULES.md` and the summary trap say
`rows: 'all'`, and `bind()` now reports `scope: 'all'` (`scope-all`); the data
rules teach ONE source with Query scopes, not two sources, and the `error`
event, not a `source.error` that never existed. `PRINCIPLES.md` names the
provider as the join and `bind()` as the manual way, and its doc list is true.
CLAUDE.md's `ThemeManager` line, the README (an import map first, no dead
link), the MCP prompts (`Fires:` not `@fires`, a real enum, no missing file, no
ontology), the server's resource list and `scaffold_def`'s token names (each
one real now) are fixed. The `generate-sherpa-component` skill is marked out
of date; its rewrite goes with the guide, 193.
### `[x]` ✅ 188 — Fix the bugs 183 found, and run the gates we have

Found by reading, to be proved by a test each: `IdbStore.update` with a changed key writes a second row; Edit never saves Plan; the notification badge has three writers; `sherpa-input-text` fires `input` twice; the provider drops the keys `applyState` skipped, and its Fires block says nothing. And `npm run lint` and the node tests run in no hook. `docs/CONSUMER-REVIEW.md` §3.2.


**✅ Done 2026-10-01**, each with a test. A changed key moves the row in both
`IdbStore` and `ArrayStore`, and one taken by another row is refused
(`T-a-changed-key-moves-the-row`). `sherpa-input-text` sends one `input` per
keystroke (`T-a-composed-native-event-goes-out-twice`). The provider reports a
setting a component does not have (`provider-unknown-setting`), and its
`Fires:` block names its two events. `npm run lint` runs in the commit hook,
and `npm test` runs the node tests after Playwright; the Playwright comment
says all three engines run. In Sherpa Demos: Edit opens on the record's Plan
and saves a changed one, and the notification source is the badge's only
writer, so read stays read.
### `[x]` ✅ 189 — Readiness and a smaller download

Export the harness's `__settled()` as `settled(root)`; put the eight shared sheets in SherpaElement's default so a single-component import draws right; minify the JS and strip template comments (keep a debug build); load icons on demand (314 KB today). Then the demo's 30 `whenDefined` and 32 `waitForTimeout` calls can go. `docs/CONSUMER-REVIEW.md` §3.3.


**✅ Done 2026-10-01 — the readiness half.** `settled(root?)` ships from
`sherpa-ui`: an app, or a test, waits for a tree's components to draw, their
data to stamp and their transitions to end — never a fixed timeout. The test
harness now uses it, so there is one copy. The eight shared sheets are
`SherpaElement`'s own default, so `sherpa-ui/components/sherpa-button/…` on
its own draws as it does from the index (a test page imports one component
alone). Guarding each `define` is left: it matters only with two copies of
the library on a page. The smaller-download half waits in 199.

### `[x]` ✅ 199 — A smaller download: minify, and icons on demand

From 189. `import 'sherpa-ui'` loads 1.5 MB of JS, not minified; the icons
alone are 314 KB (102 KB gzipped), and every page loads them all.

**❓ Two choices** (my pick first):
1. **Minify** — **A:** add `esbuild` as a DEV dependency and minify each file
   after `tsc`, and a new debug build script for the readable copy. **B:** no new
   tool; strip only the comments at build. Pick: A — it is dev-only, so the
   package still has no runtime dependency (184).
2. **Icons** — **A:** one small module per icon, fetched the first time it is
   drawn; an icon draws a moment later. **B:** keep the one file, and split
   the names a page never uses into a second file. Pick: A.

Then Sherpa Demos can drop its 32 `waitForTimeout` calls for `settled()`.

**Re-checked 2026-10-12:** still true — 118 files, 1.5 MB, comments kept
(225 of `sherpa-element.js`'s 975 lines), 276 template comments. Build it in
the same step as 208 (the text in the JS). 220 gates the result.

**✅ Will, 2026-10-12 — all my picks:** A and A — esbuild as a dev dependency with a readable debug build; one module per icon, fetched the first time it is drawn.

**✅ Done 2026-10-12.** The build minifies each module with esbuild, one by
one (no bundle, so every import holds): 2021 KB → 1201 KB. `npm run build:dev`
is the readable copy. Each icon is its own module, loaded the first time it is
drawn; `settled()` waits for them. One button: 570 KB (JS + fetched) before
208, 214 KB now, nothing fetched. `T-an-icon-loads-when-first-drawn`

### `[x]` ✅ 190 — A Context contract and one `app.json`

❓ Waits on choice 1 in 183. Export `ContextModule { init(root, ctx) → teardown }`; one `app.json` names the Contexts (template, definition, views, module, chrome), the default Context and the Settings pages, and the nav, the router, the session defaults and the server read it — about 12 hand-kept lists end. `docs/CONSUMER-REVIEW.md` §3.4.

**Re-checked 2026-10-12:** still true. `index.html` is 968 lines, about 818
of script; the Context names are hand-kept in about 25 places (17 in
`index.html` alone, plus the server, two Contexts, the definitions and four
folder conventions). Also for 190: a page definition's `template` key is read
by nothing, while a View's `template` IS read — one name, two meanings, one
dead; the page schema says it holds Views, and has no `views`; and a Context,
Settings and the Assistant get three different `init` shapes.

**✅ Will, 2026-10-12 — all my picks:** A (183 choice 1) — the app layer lives in sherpa-ui, beside `sherpa-router`.

**✅ Done 2026-10-13.** `src/core/data/app-definition.ts`: `AppDefinition`,
`ContextModule`, `ContextInit` and `checkApp()`, with `schemas/app.v1.json`.
Sherpa Demos' `app/app.json` names the three Contexts, the default, the nav
section and the four Settings pages; `index.html` and the server read every
list from it, and the server's `/template/context/` route is gone (a template
is a file where `app.json` names it). Every Context, Settings page and the
assistant get ONE `ctx` — `{ session, view, source, signal, header, panels,
label }` — so the six `document.querySelector` calls in `contexts/` are gone,
and `chrome.header: false` is the loader's, not chat's. A page definition's
dead `template` key is deleted. The loader itself is 194.
`T-an-app-is-its-definition`

### `[x]` ✅ 191 — Library parts that empty `contexts/`

❓ Waits on choice 1 in 183. `SherpaDialog.prompt()` and `.confirm()`; saved filters owned by the provider, as saved Views are; `data-setting="/pointer"` binds a control to the session; stores take a seed, a version and a fallback; public APIs for the three shadow-root reaches. Then Sherpa Demos sorts by kind: `stores/`, `contexts/` (page behaviour only), `views/`, `view-schemas/`. `docs/CONSUMER-REVIEW.md` §3.5.

**✅ Will, 2026-10-12 — all my picks:** A (183 choice 1) — in sherpa-ui.

Six parts, one commit each:

| | part | |
|---|---|---|
| ✅ | 1. `dialog.prompt(value)` and `dialog.confirm({ … })` — the dialog asks what its own markup holds; `ask-name.js` is `reset-prompt.js`, the Reset all dialog alone | `T-a-dialog-answers-its-question` |
| ✅ | 2. the provider owns the reader's saved filters, as it owns saved Views: `provider.saveFilter(label, event)`; it forgets one a bar deletes, and routes the panel's delete to its bar | `T-save-packs-the-fields-into-one-chip` |
| ✅ | 3. `data-setting="/pointer"` binds a control to the session (`bindSettings`); `persist()` takes its guard from the default | `T-a-setting-is-a-pointer` |
| ✅ | 4. a store takes a seed, a seed version and a fallback: `localRecords(options)` → `{ store, ready }` | `T-local-records-seed-themselves` |
| ✅ | 5. public doors for the three shadow-root reaches in `index.html`: `nav.expandedIds`, `header.notificationsAnchor`, `data-theme-mode` | `T-a-shadow-reach-is-a-missing-door` |
| ✅ | 6. Sherpa Demos sorted by kind: `stores/`, `contexts/`, `views/`, `view-schemas/`; the shell's Reset all helper beside `index.html` | |

Part 1 keeps the five dialogs' markup — HTML first, and their ids are what
the tests press — and deletes the JS that wired each by hand. Part 2 moves
Save filter to the app shell, beside Save view: one flow for every page.

**✅ Done 2026-10-13**, six commits. Sherpa Demos' `contexts/` is page
behaviour only: four modules, no store, no dialog wiring, no session wiring,
no `document` lookups. Not done: a schema `default` — no ledger row asked
for it, and 183 named it beside the seed.

**Found in part 2, fixed with 194 stage 1:** Sherpa Demos'
`reforged-saved-filter.spec.ts:86` read `window.sherpa` after a reload, when
the grid had rows but `records.js` had not set it yet; `reforged-records-persist.spec.ts:164`
did the same. Both now wait for `window.sherpa.source` too (3 of 3 each).

### `[x]` ✅ 192 — Ship the agent path

❓ Waits on choice 2 in 183. The MCP imports `scripts/` and reads specs and schemas that the package does not ship, and its SDK is a devDependency. Publish it with its real dependencies and files, add an `npm pack` smoke test that calls every tool, resource and prompt, register it in both projects, and add `validate_page`. `docs/CONSUMER-REVIEW.md` §3.6.

**Re-checked 2026-10-12:** 184 shipped `schemas/` only. Six of the seven MCP
modules import `scripts/` statically, so `sherpa-mcp` dies at load from a
published package. Not shipped either: the 65 specs and the two served docs.
More runtime imports are devDependencies — `js-yaml`, `@playwright/test`
(lazy), and zod's `^3.23.8` floor may lack the `zod/v3` path every module
imports. The MCP README says "Node 18+, and this repository", and the drive
tools default to the repo's own harness on :4000. Registered in neither
project. **Before registering it:** `sherpa-ui/.mcp.json` holds a plain-text
Figma access token. It is git-ignored, so it is not committed — but the token
must move to an environment variable before that file is shared.

**✅ Will, 2026-10-12 — all my picks:** A (183 choice 2) — its own package, `sherpa-ui-mcp`.

**✅ Will, 2026-10-13: A** — `mcp-server/` becomes `sherpa-ui-mcp` in this repo.

**✅ Done 2026-10-13, but two steps are Will's.** `mcp-server/package.json` is
`sherpa-ui-mcp` — its own dependencies, the `sherpa-mcp` bin — and reads
sherpa-ui through `lib/sherpa.js`. sherpa-ui ships the specs, the six
`scripts/` files, the name map and the three served docs, and no longer ships
`mcp-server/` or the bin. `validate_page` checks a page definition or an
`app.json` (18 tools). `npm run check:mcp-pack` installed both tarballs into an
empty folder and called 18 tools, 267 resources and 3 prompts with no failure;
a node test checks both file lists without the network. Sherpa Demos has a
committed `.mcp.json`. **Will's:** publish both packages, and move the Figma
token in sherpa-ui's local `.mcp.json` to an environment variable — then the
`sherpa` server can be added there too. `T-the-mcp-reads-sherpa-ui-through-one-door`

**The question was — how the package is laid out.** Six of seven MCP modules
import `scripts/lib/generation/`, and it reads the specs, `schemas/` and three
served docs.
- **A:** `mcp-server/` becomes `sherpa-ui-mcp` in this repo, with its own
  `package.json` and real dependencies, and depends on `sherpa-ui`, which then
  ships the specs, the served docs and the generation lib it reads. Sherpa
  Demos gets a committed `.mcp.json` that runs it (no secret in it).
- **B:** bundle the MCP into one file at pack time, with its libs and copies
  of the specs and docs inside.
My pick: A — one copy of each file, and `npm pack` proves what ships.
**Before it is registered in sherpa-ui:** move the Figma token in your local
`.mcp.json` to an environment variable (yours to do). Publishing the package
is yours too.

### `[x]` ✅ 193 — One app guide, served to agents

After 190, so it teaches the contract. `docs/APP-GUIDE.md`, about 300 lines of steps with no history: the page skeleton, the shell, stores, a page definition, a template that asks, a Context module, Views and the session, and the ten or so traps an app meets. Served as `sherpa://app-guide`; each TRAPS entry tagged by who meets it. `docs/CONSUMER-REVIEW.md` §3.7.

**✅ Will, 2026-10-12 — all my picks:** A (183 choice 1) — it teaches the app layer in sherpa-ui.

**✅ Done 2026-10-13.** `docs/APP-GUIDE.md`, 302 lines in twelve steps — the
page, the shell, `app.json`, stores, a page definition, a template that asks,
a Context module, Views, the session, questions and saved filters, starting
the outlet, and reports — each naming the trap it rests on. Served as
`sherpa://app-guide` (7 resources). Not done: a tag on each of the 636 TRAPS
entries by who meets it; the guide names the ones an app meets.

### `[x]` ✅ 194 — A Context loader beside `sherpa-router`

❓ Waits on choice 1 in 183. `<sherpa-outlet>` reads `app.json` and, on each route change, fetches the template, opens the provider, runs the module and tears it down with the navigation's signal; it owns the Settings overlay, the header title from the nav row, the View in the URL, and favourites and recents. `index.html` drops from about 800 lines of script to config, and a `scaffold_app` tool can emit a starter. `docs/CONSUMER-REVIEW.md` §3.8.

**✅ Will, 2026-10-12 — all my picks:** A (183 choice 1) — in sherpa-ui, beside `sherpa-router`.

**Plan (2026-10-13), three commits:**

| | stage | |
|---|---|---|
| ✅ | 1. `<sherpa-outlet id="context-root">` in the shell's content: on each `route-change` it loads the Context `app.json` names — template, definition, module — opens the provider, runs `init(root, ctx)`, binds `data-setting`, writes the header's title, icon and `chrome`, picks the View, and tears down with a signal. It reports `context-load`, so the app's own extras follow. Its light DOM is the Context, so `#context-root …` selectors hold | |
| ✅ | 2. the Settings overlay: `?settings=` opens its page in the shell's overlay dialog, over the Context — `settings: { dialog, header, root }` | |
| ✅ | 3. favourites and recents: the nav's Recent and Favorites Areas, the ★, and a Context's Views as rows — `outlet-nav.ts` | `T-the-outlet-keeps-the-nav` |

The outlet is the app layer: `src/components/sherpa-outlet/`, in `sherpa-ui/app`, in check:weight's APP list and the lint override's exceptions.

**✅ Done 2026-10-13**, three stages. Sherpa Demos' `index.html` is 581 lines,
from 994: what is left is its own — the session's defaults, its stores and
debug switches, kept card sizes, experiments, notifications, the theme, the
assistant, and the save and reset dialogs. The Demos suite passes in
Chromium (137 of 137). `T-an-outlet-loads-the-context` · `T-the-outlet-keeps-the-nav`

### `[x]` ✅ 195 — The spec becomes the whole contract

Every observed `data-*` moves into `static props` and `check:props` checks membership; the generator reads types from props, fills `slots` (0 of 65 list them today), records the `populate()` shape and types event details; emit `HTMLElementTagNameMap` and `custom-elements.json`; a `check:usage` gate checks the Demos markup against the specs. `docs/CONSUMER-REVIEW.md` §3.9.

**Measured 2026-10-12** (a read of the code): 135 observed attributes in 37
components are not in `static props` — 52 read by CSS, 83 by JS only — which
is why `button.populate({ label })` draws nothing. 0 of 65 specs list slots;
155 of 174 event detail fields are `unknown`. It waits on no ruling. Plan:
the tooling first (spec `observed`, types from `static props`, slots,
`populate` shape, typed details, `custom-elements.json`), then the moves in
four families, then `check:props` tightened and `check:usage`. Size L.

**❓ Will — two choices:**
1. An attribute only JS reads (83 of the 135): A a new `kind: 'behaviour'`,
   B `kind: 'style'` — but then the spec says CSS reads 83 it does not. My
   pick: A.
2. Where `check:usage` runs: A sherpa-ui's hook runs it on `../Sherpa Demos`
   when that folder is there, so a library rename that breaks the app blocks
   the library commit, and Demos runs it too; B Demos only. My pick: A.

**✅ Will, 2026-10-12 — all my picks:** A and A — a new `kind: 'behaviour'`; sherpa-ui's hook runs `check:usage` on `../Sherpa Demos` when that folder is there.

**Out, by Will's ruling on 218 (2026-10-12):** `HTMLElementTagNameMap` and
`custom-elements.json` — framework typings, closed with 210.

**🚧 Part 1, the tooling, 2026-10-12.** `kind: 'behaviour'` exists. The
generator reads `static props` by TypeScript's parser (spreads and lookups
resolve), so every declared prop is in its spec with the code's type, values
and default — 66 props added, 96 types corrected — and is marked `declared`.
`slots` is filled from the real `<slot>` tags, described by each `Slots:`
block: 111 slots in 51 specs.

**🚧 Part 2, the moves, and `check:props` tightened, 2026-10-12.** 131 of the
135 moved into `static props`, in four families (controls, shell, data,
charts); `populate({ label })` now sets `data-label`. The other 4 are the
menu's old names, still heard and never public. `check:props` fails an
observed `data-*` that is not declared.

**🚧 Part 3a, the `populate()` shape, 2026-10-12.** A spec's `populate` says
what `populate()` takes: an override's own `populate(…) — …` line over its
`renderData` (25; three were missing a line, one said no shape), or, with no
override, the declared props by short name (38). 63 of 65; the badge takes
nothing. The MCP's `component_api` shows it and the slots.

**🚧 Part 3b, typed event details, 2026-10-12.** TypeScript's checker types
each detail field: 181 fields, none `unknown` (155 of 174 were).
`T-a-detail-is-typed-by-the-checker`.

**✅ Done 2026-10-12 — part 4, `check:usage`.** The app's markup against the
specs: every `sherpa-*` tag, `data-*` and enum value. sherpa-ui's hook runs it
on `../Sherpa Demos`; Demos runs it in its node tests and lists its two own
hooks in `sherpa-usage.json`. Its first run found a dead `data-label` on a bar
chart, which meant the chart's name: the four charts now take a host
`aria-label` (`labelTarget`), and Demos uses one. `T-markup-is-checked-against-the-spec`.

### `[x]` ✅ 196 — One filter surface and a smaller DataSource

❓ Waits on choice 3 in 183. Move `bind()` and `#steer` out of DataSource into a UI-side binder, so the data layer stops knowing component event names; one imported helper for the bar and the panel, one FilterDef type and one scope protocol; the filter editor out of `sherpa-menu`. Each parity bug is then fixed once. `docs/CONSUMER-REVIEW.md` §3.10.

**✅ Will, 2026-10-12 — all my picks:** A (183 choice 3) — the app layer first; this after it, or beside it.

**Plan (2026-10-13), seven stages, each shippable with behaviour unchanged:**

| | stage | size |
|---|---|---|
| ✅ | 1. Name the verbs: each `#steer` branch that reaches private state becomes a public DataSource method named for what it does — `answerScope`, `answerScopes`, `release`, `answerColumn`, `request`, `reportPages`, `remote` | S |
| ✅ | 2. Steering out: `src/core/ui/bind-source.ts` holds `STEERING_EVENTS` and `steer()`; `bind()` calls it | M |
| ✅ | 3. Bind and push out: `bindSource(source, el, options)` in the binder; DataSource keeps `attach(target, facts, sink)` and picks the rows. The listeners, `data-locked`, `data-remote`, `as`, `into`, `deliver` and every `data-*` write are the binder's now | M |
| ✅ | 4. One helper for the bar and the panel, the ⋮ menu first (`src/core/ui/more-menu.ts`) — then the saved-filter menu, then the drill. The ⋮ menu is shared now. The saved-filter menu (`saved-filter-menu.ts`) and the drill (`MenuDrill`) were shared already; what is left of them is each host's chips or scope boxes, which is stage 5 | M |
| ✅ | 5. One `FilterDef` type, then one scope protocol (the bar drawn as a panel scope is). `FilterDef` and `FilterOption` in `src/core/ui/filter-def.ts`; `QuickFilterDef`, `QuickFilterOption`, `PanelFilter` and `PanelValue` are gone. A bar's `drawScope` takes `describe(scope)`, as the panel's `drawScopes` does; the raw slice is gone. `describe` now lists every held field, declared or not — one left out filtered with no chip | S + L |
| ✅ | 6. ~~The filter editor out of `sherpa-menu` (`src/core/ui/filter-editor.ts`). Found 2026-10-13: the editor is in ONE place already — the bar, the panel, the grid and the saved cards all open `sherpa-menu`, and the shared logic is `filter-state.ts`. So this only splits a 1993-line file, behind a host interface of about 15 calls. **A:** split it anyway; **B:** drop this stage. My pick: B~~ — **✅ Will, 2026-10-13: B, dropped** | L |
| ✅ | 7. Remove the bridge: delete `DataSource.bind`, rewrite ~90 calls in tests — **✅ Will, 2026-10-13: A, remove it.** Done: `bindSource(source, el, options)` from `sherpa-ui/data` is the one way in; 93 calls moved, in 23 test files, Sherpa Demos and the docs | M |

**✅ Done 2026-10-13.** The data layer names no component event and writes no
attribute: `bindSource()` in `src/core/ui/bind-source.ts` joins a component to
its source, and `DataSource.attach()` takes what it is told. The bar and the
panel share the ⋮ menu, one `FilterDef`, and one way to be drawn a scope.
Stage 6 was dropped (Will): the editor was in one place already.

### `[x]` ✅ 197 — One way to write a filter condition

❓ Waits on choice 4 in 183. Today an agent learns two grammars: `[field, op, value]` (DATA-SOURCE-RULES §2) and readings with numbers as strings, `{"op":"gt","text":"0"}`. Keep readings, or store a plain form with numbers as numbers and migrate saved Views. Decide before 193.

**✅ Will, 2026-10-12 — all my picks:** B (183 choice 4) — the plain form, `{ "openTickets": { "gt": 0 } }`, numbers as numbers; saved Views are migrated.

**✅ Done 2026-10-13.** `src/core/data/where.ts` reads the plain form into
readings and back; `source.readingsOf()` / `source.whereOf()` do it by the
field types. It is `where` in a View's scope, a definition's preset and a
stored saved filter, and `data-where` on a component (was `data-readings`).
A View or saved filter stored before 197 still opens, field by field, and the
next save writes the plain form. Readings stay inside. The Sherpa Demos Views,
presets and dashboard tile are moved. Not moved: `export()` / `import()` keep
the exact Query, as a session restore does. `T-one-way-to-write-a-condition`

### `[x]` ✅ 185 — Sherpa Demos: views, view schemas, and what `contexts/` is for

Will, 2026-10-01, in the example app, to do later:

*"- The 'definitions' folder should be called 'views' and should only contain
'\*-views.json' files.*
*- '\*-views.json' files should not contain any HTML template literals. They
should point to an HTML file, in the same folder, that contains the template.
Target the template via ID.*
*- Other files in 'definitions' should be moved to a sibling 'view-schemas'
folder.*
*- I don't understand the point of the 'contexts' folder's JS content. It
seems to be a mix of data and business logic? These seem like hacks to make
things work rather than sensible consideration of the whole Sherpa system and
how it should be leveraged.*

*This is probably all part of the overall review of the architecture, and
building with, Sherpa."* — so it goes with 183.

**✅ Done 2026-10-01.** Sherpa Demos has `app/views/` — only `*-views.json`,
plus `dashboard-views.html`, where the Capacity View's cards live as
`<template id="capacity">`; the JSON names it, `"template":
"dashboard-views.html#capacity"`. The page definitions moved to
`app/view-schemas/`, and `definitions/` is gone. The library gained
`loadViewLibrary(url)`, which reads a views file and fills each View's content
from its template (`T-a-views-markup-lives-in-a-template`). A Demos test checks
`views/` holds only those files and that every named template exists. Demos is
not in git, so its half is uncommitted. **What `contexts/` is for** is
answered by 183: about 60% is glue the library should own, and items 190, 191
and 194 move it out — `docs/CONSUMER-REVIEW.md` §2.1.

### `[x]` ✅ 183 — REVIEW: how a consumer builds an app on Sherpa — and an AI agent

Will, 2026-10-01, a todo once the example app moved: *"We need to review how
a consumer of Sherpa will use it to build an application frontend.*

*We need to make it easy to do things like:*

*- Use, configure, extend, and co-ordinate sherpa components*
*- Scaffold a sherpa application*
*- Work with the data layer to provide data, data sources, set context and
conditions etc.*

*I'm sure there's a host of other things, too.*

*We also don't want to forget making it easy for AI agents to build using
Sherpa.*

*The principles of sherpa need to be easy to understand and work with to make
it viable.*

*This review may likely involve really getting into the overall architecture
and doing some overdue cleanup, refactoring and optimisation of Sherpa."*

The app moved on 2026-10-01 (37), so this may start; Sherpa Demos is the
first consumer to learn from.

**✅ Reviewed 2026-10-01** — the full report is `docs/CONSUMER-REVIEW.md`.
The base is good: a template asks for its data in markup alone, there is no
bundler and no runtime dependency, and the gates are real. But Sherpa stops at
the PAGE. The part between "I have components" and "I have an app" is written
by hand in Sherpa Demos — `index.html` is 957 lines — which is why `contexts/`
looks like hacks (185): about 60% of it is glue the library should own, 20%
demo data, 20% the app's own business. The agent path breaks outside this
repo; the rule docs still teach `bind()` as the only join; and some mistakes
fail silently. Its plan is items 187–197. Four choices wait in 190, 192, 196
and 197, each with the review's pick.

**✅ Will, 2026-10-12 — the review's picks: A, A, A, B.** The four choices (the review's pick first):
1. **Where the app layer lives (190, 191, 194)** — **A:** in sherpa-ui, beside
   `sherpa-router` (its rules are already ratified in CLAUDE.md, but only the
   demo's code does them). **B:** a separate starter package. Pick: A.
2. **How the MCP ships (192)** — **A:** its own package, `sherpa-ui-mcp`, so
   sherpa-ui keeps no runtime dependency (184). **B:** inside sherpa-ui, its
   SDK an optional dependency. Pick: A.
3. **After 187–189 (196)** — **A:** the app layer next, and filter fixes in
   place meanwhile. **B:** merge the bar and the panel first (XL). Pick: A.
4. **One filter grammar (197)** — **A:** keep `readings`. **B:** a plain form,
   `{ "openTickets": { "gt": 0 } }`, numbers as numbers; saved Views migrate.
   Pick: B, decided before the guide (193).

### `[x]` ✅ 200 — A WebKit flake: the summary on another Context reads 0

Sherpa Demos' `reforged-view-chips.spec.ts:126` fails in WebKit in most full
runs and passes on its retry: "the summary reads the store, not a constant"
gets 0. Seen on 2026-10-01 in every Demos run. Find whether the test reads too
early or the summary misses the store's announce.

**✅ Done 2026-10-01 — the test read too early.** It waited for the word
"Customers", which the summary draws at 0 before its rows load; WebKit was
often there first. It now waits for a number above 0 (4 of 4 in WebKit).

### `[x]` ✅ 198 — A direct link to a View with cards of its own draws the default cards

Found by the review of 177. Open `/?context=dashboard&view=capacity`: the
provider opens on that View, so the pick is ignored as already applied, and
its `content` is never drawn into `[data-view-content]`. The page shows the
Fleet cards under a chip that says Capacity planning. Picking it IN the page
works. Fix in `sherpa-provider`'s open: when the start View has content, draw
it as a pick does, then emit `view-change`.


**✅ Done 2026-10-01.** `onViewPicked` draws the View already on screen when
it has content of its own, and keeps the page's own children per region, so
the next pick puts them back; the provider then reports `view-change`. A
library test and a Sherpa Demos test (`reforged-view-link.spec.ts`) hold it.
`T-content-first-original-once`
### `[x]` ✅ 177 — Resize layout grid content by dragging handles in its gutters

Will, 2026-10-01, *"Todo after we move the example app to it's own project:*

*I really like the resizing of the panel areas in the app shell.*

*As an app setting, let me enable the ability to resize layout grid content
using handles in the gutters between containers/elements.*

*Dragging to resize should snap to column and row increments.*

*The minimum column span for any container is 3 columns. The minimum row span
for a container/element should be set via an attribute.*

*For example a metric item can have a min row span of 1 whereas a data viz
should have a minimum of a 2 row span.*

*If there's no space on the row to grow an element's column span (siblings
already at their minimum span) then dragging won't increase the width.*

*Dragging to resize height/row span can't force neighbouring rows of content
to span lower than the highest min row span on elements in that row."*

Starts after 37 step 4 — done 2026-10-01, so it may start. Builds on 146's edge helper (`src/core/ui/edge-resize.ts`).

**Plan, 2026-10-01.** `<sherpa-layout-grid data-resizable>` draws a handle
(a focusable separator) in each gutter. Drag it, or use the arrow keys. A
pure solver moves ONE line: the card or row across it gives way first, down
to its floor (3 columns; a row's highest `data-min-row-span`), then the next.
Free space is used last. A step nobody can give is dropped. The grid writes
only its own attributes — `data-col-span-<C>` and `data-row-span-<C>`, C the
column count now — and reports `layout-change { layout }` on release. Setting
`grid.layout` puts a layout back, silently. Sherpa Demos turns it on in
Settings › Application › Layout and keeps each Context's layout by card id.
Seven library steps, then the Demos part.

**Built this way — say to change any:**
1. What gives way: the card or row across the line, then the next (your
   "can't force neighbouring rows lower than…"). Not: free space first.
2. Handles at 8 and 12 columns, each width keeping its own layout (with the
   nav pinned at 1440 the page has 8). Not: 12 columns only.
3. Heights are kept per width too.
4. A layout is kept per page (Context), by card — not per View.
5. Turning the setting off hides the handles and keeps the sizes; "Reset card
   sizes" forgets them.

**✅ Done 2026-10-01.** Settings › Application › Layout › "Resize cards"
turns it on. A handle sits in each gap between cards in a row, and under each
row. Drag it, or focus it and use the arrow keys, Home and End; sizes snap to
whole columns and rows. A card is never narrower than 3 columns; a row never
shorter than its tallest `data-min-row-span` (1 on a metric, 2 on a chart);
with no room left, a drag does nothing. The Dashboard and Records keep their
sizes per card, across a reload and every View; "Reset card sizes" forgets
them. Library: seven commits, ab30530c to b78de6e0. The Sherpa Demos half
(the setting, the ids, the keeping, its tests) is not committed — Demos has no
git yet. `T-a-gutter-moves-a-line` `T-a-dragged-layout-is-kept-per-column-count`
`T-a-handle-is-never-restamped-mid-drag` `T-a-fit-grid-counts-its-resized-rows`

**Reviewed 2026-10-01** — four lenses, each finding verified; 23 real, all
fixed with a test each that could be tested. The worst two: on the Dashboard a
row could grow but never shrink back (the locked Summary row blocked it), and
the handles went dead after the grid was taken out and put back. One more is
not the grid's: 198.

### `[x]` ✅ 146 — The app shell's FIXED panel areas resize by dragging their edge

Will, 2026-09-30, a future todo: *"Allow the side of the panel areas, in the
app shell to be dragged to resize like we can do with the overlay panel.*

*Left panel's width, in the current examples, is a good min width. 33% of the
area between the nav and viewport edge (not sure of wrapper name) is probably
a good max width.*

*Obviously only the right side of the left panel area is draggable. The
inverse for the right panel area.*

*The drag indicator should show on the edge of the panel area (not panel) on
hover & drag.*

*The content area's content should respond and reflow following the
breakpoint rules, and container queries, that we built previously.*

*We will need to rework the container query that hides panel areas at lower
breakpoints to use the viewport width (I think?). Perhaps it's not the
viewport but a different wrapper element.*

*Either way I think that there's 2 levels of container query and scopes of
breakpoint responsiveness needed."*

**These are FIXED panels, not overlay panels** — Will, 2026-09-30: *"the
panels referred to in this request are Fixed Panels in the app shell's panel
areas wrapper elements."* The filter panel sits in one (`panel-start`); the
right one is not used yet. An overlay panel (G) floats over the content; a
fixed panel takes its own column, and the content reflows beside it.

So, to find when it is built: which wrapper is "the area between the nav and
the viewport edge" (the max is 33% of it, and it may be the container the
hide-the-panels query reads); and the two levels — one for the shell, which
shows or hides a panel area, and one for the content area, which reflows as a
panel area grows. The handle can follow the overlay panel's (22): a `role="separator"`, drag
or arrow keys — but it is on the AREA's edge, in `sherpa-app-shell`.

**Plan, 2026-09-30** (a second agent read the code; nothing built yet).

- The model is `sherpa-overlay-panel`'s handle: a `role="separator"` strip,
  pointer capture, arrow keys in 16px steps, the width in a custom property,
  CSS owning the clamp, `panel-resize` on release. It lacks `aria-valuemin`
  and `aria-valuemax`, a dragging state and `pointercancel`. A new imported
  helper, `src/core/ui/edge-resize.ts`, gives all of that to both.
- "The area between the nav and the viewport edge" is the shell's `.body`.
  The area becomes `flex: 0 0 clamp(464px, asked or 3 columns, 33%)`; the
  drag writes only the asked width. Nothing asked means today's width, so
  the 3-column test still holds.
- In: `data-panel-start-width`, `data-panel-end-width`. Out: one event on
  release and on each key press. The example keeps the width in its session
  store, as it keeps the nav pin.
- LEVEL 1 (the shell shows or hides an area): nothing in the shell hides a
  panel today — the filter panel does it itself, by the VIEWPORT
  (`data-min-width`, 1280). The shell should own it, by its own width, and
  tell the panel, or a pinned nav and the panel disagree.
- LEVEL 2 (the content reflows): the layout grid's column spans are viewport
  `@media` rules in the GENERATED `tokens.css` (`scripts/project-tokens.mjs`).
  They need `@container` twins on the Context's frame, with `@media` kept as
  the fallback for a page with no shell. To measure first, in three engines:
  can slotted light-DOM content query a container that is in the shell's
  shadow tree?
- Build order: the second container → the shell-level hide → the clamp → the
  helper → the handles → attributes and events → the grid's container
  queries → the example's persistence.

**🚧 2026-09-30 — the drag is built; the two levels are not.** Each panel
area's INNER edge resizes it: drag it, or the arrow keys (Home and End go to
the ends). The line shows on the AREA's edge on hover, focus and drag. It
never goes under the area's min (464px) or over 33% of the row, and the
example app keeps the width through a reload. The overlay panel's handle is
the same code now (one helper, `src/core/ui/edge-resize.ts`).

**One thing to know:** at 1280 wide, 33% of the row is 409px — under the
464px min from 163 — so the area cannot be dragged there. It gives from about
1446px wide. Say if the max or the min should move.

Not built: level 1 (the shell, not the filter panel, hides an area when it is
too narrow) and level 2 (the Context's grid reflows by its own width). Level
2 waits on the choice below.

**✅ Level 1 done 2026-10-01 — the shell says when there is room.** A panel
area shows only while the Context beside it keeps a tablet's width (768px):
the shell's body must hold 768 plus the area's 464 min. The SHELL measures
its own body now, not the window, so a pinned nav counts: at 1280 with the
nav pinned there is no room, and the toolbars come back. Unpin, and the panel
is back. Today's widths do not change: 1280 with the nav shut still has
room. The panel lost its own window rule (`data-min-width`, 1280) — a panel
with no shell is its host's to place. While Settings is open the shell
ignores the room, as Settings covers the Context.
`T-the-panel-is-desktop-only`

**❓ One choice before level 2.** The grid's bands (768 / 1280 / 1920) are
viewport widths. As container widths they are narrower by the nav and the
panels.
- **A (my pick):** keep the numbers, offset for the nav's inset, so today's
  layouts do not change at today's widths.
- **B:** use them as they are; every layout steps down a little earlier.

**✅ Will, 2026-10-01: A.**

**✅ Level 2 done 2026-10-01 — the Context steps by its own width.** The
Context (the shell's child with no `slot`) is a container, and the token
projector writes a container twin of every layout band: 728 / 1240 / 1880,
the viewport bands less the shut rail's 40 px. With nothing open, every
layout is as before at the same window width. Open the filter panel at
1440 and the Records grid goes from 12 columns to 8; shut it and it is 12
again. A pinned nav does the same. The viewport rules now skip the Context,
so the two never fight; a page with no shell, and the Settings overlay, still
step by the window. One seam: below 768 the shell hides the rail, so a
728–767 px window now gets the tablet layout.

Found on the way: WebKit cannot match a container inside the shell's shadow
tree for the Context's own children, so the container is the light-DOM
Context, declared in `tokens.css`. `T-a-context-steps-by-its-own-width`

## F — Data states and charts

### `[x]` ✅ 58 — Loading, empty and error states in a container

Will, 2026-09-26: *"Gracefully handle data loading and loading, or no data,
errors."* It mirrors Apex for now; it is not his favourite pattern (see 59).

| state | the content area shows, IN PLACE of its content |
|---|---|
| loading | a spinner and a short loading message |
| no data | the relevant empty-state illustration and message |
| failure | the relevant illustration, the error message, and action buttons |

On a failure, an action that RESOLVES the issue (Retry) is the CTA; one that
does not (Dismiss) is a plain button.

**The parts exist; the wiring does not.** `sherpa-container` already has
`data-loading` and `loading` / `empty` / `error` slots; `sherpa-empty-state`
has `data-illustration` = `empty | search | data | error | …` and an `action`
slot; `sherpa-loader` is the spinner. What is missing is the DATA LAYER
driving them: a bound source reports loading, empty and failed, and the
container of each bound component follows — so no host writes
`data-loading` by hand. `LoadResult` and `report()` (38 step 5.5) are the
shapes to reuse, and 62's debug flag is how the example shows each state. "No data" must not fire on a filter that matched nothing —
that is a different message ("No matches", clear the filter), and a zero-row
view already reads as a broken filter.

**✅ Done 2026-09-30.** The container shows each state IN PLACE of its body
(an opaque overlay), with a composed default for each: `sherpa-loader` and
"Loading…"; `sherpa-empty-state` for no data (data illustration) and no
matches (search illustration, Clear filters); and for an error its own words,
Retry as the CTA and Dismiss plain. A slotted state still replaces its
default. The PROVIDER drives it from each source's `loading`, `change` and
`error`: loading only after 300 ms; empty and no matches on a rows
component's card only; Retry (and a bar's Refresh) force a load; Clear
filters resets every bar; Dismiss is the card's own. A store that cannot
answer at open no longer stops the page. The example shows each: `?remote`
(slow), `?fail` (every load fails). No Figma design — the look follows the
empty state. `T-a-container-shows-its-datas-state`

### `[x]` ✅ 9b — A Data Viz header, for metrics and chart containers

Figma `Data Viz Header`, node `1456:30467`, page `✅ Headers`. For Metrics,
and any Container that holds a chart. 32px tall, horizontal, `gap/sm`,
`padding/md` all round, a `border/width/sm` bottom rule in
`style-border/base +1`, no fill.

| Part | What |
|---|---|
| Drag handle | a Button, icon only. Toggled by `hasDragHandle` |
| `left` | a SLOT. The leading icon. Toggled by `hasIcon` |
| `Labels` | vertical, `gap:2` — the `title`, then a `metadata` SLOT |
| `actions` | a SLOT. Icon-only Buttons |

The title is NOT the normal heading: `content/font/body`, `weight/light`,
`size/small` (12px), `line-height/small` (16px), `content/body/+1`,
**UPPERCASE**. The filter panel's field titles use the same look
(`sherpa-text-small`, caps, light). Compose both Buttons from `sherpa-button`.

**🚧 Built 2026-09-30, from Figma's NEWER design** (80 said so), which the
notes above predate: 20 px tall, not 32; no drag handle; a hug · fill · hug
row, `gap/sm`, padding 2 / 4; a `left` icon slot; the title (12/16, light,
CAPS, `content/body/+1`) over a `metadata` slot (a 12/16 regular line); an
`actions` slot (Figma's example: an xs icon Button). The 0.5 px rule sits
INSIDE the 20, as Figma's stroke does. `sherpa-data-viz-header` is the 64th
component; the Dashboard's four chart cards wear it. **Left:** the METRIC —
read Figma's Metric to see how it composes the header (the Figma plugin was
closed at the time).

**✅ Done 2026-09-30.** Read live from Figma's Metric (`61:263`): it composes
the Data Viz Header — an icon, the name, no metadata, no actions, and its rule
HIDDEN. `sherpa-metric` does the same now: `data-label` is the header's
heading, a new `data-icon` its glyph, and the header takes
`data-divider="none"` (the section header's word for the same thing).

**One thing to know:** the header is 20px tall where the label was 16px, and
Figma's Metric is 96px with an 8px gap. The layout row here is 88px, so the
gap under the header is 4px and the tile still fits its row. Say if the row
should grow instead.

### `[x]` ✅ 80 — Container and Data Viz headers: Figma's new button styling and grouping

Will, 2026-09-27: *"I've also tweaked the Container Headers and Data Viz
Headers in Figma. Mainly adjusting button styling and grouping. We need to
adjust the components in the codebase."* Read both from Figma live — the
buttons' look, size and which ones are GROUPED (`.sherpa-group`, start/end by
position) — and bring `sherpa-container-header` into line. The Data Viz
header does not exist in code yet (9b), so it is BUILT from the new Figma,
not the old notes above. Same kind of change as 79 (the nav header's Actions
group): compose `sherpa-button`s, group them, keep them in a slot.

**Partly done by 145, 2026-09-30:** the header's own close and collapse
buttons are `sm`, and the overlay panel's toolbar is grouped and divided as
`Variant=Panel`. Left: the 3-column GRID (the metadata row sits under the
TITLE, 4 px below it — not under the icon, 8 px below), the accordion's
chevron in the `left` slot, and the Data Viz header.

**✅ Done 2026-09-30.** The header is ONE grid, as Figma's Container Header
(912:33355) is: `left · title · actions` on row one, and the metadata row
under the TITLE, 4 px below it, running to the end. The description is the
metadata row's first line now. With nothing to lead, the grid drops to two
columns, so a bare header is still 36 px and its title starts at 8 px. The
collapse chevron moved into `left`, before the icon. The Data Viz header is
9b's `sherpa-data-viz-header`. Not done: Figma's Accordion variant pads
16 / 8 / 4 / 8 — no Sherpa header asks for it yet.

### `[x]` ✅ 14 — An example of real-time data

Data that changes in real time — WebSocket, or like it — coming through the
data layer into a piece of content. Last of D: it proves 13 is really fixed.

**✅ Done 2026-09-30.** The examples server pushes a new alert every 2 s over
Server-Sent Events (`/live/alerts`); the Dashboard, under `?live`, feeds them
through an `EventStore` INTO its alert store, so every tile and chart
follows — a tile's value and its sparkline together (13). **To see it on
:4200, restart the examples server** once: the route is new. The test runs
on a second server Playwright starts on :4201, so it does not wait for that.
`T-a-live-feed-goes-into-the-store`

### `[x]` ✅ 59 — EXPLORE, later: Will's own loading pattern

Will, 2026-09-26, an alternative to 58 for later. Content is never replaced:

- **Loading:** an INDETERMINATE loading bar along the bottom of the container
  header (`sherpa-progress-bar data-indeterminate`), and the content locked to
  read-only while it runs.
- **Failure or no data:** a message BANNER in the content area that explains
  the error and says the PREVIOUS data is still shown. It carries Retry,
  Dismiss and the like.

Build 58 so its states are data, not markup, and this is a second rendering of
the same three states.

**✅ Built 2026-10-01, as a trial.** Settings › Application › Experiments,
"Keep the content while data loads" (off by default). On, every card keeps its
content: a slow load shows an indeterminate bar along the bottom of the card
header, and the body takes no clicks until it ends; a failure is a red banner
above the body — "The data could not load", the error's words, "The last data
is still shown.", Retry and Dismiss. No data and No matches are banners too.
The overlay from 58 never shows. The provider carries it
(`data-keep-content`), so no page sets it card by card.
`T-a-container-shows-its-datas-state`

### `[x]` ✅ 150 — EXPLORE: the gauge's risk score, and thresholds in the central Query

Will, 2026-09-30: *"We need to take a look at how the example gauge's risk
score is being calculated.*

*I feel like this is probably a compound filter across fields and values with
various conditions. We cover this type of scenario with 'Presets' or Saved
filters.*

*We don't support thresholds in the centralised query system. If we did then
a gauge (or any component potentially) could request prepared data, with
thresholds it provides, to present it back to the user.*

*Thresholds could also be part of the data and data shaping without the gauge
(or any component) providing them."*

**What is there today** (read 2026-09-30, nothing changed):

- The score is NOT a filter. It is `100 − mean(health)` over every matching
  row, worked out by hand in `examples/contexts/records.js` — the one
  component on the page that the provider does not answer.
- The thresholds are written in THREE places, and nothing joins them: the
  gauge's `data-zones` (`0-20`, `20-40`, `40-100`), the legend's zone names
  (typed in `records.js`), and the saved filter "At risk" (`health < 60`).

So the two ways you name are the question: a component ASKS for data shaped
by thresholds it gives, or the thresholds are part of the data's own schema
and every component gets them. Either way the three copies become one.

**❓ Explored 2026-09-30 — one choice for Will.** A second agent read the
whole path; I checked its main points against the code.

*How the score is made.* One field, one sum: `100 − mean(health)`, over every
row the filters leave (`rows: 'all'`), in a hand-written adapter in
`examples/contexts/records.js`. `health` is seeded 40 to 100, so the score
sits near 30. The dashboard's gauge needs no adapter: it asks its provider
(`data-aggregate="mean" data-field="storage"`). Only the `100 −` forces the
hand-written one — an ask cannot turn a value round.

*The copies now.* 128 took one away (the legend's names are the gauge's).
Two are left, and they are in different units: the gauge's zones are on RISK
(`0-20`, `20-40`, `40-100`), and the saved filter "At risk" is on HEALTH
(`health < 60`, which is risk > 40). They agree, but nothing says so.

*What the data layer has.* No threshold, and no aggregate in the Query — on
purpose: a summary shows the data and never steers it
(`T-aggregation-is-data`). Aggregates are in `src/core/data/aggregate.ts`
(`count`, `sum`, `mean`, `min`, `max`, `distinct`). The nearest thing to a
threshold is `bandBy(rows, field, edges)`: it cuts a number field into bands
for a bar chart (`data-bands`). Its bands have no name and no status, and a
gauge cannot read them. A field's declared facts are `type`, `label`, `min`,
`max`, `step`, `labels` — and they already reach every bar and panel from
the page's definition.

- **A (my pick): thresholds are a FACT of the field**, declared once in the
  page's definition beside `min` and `max`: each band's top, name and status.
  The gauge's zones, its legend, the "At risk" saved filter and a bar chart's
  bands all read it. This is your "part of the data and data shaping". It
  needs one more fact for a score that runs the other way (risk is
  `100 − health`): a derived field, or `invert`.
- **B: a component ASKS with its own thresholds** (your first way). The
  provider answers with the value AND its band. Smaller — the bands plumbing
  is there — but each component still holds its own copy, so the gauge and
  the saved filter stay apart.

Either way the Query stays as it is: it filters and arranges, and never
summarises.

**✅ Will, 2026-10-12 — all my picks:** A — a threshold is a fact of the field, declared once beside `min` and `max`.

**🚧 Built 2026-10-13.** A number field declares `thresholds: [{ to, label,
status }]` (schema too). A gauge asks for them and draws them where it has no
`data-zones`; its legend names them. A bar chart over the field with no
`data-bands` is cut at them. A saved filter names one:
`{ "health": { "band": "At risk" } }` (half-open; an unknown name is reported).
Demos: the Dashboard's storage gauge draws `storage`'s bands, and Records'
"At risk" names `health`'s band. `T-a-threshold-is-a-fact-of-the-field`.

**❓ Will — one choice left.** The Records gauge shows RISK, `100 − health`:
`health`'s bands, the other way up. Until this is chosen it keeps its own
`data-zones` and its hand-written bind in `records.js`.
- **A (my pick): `data-invert` on the gauge.** It shows `max − value` and
  turns its field's bands round. Small: only the gauge knows.
- **B: a derived field** in the page JSON — `"risk": { "from": "health",
  "invert": true }` — that any component can use. Larger: the data layer
  gains derived fields.

**✅ Will, 2026-10-13: A** — `data-invert` on the gauge.

**✅ Done 2026-10-13.** `data-invert` reads the value from the top and turns
the field's bands round. Records' gauge asks its provider for `mean` of
`health`, inverted; its zones are health's thresholds, and the hand-written
bind in `records.js` is gone.

### `[x]` ✅ 162 — A chart and its legend stack as their container narrows

Will, 2026-09-30, a minor one: *"Have data viz charts and legends go from
horizontal layout to vertical layout as their container gets narrower. Use
container queries. If a layout is set to vertical by default in it's template
then this won't apply."*

**✅ Done 2026-09-30.** Below 352px (22rem) of its own width, a chart puts a
legend that was beside it below it, and a legend strip (three per line)
becomes a list, one per line. A chart that is stacked already is left alone.
All four charts, by container queries, no JS. 352px keeps Records at 1280
with the panel shut as it was; with the panel open every label now shows in
full. If it must turn sooner, it is one number in three places.

### `[x]` ✅ 128 — A gauge's tooltip names the segment as the legend does

Will, 2026-09-30: *"Gauge tooltips should match the segment name as shown in
the legend."*

**✅ Done 2026-09-30.** A zone is named once, on the gauge:
`data-zones="0-20:success:Low,…"`. The tooltip says `Low` · `0–20%`, and the
gauge fills its own legend with the same words, so a row reads `Low 0–20%`.
The two example pages no longer fill the gauge legend by hand. Before, the
tooltip said `Success` and the legend said `Low (0–20)`.

### `[x]` ✅ 143 — EXPERIMENT: scrolled-past metrics become a compact sticky header

Will, 2026-09-30, a fun concept to explore later: *"When a content area
scrolls, if there are metric items in the first row that have reached the
upper boundary of the content area, they should:*

- *Be grouped with no gap*
- *The group becomes a sticky header, ignores layout grid margins, gutters,
  padding.*
- *Value label text size is reduced to smaller size token (approx half size)*
- *Metric item height reduces to follow value label height reduction*

*As soon as the content area is scrolled the other way, and the metrics
should be back in view then we reverse all of this and show them again in the
layout grid. Actually a visibility toggle, and content injection, is probably
the best way to do this. This is just an experiment, so add it to the app
settings as a toggle in an Experiments section. There's a possibility we
remove this or archive it for later. So don't intertwine the logic and code
too much if possible."*

So: one module of its own, switched by one setting, that a delete removes
whole.

**✅ Done 2026-10-01, as an experiment** (and tuned in 175 — read that for how it switches now). Settings › Application has a new
**Experiments** section with one switch, "Compact metrics header" (off by
default). On, the first row's metrics, once their top passes the top of the
content area, show as one sticky row: no gaps, the full width of the content
area, the value at 12px (half of 24), no sparkline. The tiles under it hide.
Scroll back until they are in view, and the row goes. The row holds COPIES
that follow each tile's label, value and change; they ask no provider.

To remove it: delete `examples/experiments/sticky-metrics.js`; in
`examples/index.html` its import, its `experiments` session key and the
`syncExperiments` block and call; its wiring in `settings.js`; the section in
`application.html`; and `test/e2e/reforged-sticky-metrics.spec.ts`.

### `[x]` ✅ 175 — LATER: the sticky metrics, tuned

Will, 2026-10-01, "Todo later": *"Sticky metric items should still show the
sparkline. It will have reduced height and width but that's ok.*

*Also the gap between the title, value, and trend label should be reduced.
This will reduce the overall height of these sticky metric items in the
metrics group.*

*The metric value label is a bit too small.*

*Sometimes if I scroll slowly, or the metrics are already partly scrolled
under, the app header then the metrics don't switch to the sticky metrics
group.*

*We need to check the CSS logic here."*

And: *"use this doc guidance to improve the mechanism for sticky metrics:
https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Conditional_rules/Container_scroll-state_queries
We can probably use CSS calc, with the layout-grid margin, gutter, and row
height values to help determine when to switch between regular and sticky
metrics."*

**✅ Done 2026-10-01.** CSS decides when now, with no scroll code. The
sticky row's anchor is a `scroll-state` container, sticky at minus (grid
padding + one row height). So it is STUCK exactly when the first row has
scrolled fully under the top, and `@container scroll-state(stuck: top)`
shows the row. Back up past that point and it goes. A slow scroll works: the
test moves 2 px at a time. The old way watched the tiles and missed a slow
crossing by under half a pixel. The originals no longer need hiding: the row
shows only once they are gone. The gutter is not in the sum — the row
overlays it.

The compact tiles keep their sparkline (`sherpa-metric` has a `series`
read-back now, so a copy draws the same line), the gaps are 2 px, and the
value is 14 px (it was 12). A tile is about 64 px tall, was 88.

**One thing to know:** scroll-state queries are Chromium only. In Firefox and
Safari the row never shows; the page is as it was.

---

## G — Overlay panels

### `[x]` ✅ 22 — The `Ask N-zo` panel is too narrow, and cannot be resized

- Make it wider, with a sensible minimum.
- The user can drag the LEFT edge to resize any overlay panel.

**✅ Done 2026-09-30.** Every overlay panel, the Ask N-zo one included, is
40rem (640 px) by default — it was 30rem — never under 20rem nor past 92vw.
Its left edge is a `role="separator"` handle: drag it, or ArrowLeft /
ArrowRight by 16 px; each resize reports `panel-resize { width }`. Figma was
closed, so the widths are my pick — say if Figma has its own.
`T-an-overlay-panel-resizes-from-its-left-edge`

### `[x]` ✅ 23 — A focused grid row opens a details panel on the right

Focus a row in `sherpa-data-grid` → an overlay panel opens on the right with
more about that record. Any other open overlay closes first. Its header has up
and down chevrons that step the focused row. Needs 22's resizing panel.
A drilldown like this is where a breadcrumb trail belongs — the first real one.

**✅ Done 2026-09-30.** A Records row click opens a details panel: the heading
is the name, the body is every declared field under its label. Its up and
down chevrons step the grid's current row, and disable at an end of the page.
The grid holds the current row BY KEY now, so an edit keeps it, and a caller
can set it (`currentKey`), read the next one (`neighbour(by)`) and step it
(`stepCurrent(by)`). An overlay panel takes an `actions` slot, and opening one
shuts every other one — the Assistant and the details are the pair. The
header's trail reads `Records › <name>` while it is open; its first crumb
shuts it, in place. My pick: the trail is in the app header, not in the panel
— say if you want it in the panel.
`T-a-current-row-opens-its-details` · `T-one-overlay-panel-at-a-time`

### `[x]` ✅ 145 — The details panel, tidied

Will, 2026-09-30: the panel's header buttons are too small, and Figma has an
Overlay Panel Header variant to follow; a selected row wants the active
surface, with the focus grey mixed over it; and *"the overlay panel shouldn't
show a scrim behind it. It's whole purpose is for quick-peek drill down
functionality while still working in the primary content space."*

**✅ Done 2026-09-30.**

- **The header, as Figma's Container Header `Variant=Panel`** (911:32577).
  The close and collapse buttons are `sm`, 24 px, in EVERY container header:
  Figma has them so in all three variants. The panel's expand and pop-out
  are one bordered group, the details' up and down another, with a divider
  between each and before close. A divider shows only with a control on both
  sides of it.
- **No scrim.** The element, its rule and its part are gone.
- **Rows.** Selected is the active base; hover and focused are a grey MIXED
  over whichever base the row has. The old selected rule never matched —
  `:checked` does not match a custom element — so a ticked row had no fill.
- **Firefox, the same day.** It never re-read the selected rule — a `:has()`
  after `:host(…)` — so a ticked row kept its old fill there. The grid marks
  the row `data-selected` now, and CSS selects that.
  `T-firefox-never-rereads-a-has-after-host`
- **An empty forwarded slot no longer reads as filled**, in `SherpaElement`:
  the panel's empty description slot drew an empty strip under every heading.
  `T-slot-guards-only-when-filled`

❓ **One ruling left — the title's ink.** Figma's Panel variant inks it
link-blue. Will's call of 2026-09-15 was the DEFAULT ink: blue "reads as
something you can click when it isn't". Kept as ruled; say if Figma wins now.

---

## H — The accessibility gate

### `[x]` ✅ 24 — Playwright must test accessibility — WCAG 2.1 AA

Every component, level AA. None today; `axe-core` is not a dependency.

**The output is a REPORT, one per component**: for each failure, what is
wrong, which criterion it breaks, and HOW to correct it.

Prove the checker reaches inside a shadow root before trusting a green
result — one that reads the light DOM sees almost nothing of a Sherpa
component. Its first finding is fixed: a HOST `aria-label` named nothing
(`T-a-host-label-must-reach-its-control`). Assert names with `getByRole(…,
{ name })`, never the attribute.

**✅ Done 2026-09-30.** `npm run test:a11y` runs axe-core (a new dev
dependency) over one realistic fixture of each of the 64 components, at WCAG
2.1 A and AA. A test proves axe reads inside a shadow root, one asserts a host
label by role, and one fails when a component has no fixture. Each run writes
`test/a11y/reports/<name>.md` (not tracked): the rule, the criterion, the
element, and how to correct it. `test/a11y/baseline.json` holds the known
failures, and a count may only fall. The first run found failures in 22
components. Six are clean now: nav rows are named in a collapsed rail, a tab
names its panel by text, the overlay panel's resize edge states its value, a
transfer list's two lists are named, and a blank calendar cell is hidden from
a reader. 16 are left: 117 and 118.
`T-the-a11y-gate-reads-shadow-roots`

### `[x]` ✅ 117 — Clear the accessibility baseline — 12 components with a structural failure

Each is in `test/a11y/baseline.json`; run `npm run test:a11y` and read its
report in `test/a11y/reports/`. Fix one, then `npm run test:a11y:update`.

**🚧 2026-09-30: 11 of 12 are clean.** One is left, and it needs a choice.

| Component | Was wrong | Now |
|---|---|---|
| barchart, line-chart | the plot was `role="img"` over focusable marks | ✅ a `group`; each bar is named `Pro: 12` |
| sparkline | the same, with hover dots as buttons | ✅ the dots are not controls |
| calendar | a `gridcell` with no `row` | ✅ cells sit in `role="row"` boxes, `display: contents` |
| chart-legend | a button with `role="listitem"` and `aria-pressed` | ✅ a `group` of toggle buttons |
| list, list-item | a `<ul>` whose children are not `<li>` | ✅ `role="list"`; a slotted row is a `listitem` |
| menu, notifications | `role="menu"` held inputs and buttons | ✅ a named `dialog`; triggers say `aria-haspopup="dialog"` |
| select-card | a `role="radio"` host held a live, unnamed radio | ✅ its own footer controls are `inert` |
| transfer-list | a `listbox` whose options held a checkbox | ✅ two named plain lists |
| **filter-panel (accordion)** | buttons inside a `<summary>` | ❓ below |

`T-a-menu-is-a-dialog-of-native-controls`

**❓ Will — the accordion's `actions` slot.** A `<summary>` is a button, and a
button may not hold buttons. The filter panel puts `Filters` and `Save filter`
there.
- **A (my pick):** the actions move to the first row of the BODY. Native
  `<details>` stays. They hide when the section is shut.
- **B:** the actions stay in the header row, shown when shut. Then the
  accordion drops `<details>` for a `<button aria-expanded>` and a panel.

**✅ Ruled, Will 2026-09-30:** *"There is an item to move the Filters button
to the filter panel header. We can move the save filters button to the first
row of the body of the accordion."* So: `Filters` leaves the section with 124,
and `Save filter` goes to the first row of the section's BODY. Then nothing is
in the `<summary>`, native `<details>` stays, and the last baseline entry
goes. Do it with 124.

**✅ Done 2026-09-30, with 124.** Nothing a reader can press is in a scope's
header now. `Save filter` is the first row of the scope's body, at the right.
The panel audits clean, and its entry is out of `test/a11y/baseline.json`.
Twelve of twelve. What is left in the baseline is four colour-contrast
failures: that is 118.

### `[x]` ✅ 118 — Four texts fail colour contrast — the success green, and a field's description

WCAG 1.4.3 needs 4.5:1 for small text. Measured by the gate (24):

- **Success text is `#00ad62`: 2.93:1 on white.** A success chip, a metric's
  `+12.5%`, and a success toast's message.
- **A field's description is `content-body-2` (`#b3b3c3`): 1.7:1.** That is
  the colour a DISABLED control uses.

Both are Figma values, so they are yours to change.

**❓ Will — which?**
- **A (my pick):** darken them in Figma. Success text to a green at 4.5:1 or
  more on white, and the description to the body text one step lighter than
  the label. I re-project, and the four baseline entries go.
- **B:** keep the colours. The four stay in the baseline as known failures.

**✅ Ruled, Will 2026-09-30: A** — *"but determine if the aliasing chain can
be mapped back to a darker shade rather than directly applying new hex
values."* So: no new colour. Follow each token's alias chain in Figma to the
ramp it points at, and re-point it to a darker STEP of that same ramp that
reaches 4.5:1. Only if no step does, say so and ask.

**✅ Done 2026-09-30, with no new colour.** Both moved one step darker on
their own ramp, in Figma first:

- **Success text:** Style `style-content/base`, mode `success`, pointed at
  Theme `content/success/+1` (`#00AD62`, 2.93:1). It points at
  `content/success/base` now (`#006B37`, about 6.6:1) — as Active already
  points at `content/active/base`. Re-projected.
- **A field's description:** the ALIAS was not the fault. Theme `body/+2`
  is the disabled grey, and moving it would move every disabled text. Two of
  Figma's six inputs — Input Text and Input Number — bound their description
  to `body/+2`; the other four bind `body/+1`, one step lighter than the
  label. Those two now bind `body/+1` too, and so does the code.

The a11y baseline is empty now: no known failures. **One more of the same:**
the Transparent look's success text (`style-transparent`, a hand-kept
override collection) still points at `success/+1`. No text wears it today;
say if it should move too.

---

## I — The big builds

### `[x]` ✅ 67 — A UTILITY layer: `sherpa-router`, on the Navigation API

Will, 2026-09-26: *"We have a presentation layer and data layer that are
working great together. We need to further enhance sherpa with a utility
layer. The first candidate … will be a Sherpa Router web component for
handling navigation. It should use the Navigation API extensively."*

**Where routing lives today: the example app.** `examples/index.html` does it
by hand — `history.pushState` / `replaceState` at four sites, a `popstate`
listener, `urlFor()`, `contextFromURL()`, `hrefParam()` and `loadContext()`,
23 lines of the page touching the URL. Nothing in `src/` routes. Since
2026-09-29 `loadContext()` also OPENS each page from its definition
(`provider.open()`) — so a router is the one place that takes a URL to a
page: its definition, its View, its data.

**The router owns the URL**, one owner for one value: which Context, which
View, and whether Settings is open over them (`?context=records&view=risk&settings=profile`,
CLAUDE.md "Navigation terms"). A nav row, a breadcrumb, the View chip and
browser Back all REQUEST a navigation; the router intercepts it
(`navigation.addEventListener('navigate', e => e.intercept(…))`), updates the
URL, and reports what changed. The shell and the Context listen; none of them
touches `history`. Settings-over-a-Context stays one navigation with two
parts, so leaving Settings never reloads the Context.

To settle when it starts: the Navigation API is not in every engine the tests
run (check Chromium, Firefox and WebKit on the day), so decide the fallback —
`history` + `popstate` behind the same surface, or require it. And where a
utility lives: a component in `sherpa-ui`, or a third entry point beside
`sherpa-ui/data` — it needs a DOM, so not the DOM-free one. This is also most
of 37's step 4: an example app that routes through the library can leave it.

**✅ Done 2026-09-30.** `sherpa-router` is component 65, exported from
`sherpa-ui`. It owns the URL's `data-params`, keeps every other parameter, and
reports `route-change` with what changed. `data-overlay="settings"` makes a
Settings link open OVER the Context it was pressed on. `route`, `href(route)`
and `go(changes, { replace })` are its JS API; its arithmetic is
`src/core/browser/route.ts`, pure. The two things to settle: **the Navigation
API is required** — all three engines have it, probed today — and **it is a
component in `sherpa-ui`**, beside the provider. The example app routes
through it: its four `history` sites, its `popstate` listener and its two
link-click listeners are gone, for one `route-change` listener. One behaviour
changed: a Context row pressed while on a later View goes to the first View.
`T-the-router-owns-the-url`

### `[x]` ✅ 136 — A FIND input, and an optional Find & Replace

Will, 2026-09-30: *"A variant of the search input, a Find input, that locates
string matches and allows the user to jump to the next/previous match using 2
stepper buttons, like the numeric sherpa input has.*

*This Find input should also support an optional 'replace' attribute. This
adds a third 'Find & Replace' button (pencil icon) to the input field.
Clicking this button opens a menu with an input to enter a replacement value
into.*

*The menu should have footer with buttons for Replace, Previous, and Next.*

*Replace should be in a button group with an icon only menu button that
exposes a 'Replace all' menu item in a menu. Clicking Replace will replace the
currently focused match. Clicking Replace all will replace all matches with
the new value.*

*Replace all should throw a confirmation dialog before actioning.*

*We can use the Find (without replace attr) for the data grid toolbar's
'search' input on the right and show it in the examples.*

*We might need a future example page to show Find & Replace in action. I have
designs for a WYSIWYG text area editor that I'll want to implement eventually
but we're not there yet."*

Builds on the number field's steppers (127) and the grid's match marks (21c).

**✅ Done 2026-09-30.** `sherpa-input-text data-type="find"`: the search
glyph, "Find" when empty, and two steppers — Previous and Next — flush to the
edge, as a number's are. Enter is Next and Shift+Enter Previous. With
`data-replace` a pencil opens Find & Replace: a "Replace with" field, then
**Replace** in a group with a ▾ that holds **Replace all**, and Previous and
Next. Replace all asks first, in a dialog. The field cannot see what it
searches, so each button ASKS its host (`find-step`, `find-replace`).

**On Records** the Find sits at the right of the grid's toolbar. What you
type is the search: the rows narrow and every hit is marked. Previous and
Next move a stronger mark from hit to hit; past a page's last hit it opens
the next page, and it goes round from the end. `T-a-find-asks-its-host-to-step`

Three things I chose — say if any should change:

- **It still narrows the rows**, as the search it replaces did. A browser's
  own find only marks.
- **No "3 of 12" count.** You did not ask for one; the host can set
  `data-matches`, and at `0` the steppers go inactive.
- **Replace is not on any page yet** — nothing in the examples holds text to
  replace. The component asks; a page does the replacing.

### `[x]` ✅ 68 — `sherpa-templater`: templates fetched and swapped live, out of `SherpaElement`

Will, 2026-09-26: Sherpa's equivalent of hot reloading is fetching and
modifying HTML templates — *"this might be mashing 2 concerns together. So I'm
open to having a Sherpa Templater component that does this. I think we do all
of the template stuff in sherpa-element currently so it would be good to be
able to offload that and slim the base UI component down."*

**What would move out of `sherpa-element.ts` (948 lines):** `loadHtml()` and
`loadSheet()`, the `templateCache`, `#resolveTemplate`, `#stamp` /
`#restampIfVariantChanged` and `variantAttrs`, and `#adoptStyles`. What stays:
props, slots, `emit`, `$` / `$$`, the lifecycle — the part every component
needs. `T-rendered-settles-even-when-the-markup-does-not` and
`T-template-id-read-once-was-permanent` move with the code.

**Hot reload** is then the templater's job: re-fetch a changed template or
sheet, and re-stamp every live instance of that component — keeping its
attributes, slotted content and state, as a variant re-stamp does today. 27
(a consumer's OWN templates and CSS) is the same door from the other side:
"use this template instead" and "this template changed" are one mechanism.
Do 27 with it.

**✅ Done 2026-09-30, with 27.** The fetching, caching and splitting of
templates and sheets moved out of `sherpa-element.ts` into an imported
helper, `src/core/ui/templater.ts` — a helper, not a component, since a
component extends `SherpaElement` alone. The base keeps props, slots,
`emit`, `$` / `$$` and the lifecycle.

**Hot reload.** `SherpaElement.reload(tag)` fetches a component's files
again. A sheet changes IN PLACE — the one shared sheet object — so every
element restyles at once and nothing is drawn again. Changed markup is
stamped again, as a variant is. **In the example app it is live**: run
`npm run build:watch`, and a saved component file redraws that component on
the open page, with no page reload. **Restart the :4200 server once** — the
route (`/live/files`) is new. `T-a-templater-owns-the-files`

Not done: the Templater also turning a View's JSON into a template (the
memory of 2026-09-27). Views still carry markup; that is a separate step.

### `[x]` ✅ 27 — A consumer can supply their OWN templates and CSS

Someone building with Sherpa-UI must be able to give a component their own
HTML template, and their own CSS that EXTENDS the default rather than
replacing it. Make it possible, and easy.

In `src/core/ui/sherpa-element.ts`, `static css` / `static html` are plain
`URL`s a subclass can re-point, and the template cache is keyed by `href`. Half
the door is open. Missing: a "default, then mine" CSS order; an API that is not
subclass-and-redefine; and a check that a custom template still provides the
parts, slots and classes the JS and CSS expect — the `.component.yaml`
anatomy is the natural thing to check against. Do it with 68: "use my template" and "the
template changed" are one mechanism.

**✅ Done 2026-09-30, with 68.** One call, no subclass:

```js
import { useTemplate } from 'sherpa-ui';
useTemplate('sherpa-tag', { html: '/my/tag.html', css: '/my/tag.css' });
```

Your markup replaces the component's; your sheets come AFTER its own, so
they extend it and win. Your markup is checked against the component's
OWN template file, not the spec: each template id, part, slot name and
class it has — its code reaches for them. What yours lacks is reported
(`template-missing`), never thrown. `T-a-templater-owns-the-files`

### `[x]` ✅ 25 — `sherpa-layout-canvas` — an infinite canvas content area

Pans and zooms without an edge, on a CROSSHAIR grid pattern. A floating button
group at the BOTTOM RIGHT: Pan, Zoom in, Zoom out, Options (a menu). Compose
from `sherpa-button` and the menu; do not hand-roll either.

**A minimap** shows the whole canvas and where the viewport sits; the user
moves the viewport from it. PART OF the canvas, not its own component: it needs
the canvas's pan and zoom, and a separate element would be a second owner of
one value. Split it out only if a second host wants one.

**✅ Done 2026-09-30.** `<sherpa-layout-canvas>`: it pans and zooms with no
edge, on a crosshair grid that moves and scales with it. Content sits where
its `--x` and `--y` say. Pan, Zoom in, Zoom out and Options float at the
bottom right as one group; Options holds Fit to content, Zoom to 100% and
Hide minimap. The minimap, at the bottom left, draws each piece and the
view; a press or a drag on it moves the view.

A wheel pans, and Ctrl or ⌘ with it — a trackpad pinch — zooms about the
pointer. The arrows pan, + and − zoom, 0 is 100%. With the Pan tool on, a
drag anywhere pans; off, only a drag on the empty canvas does, so the
content keeps its own clicks. The canvas owns its view and reports each
move (`canvas-change`). `T-a-canvas-owns-its-view`

Two things to know:

- **There is no hand icon** in the icon set, so Pan wears
  `diverging-arrows`. Say which icon you want, or add a hand to Figma.
- **It is on no example page yet** — the sandbox that showed it was
  removed 2026-10-01. 78, the workflow creator, is where it would live.

### `[x]` ✅ 26 — A `Grouped` mode for the content area

Every container in the content area reads as ONE stitched object: gutters
`0px`, MID rounding on every container, only the top-most keeps its own.

**Will's ruling: this is `sherpa-group` applied to the layout grid.** The work
is how the two meet — `<sherpa-layout-grid>` owns the tracks, `<sherpa-group
data-direction="grid">` the joins. Likely: the layout grid gains a
`data-grouped` that gives up its gaps and applies the group rules.

**Ask first (Will, 2026-09-24): are we re-inventing the grid?** A scenario is
spread over `data-rows`, `data-row-count`, a named `data-col-span` and a
`data-row-span` per child, and JS for `data-grouped`. A named
`grid-template-areas` per scenario, each child naming its AREA, might replace
most of it. Find what it cannot do — spans re-scale per breakpoint; the fit
grid's last row takes the rest — before building either.

**The Grouped mode is BUILT** (measured 2026-09-30): `<sherpa-layout-grid
data-grouped>` drops the gutters, writes each child's grid position
(`grouped-grid.ts`, from laid-out geometry), and only the four OUTER
corners stay round. Tested in `reforged-layout-grid.spec.ts`.

**Your question — are we re-inventing the grid?** Measured against
`grid-template-areas`. Areas CAN do a fixed layout per breakpoint in one
string, with row spans and no JS. They CANNOT do three things the grid does
now:

1. **An unknown number of children.** Areas name every cell; four metric
   tiles or seven are the same markup today.
2. **A lone last item that widens** to fill its row — the generated
   `:nth-last-child(… of …)` rules in `tokens.css`.
3. **Spans from Figma.** The names (`full`, `large`, `medium`, …) and what
   each spans per breakpoint are PROJECTED from the layout tokens, so a
   re-export moves every page. Areas would be hand-written per page.

**❓ One choice:**
- **A (my pick): keep the grid as it is.** Nothing is re-invented: it is CSS
  grid with Figma's span names. Close 26.
- **B: add areas beside it**, as an opt-in for a FIXED layout
  (`data-areas`, a template per breakpoint), for a page whose parts never
  change.

**✅ Will, 2026-10-01: A.** The grid stays as it is; the Grouped mode was
built already. Nothing left.

### `[ ]` 170 — MAJOR, later: the data layer on the client, the server, or both

**Do not start this until Will says.** Everything else comes first.

Will, 2026-09-30: *"Consumers of sherpa should be able to choose to run the
whole, or parts of, the data layer on the client and/or server side.*

*For example Sources and Stores could live on the server, while Filter/Query
components could be client side.*

*Or a filter/query component could run on both sides. Client side handling
immediate front end changes. Server side handling the shaping of data before
sending responses.*

*Everything else can come before this exploration. Note it but don't start it
until I say."*

What is there to start from, when he does: `sherpa-ui/data` already has no
DOM (the lint boundary and a node test hold it), and the Query is plain JSON.

---

## J — Tidy-ups and renames

### `[x]` ✅ 11 — `sherpa-group`: what is left

`<sherpa-group>` is BUILT (2026-09-23), but only `sherpa-pagination` uses it.
Measured 2026-09-26, all three still open:

1. The 16 generated `grid-*` / `vertical-*` blocks are still in
   `sherpa-group-positions.css` AND `tokens.css`, with 0 callers. The wrapper
   derives those positions; they can go.
2. `.sherpa-border-edges` / `.sherpa-border-corners` are not grouping — 21
   components use them. Move them to their own `sherpa-borders.css`.
3. The `.sherpa-group` class is still used in calendar, menu,
   quick-filter-toolbar and select-checkbox.

**✅ Closed 2026-09-30 — measured again, nothing left to build.** Say if you
want any of it anyway.

1. **The `grid-*` and `vertical-*` blocks have callers now.** The layout
   grid's grouped mode (`grouped-grid.ts`) writes `grid-top-*` and the rest,
   and `SherpaElement` lists them as `data-group` values.
2. **The edge and corner classes ARE grouping.** They read the
   `--sherpa-border-*` variables that a grouping position writes — the other
   half of it. Their own sheet would be a ninth in every shadow root, for a
   name.
3. **The class stays where it is.** `.sherpa-group` is CSS only, by
   position; `<sherpa-group>` is for a grid, whose positions must be told.
   CSS before JS.

### `[x]` ✅ 28 — A Figma component is NOT always a web component

A sub-component is often only a `<template>` in its parent's `.html`, or a set
of CSS classes. `sherpa-grid-cell` is the clear case.

1. Sweep all components: real element, template, or CSS only.
2. For each that is not a real element, cost the fold — spec, MCP, tests,
   Figma link.
3. Fold the clear ones. Start with `sherpa-grid-cell`.

**`sherpa-nav-section` is the same question** — still composed by nothing
(only exported and listed in the sandbox). `sherpa-nav` draws its own label
and rule. Compose it (the nav mirrors `data-collapsed` onto each section — one
`setAttribute`), fold it, or leave its 65 correct lines. A Figma component
stays a Figma component either way.

**Measured 2026-09-30.** Step 1 is done already, in
`scripts/figma-data/name-map.yaml`: 52 Figma components are elements, and 28
more are a parent's template or a composition (`figmaOnly` — the Calendar
Button, the File Item, the Input types, and the rest). Two are left, and
neither is clear:

- **Grid Cell.** `sherpa-grid-cell` is composed by nothing: the grid draws
  its own cells, and the grid's spec already maps Figma's Grid Cell. But the
  name map (2026-09-02) says the grid is to be REBUILT from Grid Cells, and a
  grid can compose it inside each `<td>`.
- **Nav Section.** The nav heads each section with a real `<h2>`;
  `sherpa-nav-section` draws a `<span>`. Composing it would lose the
  heading. My pick: leave it as it is.

**❓ One choice, for the Grid Cell:**
- **A (my pick): fold it.** The grid's own templates are Figma's Grid Cell.
  One element per cell would be about 350 shadow roots on one Records page.
- **B: keep it**, for the rebuild of the grid from Grid Cells.

**✅ Will, 2026-10-01: A.** *"Grid cell is a necessary figma component, for
content variants, but it's just css styling in code."* `sherpa-grid-cell` is
folded: gone from the source, the index, the sandbox, the a11y fixtures and
the state pins. Figma's Grid Cell maps to the grid's own cells, and the name
map no longer says the grid waits on a rebuild. The Nav Section stays as it
is.

### `[x]` ✅ 30 — Do we still need `icon-paths.ts` and `render-icon.ts`?

Will, twice: *"HTML & CSS should be handling this."*

**The first answer's main reason is STALE.** It was "the TS carries each
icon's INK BOX, and the files' 14x14 frame draws them 15% small". But
bbe7c2ef (2026-09-24) reversed that: an icon now renders at its 14x14 frame,
the same `viewBox` its `.svg` already has. So the files are enough as they
are, and `render-icon.ts`'s header comment (line 4) is now wrong.

What still stands: the `.svg` files do not ship (no `dist/icons/`), and 48 of
76 icon sites take a name from OUTSIDE the component
(`data-icon-start="gear"`), which a static template cannot cover. Options: a
sprite sheet (`<use href="#gear">` — check across a shadow root), or a CSS
`mask-image` set coloured by `background-color`. Measure, then choose.

**Measured 2026-09-30, in Chromium, Firefox and WebKit**, inside a shadow
root with an adopted sheet, on a two-colour icon (a disc with a white tick,
as `status-ok` is):

| | the disc | the white tick |
|---|---|---|
| sprite: `<svg><use href="icons.svg#ok">` | the text colour ✓ | white ✓ |
| mask: `mask: url(ok.svg)` + `background` | the text colour ✓ | **the text colour ✗** |

So a MASK cannot draw a two-colour icon — the tick disappears. A SPRITE can,
in every engine, and a file reference crosses a shadow root fine.

What neither removes: a name from OUTSIDE (`data-icon-start="gear"`, 48 of
76 sites) still needs one line of JS, to write `href="…#gear"`. What a sprite
DOES remove: `icon-paths.ts` is 314 KB of JavaScript in every page, parsed
before anything draws. A sprite is a file the browser caches.

**❓ One choice:**
- **A (my pick): a sprite.** `generate-icons.mjs` writes `dist/icons.svg`
  (one `<symbol>` per icon, in its frame); an icon is `<svg><use href>`, and
  `renderIcon` shrinks to writing that one `href`. A small list of names
  stays, for `hasIcon`. The icon tests read the sprite instead.
- **B: keep it as it is.** It works; its cost is the 314 KB.

**✅ Will, 2026-10-01: no sprite.** *"SVGs are fine for now. They are
temporary until we connect a FA license."* Kept as they are.

### `[x]` ✅ 33 — Density as step offsets, and a breakpoint step

Will, 2026-09-23: in code, two scalings would do what Figma's remapped modes
do — by BREAKPOINT (bigger on touch), then by MODE (compact / comfortable),
relative to it.

**The rule is measured and holds exactly: a density mode is ONE STEP on the
primitive scale** — compact −1, comfortable +1, clamped at both ends. Steps,
not multipliers: a multiplier leaves the 4px grid at once (×0.8 puts 10 of 12
space values off it), a step cannot.

1. **Emit the scale ONCE** plus a step offset, not three copies of every space
   and size token in `tokens.css`.
2. **Add the breakpoint step**, applied before the mode's. Mobile and tablet
   step UP. It does not exist yet: the layout grid's gap and padding are
   `space-base` at every breakpoint.
3. **Consume `--sherpa-grid-space-step`** — it is emitted and nothing reads
   it but `lint:css`. `round()` against it is for genuinely dynamic sizes only
   (`T-round-is-for-dynamic-sizes-only`).

The density values live in the hand-kept `figma.extensions.json`; read them
live through the figma-console MCP
(`T-an-override-collection-is-keyed-by-its-parent`).

**✅ Step 1 done 2026-09-30 — and it found a bug.** A density already
ALIASED the scale (`var(--sherpa-scale-…)`), one step along. But each density
block also copied the WHOLE ramp — 119 values, colours and borders too — and
then a dark copy of the colours. Read live, Figma's compact and comfortable
override only **27 values: space and size**. The other 92 were a stale copy,
and five of them painted an **old success green** under `[data-density]`
(`#007a45` where the base is `#00ad62`), in light and dark. The file now
keeps only the 27, so `tokens.css` lost 376 lines. Measured in a browser:
with no density nothing changed; with compact or comfortable, only that
green changed, to the true one. `T-a-density-mode-is-one-step`

**Step 3** (consume `--sherpa-grid-space-step`) waits for a size that is
truly dynamic; none is today.

**❓ Step 2 — one choice.** A breakpoint step makes every space and size one
step bigger on a small screen, before density.
- **A (my pick): one step up below 768 px** (a phone), density relative to
  it; tablet unchanged.
- **B: one step up below 1280 px** (tablet and phone), as the item says.
  Every layout and test at a narrow width moves.

**✅ Will, 2026-10-01:** *"Not sure it matters any more."* No breakpoint
step. Step 1 stands; step 3 has nothing to consume it.

### `[x]` ✅ 36 — CSS: compiled where it should inherit?

Will, 2026-09-24: the system is designed on INHERITANCE, so why is so much CSS
compiled? Two generators: the state pins (`state-pins.yaml` → ~21 re-pointed
Style names per line, into `tokens.css` and `sherpa-style-modes.css`, because
CSS has no mixin) and the dist PostCSS transform. Find what can move into
`sherpa-base.css` / `sherpa-element` as inherited rules, and what genuinely
needs a generator.

**Measured 2026-09-30 — each generator earns its place; one has a choice.**

- **The state pins** (`state-pins.yaml`): a pin puts an element in a Style
  MODE, which is about 21 Style names re-pointed at once. Inheritance cannot
  do it: the names must be set ON the element, and CSS has no mixin to name
  the set once (`@mixin` ships in no engine). Setting `data-status` from JS
  instead would be JS for a visual state. Keep the generator.
- **Typography, group positions and tokens** are generated from FIGMA, which
  is their source. Keep.
- **The PostCSS step** does three things: minifies (keep), adds a few
  `-webkit-` prefixes, and — the only real COMPILING — lowers CSS nesting in
  70 of 76 sheets. It lowers nesting because the support list includes
  **Safari 16**, which has none (nesting came in Safari 17.2).

**❓ One choice, the support floor:**
- **A (my pick): keep Safari 16**, and the nesting lowered. It costs
  nothing a reader sees.
- **B: raise the floor to Safari 17.2** — the nesting ships as written, and
  preset-env goes from the build.

**✅ Will, 2026-10-01: B** — *"No-one cares about Safari."* The floor is
Safari 17.2, the nesting ships as written, and `postcss-preset-env` is gone
from the build and the package. Measured: 0 pixels differ on Records,
Dashboard and Settings, in Chromium and WebKit. One thing reads differently:
the minifier now writes a 50% colour-mix as `#rrggbb80`; two chart tests
read that text, and take both forms now.

### `[x]` ✅ 11d — `data-type` means nine things; `data-empty` means three

`data-type` selects: which control element, how many thumbs, pill vs
rectangle, square vs labelled, a look, a template variant, a scope, a
cardinality, a role. `data-empty` is a message string (list), a host boolean
(grid), a per-pane boolean (transfer-list). Both are rulings, not bugs. The
question: reserve `data-type` for TEMPLATE SELECTION, as four of its nine uses
already do?

**Measured 2026-09-30 — one rule already explains all nine.** `data-type`
is **Figma's `Type` variant axis**, as `T-calendar-view-is-not-the-figma-type`
says: whatever Figma calls a component's Type — its control, its shape, its
look — is `data-type` in code, and a design that swaps a Type swaps it here.
The nine "meanings" are nine components' own Type axes. `data-empty` is
three components' own words for "nothing to show".

**❓ One choice:**
- **A (my pick): keep both.** `data-type` stays Figma's Type axis. Say it
  in PRINCIPLES, and a new component names a Type the same way.
- **B: reserve `data-type` for template selection**, and rename the other
  five to new attributes. Each rename breaks the Figma mapping and every
  page that sets it.

**✅ Will, 2026-10-01:** *"Whatever makes most sense for Sherpa."* So A:
`data-type` is the component's Figma Type axis, said once in PRINCIPLES
rule 15. Nothing is renamed.

### `[x]` ✅ 84 — Use the platform: Intl for money, units and deltas; Temporal in the calendar

Will, 2026-09-27: *"No need to reinvent foundational things that we already
get for free."* Measured support is in `QUERY-DESIGN.md` §4. What the repo
hand-rolls today:

| site | today | the platform |
|---|---|---|
| `sherpa-file-upload.ts` | `` `${(bytes / 1048576).toFixed(1)} MB` `` | `Intl.NumberFormat` unit `megabyte` |
| `sherpa-metric.ts` | the delta rounded with `toFixed(2)` | `Intl.NumberFormat` percent, `signDisplay` |
| `sherpa-calendar.ts` | ten `Date` sites of day maths | `Temporal` — a component only runs in a browser |

The DOM-free data layer stays off `Temporal` and `Math.sumPrecise` until Node
has them. The metric's VALUE takes `Intl` options as JSON since provider P2
(`data-format`); its delta and the upload size do not yet.

**✅ Done 2026-09-30.** No hand-rolled formatter or day maths is left in the
three:

- **The metric's delta** is `Intl.NumberFormat` percent, signed, two
  decimals at most, no sign on zero — `+12.5%`, `-4%`, `0%` in English.
- **The upload's size** is `Intl.NumberFormat` units: `512 byte`, `12 kB`,
  `1.5 MB`. The kilobyte is the platform's `kB` now, not `KB`.
- **The calendar** holds the month on view as one `Temporal.PlainYearMonth`,
  and every day, month length, weekday, step and "today" is Temporal's. Its
  month names are the platform's too, in the reader's own language.

### `[x]` ✅ 111 — A spec types every JS property as `string`

Found in 102 step 2 (2026-09-29): `parseClassApi` (`scripts/lib/ts-facts.mjs`)
gives every getter and setter `type: 'string'`, so `sherpa-menu`'s spec says
`reading` and `conditions` are strings, and `open` and `dirty` too. A wrong
type in a contract is worse than an honest gap: read the accessor's own
annotation, and write `unknown` where there is none. Every spec's `jsProps`
moves when it lands.

**✅ Done 2026-09-30.** A property's type is what its accessor says: the
getter's return type, else the setter's argument; a `static config` default
by its literal. 66 properties across 24 specs changed — `reading` is
`FieldReading`, `open` is `boolean`. Three say `unknown`, because nothing in
the code names their type. A `@prop` tag's type still wins where it gives one.

### `[x]` ✅ 81 — Component contracts move from YAML to JSON

Will, 2026-09-27: *"We can probably accept moving the component YAML contracts
to JSON, too."* The same rule as views and queries: JSON is what other
services send and receive. Each `sherpa-<name>.component.yaml` becomes
`.component.json`, still GENERATED, still validated against
`schemas/component.v1.json` (already JSON Schema). What reads the YAML today:
`generate-component-spec`, `validate-component`, `roundtrip-component`,
`resync-figma`, `compile-def`, `code-map`, `figma-harvest-colours`,
`scripts/lib/component-ref.mjs` and `generation/data.mjs`, and the MCP
server (`server.js`, `tools/discover.js`). One sweep, with `spec:check`
proving every contract round-trips the same before and after. The
hand-maintained YAML in `scripts/figma-data/` is a separate question.

**❓ Blocked 2026-09-30 — it needs your permission.** The first step renames
all 66 `*.component.yaml` files to `.component.json` (`git mv`, then write
the same data as JSON). The session's permission check refused that as a
change to shared files, so nothing was changed. Every reader is ready to
switch: they all read through `scripts/lib/generation/data.mjs` (the MCP
server too), plus eight scripts and one unit test that read the file
directly. Say "go on 81" and allow the rename, and I finish it in one
commit, with `spec:check` proving each contract the same.

**Will, 2026-10-01: "go on … 81".**

**✅ Done 2026-10-01.** All 65 contracts are `sherpa-<name>.component.json`
now. Git sees each as a new file — YAML and JSON text differ too much for its
rename check — so a spec's older history is under its `.component.yaml`
name. Each was converted as it stood,
and then the generator — which now writes JSON — was asked if each is FRESH:
65 of 65 are byte-for-byte what the source makes, 65 validate and 65 round-
trip. JSON has no comments, so the "GENERATED by" line is a `$comment` key
(the schema allows it). Every reader moved: the generator, validate,
round-trip, resync-figma, compile-def, figma-harvest-colours, the data
helpers the MCP server reads through, and one unit test. The MCP server reads
them: a `sherpa://def/` resource, `get_component` and `component_api` all
answer. The docs say `.component.json` everywhere. `js-yaml` stays for the
hand-written YAML in `scripts/figma-data/` — the separate question above.

### `[x]` ✅ 29 — Rename `src/index.ts` to `src/app.ts`

It does not hold an index: it registers every component and installs the icons
and tokens — it SCAFFOLDS a Sherpa app. Knock-on: `package.json` `main`
(`./dist/index.js`) and `exports`, the build and `dist/` name, every
`sherpa-ui` import in `examples/` and `test/`, and the MCP server if
it reads the entry by name. Keep `src/data.ts`. **Dead last** — cheapest when
nothing else is in flight.

**✅ Closed 2026-10-13 — overtaken by 221.** `src/index.ts` IS an index now:
it re-exports `components`, `app` and `data`, one line each. And `src/app.ts`
is already the app layer (`sherpa-ui/app`), so the rename would collide with
it. Nothing to do.

---

## K — Agentic UI: much later

Will, 2026-09-27: *"We built an MCP to help with the Sherpa development
pipeline and it's been useful. However, I'd like to support WebMCP as part of
the sherpa framework so that we can create agentic UI components and have them
be able to use agents to perform UI tasks for the user."* Big pieces of work,
all inside the Sherpa Product System's own standards. Each is a CORE, GENERIC
system — like the data layer, or routing and template swapping — never a
feature of one app.

### `[ ]` 76 — WebMCP: agents do UI tasks through Sherpa's own contracts

**DEFERRED.** Will, 2026-09-30: *"we can defer the WebMCP aspect for now."*
Not to be started in the churn; it waits for his word.
**Will, 2026-10-14:** *"WebMCP can be a future feature. Not critical for
sherpa at this time."*

Agentic UI components: a component exposes what an agent may do with it, and
an agent does it for the reader. Will's examples — *"generating data viz and
adding it to a dashboard, creating filter queries based on user request,
generating reports from data pulled back into the Sherpa data layer, and other
cool stuff that I've not even thought of yet."*

What is already there to build on: the MCP server (`mcp-server/`, its drive
tier reaches a live element by name and method), the component specs
(`*.component.yaml`, a component's callable surface), and the QUERY (step 1–6
of 73) — a filter request an agent makes is a Query, validated and compiled
like any other, never a clause it writes itself.

### `[ ]` 77 — CONTRACTED UX patterns, so a generated experience is consistent

*"We will also need well defined, contracted, UX patterns so that any
generated experiences by agents are consistent and useful."*

**Will, 2026-10-14:** *"UX patterns will come later, too, but will be
important. These must not be baked into sherpa but rather be definable, in
some sort of contract, so that consumers of sherpa can add their own patterns
and use them."* So Sherpa ships the CONTRACT for a pattern, and a consumer's
patterns are data under it — Sherpa's own are examples, not the only ones.

A pattern is
data with a contract, as a component is: what it is for, which components it
composes, which states it has, what an agent may change. An agent composes
patterns; it never invents a layout. The CRUD flow, Settings pages as forms,
and the filter scopes are the first ones this repo already has in prose.

### `[ ]` 78 — A node-based WORKFLOW creator

*"A node based workflow creator that can be used to create, edit, and view the
core patterns, as well as any generated workflows in an app, so that we can
merge agentic, generative, thinking with deterministic, contracted,
experiences and outcomes."* It draws on the canvas — 25,
`sherpa-layout-canvas`, which is why Will asked for one. Nodes are patterns
and steps; edges are what flows between them; a generated workflow is shown
and edited the same way as a designed one.

**Will, 2026-10-14:** *"The node based workflow creator is an app using the
canvas and node components. We haven't created the node components or their
logic in sherpa. So that is what we'll have to do here. Again, large piece of
work to do later."* So the Sherpa work is the NODE components and their
logic, beside `sherpa-layout-canvas`; the creator itself is an app built on
them.

## L — The code review

### `[ ]` ❓ 242 — The code review of every component

Will, 2026-10-14: *"Now is the time to do a thorough code review of all of the
components. … Plan all of this in a markdown for review before starting."*

**The plan is [CODE-REVIEW-PLAN.md](CODE-REVIEW-PLAN.md).** Four read-only
reviews and the web research made it. It has eleven bugs found while reading
(four confirmed in the code), then eight phases: gates, legacy, the lexicon,
`SherpaElement`, shared helpers, the data layer, third-party technology, and
docs with a gallery. Once Will rules, each phase's items become rows 243 and on.

**❓ Will — seven choices, in the plan's §0.** My picks: D1 A a native gallery
(stories in CSF, so Storybook can read them later); D2 A `custom-elements.json`
from our own specs, plain HTML only; D3 A private host state as `:state()`; D4
A delete the stored-data shims now; D5 A form and focus plumbing in
`SherpaElement`, opt-in; D6 A native names where a native element does the
same job; D7 A the calendar on `Date` + `Intl` until Safari has `Temporal`.

**Will, 2026-10-14:** *"Let's fix those agent discovered issues and bugs before
we come back to the plan."* So the plan's Phase 0 goes first: items 243–254.

**✅ Will, 2026-10-14 — D1–D7 ruled:** D1 A, with Storybook later in a separate
project that consumes Sherpa; D2 A, with the manifest explained; D3 A; D4 A —
*"Sherpa is app agnostic so nothing relating to constructed applications lives
in this project"*; D5 A — *"Anything generic gets elevated so that it's handled
in a consistent manner. Only edge cases, or bespoke differences, are added at
the individual component levels"*; D6 A; D7 B — *"I don't care about Safari."*
The plan is updated with each, and with three questions their reach raised:
**❓ Q1** the starter out of sherpa-ui (my pick A, yes); **❓ Q2** the hook's
check of Demos moves to Demos (my pick A, yes); **❓ Q3** WebKit stays in the
tests, for the iPhone (my pick A, keep).

**✅ Will, 2026-10-14: Q1 A, Q2 A, Q3 A** — *"We don't specifically target
iPhone but I'd like Sherpa to work for mobile browsers (except Safari)."* The
plan is ruled; its work is rows 256–296, in the plan's order. One small choice
it raised is 255.

### `[x]` ✅ 255 — The calendar on an iPhone

On iOS every browser is WebKit inside — Chrome and Firefox too — so what Safari
lacks, every iPhone browser lacks. Today that is `Temporal`, and the calendar
fails on all of them. Android is fine. Our WebKit tests pass because
Playwright's WebKit build is newer than Safari.

**❓ Will:** A keep D7 — the calendar waits for WebKit to ship `Temporal`; B
D7's other option, the calendar's date code on `Date` + `Intl`. My pick: A —
only the calendar, and mobile is not iPhone first.

**✅ Will, 2026-10-14:** *"Let's support a fallback in the Calendar for iPhone
browsers but use Temporal as the default date and time model for Sherpa."*

**✅ Done 2026-10-14.** `src/core/ui/temporal.ts` is the one door to dates:
`Temporal` where the engine has it, and a stand-in over `Date` and `Intl` for
the part Sherpa uses where it has not — it answers as `Temporal` does (bad text
throws, fields clamp, days in UTC). The calendar uses it. A node test runs the
stand-in (Node 24 has no `Temporal`), and a browser test draws the calendar
with `Temporal` and again with it taken away: the days, months and years match
in three engines. Before, the calendar threw the moment it was made. +1.5 KB
per import that holds the calendar. `T-temporal-is-the-date-model`.

### `[x]` ✅ 243 — A moved component keeps its listeners

A move is a disconnect and a connect. The disconnect aborts `this.signal`, and
`onRender` runs only once — so everything wired there with the signal stayed
dead. Every slot's `slotchange` (so `data-has-*` froze on 66 components), the
slider's 8 inputs and the tooltip's anchor; nav and dialog removed their host
listeners in `onDisconnect` and never added them back. The trap's own text told
components to read the signal in `onRender`.

**✅ Done 2026-10-14.** A listener on the element's own nodes takes no signal;
the tooltip's anchor is wired in `onConnect`. A sweep moves every a11y fixture
and fills each slot; it failed on the old build (the slots, and all four
behaviours) and passes in three engines. `T-abort-controller-per-connect`.

### `[x]` ✅ 244 — Every emitted event is in its spec

The generator read event names with regex, so `this.emit(act)` hid the
toolbar's `filters-save` and `filters-save-as`, the panel's `filters-save-as`
and the prompt-composer's `composer-attach` and `composer-lab`. And it counted
a `new CustomEvent` dispatched on a CHILD as the component's own: phantom
`button-click` on the toolbar and the panel, and `menu-change` on the panel.

**✅ Done 2026-10-14.** TypeScript's checker names each `emit()` from the type
of its first argument (`parseEmits`), so a `case`-narrowed variable, a ternary
and an `as const` table are read. A name that types as `string` fails the
generator; the panel's `` `${id}-change` `` and the app-header's table were the
two, now literals. Only `this.dispatchEvent(new …)` counts as the component's.
A unit test holds it. `T-an-event-name-is-not-always-a-literal`.

### `[x]` ✅ 245 — A deleted saved View stays deleted

`syncViews`' `touch()` wrote Web Storage's views into IndexedDB but never removed
one, so a View deleted from Web Storage was merged back by `all()` and
`restore()`, and published by the next push.

**✅ Done 2026-10-14.** `touch()` removes from IndexedDB what Web Storage held at
the last look and no longer does — never a view only IndexedDB holds (from the
server, or one Web Storage had no room for). A push waits for that write. The
test failed on the old build in three engines. Nothing outside tests calls
`syncViews` yet. `T-local-first-then-onward`.

### `[x]` ✅ 246 — A `RestStore` is remote

Only `spoofRemote()` said `remote: true`, so a source over a real HTTP store
applied every pick live: no draft, no Apply, and a full request per move.

**✅ Done 2026-10-14.** `RestStore` says `remote = true`, so its source keeps a
draft for Apply and is never live. A unit test holds it.
`T-apply-and-discard-wait-for-a-change`.

### `[x]` ✅ 247 — A prop's text never erases a slot

A declared prop wrote into a box that held a `<slot>`, so the write erased the
slot. `skipWhen` skipped it only while the slot was filled. Measured in a
browser, all five cases failed: container-header's guard was `[slot]`, which
no `<slot>` matches, so a slotted icon NEVER showed; a toast's heading and a
gauge's caption slotted after the first render had nowhere to go; and a toast
holding only whitespace showed no heading at all.

**✅ Done 2026-10-14.** The text goes in a span BESIDE the slot (`.glyph`,
`.heading-text`, `.caption-text`), and CSS hides it on `data-has-<slot>`. The
gauge's hand-written caption write became a declared prop. `skipWhen` had no
user left, so it is deleted from `SherpaElement` and CLAUDE.md.
`T-slot-guards-only-when-filled`.

### `[x]` ✅ 248 — Two icons are drawn, not named as classes

`sherpa-notifications` and the grid's row actions wrote an icon NAME into
`className`, from before icons were SVG — so each drew nothing. Both now call
`writeIcon`; the two tests that build them check for a drawn path, and failed
on the old build.

### `[x]` ✅ 249 — A bar's report never rewrites a saved filter

`answerScope` copied each reported saved filter's readings into the source's
library, past `declarePreset`: a bar's stale echo rewrote what the source had
declared, with no facts and no redraw — a component writing state the source
owns.

**✅ Done 2026-10-14.** A report says which are ON; the readings stay the
source's. It teaches the source only a saved filter it has never heard of, and
then through `declarePreset`. A unit test failed on the old build. The weight
baseline records the bytes 245, 246 and 249 added (`data.js` +220 B).
`T-one-query-one-owner`.

### `[x]` ✅ 250 — A saved View keeps the sort in the scope that set it

`export()` put sort and group in the scope that arranged the rows (TODO 99);
`viewQueryOf` — what a saved View, a draft and Save filters are made from —
always put them on the View. So a View saved over a grid's sort said the View
arranged it, and a restore left the source thinking so.

**✅ Done 2026-10-14.** `viewQueryOf` is the source's own `export()`, each
reading in the plain form: one serialiser, not two. A unit test failed on the
old build. `T-group-and-sort-are-component-scope`.

### `[x]` ✅ 251 — `data-refresh` never guesses a source

With two sources, a container's Retry or a bar's Refresh that named none got
`#resolve`'s loud refusal — and then the FIRST source anyway. Measured: a card
over the `invoices` grid reloaded `customers`.

**✅ Done 2026-10-14.** A card reloads the sources of what it holds, as its
state is theirs; any other ask resolves as every ask does, and an unclear one
loads nothing. The test failed on the old build.

### `[x]` ✅ 253 — The search tint is declared once, in the CSS

`sherpa-nav-item` builds its `::highlight()` rule in TS, because each row needs
its own highlight name. That rule carried its own colour — a Theme read
`lint:css` could not see, and a second token for the purple its `<mark>`
already paints.

**✅ Done 2026-10-14.** The tint is two private properties in the CSS
(`--_match-surface`, `--_match-ink`); the `<mark>` and the TS rule both read
them. A test checks the rule has no colour of its own.
`T-custom-highlight-not-painted-in-shadow`.

### `[x]` ✅ 252 — The calendar keeps `Temporal`

**✅ Closed by Will's D7 (B), 2026-10-14:** *"I don't care about Safari."* No
polyfill and no rewrite; the docs say the calendar needs `Temporal`.

### `[x]` ✅ 254 — The line chart's area wash

`.area` fills with the series colour, which is already 50% alpha, at
`opacity: 0.14` — so it draws about 7%. Radial and gauge refuse an opacity on
that token for this reason. In the other themes the fill and border colours
differ in HUE, not only alpha, so moving the area onto the border colour
changes its colour. Figma was not open to read the area's value.

**❓ Will:** A keep today's 7% wash as it is; B give me the Figma value and I
bind it. My pick: B, once Figma is open — a light read.

**✅ Will, 2026-10-14: A** — *"The token used already comes from Figma. The
border colour creates enough contrast between the bar fill and background to be
accessible."* Kept, with a one-line comment so a later review does not fix it.

### `[x]` ✅ 256 — Phase 1.1: `check:props` closes its loophole

A `:host([data-x])` rule passed the gate when any quoted `'data-x'` sat
anywhere in the TS — so a component that WROTE its own private state as an
attribute looked declared. Fifteen did.

**✅ Done 2026-10-14.** The CSS half now asks what `static props` DECLARES, as
the read half did. Of the 15, 2 are public and declared — the provider sets a
container's `data-loading`, and a host may set the nav's `data-searchable` —
and 13 are private, so they are custom states (D3): `SherpaElement` owns one
`ElementInternals` (`this.internals`, which `FormValue` now takes) and gives
`toggleState()` / `hasState()`; CSS reads `:host(:state(name))`. The toolbar's
collapse step is cumulative states. The specs no longer list the private ones.
948 specs of the changed components, the a11y gate and the node tests pass.
`T-private-state-is-a-custom-state`.

### `[x]` ✅ 257 — Phase 1.3: every slot says what it accepts

23 of 121 slots had a `data-accepts`, in words that mixed categories with tag
names. **✅ Done 2026-10-14:** all 121, and the 3 forwarded ones, from one
vocabulary — HTML's content categories `text`, `icon`, `control`, `input`,
`content`, then the Sherpa roles `item`, `menu`, `legend`, `header`, `footer`,
`nav`, `panel`, `dialog`, `toolbar`, `badge`. The spec generator fails a slot
without one or with another word, and the schema lists the same words. The
copies in the `Slots:` comments are gone. **The words join the Phase 3 lexicon
for Will's approval.** `T-a-slot-says-what-it-accepts`.

### `[x]` ✅ 258 — Phase 1.4: one motion gate, held by `lint:css`

CLAUDE.md forbids a component's own `prefers-reduced-motion` block —
`sherpa-motion.css` owns the one gate — but `lint:css` sanctioned it, and
`prefers-contrast` and `prefers-color-scheme` too. **✅ Done 2026-10-14:** a
motion block outside `sherpa-motion.css` is an error (`motion-gate`); any media
query but `forced-colors` is the `viewport-media` warning. No sheet broke the
new rule. `T-motion-is-owned-here`.

### `[x]` ✅ 259 — Phase 1.5: no hand-typed counts in the rule docs

A count typed into a rule doc goes wrong as the code moves. **✅ Done
2026-10-14:** PRINCIPLES' "65 components" (66), CLAUDE.md's "nine core
modules" (it named eight; the lint covers the whole `src/core/data/` folder),
"eight stylesheets" and the MCP's tool, resource and prompt counts now point at
the list or table that holds the truth. PRINCIPLES' doc table gains
`APP-GUIDE.md`, which the MCP serves. TODO's head says the open items are its
⬜ 🚧 ❓ rows, and that a done item keeps its row and section. A count measured
on a date, as history, stays.

### `[ ]` ⬜ 280 — Phase 5: the filter family's async root

The plan's Phase 5 item. **Evidence, 2026-10-14:** Demos' `filters survive a
reload and a trip away` (`reforged-records-persist.spec.ts:164`) sets Status,
then calls `addFilters(['email'])` at once — and the rebuilt bar reports Status
EMPTY, so the source clears it (`status: off`, 27 rows, not 4). Run 10 at a
time it failed 6 of 10 on the build before today's work (`1a8936ca`) and 7 of
10 on today's, so it is old, not new — it is
`T-a-rebuilt-bar-reads-empty-until-its-menus-stamp`. In the full Demos run it
failed once in Chromium and once in WebKit, then passed on retry. 280's fix (the
menu keeps op and text as it keeps `want`) is what ends it; the test is its
proof.

### `[x]` ✅ 260 — Phase 7: `sherpa-ui serve` — nothing downloads to serve a folder

The starter's `npm start`, `npm run preview` and Playwright's web server each
ran `npx --yes serve`: an unpinned package, fetched from npm on every run and
declared nowhere — the one third-party thing a consumer met at run time.

**✅ Done 2026-10-14.** `sherpa-ui serve [folder] [--port N]` is Node's own
`http` and `fs`: a folder serves its `index.html`, each file goes with its type,
nothing outside the folder is served, and it listens on `localhost`. All three
use it. A unit test holds it, and the full browser suite ran against it.
`T-nothing-downloads-to-serve`.

### `[x]` ✅ 261 — Phase 7: the docs and the package say what Sherpa needs

**✅ Done 2026-10-14.** README gains *What it needs*, and APP-GUIDE's first
section says the same: current Chrome, Edge and Firefox, desktop and Android,
are the targets and Safari is not; every iOS browser is WebKit, and Sherpa
brings its own stand-in where WebKit lacks something (`Temporal`); nothing is
fetched at run time; Sherpa loads no font — the tokens ask for Inter, then
`system-ui`; Node 22 for the tooling only. `package.json` gains `engines` and a
browserslist of those targets in place of `>= 0.5%` and Safari 17.2. The build
then drops only prefixes no target needs (`-moz-column-gap`, `-moz-fit-content`,
`-moz-max-content`, `-moz-user-select`, most `-webkit-appearance`) and keeps
the ones iOS still needs (`-webkit-user-select`, `-webkit-mask-*`).

### `[x]` ✅ 297 — BUG: the calendar's header content is misaligned

Will, 2026-10-14: *"Bug; The Calendar header content has become misaligned at
some point. Address when suitable."*

Measured in a menu: in a RANGE calendar the second month's day names sat 6px
above the first month's, and all fourteen crowded together. The build from
before 2026-10-14 drew it the same, so it was older.

**✅ Done 2026-10-14.** Two CSS causes. The second month's captions were shown
with `display: block`, which beat the shared `inline-flex` that centres every
caption in its 32px row; now they keep `inline-flex`. And the width floor
counted SEVEN 32px tracks, so fifteen tracks shrank to 29px; a two-month grid
now floors at fifteen. A test reads each caption's TEXT (its box was already in
place) and each column's width; it failed on the old CSS both ways.

### `[x]` ✅ 262 — Phase 7: `dist/` ships each file once

The build puts every template and sheet in its JS (TODO 208), and then shipped
the 142 files a second time beside it. **✅ Done 2026-10-14.** The build deletes
each file it inlined; only the page `<link>` sheets (`tokens.css`, `page.css`)
stay. Inlined templates drop `data-accepts` — the spec carries it. A reload now
SKIPS a file the JS carries, since it cannot change without a new build; the
full run found that one, `reload()` fetching a deleted sheet, in all three
engines, and the templater spec passes with the fix. The full browser suite
otherwise passed (3,012). The MCP's tooling is 298.
`T-the-text-is-in-the-js`.

### `[x]` ✅ 263 — Phase 7: fewer dev tools

**Measured, 2026-10-14: autoprefixer and cssnano STAY**, against the plan.
iOS still needs prefixes (`-webkit-user-select`, `-webkit-mask-*`), and
autoprefixer reads them from `package.json`'s browserslist, the one place the
targets live. And esbuild's CSS minifier, tried in cssnano's place, made 666 KB
of CSS where cssnano makes 617 KB — about 49 KB more for every consumer, to
drop one tool a consumer never meets.

**✅ prettier and husky are gone.** prettier ran in no gate; its two scripts,
its config and its CLAUDE.md lines went with it. husky only pointed git at its
own folder: the hook is `.githooks/pre-commit` now, and `npm install`'s
`prepare` sets `git config core.hooksPath .githooks`. Dev dependencies: 17 → 15.

**✅ `@types/node` stays out of `src/`:** `tsconfig.reforged.json` says
`"types": []`, and nothing there needed Node's types.

**✅ eslint 9.** eslint 8 is past its end of life. `eslint.config.js` (the flat
config) replaces `.eslintrc.json`, with the same rules and both boundaries —
the DOM-free data layer and the opt-in app layer. Each was proved by a breach:
`document` in `where.ts`, and an app-layer import in a badge, each an error.
Three overrides matched no file that `npm run lint` reads, and went. It adds
`@eslint/js` (eslint:recommended now ships apart). Dev dependencies end at 16.

### `[x]` ✅ 264 — Phase 7: a phone check

Will, Q3: *"I'd like Sherpa to work for mobile browsers (except Safari)."*
Every test ran at a desktop size. **✅ Done 2026-10-14.** A `phone` project — a
Pixel 7, 412 wide, with touch, which is Chromium as Android is — runs
`test/e2e/phone.spec.ts` alone, and the desktop projects skip it. Five checks,
each a thumb's: the shell's nav opens from the header's menu button over the
screen and a row shuts it; a dialog fits and a tap answers it; a button's menu
opens and stays on screen; the filter bar folds into its ⋮, which opens; a wide
grid scrolls inside itself, never the page.

It found one gap at once: **the test harness had no viewport `<meta>`**, so a
phone drew it 980px wide and no phone layout showed. APP-GUIDE's page example
had none either; both have it now (the starter and Demos already did).
`T-the-nav-is-a-menu-on-a-phone`.

### `[x]` ✅ 265 — Phase 7: a dialog opens from markup, by invoker commands

The spike, measured first in all three engines: a plain `commandfor` button,
and a button inside a shadow root carrying `commandForElement`, both deliver a
custom `--show` to the element they name. **✅ Done 2026-10-14.**
`SherpaElement` gains `static commands` (`--name` → a method), answered on the
host; `sherpa-dialog` and `sherpa-overlay-panel` declare `--show` and `--hide`;
`sherpa-button` carries `commandfor` / `command` onto its inner `<button>` in
the click. A test opens a dialog and a panel and shuts the dialog from a button
inside it, with no script, in three engines. CLAUDE.md's CRUD flow and
APP-GUIDE say so. **✅ And the spec, 2026-10-15:** the generator reads `static
commands` into `$extensions.sherpa.commands`, and the MCP's `component_api`
lists them. `T-a-button-commands-by-markup`.

### `[x]` ✅ 298 — Phase 7: sherpa-ui ships no tooling

sherpa-ui shipped eight files of generation code only so the MCP could run
them, and one, `contract-io.mjs`, imported `js-yaml`, which only the MCP
declares. **✅ Done 2026-10-14.** The code keeps its one home in `scripts/`,
where the spec gate runs it. The MCP package copies it into its own `vendor/`
as it is packed (`mcp-server/scripts/vendor.mjs`, prepack; postpack cleans it),
and the copy reads sherpa-ui's data through `SHERPA_UI_ROOT`, which
`lib/sherpa.js` sets. sherpa-ui's `files` lose the five code entries and keep
the data. The node test now checks sherpa-ui packs the data and not the code,
and that the MCP's copy is exactly the code it imports; `npm run
check:mcp-pack` installed both tarballs and called 19 tools, 267 resources and
3 prompts with no failure. `T-the-mcp-reads-sherpa-ui-through-one-door`.

### `[x]` ✅ 266 — Phase 2: no shim for an app's old stored data (D4)

Will, D4: *"Sherpa is app agnostic so nothing relating to constructed
applications lives in this project."* **✅ Done 2026-10-14.** Gone:
`adoptOldFilters` and its `sherpa:filters:` key, read on every page open; the
strip of a pre-105 View's `edits`; `readingsOf`'s pass-through for a reading
stored in a `where` before 197 — now reported (`unknown-op`) and filtering
nothing, and `where` is typed as conditions only, which let one of the two
`READING_KEYS` copies go; the favourites migration for a row with no key; the
`search-change` event's old `detail.search`; and the old saved-View shape,
`SavedView.snapshot` — `saveViewAs` saves the source's Query, and a picked View
with no Query applies its `ui`. `persistView`'s own snapshot is live and stays.
Two kept on purpose: `readingRows`' single-condition form (a Simple typed
answer is stored that way) and a whole Query's `readings`. Nine tests moved to
the current shapes; one that tested a shim now checks it is gone.

**✅ And the docs.** README, APP-GUIDE and CLAUDE.md named Demos as THE
reference in seven places; each states the rule in Sherpa's own terms now, and
names Demos only as one app built that way. A design record that names Demos
(PAGE-DEFINITION's plan, a trap's history) stays: it is history, not a rule.

### `[x]` ✅ 280 — Phase 5: the filter family's async root

The review's cause: `menu.conditions` reads a row's op and text from live
controls that fill later, so about 20 sites wait on frames. **Measured first,
2026-10-15, and the first look was wrong:** reading a menu the harness had
already rendered showed nothing amiss. The fault is at the moment
`menu.rendered` resolves for a chip the bar has just built: its row reads
`{ op: '' }` — the op select has no options — and two frames later reads right.

**✅ Step 1.** A row keeps its `op` and `join` as data, as it keeps `want`; the
getter, the change handler and row one's sync use them
(`T-a-row-remembers-what-it-was-given`). The chip's start-up check lost its
four-frame loop, and `refresh()` its two frames: 945 filter-family tests pass
in three engines, and a test reads the menu at the moment it renders.

**✅ Step 2.** The chip's `#recheckConditions` (a re-read one frame later) is
gone: a row reads right at once now. 954 filter-family tests passed.

**✅ Closed 2026-10-15.** Will: no tests while the components still change. Each
wait left can only be removed with a test run to prove it, so they move to 302.

### `[x]` ✅ 295 — Phase 8.5: `custom-elements.json` and VS Code's HTML data

**✅ Done 2026-10-15.** `npm run manifest` (`scripts/write-manifest.mjs`) writes
both from the 66 specs: the Custom Elements Manifest 2.1.0 (attributes with
their values and defaults, JS properties, methods with parameters, events with
their detail types, slots, parts, custom states) and VS Code's HTML data.
`package.json` names the manifest in `customElements` and ships both files; the
hook's `check:manifest` keeps them fresh; README's *In your editor* gives the
VS Code setting. It found two phantom props — the filter chip's `asc` and
`desc`, kept because the generator took any quoted bare word as an attribute;
now a quoted bare name counts only as a key, a list item or a call argument.
JetBrains' `web-types.json` is not written: nobody asked. Not tested in an
editor yet. `T-the-manifest-is-written-from-the-specs`.

### `[ ]` ⬜ 303 — BUG: breadcrumbs belong in the overlay panel, not the app header

Will, 2026-10-15: *"The app header shows breadcrumbs when an overlay panel is
opened (on grid row focus) but this isn't required. Breadcrumbs should be shown
at the top of the overlay panel when it is expanded to full overlay mode. We
need the maximise & minimise buttons added to the header to toggle these
states."*

### `[ ]` ⬜ 302 — Phase 5: the filter family's last frame waits

Waits for Will's next test run. In the toolbar: `#onConditionChanged`'s second
report, `#keepAnswer`'s two-frame hold, the two frames after `#settled()`, and
the `#settled()` callers; in the panel: the two frames at its apply and
`#editFrame`. **Not** `#onResize`'s frame: that one is layout, not a wait.
Remove one, run the filter family's tests, keep it only when a test fails, and
say why in its comment. Watch Demos' `panel-apply:100`.

### `[x]` ✅ 279 — Phase 3: the lexicon's moves

Will approved `docs/LEXICON.md` whole, with my two picks (the calendar cell
keeps `data-state`; the chip's flag becomes `data-filters-nothing`),
2026-10-15. One commit per row.

**✅ Done 2026-10-15, row 4 held.** `test/unit/the-lexicon-holds.test.mjs` fails
when a spec brings back a retired name; the one difference left is row 4's
`data-state`. It found a generator bug on the way: a prop was kept in a spec
because an INNER element used the same attribute (a calendar cell's
`data-value`), which kept three stale props — calendar and slider
`data-value`, chat message `data-time`. The generator counts only the host now.

- **Row 1, value, range, bounds ✅ (D6):** gauge `data-value|min|max` →
  `value|min|max`; calendar `data-value|min|max` → `value|min|max`; the slider's
  range ends `value-start|value-end` → `data-value-start|data-value-end`, as the
  calendar's. **Metric and toast stay `data-value`:** each is the formatted text
  shown, and the metric's number is its `value` property already. The menu's
  `data-min|max|step` stay (they hand the slider the data's bounds). The props
  gate found two reads and an observed list that the type-checker could not.
  Demos' gauge templates and the gallery's seed moved with it.
- **Row 2, dismiss ✅:** `chip-remove` → `chip-dismiss`, `tag-remove` →
  `tag-dismiss`; `data-dismissible` is a declared boolean on both.
- **Row 3, selection ✅:** select-card is `checked` (attribute, property, and
  `change{checked}`), as checkbox, radio and switch; the default `value` is
  `'on'` on all four.
- **Row 6, padding ✅:** one scale on both axes, `none sm md lg xl` = 0, 4, 8,
  16, 20px, on the theme tokens. The default, with no attribute, is still the
  card's own — the `lg` step, 16px — so no card changes; the lexicon's "md is
  the default" would have shrunk every one. Old block `sm` (8) is `md`, `base`
  is gone (it was the default), and block `lg` (20) is `xl`. Nothing in the
  library or Demos used them but the test.
- **Row 7, slot names ✅:** app-header and the bar, gauge and line charts'
  `title` → `heading` (the radial chart has no title slot); data-viz-header
  `left` → `leading`; nav `brand-icon` → `icon`; empty-state `action` →
  `actions`, and the container's built-in empty and error states with it; the
  `has-*` states follow.
- **Row 4, `data-state` ⏸ held:** input-text's `data-state` is the Figma `input`
  collection's mode attribute, so the rename waits for Figma's queue.
- **Row 5, error, empty, help ✅:** container `data-error-message` →
  `data-error`; notifications `data-empty-text` → `data-empty`; file-upload
  `data-helper` → `data-description`, `data-accept` → `accept`, `data-multiple` →
  `multiple`; select-group `data-multiple` → `multiple`; prompt-composer
  `data-placeholder` → `placeholder`; the chip's flag `data-empty` →
  `data-filters-nothing` (its pin in `state-pins.yaml` and the token CSS follow).
  The props gate caught three `dataset['accept'|'placeholder']` reads that the
  type-checker could not: a native name is read with `getAttribute`.

### `[x]` ✅ 277 — Phase 4: state first

The review counted five hold-until-rendered queues in the filter family
(`#held`, `#early` twice, `#heldValues`, `#heldLabel`). **✅ Done 2026-10-15,
and measured first:** TODO 113's state-first work had reshaped most of them
already, so two remain, and they are two kinds. The chip's `valueLabel` was a
pure hold — written into the caret if it existed, else kept; it is DATA now,
always stored, and drawn once there is a caret, so the getter no longer reads
the page. The menu's `#heldValues` and `#heldRows` stay: once its rows are
drawn they ARE the live answer, because a drill MOVES them to another menu
(`T-drill-moves-not-clones`), so making them data first would copy and lose
that. Whether the menu can keep its op and text as data too is the question
Phase 5's async root answers (280): it is the same cause as the double-frame
waits, and that item takes it up. `T-a-value-before-the-first-render-is-held`.

### `[x]` ✅ 276 — Phase 4: one write door, and a smaller base

D5. **✅ Done 2026-10-15.** A component writes its own `data-*` through
`this.set(...)`: 110 hand writes in 26 components — `dataset['x'] = v`,
`delete dataset['x']`, and `set`/`toggle`/`removeAttribute('data-x')` — are
calls to it now, moved by a script that reads the TypeScript syntax tree, so a
write that spans lines is safe. (Three uses against about 167 was the review's
count; the state moves had taken some already.) `emit(name, detail, { cancelable })`
returns whether the event was kept: `view-reset` is no longer built by hand three
times, nor `select-all-request`. The hand `Number(…)` reads of an attribute are
`this.num()`, and the app header's icon is a declared prop with `as: 'icon'`.
`markNeedles` and `markMatch`, one user each, are `core/ui/mark-text.ts`.
Already done by 274: `mirrorAttrs`. Left: nav and input-text's own icon writes,
which say why in their comments (the host's slot fallback must be emptied
first; the raw-glyph sink). 1318 tests in three engines.

### `[x]` ✅ 275 — Phase 4: private host state is `:state()` (D3)

**✅ The host-private attributes, 2026-10-15.** Nine, each written by its own
component on itself and read only by its own CSS and tests, are custom states:
`has-y-axis` (the bar and line charts, and the shared axes sheet), `has-query`
(nav), `has-files` (file upload), `has-organise` (the filter toolbar),
`has-value` (input text), `dragging` and `panning` (the canvas), `leaving`
(toast). A `:state()` rule is private, so each also leaves the spec. Left, on
purpose, as attributes: `data-touched` (the menu writes it onto a slider, a
cross-component write), `data-has-values` (Demos watches it), `data-empty`
(the generated page-level token CSS selects it), `data-folded` (it carries a
count) and `data-takes`, `data-no-minimap` and `data-searchable` (a host may
set them). 636 tests in three engines.

**✅ `data-has-*`, 2026-10-15.** The base sets a `has-<slot>` state for every
slot, `has-content-slot` for the default one; 27 stylesheets select
`:host(:state(has-icon))`; the tests read `el.matches(':state(has-icon)')`.
The tooltip's and the gauge's own `has-tip` and `has-caption` declarations went,
since the base writes them. The gate's `data-has-` exemption is gone, which
showed one more: the metric's `data-has-values`, which an app watches, is
declared. 1171 tests in three engines, the a11y gate and the phone project.
`T-private-state-is-a-custom-state`.

### `[x]` ✅ 274 — Phase 4: default ARIA, boolean accessors and forwarding, in the base

D5. **✅ Done 2026-10-15.** `static aria` sets a component's default role and
ARIA through `ElementInternals`, so the loader and the callout write no
`role` attribute (an author's own wins); a test reads them by role.
A boolean prop's `accessor` has `define()` install the property: five
hand-written get/set pairs went (list-item, nav-item, select-card), and the
generator lists them. `mirrorAttrs` takes `[from, to]` pairs, and the overlay
panel's and the metric's header loops are calls to it. Not moved: the select
card's role (it sets `aria-checked` as an attribute, so axe needs the role
attribute beside it), and `disabled`/`checked`/`open` accessors, which each
sync an inner part. The plan named app-header for forwarding: it has none.
`T-aria-defaults-live-in-internals`, `T-a-flag-brings-the-base-methods`.

### `[x]` ✅ 273 — Phase 4: form plumbing and focus delegation, in the base

D5: *"Anything generic gets elevated."* **✅ Done 2026-10-15.** The nine
form-associated controls each made their own `FormValue`; five wrote the same
`checkValidity()` and `reportValidity()`; six wrote the same `focus()`.
`SherpaElement` has `formLink`, both validity methods (with a `syncFormValue()`
a control overrides — the radio and the text field do), and `static
delegatesFocus`, the platform's own flag, passed to `attachShadow`: the six
set it and lost their `focus()`. The generator lists what a flag brings, so
the contracts keep the surface — and calendar, file-upload, slider and
transfer-list, which had no `checkValidity()`, now offer it. +490 bytes on
every entry (0.2%), paid once; 273 control tests pass in three engines.
Not elevated: `formResetCallback` (each puts back its own first value) and
the `disabled` accessor (it syncs a different inner part in each) — edge
cases, which D5 leaves in the component. `T-focus-is-delegated-by-the-platform`,
`T-a-flag-brings-the-base-methods`.

### `[x]` ✅ 272 — Phase 8.3: `../Sherpa Gallery`

The plan's 8.3: a sibling project that takes `sherpa-ui` as a consumer does —
native pages now, CSF stories that Storybook can read later, and a fake data
layer.

**✅ A gap it found first, 2026-10-15:** a Context's module was not told WHICH
Context it is — `ctx` had its label, not its id — so one module could not serve
many. The gallery has a Context per component and one module for all of them.
`ctx.id` is its key in `app.json` now, for a Settings page too.

**✅ Done 2026-10-15.** `../Sherpa Gallery` (its `4005aa1`) takes sherpa-ui
as an app does and is a Sherpa app itself: a Context per component, in nav
sections by category, all with one template and one module. Each component
has a CSF file — `export default { title, component }`, stories whose
`render` returns DOM, data through `loaders`, the order in
`__namedExportsOrder` — so Storybook can read the same files later. Seeded
from the specs by the gallery's own seed script, which its test runs with `--check`: the shipped example
(271), a story per enum attribute with its values read from the spec, and a
data story for the nine data components. The fake data layer is forty
accounts, one page definition and a store that is local, slow or failing;
Mode, Density and Data are page switches, kept in the session. Its tests:
every page draws with nothing said wrong, the switches, the variants, and the
data stories in three engines (207), and its app, page and markup pass
sherpa-ui's own checks.

What it showed first: a data story outside a CARD shows no loading or error —
the provider writes those states on the card, by design — so each data story
is a card. And the MCP's drive tools opened `test/reforged/harness.html`,
which is not shipped: they open the gallery now (`SHERPA_GALLERY_URL`, or
`http://localhost:4500/`), and wait up to 5 s for the element, since a page may
draw after it loads.

Not yet: nesting stories (inside the shell, a dialog, a panel, a grid), and
Controls from `custom-elements.json` (295).

### `[x]` ✅ 271 — Phase 8.3: each component ships its example

The plan's 8.3: ONE example per component, shipped beside its spec, as the
one source for the a11y gate, the MCP and the gallery. **✅ Done 2026-10-15.**
The 66 fixtures in `test/a11y/fixtures.mjs` (in `test/`, not shipped) are
`src/components/<name>/<name>.example.json` now, against a new
`schemas/example.v1.json`: the markup, the data each part is populated with,
and the part to open. Long markup is an array of strings, joined with nothing.
The package ships them; the a11y gate and one other spec read them through
`test/a11y/examples.mjs`; the MCP's `get_component` has an Example section
(`include: "example"`), read through `lib/sherpa.js`'s `loadExample`. A node
test checks every component has one, each passes the schema, and its markup
passes the usage check — for which `check-usage.mjs` now exports
`markupProblems()`, one piece of markup. That check found the chat example's
`data-type="person"`, not a value it takes: it is `user`. The a11y baseline
did not move. `check:mcp-pack`: 19 tools, no failure.
`T-a-component-ships-its-example`.

### `[x]` ✅ 270 — Phase 2: dead code, icon leftovers, repo strays

The plan's Phase 2 rows for dead code, icons and the repo. One commit per area.

**✅ Repo, 2026-10-14.** Gone: the four root scratch pages (`leak.html`,
`prop.html`, `risk.html`, `sz.html`); ten `.gitignore` lines that matched
nothing any script writes (`figma-tokens/`, `.git-commit-msg.tmp`,
`.build-metrics.json`, `COMPONENT-AUDIT-REPORT.json`, `coverage/`,
`test/visual/report/`). `docs/Some things to address.md` goes: each of its 12
notes was done already — the 2026-09-26 list (the field header's caps and
buttons, `fullscreen-exit`, Customer and Region in the View, Apply and Discard
that wait, the higher-scope words), 41 (conditions do filter), 43 (the ⋮
menu), 44c (a heading shows a held answer), 49 and 50 (a preset's and a saved
filter's menu), and 126.

**✅ Kept, by Will's ruling (A, 2026-10-15):** the plan named three unused scripts —
`check-tokens.mjs`, `figma-harvest-colours.mjs` and
`figma-extract-component.js`. No npm script runs them, but they are MANUAL
Figma tools, run through the figma-console MCP, and `figma-harvest-colours`
is the check that compares Figma's bound colour with the component's
(2026-09-11). Each header now says it is a manual tool and how to run it;
`check-tokens.mjs` no longer calls itself a CI gate.

**✅ Icons, 2026-10-14.** Gone: `installIcons()`, a public no-op;
`T-fa-pro-renders-nothing`, about a webfont nothing loads; and six comments
that explained a choice by Font Awesome's weights or its resolver. The icon
count in `render-icon.ts` ("all 214" — 216 today) is words now, not a number.
The pass found a real bug, filed as 299: two glyphs still come from the
Font Awesome font.

**✅ Dead code, 2026-10-14.** Gone: three attributes written and read by
nothing (the toolbar's `data-can-add`, a panel field's `data-single` and
`data-removable` — the MENU's `data-removable` is real and stays);
`SHARED_PROPS['data-group']`, which no component spread; the sparkline's
`.point` rule marked "BUG, left as found", which never won its specificity
fight, so nothing renders differently; and seven doc blocks over code that had
gone (two now sit over the code they describe again: `setQuery`'s, and the
chart aggregates' note in `data.ts`). Nine exports only their own file used
lose `export`: `STEERING_EVENTS`, `EXPLODE_AT`, five filters-button names,
`RADIAL_BOX`, `STATUSES`. Kept: `bindGroupedGrid`, a door for a plain
`.sherpa-grid`; and the five test-only helpers 269 made internal — the plan
says internal, not gone.


### `[x]` ✅ 269 — Phase 2: old names, data-API leftovers, component aliases

The plan's Phase 2 rows for filter names, the data API and component aliases.
One commit per area.

**✅ Filter names, 2026-10-14.** The filter modes' old names are gone: the
menu's `OLD_OPT_INS`, `OLD_MODES`, its four old attributes in `observed` and
the CSS for two of them; `OLD_KINDS` and the def keys `custom` and
`conditions`; a chip's `data-kind="custom"`; the grid column's two old keys; a
field declaration's `custom` (in the page schema too); `kind: 'values'`; and
the panel's `picked` copy of `values` in its event. `check:props` loses its
old-name exception. An old word does nothing now, and two tests check that. 24
tests and one doc example moved to `advanced`. `T-a-renamed-attribute-keeps-its-old-name`
is `T-a-rename-drops-the-old-name`, with a was/now table for an app;
`T-saved-filters-are-the-custom-section` is `T-saved-filters-are-the-last-section`.

**✅ Data API, 2026-10-14.** Gone: `persistViewState` (a deprecated subset of
`persistView`), `IdbValidationError` (an alias of `ValidationError`),
`restViewRemote` and its options (no user), and `VIEW_SCOPE` (a second name
for `VIEW`, which is exported). `FieldDeclaration.custom` went with the filter
names. Of the exports only tests called, the doors stay — the stores,
`HttpError`, `syncViews`, `searchRows`, `durationSpan`, `applyViewSnapshot`,
`captureView`, `clearViewState`, `issuesFor`, `datumValue`, the chart
aggregates, `CONDITION_BADGE`, `conditionLines`, `checkViewMarkup`,
`useTemplate`, `createContext` and every component class — and seven go off
the entry point: `MADE_UP` (now private), `isSchema`, `savedReading` and the
allow-list's `isAllowed`, `allowKey`, `unknownEntries` and `nextState`. Their
tests import the module. Four of those seven, and `bindGroupedGrid`, have no
caller in `src/`: 270's dead-code pass decides them.

**✅ Component aliases, 2026-10-14.** Each thing has one name: list-item
`data-heading`, app-header `data-title`, toast `data-message` (its `show()`
writes `data-heading` now), chat-message `data-author`/`-time`/`-content`,
progress-bar `data-value`, list `bordered`, nav `NavItem` and its array
`populate`, notifications `title`, metric `name`, and file-upload's
`files-change` are gone. No alias is left, so `static props` loses its
`fallbackAttr` option, `check:props` its alias exception, and
`T-an-alias-is-declared-by-its-owner` its reason; `T-a-rename-drops-the-old-name`
has the was/now table. CLAUDE.md says there are no aliases. Demos and the
starter used none of them. 11 specs regenerated; 9 test files moved to the
names, and two now check an old name does nothing.

### `[x]` ✅ 267 — Phase 2: the starter is its own project (Q1)

Will, Q1: A. `starter/`, `npx sherpa-ui init` and the MCP's `scaffold_app`
were an app template, with app content, inside the library. **✅ Done
2026-10-14.** The template is the package `create-sherpa-ui` in
`../Sherpa Starter` (its `34415f2`): `npm create sherpa-ui <folder>` runs its
`init`, and its own tests check an app it makes against sherpa-ui's schemas,
`checkApp` and the usage check, and boot it in three engines. sherpa-ui loses
`starter/`, `init` and the two starter tests. The MCP depends on
`create-sherpa-ui` and `scaffold_app` reads its `template/` — the checkout's
sibling when run from here; `check:mcp-pack` packs all three and checks
`scaffold_app` gives `index.html` (19 tools, 267 resources, 3 prompts, no
failure). `T-a-starter-is-one-folder`.

**✅ And a bug it found.** `sherpa-ui serve` did nothing when run through a
link — `npx`, `node_modules/.bin`, a `file:` dependency — and said nothing: its
main-file check compared the link to the real path. It compares real paths
now, as `check-usage.mjs` did, and so does `create-sherpa-ui`'s; a unit test
runs the CLI through a link. `T-a-cli-is-run-through-a-link`.

### `[x]` ✅ 268 — Phase 2: the hook stops checking Demos (Q2)

Will, Q2: A. sherpa-ui's hook ran `check:usage` on `../Sherpa Demos`, so the
library knew a consumer. **✅ Done 2026-10-14.** The hook's block and the
`check:usage` script are gone. The checker SHIPS as a consumer tool,
`npx sherpa-ui check-usage <folder>`, defaulting to the folder it runs in; its
command line is one `checkUsage()`, which the bin and the script share. Demos'
`npm test` runs it first (Demos `687869e`), so a library rename that breaks
Demos still shows — in Demos. A unit test runs the command on a typo and on
clean markup. `T-markup-is-checked-against-the-spec`.

## ✅ Done — the full record

Every finished item keeps its section: what was asked, then what was done.
Newest first. The ledger lists them too, with ✅.

### `[x]` ✅ 104 — BUG: a number filter never applies what is typed or dragged

Will, 2026-09-29: *"Numerical range filters aren't applied on value changes
via input fields or slider handles."*

Proved in a probe: drag a slider handle, or type in the number field, and no
`menu-change` and no `quick-filter-change` leaves the chip. The chip HOLDS the
value — `readings` shows it — but nothing tells the source.

Cause: 45b2f136 (2026-09-25) moved the number body INTO the menu's shadow root
(`T-a-menu-owns-its-own-bodies`), and `#onChange` still listens on the HOST.
The field's native `change` is not composed, so it stops at the shadow root.
The slider's composed `change` arrives retargeted to the menu, so the
`SHERPA-SLIDER` check never matches. `T-native-change-stops-at-the-host` still
describes a SLOTTED body.

The chip test "a NUMBER chip flips between a single field and a two-ended
slider" stayed green because it reads `el.readings`, which ASKS the menu. The
fix's test watches the event. The grid heading's menu and the panel use the
same body — check both. Before 94, which changes the same path.

**✅ Done 2026-09-29:** a number filter applied nothing that was typed or dragged — the body moved into the menu's shadow root and the menu listened only on its host; it now listens on its body, the panel reads a number through the bar's own `bodyReading()`, and one typed number is a pick under `=` — `T-native-change-stops-at-the-host`, `T-one-number-is-a-pick-under-equals`

### `[x]` ✅ 75 — Filter modes are SIMPLE and ADVANCED, not Default and Conditional — every file

**75a built 2026-09-29 — the mode VALUES:** `ConditionType` is `simple |
advanced`; a menu's `data-mode`, a chip's `data-condition`, a filter's kind
(`advanced`), the panel's and menu's mode events, and the Style pins
(state-pins.yaml, re-projected). Old words are still HEARD — `default`,
`custom`, `select`, `condition`, `conditional` — so a saved View or filter keeps
working. **75b built the same day:** the opt-in key is `advanced` (`custom`
and `conditions` still read), the menu's `data-advanced` / `data-advanced-only`
(old names heard), the page schema and `records.json`, the internal class names,
and the labels — the switch reads **Advanced**. **Left: 75c** — docs, TRAPS
and test titles.

Will, 2026-09-27: *"We need to move away from using the terms Default and
Conditional for filter modes. Instead we should use 'Simple' and 'Complex'."*

| mode | is |
|---|---|
| **Simple** | ONE field, with one or more values to choose from |
| **Advanced** | ONE OR MORE fields, with one or more values to choose from, and conditional parameters in use |

**Advanced, not Complex** — Will, later the same day, choosing A of "Advanced" /
"Complex" after writing "Advanced" in 90.

The new ontology goes into EVERY file: code (`mode: 'default' | 'custom'`,
`data-mode`, `condition: 'custom'`, `custom:` opt-ins), UI labels (the
"Conditional" switch), tests, docs, TRAPS and the specs. Do it in one sweep,
after step 6 of the Query, so the features in D (49, 50, 46) are built in
the new words. Note: Advanced allows SEVERAL fields — today a condition is
over one field, so the rename also opens that door.

**✅ Done 2026-09-29:** the filter modes are **Simple** and **Advanced** in every file — values (75a), the opt-in key `advanced`, the menu's `data-advanced` / `data-advanced-only` and the labels (75b), then docs, TRAPS and test titles (75c). Every old word is still HEARD, so a saved View or filter keeps working — `T-a-renamed-attribute-keeps-its-old-name`

### `[x]` ✅ 101 — ADVANCED: a condition row will not add in a chip's menu; in the panel, changing a row's condition drops the row

Will, 2026-09-29: *"I can't add more conditions to an advanced filter. In the
filter toolbar menu the row just doesn't add. In the filter panel, the row
adds, but changing the condition type results in the row being removed."*

Two faces, probably one cause. Start at `sherpa-menu`'s `#onAddCondition`
(`#addRow()` then `#emitConditions()`): the report goes to the source, and the
source draws the field's reading BACK onto the menu. A new row has no text
yet, so it is likely not part of the reading, and the redraw drops it — in
the chip at once, in the panel once its condition changes. An unanswered row
is the reader's work in progress, never an answer to throw away — the same
family as `T-a-rebuilt-bar-reads-empty-until-its-menus-stamp`.
A test for each face: add a row in a chip's menu, and change a new row's
condition in the panel.

**✅ Done 2026-09-29:** an Advanced condition row would not add in a chip's menu, and in the panel a row's condition change dropped it — the source draws every field's answer back with its ANSWERED rows only, and the menu rebuilt from that; now an answer that matches the rows the reader has answered keeps every row — `T-an-unanswered-row-survives-a-redraw`

### `[x]` ✅ 61 — BUG: Add customer saves with required fields empty

Will, 2026-09-26: the Add customer dialog let him save with Name and Email
empty. `#f-name` and `#f-email` carry `required`
(`examples/templates/records.html`), and `sherpa-input-text` has `validate()`,
`checkValidity()` and `data-error` — but the Save handler
(`examples/contexts/records.js`, `#save-btn`) asks none of them. Worse, it
FILLS the blanks: a blank name becomes `New customer`, a blank email a made-up
`new.customer@example.com`.

**Use and handle required-field logic, once, for every form.** Save checks
every field, shows each one's error, focuses the first invalid one, and saves
nothing until all pass. Prefer the platform: a native `<form>` and
`reportValidity()` reach a shadow-DOM input only if it is form-associated
(`ElementInternals`) — check `sherpa-input-text` first. The fallbacks go.

**And did it save at all?** Will could not tell. `store.insert` runs, but the
new row is created TODAY with status `trial`: the header's Date chip (2024
data), the current view, the sort or the page can each hide it. Measure with
`source.debugState().total` before and after. Then make the result visible —
the toast says where the row went, or the grid shows it.

**✅ Done 2026-09-29:** Add customer saves with required fields empty — the dialog is a real `<form>`; the four form controls take part in it (`FormValue`), Save submits it, and the browser refuses an empty required field and points at it; nothing is filled in for the reader, and the toast says when the page's filters hide the new record — `T-a-form-value-follows-every-write`

### `[x]` ✅ 92 — Navigating SETS UP the content — its definitions, data layer, filters and state — not only swaps the template

Will, 2026-09-27: *"When the app shell navigates to new content we shouldn't
only be swapping the content area content/templates. We need to be getting
and setting the definitions, data layer etc. to ensure all the correct filters
are available, shown, and in the correct state. Same goes for all other view
content. We're probably already doing this somewhere but there are gaps. I
assume the new provider comes into play here."*

Today each Context's `init()` does it by hand — make a source, declare its
fields, give the provider its source, restore the session's Query, draw the
bars — and anything a Context forgets is a gap (the Dashboard gave the
provider no source until P2). Yes, the provider: a Context DEFINITION (JSON —
its sources, fields, scopes, Views and template) handed to it on navigation,
so it sets up the data layer, answers every component, and restores the
state. Provider P4 (definitions) and 70 (a view definition renders the page)
are its halves. First: audit where it is done today, and list the gaps.

**Audited 2026-09-27 — `PROVIDER-DESIGN.md` §10.** Two gaps fixed: a page with
no data shut the panel (G1), and the Dashboard keeps its Query (G2). Open: Save
view on Records (G3, TODO 15), and the Context DEFINITION that ends the
repeated setup in every Context (G4) — **designed in `docs/PAGE-DEFINITION.md`,
decided by Will 2026-09-29.** D1, D2 and D3 are built: the router
opens every page from `examples/definitions/<context>.json` through
`provider.open()`, and a Context's `init` gets its source.

**✅ Done 2026-09-29:** navigating sets up the page — the router opens each Context from `examples/definitions/<name>.json` through `provider.open()`: its source, fields, scopes, saved filters, the header's chips, each bar's Add list, the grid's configuration and the kept Query. D1 `edec11a6`, D2 `ce3aaa4f`, D3 `eeb5e37a` — `T-a-page-is-its-definition`

### `[x]` ✅ 85 — `sherpa-provider`: a component ASKS for data, a scope, a query, a View or a template

**Designed — `docs/PROVIDER-DESIGN.md`, for Will's review.** Will, 2026-09-27:
*"Why can't any component ask for data, a definition, a conditional query
definition or a template from the data layer?"* — the Context Protocol
(choice A), a provider over a subtree, and each request can subscribe. It was
designed in `FILTER-REVIEW.md` §9–§12 on 2026-09-25 and never built. Step 8
of the Query folds into its P2. Target: `records.js` 853 → ~250 lines of code,
`dashboard.js` 222 → ~50. Closes most of 37 and 38.

**P1 built `ffc48935`** — the provider, the Context Protocol, the grid and
pager ask. **P2 built** — charts, tiles and legends DECLARE what they need
(`aggregate`, `segments`, `series`); the pages lost their adapters. The
centralisation audit is `PROVIDER-DESIGN.md` §9, for review; its items 9
and 13 are done. **P3a and P3b built** — fields declared once on the
source; the bars ask for their scope and report their holds. **P3c built**
— the panel asks for its scopes, drawn whole by `describe()`. Also fixed on
the way: 93 (only the View trickles down), 87 and 88. **P3d built** — the
grid headings answer through the source. **P3e built** — a component's own
filter is `data-readings`, and a View pick keeps it. **P4 built** — the
provider keeps the Views and the session's Query; a View's content asks for
its data. **P3 and P4 are done:
`records.js` 1163 → 655 lines since P2 began, `dashboard.js` 331 → 170 (the
size gate's count, comments in).** **P5 built** —
a page's state goes out and comes back as JSON. **The provider plan (P1–P5) is
done.** **Next:** 91 (the shell owns panel mode) and 92 (navigating sets up
the content), then the §9 items that P3 unlocked, and 86 (the full audit).

**✅ Done 2026-09-29:** the provider, P1–P5 — a component ASKS and the nearest provider answers; `records.js` 1163 → 326 lines, `dashboard.js` 331 → 107 — `T-a-component-asks-its-provider`, `docs/PROVIDER-DESIGN.md`

### `[x]` ✅ 73 — EXPLORE: one compiled QUERY, built as the reader sets it up, run on Apply

Will, 2026-09-26: *"A query language that is compiled as conditions
(grouping, sorting, filtering, conditions, segmentation, aggregation etc.)
are built up. The data layer compiles this query then executes it when
triggered (e.g. user clicks apply). The aim here is to avoid reloads,
refreshes, state changes etc. causing a loss of set up parameters. The data
layer can probably also use this query to help inform other UI components
alongside the component state tracking feature. We probably have a
proto-version of this going already but it needs work if we do."*

**The proto-version, as it stands:**

| piece | where | what it is |
|---|---|---|
| `ViewState` | `data-source.ts` | filter, sort, group, search, page — one flat state |
| named parts + field readings | `DataSource` (`contribute`, `select`) | the filter is COMPOSED from them, and `state.filter` is the composed result |
| the clause grammar | `store.ts` (`Filter`, `andFilter`, `picksClause`) | the query's filter language |
| `FieldReading` → clause | `filter-state.ts` (`fieldState`, `readingClause`, `clauseConditions`) | a reader's answer as data, compiled one way |
| aggregation | `aggregate.ts` (`reduceRows`, `countBy`, `seriesBy`) | run by hand in the example's `as` closures |
| `debugState()`, `ViewSnapshot` | source, `persist-view.ts` | the query read back, and saved |

**What is missing:** the query is not ONE object. Filter parts, readings,
sort and group live in the source; segmentation and aggregation live in each
Context's code; and `state.filter` is the compiled OUTPUT, which is why a
restored one showed rows no chip explained (21e). A single query — every
parameter, in the reader's own terms, compiled on demand — could be the one
thing that is saved (21e), shared (70's view definition), applied on a
trigger (62's remote Apply), and read by every control to draw itself (38
step 3). Design it with 70; 62's "only a remote fetch needs Apply" decides
when it runs.

**Will, 2026-09-26: DESIGN FIRST.** One short design covering 73, 70 and 62
together — the query object, the view definition, and when Apply runs — as a
page Will reviews before any of it is built.

**The design is written: `docs/QUERY-DESIGN.md`** (2026-09-26). **Decided the
same day:** a View is markup + a JSON Query; "remote" is on the STORE, spoofed
by a wrapping store in the data layer; build steps 1–5 first (one owner), then
6–8. Building now, one step per commit.

**Steps 1 to 7 are built (2026-09-27)** — see `QUERY-DESIGN.md` §10 for what
each did and what is left. The source holds the Query; the bars, the open
panel, the header, the legends and the grid headings are drawn from it; the
session saves and restores it. Will's choice A: a heading filter wears its
field's normal chip, so the `col:` and external chips are gone. Step 6 gave a
remote store a draft, Apply only for a remote fetch, the pending chip and the
footer's "nothing to save" (62, 46, 66). Step 7: a saved View is JSON — its
Query onto a clean slate, its defaults on the chips — Records and the
Dashboard. **Next: step 8** — segment and aggregate in a component scope.

**✅ Done 2026-09-29:** one Query, steps 1–8 — step 8 (segment and aggregate) became provider P2's declared summaries — `T-one-query-one-owner`, `docs/QUERY-DESIGN.md`

### `[x]` ✅ 70 — EXPLORE: a view definition bundles its filters; one JSON renders the page

**Designed with 73 — see `docs/QUERY-DESIGN.md`.**

Will, 2026-09-26, ruling on 21e: a View change is a clean slate (both bars
empty their filter chips) — *"but default filter fields, values, and states
need to be bundled in a view definition. I'm not sure how we'd do that with
our templates. So perhaps we need a JSON definition that gets translated to a
template and data layer requests for all components. Something to
investigate."*

**What a view definition holds today** (`SavedView`, `persist-view.ts`): a
label; a `snapshot` — the source's state plus, per element, a map of public
METHOD CALLS (`applyViewSnapshot`; the Dashboard's EMEA view sets Region this
way); and optional `content` markup, parsed through an allow-list
(`parseViewMarkup`). What it CANNOT say: which filter chips each bar HOLDS,
nor their default values and on/off states — the Context's own code decides
those (`DATA_FILTERS` and `globalFilters()` in the Records example).

**The question:** one JSON definition per View that declares, for every
component, what it is, where it sits, which fields it offers, and each
field's default answer — and a translator that turns it into the template AND
the data-layer requests (`declareValues`, `hold`, `select`, `contribute`).
Then a View change applies the view's own defaults onto the clean slate, and
Save (15) writes the same shape back.

Settle before building: is the JSON a superset of `SavedView` or its
replacement; how it meets the templates (68's templater, 27's own
templates); and how much of it is 38's "a component DECLARES the data it
needs". Design first — 15 builds on the answer.

**Settled 2026-09-27: ONE JSON definition** (`T-a-view-is-json`). Built for
Records and the Dashboard in step 7 of 73: `{ label, query, ui }`, applied
onto a clean slate with its defaults on the chips; `saveViewAs` saves the same
shape. Left: a view's LAYOUT as JSON, which the Templater (68) turns into a
template — `content` markup stays until then — and Save a View (15).

**✅ Done 2026-09-29:** a View is ONE JSON definition, `{ label, query, ui }`, applied onto a clean slate. Its layout as JSON is 68's; saving it is 15's — `T-a-view-is-json`

### `[x]` ✅ 47 — More than 20 values: one chip, not a run

A panel field with more than 20 values draws the toolbar's single chip, with a
dropdown of its values, not one chip per value. **89 moves the line to 16**, for the bar
and the panel alike. It is the flag 38's builder
already needs: whether values EXPLODE into a run or stay behind a menu.

**✅ Done 2026-09-29:** more than 20 values, one chip — merged into 89, at 16

### `[x]` ✅ 93 — A grid-scope filter narrows the charts and tiles too

Found while building the provider (85), 2026-09-27, and fixed at once — it had
no section of its own. A filter set at GRID scope narrowed every summary on
the page, not only the grid. Only the View's filters should reach everything.
Commit 6bcc4f23.

**✅ Done 2026-09-27:** a grid-scope filter narrowed the charts and tiles too — only the View trickles down now; a summary is under the View alone — `T-only-the-view-trickles-down`

### `[x]` ✅ 91 — The APP SHELL switches Filter toolbar and Filter panel modes, for any View in the content area

Will, 2026-09-27: *"The app shell should be able to toggle between Filter
Toolbar and Filter Panel modes for any View that is showing in the content
area."*

Today Records wires it by hand: `togglePanel`, `setPanelMode`,
`syncPanelled`, the reopen and restore code, and the session's
`/filters/mode`. The shell already owns WHERE the panel sits
(`T-the-shell-owns-the-panel-areas`), so it owns the MODE too — for whatever
content it shows, with no page code. With provider P3c the panel asks for its
own scopes, so the shell needs only to open it.

**✅ Done 2026-09-27:** the provider owns TOOLBARS or PANEL for every page — Configure opens the panel on the Dashboard too; the app keeps the choice — `T-the-provider-owns-the-panel-mode`

### `[x]` ✅ 62 — Apply and Discard only for a REMOTE fetch; a debug flag spoofs one

**Designed with 73 — see `docs/QUERY-DESIGN.md`.**

Will, 2026-09-26: *"Apply and Discard are actions that are only needed if
there is a data fetch that reaches outside the Data Layer. If the change is
just shaping data that's already in the data layer then there's no need."*

- **The panel footer goes.** A field whose change needs a remote fetch shows a
  small, ICON-ONLY Apply and Discard at the right of its section header row,
  beside Clear. Every other field applies as it is changed.
- **The same rule reaches a chip's menu.** Its Apply/Cancel (`commit: true`,
  `data-commit` — Owner and Region today) is only for a remote field too.
- **"Remote" is a fact about the FILTER**, so it is on the filter def and
  asked of the data layer — never guessed by a component.

**There is no remote source, so spoof one.** A DEBUG attribute/property on a
filter pretends that its change fetches from a remote source — a delay, and
optionally a failure. Sprinkle it into the example filters so both paths are
always on screen. 58 (loading, empty and error states) reuses the same flag to
drive its loading and failure states.

Before 46: a pending state only exists on a field that has an Apply, and this
item decides which fields those are. `T-apply-and-discard-wait-for-a-change`
changes with it.

**✅ Done 2026-09-27:** Apply only for a REMOTE fetch — locally every pick applies at once; `?remote` spoofs a remote store; the panel's footer is gone, a remote field has its own Apply and Discard — 7c7cdf5c, 9294cfd6, c92adec0, `T-apply-and-discard-wait-for-a-change`, `T-commit-follows-select-mode`

### `[x]` ✅ 46 — A PENDING state: changed, not yet applied

A chip that goes straight to active before its change is applied misleads the
reader. Between the change and Apply, a chip is PENDING: an active purple
BORDER, no fill. A conditional chip is the same — it turns green only once
applied. Only a committing (Apply) field has a pending state — after 62, that is a
REMOTE one; a field that applies at once goes straight to active.

A state is a pin, as data (`scripts/figma-data/state-pins.yaml`), not a
colour rule in the chip. Check what the pin's surface resolves to first.

**✅ Done 2026-09-27:** a pending chip wears the active edge and no fill — 6050eddf, `T-a-pending-chip-has-no-fill`

### `[x]` ✅ 66 — The footer owns "nothing to save": Save and Cancel wait for a change

Will, 2026-09-26: wire the inactive Save & Cancel (or Apply & Discard, or any
equivalent pair) into `sherpa-container-footer`, *"so that all menus etc can
inherit this common behaviour."* Today each host does it by hand, or not at
all: the filter panel built its own (`#syncDirty`,
`T-apply-and-discard-wait-for-a-change`), and `sherpa-menu` has a `dirty`
getter its footer does not use.

The FOOTER turns its commit and revert controls off while the host says
nothing has changed, and on when it has. The host only REPORTS dirty — one
attribute or property, e.g. `data-dirty` on the footer, or a `dirty` it asks
of its host — and never touches the buttons. Nine templates compose the
footer (calendar, dialog, container, filter panel, menu, nav, overlay-panel,
panel, select-card); each then drops its own copy. Which buttons are the pair
must be declared, not guessed from their labels.

Do it with 62: 62 decides WHICH fields have Apply and Discard at all, this
decides how any such pair behaves.

**✅ Done 2026-09-27:** the footer owns "nothing to save" — a committing menu's Apply and Cancel wait for a change — 23094c86, `T-the-footer-owns-nothing-to-save`

### `[x]` ✅ 39 — The panel header gets Reset all filters

A button in the filter panel's header that resets BOTH scopes, View and
component, in one press. It and the toggle-to-toolbar button (`.to-toolbars`)
take the DEFAULT button look, not transparent.

**✅ Done 2026-09-26:** the panel header's Reset all clears both scopes, and both header buttons wear the default look

### `[x]` ✅ 53 — A conditional chip's tip says "X conditions applied"

Will, 2026-09-26. The tooltip of a conditional chip reads `3 conditions
applied` (`1 condition applied` for one). Count ANSWERED rows only — an empty
row is not a condition. Today the tip spells the chain (`Contains: ab or
Equals: churned`, `spellConditions()`); the `fx` button (49, 50) is where the
rows themselves are read now. The badge is NOT a condition count — Will
changed that ask for 60.

**✅ Done 2026-09-26:** a conditional chip's tooltip says "X conditions applied" — `T-a-condition-tip-counts-its-rows`

### `[x]` ✅ 40 — A switch has no accessible name

`sherpa-switch` does not pass an `aria-label` to its inner `role="switch"`
input, and its visible text is a sibling span. So the Range and Conditional
switches are unnamed to a screen reader. Mirror `aria-label` onto the input,
or label the input by the text beside it.

**✅ Done 2026-09-26:** a host's `aria-label` names its inner control — button, input, checkbox, radio, switch; 59 template sites + 18 in code were unnamed — `T-a-host-label-must-reach-its-control`

### `[x]` ✅ 17 — Breadcrumbs are for workflow, not for the nav

Breadcrumbs must not show movement between Contexts — the nav does that. They
are for a workflow redirect or a drilldown, e.g. a link in a grid cell opens a
details Context.

**Still wrong, measured 2026-09-26, and small.** Records and Assistant set a
`Home › Records` / `Home › Assistant` trail (`examples/contexts/records.js`,
`chat.js`) — Home is the Dashboard Context, so the trail IS nav movement.
Drop both; Dashboard already sets `[]`. The first real trail comes with a
drilldown (23).

**✅ Done 2026-09-26:** no breadcrumb trail on Records or Assistant — moving between Contexts is the nav's to show

### `[x]` ✅ 57 — The filter panel's width is a hard-coded 400px

Found by the 2026-09-26 audit. The shell's panel areas read
`--sherpa-panel-area-width`, which is defined NOWHERE
(`sherpa-app-shell.css:130`), so it is always its 400px fallback. The comment
there says 4 columns.

**Will, 2026-09-26: 3 columns — and KEEP the shell's panel areas.** *"We need
to consider the other containers in the view and their responsiveness. The
left/right panel areas that we have might be the better solution (it works
well right now, tbh)."* So the panel stays in the app shell's left area,
OUTSIDE the content's layout grid, and the grid's containers keep their own
breakpoints. The change is the width: define the token as 3 of the layout
grid's columns plus their gutters, per breakpoint. Then check, with the panel
open, that every container in Records and Dashboard still re-flows as it does
with the panel shut — the grid is narrower, not re-counted. Fix the comment
to say 3.

**✅ Done 2026-09-26:** a shell panel area is exactly three grid columns wide, worked out in CSS; the shell's panel areas stay — `T-the-shell-owns-the-panel-areas`

### `[x]` ✅ 65 — A horizontal legend has a max width, and is centred

Will, 2026-09-26: a horizontal `sherpa-chart-legend` spreads its entries across
a whole 12-column container — far too wide to read as one key. Give it a
max width and centre it horizontally in its container. A token for the width,
never a hand-typed px; check it in the Dashboard's wide charts.

**✅ Done 2026-09-26:** a horizontal legend is capped at 40rem and centred; narrow, it fills — `T-a-horizontal-legend-is-three-by-two`

### `[x]` ✅ 41 — BUG: a conditional filter applies for Owner only

Will: *"Conditional filters don't apply or go active at all for any field other
than Owner."* Owner is the only chip def with `custom: true`
(`examples/contexts/records.js`); every other conditioned field arrives through
the Filters (Add) menu or a column heading. Look first at how an ADDED field,
or a heading's condition, reaches the source.

Reproduce on the running page and read the TOTAL
(`source.debugState().total`), never the drawn page. Try the same field as a
toolbar chip, a panel field and a column heading. Fix 63 in the same pass.

**A lead, measured 2026-09-26.** The panel's Apply (`records.js`) sends the
four `FIELD_CHIPS` — Status, Plan, Tier, OWNER — through `source.select()`,
and every other field through `bar.setChipReading()`. That sets
`menu.conditions` SILENTLY: the chip's value and tooltip are not redrawn
(a probe read an empty tip and value after it). Owner working and the rest not
is exactly that split.

**✅ Done 2026-09-26:** conditions DID filter — Owner, Name and Email, in the toolbar and the panel (Owner Contains Da: 100 → 10). What failed was the chip's FACE after a panel Apply: no value, a stale tip. A silent steer now calls the chip's `refresh()` — `T-a-silent-steer-still-redraws-its-chip`

### `[x]` ✅ 63 — BUG: a conditions-only field shows the Conditional switch

Will, 2026-09-26: the panel's Email field shows the Conditional switch, but
Email is CONDITIONS-ONLY — there is no list to switch to. The menu already
hides its own switch for `data-custom-only`
(`T-a-filter-answers-by-values-conditions-or-both`); the panel does not. Its
`data-custom-ok` is `!!customOf(def)` (`sherpa-filter-panel.ts`), and
`customOf()` answers `'only'` for Email, which is truthy. So: no switch for
`'only'`, and the field opens in custom mode with its rows showing.

**Fix it with 41**, as Will suggests — both are how a conditioned field is
drawn and answered, and a test that walks every conditioned field's panel,
chip and heading covers both.

**✅ Done 2026-09-26:** a conditions-only field (Email) has no Conditional switch in the panel; its rows show from the start

### `[x]` ✅ 69 — The main header has a back button

From Will's list, 2026-09-26, and fixed at once — it had no section of its
own. The back button on the main header went back between Contexts, which is
the nav's job. Commit 5453f571.

**✅ Done 2026-09-26:** no back button on the main header — it went back between Contexts, which is the nav's job, as with the breadcrumbs; Settings keeps its own

### `[x]` ✅ 56 — BUG: a view change leaves a lit chip that filters nothing

Found by the 2026-09-26 audit. Region = EMEA (27 rows), then the My accounts
view: the Region chip stays `data-current`, but its `global` part is dropped.
12 rows — all of Ravi's; EMEA would be 5. A lit chip must filter, or go off.
21b decides whether the chip SHOULD survive; this is that it must not lie.

**✅ Done 2026-09-26:** a view change resets the header chips the new view does not set — Region no longer stays lit over My accounts; this is 21b's default — `T-a-view-change-resets-the-header-chips`

### `[x]` ✅ 21e — BUG: a reload keeps a filter nothing on screen shows

Will, 2026-09-24:

> Filters & conditional filters need to survive page refreshes and navigating
> away and coming back. So they need to be compiled and stored in the data
> layer. They don't need to survive the session.

**Half-built, and wrong.** Measured 2026-09-26: `persistView` stores the whole
filter as ONE flat query. Region = EMEA + Status = active (4 rows), reload:
still 4 rows, but parts `{}`, selections `{}`, and no chip lit. Navigating
away and back is the same. The rows obey a filter the reader cannot see or
clear.

**What to store is the COMPILED form, per field** — each field's picks,
conditions and suspended flag, plus the named `contribute()` parts. That is
what a reload must give back to the chips, and what `ViewSnapshot` will want.

| | |
|---|---|
| WRITE | on every `quick-filter-change` / `condition-change`, keyed by Context |
| READ | at Context load, BEFORE `bind()` — a bar painted then re-filtered flashes |

SessionStore, not IdbStore: a reload keeps it, closing the tab does not. The
panel-or-toolbar mode already persists this way (`session '/filters/mode'`,
24c3a57c) — done.

**✅ Done 2026-09-26:** filters survive a reload and a trip away, for the session, on the View they were made on — each bar keeps its `answers` and replays them with `restoreAnswers()`; the combined query is never restored; a View change empties both bars' filter chips — `T-a-reload-replays-the-readers-answers`

### `[x]` ✅ 55 — BUG: the At risk view's own column filter never applies

Found by the 2026-09-26 audit. At risk sets
`grid.setColumnFilter(status, ne churned)`, and 9ms later the selection
handler (`examples/contexts/records.js` ~783) calls
`setColumnFilter(status, null)`. So At risk shows 20 rows where it should show
13. And a `col:status` chip stays on the bar, `data-current` with no value,
still lit after going back to All customers.

(The old bug — All → At risk → All left 1 page of 4 — is fixed.)

**✅ Done 2026-09-26:** At risk keeps its own `status ne churned` (13 rows, was 20); going back to All drops the old `col:status` chip — `T-an-empty-selection-never-wipes-a-condition`

### `[x]` ✅ 44b — BUG: a heading holds a whole reading, so a CHAIN shows and applies

The single-condition half of 44 is done (a held condition opens its menu on
the condition, `T-a-heading-menu-opens-on-what-it-holds`). What is left: the
grid's `ColumnFilter` holds ONE condition — an op and a value or picks. So:

- a chain set from outside (`owner contains Da or starts with R`, from the
  chip mirror) is GARBLED — `setColumnFilter` reads `['or', a, b]` as an op
  and a list of picks;
- a chain a reader types INTO the heading applies only its first row
  (`#readColumnFilter` reads `op` and `conditionValue`).

The fix is the model: a column holds a whole `FieldReading` (picks, op, text,
conditions, range, suspended), as a chip does, and the clause comes from the
data layer's own `readingClause`. The grid then stops being a second filter
model.

**✅ Done 2026-09-26:** a heading holds a whole reading — a chain set from outside or typed in shows and applies whole; `clauseConditions()` turns a chained clause back into rows — `T-a-heading-holds-a-whole-reading`

### `[x]` ✅ 71 — BUG: the chart legend's Other menu does not open

Will, 2026-09-26: the Other row's breakdown menu no longer displays. Check,
too, that changing its selections shows and hides those segments in the chart
(`T-the-breakdown-button-shares-the-other-row`,
`T-legend-toggle-is-a-filter`). Suspect first: every `sherpa-button`'s
`.trigger` now carries `anchor-name` for its tip (2cbc6c6d) — check it does
not take the anchor a slotted menu positions against.

**✅ Done 2026-09-26:** the legend's Other menu draws again — an icon button had no menu slot since ad7f91be; unticking a folded category and Apply takes the bar chart 16 → 14 bars — `T-an-icon-button-still-slots-its-menu`

### `[x]` ✅ 72 — BUG: adding a second conditional filter resets the first

Will, 2026-09-26: with Owner already answered by a condition, he added a
second conditional filter — Email — and on Apply the Owner condition was
reset completely. Adding a field REBUILDS the bar (`#addFilters` → `#render`),
and a rebuilt menu reads empty until it stamps
(`T-a-rebuilt-bar-reads-empty-until-its-menus-stamp`); `#keepAnswer` carries
a chip's rows across a rebuild.

**Reproduced 2026-09-26, toolbar, through the real menus:** Owner Contains Da
→ 10 rows, chip on. Add Email → the rebuilt Owner chip comes back OFF — its
rows kept (`mode: custom`, `contains Da`), so it reads as SUSPENDED. Email
Contains `example` → the bar reports, the suspended Owner applies nothing:
100 rows. So the rebuild keeps the answer and loses the ON. Suspect the
rebuilt row reading empty for a tick (`T-a-rebuilt-row-reads-empty-for-a-tick`)
switching the chip off in `#applySelection`, with nothing turning it back on.
Check the panel too.

**✅ Done 2026-09-26:** adding a second conditional filter keeps the first — the toolbar holds a rebuilt chip's answer until its rows fill; the panel draws a conditioned field on its rows and writes them once each menu has drawn — `T-a-conditioned-field-opens-on-its-rows`

### `[x]` ✅ 44c — BUG: a heading shows an answer held at VIEW scope

Region = EMEA in the header lights the grid's Region heading — `#isFiltered`
counts the query's `data-filter-fields` — but its menu shows nothing ticked,
so a reader can pick a contradicting value there. The heading must show the
View's answer.

**Will's ruling, 2026-09-26: shown, but held higher.** As a component chip
whose field the View took (`T-a-superseded-chip-suspends-it-is-never-removed`):
the heading's menu shows EMEA ticked, greyed, with the tip "Filter applied at
higher scope", and it cannot be changed there — the reader changes it in the
header. One owner for one value. Build on 44b: the heading then just holds
the View's reading, read-only.

**✅ Done 2026-09-26:** a heading whose field the View holds shows the View's answer — ticked, greyed, read-only (`sherpa-menu data-readonly`) — via `grid.supersedeColumns()` — `T-a-view-held-heading-shows-and-refuses`

### `[x]` ✅ 42 — BUG: a legend toggle filters the whole view

Will: *"Chart legend toggling is behaving like View scope filtering. They
should only affect their chart."* This was fixed on 2026-09-24
(`bindSelection` `scope: 'component'`, `T-a-filter-applies-down-its-scope`),
so something has undone it. Find what, and add the test that would have
caught it.

**Likely cause, read 2026-09-26:** `reach: 'component'` CONTRIBUTES a named
part (`legend:<id>`) to the SOURCE — and every component bound to that one
source obeys every part. So "component" scope narrows the whole view, not
the chart. A per-component filter needs the part to reach only the component
that owns it (a part keyed to a bind, applied at that bind's push), or its own
source.

**✅ Done 2026-09-26:** a legend narrows ITS chart only — a part can name the one component it narrows (`contribute(key, filter, { only })`), kept out of the shared query; Records' bar chart 4 → 3 bars, the grid stays at 100 — `T-a-component-part-narrows-one-component`

## Done — the one-line log

One line each. The detail is in git and in the trap named.

**2026-09-29, the component API audit (86)**
- 16: the ★ stars the View, not its whole Context — `T-a-favourite-is-a-view`
- 95: a menu takes its Cancel baseline in `show()`, not in the late `toggle` — `T-the-baseline-is-taken-at-show`
- 54: ❓ how a one-value row is removed once its tick means On — two options in the item
- 96: ❓ what fills a narrow grid's slack — two options in the item
- 64: a shut accordion fills with the Style +2 surface
- 100: the Assistant panel shows its heading — `data-heading`, not `data-title`
- 106: a click in a menu's gap is the menu's own; no accordion behind it toggles — `T-a-gap-click-is-the-menus-own`
- 108: a Filters menu row's scope is its description line, with no "in"
- 114: a re-fold that moves nothing keeps the open Filters menu — `T-a-reflow-that-moves-nothing-keeps-its-menus`
- 113 step 1: a saved View waits for a component that has not drawn — `T-apply-degrades-never-throws`
- 113: select-group's value is data, and its ticks are drawn from it — `T-a-value-is-data-the-ticks-are-drawn`
- 113: prompt-composer holds a value set before its first render — `T-a-value-before-the-first-render-is-held`
- 99, 21d: designed; each waits on two choices from Will
- 105 step 1: the Filters menu's section is "Saved filters"; the rest waits on two choices
- 109: Reset is labelled, with a ▾ menu — Reset to default puts back the View's own filters — `T-reset-to-default-is-the-views-own`
- 97: a panel section shows an icon for what it filters — `T-a-scope-says-what-it-shows`; the chart glyph is 115, for Will in Figma
- 60: a chip's badge is the rows its own answer matches — `T-a-chip-counts-its-own-results`
- 49: ❓ how the fx menu shows a preset over two fields; 50 waits on it
- 48: a child menu opens from the whole row, a resting pointer or ArrowRight — `T-a-row-opens-its-child-menu`
- 21c: a chain of conditions marks every string it matched — `T-a-condition-marks-every-match`
- 21f: a panel field can be sent up to the view filters — `T-send-to-view-filters`
- 21b: a field can carry its answer over a View change (`carryOver`) — `T-a-field-can-carry-over-views`
- 20b: the View's Date is a range, bounded by the data — `T-a-range-is-bounded-by-the-data`
- 52, 107: designed / explained; each waits on two choices from Will
- 15: save, save as, save over and delete a View, on every page — `T-a-saved-view-is-the-readers-own`
- 17b: on a phone the nav is a whole-screen menu — `T-the-nav-is-a-menu-on-a-phone`; the Store binding is 116
- 116: ❓ the nav keeps its open Areas, or a full Store binding
- 34: Figma speaks Context; the closed rail follows density from Figma, not an override
- 79: the nav header's Settings and Pin are one composed default group, as Figma draws it
- 58: a card shows its data's state — loading, no data, no matches, an error — driven by the provider — `T-a-container-shows-its-datas-state`
- 9b 🚧: `sherpa-data-viz-header`, from Figma's newer design, on the Dashboard's chart cards; the metric is left
- 14: live alerts over Server-Sent Events move the Dashboard's tiles — `T-a-live-feed-goes-into-the-store`
- 22: an overlay panel is wider, and resizes from its left edge — `T-an-overlay-panel-resizes-from-its-left-edge`
- 23: a grid row opens its details in an overlay panel; the chevrons step it; the trail names it — `T-a-current-row-opens-its-details`
- 145: the details panel follows Figma's Panel header, has no scrim, and a selected row paints the active base
- 145, more: Firefox never re-reads a `:has()` after `:host()`, so the grid marks a selected row itself — `T-firefox-never-rereads-a-has-after-host`
- 24: the accessibility gate — axe-core over a fixture of every component, a report each, a baseline that may only fall — `T-the-a11y-gate-reads-shadow-roots`; 117 and 118 are what it found
- 117: 11 of the 12 structural accessibility failures are fixed; the accordion's actions slot waits on Will — `T-a-menu-is-a-dialog-of-native-controls`
- 67: `sherpa-router` owns the URL, on the Navigation API; the example app routes through it — `T-the-router-owns-the-url`
- 119–142: Will's items, queued as they came; 117 and 118 ruled
- 119: a menu takes no grouping from the grouped button that opens it — `T-a-menu-takes-no-grouping`
- 127: a number input is Sherpa's own, and a gate holds it — `T-a-number-input-wears-sherpas-steppers`
- 127, more: the slider's and the pagination's number boxes are the Sherpa field too; slider fields sit under the track
- 131: the Range switch is reported — `T-range-switch-swaps-not-rebuilds`
- 132: a number filter's reading keeps both shapes — `T-both-shapes-are-kept`
- 137: every filter control shows the Query's answer — seven holes between the toolbar, the panel and the source, one test for all — `T-a-panel-follows-the-query-open-or-shut`
- 142: only the Context scrolls; the header and the panel areas stay put — `T-only-the-context-scrolls`
- 130, first half: a chip says its own answer — number, date, sort and its matches, on a bar, in the panel and on a heading — `T-a-chip-says-its-own-answer`
- 125: a sort's tip names which way
- 147: a tooltip whose text goes shuts whole; an off chip says nothing
- 146, 148: queued — the shell's FIXED panel areas resize by their edge; a reset date chip reads `Unassigned`
- 52: ruled — a data viz scope is one Simple filter, a chip per legend item
- 52: each chart's own scope is in the filter panel — one filter, a swatch chip per legend item; it narrows its chart alone, and ↑ sends it to the View — `T-a-chart-scope-is-its-legend-field`
- 149: queued — the legend's items become swatch chips
- 148: an emptied date range holds no ends — the chip read `undefined` after a Reset
- 121: a panel field's Clear and Send to are one button group
- 169: a View pick keeps a scope's saved filter chips, off unless the View turns one on — `T-a-view-keeps-the-saved-filter-chips`
- 168: a filter that lands in one scope is let go by every other — it is in ONE scope at a time — `T-send-to-view-filters`
- 165: a group's badge counts the rows shown, under the grid's scope and its filter row — `T-a-group-is-a-data-layer-concept`
- 164: mobile starts below 768px; the shell hides the rail and tells the header to show its menu button — `T-the-nav-is-a-menu-on-a-phone`
- 161: the app header's scroll shadow fades, 100ms — the timeline flips a property, a transition follows it — `T-only-the-context-scrolls`
- 163: a panel area is three grid columns, and never under 464px (150% of its width at 1280) — `T-the-shell-owns-the-panel-areas`
- 162: a narrow chart puts its legend below, and a legend strip becomes a list — `T-a-narrow-chart-stacks-its-legend`
- 130: the chip reads, draws and empties its own answer — `reading`, `clear()`, `answered`; the toolbar and the panel's date use it — `T-a-chip-says-its-own-answer`
- 49: every saved filter chip opens a menu that lists its conditions, a heading per field — `T-a-saved-chip-lists-its-conditions`
- 171: the filter panel's search matches a field's name too, and then shows the whole field
- 129: Reset all to default asks first, and can save what is on screen as a View before it resets — `T-reset-to-default-is-the-views-own`
- 172: in the panel, each picked value chip shows its own results; the header keeps the field's — `T-a-chip-counts-its-own-results`
- 128: a gauge zone is named once; its tooltip and its legend row say the same — `T-a-gauge-names-its-zones-once`
- 150: explored — the gauge's score is `100 − mean(health)`; thresholds as a field fact (A) or in a component's ask (B) — ❓ in the item
- 140: a typed text field shows Clear by itself; `data-no-clear` opts out
- 146, 144, 149, 98, 89, 90, 122, 110: planned from a read of the code, each in its item — five carry one choice (❓)
- 124: ONE Filters button in the panel header, for every scope; a row says its scope — `T-a-panel-adds-through-the-bar-that-owns-the-list`
- 117: the accessibility baseline has no structural failure left — `T-an-accordion-action-is-not-a-toggle`
- 144: a View keeps a draft of the filters left on it, for the tab and across sessions; two settings, on — `T-a-view-keeps-a-draft`
- 146 🚧: a panel area resizes by its inner edge, dragged or by the keys, within its min and 33% of the row; kept through a reload. Levels 1 and 2 left — `T-an-edge-resizes-its-box`
- 90 🚧: a number field can go Advanced — number questions, typed values, its answer carried over; dates wait on 21d — `T-a-number-has-advanced-rows`
- 9b: a metric's name is its composed Data Viz Header, as Figma's Metric has it — no rule, an optional icon
- 80: the container header is Figma's one grid — metadata under the title, the chevron leading
- 50: a saved filter's line opens its field; the change applies, unsaved, until Save or Discard — `T-a-saved-filter-keeps-its-edit`
- 111: a spec types a property as its accessor does, `unknown` where nothing says
- 118: success text and a field's description pass 4.5:1 — one step darker on their own ramps, no new hex; the a11y baseline is empty
- 11: closed — the grid positions have callers, the edge classes are grouping's other half, the class is CSS first
- 84: the platform formats the delta and the upload size (`Intl`), and the calendar counts its days (`Temporal`)
- 136: a Find input steps through a host's matches; Find & Replace asks, and Replace all asks first — on Records, the grid's toolbar — `T-a-find-asks-its-host-to-step`
- 68, 27: the templater owns a component's files — your own markup and sheets by `useTemplate`, and a live reload that restyles in place — `T-a-templater-owns-the-files`
- 25: `sherpa-layout-canvas` — an infinite canvas that pans and zooms, with a minimap and four floating controls — `T-a-canvas-owns-its-view`
- 33 (step 1): a density carries only the 27 space and size values Figma overrides; a stale copy had painted an old success green — `T-a-density-mode-is-one-step`
- 26, 30, 33, 11d: closed by Will's rulings — the grid stays, the SVG icons stay, no breakpoint step, `data-type` is Figma's Type axis
- 28: `sherpa-grid-cell` folded — Figma's Grid Cell is the grid's own CSS
- 36: preset-env is gone — the Safari 16 floor went, so nesting ships as written; no pixel moved
- 86 (A7, the headings): a grid heading opens the chip's menu, from the source's own field — `T-a-heading-opens-the-chips-menu`
- 173: no bug — a field's header is one count of its unique rows; a test pins it — `T-a-chip-counts-its-own-results`
- 174 (part): Adventure Works + AMER matched nothing because the Dashboard seed gave each customer one region — fixed; the symbiotic options wait on 110
- 146 level 1: the shell, not the panel, says when there is room for a panel area — a pinned nav counts — `T-the-panel-is-desktop-only`
- 143: EXPERIMENT — scrolled-past metrics become a compact sticky row; Settings › Experiments
- 59: TRIAL — a card keeps its content: a loading bar under its header, a banner for a failure; Settings › Experiments — `T-a-container-shows-its-datas-state`
- 175: the sticky metrics switch in CSS — a scroll-state query at grid padding + one row; sparkline kept, tighter, 14px value
- 81: the 65 component contracts are JSON — `sherpa-<name>.component.json`, generated, validated, round-tripped, fresh
- 146 level 2: the Context's grid steps by its own width — a container twin of every layout band — `T-a-context-steps-by-its-own-width`
- 174 (most) + 176: "Limit filter options" — a ruled-out value is greyed, refused, and says why — `T-a-ruled-out-value-is-greyed`
- 180: a later answer sets aside an earlier pick it rules out — kept, greyed, not applied — `T-a-later-answer-sets-an-earlier-pick-aside`
- 179: a chart legend greys and refuses a ruled-out value, as its chip does — `T-a-ruled-out-value-is-greyed`
- 37 step 4: the example app is its own project, `../Sherpa Demos`, taking sherpa-ui as a dependency by name
- 182: the filter panel's search spans its header, with more room above
- 178: the filter panel's ⋮ — Reset folds into it when narrow; both ⋮ menus hold "Limit matching filters"
- 110: an AND row greys the values the rows before it rule out — `T-an-and-row-offers-what-the-rows-before-it-leave`
- 181: a saved filter's card shows each field's own menu, read-only; Edit filter edits it in place — `T-a-saved-filter-keeps-its-edit`
- 177: cards resize from the layout grid's gutters, by drag or keys; each Context keeps its sizes — `T-a-gutter-moves-a-line`
- 183: how a consumer and an agent build on Sherpa — `docs/CONSUMER-REVIEW.md`; its plan is items 187 to 197
- 185: Sherpa Demos `views/` holds only `*-views.json`; each View's markup is a template the JSON names — `T-a-views-markup-lives-in-a-template`
- 187: the docs and the MCP text say what the code does; `bind()` reports `scope: 'all'`
- 188: a changed key moves the row in every store; one `input` per keystroke; the provider reports skipped keys; lint and the node tests are gates — `T-a-changed-key-moves-the-row`
- 189 (readiness): `settled()` ships for apps and tests; one component imported alone draws right
- 198: a link to a View with cards of its own draws them — `T-content-first-original-once`
- 200: a WebKit flake — the test waited for a word the summary draws before its rows load
- 184: a consumer needs no Node; the package ships `schemas/`
- 170: queued, LAST, on Will's word only — the data layer on the client, the server, or both
- 167: a bar's Reset leaves a chip the View holds as it is
- 166: a saved filter shows its count only while it is on
- 160: a local store checks its rows BEFORE it cuts a page — a refused row left its page short — `T-a-refused-row-never-shortens-a-page`
- 159: while the View holds a chart's field, its legend shows and changes the View's answer — `T-a-legend-follows-the-view-when-it-holds-the-field`
- 158: a View field's Send down offers every scope that has it — a menu where there is more than one — `T-send-to-view-filters`
- 157: every button and chart tip is a popover, lifted to the top layer while it shows — `T-a-tip-lives-in-the-top-layer`
- 156: an Advanced chip wears the plain active styling; no pin, no CSS of its own — `T-a-conditioned-chip-reads-as-active`
- 155: a panel field's Send to buttons show before its first answer
- 152: a grouped grid page holds the pager's ROW count — a heading costs nothing, a shut group one slot — `T-grid-collapsed-group-is-one-slot`
- 153: the Context fills its frame again, so a fit grid's card keeps one height — `T-a-fit-grid-needs-a-sized-parent`
- 154: a chart's section in the filter panel wears the `reports` glyph
- 133: a panel field's header wears its results badge, right of the title; a chart's own field too — `T-a-chip-counts-its-own-results`
- 135: a calendar's Month and Year views disable what holds no day to pick
- 134: a number menu has Reset — the field empties and the handles go back, both shapes; Clear had done nothing to a number — `T-a-number-is-reset-not-cleared`
- 151: a filter moved across scopes keeps its mode — the View's answer wins on the way down, and a menu built at a flip takes the answer as it stands — `T-a-late-built-menu-takes-the-answer-as-it-stands`
- 150: queued — the gauge's risk score, and thresholds in the central Query
- 141: Advanced is an f(x) icon button at the end of a menu's and a panel field's header; the panel's flip reports once its rows are drawn — `T-a-filter-menu-has-two-modes`
- 123: a chip switched off keeps its results badge; the source counts an off answer, and a saved filter, on or off — `T-a-chip-counts-its-own-results`
- 139: a chained chip's face shows its values — `U, an` — not the condition labels
- 138: an Advanced chip, and the text it matched, are info blue again — `T-a-conditioned-chip-reads-as-active`
- 120: a View field is sent DOWN to the one scope that has it, with its answer — `T-send-to-view-filters`
- 126: a filter another scope holds says `Filter moved to View scope.` — `T-an-inactive-chip-says-where-its-filter-went`
- 43: the ⋮ menu holds every folded action, and a view bar's ★ · Save · ▾ folds at last — `T-the-more-menu-holds-what-folded`
- 94: a number menu waits for Apply, and Cancel puts back — `T-a-number-waits-for-apply`
- 83: a picked day turns the committing footer on, and a disabled button acts on nothing — `T-a-disabled-button-acts-on-nothing`
- 82: a number chip set by a View shows its value (`2` for "> 2"); an old "is not X" no longer ticks X as Simple's answer — `T-both-answers-are-kept`
- 45: a date reads one way — `formatDate()`, DOM-free, `03 to 15 Sep 2026` — `T-a-date-reads-one-way`
- 103: a keyless row gets a key from the data layer, kept beside the row and never on it; the grid selects by key and `selection-change` sends keys — `T-a-made-up-key-never-leaves-the-data-layer`
- 102: both answers kept — a filter switches between Simple and Advanced at any time and loses nothing; Advanced mirrors Simple until a row is edited; in the bar, the panel and a grid heading — `T-both-answers-are-kept`
- 104: a number filter applied nothing that was typed or dragged — the body moved into the menu's shadow root and the menu listened only on its host; it now listens on its body, the panel reads a number through the bar's own `bodyReading()`, and one typed number is a pick under `=` — `T-native-change-stops-at-the-host`, `T-one-number-is-a-pick-under-equals`
- 75: the filter modes are **Simple** and **Advanced** in every file — values (75a), the opt-in key `advanced`, the menu's `data-advanced` / `data-advanced-only` and the labels (75b), then docs, TRAPS and test titles (75c). Every old word is still HEARD, so a saved View or filter keeps working — `T-a-renamed-attribute-keeps-its-old-name`
- 101: an Advanced condition row would not add in a chip's menu, and in the panel a row's condition change dropped it — the source draws every field's answer back with its ANSWERED rows only, and the menu rebuilt from that; now an answer that matches the rows the reader has answered keeps every row — `T-an-unanswered-row-survives-a-redraw`
- 61: Add customer saves with required fields empty — the dialog is a real `<form>`; the four form controls take part in it (`FormValue`), Save submits it, and the browser refuses an empty required field and points at it; nothing is filled in for the reader, and the toast says when the page's filters hide the new record — `T-a-form-value-follows-every-write`

**2026-09-29, the page definition (92)**
- 92: navigating sets up the page — the router opens each Context from `examples/definitions/<name>.json` through `provider.open()`: its source, fields, scopes, saved filters, the header's chips, each bar's Add list, the grid's configuration and the kept Query. D1 `edec11a6`, D2 `ce3aaa4f`, D3 `eeb5e37a` — `T-a-page-is-its-definition`
- A field's possible values come from the DATA: the store's schema (`oneOf`, `number()` with `min`/`max`), or else its rows (`declareFromRows`) — Will's decision — `T-the-data-says-what-a-field-may-hold`
- 85: the provider, P1–P5 — a component ASKS and the nearest provider answers; `records.js` 1163 → 326 lines, `dashboard.js` 331 → 107 — `T-a-component-asks-its-provider`, `docs/PROVIDER-DESIGN.md`
- 73: one Query, steps 1–8 — step 8 (segment and aggregate) became provider P2's declared summaries — `T-one-query-one-owner`, `docs/QUERY-DESIGN.md`
- 70: a View is ONE JSON definition, `{ label, query, ui }`, applied onto a clean slate. Its layout as JSON is 68's; saving it is 15's — `T-a-view-is-json`
- 47: more than 20 values, one chip — merged into 89, at 16

**2026-09-27, the provider (85)**
- 93: a grid-scope filter narrowed the charts and tiles too — only the View trickles down now; a summary is under the View alone — `T-only-the-view-trickles-down`
- 91: the provider owns TOOLBARS or PANEL for every page — Configure opens the panel on the Dashboard too; the app keeps the choice — `T-the-provider-owns-the-panel-mode`
- 87 and 88: a field raised to the View stays in its component scope's Filters list, its section keeps its heading and says "Filter applied at higher scope." — provider P3c, `T-a-panel-asks-for-its-scopes`

**2026-09-27, the Query — steps 1 to 6 (73)**
- Steps 1–5: one Query, held by the source, compiled on demand; bars, the open panel, the header, legends and headings are drawn from it; the session saves and restores it — 827cadd8 to b59363d4, `T-one-query-one-owner`
- Choice A: a heading filter wears its field's NORMAL chip; the `col:` and external chips are gone — 731d2bc3, c5d6e513
- Removing a chip clears its filter (it had moved to the View and kept filtering) — 731d2bc3
- 62: Apply only for a REMOTE fetch — locally every pick applies at once; `?remote` spoofs a remote store; the panel's footer is gone, a remote field has its own Apply and Discard — 7c7cdf5c, 9294cfd6, c92adec0, `T-apply-and-discard-wait-for-a-change`, `T-commit-follows-select-mode`
- 46: a pending chip wears the active edge and no fill — 6050eddf, `T-a-pending-chip-has-no-fill`
- 66: the footer owns "nothing to save" — a committing menu's Apply and Cancel wait for a change — 23094c86, `T-the-footer-owns-nothing-to-save`
- Step 7: saved Views are JSON, their defaults on the chips — Records c6166719, Dashboard 6001eb63, `T-a-view-is-json`
- A number chip filters (a Seats range showed and narrowed nothing); the Dashboard's header chips filter; the Capacity view's charts draw — c6166719, 6001eb63

**2026-09-26, Will's list**
- The superseded-chip tip reads "Filter applied at higher scope" — c0f5e32f, `T-an-inactive-chip-says-where-its-filter-went`
- The panel's to-toolbar button uses `fullscreen-exit` — 1e98a823
- Customer and Region moved to the panel's View filters — aba1f583
- Add condition is a labelled default button BELOW the rows — 5b40c4f3, `T-add-condition-sits-below-the-rows`
- A toolbar divider hides with nothing on one side — b80eb9f4, `T-a-divider-needs-a-neighbour-on-both-sides`
- A scope's chevron leads its heading; its buttons ride that row — 8e60cf78
- A field's label is caps and light, its buttons in its header — a161e054
- Apply and Discard wait for a change; a field header keeps one height — 3c1d306e, `T-apply-and-discard-wait-for-a-change`
- A conditioned chip reads as Success, not info — a24d020a, `T-a-conditioned-chip-reads-as-active`
- A Conditional switch moves a filter between its modes — 91fd57be, `T-a-filter-menu-has-two-modes`
- The Conditional switch is its own row, under the field header — 7c6bb862
- Organise and Presets carry no Conditional switch — 8623c084
- A disabled Today keeps its Today fill — 9baa9f57
- 39: the panel header's Reset all clears both scopes, and both header buttons wear the default look
- 53: a conditional chip's tooltip says "X conditions applied" — `T-a-condition-tip-counts-its-rows`
- 40: a host's `aria-label` names its inner control — button, input, checkbox, radio, switch; 59 template sites + 18 in code were unnamed — `T-a-host-label-must-reach-its-control`
- A button with no visible label shows a tip that says its action; `data-tip` sets one, `data-no-tip` turns it off — `T-every-button-says-its-action`
- Toolbar icon actions named in Will's words: Suggest filters, Reset all filters, View as filter panel, Add to / Remove from Favorites, Save view options
- 17: no breadcrumb trail on Records or Assistant — moving between Contexts is the nav's to show
- 57: a shell panel area is exactly three grid columns wide, worked out in CSS; the shell's panel areas stay — `T-the-shell-owns-the-panel-areas`
- 65: a horizontal legend is capped at 40rem and centred; narrow, it fills — `T-a-horizontal-legend-is-three-by-two`
- 41: conditions DID filter — Owner, Name and Email, in the toolbar and the panel (Owner Contains Da: 100 → 10). What failed was the chip's FACE after a panel Apply: no value, a stale tip. A silent steer now calls the chip's `refresh()` — `T-a-silent-steer-still-redraws-its-chip`
- 63: a conditions-only field (Email) has no Conditional switch in the panel; its rows show from the start
- 69: no back button on the main header — it went back between Contexts, which is the nav's job, as with the breadcrumbs; Settings keeps its own
- 56: a view change resets the header chips the new view does not set — Region no longer stays lit over My accounts; this is 21b's default — `T-a-view-change-resets-the-header-chips`
- 21e: filters survive a reload and a trip away, for the session, on the View they were made on — each bar keeps its `answers` and replays them with `restoreAnswers()`; the combined query is never restored; a View change empties both bars' filter chips — `T-a-reload-replays-the-readers-answers`
- 55: At risk keeps its own `status ne churned` (13 rows, was 20); going back to All drops the old `col:status` chip — `T-an-empty-selection-never-wipes-a-condition`
- 44 (first half): a heading holding a condition opens its menu on the condition, not on an unticked list — `T-a-heading-menu-opens-on-what-it-holds`
- 44b: a heading holds a whole reading — a chain set from outside or typed in shows and applies whole; `clauseConditions()` turns a chained clause back into rows — `T-a-heading-holds-a-whole-reading`
- 71: the legend's Other menu draws again — an icon button had no menu slot since ad7f91be; unticking a folded category and Apply takes the bar chart 16 → 14 bars — `T-an-icon-button-still-slots-its-menu`
- 72: adding a second conditional filter keeps the first — the toolbar holds a rebuilt chip's answer until its rows fill; the panel draws a conditioned field on its rows and writes them once each menu has drawn — `T-a-conditioned-field-opens-on-its-rows`
- 44c: a heading whose field the View holds shows the View's answer — ticked, greyed, read-only (`sherpa-menu data-readonly`) — via `grid.supersedeColumns()` — `T-a-view-held-heading-shows-and-refuses`
- 42: a legend narrows ITS chart only — a part can name the one component it narrows (`contribute(key, filter, { only })`), kept out of the shared query; Records' bar chart 4 → 3 bars, the grid stays at 100 — `T-a-component-part-narrows-one-component`

**Culled or merged in the 2026-09-26 review**
- 13, a sparkline did not follow its record deltas — each tile's sparkline and its delta are ONE series now (`T-a-delta-is-derived-not-declared`)
- 51, warning and critical for a condition — a note, folded into 49
- 35, plain grid templates — the question 26 asks first; merged into it
- The draft list `todo-filter-2609.md` — merged here, and deleted

**Found done or stale by the 2026-09-26 audit, and removed**
- The data toolbar clipped below 800px — fine at 1280x720 since 39b6537c
- Fold `More` into `Add filter` — ONE Filters button with Added / Available sections
- A filter PANEL as an alternative to the toolbars — built; its width is 57
- Switching back to a view left the last column filter — fixed; a new bug is 55
- A range filter refused its default max — does not reproduce (45163ad4)
- Button borders did not inherit the status colour — 52b5857f; buttons bind the Style pins
- A metric trend did not update — did not reproduce, twice
- A fixed-height row's hard-coded gutter — did not reproduce, twice
- 38's compound Owner condition did not widen — does not reproduce (Dana 10, Dana OR Nassim 17)
- Allow-list follow-ons (values, actions, `nextState`) — the primitive is there; wire each when a caller needs it

**2026-09-23 to 09-25**
- Context vs View — the naming, settled (CLAUDE.md "Navigation terms")
- A filter applies DOWN its scope only — `T-a-filter-applies-down-its-scope`
- Style/Transparent tokens consumed — 7f1f95a3
- The `More` chip showed active when it was not — `T-the-filters-button-is-a-door-not-a-filter`
- Metric item surface and border; every metric uses the xsmall container class
- Only five filter chips carry an icon — `T-only-five-filter-chips-carry-an-icon`
- Pagination row-count select is a Sherpa select — `T-a-native-select-keeps-its-own-shape`
- Notifications button, and three more menus that could never close — `T-a-trigger-click-follows-light-dismiss`
- An optional allow-list on any axis — `src/core/data/allow.ts`, `T-an-allow-list-is-a-filter-not-an-order`
- The filter menu's two modes and many conditions, and its shake-down — `T-a-filter-menu-has-two-modes`
- An inactive chip says where its filter went
- The grid is TWO tokens, 4px and 2px — `T-the-grid-is-two-grids`
- Donut folded into `sherpa-radial-chart`; the gauge composes the ring — `T-a-gauge-composes-the-ring`
- Settings opens as an overlay — `test/e2e/reforged-settings-overlay.spec.ts`
- A nav item goes to a Context
- Shared constants swept; event detail shapes swept; toggle chips' owner settled
- The panel-or-toolbar mode survives a reload — 24c3a57c
