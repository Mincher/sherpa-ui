# The code review: a plan for Will to review

TODO 242. Written 2026-10-14, then updated the same day with Will's rulings.
**Phase 0 is done. The rest waits on Will's review of this version, and on the
three questions in §0.2.**

Will, 2026-10-14: *"Now is the time to do a thorough code review of all of the
components. … Plan all of this in a markdown for review before starting."*

The work has eight phases. Each item becomes one TODO row and one commit, and
the hook's gates run on every commit. The order is in §6.

---

## 0. Rulings and questions

### 0.1 Will's rulings, 2026-10-14

| # | Ruling | What it changes in this plan |
|---|---|---|
| D1 | **A native gallery now, with a plan to move to full Storybook later.** *"Investigate if this can be a separate project/repo that consumes Sherpa rather than adding Storybook to this repo."* | It can. The gallery is a sibling project that uses sherpa-ui as any consumer does, and Storybook goes into that project later. Nothing about it goes into sherpa-ui. See Phase 8.3 |
| D2 | **A: write `custom-elements.json` from our own specs.** *"You'll need to explain what the purpose of custom-elements.json is."* | Explained in Phase 8.5 |
| D3 | **A: private host state is native `:state()`.** | Phase 1.1 and Phase 4 |
| D4 | **A: delete the stored-data shims.** *"Sherpa is app agnostic so nothing relating to constructed applications lives in this project."* | The shims go (Phase 2). The principle reaches further, to the starter, to the hook's check of Demos, and to docs that use Demos as the reference: Phase 2's new area, and Q1 and Q2 below |
| D5 | **A: form and focus plumbing go into `SherpaElement`.** *"Anything generic gets elevated so that it's handled in a consistent manner. Only edge cases, or bespoke differences, are added at the individual component levels."* | Phase 4's rule is now "generic is elevated", not "elevate after 3 uses". Phase 5 follows the same rule |
| D6 | **A: native names where a native element does the same job.** | The Phase 3 lexicon |
| D7 | **B: keep `Temporal`.** *"I don't care about Safari."* | No polyfill and no rewrite. TODO 252 is closed. The docs say the calendar needs `Temporal`. Phase 7, and Q3 below |
| 254 | **A: keep the line chart's area as it is.** *"The token used already comes from Figma. The border colour creates enough contrast between the bar fill and background to be accessible."* | TODO 254 is closed. A one-line comment in the CSS stops the next review from "fixing" it |

**The 86 ruling still binds Phases 3 and 6.** On 2026-10-13 you ruled "**the
doors stay**". So this review deletes no public door without a new yes. Where a
job has many doors, the docs name ONE, and the others become one-line calls
into it.

### 0.2 Three new questions, from how far the rulings reach

| # | Question | A | B | My pick |
|---|---|---|---|---|
| Q1 | **`starter/`, `npx sherpa-ui init` and the MCP's `scaffold_app`** are an app template inside sherpa-ui. Its one Context is `records` (D4) | A: move them to their own sibling project, which the MCP's `scaffold_app` reads from | B: keep them. A template is not a constructed app | **A**. A template with app content is the nearest thing to an app inside the library |
| Q2 | **sherpa-ui's hook runs `check:usage` on `../Sherpa Demos`.** So the library knows a consumer (D4) | A: Demos only. Demos already has its own `check:usage` script, and runs it on its own markup | B: keep it, as you ruled on 2026-10-12, so a rename in sherpa-ui that breaks Demos blocks the sherpa-ui commit | **A**. It reverses your 10-12 ruling, so I name that. A break then shows in Demos' own check, the next time it runs |
| Q3 | **WebKit in the test matrix**, now that Safari is not a target (D7) | A: keep it. Every iPhone and iPad browser is WebKit, Chrome on iOS too, so "no Safari" would also mean "no iPhone" | B: drop it. The full suites take about one third less time | **A**. The iPhone point is the reason. If you never target an iPhone, B |

---

## 1. How this was made

- **Four read-only reviews ran at the same time.** They covered the filter
  family, the data and app layers, the other 59 components, and the tooling
  with its packages and docs. Each claim cites `file:line`, and the counts come
  from grep or the TypeScript parser. A bug was fixed only after a test proved
  it on the old build (Phase 0).
- **Online research** is listed in §8: web.dev, MDN, WHATWG, Storybook's docs
  and npm metadata, the Custom Elements Manifest docs, Vite, and the status of
  each new platform feature.
