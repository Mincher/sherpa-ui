# The code review: a plan for Will to review

TODO 242. Written 2026-10-14. **No code changes until Will rules on §0.**

Will, 2026-10-14: *"Now is the time to do a thorough code review of all of the
components. … Plan all of this in a markdown for review before starting."*

The work has eight phases, plus a Phase 0 for bugs found while reading. Each
item becomes one TODO row and one commit, and the hook's gates run on every
commit. The order is in §6.

---

## 0. Decisions for Will

Seven choices. Each changes what the work does. My pick is first.

| # | Decision | A | B | My pick |
|---|---|---|---|---|
| D1 | **Docs and playground** (Phase 8) | A **native gallery**: a static Sherpa app, built from Sherpa's own components and specs. Stories are plain CSF files that return DOM, so Storybook can read the same files later with no rewrite | **Storybook 10** now (`@storybook/web-components-vite`) | **A**. Storybook is dev-only, but it brings Vite, Lit (a *required* peer of its renderer) and React (its own UI). You asked to call out other technology and use it only when it cannot be avoided. Here it can be avoided |
| D2 | **`custom-elements.json`** (Phase 8.4) | A: write it, plus VS Code's HTML custom data, **from our own specs** with a small script of ours. Plain HTML only: no framework types, no analyzer dependency | B: keep it out, as ruled with 210 | **A**. This opens part of 210 again, so I say it once. The manifest is the web-components standard, not a framework file. It gives attribute autocompletion in plain HTML to every developer and agent. If you say B, I follow B |
| D3 | **Private host state** (Phase 4) | A: move it to native **`:state()`** (`CustomStateSet`, in all three engines since 2024). CSS can select it, it is not an attribute, and it is not in the spec | B: keep a `data-*` attribute and declare each one in `static props` | **A**. Rule 15 says private state is never a public `data-*`, and 17 attributes break that today. `:state()` is the platform's own answer |
| D4 | **Shims for a reader's STORED data**: old saved filters, old View `readings`/`edits`, the favourites migration, `SavedView.snapshot` | A: delete them now | B: keep them until the first published release, then delete them | **A**. Demos is the only app, and its storage can be cleared. `adoptOldFilters` reads storage on every page open, for ever |
| D5 | **Form plumbing (9 components) and focus delegation (6)**: where does the shared code go? | A: **in `SherpaElement` itself**, opt-in through the native flags (`static formAssociated`, `delegatesFocus`) | B: an imported helper that each component calls | **A**. Both obey "extend SherpaElement only". The platform calls `formResetCallback` and the others as CLASS methods, so a helper cannot supply them unless every component writes stubs |
| D6 | **Names a native element already has** (Phase 3) | A: where a native element does the same job, use its unprefixed names: gauge, metric and progress take `value` `min` `max` as `<meter>` and `<progress>` do; the calendar takes them as `<input type=date>` does | B: `data-value` / `data-min` / `data-max` on every component that is not a form control | **A**. A consumer knows the native names already. Rule 15 says native names stay unprefixed |
| D7 | **`Temporal` in the calendar**: Safari stable does not have it yet | A: write the calendar's date math with `Date` + `Intl` now, which every engine has. Go back to `Temporal` when Safari ships it | B: keep `Temporal`, and tell consumers they must load a polyfill | **A**. A polyfill is a third-party package that every consumer would need |

**One ruling binds Phases 3 and 6, and I follow it.** On 86, 2026-10-13, you
ruled "**the doors stay**". So this review deletes no public door without a new
yes. Where a job has many doors, the docs name ONE, and the other doors become
one-line calls into it.

---

## 1. How this was made

- **Four read-only reviews ran at the same time.** They covered the filter
  family, the data and app layers, the other 59 components, and the tooling
  with its packages and docs. Each claim cites `file:line`, and the counts come
  from grep or the TypeScript parser. I read the code again for each bug I mark
  **confirmed**. A **probable** bug must be checked in a browser first.
- **Online research** is listed in §8: web.dev, MDN, WHATWG, Storybook's docs
  and npm metadata, the Custom Elements Manifest docs, and the status of each
  new platform feature.
