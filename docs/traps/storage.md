# Traps — Storage, saved Views and the URL

One of the eleven areas of [the traps](../TRAPS.md): each entry is here because its
first `Site:` is in this area (`npm run check:traps` holds it so). 38 entries.

### T-the-router-owns-the-url

**`sherpa-router` is the ONE owner of the URL, on the Navigation API** — TODO
67, the first part of the utility layer. A link, `router.go()` and the
browser's Back all REQUEST a navigation. The router hears every one in the
`navigate` event, intercepts it so the page never reloads, and reports
`route-change { route, previous, changed, type, waitUntil }`. Nothing else
touches `history`. The example app had four `pushState` / `replaceState`
sites, a `popstate` listener, and two click listeners that stopped a link's
reload by hand; all are gone, and one `route-change` listener makes the screen
match the URL.

**A route is the search parameters the router OWNS** — `data-params`, each a
`name` or a `name=default`. Any other parameter (`?live`) is kept as it is. The
arithmetic is `src/core/browser/route.ts`, pure, proved in Node.

**An OVERLAY parameter opens over the page** — `data-overlay="settings"`. A
link that names only overlay parameters (`?settings=profile`) means less than
it says: on its own it would drop the Context under it. The router keeps the
base it left out, and goes to the WHOLE URL instead, so the address bar, a
reload and Back all say the same thing. A link that names a base parameter is
the whole base: its View is its first, and the overlay shuts. Back and forward
are never settled again — that URL was settled when it was made.

**`changed` is what a listener acts on.** Settings opening is `['settings']`,
so the Context under it is not reloaded.

**The Navigation API is REQUIRED; there is no `history` fallback.** Probed
2026-09-30: Chromium 153, Firefox 155 and WebKit 26.6 all have it, with
`intercept()`.

Four things that look wrong and are not. Listening starts in
`connectedCallback`, not after the first render — a press before the template
arrives would reload the page. Focus and scroll are `manual`: a View pick is a
navigation, and must move neither. A navigation to the URL it is on changes
nothing and reports nothing. And only a REAL link navigates: a nav row's
hidden `<button>` no longer does, which three tests were pressing.

One behaviour changed: a Context row pressed while on one of its later Views
goes to its first View, because that is what its href says.

- Site: `src/components/sherpa-router/sherpa-router.ts`
- Site: `src/components/sherpa-router/sherpa-router.html`
- Site: `src/core/browser/route.ts`
- Site: `test/unit/route.test.mjs`
- Site: `test/e2e/reforged-router.spec.ts`
- Site: `src/app.ts`

### T-a-saved-view-is-the-readers-own

