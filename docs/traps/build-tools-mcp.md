# Traps — Build, tools and the MCP

One of the eleven areas of [the traps](../TRAPS.md): each entry is here because its
first `Site:` is in this area (`npm run check:traps` holds it so). 34 entries.

### T-a-slot-says-what-it-accepts

**Every slot says what it takes, in `data-accepts`, from ONE vocabulary.** The
spec carries it, and the MCP tells an agent "accepts control" — so it is a
contract, not a comment. On 2026-10-14 only 23 of 121 slots had one, and their
values mixed categories (`control`) with tag names (`filter-panel`,
`app-header`) and `any`.

The vocabulary, in two parts:

- **HTML's own content categories:** `text` (words: a label, a heading, a
  count), `icon` (one glyph or mark), `control` (a thing to operate: a button,
  a link, a chip), `input` (a form field), `content` (anything).
- **Sherpa roles,** for a slot that takes ONE kind of component: `item` (a row
  of a list, menu or nav), `menu`, `legend`, `header`, `footer`, `nav`, `panel`,
  `dialog`, `toolbar`, `badge`.

`generate-component-spec.mjs` fails a slot with no `data-accepts`, or a word
outside the set, and `schemas/component.v1.json` lists the same words. A
FORWARDED slot (`<slot name="icon" slot="icon">`) is a slot a page fills too,
so it says what it takes. A new word is added to both, on purpose.

- Site: `scripts/generate-component-spec.mjs`
- Site: `test/unit/the-mcp-read-tier.test.mjs`

### T-nothing-downloads-to-serve