- **This review does not redo the earlier ones.** It checks what they left
  open:

  | Earlier review | What it covered |
  |---|---|
  | [COMPONENT-AUDIT.md](COMPONENT-AUDIT.md), 2026-09-23 | The code of 58 components. Its open items went to TODO |
  | [FILTER-REVIEW.md](FILTER-REVIEW.md), 2026-09-25 | The filter family, and its ledger of moves |
  | [COMPONENT-API-AUDIT.md](COMPONENT-API-AUDIT.md), 2026-09-29 | The public API: TODO 86, which closed with "the doors stay" |
  | [CONSUMER-REVIEW.md](CONSUMER-REVIEW.md), 2026-10-01 | How people and agents build an app: TODO 183 and C2 |

- **Rulings this plan keeps:**
  - Components extend `SherpaElement` only. Code is shared by an imported
    helper or an adopted sheet, never by a family base class.
  - Consistent public names matter more than removing copied code.
  - No framework work.
  - A bulk rename needs your yes, and approving the lexicon in Phase 3 is that yes
    for the rows in it.
  - You decide when the full suites run.

---

## 2. Where we are

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
`:host` 0 times and structural `innerHTML` 0 times, and every component's
`Fires:` block lists what it emits.

**The weight is in a few files:**

| File | Lines |
|---|---:|
| `data-source.ts` | 2,812 (46 private fields, 14 of them Maps) |
| `sherpa-menu.ts` | 2,096 |
| `sherpa-data-grid.ts` | 1,985 |
| `sherpa-quick-filter-toolbar.ts` | 1,899 |
| `sherpa-filter-panel.ts` | 1,842 |
| `sherpa-provider.ts` | 1,242 |
| `sherpa-element.ts` | 1,182 |

---

## 3. Phase 0: bugs found while reading

Fix these first. Each one is a TODO row.

| # | Bug | Status | Fix |
|---|---|---|---|
| 0.1 | **A moved element loses its listeners.** On a reconnect, `connectedCallback` makes a new signal (`sherpa-element.ts:511`). But `#wireSlots` (:1020) ran once, with the old signal, so `data-has-*` stops following the slots. Slider (8 listeners), tooltip, nav and dialog wire listeners in `onRender`, which also runs only once. The cause is the trap's own text: `T-abort-controller-per-connect` says to read `this.signal` "inside `onRender`/`onConnect`" | **confirmed** | The base wires slots again on each connect. Those four components move their listeners to `onConnect`. The trap text becomes "`onConnect` only". Gate: a sweep test that mounts each a11y fixture, moves it, and checks that slots and listeners still work |
| 0.2 | **Three events are missing from the specs.** `this.emit(act)` passes a variable (toolbar :1520, panel :1770), so `filters-save` and `filters-save-as` are not in the toolbar spec, and `filters-save-as` is not in the panel spec. The specs also list phantom `button-click` and `menu-change` events, which come from events dispatched on OTHER elements | **confirmed** | Pass literal names. The spec generator fails on an `emit` it cannot read, and stops counting an event dispatched on another element as the component's own |
| 0.3 | **A deleted saved View comes back.** `toIdb` (`view-sync.ts:109`) only adds rows, so a deleted View stays in IndexedDB and is merged back. Only tests call `syncViews` | **confirmed** | Delete per page, or delete `syncViews` if Phase 2 finds no caller |
| 0.4 | **`RestStore` is not `remote`.** Only `spoofRemote` sets `remote: true`. So a real HTTP store has no draft and no Apply, and each pick is a full HTTP load | **confirmed** | `RestStore` says `remote: true` |
| 0.5 | **`skipWhen` never guards a slot.** `container-header` uses `skipWhen: '[slot]'`, but `<slot name="icon">` has no `slot` attribute, so the icon write can replace the slot. The toast's heading slot and the gauge's caption have the same risk (`!dataset.hasCaption` is always true, because a present attribute reads as `''`) | probable | Check in a browser, then fix the guard in the base once |
| 0.6 | **Icon names written as CSS classes draw nothing**, because icons are SVG now: `notifications.ts:161`, `data-grid.ts:1301` | probable | `data-icon` in the prototype, or `writeIcon` |
| 0.7 | **A bar's report writes over the saved-filter library.** `answerScope` (`data-source.ts:2678`) sets `#presets` and does not call `declarePreset`, so there are no facts and no redraw. A component writes source state, which breaks rule 10 | **confirmed** | Read the presets as a report and let the source own them |
| 0.8 | **Two serialisers put the arrangement in different scopes.** `export()` puts sort and group in the scope that arranged them. `viewQueryOf` always puts them on the View | from the review | One serialiser |
| 0.9 | **`data-refresh` guesses a source** when it does not know which one (`sherpa-provider.ts:167`). `#resolve` says an unclear ask must be loud | from the review | Report it, as `#resolve` does |
| 0.10 | **The calendar calls `Temporal` with no check** (`sherpa-calendar.ts:15–383`), and Safari stable has no `Temporal`. Our WebKit tests may pass because Playwright's WebKit is newer than Safari | probable | D7 |
| 0.11 | **Two CSS rules escape `lint:css`.** `line-chart.css:46` puts `opacity: .14` on a token that already has 50% alpha. `nav-item.ts:186` builds a `::highlight` sheet in TS that reads a Theme colour | from the review | Move the sheet to CSS, and fix the alpha |