**A reader saves, saves over and deletes only their OWN Views; a preset is
never touched** — TODO 15. The App Header's Save and its ▾ ("Save view as",
"Delete view") are REQUESTS (the View bar's until TODO 425 G9) (`view-save`, `view-save-as`, `view-delete`); the
SHELL answers them for every page with one name dialog and one confirm, and
the provider does the work: `saveView(name)` saves a NEW View — a name any
View has gets ` - Copy-001`, then `-002` (`uniqueViewLabel`); `saveView()`
with no name saves over the reader's View on screen and answers nothing on a
preset, so Save on a preset asks for a name instead; `deleteView()` deletes
the reader's View and goes to the first. On each `view-change` the outlet
marks the header `data-custom-view` while one of the reader's is on screen
(`provider.customView`) — "Delete view" shows only then, critical — and the View chip lists the reader's under
"Custom views", at the bottom. The Dashboard's own save handler is gone.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/browser/persist-view.ts`
- Site: `test/unit/parity-sweep.test.mjs`
- Site: `src/components/sherpa-provider/provider-page.ts`
- Site: `src/components/sherpa-outlet/sherpa-outlet.ts`
- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`
- Site: `src/components/sherpa-app-header/sherpa-app-header.css`
- Site: `src/components/sherpa-app-header/sherpa-app-header.html`

### T-one-page-one-document

**A page's state is ONE document, `PageState`, with ONE keeper** — plan 695 U3.
One document per page, under its name (an outlet's Context) — not nine keepers
in three shapes, where "draft" meant two things:

| part | is | tier |
|---|---|---|
| `view` | the View on screen | the tab |
| `query` | its Query applied, exact | the tab |
| `draft` | what waits for Apply — the ONE meaning of draft | the tab |
| `ui` | each element's own state, by id | the tab |
| `left` | each View the reader changed and left | the tab |
| `added` | the saved filters on a bar, with their scope | the tab |
| `toolbars` | each card's filter toolbar, shown or shut | every tab |
| `views` | NAMED: the reader's own Views | every tab; the database, a server |
| `filters` | NAMED: the reader's saved filters | every tab; a server |

`PageKeeper` keeps it: `read(page)` reads through each tier, so another tab's
named parts are seen at once; `write(page, parts)` sends each part to its tier,
and `undefined` forgets one. A tier is pluggable (`sessionTier`, `localTier`,
`memoryTier`, or the app's own). Web Storage is the only synchronous tier, so the
keeper is read before the first load (`T-restore-before-first-load`); the
database and a server sit behind it (`T-local-first-then-onward`). The App
Context's one answer is the keeper's too, for the tab (`appContext`).

The provider holds one: `provider.keeper`, the app's set before a page opens.
Every keeper of old goes through it — the kept Query, what was left on each View,
the saved Views and filters, the sets on a bar, a card's toolbar, the App Context,
the outlet's Views (`viewsOf`) and a Context's element state (`keepUi`); and
`provider.export()` hands out the same shape. The URL's `?view` stays the
router's (`T-the-router-owns-the-url`): the outlet hands it to `open()`, and the
document's `view` follows each pick.

**A stored part this version cannot read is dropped, never half-applied**; a part
made of the reader's own entries loses only the broken ones, and a document of
another `v` is not read. A reader's saved Views and saved filters as v2 kept them
(`sherpa:views:<page>`, `sherpa:filter-sets:<page>`) are read ONCE into the page's
document, and the old keys go only once the new one holds them. What else v2
kept was the tab's, and is not carried.

- Site: `src/core/browser/page-state.ts`
- Site: `src/components/sherpa-provider/provider-page.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/app.ts`
- Site: `test/unit/headless-data-layer.test.mjs`
- Site: `test/e2e/reforged-a-page-keeps-one-key.spec.ts`
- Site: `test/e2e/reforged-only-a-named-part-crosses-tabs.spec.ts`
- Site: `test/e2e/reforged-provider-saves-filters.spec.ts`

### T-only-a-named-part-crosses-tabs

**Only what the reader NAMES crosses tabs** — Will, 2026-10-20 (TODO 370): *"The
only way to share filter configurations across tabs, windows, or sessions is if
they are saved by the user to a custom definition."* Each part's tier is declared
ONCE, in `TIER_OF`: the reader's own Views and saved filters are every tab's
(localStorage); the View on screen, its Query, what was left on each View, the
sets on a bar and each element's state are the TAB's (sessionStorage). Two tabs on
one screen filtered differently is a feature; a shared tier would make them fight.
A card's toolbar is every tab's, as chrome, like the nav's pin. A store's History
is per tab too (345 D2 B), outside the keeper.

- Site: `src/core/browser/page-state.ts`
- Site: `test/e2e/reforged-only-a-named-part-crosses-tabs.spec.ts`

### T-a-view-keeps-what-the-reader-left

**A View keeps what the reader left on it, unsaved** — Will, TODO 144: *"Filter
configurations should survive view swaps during a session, even if not saved as
a definition … configurable options for filtering (on by default)."* A pick used
to put the View's own filters on, so what the reader had set on the View they
left was gone.

**It is the TAB's alone** — Will, 2026-10-20 (TODO 370;
`T-only-a-named-part-crosses-tabs`). The "across sessions" mode is gone.

The page's document keeps it as `left`: View id → `{ query, sig }`, the query a
View's JSON. `sig` is the View's own definition as it was then: one left over
another definition is DROPPED, so a changed preset never hides behind it. The
keeper's `eachView` is asked at every write, so a setting applies at once; off,
no View keeps what was left, and only the View on screen's `query` survives a
reload. It is the keeper's, so no outlet passes it on.

Four things that are not obvious:

- **Only the READER's changes write it.** A pick and a reset write the
  source too, and heard then, the NEW View's filters were kept under the
  OLD View's name (its id changes only after the pick's async write). So a
  whole Query put on says who put it — `setQuery(q, { by })` rides on its
  `query-change` — and the keeper keeps only a change with no `by`, or
  `by: 'reader'` (a saved set taken). A pick is `'view'`, a reset or a save
  `'provider'`. 366 step 24 replaced a two-frame "provider is writing" flag,
  which also dropped a reader's change made in those frames.
- **A pick FLUSHES first**: a change still waiting for its frame is written,
  under the View it was made on, before the pick's own write.
- **It is read INSIDE the pick** (`onViewPicked`'s `left` hook), in place of
  the View's Query, so the View's own filters never flash. It is a RESTORE, so
  it is exact: a carry-over field does not follow into it.
- **Reset all on view, Save and Delete forget it**: the View's own filters
  are on, or the filters have a home.

- Site: `src/components/sherpa-provider/provider-page.ts`
- Site: `src/core/browser/page-state.ts`
- Site: `src/core/browser/persist-view.ts`
- Site: `test/e2e/reforged-a-view-keeps-what-the-reader-left.spec.ts`

### T-one-snapshot-not-a-key-per-concern

ONE SHAPE, not a key per concern: a key each for source state, column filters,
selection and chips is four shapes and four restore paths for one idea. A saved
view, a preset, a deep link and an agent's MCP request are the
SAME object; that is the point of having one shape: a View, `{ query, ui }`, its
`query` a View's JSON, put back by `setQuery` (366 step 10), and its `ui` each
element's state. `applyView` applies it, `captureView` reads it back, and a
page's kept `ui` is the same (`keeper.keepUi`).

**WHAT EACH ELEMENT CONTRIBUTES is the caller's function**, because only the
caller knows which properties are view state and which are incidental — guessing
would restore someone's scroll position a week later. Each returns an
`ElementNode.state` block, so a saved view and a preset interchange. The same
rule is why `captureView`'s `reads` map is required and why omitting it makes an
element contribute nothing.

The page's document carries the version of the SHAPE, not of the data
(`PageState.v`). A saved view outlives the code that made it, and an unrecognised
version is ignored WHOLE rather than half-applied, because a state applied in
part leaves a screen nobody designed (`T-one-page-one-document`).

- Site: `src/core/browser/persist-view.ts`
- Site: `src/core/browser/page-state.ts`
- Site: `test/e2e/reforged-data-source.spec.ts`

### T-restore-before-first-load

RESTORE FIRST, before anything is wired, so each component takes its kept
state before the first rows arrive, rather than drawing empty and then again.
The keeper reads the tab's tier SYNCHRONOUSLY: `open()` puts the kept Query on
before the first load, a whole Query restored with `setQuery` in one load (366
step 10), and `keepUi` puts each element's own state back as it is called.

The save side is the mirror: `keepUi` hangs off the source's **`change`**, which
fires after a load COMPLETES — the one moment the state is both settled and known
to be loadable.

`DataSource extends EventTarget`, so `addEventListener` honours the
`AbortSignal` natively — no second way to say "stop" (see
`T-signal-not-a-teardown-list`).

- Site: `src/core/browser/page-state.ts`

### T-apply-degrades-never-throws

`applyView` DEGRADES rather than throws. A saved view outlives its code —
a component renamed, a column dropped, a method gone — and one stale key must not
stop the rest being restored. What could not be applied comes back in the report,
so a host can tell the user rather than leave them guessing.

```js
const report = applyView(view, { query: source.query, elements: { grid } });
if (report.missingElements.length) … // tell someone
```

**ORDER MATTERS and is fixed here:** the Query first (`setQuery`), so the rows
a component's state refers to are on their way, then each element. An element that has not
drawn yet (`hasRendered` false) gets its state once `rendered` settles — a grid
cannot filter a column it does not have yet, and a composer wrote its value
into a textarea that did not exist, so it was lost (TODO 113). A drawn element
is applied at once. That deferral is also why the report can only name what it
knows NOW: a not-yet-drawn element's skips are added to it when they land.

The same rule governs `onViewPicked`, which reports gaps and never throws; the
default is a `console.warn`, because a definition that could not be fully applied
is worth saying out loud rather than leaving a reader to wonder why half the
screen moved.

- Site: `src/core/browser/persist-view.ts`
- Site: `test/e2e/reforged-view-definition.spec.ts`
- Site: `src/components/sherpa-layout-grid/grid-resize.ts`

### T-capture-reads-only-what-is-named

WHAT `captureView` READS is named per element, because only the caller knows
which of a component's properties are view state and which are incidental. A
grid's column filters belong in a saved view; its scroll position does not.

```js
captureView({ elements: { grid } }, { grid: ['columnClause', 'selectedKeys'] })
```

**Omit the map and each element contributes nothing** — deliberately, because
guessing would put transient state in a saved view and a reader would find their
scroll position restored a week later.

A property whose value is a FUNCTION is skipped: `columnClause` needs a field
argument, so a caller wanting it must name the setter form instead. Skipping
beats storing `"[object Function]"`.

- Site: `src/core/browser/persist-view.ts`

### T-view-library-is-one-vocabulary

A page rarely has ONE saved view; it has a SET, offered in a chip, and picking one
applies it. Both example pages wrote that by hand and wrote it the same way — the
chip options derived from the set, a listener reading `detail.values.view[0]`, an
apply, and a warn when a stale definition could not be fully restored.

Four small pieces of one idea, copied. **The third copy is where a vocabulary
starts to drift**, so it lives here instead.

The chip's options are DERIVED from the views themselves (`viewOptions`). A
hand-written option list is a second place the label lives, and the two drift: a
view renamed in one file still reads by its old name in the chip. `currentId`
defaults to the FIRST view, because a set with nothing selected leaves the chip
blank and a reader looking at data no view claims — which is also what
`T-persistent-chip-is-a-selector` guards on the toolbar side.

- Site: `src/core/browser/persist-view.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`

### T-library-re-read-on-every-pick

`onViewPicked`'s `views` may be a FUNCTION, and should be whenever the set can
grow.

A library GROWS — a reader saves a view and it joins the set — and a listener
holding the object it was wired with would never see one. **The dashboard's Save
button wired the presets and then could not restore anything the reader had
saved.** So the library is RE-READ on every pick. Pass the object only for a
fixed set of presets.

- Site: `src/core/browser/persist-view.ts`

### T-values-carries-two-shapes

`onViewPicked` listens for THE BAR'S `quick-filter-change`, not a single chip's,
and gates on `detail.scope !== 'bar'`.

`values` carries TWO SHAPES on this one event name — a bare `string[]` from a
chip, a `Record<id, string[]>` from the toolbar — and reading one as the other is
a bug that has already shipped once: **a view turned a sort pick into a filter and
emptied the grid.** Same family as
`T-capture-beats-registration-order`.

This USED to be safe by accident: `['name']['view']` is `undefined`, so a chip's
array fell through the next line. Accidental safety is the kind that stops
working when a shape changes slightly.

It then READS `detail.values.view[0]`, the View chip's id — the one convention a
view toolbar has. A change naming no view is IGNORED rather than treated as "no
view", because you are always in some view and the other chips on that bar fire
the same event.

- Site: `src/core/browser/persist-view.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-content-first-original-once

CONTENT FIRST, when a picked view brings its own. It is built BEFORE the snapshot
because the snapshot configures what is ON SCREEN, and for this view that is what
we are about to create. Applying first would set state on the OUTGOING screen and
then throw it away.

The host says WHERE via `into`. Without it the content is built and handed back
unplaced in `pick.rendered`, which is honest: this function knows what a view
wants, not where a page keeps it.

**REMEMBER WHAT WAS THERE, once, before the FIRST replacement.** A set of views
is usually MIXED: most share the page's own content and one or two bring their
own. Without this, the first view that brought content kept the screen for good —
picking any other view moved the data while capacity's grid stayed on display,
which is the exact lie this whole feature exists to prevent. Captured on the
FIRST swap only, so it holds the PAGE'S own content rather than the previous
view's.

`replaceChildren`, not `append`: switching view REPLACES the content, and a view
that leaves its predecessor's charts on screen is two views at once. Going back,
the original nodes are RE-ATTACHED, not rebuilt — they are the same elements the
page bound at init, so every bind still points at them and nothing has to be
re-wired.

Elements a view just built are then addressable by the ids it used, so the
snapshot can configure them: they did not exist when the listener was wired, so
`targets.elements` could not have named them.

The page's own children are kept PER REGION, for every listener on it — a page
re-heard after `import()` still finds them. And a View already on screen when
the listener starts (the page was opened on it, by a link or a reload) draws
its own content then: its Query is on, so no pick ever would. Sherpa Demos
showed the Fleet cards under a chip that said Capacity planning (TODO 198).

- Site: `src/core/browser/persist-view.ts`
- Site: `test/e2e/reforged-view-markup.spec.ts`

### T-derived-id-makes-resave-an-update

A saved View's and a saved filter's id is DERIVED from its label — lowercase,
words joined by a hyphen — rather than generated. That is what makes saving over
one an **UPDATE** in its place: `saveView()` with no name keeps the id of the View
on screen, and a renamed set moves to its new name's id where it stood. A random
id would leave a reader with two "Q3 capacity" rows and no way to tell them apart.

A label of pure punctuation still needs an id, so the slug falls back to the RAW
label; that keeps it addressable rather than colliding on an empty key.

A delete REBUILDS the part without the id rather than `delete views[id]`. A
dynamic delete on a parsed-JSON object is the one shape that can carry a
prototype key through — and this object came from storage, which a person can
edit (`T-storage-access-throws`).

- Site: `src/core/browser/web-storage.ts`
- Site: `src/components/sherpa-provider/provider-page.ts`

### T-attributes-are-the-state-channel

**State travels as an ATTRIBUTE, and there is exactly one mechanism for it.**

```
DataSource  →  setAttr(el, 'data-sort-field', 'name')
                          ↓
grid        →  this.dataset.sortField
```

That is the contract for all 58 components: attributes carry state IN, events
carry intent OUT. So a second mechanism for the same job is a second answer.

`renderView` had one. Its `$state` binding compiled to exactly this:

```js
el.setAttribute(name, String(v));   // render-view.ts
```

An attribute. On top of it, `$state` added re-set-on-change and `writes` added
write-on-event — set a value, listen for a change, set it again. **That is
`bindSource()`**, which also knows the query behind it and has
`readonly`, `steerOnly` and `ignore`, none of which `$state` had.

The audit settled which one was real:

| | app code | tests |
|---|---|---|
| `$state` construction sites | **0** | 3 |
| `writes:` arrays | **0** | 2 |
| `renderView()` calls | **1**, unreachable | 4 |
| `bindSource()` | **7** | 25 |

The one `renderView` call sat in `persist-view.ts`, reached only when
`SavedView.content` was an OBJECT. Every `content:` in the repo is markup, so
nothing reached it. the data-layer plan (retired) had already said so out loud:
*"`DataSource` is that idea applied to records rather than to a view blob, and
the two should share the mechanism."*

So `render-view.ts` and `view-definition.ts` are gone, and with them `$state`,
`writes`, `RenderedView`, the `StateStore` alias and `ViewDefinition` itself.
What is left is one of each:

| | |
|---|---|
| a view's SHAPE | markup — `T-saved-markup-is-untrusted-input` |
| a view's STATE | `bindSource()` — attributes in, events out |
| a view's own API state | `applyState` — `T-state-is-the-saved-view-half` |
| what an app knows about itself | `SessionStore`, standalone. The real app uses it for theme mode and never needed a view around it |

`renderElement` stays: one node, one element, no registry. It is what
`applyState` and the examples use, and it never claimed to wire anything.

- Site: `src/core/browser/persist-view.ts`
- Site: `test/unit/headless-data-layer.test.mjs`

### T-saved-markup-is-untrusted-input

**A saved view's content is MARKUP, and it is PARSED, never assigned.**

The format question answered itself: every authored screen in this repo is
already an HTML template dropped into `sherpa-app-shell`
(`../Sherpa Demos/app/templates/*.html`, four of them, none calling `renderView`). A saved
view is the same thing a USER made instead of an author, so it is the same
format. One way to describe a view, not two.

**But the string does not come from this codebase.** It comes out of
`localStorage`, out of IndexedDB, or off a server — and a person can edit all
three. `innerHTML` on it runs whatever it contains. So
`core/view-markup.ts` parses it through an allow-list:

| | |
|---|---|
| any `sherpa-*` element | **allowed** — they are the vocabulary |
| layout and text tags | **allowed** — `div`, `span`, `section`, `ul`, headings, `strong`… |
| `data-*` | **allowed** — the public API of every component here |
| `class`, `id`, `slot`, `part`, ARIA | allowed |
| `<script>`, `<iframe>`, `<img>`, `<a>`, `<form>`, `<input>`, `<svg>` | **dropped, with the subtree** |
| `on*` | **dropped** — an inline handler is a script |
| `style` | **dropped** — it carries `url()`, and every visual here is a token or a `data-*` |

Three things make this hold, and each is easy to get wrong:

**1. `DOMParser`, not `innerHTML`.** The parsed document is INERT by
specification: no script runs, no image loads, no stylesheet fetches — even for
the nodes about to be dropped. Assigning first and cleaning after has already
lost.

**2. Elements are BUILT FRESH, never adopted.** `createElement(tag)` plus the
attributes that pass, so only the allow-list ever crosses into the live
document. Importing the parsed node would carry whatever the parser attached.

**3. `on*` is refused EXPLICITLY**, not by omission. `onclick` is absent from
the allow-list and would fail anyway — until someone widens a rule. This fails
on purpose, which survives that.

`setHTML` and the Sanitizer API would do some of this, but they are Chromium-only
today, and a view needs a far narrower vocabulary than a general sanitiser
targets. A small allow-list is an easier promise to keep.

**Drops are REPORTED, never silent** — `parseViewMarkup` returns them and
`onViewPicked` warns. A view that quietly lost half its content reads as a
rendering bug, and the reader has no way to know it was refused.
`checkViewMarkup` answers the same question WITHOUT building, for a host
deciding whether to accept a saved view at all.

**A `ViewDefinition` object is still accepted**, for the one thing markup cannot
express: the `$state` bindings and `writes` wiring in
`T-a-view-definition-is-data-the-render-is-not`. Markup describes a SHAPE; the
object describes a shape plus its reactive plumbing. Most views only need the
shape — the `capacity` preset's 40-line object became twelve lines of HTML.

The snapshot still addresses elements BY ID, through their own API, exactly as
before: markup carries real `id` attributes, and `onViewPicked` collects them
from the host after the swap.

- Site: `src/core/browser/view-markup.ts`
- Site: `src/core/browser/persist-view.ts`
- Site: `test/e2e/reforged-view-markup.spec.ts`
- Site: `src/app.ts`

### T-one-browser-database

**Sherpa keeps everything in ONE IndexedDB database** (plan 695 H3): `sherpa-ui`,
one version, its object stores made in one upgrade from one fixed schema
(`database.ts`). A page and its worker open the same one.

| object store | key | holds |
|---|---|---|
| `rows` | `[store, key]` | every `IdbStore`'s rows, under the store's name; one `seek` index |
| `seeds` | `store` | the seed version a store's rows were last seeded at |
| `sets` | `name` | a remote store's held set, kept between sessions (`keepCache`) |
| `outbox` | `[outbox, id]` | the writes that wait (`keepOutbox`) |
| `notices` | `id` | the notices a worker keeps until seen |
| `views` | `[page, id]` | the saved Views' durable tier (the page keeper's `database`) |