**Serving a folder downloads nothing.** The starter's `npm start`, `npm run
preview` and Playwright's web server each ran `npx --yes serve`: an unpinned
package, fetched from npm on every run, declared nowhere — the one third-party
thing a consumer met at run time (found 2026-10-14). A new `serve` release, or
no network, broke all three.

`sherpa-ui serve [folder] [--port N]` (in `bin/sherpa-ui.mjs`) is Node's own
`http` and `fs`, about 40 lines:

- a folder serves its `index.html`, and `/app` redirects to `/app/` so the
  page's relative URLs resolve inside it;
- each file goes with its type — `text/javascript` for a module, `text/css`
  for a sheet, which the templater asks for (`T-a-bundler-can-turn-a-file-into-a-module`);
- nothing outside the folder is served (403), only GET and HEAD are answered,
  and it listens on `localhost`, never the network.

It does what the starter, the preview and the tests need, and no more: no
directory listing, no clean URLs, no cache headers beyond `no-cache`.

- Site: `bin/sherpa-ui.mjs`
- Site: `playwright.config.ts`
- Site: `test/unit/nothing-downloads-to-serve.test.mjs`

### T-a-cli-is-run-through-a-link

**A CLI is run through a link**, so a main-file check must compare REAL paths.
`npx sherpa-ui`, `node_modules/.bin/sherpa-ui` and a `file:` dependency each
reach `bin/sherpa-ui.mjs` through a symlink. Node loads the module by its real
path, so `import.meta.url` is the real file, while `process.argv[1]` is the
link. The check `import.meta.url === pathToFileURL(process.argv[1]).href` was
false, and the CLI exited 0 with no output: `sherpa-ui serve` served nothing
and said nothing (found 2026-10-14, when the starter's tests ran it from their
own `node_modules`). `realpathSync` on both sides is the check;
`check-usage.mjs` had it already.

- Site: `bin/sherpa-ui.mjs`
- Site: `scripts/check-usage.mjs`
- Site: `test/unit/nothing-downloads-to-serve.test.mjs`

### T-the-manifest-is-written-from-the-specs

**`custom-elements.json` and `vscode.html-data.json` are written, never
edited.** `npm run manifest` makes both from the component specs, and the hook's
`check:generated` fails a commit whose specs changed without them. They are a
subset of the specs in two public formats — the Custom Elements Manifest 2.1.0,
which editors, Storybook and doc tools read, and VS Code's HTML custom data — so
no analyzer reads the code a second time. A prop the spec gets wrong is wrong in
every editor, which is how the phantom `asc` / `desc` props on the filter chip
were found.

**So is the component reference.** `npm run reference` writes `docs/components/`:
a page for each spec and its example, and an index. `check:generated` fails a
commit whose pages are not what the specs and examples make. A wrong line on a
page is fixed in the source or the generator, never on the page.

- Site: `scripts/check-generated.mjs`
- Site: `scripts/write-manifest.mjs`
- Site: `scripts/write-reference.mjs`

### T-the-bench-counts-and-never-times

**`check:bench` gates COUNTS per reader's act — loads, counts, distinct reads,
the rows they hand back, compiles, clones and scans — and only prints time.** A count
is the same on every machine and every run; a time gate fails under load and
passes on a fast laptop (TODO 286).

It bundles the data layer from `src/` with esbuild, never `dist/`: the hook
builds nothing, and a stale `dist/` benches the last build. The bundle renames
`compile` in `query.ts` and counts each call, and the bench fails if it cannot
find it; `structuredClone` is wrapped for the run. It renames `applyOptions`,
`filterRows` and `distinctOf` in `store.ts` the same way: each call is a SCAN,
one full pass over a set of rows, held or not — so a held set's work shows,
which its loads (0) never did (TODO 348 W0). A pass inside another is counted
once. `BaseStore` makes a `totalCount`
a load, but an `ArrayStore` counts in place, so a counts cache shows as fewer
counts.

The page is `test/unit/fixtures/records.page.json` over 10,000 seeded rows,
bound as the provider binds it. Each fake control has the methods its spec lists
and no more, because the source checks for them, and each bar reports every chip
it holds, answered or not, as the toolbar's `readings` does. The first baseline
had fake bars that sent only answered chips, and so under-counted each report.
An act ends when nothing has moved for three timer turns; a `report()` fails the
run. The page act runs while the rows fill many pages: after the report they fit
on one, and a page change clamps and loads nothing. A change to the fixture, the
rows, an act or a fake's spec moves the baseline: record it on purpose. Will,
2026-10-15: it runs in the hook on data-layer commits.

The walk's one pass over a scope's rows (`passOver`, TODOs 347–349) counts as a
scan; reading the rows for it (`scan()`, a held set) does not.

**Five pages** (345 phase 3): `records`, `remote` (held) and `rest` (may miss a
writer) run the same acts; `lean` (`test/unit/fixtures/lean.page.json`: 15
fields, 10 declared, 5 held) changes a field it never declares, one it only
shows, one it holds and one it answers; `notheld` is a remote store with
`holdRows: 0`, so each count and tally is a request. `save` moves a field the
page reads (row 17's owner was already Owner 02, so the old `save` changed
nothing); `save-same` changes nothing and `save-unread` moves a field nothing
reads. `walks` (each walk, in order or step by step) and `draws` are printed,
never gated.

- Site: `scripts/check-bench.mjs`
- Site: `test/unit/bench.test.mjs`

---

## Design system

### T-a-component-ships-its-example

**Each component ships ONE example beside its spec** (code review 8.3, Will
D1; TODO 271): `sherpa-<name>.example.json`, against `schemas/example.v1.json`.
It is how a page WRITES the component — a label where it takes one, real
words — with the data each part is given through `populate()` (`fill`), and
the part to open (`show`) when it draws only while open. Markup may be an array
of strings, joined with no separator, so a long one reads in a diff.

It is component documentation, not an app (D4), so it ships in the package —
not in `test/`, read by the a11y gate alone — and ONE source feeds four readers: the
accessibility gate, the MCP's `get_component`, a gallery's first story for each
component, and the component reference (`npm run reference`). Its `use` says
when to reach for it; the reference and `get_component` show it.

A node test holds it: every component has one, each passes the schema, and
its markup passes the usage check — a tag, a `data-*` or an enum value the
spec does not have fails it. The move found one: the chat message's
`data-type="person"`, which is not a value it takes.

- Site: `test/a11y/examples.mjs`
- Site: `test/unit/every-component-ships-an-example.test.mjs`
- Site: `mcp-server/tools/read.js`
- Site: `scripts/write-reference.mjs`

### T-a-skeleton-is-the-pages

**A component's first draw never waits a frame** — measured for TODO 113,
2026-10-13: 797 elements on Records, on a cold load and a 4× slow CPU, and
not one painted a frame between its upgrade and its stamp. Its sheets and
markup are in the JS (`T-the-text-is-in-the-js`), so the stamp follows in
microtasks, before any paint. A skeleton inside `SherpaElement` would never be
seen.

**The one wait a reader sees is before the code loads**: the page shows its
elements undefined, with their bare children. So Will's skeleton (A and A —
one shimmer in the host's box, only after 300 ms) is `page.css`'s, on
`:not(:defined)`: a 300 ms `animation-delay`, then a pulse between two
surfaces; its children are hidden. Defined, the element draws as itself.
Reduced motion holds the end colour instead of pulsing.

An element that is NEVER defined — a misspelt tag — shimmers for ever. That
is a fault a person can see; `check:usage` catches it first.

- Site: `scripts/project-tokens.mjs`
- Site: `test/e2e/reforged-a-skeleton-is-the-pages.spec.ts`

### T-harness-serves-font-awesome-locally

> **HISTORY — 2026-09-23.** Font Awesome is GONE. The icons are Figma SVGs
> baked into `core/ui/icons/`, so there is no webfont to serve, no `<link>` in
> the harness and no CDN entry in `sharedStyles`. Measured before removal: the
> CDN sheet was adopted into every shadow root, putting **1,935 `.fa-*` rules**
> into each of 59 roots that matched **nothing**, at 3 network requests per
> page. Kept because the LESSON survives — a shared stylesheet is fetched once
> per page per context, and reading that as a code problem cost a week.

**`npm test` used to fail a RANDOM 1-18 tests per run, and the failing set
changed every time.** Six runs of identical code gave 18, 12, 6, 15, 1 and 7
failures, with the suite taking anywhere from 55 seconds to 5.5 minutes.

Every failure was the same shape: a 30-second `page.goto` timeout in a
`beforeEach`, loading `test/reforged/harness.html`. No assertion ever failed.
Running any affected spec ALONE passed it.

**The cause was Font Awesome, fetched from cdnjs on every page load** — twice:

| where | why |
|---|---|
| the harness `<link>` | the document `@font-face`, which is what DRAWS a glyph |
| `SherpaElement.sharedStyles` | the `.fa-*::before` CLASS RULES, adopted into every shadow root — a document `<link>` does not reach one |

That is 103KB plus webfont files, per page, times 553 tests, across eight
browser contexts that each have their own cache. Repointing only the `<link>`
fixes half of it; the `sharedStyles` fetch is the one that is easy to miss.

Both now point at `/node_modules/@fortawesome/fontawesome-free/css/all.min.css`
— the **same 6.5.2 release, verified byte-for-byte against the CDN's** (103,009
bytes, `diff` clean). So the tests see identical CSS with no network at all, and
run offline.

Result: **~27 seconds, 559/559, six runs out of seven.**

**`src/index.ts` still points at the CDN, deliberately.** That is correct for a
real app — a consumer has no `node_modules` to serve from. Only the harness has
a local copy and 553 page loads, so only the harness rewrites the URL.

The `<link>` must stay a `<link>` rather than an `installIcons()` call: that
function appends the element and returns at once, so the module would race the
stylesheet and `document.fonts.load()` would resolve against a face the parser
had not yet registered.

`playwright.config.ts` also carries `retries: 1` **everywhere, not only in CI**.
It is a NET for the seventh run, not the fix — the fix is above, and went in
first. It is deliberately 1 and not 3: a test that needs three goes is telling
you something, and this must not become the place that muffles it.

Related: `T-fa-pro-icons-fail-silently` is why the harness needs the REAL font
rather than a stub — a Pro glyph is absent from the free webfont and renders as
nothing, with no warning anywhere.

- Site: `playwright.config.ts`

### T-snap-vscode-breaks-webkit

**Every WebKit test failed at `page.goto` with "WebKit encountered an internal
error"** — on Ubuntu 26.04, run from a terminal inside VS Code installed as a
snap (2026-10-02, 917 failures). Chromium and Firefox were fine. WebKit loaded
`about:blank` and a `data:` URL, but no network URL at all.

The browser's own stderr (`DEBUG=pw:browser`) names it:

    WPENetworkProcess: symbol lookup error:
    /snap/core20/current/lib/x86_64-linux-gnu/libpthread.so.0:
    undefined symbol: __libc_pthread_init

The snap sets `GIO_MODULE_DIR` to its own GIO modules
(`~/snap/code/common/.cache/gio-modules`) for every process it starts, and a
terminal inherits it. WebKit's network process loads GIO's TLS module from
there, which drags in the snap's 20.04 libc pieces. Dropping that one variable
fixes it; the config does so only when the value points into a snap.

Sherpa Demos runs its own Playwright config and carries the same line.

- Site: `playwright.config.ts`

### T-the-grid-is-two-grids

The rule was "the 8px grid, with a 4px sub-grid for text". Measured 2026-09-24
against every `space-*` and `size-*` value in all three density modes, that is
not what the tokens do:

| scale | off 4px | off 8px |
|---|---|---|
| space / size, all 3 modes | **none** | 4, 12, 20, 28, 36 |
| font (icons alias it) | 10, 14, 30, 42 | — (it is a 2px scale) |

So spacing is a **4px** scale — 8px is only its even half — and text is a
separate **2px** scale. Two grids, not one grid with a sub-grid, and neither is
8px.

The old lint rule was `v % 2 === 0`, which passed everything either scale can
produce and so reported zero off-grid literals for months. Tightening it to the
real grids surfaced 52 sites; 24 were icon boxes judged against the wrong grid,
26 were `space-3xs`, a real 2px token, and **2** were genuine drawn geometry.

Three things follow, and each is a way to get this wrong:

- **An icon is sized from the TYPE scale**, so `inline-size: var(--sherpa-theme-size-icon-2xs)`
  is a text value wearing a layout property. Judge by the token in the VALUE,
  not by the property name.
- **A px inside `var(--token, 12px)` is the token's own value.** Whether it is
  on the grid is the scale's question, not the component's.
- **`space-3xs` is 2px and is correct.** It is the sanctioned edge case, not
  drift.

The steps are emitted from the scales themselves — a GCD over the values — so a
re-export that moves a scale moves the grid and the lint with it. They are
never typed in.

- Site: `scripts/project-tokens.mjs`
- Site: `scripts/lint-css.mjs`

### T-a-density-mode-is-one-step

A density mode is **one step along the primitive scale** — compact −1,
comfortable +1, clamped at both ends. Measured 2026-09-24 across space and size,
both modes: **45 exact, 7 clamped, 0 wrong**.

It reads as arbitrary in the numbers, and that is the trap. Compact's ratios run
0.250 → 0.875 and its differences run −2 → −16, so it looks like neither a
multiplier nor a shift. It is a shift; the gaps in the scale simply widen
(2, 4, 8) as it climbs.

**Measure against the PRIMITIVE scale, not the space scale.** An earlier pass
measured against `space`, got "10 of 13", and concluded the rule had exceptions.
It does not: `space` skips `28` and `36`, which are real primitive steps, so a
shift landing on one looked wrong. The aliases point at `primitives/scale`, and
against that there are no exceptions.

```
primitives/scale   0  2  4  8  12  16  20  24  28  32  36  40  48  56  64
space skips                            ^^      ^^
```

**0 is the absence of a step, not the smallest one.** `none` stays `none` in
every mode, and the smallest real step never collapses to zero — a gate that
treats 0 as index 0 reports three false failures.

The scale is now emitted as `--sherpa-scale-*` (the one exception to inlining
primitives) so a density block ALIASES one step along rather than restating a
number, and `project-tokens.mjs` gates the rule — proven by breaking one cache
value, which reported `12px → 10px, but one step is 8px`.


**A density overrides SPACE and SIZE only — 27 values each** (Figma's
`variableOverrides`, read live 2026-09-30). The hand-kept file had carried
119: the other 92 were a stale copy of the ramp, and five of them painted an
OLD success green under `[data-density]`, light and dark. The file keeps only
what the collection overrides, and `check:extensions` counts it. With no
colour in a density, no dark re-point is emitted either.
- Site: `scripts/project-tokens.mjs`
- Site: `scripts/check-extensions.mjs`

### T-an-override-collection-is-keyed-by-its-parent

`figma.extensions.json` caches ten Figma collections that the DTCG export
cannot carry. Nothing in the repo writes it, and it went eight days staler than
the export before anyone noticed. The obvious fix — read the values back through
the plugin API — **does not work**, and fails in the way that looks like success.

An override collection's variables key `valuesByMode` by their **parent**
collection's mode ids. Their own mode ids appear nowhere in the chain. Measured
2026-09-24, all ten:

| collection | its own mode id | the key its variables actually use |
|---|---|---|
| Transparent | `…951:35766/951:90` | `18:2` (Style) |
| Saturated | `…953:35878/953:98` | `18:2` (Style) |
| compact | `…94:1014/94:0` | `6:1` (Display Mode) |
| grid-top | `…1200:30207/1200:452` | `1181:11` (Grouping) |

**10 of 10 showed `sawOwnMode: false`.** Transparent and Saturated even alias
the SAME variable (`VariableID:956:36558`) under the same keys, so a read
returns one value for both — while the cache has them differing in 54 of 96.

**SOLVED 2026-09-24 — the values ARE readable, on the COLLECTION.** They are
not on the variable, which is what made every read below fail:

```js
(await figma.variables.getVariableCollectionByIdAsync(id)).variableOverrides
// -> { [variableId]: { [thisCollectionsOwnModeId]: VARIABLE_ALIAS | {color, opacity} } }
```

Keyed by the collection's OWN mode ids — the ones that appear nowhere in any
variable. Verified on `Transparent`: 9 overridden variables, and
`style-content/base` genuinely differs per mode. `T-a-look-override-is-not-on-the-variable`
carries the shape.

Everything below is the dead end that came first, kept because each step looks
like it should work:

- **`mode.parentModeId` exists** and gives the mapping (`951:90` → `18:2`), so
  the keying is not a mystery. Reading through it still returns the same alias
  for both collections — the mapping is right, the override is not there.
- **`resolveForConsumer`** on a frame pinned to the override mode returns
  `null`, for every mode of both collections.
- **A scan of all 776 local variables** found **zero** keyed by an override
  collection's own mode ids. The values are not in the variable data anywhere
  in the file.

Restarting Figma and the bridge plugin changes none of it — the values were
never on the VARIABLE, and that is the whole lesson: three reads agreeing does
not mean the data is absent, only that you are asking the wrong object.

So a capture looks complete, carries real hex values, and is silently the BASE
collection's values with every override gone.

**Will's ruling 2026-09-24: do not build a regenerator.** Read what a task
needs live through the figma-console MCP — now possible for real, via
`variableOverrides` — and hand-patch the file when a value changes.

A hand-patch is exactly where a collection can quietly collapse onto its
sibling, so `npm run check:extensions` guards the shape a good file has: every
collection present and non-empty, and every sibling pair that must differ still
differing by the measured count. Proven by collapsing Saturated onto
Transparent, which it names.

Those counts are MEASURED, not guessed — I first wrote 102 for
compact/comfortable, and the checker reported the correct file as drifted. A
wrong constant in a gate reads as a fault in the data.

**Two real bugs were found on the way**, and both are worth keeping:

- **Figma opacity is 0–100, not 0–1.** Dividing by 100 is required.
- **A nested `COMPOSE_COLOR` must return CHANNELS, not a hex string.** Returning
  a string makes the outer expression's `'r' in col` test fail, and its alpha is
  dropped in silence — which is how `style-surface/shadow` read `#0c0b11`
  instead of `#0c0b114d`.