- **This review does not redo the earlier ones.** It checks what they left
  open:

  | Earlier review | What it covered |
  |---|---|
  | [COMPONENT-AUDIT.md](COMPONENT-AUDIT.md), 2026-09-23 | The code of 58 components. Its open items went to TODO |
  | [FILTER-REVIEW.md](FILTER-REVIEW.md), 2026-09-25 | The filter family, and its ledger of moves |
  | [COMPONENT-API-AUDIT.md](COMPONENT-API-AUDIT.md), 2026-09-29 | The public API: TODO 86, which closed with "the doors stay" |
  | [CONSUMER-REVIEW.md](CONSUMER-REVIEW.md), 2026-10-01 | How people and agents build an app: TODO 183 and C2 |

- **Rulings this plan keeps:**
  - Each component works on its own and extends `SherpaElement` only. Anything
    generic is elevated (D5): into `SherpaElement`, or into a shared helper or
    sheet for a family. Never into a family base class.
  - Sherpa is app agnostic (D4).
  - No framework work.
  - A bulk rename needs your yes. Approving the lexicon in Phase 3 is that yes
    for the rows in it.
  - You decide when the full suites run.

---

## 2. Where we are

Measured before Phase 0; the line counts below are as the files are now.

| | Count |
|---|---:|
| Components | 66 |
| Component lines: TS / CSS / HTML | 20,160 / 10,626 / 4,269 |
| Core lines: TS / CSS | 14,143 / 8,064 |
| Runtime dependencies | **0** |
| Dev dependencies | 17 |
| Docs lines (`docs/`) | 30,363. TRAPS is 17,011 and TODO is 6,753 |

**The base is good.** The runtime has no dependencies. Icons are SVG from the
repo, loaded lazily, with no font and no CDN. Twelve gates run in the hook. JS
writes `display`/`hidden`/`visibility` on internals 0 times, uses chained
`:host` 0 times and structural `innerHTML` 0 times.

**The weight is in a few files:**

| File | Lines |
|---|---:|
| `data-source.ts` | 2,813 (46 private fields, 14 of them Maps) |
| `sherpa-menu.ts` | 2,096 |
| `sherpa-data-grid.ts` | 1,986 |
| `sherpa-quick-filter-toolbar.ts` | 1,899 |
| `sherpa-filter-panel.ts` | 1,841 |
| `sherpa-provider.ts` | 1,245 |
| `sherpa-element.ts` | 1,164 |

---

## 3. Phase 0: bugs found while reading — ✅ done

Each fix has one commit and one test, and each test failed on the old build.

| TODO | Bug | Commit |
|---|---|---|
| 243 | A moved component lost its slot listeners, and slider, tooltip, nav and dialog went dead. The trap's own text caused it | `95c7559b` |
| 244 | Five events were missing from the specs, and three phantom events were in them. The type checker now names each event | `4452cff5` |
| 245 | A deleted saved View came back from IndexedDB | `b02e90f0` |
| 246 | `RestStore` did not say it is remote | `22675cf6` |
| 247 | A prop's text erased the slot beside it. A slotted icon in container-header never showed. `skipWhen` is deleted | `76cbb22a` |
| 248 | Two icons were set as class names, which draw nothing | `029293e2` |
| 249 | A bar's report rewrote the source's saved filters | `939c99e6` |
| 250 | A saved View put the sort on the View, not on the scope that set it | `0b428e05` |
| 251 | `data-refresh` reloaded a guessed source | `88402f75` |
| 252 | The calendar's `Temporal`: **closed by D7**, kept | — |
| 253 | Nav-item's search tint was set in TS, where `lint:css` cannot see it | `9d0afdc7` |
| 254 | The line chart's area wash: **closed by your ruling**, kept | — |

---

## 4. The phases

Each phase lists its aim, its items, how it is proved, and its size (S, M or
L).

### Phase 1: gates first, so that cleanup cannot slide back. Size: S

| # | Item |
|---|---|
| 1.1 | **Close the loophole in `check:props`.** Today a quoted `'data-x'` anywhere in the TS counts as declared (`check-props.mjs:60`). That lets 17 host attributes that JS writes go undeclared, for example the toolbar's `data-collapse`, `data-folded` and `data-has-organise`, and data-grid's `data-actions`, `-empty`, `-no-matches` and `-resizing`. A public one becomes a declared prop. A private one becomes a `:state()` (D3) |
| 1.2 | ✅ The spec generator fails on an event name it cannot read (done in 244) |
| 1.3 | **`data-accepts` on every content slot.** About 21 of about 121 slots carry it, and the filter family has 0 of 11. The values mix categories (`control`) with tag names (`dialog`, `badge`). One vocabulary, categories only, gated in `spec:check` |
| 1.4 | **`lint:css` allows `prefers-reduced-motion`, which CLAUDE.md forbids.** Make the two agree |
| 1.5 | **Stop hand-typing counts in rule docs.** PRINCIPLES says 65 components (there are 66). CLAUDE.md says "nine core modules" and names eight. TODO's head says "47 open". Remove the numbers, or generate them |