Before, each part opened its own database (`sherpa`, `sherpa-cache`,
`sherpa-outbox`, `sherpa-notices`, and an app's own), and two failed silently:

- **Two stores could not share a database** (bug 2): the upgrade made only the
  opener's object store, so a second `IdbStore` in the default `sherpa` threw
  `NotFoundError`. Now no store has its own object store to make.
- **A worker never re-seeded** (bug 3): the seed mark lived in `localStorage`,
  which a worker cannot read. Now it lives in `seeds`, beside the rows
  (`T-local-records-seed-themselves`).

**`navigator.storage.persist()` is the APP's to ask** (Will, 2026-11-04, 695
H3: B): `keepData()` asks it when the app chooses — after a sign-in, or at a
reader's pick — and Sherpa never asks on its own, because Firefox shows the
reader a prompt. Only a page can ask (`persist()` is the window's); the grant is
the origin's, so it covers what the worker keeps. A page already persisted is
not asked again (`persisted()` first).

**The old databases are not read, moved or deleted** (no stored-data shims,
CODE-REVIEW-PLAN D4): what they held stays on the device, unread.

A test that counts records must not `open()` the database before Sherpa has: an
open with no version makes it, with no object stores, and Sherpa's open at the
same version then upgrades nothing.

- Site: `src/core/browser/database.ts`
- Site: `src/core/browser/idb-store.ts`
- Site: `test/e2e/reforged-one-browser-database.spec.ts`

### T-idb-open-is-a-handshake-not-a-call

`indexedDB.open()` is a request, a version negotiation and possibly a schema
migration. Three consequences, all of which have bitten every codebase that has
used it:

**1. The connection is held as a PROMISE, not a database.** Twenty concurrent
loads on first paint would otherwise fire twenty `open()` calls and race twenty
upgrade transactions. One promise, shared by every part.

**2. Object stores and indexes are made ONLY inside `onupgradeneeded`.** So the
schema is fixed (`T-one-browser-database`): an `IdbStore`'s `indexes` need no
upgrade, as every store's indexed values share one `seek` index. A new object
store in the schema needs `VERSION` bumped.

**3. Another tab can ask for a higher version**, and is blocked until this one
lets go. `onversionchange` closes the connection and drops the cached promise,
so the next call re-opens at the new version. A tab that ignores this hangs the
other one indefinitely. A connection the browser closes (site data cleared) is
dropped the same way.

- Site: `src/core/browser/database.ts`

### T-idb-index-narrows-it-never-answers-it

**An index is a PRE-FILTER, never the answer.** `#readRows` uses one to read a
slice instead of the whole store; `applyOptions` then filters, sorts, searches
and pages exactly as it does for every other store. The index is the `rows`
store's one `seek` index (`T-one-browser-database`): each row lists
`[store, field, value]` for each indexed field, so a range is a run of it.

That is what makes an index safe to add or remove: it changes how much is read,
never what comes back. `reforged-idb-store.spec.ts` asserts this directly, by
running every filter shape against an indexed store and an unindexed one and
demanding identical rows.

`#rangeFor` therefore **refuses far more than it accepts**, because a wrong
range drops matching rows and a missing one only costs time:

| | narrows |
|---|---|
| `eq`, `gt`, `gte`, `lt`, `lte`, `between` on an indexed field | yes |
| an `and` group | by any ONE arm; the rest still run in `applyOptions` |
| an `or` group | **no** — a row matching the second arm may sit outside the first arm's range |
| `contains`, `startswith`, `endswith` | **no** — see below |
| an un-indexed field, a null value, a value IndexedDB rejects as a key | no |

`startswith` looks expressible as `IDBKeyRange.bound(v, v + '\uffff')` and is
not: it would need the store's collation to match `applyOptions`'s
case-insensitive comparison, and it does not. A "Gold" row would be missed by a
search for "gold".

- Site: `src/core/browser/idb-store.ts`

**A STRING takes no range at all.** Added 2026-09-22, after every menu chip in
the Records example returned 0 rows for a single pick while two picks worked.

`applyOptions` lower-cases both sides; an IndexedDB index is byte-exact. So
`IDBKeyRange.only('gold')` seeked past every row holding `'Gold'` — the index
ANSWERED the query instead of narrowing it, which is the one thing this trap
exists to forbid. Two values built an `in`, which takes no range, so it fell
back to a full scan and was right.

The same applies to `gt`/`lt`/`between` on a string, and to an array whose
members are strings. Numbers and dates still narrow.

The `startswith` comment already named the exact cause — "the store's collation
is case-SENSITIVE, applyOptions is not" — for one operator, while the rest of
the switch kept the same mistake.

- Site: `test/e2e/reforged-idb-store.spec.ts`

### T-idb-clear-is-not-a-reset

`clear()` deletes every row of THIS store; every other store's rows, and its
seed mark, stay. A store holds no object store of its own to reset.

Deleting the whole database is the only true reset, and it resets everything
Sherpa keeps (`T-one-browser-database`). This class deliberately does not offer
one — a method that destroys every other part's data is not a method worth having.

- Site: `src/core/browser/idb-store.ts`

### T-idb-bulk-is-one-transaction

2,000 rows through `insert()` is 2,000 transactions and 2,000 `change` events,
and a bound `DataSource` reloads on every one of them. `putAll` is one of each.

**Every `await` that is not a request of this transaction happens BEFORE the
transaction opens.** An IndexedDB transaction auto-commits the moment it stops
having work, and awaiting anything else — a schema's async `validate` — is
exactly that pause. So `putAll` checks every row first, then opens the
transaction and writes without awaiting anything but its own completion.

This is the seam a **sync down from a server** writes through. `replace: true`
clears first, for a full refresh where a row the server deleted must not survive
locally. `transact` settles once its transaction COMMITS, and every request is
made inside its work.

- Site: `src/core/browser/idb-store.ts`
- Site: `src/core/browser/database.ts`
- Site: `test/e2e/reforged-idb-store.spec.ts`

### T-local-first-then-onward

The reader's own Views live in THREE tiers, and each exists because the one
below it cannot do that job:

| tier | holds | why not the one below |
|---|---|---|
| Web Storage | the page's document | it is the only **synchronous** one |
| IndexedDB | every saved View, durably | it is the only one **without a ~5MB cap** |
| a server | the named parts that follow the reader | it is the only one **another device sees** |

`T-restore-before-first-load` requires the page to be readable BEFORE the first
load, or it queries twice and blinks. IndexedDB is async and can never satisfy
that. So the keeper reads Web Storage, and the database and a server sit BEHIND
it: `database: true` and `remote` are the app's, off by default.

**LOCAL WINS on a clash**, and the merge order in `restore()` is the reverse of
what looks natural — remote first, so local overwrites it:

```js
{ ...remote.views, ...fromDatabase, ...here.views }
```

A View the reader edited on this device and has not pushed yet must not be
replaced by the server's older copy. Reverse those spreads and the reader's work
vanishes. `restore()` keeps the merge here, so the page shows it, and pushes
nothing back.

**A FAILED PUSH IS NOT A FAILED SAVE.** The durable copy is written on each
named write at once; only the WIRE is debounced. A rejecting server is reported
through `onError` and never thrown, because the View is already saved and the
reader is not waiting on the network. Nor is it retried on a timer — a retry loop
against a rejecting server is a request storm nobody asked for, and the next
write carries the same snapshot anyway.

An absent tier is not an error. With no IndexedDB, no storage and no remote —
which is Node — every method still answers.

**A DELETE must reach IndexedDB too**, or the merge brings it back and the next
push publishes it (found 2026-10-14). A write knows which Views it removed, so it
deletes exactly those, in the same transaction as the rest; a push waits for it.
The database half is fetched only where an app asks for it.

- Site: `src/core/browser/page-state.ts`
- Site: `test/e2e/reforged-idb-store.spec.ts`
- Site: `test/unit/headless-data-layer.test.mjs`

### T-sync-pushes-a-snapshot-not-a-diff

`PageRemote.push` takes a page's WHOLE named parts — its Views and its saved
filters — not a change list.

A diff would need a merge on the server, a conflict policy, and a per-entry
version — three mechanisms to solve a problem that does not exist at this size.
A page's named parts are kilobytes, a reader edits them rarely, and the last
write winning is what a person expects from "my saved views".

The push is **debounced**, not batched: a burst of edits inside one interval is
ONE request carrying the final state, rather than one request per edit. Default
30 seconds — "fairly regularly", not "immediately", because nothing downstream
is waiting on it. A tab part never goes: it is not the reader's to share
(`T-only-a-named-part-crosses-tabs`).

`PageRemote` is an interface rather than a `RestStore` because a host's endpoint
is its own, and the two calls it needs are far narrower than a Store's five.

- Site: `src/core/browser/page-state.ts`

### T-session-store-is-the-third-tier

`SessionStore` is the THIRD TIER of the data layer. A STORE holds records, a DATA
SOURCE holds one query over them, and this holds everything else an app knows about
itself: which theme is on, which customer is selected, which panel is open, who is
signed in.

It was already written — as `StateStore` in `render-view.ts`
(`T-state-store-is-the-session-store`). Same class, addressable name, plus the one
capability an app actually needs from it.

ADDRESSED BY JSON POINTER (`/theme/mode`), not by a flat key, so a subscriber can
watch a BRANCH and hear about anything beneath it. That is what lets one value have
many readers without them knowing about each other.

```
const session = new SessionStore({ theme: { mode: 'light' } });
session.persist('/theme/mode');          // remembered across reloads
session.subscribe('/theme', (v) => …);   // hears /theme/mode too
session.set('/theme/mode', 'dark');
```

A `set` writes THROUGH to storage for the pointer or any ANCESTOR of it: setting
`/theme` must persist a `/theme/mode` that was registered, or a branch write would
silently lose what a leaf write keeps.

- Site: `src/core/browser/session.ts`

### T-session-persist-defaults-shared

`SessionStore.persist` defaults to `shared: true` — **localStorage**, across tabs —
and that is the OPPOSITE of a page's own state, which is the tab's
(`T-only-a-named-part-crosses-tabs`), deliberately.

A page's state is about one screen in one tab; a session preference is about the
PERSON, and a theme that re-picks itself in a second tab is a bug the reader has to
fix by hand every time.

It RESTORES IMMEDIATELY if a stored value exists, so the caller does not have to
read it back — a theme picked last week should already be on before anything
subscribes. It returns whether it restored, for a caller that wants to tell a
first-time visitor apart from a returning one.

A stored value outlives the code that wrote it, so a shape this version does not
understand is DROPPED rather than half-applied — and the unreadable key is
forgotten, so the next write starts clean.

That took a `guard`. Until it existed this paragraph was a claim the code did
not keep: `persist` caught a JSON PARSE error and nothing else, so a value that
parsed into the WRONG SHAPE was restored in full. A boolean survives that gap.
A list of `{view,label}` rows re-shaped between releases does not — it reaches
the nav rail as rows with no label. `guard` is optional. Without one, the
DEFAULT's type is the guard (TODO 191) — a boolean, a number, a string or a
list, or null, which is a real value — so ten hand-written
`(v) => typeof v === 'boolean'` guards went. A null or an object default, or
none, restores any parsed value, as before.

This exists because the alternative is what every app was writing: a key constant, a
try/catch to read, a try/catch to write, and a wrapper to keep the two in step. Four
pieces to get right per preference, and the examples were teaching it.

- Site: `src/core/browser/session.ts`
- Site: `test/unit/session-list.test.mjs`

### T-session-list-is-a-view-not-a-copy

`session.list(pointer)` returns a VIEW over the stored array, not a copy of it.
Nothing is cached: `all` reads the pointer every time and hands back a fresh
copy, and every write goes through `SessionStore.set`, so subscribers fire and
a persisted pointer reaches storage.

That matters because the obvious alternative — hold the array, mutate it, write
it back — silently loses whatever another writer did in between, and never
notifies anyone.

`all` returning a COPY is the other half. A caller that pushes onto it changes
nothing, which is what you want: the list is edited through `add` / `remove` /
`toggle` or not at all.

Three options carry the difference between a Favourites rail and a Recents one:

| | |
|---|---|
| `by` | the field that IDENTIFIES an entry, so a re-add replaces rather than doubles |
| `max` | keep at most N — the OLDEST end is trimmed, whichever end that is |
| `front` | newest FIRST (Recents). Default false — newest last |

Recents is `{ by: 'view', max: 5, front: true }`. Favourites is `{ by: 'view' }`.
Same class.

Without `by`, identity is deep equality by `JSON.stringify` — right for a stored
entry, which is plain JSON by definition, and wrong for anything holding a
function or a Date.

- Site: `src/core/browser/session.ts`
- Site: `test/unit/session-list.test.mjs`
- Test: `test/unit/session-list.test.mjs`

### T-capture-is-the-save-button

`captureView` reads the current state BACK into a definition — the other half of
applying one.

It is what a "Save this view" button calls, and what an AGENT calls to describe
what it is looking at: **a saved view is useless if only a developer can write
one.** That is the same parity argument as `T-grid-read-without-write-is-half-an-api`,
read from the other end.

```js
const view = captureView({ source, elements: { grid, chart } });
captureView({ elements: { grid } }, { grid: ['columnClause', 'selectedKeys'] })
```

Omitting the per-element `reads` map reads NOTHING from that element — see
`T-capture-reads-only-what-is-named`.

- Site: `src/core/browser/persist-view.ts`

### T-on-view-picked-replaces-hand-wiring

`onViewPicked` is the listener BOTH example pages had written by hand, in one
place:

```js
const off = onViewPicked(header, VIEWS, { source, elements: { grid } });
```

It returns an unsubscribe, like `bindSource()` and `keepUi`, so a view that leaves
the DOM stops listening: a caller should not have to remember which of our
functions hand back a teardown and which do not (`T-signal-not-a-teardown-list`).

Two callbacks split the work: `onIncomplete` REPLACES the default warn
(`T-apply-degrades-never-throws`), and `after` does the page-specific half.

- Site: `src/core/browser/persist-view.ts`

### T-a-persistent-chip-reports-on-every-change

Picking a Region re-applied the whole current view, a microtask later.

`sherpa-quick-filter-toolbar` reports the bar's WHOLE state on every change:
one `quick-filter-change` carrying `values` for every chip that has a value.
The View chip is `persistent` — a reader is always in some view — so
`values.view` is present on every one of those events, whatever the reader
actually touched.

`onViewPicked` read `values.view` and applied that view. Every time. So
choosing a Region made it re-apply the view already on screen, and
the snapshot it applied restored its filter as the WHOLE query — which
cleared the named `contribute` parts and threw away the region the reader had
just set. Three symptoms, one cause:

| what was seen | why |
|---|---|
| the header's filters did nothing | the filter was set, then wiped |
| the grid's own column chips never lit | the grid was re-populated from a snapshot that had no column filters |
| the selection column came unpinned | a full re-render, and the pin is re-applied per render |

It now remembers which view is applied and returns early when the id has not
changed. That needs a starting value, because the FIRST header change of a
session would otherwise re-apply the view the page is already showing — so
`onViewPicked` takes `applied`, the same id the caller passes to `viewOptions`
to mark the selected chip.

**The general shape:** a bar reports its whole state, so a handler reading one
chip out of it cannot tell whether that chip is what moved. Either compare
against what you last acted on, or read `picked` — which names only what
changed — rather than `values`.

- Site: `src/core/browser/persist-view.ts`
- Site: `src/components/sherpa-provider/provider-page.ts`

### T-a-worker-keeps-the-apps-files

**A Service Worker keeps the app's own files, so it opens offline and installs**
(plan 652 S3). `keepAppFiles(self, { version, files, strategy, skip })`, from
`sherpa-ui/worker`: the `files` are kept when it installs, and every other file
of the app's own origin as the page asks for it. A new `version` is a new cache;
the old ones go when it takes over.

**FRESH by default: the network first.** An app in development rebuilds all day,
and a cache-first worker would serve the last build until a second reload — the
page Will has open on :4200 would run old code. Fresh, the network answers
whenever it can, and the cache only when it cannot (after `timeout`, 4 s). `fast`
is the cache first, the network behind it: a page opens at once and a new build
shows next time — an app's choice once it has update notices (S6).

**Never kept:** a request that is not a `GET` (a `QUERY` to the data layer), the
data layer's own path (`/sherpa/data/`), a live feed (`text/event-stream`, and
Demos' `/live/`), and another origin's files. A page's query string only names a
Context, so a page asked for offline is matched by its path too.

**Playwright's offline mode lies in WebKit.** `context.setOffline(true)` failed
every WebKit request — even a file the worker held — before the worker heard it.
Measured 2026-11-02: with the server truly stopped instead, WebKit, Firefox and
Chromium each opened a NEW Records page from the worker, all 100 rows. Test
offline by stopping a server of your own, never by `setOffline` alone.

- Site: `src/core/worker/app-files.ts`
- Site: `src/worker.ts`

### T-the-worker-answers-the-data

**The data layer's own requests are answered in the Service Worker** (plan 652
S4): one copy of each store for every tab, and offline. The app's worker script
imports the app's one stores module (`defineStores`, `T-a-request-picks-its-stores`)
and hands it to `serveData(self, { stores, ready })`, which reads each remote store
through its own `HeldStore`; a worker cannot `import()` at runtime — refused in all three engines, measured
2026-11-02 — so a JSON file cannot name a store's code (D7, Will: A). Each
request waits for `ready`, a first seed written.