Unblocking this needs whatever originally produced the cache — a Figma plugin
with UI, reading the document with an override mode actually applied.

- Site: `scripts/check-extensions.mjs`

### T-an-elevation-pin-cannot-reach-a-shadow-root

`--sherpa-shadow-sm/md/lg` resolved to `0px 0px 0px 0px` — an invisible shadow
— inside every component, at every elevation.

The aliases were built from `--sherpa-elevation-offset-x/-y/blur/spread`. Those
default to `size-none` on `:root` and take a real value only from
`[data-elevation="sm|md|lg"]`, a BARE attribute selector in `tokens.css`. A bare
selector cannot cross a shadow boundary, so inside a component the four
geometry values were always zero and the alias built a shadow of nothing.

Measured, not reasoned about: `getComputedStyle` on a `sherpa-container` host
returned `0px 0px 0px 0px` for `--sherpa-shadow-sm` with and without
`data-elevation` set.

**The fault was invisible because everyone worked around it.** Nine components
hand-wrote a `box-shadow`, each with a comment explaining that a
`[data-elevation]` pin never reaches the shadow root. All nine landed on the
Figma geometry anyway, so nothing looked wrong — the token was simply never
used. `grep var(--sherpa-shadow-` across `src/components/` returned zero.

The projector already knew: its `MODE_ALIAS_TARGETS` comment says
*"`var(--sherpa-elevation-blur)` resolves against :root, i.e. the PRIMARY mode
— `passthrough`, all zeros — so the shadow silently vanished"*. It patched the
Navigation collection only.