---

## 4. The phases

Each phase lists its aim, its items, how it is proved, and its size (S, M or
L).

### Phase 1: gates first, so that cleanup cannot slide back. Size: S

| # | Item |
|---|---|
| 1.1 | **Close the loophole in `check:props`.** Today a quoted `'data-x'` anywhere in the TS counts as declared (`check-props.mjs:60`). That lets 17 host attributes that JS writes go undeclared: `data-collapse`, `data-folded` and `data-has-organise` on the toolbar; container `data-loading`; data-grid `data-actions`, `-advanced-select`, `-empty`, `-no-matches`, `-resizing`; and others. Each one becomes a declared prop, or a `:state()` by D3 |
| 1.2 | **The spec generator fails on an event name it cannot read** (with 0.2) |
| 1.3 | **`data-accepts` on every content slot.** About 21 of about 121 slots carry it, and the filter family has 0 of 11. The values mix categories (`control`) with tag names (`dialog`, `badge`). One vocabulary of categories only, gated in `spec:check` |
| 1.4 | **`lint:css` allows `prefers-reduced-motion`, which CLAUDE.md forbids.** Make the two agree |
| 1.5 | **Stop hand-typing counts in rule docs.** PRINCIPLES says 65 components (there are 66). CLAUDE.md says "nine core modules" and names eight. TODO's head says "47 open" (5 are open). Remove the numbers, or generate them |

### Phase 2: take the legacy out. Size: M

A refactor deletes what it replaced. One commit per area. `check:usage`
catches any break in Demos.

| Area | Delete |
|---|---|
| Filter names | `custom`/`conditions` in `filter-kind.ts`, `OLD_KINDS`, `advancedOf` reading 3 keys; chip `kind === 'custom'`; menu `OLD_OPT_INS`, `OLD_MODES`, 4 old attributes in `observed`, `#enforceMode`; menu CSS for `data-conditional`/`data-conditions-only`; `kind: 'values'`; the panel's `picked` alias of `values`; the old name `T-saved-filters-are-the-custom-section` |
| Stored-data shims (D4) | `adoptOldFilters` + `OLD_PREFIX`; View `readings`/`edits` from before 197 and 105; `readingRows`' legacy branch; `readingsOf`; the favourites no-key migration; the `SavedView.snapshot` paths (`onViewPicked` carry, `saveViewAs`); `search-change`'s `detail.search` |
| Data API | `FieldDeclaration.custom`; `persistViewState`; `IdbValidationError`; `restViewRemote`; `MADE_UP`; `VIEW_SCOPE`, the same value as `VIEW`. The 22 exports only tests call are each checked: a real consumer door stays, the rest go internal |
| Component aliases | list-item `data-heading`; app-header `data-title`; toast `data-message` (its own `show()` still writes it); chat-message's three alias props; progress-bar `data-value` beside native `value`; list `bordered`; nav `NavItem` and the old `NavEntry[]` form; notifications `title`; metric `name`; file-upload's extra `files-change` event |
| Dead code | `data-can-add`, `data-single`, `data-removable` (written, read by nothing); the 14 exports no file imports; `SHARED_PROPS['data-group']`; the sparkline rule marked "BUG, left as found"; orphan doc blocks over removed code (toolbar :131, :878; chip :861; data.ts :25, :146, :207; data-source :249, :552) |
| Icons | `installIcons()`, a public no-op; the Font Awesome comments; `T-fa-pro-renders-nothing`; "all 214" (there are 217) |
| Repo | the 4 root scratch pages (`leak.html`, `prop.html`, `risk.html`, `sz.html`); 3 unused scripts (`check-tokens.mjs`, `figma-harvest-colours.mjs`, `figma-extract-component.js`); 2 stale `.gitignore` lines; [Some things to address.md](Some%20things%20to%20address.md): each note is checked against the code and filed in TODO or marked done, then the file goes |