### Phase 2: take the legacy out, and everything about a constructed app. Size: M

A refactor deletes what it replaced. One commit per area.

| Area | Delete |
|---|---|
| **Out of sherpa-ui (D4)** | The stored-data shims: `adoptOldFilters` + `OLD_PREFIX`; View `readings`/`edits` from before 197 and 105; `readingRows`' legacy branch; `readingsOf`; the favourites no-key migration; the `SavedView.snapshot` paths (`onViewPicked` carry, `saveViewAs`); `search-change`'s `detail.search`. Comments that describe Demos' data ("the Dashboard's still use it"). The docs that point at Demos as THE reference (CLAUDE.md 8 lines, TRAPS 25, APP-GUIDE 2, the MCP README): each rule is stated in Sherpa's own terms, and the example goes in the gallery. `starter/` and the hook's `check:usage` of Demos, if Q1 and Q2 are A |
| Filter names | `custom`/`conditions` in `filter-kind.ts`, `OLD_KINDS`, `advancedOf` reading 3 keys; chip `kind === 'custom'`; menu `OLD_OPT_INS`, `OLD_MODES`, 4 old attributes in `observed`, `#enforceMode`; menu CSS for `data-conditional`/`data-conditions-only`; `kind: 'values'`; the panel's `picked` alias of `values`; the old name `T-saved-filters-are-the-custom-section` |
| Data API | `FieldDeclaration.custom`; `persistViewState`; `IdbValidationError`; `restViewRemote`; `MADE_UP`; `VIEW_SCOPE`, the same value as `VIEW`. The 22 exports only tests call are each checked: a real consumer door stays, and the rest go internal |
| Component aliases | list-item `data-heading`; app-header `data-title`; toast `data-message` (its own `show()` still writes it); chat-message's three alias props; progress-bar `data-value` beside native `value`; list `bordered`; nav `NavItem` and the old `NavEntry[]` form; notifications `title`; metric `name`; file-upload's extra `files-change` event |
| Dead code | `data-can-add`, `data-single`, `data-removable` (written, read by nothing); the 14 exports no file imports; `SHARED_PROPS['data-group']`; the sparkline rule marked "BUG, left as found"; orphan doc blocks over removed code (toolbar :131, :878; chip :861; data.ts :25, :146, :207; data-source :249, :552) |
| Icons | `installIcons()`, a public no-op; the Font Awesome comments; `T-fa-pro-renders-nothing`; "all 214" (there are 217) |
| Repo | the 4 root scratch pages (`leak.html`, `prop.html`, `risk.html`, `sz.html`); 3 unused scripts (`check-tokens.mjs`, `figma-harvest-colours.mjs`, `figma-extract-component.js`); 2 stale `.gitignore` lines; [Some things to address.md](Some%20things%20to%20address.md): each note is checked against the code and filed in TODO or marked done, then the file goes |

**Kept on purpose:** chip, tag, tabs, select-card, transfer-list,
step-tracker, layout-canvas, file-upload and nav-section have no user in
Demos. They are library parts, not dead code. The gallery gives each one a
live example. `spoofRemote` stays too: it is generic, any store, and it is the
gallery's slow and failing backend.

### Phase 3: one name per idea (the lexicon). Size: M

A consumer should guess a name right the first time. **One table, one row per
idea.** You approve the table once. That approval is the bulk-rename yes for
its rows, and nothing outside it is renamed. A unit test then checks every spec
against the table, with a baseline that may only fall.