The aliases now carry Elevation's own per-mode geometry as literals — 2/2/8/-4,
8/8/16/-4, 8/8/32/-8, read from the Figma dump, identical to what the nine
components had written by hand. The COLOUR stays a `var` so a status re-point
still moves every shadow together.

`data-elevation` remains unwired: no component declares it and no example sets
it. Making it work needs a per-component `:host([data-elevation])` rule, which
is a separate decision.

- Site: `scripts/project-tokens.mjs`

### T-an-event-name-is-not-always-a-literal

A component does not always write the event's name at the call:

```ts
emit(open ? 'menu-open' : 'menu-close', {})   // a ternary
emit(event, {})                               // a name from a table
emit(act)                                     // a variable, narrowed by `case`
```

Regex scans missed these names, twice. `sherpa-app-header` published one of
its nine events. On 2026-10-14, `emit(act)` hid `filters-save` and
`filters-save-as` from the toolbar's and the panel's specs, and the
prompt-composer's two. Widening the regex to every string in the file was
worse: it invented 2401 lines of phantom events across 58 components.

**So the NAME is read by TypeScript's checker** (`parseEmits` in
`lib/ts-facts.mjs`), as the detail is. The name is the type of `emit()`'s first
argument: a literal, a union, a variable narrowed by a `case`, or an `as const`
table. A name that types as `string` — `` `${id}-change` ``, `event.type`, an
untyped table — **fails the generator**: write it as literals.

**An event dispatched on ANOTHER element is not the component's own.** Only
`this.dispatchEvent(new …)` counts. The toolbar's and the panel's specs listed a
phantom `button-click` and `menu-change` that they dispatch on a child.

A `Fires:` line reading `menu-open / menu-close` is one name, not two.

- Site: `scripts/generate-component-spec.mjs`
- Site: `scripts/lib/ts-facts.mjs`
- Site: `test/unit/every-emitted-event-is-in-its-spec.test.mjs`

### T-a-stranded-container-fills-its-row

When the last container of a width class sits alone on its final row, it takes
what is left rather than stranding a gap. Measured on Records at tablet: the
gauge used 406 of 828px, half the row empty.

`:nth-child(An + 1 of S)` is what makes this possible. The `of S` argument
counts only siblings matching S — only items of the SAME width — which is
exactly what `sibling-count()` refuses to do (it counts every child of the
grid, so at tablet the four metric tiles made the three charts uncountable).
`A` is `across`, how many fit side by side, so `An + 1` means "starts a row".

Three parts, all required:

| part | says |
|---|---|
| `:nth-last-child(1 of S)` | I am the last of my width |
| `:nth-child(An + 1 of S)` | I start a row, so I am alone on it |
| `:not(:nth-child(1 of S))` | I am not the ONLY one of my width |

The third keeps a LONE container at its declared width. Without it a grid
holding one of each class stretched every single item to full width, since each
was simultaneously first and last of its kind.

RANGE-SCOPED, NOT `min-width`. A `min-width` block stays true at every wider
size, so the tablet rule (`2n + 1`) was still matching at desktop and stretched
a third-width chart to the whole row — measured at 65% row fill where thirds
were wanted. Each band is `(min-width: A) and (max-width: B - 1)`.

Two things CSS still cannot do here, both measured rather than assumed:

- **Count within a RUN.** Indices count among all matching siblings, so a
  different width sitting BETWEEN two mediums desynchronises the parity. Fine
  while each width's containers are contiguous, which is how views are written.
- **`minmax()` in a span.** It is a track-sizing function and a span is an
  integer; the parser rejects `grid-column: span minmax(4, 8)`. `span N / -1`
  does not stretch either — the item already ended at the last line.

`mod()` and `rem()` DO work in all three engines (measured 2026-09-23, an
earlier note in this file said otherwise). They were not needed: the `of S`
selector answers the question directly, needs no `@property` registration, and
is more widely supported than `sibling-index()`.

- Site: `scripts/project-tokens.mjs`
- Site: `test/e2e/reforged-layout-grid.spec.ts`

### T-a-container-width-is-named-not-counted

`data-col-span` takes a NAME, never a number. A view says what a card IS and
each breakpoint decides how many columns that takes:

| name | mobile (4) | tablet (8) | desktop/wide (12) |
|---|---|---|---|
| full | 4 | 8 | 12 |
| reading | 4 | 8 | **8** |
| large | 4 | 8 | **6** |
| medium | 4 | **4** | **4** |
| small | 4 | **4** | **3** |
| xsmall | **1** | **2** | **3** |