**Kept on purpose:** chip, tag, tabs, select-card, transfer-list,
step-tracker, layout-canvas, file-upload and nav-section have no user in
Demos. They are library parts, not dead code. The gallery (Phase 8.3) gives each one
a live example.

### Phase 3: one name per idea (the lexicon). Size: M

A consumer should guess a name right the first time. **One table, one row per
idea.** You approve the table once. That approval is the bulk-rename yes for
its rows, and nothing outside it is renamed. A unit test then checks every spec
against the table, with a baseline that may only fall.

| Idea | Today |
|---|---|
| Dismiss | `data-dismissible` fires 6 different events: `callout-dismiss`, `chip-remove`, `tag-remove`, `toast-dismiss`, `header-dismiss`, `panel-close`. Chip and tag swap templates; the others gate it in CSS |
| Value, range, bounds (D6) | slider `value-start` (unprefixed and not native) against calendar `data-value-start`; `min`/`max` against `data-min`/`data-max`; `value` against `data-value` |
| Selection | `checked` + `change{checked}` on checkbox, radio and switch, against `data-selected` + `change{selected}` on select-card. The default `value` is `'on'` in two components and `''` in two |
| `data-state` | 3 vocabularies: input-text validation (which should be `data-status`), container empty/no-matches/error, calendar-cell today/range |
| Error, empty, help | `data-error` against `data-error-message`; `data-empty` as text on list but as a JS flag on grid and notifications; file-upload `data-helper`/`data-accept`/`data-multiple` where the rest use `data-description` and the native names; prompt-composer `data-placeholder` against native `placeholder` |
| Padding | `data-padding` sm/base/lg against `data-padding-inline` sm/md/lg, and `sm` is 8px in one and 4px in the other |
| Slot names | a leading icon is `icon`, `left`, `leading`, `brand-icon` or `avatar`; title is `title` or `heading`; description is `description` or `metadata`; actions are `actions`, `action` or `trailing` |
| Item events | `item-select` is `{label, href}` on nav-item and `{label}` on list-item |
| Charts | only bar and radial fire clicks; radial has no legend and no title slot; only line has `data-min`; `sherpa-list` `populate()` takes `{title, active}`, names the others dropped |
| Filter family | `data-hide-unmatched`, `data-remote` and `data-pending` are declared with different kinds on the toolbar and the panel; `data-locked` is declared in two ways |

**The many-doors list (ruling 86 holds).** Writing a filter has about 10
doors, restoring has 8, and saving has 7. The docs name one door per job, and
the others call it. No door is deleted.

### Phase 4: `SherpaElement`, used fully and made a little bigger where 3+ components need it. Size: M