| Idea | Today | Rule |
|---|---|---|
| Value, range, bounds (D6) | slider `value-start` (unprefixed, and not a native name) against calendar `data-value-start`; `min`/`max` against `data-min`/`data-max`; `value` against `data-value` | **Native names where a native element does the same job**: gauge, metric and progress take `value` `min` `max` as `<meter>` and `<progress>` do; the calendar takes them as `<input type=date>` does. A range's two ends have no native name, so both slider and calendar take `data-value-start`/`data-value-end`. A chart's axis bound keeps `data-min`/`data-max`: no native element does that job |
| Dismiss | `data-dismissible` fires 6 different events: `callout-dismiss`, `chip-remove`, `tag-remove`, `toast-dismiss`, `header-dismiss`, `panel-close`. Chip and tag swap templates; the others gate it in CSS | one event name pattern, one CSS gate |
| Selection | `checked` + `change{checked}` on checkbox, radio and switch, against `data-selected` + `change{selected}` on select-card. The default `value` is `'on'` in two components and `''` in two | |
| `data-state` | 3 vocabularies: input-text validation (which should be `data-status`), container empty/no-matches/error, calendar-cell today/range | |
| Error, empty, help | `data-error` against `data-error-message`; `data-empty` as text on list but as a JS flag on grid and notifications; file-upload `data-helper`/`data-accept`/`data-multiple` where the rest use `data-description` and the native names; prompt-composer `data-placeholder` against native `placeholder` | |
| Padding | `data-padding` sm/base/lg against `data-padding-inline` sm/md/lg, and `sm` is 8px in one and 4px in the other | |
| Slot names | a leading icon is `icon`, `left`, `leading`, `brand-icon` or `avatar`; title is `title` or `heading`; description is `description` or `metadata`; actions are `actions`, `action` or `trailing` | |
| Item events | `item-select` is `{label, href}` on nav-item and `{label}` on list-item | |
| Charts | only bar and radial fire clicks; radial has no legend and no title slot; only line has `data-min`; `sherpa-list` `populate()` takes `{title, active}`, names the others dropped | |
| Filter family | `data-hide-unmatched`, `data-remote` and `data-pending` are declared with different kinds on the toolbar and the panel; `data-locked` is declared in two ways | |

The empty Rule cells are filled when the lexicon is written, for your approval.

**The many-doors list (ruling 86 holds).** Writing a filter has about 10
doors, restoring has 8, and saving has 7. The docs name one door per job, and
the others call it. No door is deleted.

### Phase 4: `SherpaElement` — anything generic is elevated (D5). Size: M

Your rule: *"Anything generic gets elevated so that it's handled in a
consistent manner. Only edge cases, or bespoke differences, are added at the
individual component levels."* Generic for every component goes into
`SherpaElement`, opt-in by the platform's own flag where one exists. Generic
for a family goes into a shared helper or sheet. Each component still works on
its own.