**The page asks the worker only where it can answer.** `openWorkerStore({ name,
fallback })` reads by `fetch`, through the worker, while one controls the page,
and asks for the store's facts first: a worker older than the page — S3's, which
kept files and answered no data — fails that ask, is reported
(`worker-store-fallback`), and the page's own handler answers. So does a first
visit, which no worker controls yet, and a private window that refuses one.

**A store module the worker imports names the data entry by its URL**
(`/dist/bundle/data.js`): a worker has no import map. In the page it is the URL
the map gives `sherpa-ui/data`, so the very same module, not a copy.

**Two copies of a store over one database agree on rows, not on news.** A page
that holds its own copy of an `IdbStore` sees every row, as IndexedDB is read fresh
on every load, but hears a write only from its own copy. So a page reads a store the
worker answers through `openWorkerStore`, Demos' Dashboard too, and hears every
tab's change (S6).

- Site: `src/core/worker/serve-data.ts`
- Site: `src/core/browser/worker-store.ts`
- Site: `src/worker.ts`
- Site: `test/unit/the-worker-answers-the-data.test.mjs`

### T-a-new-build-is-a-new-worker

**An open page hears a new build only when a NEW worker takes it over** (Will, plan
652). Its banner and Notifications item come from `controllerchange` — never the
first, which is no news. But the browser looks for a new worker only when a page
loads, or about once a day, and only finds one when the worker SCRIPT's bytes
changed: a build that changes the app's files alone changes nothing there.