Tablet reads as two columns and mobile as one — except `xsmall`, which holds
4-up all the way down for a row of metric tiles that CONDENSE rather than wrap
(TRAP T-a-metric-condenses-by-wrapping).

STATED, NOT DERIVED. An earlier version computed the span from the column count
(`floor(cols / across)`), which reads elegantly and cannot express `reading` —
two thirds is not `12/N` for any integer N. It also hid the one thing a reader
needs to check against the design. The table above is the contract; the numbers
live in `COL_SPANS` in the projector.

A NUMBER was the old API (`data-span="3"`). It is gone because it made the
author hold the column count in their head, and it silently skipped the
responsive collapse a name gives. A DRAG is the one place a count comes back,
in the grid's own attribute and per column count
(`T-a-dragged-layout-is-kept-per-column-count`): the author still writes names.

- Site: `scripts/project-tokens.mjs`
- Site: `test/e2e/reforged-layout-grid.spec.ts`

### T-a-context-steps-by-its-own-width

**Inside the app shell, the layout grid steps by the CONTEXT's width, not the
window's** — TODO 146, level 2. The Context element (the shell's light-DOM
child with no `slot`) is a container, `sherpa-context`, and
`project-tokens.mjs` emits a container twin of every layout band: the column
count, the named spans, the stranded-row fill and fit mode. So the Context
reflows when a pinned nav or an open panel area takes room.

**The container is the LIGHT-DOM Context, declared in `tokens.css` — not the
shell's `.context-frame`.** Measured 2026-10-01: a page rule matched a
container in the shell's shadow tree in Chromium and Firefox, but in WebKit
only for SOME descendants — the Context's own children never matched, so the
grid stayed at 12 columns. A container name set from the shadow tree
(`::slotted()`) matched nothing in WebKit. A document rule on the light-DOM
element works in all three.

**The bands are the viewport's less the shut rail's 40px** (Will, A): 728,
1240 and 1880. So with nothing open, every layout is the same as before at
the same window width. One seam: below 768 the shell hides the rail, so a
728–767px window now gets the tablet band.

**The viewport rules SKIP the Context** (`:where(:not(sherpa-app-shell >
:not([slot]) …))`), or a desktop stranded-row rule would still fire in a
tablet-wide Context. Outside the Context — a page with no shell, or the
Settings overlay — the viewport rules are the only ones.

A Context under the first band read its columns from the VIEWPORT — 8 in a
700px Context, with the phone's names — because the narrowest mode lives on
`:root`. Its twin is now emitted for the Context from 0px. And each band ends
at `.98px`, not a whole px under the next: a fractional width fell between
two bands and matched neither.

- Site: `scripts/project-tokens.mjs`

### T-a-content-grid-has-two-row-modes

`.sherpa-grid` is a layout MIXIN — it works in any sized box, with or without
an app shell, and `data-rows` picks how its rows are sized:

| | |
|---|---|
| (none) | rows hug their content and the grid OVERFLOWS its parent — how every view behaved before these existed |
| `fixed` | every row one grid row high; the grid fills its parent and SCROLLS |
| `fit` | every row one grid row high; the grid fills its parent exactly, and the LAST row takes the rest |

`block-size: 100%` is what makes `overflow` mean anything in `fixed`: without
it the grid grew to 656px inside a 500px parent and scrolled nothing.

**WHEN A FIT GRID CANNOT FIT, IT SCROLLS.** The rows above the filler may
already exceed the area — three `data-rows="6"` cards at 464px each in a 768px
window need 1288px. Crushing the filler to 2px loses content, so it has a FLOOR
of two grid rows and `overflow-y: auto` takes over below that. The page then
behaves like the default mode at that size, which is the honest answer.

The DEFAULT is neither, so nothing that existed before changed. A DRAGGED row
span (`data-row-span-<C>`) is sized in every mode, the default too: an
authored `data-row-span` still hugs there, but a dragged one is a real height
(`T-a-dragged-layout-is-kept-per-column-count`).

- Site: `scripts/project-tokens.mjs`
- Site: `test/e2e/reforged-layout-grid.spec.ts`

### T-a-bare-name-must-be-used-not-mentioned

The spec generator reads the `Public API:` comment, where a wrapped prose
sentence reads exactly like an entry — `stretch — ONE wide control fills the
row` is the tail of `data-align`'s description. So a bare (non-`data-*`) name
must be FOUND in the code, in one of the spellings that means use: a CSS
selector `[name`, an HTML attribute `name=`, a single-quoted `'name'`, or a
`dataset` read.

Declaring `data-align`'s values broke that guard. Every enum value arrives
single-quoted — `values: ['start', 'end', 'between', 'stretch']` — which is
the one spelling the check trusts, so the phantom `stretch` prop passed the
test that exists to catch it, and `sherpa-container-footer` grew a second prop
literally named `stretch`.

The fix blanks `values: [...]` lists before the search. A DOUBLE-quoted match
was already excluded for the same reason: `"stretch"` is a VALUE in
`[data-align="stretch"]`.

Worth remembering as a shape: a guard that reads the source for evidence gets
weaker every time the source gains a new place to spell something.


**Used by the HOST, not by a part inside it** (2026-10-15). A public prop is a
host attribute, so only `:host(…[data-x])` or `this.dataset…` is evidence. An
inner element's `[data-value]` selector or `cell.dataset['value']` was counted,
and kept a calendar's `data-value`, a slider's and a chat message's `data-time`
in their specs for as long as the cells or an alias existed.
- Site: `scripts/generate-component-spec.mjs`

### T-a-spec-on-disk-must-be-the-spec-the-source-makes

`spec:check` generated a FRESH spec from the source and validated and
round-tripped THAT — and never compared it with the `.component.json` on disk.
So a committed spec that no longer described its component passed every
commit.

Found 2026-09-25, twice in one day: the toolbar's spec lacked the new `held`
getter, and the filter panel's still advertised `release()`, deleted in 3c-ii.
Both were caught only because the code map made me regenerate by hand. The
first full run of the new check found three more — `sherpa-app-shell` and
`sherpa-barchart` stale in committed code, `sherpa-accordion` stale in another
session's uncommitted CSS.

So `--check` now has a third half, **fresh**: a generated spec on disk must
equal what the generator makes from the source now. A hand-authored spec (no
GENERATED header) is exempt, as it always was from `--all` writes.

**`--staged` in the hook.** Freshness is checked only for a component the
commit touches. Anyone's half-done CSS makes its spec stale until regenerated,
and a hook that checked every component blocked every commit on another
session's work in progress. The full `npm run spec:check` still checks all 61.