| | Item |
|---|---|
| **Elevate (D5)** | Form plumbing: `formResetCallback`, `formDisabledCallback`, `disabled`, `checkValidity`/`reportValidity`, written by hand in 9 components. Focus delegation through native `delegatesFocus`, in place of 6 `focus()` overrides. Default role and ARIA through `ElementInternals`, which never overrides a role the author set (callout, loader and select-card set the host's role by hand). Boolean accessors from `static props` (9, written by hand in 6 components). Forwarding attributes to an inner composite (overlay-panel, metric, app-header) |
| **Private state is `:state()` (D3)** | One door over `ElementInternals.states`, for the 17 attributes of 1.1 and the like (`data-copied`, `data-dragover`, `data-resizing`). This includes `data-has-*`, which the base writes for every slot, so it is the biggest move and it goes last. CSS selects `:host(:state(has-icon))` |
| **One write door** | `set()` has 3 uses against about 167 hand writes. With D5 the door is used everywhere: the hand writes move to it. My default; say if you want the native calls instead |
| **Use what it has** | `num()` is skipped 5 times; `mirrorAttrs` is written again 3 times (overlay-panel, metric, switch); `writeIcon`/`as: 'icon'` 3 times (app-header, nav, input-text) |
| **State first** | Five "hold until rendered" queues in the filter family (`#held`, `#early` twice, `#heldValues`, `#heldLabel`) become one rule: a setter stores state, and render draws it. This is the rule you chose on 113 |
| **`emit()`** | It takes `{ cancelable }`, so `view-reset` stops being built by hand 3 times |
| **Smaller** | `markNeedles`/`markMatch` (one user each) move to a helper; orphan comments go. The file grows only by what is elevated into it, and `check:size` records that |

### Phase 5: elevate what each family repeats. Size: L

The same rule as Phase 4, one level down: a family's shared code goes into
one imported helper or one family sheet.

| Family | Item |
|---|---|
| **Filter family: the async root** | About 20 waits (`#settled`, double frames, rAF re-emits) cite two traps: `T-a-rebuilt-row-reads-empty-for-a-tick` (11 sites) and `T-a-rebuilt-bar-reads-empty-until-its-menus-stamp` (9 sites). The cause: `menu.conditions` reads the op and text from live controls that fill later. The menu already keeps list picks in `row.dataset.want`. If it keeps the op and text the same way, `conditions` reads correctly at once, and most of the waits can go. **This is the biggest single simplification found** |
| **Filter family: toolbar ↔ panel** | Each part below is written twice today, and becomes one helper in `filters-button.ts`/`more-menu.ts`: the saved-set block (about 20 lines on each side); the Filters-button draw, with its shared tail and def; one-value rows (a `OneRows` beside `MenuDrill`); the ⋮ save rows and `#onMoreSwitch`; `#syncResets`; organise sync; `OrganiseColumn` = `PanelColumn`; `SortDirection`, which `store.ts` already has; "ruled out" marking (3 copies, the menu's too); the results text (2 copies); saved cards; pending; reopen after × |
| **Filter family: types** | 46 hand-typed `HTMLElement & {…}` casts, and `import type { SherpaMenu }` 0 times. Import each component's own type. `ChipEl` lists `clear`/`refresh` as properties only to stop the spec generator reading them as toolbar methods. That is a generator bug, fixed in the generator |
| **Charts** | One chart-frame sheet for bar, line, gauge and radial (legend slot, 7fr/3fr, narrow query; today 3 near-copies). `.hotspots` (4 copies) goes into the segments sheet. The hard `:has()` caps go: radial tips stop at 11 slices, gauge at 6 zones, sparkline at 8 points. Bar/line axis, scale and x-label TS goes into `chart-parts.ts` |
| **Keyboard** | A roving-focus helper. Tabs and nav have one; step-tracker, breadcrumbs, transfer-list, calendar and every chart have no keyboard navigation. This closes PRINCIPLES open work 0 |
| **Controls** | Radio grouping is written twice, with different reach: a form for radio, the whole document for select-card. One helper, one reach. Switch mirrors attributes by hand: it uses `mirrorAttrs` |
| **Containers** | dialog and panel have the same template, and header chrome is built 3 ways. Every container composes `container-header`/`container-footer`. Chip and tag have the same TS: one dismiss button gated in CSS, as callout already does |
| **Templates** | 15 hand-written `cloneNode(true)` calls in 8 components skip `clone()`/`renderItems`, which also upgrade icons. 3 non-typed `createElement` calls (the nav icon box, the toast stack, input-text options) become prototypes |

### Phase 6: the data layer: the right job, one copy, fewer passes. Size: L

| | Item |
|---|---|
| **6.1 Split `data-source.ts`** | Along the seams it already marks: types; **pure Query edits** (functions over a `Query`, testable with no source); the field catalogue; counts and limits (about 390 lines and 13 fields); binding and publishing; the core (load, paging, steering). For consumers it stays one class with the same API |
| **6.2 One copy of each** | `eachScope`/`emptyScope` (16 + 9 sites); view holds as a Set (6); preset clauses (3); `READING_KEYS`, which exists twice and can drift; `answers()` re-written beside `rowAnswered`; two different functions both called `canonical`; `modeOf(reading)` (7 sites); `sameReading`; one `keyedStore(prefix, guard, kind)` for saved views, saved filters and drafts (3 copies, and `kindOf` written 5 times); `coalesce()` and `latest()` (3 and 4 copies); the chip's `#hasTypedAnswer` uses `rowAnswered`; the menu's `#seedFromPicks` moves to `filter-state.ts`. 31 `JSON.stringify` comparisons become `sameFilter` plus one version counter for the applied Query |
| **6.3 Each layer does its own job** | (a) **The source calls 11 component draw methods directly** (26 calls) and imports `Populatable` from `ui/`. It should publish ONE description per scope, which a component draws. That also ends the two ways a bar is drawn on open, and the provider's double-frame echo guard. (b) **The provider is 1,245 lines, and its real job, answering an ask, is about 230.** Views, saved filter sets, reset, drafts and session move to an app-layer module that it imports; the panel/toolbar mode moves to a small helper. (c) **Data meaning leaves the UI**: the `applyFilters` merge, empty against no-matches, band edges (`threshold.ts` already has `bandEdges`), bind-source's unscoped steer branch, and the `saved:` part keys, a second saved-filter model beside presets. (d) The View library is built in two places; the `'view'` chip id is known in 4 |
| **6.4 Honest entry points** | `sherpa-ui/data` re-exports 41 app-layer names, among them `bindSource` and `onViewPicked`, which touch the DOM. `/data` keeps only DOM-free modules, and a unit test checks where each export comes from. `spoofRemote` goes under one clear name for test and gallery fakes |
| **6.5 Measure, then make it faster** | A bench in node (ArrayStore, 10k rows) counts loads per click, compiles per report and clones per frame, against a baseline that may only fall, like `check:weight`. Known costs: one bar report recompiles k+2 times (one batch would make it 1); each chip count is a full load; `Store.distinct` is implemented by no store, so every list field loads every row; 26 `structuredClone` calls, and the `state` getter clones on every change; 3 loops that grow with the square of their input; the provider's per-frame compiles and storage parses |
| **6.6 One door per job (86 holds)** | Name the irregular members (`scope()`/`scopes`/`describe`; `rows` is live where `state` is a clone; `limitOptions` has a setter where `applyOn` is constructor-only). Add the missing read-backs (`declarePreset`, `declarePart`, `declareDefault`, `contributions`, `declareScope`) |

### Phase 7: third-party technology and the platform. Size: S

**What a consumer meets today:**

| Tech | Where | Verdict |
|---|---|---|
| `npx --yes serve`, unpinned and downloaded on each run | the starter's `start`, `preview`, Playwright's webServer | **Replace** with about 30 lines of `node:http` as `sherpa-ui serve`, so nothing downloads at run time |
| `Temporal` | the calendar | **Kept (D7).** README and APP-GUIDE say so: the calendar needs `Temporal`, which Safari does not have yet. No polyfill |
| The "Inter" font | named in `tokens.css`, loaded nowhere | My default: say it in README and APP-GUIDE (the app loads Inter if it wants it; `system-ui` is the fallback). Tell me if you want the font shipped instead |
| Tooling shipped in `sherpa-ui` only for `sherpa-ui-mcp` | `scripts/lib/generation/`, `contract-io.mjs` (which imports `js-yaml`, a package `sherpa-ui` does not declare), the stale rules doc | **Move** it into the MCP package |
| 66 `.html` + component `.css` in `dist/` (about 428 KB) | already inlined into the JS by the build | **Stop shipping** them, after a check that nothing reads them from `dist/` |

**Dev tools:**

- **Keep:**
  - TypeScript, esbuild and Playwright.
  - axe-core and Ajv.
  - postcss, as the `lint:css` parser.
  - The MCP SDK and zod, for the MCP only.
  - `js-yaml`, for the hand-written Figma data.
  - eslint. It is the rule-13 gate, and moves from v8 (end of life) to v9.
- **Drop:**
  - autoprefixer and cssnano. esbuild already minifies CSS, and the engines we
    support need no prefixes. Before they go, check that nesting ships as
    written.
  - prettier. No gate runs it.
  - husky. One line of git config does its job.
- **Limit** `@types/node` to the scripts, so Node types stop leaking into the
  browser source.
- **Say the browser floor** in `package.json` (`engines`, and a browserslist
  that tells the truth): Chromium and Firefox, and WebKit by Q3. Today it says
  Safari 17.2.

**Platform features to adopt.** Each gets a check in every engine we test,
with the longhand first where needed (`T-a-css-function-needs-its-longhand-first`):

| Feature | Support | For |
|---|---|---|
| `:state()` / `CustomStateSet` | all 3 since 2024 | D3: private host state |
| `ElementInternals` ARIA defaults | all 3 | a default role that never overrides the author's |
| `delegatesFocus` | all 3 | D5: focus delegation |
| Invoker commands `commandfor`/`command` | Chrome 135, Firefox 144, Safari 26.2 | **A spike first:** open a `sherpa-dialog` from markup alone. `sherpa-button` passes the command on, and the dialog listens for `command` with a custom `--show`. The shadow boundary is the risk, so it is measured first |
| `field-sizing: content` | Chrome 123, Firefox 152, Safari 26.2 | prompt-composer's JS height |
| `popover="manual"` (top layer) | all 3, already used | the toast stack's `cssText` with z-index 1000 |
| Scoped element registries | Chrome 146, Safari 26, Firefox planned for 159 | **watch only**: two Sherpa versions on one page |
| Declarative shadow DOM | all 3 | TODO 223, deferred |

### Phase 8: docs for each reader. Size: L

**8.1 Clean the doc set.**

- TRAPS has 640 entries, 624 under one heading, and no index. Add a generated
  index by area. Every entry stays.
- TODO's head is stale ("47 open"; "a done item leaves the body"). Fix the
  head. Every row stays.
- PRINCIPLES' open work moves into TODO, the one list.
- The four reviews move to `docs/history/`. They are record, not rule.
- `DEF-TO-FIGMA-BUILD-RULES.md` is stale, but it is served to agents as
  `sherpa://rules`. Write it again as today's build rules. The def-named MCP
  tools get today's names.
- CLAUDE.md (816 lines) is cut to pointers. PRINCIPLES is where each rule is
  stated. Demos is not the reference (D4).

**8.2 A component reference, generated from the specs.** One page per
component: what it is, when to use it, its attributes (values and defaults),
events (with their detail), slots (with what they accept), parts, CSS
properties, and its example. It is generated, so it cannot drift.

**8.3 The gallery is its own project (D1).** The investigation's answer: **yes,
it can be**, and it should be — Demos already proves the pattern.

- **Where:** `../Sherpa Gallery`, a sibling project beside `../Sherpa Demos`.
  Its `package.json` takes `"sherpa-ui": "file:../sherpa-ui"`, as Demos does,
  and it uses only the package's public entries — exactly what a consumer
  gets. Nothing about the gallery lives in sherpa-ui (D4). It runs on its own
  port, never on your :4200.
- **Now: native pages.** The gallery is itself a Sherpa app — app-shell, nav,
  one page per component — so a gap a consumer would hit, we hit first. No new
  tool.
- **Later: Storybook 10 in the SAME project.** `@storybook/web-components-vite`
  brings Vite, Lit (a required peer of its renderer) and Storybook's own React
  screens. All of them install in the gallery's `node_modules`, never in
  sherpa-ui.
- **The move needs no rewrite.** Each story is a plain CSF file — `export
  default { title, args }` and `export const Name = { render: (args) => element }`
  — that returns DOM, which Storybook's web-components renderer accepts. The
  native pages read the same files.
- **Vite needs no settings.** sherpa-ui's default build puts each template and
  sheet in its JS and fetches nothing (`T-the-text-is-in-the-js`). Vite 8
  rewrites a `new URL` itself (`T-a-bundler-can-turn-a-file-into-a-module`). And
  Vite treats a `file:` linked package as source, not as a pre-bundled
  dependency.
- **Controls come free.** Storybook reads `custom-elements.json` (D2) with
  `setCustomElementsManifest`, so its Controls panel and docs table need no
  per-story arg lists. The native pages read the same file.
- **What a story covers:** every value of every enum in the spec; mode (light,
  dark, hc), density and theme, through page-level switches; a fake data layer
  (`<sherpa-provider>` + `ArrayStore`, and `spoofRemote` for slow and failing);
  and nesting inside `sherpa-app-shell`, a dialog, a panel and a grid.
- **What stays in sherpa-ui:** the specs, `custom-elements.json`, and ONE small
  example per component, shipped beside its spec. This is component
  documentation, not an app. Today these examples are `test/a11y/fixtures.mjs`,
  in `test/`, which is not shipped. Moved out, one source feeds the a11y gate,
  the MCP's `get_component`, and the gallery's first story for each component.
- **The gates stay in sherpa-ui.** Playwright and axe are sherpa-ui's quality
  gates. Storybook's test runner and a11y addon are not used, so nothing is
  tested twice.
- **The MCP drive tools** open the gallery by a URL you set. Today they open
  `test/reforged/harness.html`, which is not shipped.

**8.4 Each reader:**

| Reader | Gets |
|---|---|
| Developer | A README front door (what Sherpa is, install, a 10-line page, the four entry points), the reference, the gallery, APP-GUIDE for a whole app, and editor autocompletion (8.5) |
| Designer | Every variant and state, side by side, with mode, density and theme switches. Each component links to its Figma node, and `resync-figma.mjs` reports drift |
| Agent | `get_component` returns a working example; the drive tools open the gallery; `sherpa://rules` is current; and `custom-elements.json` |
| Anyone | The gallery is static pages: the first look needs no install |

**8.5 What `custom-elements.json` is for (D2).**

It is ONE JSON file, in a public standard format (schema 2.1.0), that lists
every custom element a package defines. For each element it gives the tag
name, attributes (with their values and defaults), properties, events, slots,
CSS parts and CSS custom properties, each with a description. The package's
`package.json` names the file in a `customElements` field, so a tool can find
it without reading the code.

It exists so that each tool does not need its own adapter for each library.
The web-components world agreed on one format, and the tools read it:

| Tool | What a person gets |
|---|---|
| VS Code | Autocompletion and hover docs for every `<sherpa-*>` tag and attribute, in plain HTML. VS Code reads its own "HTML custom data" file, which our same script writes from the same facts |
| JetBrains IDEs | The same, from a `web-types.json` file. Optional, from the same script |
| Storybook (later, D1) | Its Controls panel and docs table, through `setCustomElementsManifest` |
| Docs pages, API viewers, linters | A component reference, and checks that an attribute name is real |
| Agents | One standard file to read, beside our MCP |

**Our `component.json` specs already hold all of this, and more** (Figma links,
anatomy, `populate` shapes). So the manifest is a SUBSET, written from the
specs by a small script of ours: no analyzer, no new dependency. `spec:check`
keeps it fresh. It is not a framework file: it describes plain HTML elements.

---

## 5. The numbers that must move

Measured before the work. Each moves in the direction shown, and a gate
records it where one exists.

| Measure | Before | After |
|---|---:|---|
| Host attributes JS writes, undeclared | 17 | 0 |
| Content slots with `data-accepts` | ~21 / ~121 | all |
| Events missing from a spec, and phantom events | 5 / 3 | ✅ 0 / 0 (244) |
| `JSON.stringify` comparisons (data-source + filter family) | 31 | falls |
| `structuredClone` in data-source | 26 | falls |
| Waits citing the two rebuilt-row traps | 20 | falls |
| Hand-typed element casts | 46 | falls |
| `/* theme-direct */` markers (the baseline exists) | 160 | falls |
| Old `--_status-*` reads | 6 | 0 |
| `data-source.ts` / `sherpa-provider.ts` lines | 2,813 / 1,245 | falls (`check:size`) |
| Dev dependencies | 17 | 13 |
| Downloads at run time | 1 | 0 |
| Files in sherpa-ui about a constructed app | to count (Phase 2) | 0 |
| Components with no live example anywhere | 9 | 0 |
| Charts reachable by keyboard | 0 | all |
| Loads per click on Records | to measure (6.5) | falls |

---

## 6. Order, size and how the work runs

| Step | Phase | Why here | Size |
|---|---|---|---|
| ✅ 1 | **0** bugs | they were wrong | S each |
| 2 | **1** gates | so no later phase can slide back | S |
| 3 | **7** third-party | small and separate; removes downloads early | S |
| 4 | **2** legacy, and D4 | fewer names to move in Phase 3 | M |
| 5 | **8.3** the gallery project, seeded from the examples | every later phase needs each component on its own, with its states | M |
| 6 | **4** `SherpaElement` | Phase 5 uses what it elevates | M |
| 7 | **3** lexicon (after your yes) | names settle before code is shared | M |
| 8 | **5** family helpers | the biggest; the async root goes first | L |
| 9 | **6** data layer | the bench first, then the split | L |
| 10 | **8.1, 8.2, 8.4, 8.5** docs and the manifest | written last, about the code as it ends up | M |

- Each item is a TODO row (255 and on) and one commit. The hook's 12 gates run
  on each commit.
- One line of work at a time: one `dist/`, fixed test ports. Agents only plan
  and explore in parallel.
- **The full suites run when you say.** I ask at the end of each phase.
- I never push.

---

## 7. Out of scope

- 170 (when you say), 223 (deferred), and 76, 77, 78 (later).
- Framework fixtures, adapters and typings.
- Anything about a constructed app (D4).
- Safari support for the calendar (D7).
- Publishing and pushing.
- The Figma-side rename (queued in TODO).
- Any rename that is not in the approved lexicon.

---

## 8. Sources

- web.dev, [Custom element best practices](https://web.dev/articles/custom-elements-best-practices)
- WHATWG, [Custom elements](https://html.spec.whatwg.org/dev/custom-elements.html); WebKit, [ElementInternals and form-associated custom elements](https://webkit.org/blog/13711/elementinternals-and-form-associated-custom-elements/)
- MDN, [`:state()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:state)
- Storybook, [web-components-vite](https://storybook.js.org/docs/get-started/frameworks/web-components-vite). The npm metadata (10.6.2) gives `@storybook/web-components` a required peer `lit ^2 || ^3`; the framework adds `vite ^5–8`
- Custom Elements Manifest, [the schema and the `customElements` field](https://github.com/webcomponents/custom-elements-manifest) and [the analyzer](https://custom-elements-manifest.open-wc.org/analyzer/getting-started/); Frontend Masters, [The missing link for web components](https://frontendmasters.com/blog/the-missing-link-for-web-components/)
- VS Code, [the custom data format](https://code.visualstudio.com/blogs/2020/02/24/custom-data-format); wc-toolkit, [VS Code integration](https://github.com/wc-toolkit/vs-code)
- Chrome, [Scoped registries](https://developer.chrome.com/blog/scoped-registries); caniuse, [Invoker commands](https://caniuse.com/wf-invoker-commands); InfoQ, [HTML invoker commands](https://www.infoq.com/news/2026/01/html-invoker-commands)
- web.dev, [New to the web platform, June 2026](https://web.dev/blog/web-platform-06-2026) (`field-sizing`); [Temporal status](https://flaviocopes.com/temporal-api.md)
- api-viewer-element, [an API viewer for web components](https://dev.to/webpadawan/api-viewer-document-your-web-components-api-p8j). It is built on Lit, so it is not used here