So two halves. **The page asks** — the server's feed says a new build and the tab
that follows it asks at once (`T-news-is-pushed-by-the-server`); where no feed
answers, `watchForUpdates()`: `registration.update()` every few minutes (default 5),
when the tab is shown again, and back online. **The
app's server stamps the worker script with each build**, so a new build is new
bytes: `serveWorkerScript()` (`sherpa-ui/server`, plan 695 H5) serves `/sw.js` with
`// build <newest file time>` on its first line, and says each new build on the feed.
The new worker skips waiting and claims its pages (`keepAppFiles`, fresh), so the
open page hears it at once, with no reload. Measured 2026-11-02 in all three
engines: a deploy, the tab shown again, and the banner and the item show.

**A test's deploy reaches its own browser alone:** each Demos browser registers
`/sw.js?client=<its id>`, and `POST /debug/build?client=<id>` stamps that one. A
server-wide stamp replaced every parallel test's worker mid-test, and lost its
held set. Not a cookie: Chromium sends none with a worker script's request
(measured).

- Site: `src/core/browser/updates.ts`
- Site: `src/core/server/worker-script.ts`

### T-a-node-host-is-the-same-handler

**A Node server hosts the data with the handler the page and the worker answer with**
(plan 695 H5): `sherpa-ui/server`'s `nodeHandler(handlers)` turns a `node:http` request
into a web `Request` and writes the `Response` back, streamed, so the feed's event stream
stays open. It is a `node:http` listener and an Express-style middleware at once: each
handler is asked in turn; where none answers, `next()`, else 404. One protocol, three
hosts — never a second.