**Proving it needs a real staged change.** Writing the committed version back
and staging it stages NOTHING — the first test of this passed for that reason.

- Site: `scripts/generate-component-spec.mjs`

### T-a-file-says-what-it-holds

Every file's header ends in a `Map:` — one line per export, what it is and
does. `npm run map [path]` prints them all; it is the higher-plane map for
deciding where code goes and what already exists.

Will, 2026-09-25: *"Perhaps keep a lightweight record of each file, variable,
and function that describes what they are, what they do, and why… This can be
used as a higher plane traversal map when deeming where code should go, what
can be refactored, combined, etc. You will need to update this as the final
step of any change. 1 large file might not be the best for context & token use
so maybe something in the file header."*

**Why it is needed, measured.** §15 of `docs/history/FILTER-REVIEW.md` found 207 exported
names in `src/core` that nothing indexed — and new code re-learned lessons
that `nextSort` and `sortDirectionFrom` already carried in `cycle.ts`, three
folders away. The map is the answer to "does this already exist?" in one
command: 297 lines for the whole data and UI core, instead of 30 files.

**What goes where**, so it stays lightweight:

| | lives in |
|---|---|
| a file's purpose | the header's first line — already the convention |
| an export | one `Map:` line in that file's header |
| a component's props, events, methods | its `.component.json` — generated and gated already, so NOT repeated |
| a `#private` member | a one-line comment above it, in place |
| the WHY of anything non-obvious | `docs/TRAPS.md`, cited |

**Gated both ways**, like the traps: an export missing from its Map fails, and
a Map line whose name is no longer exported fails — so it cannot rot. A line
longer than 110 characters fails; that is a paragraph. `check:map --staged` in
the hook makes a CHANGED file carry its map, which is how updating it becomes
the final step of every change.

**A ratchet for the rest.** 91 files had no Map when this landed, and 283
`#private` members had no comment. Both were then done by hand the same day —
one file and 12 members remain, all in the two components another session was
editing, and `scripts/code-map-baseline.json` holds exactly those. The numbers
may only fall; `node scripts/code-map.mjs --privates` lists what is left.

**An export LIST is exports too.** `export { generateSpec, toYaml };` at the
bottom of a file read as "exports nothing", so the file never needed a Map —
the same blind spot as the spec gate's, found the same day. A name in a local
list counts when this file DECLARES it; one it only imported is a re-export,
mapped in its own file.

**The drafts are drafts.** `map:write` fills a line from the JSDoc above the
export, and 60 of 297 came out blank, cut off, or wrong — a section banner
(`── Grouped aggregation ──`) read as a description, *"Read it back."*, a
type's line describing the one below it. Every line gets a human pass.

- Site: `scripts/code-map.mjs`

### T-a-constructed-event-is-not-a-dispatched-one

`new CustomEvent(...)` builds an object. Only `dispatchEvent` makes it public.

The spec generator scanned for `new CustomEvent('name'` and wrote every hit
into the contract as an event. `sherpa-data-grid` constructs
`new CustomEvent('menu-clear', { detail: {}, bubbles: false })` and passes it
straight to a handler as a plain argument — it is never dispatched — so the
grid's contract carried a tenth event that no listener could ever receive.

`bubbles: true` is the tell, and it is already the house rule: every public
Sherpa event sets it, and `emit()` sets it for you. So the scan now requires
`bubbles: true` on the constructor call. A private event object built for a
handler does not set it, and is correctly left out of the contract.

- Site: `scripts/generate-component-spec.mjs`

### T-kind-says-how-not-whether

A prop's `kind` says **how** it is realised. `observed` says **whether** the
component watches it. They are independent, and for a long time one field
carried both meanings.

`compileDef` derived the observed list from `kind !== 'style'`, because the spec
had no other channel for it. So the generator was forced to write `kind:
content` onto any attribute a component observed — including CSS-only ones,
which write no text at all. Measured before the fix: **156 props across 39
components** claimed `kind: content` with nothing in their TS to back it.

Nothing rendered wrong. What was wrong is what a reader was told: the MCP
server, and any agent reading a spec, saw 156 attributes that write text into
the shadow DOM and do not.

Three changes close it:

- the schema gained `observed`, and `kind`'s description now says it is not a
  statement about observation;
- `compileDef` reads `observed` when a spec carries one, falling back to the old
  `kind !== 'style'` signal for a spec written before the field existed;
- `parsePropDecls` reads `static override props`, which is the only honest
  source for `kind`. The TS beats a prior spec's inferred kind.

Afterwards: 43 `kind: content` props remain, and every one is backed by a real
declaration.

**And `declared` says WHERE it is listed** (TODO 195, 2026-10-12). A prop in
`static props` is `declared: true`, and `populate({ label })` sets `data-label`
only for a declared prop. It is `observed: true` where the base class observes
it by itself, or where the component lists it in `static observed`
(`T-observe-what-does-work`); `compileDef` rebuilds that list without the
first. Its type, values and default come
from the declaration first, read by TypeScript's parser so `...SUMMARY_PROPS`
and `SHARED_PROPS['data-size']` resolve. A fifth kind, `behaviour`, is an
attribute only the component's own JS reads.

- Site: `scripts/lib/ts-facts.mjs`
- Site: `scripts/lib/generation/compile-def.mjs`
- Site: `scripts/generate-component-spec.mjs`

### T-a-generated-region-still-declares-api

`lint:css` slices a component's CSS at `/* == end sherpa:tokens == */` and scans
only what lies below. That rule is right for LINTING — everything above the marker is Figma's, and
hand-editing it is undone by the next projection. It is wrong for a CONTRACT. A
`:host([data-size])` rule is public API wherever it sits, and the projection
puts several there: sliced, `data-size` on `sherpa-button` (the five-value enum,
at line 15 of a file whose marker is at line 60) and `data-state` on
`sherpa-input-text` were both invisible to the gate.

Scan the whole file. Edit the region in Figma.

- Site: `scripts/check-props.mjs`

### T-a-read-is-public-api-a-write-is-not

`this.hasAttribute('data-locked')` is a host's instruction arriving. The
component did not put it there, so the attribute is public API and belongs in
the spec — the same event as reading `this.dataset`, which the gate already
caught.

`this.setAttribute('data-copied', '')` is not. 25 components toggled their own
transient state this way — `data-resizing`, `data-leaving`, `data-dragover` —
and a gate that flagged those would be asking a component to declare its own
private flags as API. **Since 2026-10-14 such state is a `:state()`**, not an
attribute (`T-private-state-is-a-custom-state`); the ones CSS selects moved
first, and the rest move with TODO 275.