| | Item |
|---|---|
| **Use what it has** | `set()` has 3 uses against about 167 hand writes. My default: delete it and use the native `toggleAttribute`/`setAttribute`, which already do this job. `num()` is skipped 5 times, `mirrorAttrs` is written again 3 times (overlay-panel, metric, switch), and `writeIcon`/`as: 'icon'` 3 times (app-header, nav, input-text) |
| **Add (D5)** | Form plumbing: `formResetCallback`, `formDisabledCallback`, `disabled`, `checkValidity`/`reportValidity`, written by hand in 9 components. Focus delegation through native `delegatesFocus`, in place of 6 `focus()` overrides. Default role and ARIA through `ElementInternals`, which never overrides a role the author set (callout, loader, select-card set the host's role by hand). Boolean accessors from `static props` (9 written by hand). Forwarding attributes to an inner composite (3 uses) |
| **State first** | Five "hold until rendered" queues in the filter family (`#held`, `#early` twice, `#heldValues`, `#heldLabel`) become one rule: a setter stores state, and render draws it. This is the rule you chose on 113 |
| **`emit()`** | It takes `{ cancelable }`, so `view-reset` stops being built by hand 3 times |
| **Smaller** | `markNeedles`/`markMatch` (one user each) move to a helper; orphan comments go. The file may grow only by what D5 adds, and `check:size` records that growth |

### Phase 5: share by imported helper and by sheet. Size: L

| Family | Item |
|---|---|
| **Filter family: the async root** | About 20 waits (`#settled`, double frames, rAF re-emits) cite two traps: `T-a-rebuilt-row-reads-empty-for-a-tick` (11 sites) and `T-a-rebuilt-bar-reads-empty-until-its-menus-stamp` (9 sites). The cause is that `menu.conditions` reads the op and text from live controls that fill later. The menu already keeps list picks in `row.dataset.want`. If it keeps the op and text the same way, `conditions` reads correctly at once, and most of the waits can go. **This is the biggest single simplification found** |
| **Filter family: toolbar ↔ panel** | Each part below is written twice today, and becomes one helper in `filters-button.ts`/`more-menu.ts`: the saved-set block (about 20 lines on each side); the Filters-button draw, with its shared tail and def; one-value rows (a `OneRows` beside `MenuDrill`); the ⋮ save rows and `#onMoreSwitch`; `#syncResets`; organise sync; `OrganiseColumn` = `PanelColumn`; `SortDirection`, which `store.ts` already has; "ruled out" marking (3 copies, the menu's too); the results text (2 copies); saved cards; pending; reopen after × |
| **Filter family: types** | 46 hand-typed `HTMLElement & {…}` casts, and `import type { SherpaMenu }` 0 times. Import each component's own type. `ChipEl` lists `clear`/`refresh` as properties only to stop the spec generator reading them as toolbar methods. That is a generator bug, and it is fixed in the generator |
| **Charts** | One chart-frame sheet for bar, line, gauge and radial (legend slot, 7fr/3fr, narrow query; today 3 near-copies). `.hotspots` (4 copies) goes into the segments sheet. The hard `:has()` caps go: radial tips stop at 11 slices, gauge at 6 zones, sparkline at 8 points. Bar/line axis, scale and x-label TS goes into `chart-parts.ts` |
| **Keyboard** | A roving-focus helper. Tabs and nav have one; step-tracker, breadcrumbs, transfer-list, calendar and every chart have no keyboard navigation. This closes PRINCIPLES open work 0 |
| **Controls** | Radio grouping is written twice, with different reach: a form for radio, the whole document for select-card. Make it one helper with one reach. Switch mirrors attributes by hand: use `mirrorAttrs` |
| **Containers** | dialog and panel have the same template, and header chrome is built 3 ways. Every container composes `container-header`/`container-footer`. Chip and tag have the same TS: one dismiss button gated in CSS, as callout already does |
| **Templates** | 15 hand-written `cloneNode(true)` calls in 8 components skip `clone()`/`renderItems`, which also upgrade icons. 3 non-typed `createElement` calls (the nav icon box, the toast stack, input-text options) become prototypes |

### Phase 6: the data layer: the right job, one copy, fewer passes. Size: L

| | Item |
|---|---|
| **6.1 Split `data-source.ts`** along the seams it already marks: types; **pure Query edits** (functions over a `Query`, testable with no source); the field catalogue; counts and limits (about 390 lines and 13 fields); binding and publishing; the core (load, paging, steering). For consumers it stays one class with the same API |
| **6.2 One copy of each** | `eachScope`/`emptyScope` (16 + 9 sites); view holds as a Set (6); preset clauses (3); `READING_KEYS`, which exists twice and can drift; `answers()` re-written beside `rowAnswered`; two different functions both called `canonical`; `modeOf(reading)` (7 sites); `sameReading`; one `keyedStore(prefix, guard, kind)` for saved views, saved filters and drafts (3 copies, and `kindOf` written 5 times); `coalesce()` and `latest()` (3 and 4 copies); the chip's `#hasTypedAnswer` uses `rowAnswered`; the menu's `#seedFromPicks` moves to `filter-state.ts`. 31 `JSON.stringify` comparisons become `sameFilter` plus one version counter for the applied Query |
| **6.3 Each layer does its own job** | (a) **The source calls 11 component draw methods directly** (26 calls) and imports `Populatable` from `ui/`. It should publish ONE description per scope, which a component draws. That also ends the two ways a bar is drawn on open, and the provider's double-frame echo guard. (b) **The provider is 1,242 lines, and its real job, answering an ask, is about 230.** Views, saved filter sets, reset, drafts and session move to an app-layer module that it imports; the panel/toolbar mode moves to a small helper. (c) **Data meaning leaves the UI**: the `applyFilters` merge, empty against no-matches, band edges (`threshold.ts` already has `bandEdges`), bind-source's unscoped steer branch, and the `saved:` part keys, a second saved-filter model beside presets. (d) The View library is built in two places; the `'view'` chip id is known in 4 |
| **6.4 Honest entry points** | `sherpa-ui/data` re-exports 41 app-layer names, among them `bindSource` and `onViewPicked`, which touch the DOM. `/data` keeps only DOM-free modules, and a unit test checks where each export comes from. Test fakes (`spoofRemote`) go under one clear name, which the gallery also uses as its slow and failing backend |
| **6.5 Measure, then make it faster** | A bench in node (ArrayStore, 10k rows) counts loads per click, compiles per report and clones per frame, against a baseline that may only fall, like `check:weight`. Known costs: one bar report recompiles k+2 times (one batch would make it 1); each chip count is a full load; `Store.distinct` is implemented by no store, so every list field loads every row; 26 `structuredClone` calls, and the `state` getter clones on every change; 3 loops that grow with the square of their input; the provider's per-frame compiles and storage parses |
| **6.6 One door per job (86 holds)** | Name the irregular members (`scope()`/`scopes`/`describe`; `rows` is live where `state` is a clone; `limitOptions` has a setter where `applyOn` is constructor-only). Add the missing read-backs (`declarePreset`, `declarePart`, `declareDefault`, `contributions`, `declareScope`) |

### Phase 7: third-party technology and the platform. Size: S

**What a consumer meets today:**

| Tech | Where | Verdict |
|---|---|---|
| `npx --yes serve`, unpinned and downloaded on each run | the starter's `start`, `preview`, Playwright's webServer | **Replace** with about 30 lines of `node:http` as `sherpa-ui serve`, so nothing downloads at run time |
| `Temporal` | the calendar | D7 |
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
- Give the browser floor in `package.json` (`engines`, and an honest
  browserslist). Today it says Safari 17.2.

**Platform features to adopt.** Each gets a three-engine check, with the
longhand first where needed (`T-a-css-function-needs-its-longhand-first`):

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
  stated.

**8.2 A component reference, generated from the specs.** One page per
component: what it is, when to use it, its attributes (values and defaults),
events (with their detail), slots (with what they accept), parts, CSS
properties, and one example from its story. It is generated, so it cannot
drift.

**8.3 The gallery (D1 A).**

- **Where:** a `gallery/` folder, outside `src/`, so it is not shipped,
  compiled into the package or counted by `check:size`. Stories are CSF files
  that return DOM, one per component.
- **The seed:** `test/a11y/fixtures.mjs` already holds "one realistic instance
  of every component". Those 66 instances become the first stories.
- **States:** every value of every enum in the spec, crossed with mode (light,
  dark, hc), density and theme, through page-level switches.
- **Data:** a fake data layer for data-bound stories, using
  `<sherpa-provider>` + `ArrayStore`. Slow and failing states come from the
  remote fake.
- **Nesting:** stories inside `sherpa-app-shell`, a dialog, a panel and a
  grid.
- **One source, three users:** the same stories feed the a11y gate,
  Playwright, and the MCP drive tools. The drive tools point at
  `test/reforged/harness.html` today, which is not shipped; they point at the
  gallery instead.
- **Dogfooding:** the gallery is itself a Sherpa app. A gap a consumer would
  hit, we hit first.

**8.4 Each reader:**

| Reader | Gets |
|---|---|
| Developer | A README front door (what Sherpa is, install, a 10-line page, the four entry points), the reference, the gallery, APP-GUIDE for a whole app, and editor autocompletion (D2) |
| Designer | Every variant and state, side by side, with mode, density and theme switches. Each component links to its Figma node, and `resync-figma.mjs` reports drift |
| Agent | `get_component` returns a working example taken from the story; the drive tools open the gallery; `sherpa://rules` is current; and the manifest (D2) |
| Anyone | The gallery is static pages: the first look needs no install |

---

## 5. The numbers that must move

Measured today. Each moves in the direction shown, and a gate records it where
one exists.

| Measure | Today | After |
|---|---:|---|
| Host attributes JS writes, undeclared | 17 | 0 |
| Content slots with `data-accepts` | ~21 / ~121 | all |
| Events missing from a spec, and phantom events | 3 / 3 | 0 / 0 |
| `JSON.stringify` comparisons (data-source + filter family) | 31 | falls |
| `structuredClone` in data-source | 26 | falls |
| Waits citing the two rebuilt-row traps | 20 | falls |
| Hand-typed element casts | 46 | falls |
| `/* theme-direct */` markers (the baseline exists) | 160 | falls |
| Old `--_status-*` reads | 6 | 0 |
| `data-source.ts` / `sherpa-provider.ts` lines | 2,812 / 1,242 | falls (`check:size`) |
| Dev dependencies | 17 | 13 |
| Downloads at run time | 1 | 0 |
| Components with no live example anywhere | 9 | 0 |
| Charts reachable by keyboard | 0 | all |
| Loads per click on Records | to measure (6.5) | falls |

---

## 6. Order, size and how the work runs

| Step | Phase | Why here | Size |
|---|---|---|---|
| 1 | **0** bugs | they are wrong today | S each |
| 2 | **1** gates | so no later phase can slide back | S |
| 3 | **7** third-party | small and separate; removes downloads early | S |
| 4 | **2** legacy | fewer names to move in Phase 3 | M |
| 5 | **8.3** gallery, seeded from the fixtures | every later phase needs each component on its own, with its states | M |
| 6 | **4** `SherpaElement` | the helpers in Phase 5 use what it adds | M |
| 7 | **3** lexicon (after your yes) | names settle before code is shared | M |
| 8 | **5** UI helpers | the biggest; the async root goes first | L |
| 9 | **6** data layer | the bench first, then the split | L |
| 10 | **8.1, 8.2, 8.4** docs | written last, about the code as it ends up | M |

- Each item is a TODO row (243 and on) and one commit. The hook's 12 gates run
  on each commit.
- One line of work at a time: one `dist/`, fixed test ports. Agents only plan
  and explore in parallel.
- **The full suites run when you say.** I ask at the end of each phase.
- I never push.

---

## 7. Out of scope

- 170 (when you say), 223 (deferred), and 76, 77, 78 (later).
- Framework fixtures, adapters and typings.
- Publishing and pushing.
- The Figma-side rename (queued in TODO).
- Any rename that is not in the approved lexicon.

---

## 8. Sources

- web.dev, [Custom element best practices](https://web.dev/articles/custom-elements-best-practices)
- WHATWG, [Custom elements](https://html.spec.whatwg.org/dev/custom-elements.html); WebKit, [ElementInternals and form-associated custom elements](https://webkit.org/blog/13711/elementinternals-and-form-associated-custom-elements/)
- MDN, [`:state()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:state)
- Storybook, [web-components-vite](https://storybook.js.org/docs/get-started/frameworks/web-components-vite). The npm metadata (10.6.2) gives `@storybook/web-components` a required peer `lit ^2 || ^3`; the framework adds `vite ^5–8`
- Custom Elements Manifest, [analyzer](https://custom-elements-manifest.open-wc.org/analyzer/getting-started/); Frontend Masters, [The missing link for web components](https://frontendmasters.com/blog/the-missing-link-for-web-components/)
- Chrome, [Scoped registries](https://developer.chrome.com/blog/scoped-registries); caniuse, [Invoker commands](https://caniuse.com/wf-invoker-commands); InfoQ, [HTML invoker commands](https://www.infoq.com/news/2026/01/html-invoker-commands)
- web.dev, [New to the web platform, June 2026](https://web.dev/blog/web-platform-06-2026) (`field-sizing`); [Temporal status](https://flaviocopes.com/temporal-api.md)
- api-viewer-element, [an API viewer for web components](https://dev.to/webpadawan/api-viewer-document-your-web-components-api-p8j). It is built on Lit, so it is not used here