Three things that are not obvious:

- **Express rewrites `url`** under a mount path; the request's URL is made from
  `originalUrl`, on the request's `Host` (or `origin`, behind a proxy that ends TLS).
- **A body is read only as a handler reads it**, so a request none answers goes on to the
  next middleware whole: read first, a parser after it — Demos' `/debug/updates` — finds
  nothing left. One a parser read first is gone from the stream: its parsed value is
  sent on, as JSON.
- **A reader that goes away aborts its request's signal**, and cancels the stream it
  was being sent, on the response's `close`: the feed drops a follower that left.

The server's half of what is new is here too: `serveWorkerScript()` stamps the worker
script with the build and says each new build on the feed (`T-a-new-build-is-a-new-worker`),
and `updatesFeed().answer` is a handler, at `UPDATES_PATH`. The entry is DOM-free, held by
the same lint as the data layer, and `the-server-entry-is-packed` installs it from its
tarball and serves a store.

- Site: `src/server.ts`
- Site: `src/core/server/node-host.ts`
- Site: `test/unit/a-node-host-is-the-same-handler.test.mjs`
- Site: `test/unit/the-server-entry-is-packed.test.mjs`
- Site: `test/e2e/reforged-a-server-answers-another-origin.spec.ts`

### T-a-view-change-resets-the-header-chips