So the read half of `*Attribute()` is gated and the write half is not.
Measured when the rule was written: 43 undeclared attributes in total, splitting
14 read-only, 25 write-only and 4 both. The 14 were the real gap, and five of
them were `data-locked` — the attribute the whole state-ownership convention
rests on, undeclared by every component that obeys it.

**The `data-has-*` skip is gone** (2026-10-15). It was meant for the base's slot
writes, and exempted seven hand-written ones as well. The slot ones are
`has-<slot>` states now, the private hand-written ones states too, and the one an
app watches, `data-has-values`, is declared.

- Site: `scripts/check-props.mjs`

### T-writing-a-child-is-not-owning-yourself

`check-ownership` flags a component that writes a value the `DataSource` owns.
Its write regex was unanchored, so `chip.setAttribute('data-current', …)` read
the same as `this.setAttribute('data-current', …)`.

They are opposites. A parent writing a CHILD's attribute is configuring
something it owns — and the two components that do it most,
`sherpa-quick-filter-toolbar` and `sherpa-data-grid`, declare those chips
`data-locked` **in their own markup** precisely so that they can. The grid says
so beside the declaration: a chip derives its on-state from checked rows, and
this menu has none, so unlocked it switches itself off the instant Apply closes.

Measured across the tree: **25 `data-current` writes, 22 of them to a child**.
The remaining 3 are all inside a `set current(v)` accessor, which the gate
already exempts — a setter is the host's own door for writing the value.

So adding `data-current` to `DATA_PROPS` with the old regex would have reported
22 faults and zero real ones. The regex now requires `this.`, and covers
`toggleAttribute` and `removeAttribute` as well as `setAttribute` — a gap that
had hidden real self-writes, verified by planting one and watching it fail.

- Site: `scripts/check-ownership.mjs`

### T-a-look-override-is-not-on-the-variable

A LOOK collection — `Transparent`, `Saturated` — does not own its variables. Its
`variableIds` point at the **Style** collection's, keyed by Style's mode ids, so
reading a look through the VARIABLE returns the base value and every look looks
the same.

The override is on the **collection**:
`(await figma.variables.getVariableCollectionByIdAsync(id)).variableOverrides`
gives `{ [variableId]: { [lookModeId]: alias | { color, opacity } } }`. It holds
only what the look overrides; the rest is the parent's value in the same mode.

So `figma.extensions.json` stores the two looks as exactly that — refs, sparse —
and the projector emits every gap as `var(--sherpa-style-<mode>-…)`, the parent.
Before 2026-09-24 they were light-mode hex from a probe: no dark mode, and 39
values stale against Figma.

Name each target by its variable ID, in the EXPORT's words. The export is older
than Figma: `957:36740` is `content/body/base-fixed` in the export and
`content/body/inverse-fixed` live, and a new `base-fixed` exists only live. A
live name resolves to the wrong token or to nothing, silently — so
`project-tokens.mjs` warns when a look reads a name nothing declares.

`figma_export_tokens` still cannot produce a look, and its `lastSyncedValue` is a
cache of its own — a "fresh" export can assert a stale alias.

- Site: `scripts/project-tokens.mjs`

### T-a-pin-a-page-can-re-point

TODO 353 (Will, 2026-10-19). Demos' "Show active filters in green" re-pointed
the Style `active` names inside the filter bars and the panel. A grid heading's
filter chip lives in the grid's shadow root: a page selector cannot reach it,
and widening the rule to the grid would turn every active thing in it green.
Will: *"Why can't this styling just be set on the filter chip scope?"*

It can. A state pin in `scripts/figma-data/state-pins.yaml` may carry a HOOK —
`'&[data-current]': active @filter-on` — and the projector writes each Style
name as `var(--sherpa-filter-on-<name>, var(<the mode's token>))`. A page sets
the hook's names ONCE (`--sherpa-filter-on-surface-base`, …) and, being custom
properties, they inherit into every shadow root, where only the chip's pin reads
them: every filter chip follows — bar, panel, grid heading — and nothing else.
Unset, the pin is exactly the mode, as before. The chip's pending edge reads the
same hook. A chip's fill FADES (100 ms), so a test reads it once it settles.