**Picking a View resets the header chips the view does not set.** Will,
2026-09-24: *"App header filters shouldn't carry over between preset or custom
views unless already set in the initial view definition."* Measured
2026-09-26: Region = EMEA (27 rows), then My accounts — the Region chip stayed
lit, but `setState` had already dropped its `global` part: 12 rows, all of
Ravi's. A chip that says it filters and does not.

`onViewPicked` resets the bar that reported the pick — `clearAll()` — BEFORE
the snapshot applies, so a view that states a chip (the Dashboard's EMEA
operations sets Region) still sets it. The View chip is persistent and keeps
its pick (`T-persistent-chip-is-a-selector`). A synthetic event from a host
that is no bar has nothing to reset.

Which chips may SURVIVE a view change is a per-chip flag still to build —
TODO 21b. This is its default.

- Site: `src/core/browser/persist-view.ts`

### T-a-views-markup-lives-in-a-template

**A view is JSON; its markup is an HTML template, in a file beside it.**
TODO 185, Will: *"'\*-views.json' files should not contain any HTML template
literals. They should point to an HTML file, in the same folder, that contains
the template. Target the template via ID."*

A view that has content of its own names it: `"template": "file.html#id"`.
`loadViewLibrary(url)` reads the JSON and fills each such view's `content`
from that file's `<template id>`, fetched once through the Templater
(`loadTemplates`). The markup is still parsed through the allow-list when the
view is drawn (`T-saved-markup-is-untrusted-input`). A template the file does
not hold is reported (`unknown-template`), and that view draws the page's own
content rather than nothing.