Two more read it, so the on colour is one colour (TODO 468): a filter menu's
pressed f(x) button (`sherpa-menu`'s `.use-advanced` pin) and the grid's
`mark.match`.

- Site: `scripts/project-tokens.mjs`

### T-tokens-are-safe-to-embed

**`tokens.css` can go into someone else's page** (TODO 216). It styled the
page itself — `html`/`body` margins, the body's font and colours, the app
shell's height — so a host that linked it changed. Those rules are a sheet of
their own now, `sherpa-ui/css/page` (`page.css`), which an app links beside
`tokens.css`; a host embedding a component links `tokens.css` alone.

**No `data-mode` is LIGHT** (Will, TODO 216, A). It followed the OS, so a
light-only app on a dark machine drew dark controls. Dark follows the OS only
under `data-mode="auto"`, the opt-in a starter sets.

**What still reaches anywhere, on purpose:** `[data-status]`, `[data-look]`
and `[data-density]` on ANY ancestor re-tint or re-size every Sherpa control
inside it — that is the cascade (`T-a-state-colour-binds-the-style-mode`).
So a host's own `<tr data-status="active">` tints the Sherpa controls in that
row. Name a host's own state another way, or wrap the controls in an element
that sets the value back.

The one rule a component adds to a host page itself is `body > .sherpa-toast-stack`,
in `@layer components`, and only once a helper shows a toast
(`T-a-page-sheet-is-for-what-a-component-puts-in-the-page`).

- Site: `scripts/project-tokens.mjs`
- Site: `test/e2e/reforged-document-reset.spec.ts`

### T-markup-is-checked-against-the-spec

**A typo in an attribute does nothing and says nothing**, and neither does an
attribute the library renamed. So the app's markup is checked against the
specs (TODO 195): every `sherpa-*` tag is a component, every `data-*` on one
is in its spec, and an enum takes the value written. Found on its first run in
`../Sherpa Demos`: a `data-label` on a bar chart, which reads none — the page
meant the chart's name, so it is an `aria-label` now and the charts take one.

Allowed everywhere: the token cascades (`data-status`, `data-look`…), the
attributes a PARENT reads from its children (`data-col-span`, `data-grow`…),
and the base class's `data-source` and `data-scope`. A project's own hooks
are listed in its `sherpa-usage.json` `"own"`, so each is a choice, never an
accident.

**An app runs it on itself**: `npx sherpa-ui check-usage <folder>`, which
ships in the package. sherpa-ui's hook ran it on `../Sherpa Demos` until
2026-10-14; Sherpa knows no app (Will, Q2), so Demos runs it first in its own
`npm test` now.

- Site: `scripts/check-usage.mjs`
- Site: `bin/sherpa-ui.mjs`
- Site: `test/unit/check-usage.test.mjs`

### T-a-detail-is-typed-by-the-checker

**An event's detail fields are typed by TypeScript's checker**, not guessed
from the text. The old reader named a type only where the text could be
nothing else — a literal, a `??` fallback — so 155 of 174 fields read
`unknown`. `parseEventDetails` builds ONE program over the source per run and
types each field of every `this.emit('name', { … })`: a spread and a named
object resolve too. Measured 2026-10-12 (TODO 195): 181 fields, none
`unknown`. A field two call sites type differently is their union — the
payload really varies. A long nameless object is written `object`; a name
says more than its fields.

The rule that held the old gap open still holds: a wrong type in a contract
is worse than an honest gap. The checker's type is not a guess.

- Site: `scripts/generate-component-spec.mjs`
- Site: `scripts/lib/ts-facts.mjs`

### T-a-spec-reads-the-class-by-its-parser

**A spec's methods and properties are read by TypeScript's own parser**, from
the class `define()` registers — never by a pattern over the
file. The API audit (TODO 86, 2026-09-29) found what the patterns did:

- **False members.** A two-space `name(args):` line inside a `type` literal
  read as a method, and any `get name()` in the file as a property — so the
  provider's spec listed `populate` and `elements`, and the button's `show` and
  `hide`. None of them exist, and the MCP's `component_api` advertised them.
- **Cut summaries.** Only a comment's first line was kept: 32 of 67 method
  descriptions stopped mid-sentence.
- **A description that never refreshed.** `$description` was carried from the
  last spec before the source's header was read, so the provider's still said
  "region" after the rename to "subtree". The header's first paragraph now
  wins.

A `protected` member (`templateId`) is the base class's contract with a
subclass, not public API, so it is left out.

- Site: `scripts/lib/ts-facts.mjs`
- Site: `test/unit/class-api.test.mjs`

### T-the-mcp-reads-sherpa-ui-through-one-door

**The MCP is its own package, `sherpa-ui-mcp`, and it reads the `sherpa-ui`
installed beside it** (TODO 192; Will, A). Importing `../../scripts/…` or
reading `../../docs` and `../../src`, which exist only in a checkout, makes the
published package die at load.

`mcp-server/lib/sherpa.js` is the one door: `SHERPA_ROOT` is the installed
`sherpa-ui` (resolved from `sherpa-ui/package.json`), or the checkout the MCP
sits in. `READS` names every file it reads, by its path in the package — the
specs, the examples, the sources, `schemas/`, `custom-elements.json`, the two
served docs and `tokens.css` — and every tool and resource reads through it. A
name from a caller is one path segment, so no URI reaches out of the package.
`IMPORTS` names every built entry it RUNS (`sherpa-ui/data`), imported by the
package's own `exports`, as an app imports it, never by a path into `dist/`.

**It reads sherpa-ui's own files and never a copy** (plan 700 G1). The old MCP
copied sherpa-ui's generation code into a `vendor/` as it was packed, and
served a fifth form of a spec, the def; both were deleted with it. sherpa-ui
ships no MCP code and no Figma file.

Two checks hold it. A node test reads `npm pack --dry-run` for both packages:
sherpa-ui packs every file in `READS` and no Figma file; the MCP imports nothing
outside its folder and depends on exactly the packages it imports, and
`sherpa-ui`. `npm run check:mcp-pack` packs both, installs them into an empty
folder and calls every tool, resource and prompt — it uses the npm cache, and
the network for a file the cache lacks.

- Site: `mcp-server/lib/sherpa.js`
- Site: `scripts/check-mcp-pack.mjs`
- Site: `test/unit/the-mcp-package.test.mjs`

### T-a-starter-is-one-folder

**A new app starts from create-sherpa-ui** (TODO 222; Will, A): one folder
with no build and no server of its own — `index.html` (the shell and
`outlet.start()`), `app.json`, one Context's template, page definition and
Views, its store with seed rows, an optional module, `package.json`,
`.mcp.json` and an `AGENTS.md` that says where each kind of file goes.

**It is not in sherpa-ui.** An app template holds app content, which an
app-agnostic library does not (Will, D4 and Q1). It is the package
`create-sherpa-ui`, in the sibling project `../Sherpa Starter`, and its door is
`npm create sherpa-ui <folder>`.

Its `.mcp.json` starts `node node_modules/sherpa-ui-mcp/index.js`, so that path
is the MCP's contract with every app made from it: the package's `bin` names
it, and `check:mcp-pack` starts the installed server with the command the
template names, so it fails the day the two part.

npm drops a package's `.gitignore`, so the template keeps it, and
`.mcp.json`, WITHOUT the dot, and the door adds it. The app imports
`sherpa-ui` from `./node_modules`, so it is served from its own folder: a
server that rewrites `/app/index.html` to `/app` resolves every relative path
against `/`. Its tests are in its own project.

- Site: `scripts/check-mcp-pack.mjs`
- Site: `test/unit/the-mcp-package.test.mjs`

### T-a-page-loads-the-bundle

**A page with no bundler loads `dist/bundle/`: Sherpa joined into a few files.**
TODO 350 D1 (Will, A, 2026-10-22). The module files are about 200, and the
browser finds each import only after the file before it lands: Records asked
for 221 files, so on a fast 4G network its first paint waited 3.45 s for the
chain. The production build joins each entry (`index`, `data`, `app`,
`components`) with esbuild, split so they share their common code. Records now
asks for 33: fast 4G 2.1 s cold, 1.4 s warm (Demos also compresses).

Three things make it work, and each looks odd. **Every file sits in one folder**,
and the build moves each module's own `new URL(…, import.meta.url)` to point
from there (`installTokens()` links `tokens.css` beside `components.js`; the
icon sprite stays beside `render-icon.js`, `T-an-icon-loads-when-first-drawn`).
**A DEV build** writes each entry as a pass-through to
the modules, so the same import map serves live reload — a bundle of fetched
templates would ask for them beside the bundle, where they are not. **One page,
one copy:** map every entry to the bundle or every one to the modules; a mix
defines each class twice.

- Site: `scripts/build-reforged.mjs`