It is a BROWSER function — it parses HTML — so it ships from `sherpa-ui`, not
`sherpa-ui/data`.

- Site: `src/core/browser/view-files.ts`
- Site: `src/core/browser/persist-view.ts`
- Site: `test/e2e/reforged-view-files.spec.ts`

### T-local-records-seed-themselves

**`localRecords(options)` is the local store an app starts with** (TODO 191):
IndexedDB where the browser has it, memory where not — a private window,
blocked site data — and seeded on a first run and again when `seedVersion`
moves. It hands back `{ store, ready }`; await `ready` before a component
draws, or a grid that populates before the seed lands shows an empty table.

A re-seed overwrites the seed's rows, and a row a person added stays. The seed
version is kept in the database beside the rows (`seeds`, by the store's name),
where a worker reads it too: kept in `localStorage`, it was unreadable in a
worker, which never re-seeded (bug 3, plan 695 H3).

**The rows and their mark are ONE transaction, which reads the mark first.** A
page and its worker start together on a first run; IndexedDB runs their two
transactions one after the other, so the second finds the mark and writes
nothing. The rows are checked BEFORE it opens (`T-idb-bulk-is-one-transaction`),
on every load — measured 0.3 ms for 100 rows, 6 ms for 10,000 — so the page,
which starts first, seeds first: a readonly look before them let a worker win
the race in Demos, and its held set, having heard the seed, read again behind
the kept copy (`T-a-kept-set-is-checked-each-session`). A seed that cannot be written reports
`seed-failed` and the store starts as it is.

Sherpa Demos chose the store, kept the version and seeded by hand in
`records-data.js`; its `reforged-records-persist.spec.ts` now drives this.

- Site: `src/core/browser/idb-store.ts`
- Site: `test/unit/local-records.test.mjs`
