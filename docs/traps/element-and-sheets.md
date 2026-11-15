# Traps — SherpaElement and the shared sheets

One of the eleven areas of [the traps](../TRAPS.md): each entry is here because its
first `Site:` is in this area (`npm run check:traps` holds it so). 83 entries.

### T-tokens-css-never-reaches-shadow

A bare `[data-status]` rule in `tokens.css` is loaded into the **document**. It
reaches a light-DOM element and **never** one inside a shadow root. The
Style names it re-points inherit across the boundary; the SELECTOR that sets
them does not.

So the projector writes the same pins a second time, into
`src/core/sherpa-style-modes.css`, which every shadow root adopts: each
`[data-status]` block and each `[data-look][data-status]` compound. A pin now
works at any depth, as a mode pin does in Figma, and the favourite star's
hand-copied active colours were deleted.

A bare `[data-look]` is **left out** of that sheet. It sets the look's DEFAULT
mode, so inside a status parent it would reset the status passed down. In the
page, `tokens.css` still does exactly that — a known gap, not a model.

- Site: `src/core/sherpa-style-modes.css`
- Site: `scripts/project-tokens.mjs`
- Site: `test/e2e/reforged-style-modes.spec.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-app-header.spec.ts`

### T-a-host-state-pin-lives-where-the-host-is

A host STATE pin is ONE line in the host's own sheet:
`:host(sherpa-button[disabled]) { --_mode: inactive; }`. The mode's ONE block in
`sherpa-style-modes.css`, `@container style(--_mode: inactive) { :host > * { … } }`,
re-maps the Style names of what the host holds. Measured 2026-11-04 (695 P7),
in Chromium, Firefox and WebKit:

- **A style query never reaches the element that sets the property.** Its
  container is the element's parent, so a host's own Style names are not its
  pin's. A pinned host paints on a part: `.root` (node), a `.sherpa-surface`
  behind its content (metric, nav-item), or the part that reads the value
  (`.bar`, `.field`, `.track`, `.form`, `.card`, `.slider-row`). For the same
  reason a PART's pin and a bare `&` stay whole blocks that re-point the element
  itself. A part that is a component also names its mode, so its own pins lose
  to it, as before.
- **Only a root's top-level children are matched, `:host > *`.** Only a host
  sets `--_mode`. With `*`, 26 blocks were tested on every element of every root:
  style recalc doubled (harness toggle 1,167 → 2,006 ms, Demos sort 1,860 →
  3,662 ms, Chromium at 4x). At (0,1,0) the blocks come first in the sheet, so a
  child's own `[data-status]` or class pin still wins.
- **`--_mode` is registered and not inherited** (in `tokens.css`): a block
  re-maps the pinned element's children once, and they pass it down. Inherited,
  it matched every descendant again, and undid a part's own pin below it.
- **Across a shadow boundary the outer rule wins**, so a host's own
  `data-status` beat every `:host()` rule on the host (P1 measured 162 of 993
  readings change). A query sidesteps it: the status re-points the host, the
  pin re-maps inside. But the old order was specificity: a look with a status
  (0,2,0) beat a state of one attribute (0,1,1), and lost to one of two. One
  shared guard, `:host(:is(looks):is(statuses)) { --_mode: initial; }` at
  (0,3,0), sits between `:host(tag[a])` (0,2,1) and `:host(tag[a][b])` (0,3,1).
- **The old cascade worked per property.** A look's mode has no data-viz names,
  so a lower plain pin supplied them. A plain pin also sets `--_mode-viz`, whose
  blocks re-map only those.
- **WebKit 26 re-matches a style query after a change only for a property that
  a sheet of the container's own tree queries.** A state set after first paint
  never reached the parts of a host in the page. `tokens.css` carries a query
  that matches nothing and names `--_mode` and `--_mode-viz`; every Sherpa root
  adopts the mode blocks, and a non-Sherpa shadow root must adopt
  `sherpa-style-modes.css` itself.
- **The minifier wrote `--_mode: transparent` as `#0000`**, a colour, so the
  query never matched. A look's key always says its mode: `transparent-default`.
- What every root derives on its `:host` (the hover fill, the scroll shadow's
  ink) each mode block derives again, from the mode's own tokens.

- Site: `src/core/sherpa-style-modes.css`
- Site: `scripts/project-tokens.mjs`
- Site: `src/core/sherpa-base.css`
- Site: `src/core/sherpa-container-regions.css`
- Site: `src/components/sherpa-input-text/sherpa-input-text.css`
- Site: `src/components/sherpa-nav-item/sherpa-nav-item.css`
- Site: `src/components/sherpa-node/sherpa-node.css`
- Site: `src/components/sherpa-node-frame/sherpa-node-frame.css`
- Site: `src/components/sherpa-progress-bar/sherpa-progress-bar.css`
- Site: `src/components/sherpa-prompt-composer/sherpa-prompt-composer.css`
- Site: `src/components/sherpa-select-card/sherpa-select-card.css`
- Site: `src/components/sherpa-slider/sherpa-slider.css`
- Site: `src/components/sherpa-switch/sherpa-switch.css`
- Site: `test/e2e/reforged-metric.spec.ts`
- Site: `test/e2e/reforged-nav-item.spec.ts`

### T-a-button-commands-by-markup

**A page opens a dialog with no script**: `<sherpa-button commandfor="edit"
command="--show">` — the platform's invoker commands, in Chrome, Firefox and
Safari since 2025. Measured in all three engines (2026-10-14).

- **An id cannot cross a shadow root.** `sherpa-button`'s real `<button>` is
  in its shadow tree, so `commandfor="edit"` there finds nothing in the page.
  The button carries the ELEMENT instead — `commandForElement`, which may point
  out into the page — set in the click, before the button acts, so a target
  parsed after the button is still found.
- **A custom element answers only a custom command** — one starting `--`. The
  built-in ones (`show-modal`, `close`) act on a native `<dialog>` alone.
- **`static commands` is the generic door** in `SherpaElement`: `--name` → the
  method it calls. `sherpa-dialog` and `sherpa-overlay-panel` declare `--show`
  and `--hide`. The base listens on the host, once, only when a component
  declares any.
- The spec lists them: `$extensions.sherpa.commands` (name → method) and an
  `invoker-commands` capability, read from `static commands` by its parser.
  The MCP's `get_component` shows them.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `scripts/lib/ts-facts.mjs`
- Site: `src/components/sherpa-button/sherpa-button.ts`
- Site: `test/e2e/reforged-a-button-commands-by-markup.spec.ts`

### T-temporal-is-the-date-model

**Sherpa's date and time model is `Temporal`** (Will, 2026-10-14). A day is a
`PlainDate`, a month a `PlainYearMonth`, never a `Date`.

**But every iOS browser is WebKit inside** — Chrome and Firefox too — and
WebKit has no `Temporal` yet, so neither does any iPhone browser. Safari is not
a target, but mobile browsers are (Will, TODO 255). So dates go through ONE
module, `src/core/ui/temporal.ts`: `Temporal` where the engine has it, and a
small stand-in over `Date` and `Intl` where it has not — never a third-party
polyfill.

- **The stand-in is only the part Sherpa uses** (`PlainDateLike`,
  `PlainYearMonthLike`). A new date call is added to BOTH, and the parity test
  draws the calendar with `Temporal` and again without it.
- **It answers as `Temporal` does:** ISO text that is not a real day throws;
  fields clamp the day to its month; a day is computed in UTC, so no time zone
  moves it.
- **It asks at each call**, not at load, so a test can take `Temporal` away.
- **Our WebKit tests did not catch this.** Playwright's WebKit build is newer
  than Safari and has `Temporal`, so a green WebKit run says nothing about an
  iPhone.
- The DOM-free data layer stays off `Temporal` until Node has it
  (`docs/QUERY-DESIGN.md`).

- Site: `src/core/ui/temporal.ts`
- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`
- Site: `test/unit/a-day-without-temporal.test.mjs`
- Site: `test/e2e/reforged-a-calendar-without-temporal.spec.ts`

### T-number-coercion

Parsing a numeric attribute by hand went wrong four ways:

| expression | result | what broke |
|---|---|---|
| `Number('')` | `0`, not `NaN` | `data-min=""` pinned a chart's y-floor to 0; `data-ticks=""` silently meant "no axis" |
| `Number('' ?? 100)` | `0` | `??` catches `undefined`, never `''` |
| `parseInt('0') \|\| 1` | `1` | `\|\|` folds `0`, `''` and garbage together |
| `Number(null)` | `0` | an absent attribute read as index 0, acting on the FIRST row |

`coerceNum` treats anything that is not a finite number — absent, empty,
whitespace, unparseable — as ABSENT. A real `0` survives.

Do not "simplify" it back to `Number(x) || fallback`.

- Site: `src/core/ui/sherpa-element.ts`

### T-a-template-binds-by-markup

**One binding language, written in the template.** It replaced three: a prop's
`to:` selector, the item directives and `data-swap-*` (plan 695 P6). A directive
names a SOURCE. In the stamped tree that is a host attribute, and it is written
again whenever that attribute changes. In an item prototype (`renderItems`,
`cloneItem`) it is the item's field, written once, and the directive is dropped.

| directive | writes |
|---|---|
| `data-text="src"` | the element's text |
| `data-attr-NAME="src"` | its attribute NAME. On a plain element `data-attr-data-icon` draws the glyph (`writeIcon`); on a component it is the attribute |
| `data-when-NAME="cond: value"` | NAME, while `cond` holds: `src` (present, and not `false`) or `src=value`. With no `: value`, a bare attribute. `text` is the element's text |
| `data-index="NAME"` | an item's position (items only) |

```html
<h3 class="title" part="title" data-text="data-heading"></h3>
<sherpa-button aria-label="Collapse" aria-expanded="true"
               data-when-aria-label="data-collapsed: Expand"
               data-when-aria-expanded="data-collapsed: false"></sherpa-button>
```

While the source is absent, or the condition fails, the template's own value
comes back (`T-the-templates-text-is-the-default`). There is no "remove": ARIA's
`false` token says it. Only text, `title`, `value`, ARIA and `data-*` are
written — never a script's text, a style or a URL, nor another directive. A
`data-icon` that is not a directive is a static glyph, drawn by the icon
upgrade.

`directives.ts` reads a stamp's directives in `#stamp`, before anything writes,
and `attributeChangedCallback` applies those that follow the changed attribute
before `onChange`. A re-stamp reads them again. The followed attribute must be
one the component observes, or it is never written again: `check:props` holds
that. The TS must never also write a bound attribute: one owner. A consumer's
`useTemplate()` markup must keep each directive (`checkOwnTemplate` reports one
it lacks). The spec reads a prop's default where its `data-text` or `data-attr-*`
is (`boundTo`).

- Site: `src/core/ui/directives.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/core/ui/templater.ts`
- Site: `scripts/check-props.mjs`
- Site: `scripts/check-usage.mjs`
- Site: `scripts/lib/html-structure.mjs`
- Site: `scripts/generate-component-spec.mjs`
- Site: `test/e2e/reforged-a-template-binds-by-markup.spec.ts`
- Site: `test/e2e/reforged-a-state-follows-its-host-attribute.spec.ts`

### T-a-native-wears-the-button-class

A form's submit is a native `<button type="submit">`: `sherpa-button` submits no
form. Will, TODO 331: it must still look like the Button and follow status and
look pins. So the Button's look is ONE sheet, `sherpa-button-look.css`, on one
class, `.sherpa-button`, worn by the Button's own control AND by any native
button. It is in `sharedStyles`, so a SherpaElement shadow root has it, and the
build copies it to `sherpa-ui/css/button` for a page (layered, and naming the
layer order, so a page's own rules win and the link order does not matter).

- **The face sets no `display`, `margin` or `vertical-align`.** A rule in the
  tree beats a slot owner's `::slotted()` (`T-a-tree-rule-beats-slotted`), so a
  slotted native would never fold or lap. The Button's control keeps those in
  `sherpa-button.css`.
- **A native takes the Button's names:** `data-size`, `data-look`,
  `data-type="icon"`, `data-status`, `aria-pressed`, and `:disabled` — so a
  disabled fieldset counts. Its sizes are projected onto the class too.
- **Its pins are shared blocks that re-point the native itself** — a class key
  in `state-pins.yaml`; a style query cannot reach the element that sets it
  (`T-a-host-state-pin-lives-where-the-host-is`). A key joins the last block of
  its mode unless a later block holds a pin of the same class, which it must
  still beat by order.
- **The Button's own control is left out** (`:not([part~="trigger"])`): it
  takes its host's look, size and state, which the host's pins re-point.
- The spec generator reads the look for a node that wears it, renamed to the
  node's own class, so the Button's spec keeps its bindings.
- A non-Sherpa shadow root adopts neither sheet: it adopts this one and
  `sherpa-style-modes.css` itself.

- Site: `src/core/sherpa-button-look.css`
- Site: `src/components/sherpa-button/sherpa-button.css`
- Site: `scripts/project-tokens.mjs`
- Site: `scripts/generate-component-spec.mjs`
- Site: `scripts/build-reforged.mjs`
- Site: `scripts/lint-css.mjs`
- Site: `scripts/check-usage.mjs`
- Site: `test/e2e/reforged-native-button.spec.ts`

### T-an-svg-with-a-focus-listener-is-a-tab-stop

In Chromium, an SVG element that has a `focusin` (or focus) listener becomes
keyboard focusable, with no `tabindex`. `rovingFocus()` listens for `focusin`
on its container, and the radial chart's container is an SVG `<g>`: Tab from
the page landed on the GROUP, not its first slice, and no ring drew. Firefox
and WebKit do not do it, so only Chromium failed. An HTML container (the bar
and line charts' `.plot`) is not touched by this.

So an SVG container gets `tabindex="-1"`: focusable by script, out of the Tab
order, and its items keep their own `0` / `-1`.

- Site: `src/core/ui/roving-focus.ts`

### T-base-class-does-four-things

`SherpaElement` does FOUR things and nothing more:

1. Fetch the component's HTML template (cached once per class) and its CSS.
2. Adopt stylesheets into the shadow root (shared, deduped).
3. Run a guarded lifecycle: `onRender` → `onConnect`, plus `onChange` /
   `onDisconnect`.
4. Expose `populate()` → `renderData()` as the single data path.

Everything a component can be SEEN DOING lives in its CSS, selected off `data-*`
attributes. JS is the last resort — this class exists so a component author
never has to write plumbing, only behaviour.

The contract for a subclass:

```ts
static css      = new URL('./sherpa-foo.css',  import.meta.url);
static html     = new URL('./sherpa-foo.html', import.meta.url);
static props    = { 'data-heading': { type: 'string', kind: 'content' } };  // the .html writes it: data-text="data-heading"
static observed = ['disabled'];             // native attrs + own-handling ones
onRender()                 // shadow ready — cache refs, wire host listeners (once)
onChange(name, old, val)   // an observed attribute changed (after first render)
onConnect()                // once, after the first render completes
onDisconnect()             // teardown — timers, observers
renderData(data)           // populate() payload
```

- Site: `src/core/ui/sherpa-element.ts`

### T-cloning-prototypes-have-no-id

`parseTemplates` maps `<template id="...">` → innerHTML, and returns `null`
when there are NO id'd templates (a single flat template), so the caller can
fall back to the raw markup.

Cloning prototypes are `<template class="...">` with **NO `id`**, and are
deliberately ignored here — they belong to the component's own body, not to its
variant set. An `id` on a row prototype would make SherpaElement's
multi-template parser pick it up as a whole tree to stamp, so the component
would render one row and nothing else.

- Site: `src/core/ui/templater.ts`

### T-coerce-and-clamp-are-shared

`coerceNum` and `clampNum` are EXPORTED, so the data layer parses a record
field by exactly the same rule a component parses an attribute — the
`format-tick.ts` precedent: one shared function so two callers cannot read the
same value two different ways.

Six components had written their own `#clamp`, and they were NOT the same
function. Each wrapped a real `Math.min(max, Math.max(min, …))` in its own
extras: progress-bar parses a string first, pagination truncates, data-grid
rounds and falls back to a default width. Merging them would have been wrong;
sharing the BOUNDS is not.

ABSENT means null, undefined, empty, whitespace-only or unparseable. A real 0
is a value, not an absence. The clamp runs only on a value that PARSED — a
fallback is returned as given, so a caller's chosen default is never silently
moved by its own bounds. See `T-number-coercion` for the four ways a hand-
written parse went wrong.

- Site: `src/core/ui/sherpa-element.ts`

### T-mark-match-is-one-shape

`markMatch` rebuilds an element as before + `<mark class="match">` + after,
around ONE hit — one shape for a search highlight. The data grid and nav-item
wrote the same five lines, and the grid's comment admitted it had copied
nav-item's.

TEXT NODES, never `innerHTML`: a `<mark>` is CONTENT, and a label containing
`<` would otherwise parse as markup.

THE MARK TAKES THE HAYSTACK'S CASING, so "ana" against "Ana" leaves "Ana"
itself — which is why it slices the haystack rather than writing the needle
back.

It returns the `<mark>`: nav-item wraps it in a `Range` for the Custom
Highlight layer, and a caller that only wants it drawn ignores the return.

- Site: `src/core/ui/mark-text.ts`

### T-declared-only-means-css-owns-it

`PropKind` is the same split the generated `<name>.component.json` uses, so
the code and the contract agree:

| kind | meaning |
|---|---|
| `content` | written into the shadow DOM — by its template's directive, or the component's JS |
| `style` | CSS selects on it; JS never reads it. DECLARED ONLY |
| `visibility` | presence toggles a CSS rule. Declared only, like style |
| `behaviour` | only the component's own JS reads it |
| `template` | it picks the template; `variantAttrs` re-stamps on a change |

`style` and `visibility` exist so the attribute is TYPED — a JS→CSS write path
(`this.set()`), and a place to hang non-CSS use later — **without** tempting
anyone to add a JS branch for something CSS already handles correctly. Declaring
`data-status` is not licence to add a JS status branch. Which props are OBSERVED
is `T-observe-what-does-work`.

- Site: `src/core/ui/sherpa-element.ts`

### T-observe-what-does-work

**The base class observes only what it does work for** (plan 695 P6): a
`content` prop (its directive or the component's JS writes it), a `template`
prop and `variantAttrs` (a re-stamp), every declared boolean (`"false"` is off,
`T-false-is-off`), the props a chart asks by (`SUMMARY_PROPS`, `STACK_PROPS`,
`data-source`, `data-scope`: a change re-asks) and the label pair. A component
lists the rest its own JS reacts to in `static observed`. A `style`, `visibility`
or `behaviour` prop it does not list is CSS's, or read when it is needed, and its
change runs no callback.

Measured 2026-11-04 over 68 classes: 574 observed attributes before, 523 after.
The 186 declared booleans stay observed for `"false"`. A prop a directive
follows must be observed, or it is never written again: `check:props` holds
that. The spec's `observed` is the same rule (`baseObserves`); the vendored
`compile-def.mjs` keeps a copy of the asked props, and `observed-rule.test.mjs`
holds the class, the spec and the copy together.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `scripts/lib/ts-facts.mjs`
- Site: `scripts/lib/generation/compile-def.mjs`
- Site: `scripts/check-props.mjs`
- Site: `test/unit/observed-rule.test.mjs`

### T-icon-box-is-not-the-glyph

**An icon's BOX and its DRAWING are two sizes, not one.** A Figma icon is a
`content/size/*` square holding art that differs per icon: `filter` (17:4701) is
10.5 x 9.625 inside its 14 frame, `triangle-down` is 7 x 4.375, and only 20 of
the 214 fill all 14. The square is the layout contract and never moves; the art
inside it varies.

**Will's rule, RESTATED 2026-09-24 — the art renders at the size it was
DRAWN.** In Figma each icon sits in a square frame with no fill or border, a
pure bounding box; the glyph is drawn to design inside it and scales with it.
So the frame IS the viewBox, and a glyph drawn at half the frame renders at
half. `.sherpa-icon-box` in `src/core/sherpa-icon.css` owns the square
(`--_icon-size`, `flex-shrink: 0`, inherited colour);
`preserveAspectRatio="xMidYMid meet"` keeps the art 1:1 and inside.

**The rule this replaces said the longest axis was 100% of the square**, and
the renderer implemented it by setting the viewBox to the art's own INK bbox.
That re-fit every drawing and threw the design away: measured across all 214,
only 19 are drawn at 100%, so 195 were inflated — `filter` by 1.33x, and
`triangle-down` from 7 units wide to 14, twice its Figma size. It was reported
as "the caret glyph is too big in its container", which is exactly what it was.

**Three approaches failed before that one, each measured:**

`font-size` cannot do it. Font Awesome at `font-size == box` paints about
**101%** of the box — `fa-house` overflowed a 14px box at 15.75px wide — and
each glyph needs a DIFFERENT size to reach 100%: filter 14.00px, house 12.28px,
caret-down 21.88px. A flat ratio is wrong for every icon but one.

`minmax()` cannot do it. It is a Grid track function; `CSS.supports('width',
'minmax(0, 100%)')` is **false**. It is not valid in `width` or `font-size`.

`getBBox()` on SVG `<text>` cannot do it. It returns the font's line metrics,
not the glyph's ink, so fitting to it gave 59–100% while looking correct in a
screenshot. The ink has to be measured off the path.

It is invisible in the numbers a reviewer checks. Chip height, icon width and
icon height were all exactly right; only the art inside was wrong.

**The icons are Figma's**, exported to `src/icons/` and compiled by
`scripts/generate-icons.mjs` (`npm run icons`) into one sprite,
`src/core/ui/icons.svg`, a `<symbol>` each whose viewBox is its frame
(`T-an-icon-loads-when-first-drawn`).

**A drawing cannot be chosen by a CSS `content:` the way a webfont glyph was.**
Toast, callout and the quick-filter caret picked their icon in CSS off
`[data-status]`. All members are now stamped and CSS reveals ONE, so the choice
stays CSS-owned and no JS branches on the status.

**Never rewrite an icon element's `className`: it erases the box class.** It
failed once as a 16px icon in a 14px box, with the CSS looking correct. The
template carries the classes; nothing in TS writes them (TODO 344).

**An unknown name draws NOTHING, deliberately** — an empty wrapper is visible to
a test, where `T-fa-pro-icons-fail-silently` was not. That is why the tests
measure the PATH: the wrapper is its full size either way.

- Site: `src/core/sherpa-icon.css`
- Site: `src/core/ui/render-icon.ts`
- Site: `test/e2e/reforged-num-coercion.spec.ts`
- Site: `src/core/ui/render-icon.ts`
- Site: `src/core/sherpa-icon.css`
- Site: `test/e2e/reforged-icon-sizes.spec.ts`

### T-icon-value-takes-two-forms

An icon attribute's value has always been allowed to be EITHER a Font Awesome
class list (`"fa-solid fa-tag"`) or a single raw glyph character (`"+"`), so
a glyph directive (`data-attr-data-icon` on a plain element) accepts both.

Without it an FA class list is printed as LITERAL TEXT — which is exactly what
chip, tag, list-item and container-header used to do. The failure is silent:
the words "fa-solid fa-tag" appear where the glyph should be.

FA draws from a `::before` on a class, so an FA value has to become CLASSES
while a raw character becomes TEXT. `writeIcon` is the one policy; there were
three.

- Site: `src/core/ui/sherpa-element.ts`

### T-the-base-class-names-nothing-visual

**A name on `SherpaElement` is read by all 58 components, so it must not imply
one of them.**

`renderRows()` and `cloneRow()` were the counter-example. Twelve components
stamp items from a prototype:

| | what it stamps |
|---|---|
| `sherpa-barchart` | bars |
| `sherpa-tabs` | tabs |
| `sherpa-breadcrumbs` | crumbs |
| `sherpa-chart-legend` | swatches |
| `sherpa-progress-step-tracker` | steps |
| `sherpa-file-upload` | files |
| `sherpa-notifications` | notifications |
| `sherpa-pagination` | page options |
| `sherpa-data-grid` | **rows** |
| `sherpa-list` &middot; `sherpa-key-value-list` &middot; `sherpa-transfer-list` | list entries |

One of the twelve has rows. The other eleven had to read past a name that
described a table.

So the base class says `renderItems` and `cloneItem`, and the directives module
`fillItem`. **An ITEM is whatever the
component repeats.** The method's own signature already used that word
(`items`, `item`, `index`); only the name disagreed.

**What did NOT need changing, and why that matters:**

- the template **ATTRIBUTES** (`data-text`, `data-icon`, `data-attr-*`,
  `data-when-*`) were already presentation-free
- `populate(data: unknown)` was already shape-agnostic
- `DataSource`'s `rows`, and the Query's `sort` and `page`, are **query** words, not UI words.
  A `Row` there is a RECORD — a chart has rows of data and draws none

So the leak was narrow: the base class's own vocabulary, and nothing else. A
component naming its OWN parts is fine and stays — `sherpa-chart-legend` has
real rollup rows, and `T-rollup-row-has-its-own-prototype` keeps its name.

- Site: `src/core/ui/sherpa-element.ts`

### T-item-template-cannot-compute

`renderItems()` and `cloneItem()` fill a cloned prototype from the item's own
fields, by the template's directives (`T-a-template-binds-by-markup`), not by a
`fill` callback. A field may carry `??` fallbacks — `data-text="header??field"`
is the aliasing six stamp sites hand-wrote — and `data-index="data-index"`
writes the item's position.

IT DELIBERATELY CANNOT COMPUTE: no maths, no formatting, no reading component
state. A derived row keeps its `fill` callback, because a template that could
compute would be an expression language.

**A FIXED glyph in a prototype is not a directive.** `clone()` draws it;
`renderItems` does not, so a fixed glyph there is written in `after`. The
breadcrumb separator was blank for want of that (found by reading, 2026-10-15).

- Site: `src/core/ui/directives.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-breadcrumbs/sherpa-breadcrumbs.ts`

### T-template-id-read-once-was-permanent

`#stampedTemplate` records the template id currently STAMPED, so a later
attribute change can tell whether the component now wants a different tree.

`templateId` used to be read ONCE, at first render, so a component kept its
FIRST tree for life. It LOOKED right on `sherpa-button` — a declared prop
writes the icon either way — while the label, badge and menu slots the icon
variant does not have simply stayed.

This is also why `#resolveTemplate` returns the id ALONGSIDE the body, and why
the fallback path returns the FIRST template's REAL id rather than null: a
variant component that fell back would otherwise look like it had no template
and never re-stamp.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/core/ui/templater.ts`

### T-restamp-runs-after-on-change

In `attributeChangedCallback` the variant re-stamp runs **LAST, after
`onChange`**.

The component has just reacted to the attribute against the tree it STILL HAS.
If that attribute also changes WHICH tree it wants, re-stamping now lets the
component's setup run again on the new one — re-stamping first would have run
`onChange` against a tree that was about to be thrown away, and its cached refs
would be dead nodes.

`#restampIfVariantChanged` is cheap on the common path: `templateId` returns
null for the 53 single-template components, and the ids match for a variant
component whose variant did not change, so it is one getter call and a string
compare. The map is parsed at FIRST RENDER and cached per URL, so a re-stamp
costs no fetch and no re-parse.

A declared prop re-syncs itself first, and `onChange` still fires afterwards, so
a component can do extra work for the same attribute (sync an `aria-*` value,
re-measure) without also having to write the text. A prop that FALLS BACK to the
changed attribute re-syncs too — `data-label` falling back to `data-heading`
has to re-sync when `data-heading` is what changed.

- Site: `src/core/ui/sherpa-element.ts`

### T-shared-sheets-settle-independently

`#adoptStyles` **yields a microtask first**, so top-level module init has run
before the list is read. The eight shared sheets are `SherpaElement`'s own
default now (189), but a page that ADDS one sets `SherpaElement.sharedStyles`
at module init — and an element present in the initial HTML can upgrade before
that line runs, and adopt the list without it.

The sheets are then loaded with `Promise.allSettled`, not `Promise.all`. A
failed or slow sheet must NOT drop the others: each settles on its own, and
whatever loaded is kept. A failed one is reported (`sheet-failed`) and not
cached, so the next element asks again (TODO 224).

Styles are awaited BEFORE any DOM is written, which is what prevents a flash of
unstyled content; the HTML fetch runs in parallel with them.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/core/ui/templater.ts`

### T-populate-settles-after-render-data

`populate()` returns a promise that settles once `renderData()` HAS RUN.

`rendered` only says the shadow TREE exists; `populate()` chains onto it, so
awaiting `rendered` can resolve BEFORE the data is in the DOM. A caller that
reads back what it just populated must await `populate()`, not `rendered`.
Fire-and-forget callers can keep ignoring it.

That is why `renderData` MAY RETURN A PROMISE. Most components render
synchronously and return nothing. A COMPOSING one does not: an app header's
data lands in slotted children, so its own `renderData` finishing says nothing
about whether the chips exist. Returning the children's promises is what keeps
`populate()`'s contract true — it settles when the data is in the DOM — for a
component whose DOM is somebody else's.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`

### T-set-removes-on-falsy

`this.set(attr, value)` is the declared JS→CSS write path — the counterpart of
`this.dataset['len'] = String(count)`, which `sherpa-sparkline` does by hand to
tell its CSS how many points it drew.

`null`, `undefined` and `false` REMOVE the attribute, so `:host([data-x])`
stops matching. `true` sets it EMPTY — a bare boolean attribute. Writing
`"false"` or `"null"` instead would leave the selector matching forever, which
is the whole failure this rule prevents.

- Site: `src/core/ui/sherpa-element.ts`

### T-empty-write-lets-css-collapse

A directive treats EMPTY and A MISSING SOURCE as the same thing: it writes the
template's own value, and `''` where the template has none
(`T-the-templates-text-is-the-default`). It writes nothing when that value is
there already.

That is what lets the component's own `:empty` / `data-has-*` CSS collapse the
node. **The base class never hides anything itself** — CSS owns visibility, so
there is no `display: none` and no `.hidden` toggle anywhere in here.

- Site: `src/core/ui/directives.ts`

### T-the-templates-text-is-the-default

**What a directive's element holds in the `.html` is its default** (Will, TODO
344: default text is the template's, never a string in TS). `#stamp` reads each
directive's own text — or its own attribute — BEFORE anything writes, and writes
it back whenever its source is absent or removed. So `PropDef.default` is gone:
`<h3 class="pane-heading" data-text="data-source-heading">Available</h3>` is the
transfer list's default heading.

The read is TRIMMED, and blank counts as none: the inlined build strips indents
and a dev build does not, so an untrimmed read differed between them, and a
blank-but-indented target would stop matching `:empty`. It runs on EVERY stamp
(a re-stamp is a new tree), and never inside a `<template>` prototype. A
consumer's `useTemplate()` markup sets its own defaults the same way.

The spec reads the same place: `generate-component-spec.mjs` takes a prop's
default from the element its `data-text` or `data-attr-*` follows it on in the
default template (`boundTo`), then from the header's `(default …)` mark, and
notes it when the two disagree.

- Site: `src/core/ui/directives.ts`
- Site: `scripts/generate-component-spec.mjs`
- Site: `test/e2e/reforged-num-coercion.spec.ts`

### T-clone-returns-null-never-asserts

`clone()` is the one way to stamp a repeating row, and it returns `null` when
the template is missing or empty.

Three null policies were in use — an early return, a `!` on the LOOKUP (which
throws the moment a template is renamed), and an unguarded optional chain — and
every one of them then asserted `content.firstElementChild!` regardless.

THAT ASSERTION IS THE REAL HAZARD: a template whose first node is a comment or
whitespace-only text yields `null!`, and the crash lands at the next property
access, far from the cause.

`content` is also missing on a NON-`<template>` element, so a selector that
matched the wrong node fails here rather than throwing somewhere downstream. A
caller that cannot proceed without the row should return early; there is
nothing to assert.

- Site: `src/core/ui/sherpa-element.ts`

### T-an-optional-part-is-stamped-when-it-shows

A part that most hosts never show is a `<template>` prototype in the host's
markup, not an element. `stampOnce(prototype, make)` clones it into the
prototype's own place the first time there is something to show, and keeps it.
Measured 2026-11-04 on Demos Records: 473 `sherpa-badge`s, ONE showing a count
(the bell's). Each built its shadow root and adopted its sheet, about 30 µs.

Once stamped it stays. A count that goes writes no text, and the badge's own
`:host(:empty)` hides it, as before. So a reader of a host's badge allows for
none: `$('.applied-count')?.textContent`, never `!`.

A menu row's count is a per-row prototype (`menu-count-tpl`): the row stamps
it the first time it counts, before its caret.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-app-header.spec.ts`
- Site: `test/e2e/reforged-button.spec.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

### T-render-list-keeps-fill-in-the-caller

**`renderList` is folded into `renderItems`** (2026-09-29, the API audit's
A2): its `fill` is now `renderItems`' `after`. The rule stands.

`renderItems` does the four steps every data-driven list repeats: clear the
container, clone the prototype per item, fill, append. What each row then
BECOMES is the caller's business and stays in `after` — an id, an
`aria-current`, a per-column type. Only the plumbing is shared. Its clone is
IMPORTED, as `clone()`'s is, so a component in an item upgrades at once. Its
icons come from `data-icon` fields (`T-item-template-cannot-compute`).

The template is looked up ONCE and reused for the whole run, so a long list
costs one shadow query rather than one per row.

`clear: 'own-children'` removes only nodes matching `ownSel` instead of
emptying the container. `sherpa-list` needs it: its rows sit beside a `<slot>`,
and `replaceChildren()` would take the slot with them. `renderItems` takes the
same option for the same reason.

The index passed to `after` is the LOOP position. A component stamping a
DIFFERENT index — `sherpa-barchart` writes each datum's original position while
iterating a filtered list — writes it inside `after` from its own data.

- Site: `src/core/ui/sherpa-element.ts`

### T-row-fragment-cloned-whole

`renderItems` clones the whole `<template>` FRAGMENT, not its
`firstElementChild`: a semantic pair like `<dt>` + `<dd>` is two SIBLING roots,
and stamping only the first would silently drop the value half of every row.

`after` then gets the FIRST root; a second is its `nextElementSibling` (a chart
dot and its tip). It is the escape hatch for the ONE derived
value a declarative template cannot compute (`T-item-template-cannot-compute`);
reach for it before abandoning the row to a hand-written `fill`.

`fillItem` sweeps the row ROOT as well as its descendants, because the root can
carry the directives too, and it snapshots `[...el.attributes]` — the loop
removes each directive as it consumes it, and a live `NamedNodeMap` would skip
entries when one is taken out mid-iteration.

- Site: `src/core/ui/directives.ts`
- Site: `src/core/ui/sherpa-element.ts`

### T-shadow-input-needs-element-internals

`static formAssociated = true` plus `attachInternals()` is not optional here.
Without it the field is INVISIBLE to the form around it: its value is left out
of `FormData`, `form.reset()` does not clear it, and `form.checkValidity()`
reports nothing about it. The real `<input>` is inside a shadow root, and a
form cannot see through one — that is the gap `ElementInternals` closes.

`#syncValue` then does two separate things through it:

- `setFormValue` puts the value into `FormData` under the host's `name`.
- `setValidity` is what `form.checkValidity()` and a submit both read.

The **third argument** to `setValidity` is the ANCHOR, and it is the inner
control, so the browser scrolls to and focuses the real box when a submit is
blocked. Without it the focus lands on the host and the caret is nowhere.

The flag is `customError` when the message came from OUR rules. The native
flags (`valueMissing`, `patternMismatch`) describe the browser's own checks, and
claiming one of those would misreport why the field failed. With no message of
ours it defers to the control's OWN native validity, which is already doing
`required`, `pattern`, `minlength` and the rest for free.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `src/components/sherpa-switch/sherpa-switch.ts`
- Site: `src/components/sherpa-select-radio/sherpa-select-radio.ts`
- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.ts`
- Site: `src/core/ui/form-value.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-swatch-picker/sherpa-swatch-picker.ts`

### T-parent-chain-walk-not-a-selector

The rail is stamped as a **FLAT list of rows**, because the Figma rail is one
flat column of 24-tall rows and INDENTATION alone conveys depth — there is no
nested container to draw. Each row records `data-parent` and `data-depth`.

So "is this child showing?" is a WALK UP the `data-parent` chain, and not
something a selector can express. A row shows when EVERY ancestor above it is
expanded. The children are flat SIBLINGS of their parent, so `:has()` could only
tell that SOME sibling is shut and would hide unrelated branches. Deriving it
here also means a closed GRANDparent correctly hides a grandchild whose own
parent is open, with no cascade of extra state to keep in step.

`#syncRowVisibility` writes `data-hidden` and CSS acts on it; JS never toggles
display. It is re-derived after every stamp and every chevron toggle, and runs
once at the end of `#renderSections` because parents start closed, so their
children must start hidden.

The walk itself is `hiddenRows` (`src/core/ui/tree-rows.ts`), DOM-free: a menu's
tree of tiered values (TODO 369) asks the same question of the same flat shape.

- Site: `src/components/sherpa-nav/sherpa-nav.ts`
- Site: `src/core/ui/tree-rows.ts`
- Site: `test/unit/a-shut-parent-hides-its-tree.test.mjs`

### T-shared-values-two-components-must-agree-on

`core/ui/shared-constants.ts` holds values that MORE THAN ONE component must agree
on: glyph names (`ORGANISE_ICONS`), a selector (`NON_VALUE_ROWS`), words, a chart's
geometry. Each is here for the same reason — two components had each written their
own copy and the copies had drifted. The RULE is "a value two components must not
disagree about".

A glyph belongs here when TWO OR MORE components draw the same concept. The sort
arrows are the case it exists for: a column header and a toolbar chip are two views
of ONE sort, and if they disagree about what "descending" looks like the reader is
told the two controls are different things.

They WERE duplicated — a `static icons` on `sherpa-data-grid` and a `static #icons`
on `sherpa-quick-filter-toolbar`, each holding its own copy of the same four
strings. A test existed to catch the drift, which is the clearest possible sign the
duplication was the problem.

A glyph used by ONE component stays in that component. This is a shared vocabulary,
not a dumping ground for every icon in the system.

- Site: `src/core/ui/shared-constants.ts`

### T-non-value-rows-is-one-selector

`NON_VALUE_ROWS` is `'.qf-all'` — the rows in a filter menu that are NOT values.
Select all is a control OVER the set: counted in, it reports its own "on" as a
picked value, and the badge reads one too high with everything ticked.

ONE DEFINITION because the readers had DRIFTED: `sherpa-menu` excluded two row
shapes while the toolbar and quick-filter excluded one. The second, `.qf-toggle`
— a folded on/off chip's tick — went on 2026-09-25, when a folded chip became a
row with a caret (`T-a-row-opens-its-child-menu`).

- Site: `src/core/ui/shared-constants.ts`

### T-write-icon-is-protected-not-private

`writeIcon` is PROTECTED rather than private, and that is deliberate: a template's
`data-attr-data-icon` cannot cover a RUNTIME target choice (`sherpa-nav`,
`sherpa-nav-item`), one glyph written into TWO slots, or an icon a module of a
component draws (the grid's status cells). Those reach for this method.

So: **reach for THIS; never build an `<i>`.** Four components had built a child
`<i>` with `createElement`, which CLAUDE.md forbids outright — classes go on the
TARGET ITSELF instead. Only previously-applied `fa-*` classes are stripped, so a
re-render never accumulates two icons.

The two accepted value forms are `T-icon-value-takes-two-forms`.

- Site: `src/core/ui/sherpa-element.ts`

### T-style-border-base-is-default-1

**The checkbox and the radio differ in border WIDTH, not colour.** They look
like one control, so the natural move is one rule. Figma binds them apart:

| | stroke colour | stroke width |
|---|---|---|
| `Checkbox (Atom)` | `style-border/base +1` | `border/width/sm` · **0.5px** |
| `Radio (Atom)` | `style-border/base` | `border/width/base` · 1px |

The NAME is history. Until 2026-09-24 `style-border/base` resolved to the pale
`border/default/+1` (#e8e8f6). Since the Style tier was synced by variable id,
`base` and `+1` both resolve to `border/default/+2` (#b3b3c3) — in live Figma
and in `tokens.css` alike. So bind the Style name Figma binds, and never pick a
Theme step from a comment: a comment about a token is not a reading of it.

The width changes the geometry inside it. The checked indicator is inset 2px
and must land at 14 on a 20 box; `inset` measures from the PADDING box, so it is
immune — but arithmetic from the content box would draw 15 at a 0.5px border.

- Site: `src/core/sherpa-checkbox-look.css`
- Site: `src/components/sherpa-select-radio/sherpa-select-radio.css`
- Site: `src/components/sherpa-container-footer/sherpa-container-footer.css`

### T-checkbox-stroke-is-sm

The checkbox border is `border/width/sm` — **0.5px**, via Primitives
`border/stroke/200`. Not the 1px `border/width/base` that most bordered
components take, and that this drew.

It is a sub-pixel stroke on a 20px box. On a 1x display it renders as a lighter
1px line rather than a thinner one, so the change shows up as a subtly paler
box and reads as a colour bug, not a width one.

- Site: `src/core/sherpa-checkbox-look.css`

### T-a-property-set-before-upgrade-shadows-its-accessor

`box.checked = true` did nothing, silently, forever.

A custom element is upgraded when the browser reaches it — not when it is
created. `document.importNode` on a `<template>` gives back elements that are
NOT yet upgraded, and a grid that stamps rows sets their state in the same tick.
That assignment lands as a plain **own data property** on the instance. When the
upgrade happens moments later, the prototype's accessor is installed behind a
property that now shadows it: the setter never runs again, the getter is never
asked, and reading the property back returns the stale value that was written —
so the bug looks like it worked.

This is why the grid's ticks came back on a re-render but not on a programmatic
select, and why `host.checked` returned `true` while the inner `<input>` was
`false` and the box was drawn empty.

The fix is the standard **property upgrade**: on connect, for every own key that
some prototype defines as an accessor, capture the value, `delete` the own
property so the accessor is reachable again, and re-assign — which now runs the
setter. `SherpaElement.connectedCallback` does this for every component before
anything else reads state, because any component with a JS property has the same
hole.

Note it is not enough to only fix the component that was caught: the grid is one
caller, and the next one will stamp a different element.

- Site: `src/core/ui/sherpa-element.ts`

### T-checkbox-rounding-is-flat-sm

The checkbox corners are **one flat token**, `border/rounding/sm` (2px) — not
the per-corner `rounding/top-left` … `rounding/bottom-right` chain that the
Grouping collection drives.

That difference is load-bearing. `.sherpa-snap-group` squares a child's inner
corners by writing those four custom properties, and custom properties inherit
straight through a shadow boundary. While the control read them, the advanced
checkbox's snap group reached past the wrapper and squared two corners of the
checkbox's own drawn box — which needed a reset rule on `.field` / `.control`
to undo. A flat value reads none of them, so the reset went away with the
cause.

Read this as the general rule: **a control that is snapped inside a wrapper
should not itself consume the per-corner rounding variables.** The wrapper
snaps; the thing inside it keeps its own shape.

- Site: `src/core/sherpa-checkbox-look.css`

### T-the-tick-needs-the-fixed-ramp

The checkmark went BLACK in dark mode.

It was painted with `--sherpa-theme-content-body-4`, which resolves to
`neutral-color-1` — `#FFFFFF` in light and `#0C0B11` in dark. That is correct
for text on the page, which SHOULD flip. It is wrong for ink sitting on a
coloured fill, which must not: the checkbox indicator stays accent blue in both
modes, so its tick has to stay white in both.

The `fixed` ramp exists for exactly this. `neutral-fixed-color-*` does not
re-point under `[data-mode]`, and nine components already spell it as
`--sherpa-theme-content-body-base-fixed` — a badge on a status pill, the nav's
selected row, the switch's knob label. Figma says the same thing a different
way: `style-content/inverse` now aliases Theme `content/body/inverse-fixed`,
which composes `Display Mode/color/neutral/fixed/color 1`.

**Ask which half is fixed.** Ink on a surface that flips should flip with it.
Ink on a surface that does NOT flip must not. Getting this wrong is invisible in
light mode, which is where it gets reviewed.

- Site: `src/core/sherpa-checkbox-look.css`

### T-a-template-is-parsed-once

**Each template body is parsed ONCE, into a `<template>`; each element stamps a
deep copy of it.** TODO 350 (the lean-code audit, E1). Setting each shadow root's
`innerHTML` from the body's string runs the HTML parser again for every button,
chip and cell on the page; a copy of parsed nodes costs far less. The same pass
notes whether the body holds a directive, a `data-icon` or a tip's anchor at all,
so a tree with none is not searched for them on each stamp (`stampable`).
IMPORTED (`importNode`), not cloned: the page's document upgrades each custom
element at once, as it did from `innerHTML`. A live reload clears the parsed
bodies.

- Site: `src/core/ui/templater.ts`

### T-a-component-with-data-icon-draws-its-own

`upgradeIcons()` sweeps a stamped tree for `[data-icon]` and turns each match
into an SVG in an icon box. A `sherpa-*` ELEMENT with `data-icon` must be
skipped.

`data-icon` is `sherpa-container-header`'s own public API — the glyph it draws
beside its title. The sweep found the header itself, replaced its children with
an SVG and gave it `sherpa-icon-box`, which is `inline-flex` at 14px square. A
composed header collapsed to an icon and dropped the search field slotted
inside it.

Nothing errored. The header was still there, still 14px, and its content was
gone.

---
- Site: `src/core/ui/render-icon.ts`

### T-closest-stops-at-the-shadow-boundary

`Element.closest()` walks `parentElement`, and a shadow root is not one. A walk
that starts inside a component's shadow DOM stops at the shadow root and
returns `null` — it never reaches the host, let alone the host's ancestors.

Measured: the filter panel looked for a chip's toolbar with
`chip.closest('sherpa-quick-filter-toolbar')`. The chip is in the toolbar's own
shadow root, so the call returned `null` every time, and nothing downstream ran.

A root walk crosses it — at each step, a `ShadowRoot` hands over its `host`:

```ts
node = node instanceof ShadowRoot ? node.host : node.parentNode;
```

`composedPath()` does the same job for an EVENT. `closest()` is correct only
inside one tree.

- Site: `src/core/ui/sherpa-element.ts`

### T-a-sub-pixel-border-reads-back-as-1px

`getComputedStyle().borderTopWidth` returns the USED value, and Chromium rounds
every sub-pixel border up to one device pixel. So `0.5px` and `0.25px` both read
back as `"1px"`, and a probe cannot tell them apart — or tell either from a real
1px border.

This matters here because the design uses sub-pixel strokes deliberately: a
hairline is `border/width/sm` (0.5), and a snapped PAIR splits one hairline into
two 0.25 halves so the seam between two touching controls is not drawn twice.
Measuring the advanced checkbox reported `1px | 1px | 1px | 1px` on a wrapper
whose declared edges are `0.5 0.25 0.5 0.5` — which looks like the seam is
broken when it is exactly right.

**Read the custom property, not the border.** `getPropertyValue
('--sherpa-border-right')` returns the declared `0.25px`. Verify with a
throwaway element if in doubt: a div with 0.5/0.25/1/2px edges reports
`1px 1px 1px 2px`.

- Site: `src/core/sherpa-grouping.css`
- Site: `test/e2e/reforged-grouping.spec.ts`

### T-rendered-settles-even-when-the-markup-does-not

`#bootstrap()` awaits the component's stylesheet and its `.html` together, then
stamps and calls `#resolveRendered()`. An unguarded `await` skipped that last
call whenever the markup fetch REJECTED, so `rendered` stayed pending for the
life of the page.

There are **557** `await el.rendered` sites across `src/`, `test/` and
`../Sherpa Demos/app/`. Every one hung — no error, no timeout, no warning.

Measured, not argued. Two failure modes behave differently and only one was a
hang:

| the server does | `fetch` | before the fix |
|---|---|---|
| drops the connection | REJECTS | `rendered` pending forever |
| answers 404 | RESOLVES | stamped the error page as the template |

The 404 case is why `loadHtml` now checks `r.ok`: `fetch` treats any response
as success, so `r.text()` handed back whatever the server wrote — silently,
with no template and no complaint.

`#bootstrap` now catches, logs the component's own tag name, and stamps empty.
A blank element is a fault a person can see; a promise that never settles is
not.

`#adoptStyles` already had this defence (`allSettled`, see
T-shared-sheets-settle-independently). The markup leg never got one.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-bootstrap-failure.spec.ts`

### T-motion-is-owned-here

**`CLAUDE.md` told components not to write a `prefers-reduced-motion` block
because "motion gating is owned globally". Nothing owned it.** Searched
`src/`, `src/styles/` and `../Sherpa Demos/app/`: zero matches. Every animation in the
library ignored the setting, and the rule that forbade a local fix was the
reason nobody added one.

The gate is in `sherpa-motion.css`, which every shadow root adopts. It sets
`animation-duration` rather than `animation: none`, so a paused animation lands
on its END state instead of snapping back to its start — and `!important`,
because a component's own rule outranks a shared sheet's and this has to win
everywhere. Verified in Chromium with `reducedMotion: 'reduce'`: the loader's
spin and the data grid's row transition both drop to `1e-05s`, including on
`::after`.

Two other things live there for the same reason:

- **`@keyframes sherpa-spin`.** `sherpa-container` and `sherpa-loader` each
  defined one rotation, byte-identical. A keyframe in an adopted sheet is
  reachable from a component's own rules — verified: the loader animates
  `sherpa-spin` at `0.8s` with no local definition.
- **A duration scale** — `--sherpa-motion-fast|base|slow`. 84 timing values
  across the components, 72 of them 100ms or 120ms. The outliers are real (80ms
  for a row hover, 300ms for a bar growing), which is why it is a named scale
  and not one value.

A toast's slide and a progress bar's sweep stay local: both are specific to
their component's geometry.

**`lint:css` holds it (2026-10-14).** It allowed a `prefers-reduced-motion`
block anywhere, against the rule. Now one in any sheet but
`sherpa-motion.css` is an error (`motion-gate`), and a component's only
sanctioned `@media` is `forced-colors`.

- Site: `src/core/sherpa-motion.css`
- Site: `scripts/lint-css.mjs`
- Site: `src/components/sherpa-loader/sherpa-loader.css`

### T-anchoring-is-generic

The anchor-positioning machinery in `sherpa-anchor.css` was named `.chart-tip`,
`.chart-mark`, `.chart-anchor-point`. None of it is chart-specific: it is
`position-anchor` plus `position-try-fallbacks` plus a zero-size anchor point,
which any component could use to place a tip beside any trigger.

It answers to `.sherpa-tip`, `.sherpa-tip-value`, `.sherpa-anchor`,
`.sherpa-anchor-point` and `.sherpa-anchor-el`. The `chart-*` names were kept
as aliases for a while, then renamed outright and dropped (Will, TODO 335):
each thing has one name (`T-a-rename-drops-the-old-name`).

Two constraints the machinery carries, worth knowing before reusing it:

- **An anchor cannot cross a shadow boundary.** Trigger and tip must share one
  root. That is why `--_anchor` is supplied by JS: an anchor name cannot be
  derived in CSS.
- **An SVG element cannot be a CSS anchor in Chromium**, which is what the
  zero-size anchor point exists for.

- Site: `src/core/sherpa-anchor.css`

### T-a-document-class-cannot-reach-a-shadow-root

`tokens.css` is `<link>`ed into the page. A **custom property** declared there
inherits across a shadow boundary, so `var(--sherpa-theme-content-size-h1)`
works inside a component. A **class rule** does not: a shadow root matches
selectors against its own adopted sheets only.

The generator had been emitting 27 `.sherpa-text-*` role classes into the theme
layer of `tokens.css`. Measured in Chromium, the same class gave:

```
.sherpa-text-h1 in the document:  24px / 600
.sherpa-text-h1 in a shadow root: 14px / 400   (the inherited default)
.sherpa-text-mono-* in a shadow root: Inter, not ui-monospace
```

Zero of the 58 components used them — which is the tell. A class nobody can
reach looks exactly like a class nobody wanted.

They now generate into `src/core/sherpa-typography.css`, which
`SherpaElement.sharedStyles` adopts into every shadow root beside
`sherpa-base.css`. `tokens.css` emits none of them.

The split between the two folders is the rule to keep: **`src/styles/` is what
the APP links, `src/core/` is what a COMPONENT adopts.** A class belongs in
`core`; a token belongs in `styles`.

A page rule reaches a host by its TAG, never by a class its TS adds: the
projected grid rules select `:is(.sherpa-grid, sherpa-layout-grid)` (TODO 344).

- Site: `scripts/project-tokens.mjs`
- Site: `src/core/sherpa-typography.css`
- Site: `src/core/sherpa-group-positions.css`
- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.html`
- Site: `test/e2e/reforged-layout-grid.spec.ts`
- Site: `src/components/sherpa-group/sherpa-group.css`
- Site: `test/e2e/reforged-group.spec.ts`
- Site: `src/core/ui/sherpa-element.ts`

### T-import-dies-in-an-adopted-sheet

Shared CSS is split by subject — base, typography, anchoring, motion — and the
obvious way to join them is one entry sheet that `@import`s the rest. It does
not work, and it does not say so.

Measured in Chromium against a constructable sheet whose text begins
`@import url("/b.css");`:

```
sheet.replace(css)      → resolved. No throw, no warning.
[...sheet.cssRules]     → 1 rule. The @import is not even listed.
the imported .from-b    → rgb(0,0,0) / 16px — the defaults. Never applied.
```

`CSSStyleSheet.replace()` drops `@import` by specification; a constructable
sheet has no base URL to resolve one against. The failure is silent, which
makes it the same shape as the bug above it: styles that are simply absent.

So `SherpaElement.sharedStyles` lists **one URL per file**, in cascade order.
The base class already fetches a list and adopts them all — splitting a sheet
costs one line there and nothing else. A new shared stylesheet must be added to
that array or nothing adopts it.

- Site: `src/core/sherpa-base.css`
- Site: `src/core/ui/sherpa-element.ts`

### T-a-grid-group-computes-its-own-position

Grouping has three axes in Figma, and `tokens.css` projects all 21 positions.
`sherpa-grouping.css` gives horizontal and vertical a wrapper class that works
by position (`:first-child`, `:last-child`). Grid needs the COLUMN COUNT, and
the obvious route fails:

**`:nth-child()` will not take a `var()`.** Measured: of seven
`.sherpa-group-grid` rules written as `:nth-child(var(--cols) n + 1)`, the
browser kept **three** — every `var()` selector was dropped from `cssRules`
with no error. The surviving `:first-child` rule made one cell look correct by
luck, which is how it nearly shipped.

The position is computed in a VALUE instead, where `sibling-index()` IS
allowed. Set `--cols` on the wrapper; each cell derives the rest:

```css
--sherpa-group-index: calc(sibling-index() - 1);
--sherpa-group-col: calc(var(--sherpa-group-index)
  - var(--cols) * round(down, calc(var(--sherpa-group-index) / var(--cols)), 1));
--sherpa-group-row: round(down, calc(var(--sherpa-group-index) / var(--cols)), 1);
--sherpa-group-last-row: calc(round(up, calc(sibling-count() / var(--cols)), 1) - 1);
```

`round(down, …)` is INTEGER DIVISION, which is what a span needs; `mod()` and
`rem()` do work in all three engines, they answer a different question.
`if(style(--sherpa-group-col: 0): …; else: …)` then picks each edge. Verified
in Chromium 153 and WebKit 26 on a 3x2 grid and on 7 cells in 3 columns — the
partial last row lands correctly, because `--sherpa-group-last-row` comes from
`sibling-count()`.

So a re-order, an insert or a delete needs nothing from JS. Behind the
`@supports (width: if(...))` gate every cell keeps a full outer box, which is
correct, just not joined.

The class was also doing half a job before this: it squared corners but never
set the border WIDTHS, so two neighbours each drew a full hairline and doubled
it. `.sherpa-group` now sets both.

- Site: `src/core/sherpa-grouping.css`
- Site: `test/e2e/reforged-grouping.spec.ts`
- Site: `src/components/sherpa-group/sherpa-group.css`

### T-a-shared-edge-is-halved-on-both-sides

Will's ruling, 2026-09-15. An edge SHARED with a neighbour is aliased one step
down the width ramp — `sm` 0.5px → `xs` 0.25px — on **both** items. The two
halves meet at zero spacing and read as one full-weight stroke.

It is not drawn once by one side, and never overlapped negatively. Getting this
wrong is invisible in a screenshot and invisible to `getComputedStyle`, which
floors every sub-pixel border to `"1px"`
(T-a-sub-pixel-border-reads-back-as-1px) — so a joint of 0.75px reads exactly
like a correct one. Read the custom property.

A corner is round only when BOTH of its edges are outer.

`.sherpa-group` got this wrong on its first pass: it halved only the start edge
and let the neighbour keep a full one. The `[data-group]` tokens, which come
from Figma, are what caught it.

- Site: `src/core/sherpa-grouping.css`
- Site: `src/components/sherpa-group/sherpa-group.css`
- Site: `src/components/sherpa-metric-group/sherpa-metric-group.css`
- Site: `test/e2e/reforged-group.spec.ts`

### T-a-host-attribute-is-declared-once

A `:host([data-x])` rule is a PUBLIC API: a host sets the attribute and the
component restyles. Undeclared, it is a contract between the CSS and nothing —
invisible to the TS, to the generated `.component.json`, and to any agent
reading either.

**65 of them were in that state, across 31 of 58 components.** Measured the
moment anything looked: `data-align`, `data-gap` and five more on
`sherpa-stack`; eight on `sherpa-app-header`; four on `sherpa-list-item`. Only
27 components declared `static props` at all, holding 45 entries between them.

They are now declared as `kind: 'style'`, which generates no DOM writes — it
says the attribute is REAL. 576 Playwright tests stayed green, which is the
point: the gap was never visible as a bug, only as a missing contract.

`scripts/check-props.mjs` gates it. Two things it deliberately does not flag,
because each is already named somewhere true:

| | |
|---|---|
| `[data-x]` with no `:host()` | an inner element — component-private |
| `data-status`, `data-look`, `data-elevation`, `data-density`, `data-theme` | CASCADES. An ANCESTOR sets these and any component may read them, so declaring one would claim ownership it does not have |

That last row is why `sherpa-select-checkbox` and `sherpa-select-radio` still
carry an undeclared `:host([data-status])` and are right to.

**The READ half, added 2026-09-22.** `this.dataset['x']` is the same public
attribute arriving, so it carries the same obligation. Measured across the 58:
**392 sites reach a component's own attributes six different ways** — 183
`dataset` reads, 101 `hasAttribute`, 52 `toggleAttribute`, 36 `setAttribute`,
18 `getAttribute`, and `this.set()` exactly twice.

169 of the 183 reads named an attribute the component already declared, which
is the declaration pass holding. Nine did not, and are now declared:

| | |
|---|---|
| `data-bounds` ×3 | a selector for the box a popover must stay inside, passed DOWN by the host. One meaning in three components, so it went to `SHARED_PROPS` |
| `data-total-pages` | already in `DATA_PROPS`; the grid now reads from there rather than growing a copy |
| `data-select`, `data-anchor`, `data-value`, `data-heading`, `data-has-values` | one component each |

`variantAttrs` counts as a declaration, and three `data-type` reads that first
looked like gaps were already declared there.

**`observed` no longer counts** (TODO 195, 2026-10-12). 135 observed `data-*`
in 37 components were in no `static props`, so `populate({ label })` skipped
them and their specs could not type them — the review's
`button.populate({ label: 'Save' })` drew nothing. 131 moved into props: 18
`content`, 48 `style`, 65 `behaviour`; the sort, group, filter and page names
point at `DATA_PROPS`. A boolean among them is typed `boolean` only where
nothing writes it `"false"`, since a declared boolean set to `"false"` is
removed (`T-false-is-off`). The gate now fails an observed `data-*` that is
not declared. (A renamed attribute's old name was the one exception until
2026-10-14, when the old names went: `T-a-rename-drops-the-old-name`.)

The gate checks only `this.dataset`. A local `cal.dataset['value']` is another
element's business, and counting it reported five phantom gaps.

- Site: `scripts/check-props.mjs`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `scripts/check-usage.mjs`

### T-the-shared-vocabulary-is-declared-once

An attribute more than one component declares is a SHARED contract, and it was
being spelled once per component. Measured across the 58: `data-heading` in 9,
`data-type` in 8, `data-size` in 3.

Two of those groups are fine as they are. A `kind: 'content'` entry differs
only in WHERE its template writes it — `data-text="data-heading"` on `.title` vs
`.heading-text` vs `.heading` — and that is the component's own DOM, so nine
copies of `type: 'string', kind: 'content'` are repetition, not duplication.
Moving them would mean the base class guessing at a class name.

The `kind: 'style'` ones are not fine, because a copy can be WRONG and nothing
says so. `sherpa-grid-cell` declared `data-sort-direction` with values
`['asc']` — missing `desc`, and missing the empty string that means SUSPENDED
(T-a-suspended-sort-is-one-owners-job). Its generated spec said so too, which
is what an agent reads.

`src/core/ui/sherpa-element.ts` now exports two objects:

| | |
|---|---|
| `DATA_PROPS` | the seven attributes `SourceBinding.push` writes on every bound component, plus `data-locked`. A component declares one to say it READS it |
| `SHARED_PROPS` | style attributes whose shape is identical wherever they appear — `data-size`, `data-orientation` |

`scripts/check-ownership.mjs` reads `DATA_PROPS` out of that file rather than
keeping its own list, which was a fifth copy of the same seven names. Verified
live: adding an eighth entry made the gate report eight.

Three `data-orientation` declarations WIDENED as a result, from one value to
both. That is a fix: each CSS selects on one value and treats the other as the
default expressed by the attribute's absence, so declaring only the selected
one under-described the API.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `scripts/check-ownership.mjs`

### T-any-component-can-be-bound

Will, 2026-09-22: *"Any UI component should be able to ask the data layer. It's
not restricted to certain components… The same goes for showing data. Granted
the data may just be 1 text label, or even no data at all gets shown, but the
capability should be there for any UI component."*

Half of that was already true and half was not, which is the interesting part.

**ASKING was always generic.** `bindSource()` never checked a type. Measured: a plain
`sherpa-button`, bound and handed a `sort-change`, steered the query, took
`data-locked`, and received `data-sort-field="tier"` back. There is no
allow-list anywhere — `STEERING_EVENTS` names the events, not the elements
permitted to send them.

**SHOWING was not.** `renderData` defaulted to a no-op, and only 23 of 58
components overrode it. The other 35 could be bound, would receive a payload,
and would draw nothing — so the capability looked component-specific when only
the rendering was.

The base class now has a default: a payload's keys are written onto the
attributes the component DECLARES, and the existing prop sync does the rest.
`{ heading: '40 records' }` becomes `data-heading`, which `sherpa-section-header`
declares as `kind: 'content'` and its template writes into `.title` (`data-text`).

Three constraints make it safe:

- **Only DECLARED keys land.** A payload shaped for a grid, handed to a header,
  writes its `heading` and drops `totalPages`, `columns` and the rest. Without
  that, one adapter's keys become another component's attributes.
- **A component with its own `renderData` is untouched.** This is what it
  replaces, not something it must call.
- **A component declaring nothing shows nothing**, which is correct.
  `sherpa-progress-bar` has no props; `sherpa-tag` takes its label as slotted
  content. Neither is a gap.

The camelCase → kebab mapping matches the props system: `iconStart` becomes
`data-icon-start`, and a key already spelled `data-*` is taken as written.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-any-component-binds.spec.ts`

### T-mirroring-skips-value

A component wrapping a real `<input>` keeps the two in step by copying native
attributes down. Four use one loop — `sherpa-select-checkbox`,
`sherpa-select-radio`, `sherpa-switch` and `sherpa-input-text` —
`SherpaElement.mirrorAttrs(control, attrs)`.

**`value` is skipped, deliberately.** It is a PROPERTY on a live control, and
writing the attribute after the reader has typed puts the old text back. Each
caller assigns `control.value` itself, with its own default: `'on'` for a
checkbox, a radio and a switch, the typed text for an input.

Checkbox, radio and switch share one list, `MIRRORED_CONTROL_ATTRS`; an input
keeps its own longer one (`placeholder`, `pattern`, the length limits), as a
superset is not the same value.

What a wider sweep found, recorded so it is not re-run: across 58 components
there are **110 runs of four or more identical lines shared by two or more**,
and after `mirrorAttrs` the largest remaining is three lines of boilerplate
shared by `sherpa-chip` and `sherpa-tag` — a `templateId` getter and a remove
handler that fire different events. Both components are 30–40 lines; a shared
base would cost more than it saves.

`this.clone()` appears at 39 sites in 6 components, and they do genuinely
different work — a legend swatch, an empty state, a nested nav row. That was
already settled on 2026-09-17 when `renderRows`/`cloneRow` was built, measured
to fit only 8 of 28 stamp sites, and removed again.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.ts`
- Site: `src/components/sherpa-select-radio/sherpa-select-radio.ts`
- Site: `src/components/sherpa-switch/sherpa-switch.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`

### T-a-shared-enum-is-not-every-enum

`SHARED_PROPS` says its entries have a shape "identical wherever they appear".
For `data-size` that is true of the three components that import it —
`empty-state`, `loader` and `section-header` all ship `sm | md | lg` — and NOT
true of the library as a whole.

`sherpa-button` ships **five**: `2xs xs sm lg xl`. It does not import
`SHARED_PROPS`, and it must not: adopting the shared entry would hand the
system's most-used control an enum missing three of its sizes.

The two never meet in code today, so nothing is broken. What the audit found is
an invitation: a future component that reaches for the shared entry because the
name matches inherits the smaller vocabulary silently, and nothing at runtime
validates an enum.

Two related facts worth keeping together:

- **`md` was missing from the shared entry.** All three importers document it as
  the default, and their CSS draws it on the bare `:host` — `sherpa-loader.css`
  says so in its own comment, `/* Sizes (unset = md) */`. The specs were right
  (they read the HTML comment); only the TS declaration was short. Listing a
  default in the enum is the house pattern — `data-sort-direction` already
  carries `''` for the same reason.
- **A size enum is per-tier, not global.** A control and a container do not have
  the same size vocabulary, in the same way that `data-label` and
  `data-heading` split by tier.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-button/sherpa-button.ts`

### T-a-scroll-shadow-is-drawn-over-the-content

**A scroll shadow is two sticky edges drawn OVER the content** (Will, TODO 401,
A). With `data-scroll-shadow` on its host, a scroll box marked
`.sherpa-scroll-shadow` shows an inner shadow on each edge its content is
hidden past. An inset `box-shadow`, or a `background-attachment: local` one, is
painted UNDER the content, so a card hides it. So the box's `::before` and
`::after` are sticky, 8px of gradient in half the shadow colour, `z-index: 1`, and
take no room: a negative margin, and a flex box with a `gap` names it in
`--_scroll-shadow-gap`. Every box sets that to 0 first: a custom property
inherits, and a stack's gap reached a grid slotted in it and slid its table
8px up under its sticky header. Each follows the box's own scroll
(`animation-timeline: scroll(nearest block)`): the top fades in over the first
16px, the bottom out over the last 16px — and the bottom, and a sideways end
edge, are HIDDEN until the scroll starts: a second animation on `visibility`,
over its first 1px (Will, TODO 504: *"we don't need to show the shadow until
scroll start"*). No overflow, no timeline: no shadow.

**Its size and ink are ONE pair of properties**, `--sherpa-scroll-shadow-size`
and `--sherpa-scroll-shadow-ink`, on `:host` in `sherpa-base.css`
(`T-one-value-one-declaration`): the edges, the grid's header strip, a stuck
metric row and a column's scope header all read them. As soft as a small drop
shadow (Will, 504: *"too harsh … more in line with other sherpa drop shadow
styles … doesn't need particularly large distance values"*): 8px, half the ink.
Chromium and WebKit, so iOS; Firefox 155 has no scroll timeline and shows
none. `scroll-state()` would be Chromium only.

**The bottom edge is held from BOTH sides**, in the box's last 8px
(`inset-block: calc(100% - 8px) 0`; a sticky inset's percentage is the
scrollport's). The app shell squeezes its Context to the frame and lets the
content spill past it, so an edge held only at the bottom rode up mid-box once
scrolled. Both are pinned across too: a wide grid scrolls sideways under them.

A sticky header with its own z-index — the grid's head, a column's scope —
covers the top edge: a stuck header casts its own shadow (TODO 421). The nav
list has none yet: its `::after` says "No matches". A SIDEWAYS scroll's edges
are its frame's (`T-a-sideways-scroll-shadow-is-its-frames`).

- Site: `src/core/sherpa-base.css`
- Site: `test/e2e/reforged-scroll-shadow.spec.ts`

### T-settled-waits-for-renders-not-transitions

`__settled()` waits for every `sherpa-*` element's `rendered` promise, drains
the microtask queue between passes, and then waits two animation frames. None of
that waits for a CSS **transition**.

`sherpa-nav` animates its own `inline-size` over 160ms as it settles to the
collapsed 40px. A measurement taken after those two frames can still catch the
host mid-flight — 292px, or 232px, on the way to 40 — and the search row inside
it then measures 216px instead of 24px.

It looked like flakiness because it only appears under CONCURRENCY. Measured
with twelve pages driven at once, same code, only the harness differing:

| | bad runs |
|---|---|
| before | **4 of 12** — `host: 232, searchW: 216` |
| after | 0 of 12 |

`__settled()` now also awaits `document.getAnimations()`. A rejection means the
animation was cancelled, which is settled too, so each is caught.

A test that measures a box on a component with a `transition` cannot rely on
frames alone. `Animation.finished` is the only thing that waits for one.

**Three more facts, measured 2026-10-12 in all three engines (TODO 225):**
- `document.getAnimations()` does NOT list animations inside shadow roots. The
  nav above animates its HOST, which is why it was caught; a transition inside
  a component never was. Each shadow root is asked too.
- An infinite animation (a loader, an indeterminate bar) and a paused one never
  finish, so `settled()` hung on them. Only running animations with an end are
  awaited.
- Given a part of the page, it waited on every animation in the document. It
  waits on the part now, shadow roots included.
- **And one TASK.** `showPopover()` is at once, but its `toggle` event comes a
  task later, and `sherpa-menu` writes `open` from it. Frames and microtasks do
  not wait for a task, so when Firefox's frames came fast, `settled()` ended
  before a menu said it was open — 1 run in 20, found by bisecting a flaky test
  to the change above. It waits one `setTimeout(0)` after the frames.
- **A CSS animation its element's style no longer names is not waited for**
  (`stale`, TODO 996). Firefox and WebKit still list the page's skeleton as
  running on an element once it is defined, its `animation-name` none. Endless,
  it was skipped; given an end (25 pulses), every `settled()` in those engines
  waited its 30 s, and Demos' specs timed out in `settle()` (sherpa-demos-67).
  Such an animation moves nothing, so it is left out, and one that goes stale
  while awaited ends the wait.

- Site: `src/core/ui/settled.ts`
- Site: `test/e2e/reforged-settled.spec.ts`

### T-a-native-control-brings-its-own-margin

A native control carries UA spacing nobody chose, and it is **not the same per
engine** — so the same component is a different size depending on the browser.
Measured on bare elements in all three:

| element | Chromium | Firefox | WebKit |
|---|---|---|---|
| `<input>` margin | `3px 3px 3px 4px` | `3px 3px 3px 4px` | **`3px 2px 3px 2px`** |
| `<button>` padding | `1px 6px` | **`1px 4px`** | **`0 6px 1px`** |
| `<option>` padding | `0 2px 1px 2px` | `2px 4px` | **`5.2px 12.1px 5.2px 8.25px`** |
| `<option>` gap | **7px** | — | — |

`sherpa-button` sets `padding-inline` and never `padding-block`, which is how a
UA value reached the trigger: its height differed per engine and nothing said
so.

`sherpa-base.css` zeroes them, at specificity 0 via `:where()`, so any component
rule still wins without `!important`:

```css
:where(input, fieldset) { margin: 0; }
:where(input, button, option, select) { padding: 0; }
:where(option) { gap: 0; }
```

Measured across the running app, spacing and sizing only (font metrics are
token-driven and exempt): **2,812 off-grid values → 276**, a 90% drop, with
every visible input identical in size before and after. What remains is 272
deliberate `2px` — the sanctioned sub-grid edge case — and 4 fractional
bar-chart data positions, which must stay exact.

This is why `round()` is not the tool for static spacing: a value you never
named cannot be rounded, because CSS has no self-reference. `round()` is for
DYNAMIC content that computes a fractional size.

- Site: `src/core/sherpa-base.css`

### T-round-is-for-dynamic-sizes-only

CSS `round()` works identically in Chromium, Firefox and WebKit — verified,
including on a value read from a custom property (`49.95px` → `48px` at a
`round(…, 8px)`). So it is available. It is just rarely the right answer.

**Will's ruling:** the sizing and spacing ranges are already aliased through the
tokens. `round()` is needed only when the content is DYNAMIC and computes a
fractional size.

Two reasons it cannot police static spacing:

1. **CSS has no self-reference.** `round(margin-top, 4px)` is not valid — you
   can only round a value you have already named, and a value you are naming is
   one you could have taken from a token instead.
2. **The drift was not in authored CSS at all.** `lint:css` reports zero
   off-grid literals. Measured in the running app, 2,571 of 2,812 off-grid
   values were UA defaults on native controls, which is a reset, not a rounding
   problem — `T-a-native-control-brings-its-own-margin`.

Measured across the app after that reset, the only JS-written pixel value is
`sherpa-data-grid`'s `--_pin-offset`, which is already on-grid **and must keep
its sub-pixel precision**: rounding it reintroduces the hairline that
`T-grid-pin-offset-needs-subpixel` exists to prevent.

Slider percentages and the sparkline's point count are not sizes and must not
be snapped either — a slider at 37% belongs at 37%.

So: reach for `round()` when dynamic content produces a fractional SIZE that
should sit on the grid. Do not wrap tokens in it, and do not wrap a measured
offset that is deliberately sub-pixel.

A sparkline's segments were rounded this way once (TODO 323). It held only
where the chart starts on a whole pixel, so the line is one shape now
(`T-a-trend-line-is-one-shape`).

- Site: `src/core/sherpa-grouping.css`

### T-a-wrapping-span-hides-its-own-row

`grid-column-start` does not report the track auto-placement chose. For an item
declared `grid-column: span 4` it reports **`span 4`** — measured in all three
engines — so CSS alone cannot tell which item is first or last in its row.

That is fine while every item is one column wide. It breaks the moment a span
wraps, which is the normal case for a layout grid: three `medium` thirds and
one `full` row are spans of 4, 4, 4 and 12 against 12 tracks, so
`sibling-index()` divided by the column count gives the wrong row for every one
of them.

`sherpa-group`'s grid mode is safe because its children are all one cell wide.
`sherpa-layout-grid`'s are not, so `data-grouped` MEASURES instead:
`measureGroupedGrid()` buckets children by their laid-out `top` — half a pixel
of rounding is the same row — and writes `data-group="grid-top-start"` and the
rest from that.

- Site: `src/components/sherpa-layout-grid/grouped-grid.ts`
- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.ts`
- Site: `src/components.ts`
- Site: `test/e2e/reforged-layout-grid.spec.ts`
- Site: `src/components/sherpa-layout-grid/grid-resize.ts`

### T-a-templater-owns-the-files

**A component's markup and sheets come from ONE imported helper,
`src/core/ui/templater.ts` — not the base class.** Will, TODO 68: *"it would
be good to be able to offload that and slim the base UI component down"*,
and 27: a consumer gives a component their OWN template, and CSS that
EXTENDS the default rather than replacing it.

- **Fetched once, by URL.** Every element of a kind shares one parsed
  template map and one `CSSStyleSheet` per file.
- **`useTemplate(tag, { html, css })`** draws every `tag` from your markup,
  and adds your sheets AFTER its own, so they win. Set it before the elements
  draw; one already drawn takes it on `SherpaElement.reload(tag)`.
- **What your markup lacks is REPORTED, never thrown**: each template id,
  part, slot name and class of the component's own — its code reaches for
  them. A class is on the list because `this.$('.x')` finds nothing without it.
- **A reload changes a sheet IN PLACE.** `replaceSync` on the one shared
  object restyles every element that adopted it; nothing is drawn again.
  New MARKUP is stamped again, as a variant re-stamp is, so a component whose
  `onRender` draws from its own state comes back as it was.
  `SherpaElement.reload()` with no tag reloads the shared sheets too.
- **A family's markup** (TODO 344): `static html` may be a LIST, as
  `static css` is — family files first, its own last. Each family file's
  first template is stamped AFTER the component's own body, so its
  prototypes sit in every member's root (`T-a-family-shares-markup`).
- **The example app reloads live** while `npm run build:watch` runs: the
  examples server watches `dist/` and sends `/live/files`, and the page
  calls `SherpaElement.reload(tag)`. Restart the server once to get the route.

- Site: `src/core/ui/templater.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-templater.spec.ts`

### T-an-icon-loads-when-first-drawn

**Every icon is a `<symbol>` in one sprite, `core/ui/icons.svg`, loaded the
first time any icon is drawn** (plan 695 P6, 2026-11-04). It is fetched and
parsed once; each draw after is a clone of the symbol's shapes into an `<svg>`
in the symbol's frame. It replaced one JS module per icon (TODO 199): 217
modules, 217 more chunks in the bundle, and the components' icons as data inside
it. `scripts/generate-icons.mjs` writes the sprite and the names in
`icon-names.ts`, so `hasIcon()` answers before it loads; the build copies the
sprite beside `render-icon.js`, and the bundle's URL to it is moved with the rest.

`renderIcon()` draws at once once the sprite is in; before that, when it lands.
Each element keeps the LAST icon it asked for, and only that one draws.
`rendered` waits for the first draw's icons, because a reader who awaits it and
reads an icon found none; `settled()` waits for any still loading.

**Why a clone, and not a `<use>` or a CSS mask**, measured on all 217 at 14 and
24px, 1x and 2x, in the page and in a shadow root, in all three engines:

- A **mask** differs on every one of the 207 one-colour icons (by up to 59/255
  in Chromium, 37 in Firefox, 1 in WebKit), and cannot draw the 10 coloured ones
  (the status badges, the OS marks) at all.
- A **`<use>`** of the sprite paints the same pixels, but WebKit fetched the 309
  KB sprite again for each `<use>` stamped in a later task — 228 fetches over
  four Context switches in Demos, each switch three times slower, Service Worker
  or not. Chromium does the same for each later batch when it is served
  `no-cache`. A `<use>` is also the slowest to draw: 1,700 icons took 117 to 426
  ms to the next frame in Chromium at 4x. And over one, WebKit's
  `elementsFromPoint()` names the outermost shadow host first, so Playwright saw
  the host intercept every click on an icon-only button.
- A **clone** paints the same pixels as the old inline paths, and drew the 1,700
  in 52 ms, half what `innerHTML` took.

The sprite is FETCHED, so a page's CSP must let `fetch()` reach the app's own
origin (`default-src 'self'` does), and it is parsed under the `sherpa-ui`
Trusted Types policy, as a template is. Offline, the fetch goes through the
Service Worker like any other; Demos keeps `icons.svg` at install, as it keeps
the bundle. A load that fails draws nothing, says `icons-failed`, and the next
draw tries again.

- Site: `src/core/ui/render-icon.ts`
- Site: `src/core/ui/settled.ts`
- Site: `src/core/ui/icon-names.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `scripts/generate-icons.mjs`
- Site: `scripts/build-reforged.mjs`
- Site: `test/e2e/reforged-icons.spec.ts`

### T-the-text-is-in-the-js

**A component fetches nothing: the build puts each template and sheet in its
JS** (Will, TODO 208, A). The source keeps `new URL('./x.css',
import.meta.url)`, so the spec tooling reads it as before; after `tsc` the
build wraps each one in `inlined(new URL(…), "<the file's text>")` and adds
the import. `inlined()` keeps the text in the templater under that URL, so the
first draw reads it — no request, no wait, and no bundler, CDN or CSP
`connect-src` in the way. A template goes in without its comments and indent.

A DEV build (`npm run build:watch`, `npm run build:dev`) skips the step and
fetches, so a live reload sees each change. **Since 2026-10-14 an inlined file
does not ship in `dist/` too** — 142 files the JS already carried — and a reload
SKIPS it: it cannot change without a new build. A consumer's own files are
still fetched fresh. A URL that ends in `.href` is a page `<link>`
(`tokens.css`), not the templater's, and stays a URL. Inlined templates go in
without their `data-accepts`: the spec carries it, nothing reads it at run time
(`T-a-slot-says-what-it-accepts`).
`check:weight` counts an inlined file as JS, not as fetched.

- Site: `src/core/ui/templater.ts`
- Site: `scripts/build-reforged.mjs`
- Site: `scripts/check-weight.mjs`
- Site: `test/e2e/reforged-templater.spec.ts`

### T-a-list-takes-its-children-as-data

**A page that writes only HTML could not fill a list.** The tab strip, the
breadcrumbs, a select's options and key-value pairs took data only through
`populate()`, a method. So each now reads its own CHILDREN as its data
(TODO 212): the tabs' panels (`data-tab`, `data-label`), `<a href>` crumbs,
`<option>`s, and `<dt>`/`<dd>` pairs.

A component overrides `childData()`; the base class reads it at the first
render and again when the children change, while no `populate()` has given
data — `populate()` wins once called. It draws only when what the children
SAY changed: drawing can touch them (the tabs mark their panels), and a
`MutationObserver` that drew on every record looped for ever. And a child
added to the host is a record whose target is the host, so only the host's
own ATTRIBUTE records are ignored.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-children-are-data.spec.ts`

### T-a-bundler-can-turn-a-file-into-a-module

**A bundler can hand back JavaScript where Sherpa asked for a sheet.**
Measured 2026-10-12 (TODO 218):

- **Vite's dev server** answers a plain `fetch()` for a `.css` with its
  hot-reload MODULE. Asked with `Accept: text/css`, it answers with the CSS —
  so the templater asks that way, and Vite dev needs no setting.
- **webpack's usual CSS rule** (`style-loader` + `css-loader`) also catches
  `new URL('./x.css', import.meta.url)` and emits the sheet as a module. The
  parts draw with no styles. The consumer's fix is one line on that rule:
  `dependency: { not: ['url'] }`. CSS has no `import` or `export` statement,
  so a sheet holding one is refused and the report names that line.
- **Vite before 8** pre-bundles the package into `node_modules/.vite/deps/`
  and leaves each `new URL` pointing there, at nothing. A failed file under
  `/.vite/` says `optimizeDeps: { exclude: ['sherpa-ui'] }`. Vite 8 rewrites
  the URL itself.

Since TODO 208 the default build fetches none of these, so all three apply
only to a DEV build (`T-the-text-is-in-the-js`).

- Site: `src/core/ui/templater.ts`
- Site: `test/e2e/reforged-reports-round-2.spec.ts`

### T-focus-is-delegated-by-the-platform

**A control whose one control is inside its shadow root sets `static
delegatesFocus = true`** (D5; TODO 273) — the platform's own flag, which
`SherpaElement` passes to `attachShadow`. A click on the host, or `focus()`
on it, then goes to the first focusable part inside. Six components wrote the
same `override focus() { this.#control?.focus(options) }`: switch, checkbox,
radio, input-text, select-card and prompt-composer. The flag is OPT-IN, since
it also changes what `:focus` matches on the host and where a click on an
empty part goes: a component with several focusable parts, a menu or a grid,
leaves it off.

- Site: `src/core/ui/sherpa-element.ts`

### T-aria-defaults-live-in-internals

**A component's DEFAULT role and ARIA are `static aria`, set through
`ElementInternals`** (D5; TODO 274), not attributes written onto the host. The
loader and the callout did `if (!hasAttribute('role')) setAttribute('role',
'status')` by hand. An author's own `role="alert"` attribute still wins — the
platform says so: internals are the default, the attribute is the author's —
and nothing is written to the page's markup. `static aria = { role: 'status',
ariaLive: 'polite' }`, applied in the constructor.

**Read it from the internals.** The host has no `role` attribute now, so a test
reads `internals.role`, never `getAttribute('role')`. Playwright's `getByRole`
does not help: it works roles out from the DOM, and does not read
`ElementInternals`; the browser's own a11y tree does. The select card
keeps its hand-written role: it sets `aria-checked` as an ATTRIBUTE, and an
attribute with no role attribute beside it is what axe flags.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-loader.spec.ts`

### T-a-flag-brings-the-base-methods

**A platform flag a component sets brings the base's methods with it, and the
spec lists them** — and a declared boolean's `accessor` brings its property. `static formAssociated = true` brings `checkValidity()` and
`reportValidity()`; `static delegatesFocus = true`, `focus()`. They are written
once: `define()` puts the two form doors on a form-associated class alone, as a
native control has them (plan 695 P6 — every element had them before, and an
element that was no control answered `true`), over `SherpaElement`'s `formLink`
and a `syncFormValue()` a control overrides to refresh what it submits before a
check. They were written by hand in 5 form controls. The spec generator reads only the component's own class, so
`parseClassApi` adds the flag's methods — or the contract would lose the
surface a caller reaches (`form-control-names.test.mjs` holds it). The move
gave `checkValidity()` to the four form-associated controls that had none
(calendar, file-upload, slider, transfer-list). A boolean prop's `accessor:
'current'` is the same shape: `define()` installs `get`/`set` that read and
toggle the attribute, the class says `declare current: boolean`, and the
generator lists the property (list-item, nav-item, select-card).

- Site: `scripts/lib/ts-facts.mjs`
- Site: `scripts/generate-component-spec.mjs`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/unit/form-control-names.test.mjs`
- Site: `test/e2e/reforged-form-controls.spec.ts`

### T-every-button-says-its-action

**A `sherpa-button` with no visible label shows a tip that says what it
does** — its name (`aria-label`). Will, 2026-09-26. A LABELLED button already
says it, so a tip would repeat it: only `data-tip` gives one a tip. A button
with no name shows none; one whose menu is open shows none; a host that
composes the button and says the action itself sets `data-no-tip`.

It is the SHARED anchored tip (`.sherpa-tip` in `sherpa-anchor.css`), not a
nested `sherpa-tooltip` per button: opened on hover or keyboard focus
(`T-a-tip-lives-in-the-top-layer`), anchored to the button's own `.trigger`. With no room above — a button at the
top of the page — `position-try-fallbacks` moves it to the side; a test that
asserts "above" must give the button room first.

**The tip carries its own colour boundary.** It inherits the host's custom
properties like any child, so a saturated button's white ink became its
bubble. `.sherpa-tip` therefore binds the DEFAULT mode's own names
(`--sherpa-style-default-content-base`, `…-default-surface-shadow`), which no
pin re-points — so every host's tip, a chart's too, is immune. `@scope` alone
does not do this: it limits what a rule MATCHES, never what a child INHERITS,
and a top-layer popover inherits the same way.

- Site: `src/components/sherpa-button/sherpa-button.ts`
- Site: `src/components/sherpa-button/sherpa-button.css`
- Site: `src/core/sherpa-anchor.css`
- Site: `test/e2e/reforged-button-tip.spec.ts`

### T-sherpa-runs-under-a-strict-csp

**Sherpa runs on a page with a strict CSP** — `default-src 'self'; style-src
'self'; require-trusted-types-for 'script'` — as an enterprise or framework host
may set (TODO 215). Two things broke it:

- **Five HTML sinks** — the template stamp, the icon paths, two template
  parses, the View markup parse — throw under Trusted Types. Each goes through
  a policy (`trusted-html.ts`): `sherpa-ui` for Sherpa's OWN files, and
  `sherpa-ui-view` for a View's markup, so a page can allow each by name
  (`trusted-types sherpa-ui sherpa-ui-view`). A page that names neither gets a
  `trusted-types-policy` report, not a silent blank.
- **`style` attributes** are refused without `'unsafe-inline'`. A template must
  carry no `style=""`, and nothing needs one: the calendar's projected stepper
  is a `sherpa-group`, shaped by its own sheet in any tree (TODO 344).

Constructed sheets (`replaceSync`) need no `'unsafe-inline'`. A test page with
the strict CSP (`test/reforged/csp.html`) records every refusal.

- Site: `src/core/ui/trusted-html.ts`
- Site: `test/e2e/reforged-strict-csp.spec.ts`

### T-false-is-off

**`data-x="false"` is OFF on a declared boolean prop.** Sherpa reads a boolean
by PRESENCE — `:host([data-x])`, `hasAttribute` — and React 18 and 19, Vue 3,
Angular's `[attr.]` and Svelte all write `data-x={false}` as the string
`"false"`, so a framework's off read as on (TODO 211). The base class removes a
declared `type: 'boolean'` prop set to `"false"`, before the first render and
after. Only DECLARED booleans: a string prop keeps `"false"` as its value, and
an attribute still in `observed` is not covered until 195 declares it.

The same item gives `populate()` a PROPERTY, `data`, on every component: React
19, Vue and Svelte bind a property and cannot call a method. It reads what was
last given; set before the element upgrades, the base class keeps it
(`#upgradeProperties`) and draws it. And the grid's `key`, which React and Vue
keep for themselves, is also `rowKey`.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-framework-binding.spec.ts`

### T-a-component-imports-anywhere

**A component imports in Node, and defines nothing there; in a browser it
defines its tag ONCE.** Every import used to throw `HTMLElement is not defined`
on a server, so Next.js, Nuxt, Angular SSR and SvelteKit had to defer every
import — and none of the 65 `customElements.define` calls checked first, so a
second copy of the library on one page (micro-frontends, Storybook beside the
app, a CDN copy beside a bundle) threw at its first define and lost its whole
import graph (TODO 207).

Measured first: with `HTMLElement` and `customElements` stubbed, every module
loaded — the base class and the defines were the only DOM at module level. So
`SherpaElement` extends `globalThis.HTMLElement ?? class {}`, and every
component registers through `define(tag, Class)`: nothing without
`customElements`, nothing when this class holds the tag, and a `tag-taken`
report — not a throw — when another class does. A node test imports every
module in `dist/` with no DOM at all.

The spec tooling finds a component's class by its define line; its patterns
read both `define(` and `customElements.define(`.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/unit/import-anywhere.test.mjs`

### T-a-socket-is-drawn-by-its-type

**A socket is its type's SHAPE, in its type's ink, hollow until a connection joins
it** (Will, TODO 713; plan-713 §2, M2; TODO 998 A). The shape is the socket's and its
inner face's CORNERS (`border-radius`; an object a square turned 45deg) — never an
image — so one box draws them all, input and output alike: a value a circle, an
object a diamond, a boolean a square, any a grey circle. Colour is never the only
cue (TODO 998: the three inks were neighbours on the wheel, and two were one colour
to a protan eye). Not a `clip-path`: a round one was cut flat on one side in
Chromium where the socket stood on a fraction of a pixel, as it does in a socket tab
(Will saw it, 2026-11-11).

- **The ink is the TYPE's, never a status's.** Each type's ink is said ONCE, on
  `:root` in the page sheet `sherpa-node-connectors.css`:
  `--sherpa-socket-ink-value` (teal), `-object` (violet), `-boolean` (magenta),
  the data viz series' own borders (`--sherpa-theme-data-viz-sequence-border-3`,
  `-2`, `-8`). Measured for 998: at least 16 apart (CIEDE2000) in each colour
  blindness, and at least 3:1 on the light and the dark card, so one ink serves both
  modes. They inherit into every node's and row's shadow root, where `.socket` sets
  `--_ink` from them by type; any is the secondary grey. No red, green or yellow:
  those read as a status (Will, 2026-11-13, after boolean was the success green). The
  socket part pins `default` (`'& .socket'` in `state-pins.yaml`), so a picked or
  running node changes none of them and the hollow face stays the card's white.
- **Hollow is the face inside the ring**; `data-input-connected` and
  `data-output-connected` (the host writes them) hide it, so a joined socket is
  filled. A diamond's ring is its 1px border, so a test meets it at a tip, where each
  engine paints it a pixel apart.
- **No socket is double height**, a many input included (TODO 807, plan 944).
- **Never colour alone.** Each socket has a tip that says its type in words, and in
  forced colours the ink goes to `CanvasText` while the shape stays. A connection line
  takes the ink of its FROM socket's type, from `data-type` on its path, in the page
  sheet `sherpa-node-connectors.css` — the same list the sockets read, so a line and
  its socket never differ. A line being DRAGGED from an output, or a lifted end, takes
  it too; one run back from an input has no source yet, so it is grey.

- Site: `src/core/sherpa-node-sockets.css`
- Site: `src/components/sherpa-node/sherpa-node-connectors.css`
- Site: `src/components/sherpa-node/sherpa-node.ts`
- Site: `test/e2e/reforged-node.spec.ts`

### T-a-node-row-wears-its-nodes-look

**A Nodes-panel row looks like its node on the canvas, from ONE sheet** (Will, 2026-11-06, TODO 840: "it is hard to
link a node in the Nodes panel to its node on the canvas"). A node's tinted fill and its corner radii are said by its
kind's category (`data-category`: sources, output, ai, custom-nodes), once, in `src/core/sherpa-node-look.css`, as the
custom properties `--_category-fill` and `--_node-radius`; `sherpa-node` and `sherpa-list-item` both adopt it.

- A list item with `data-type="node"` draws its `.row` with that fill, a border and those radii; with no category the
  fill is the plain surface and the radii 4px, as a node's are. The panel stamps `data-type="node"` and the category's
  slug (`categorySlug`, the one the node's own attribute uses) on every row; a Custom Node's row is `custom-nodes`.
- A new category is one more rule in that sheet: the node and its row both follow. Nothing is said in the panel's CSS.

- Site: `src/core/sherpa-node-look.css`
- Site: `src/components/sherpa-list-item/sherpa-list-item.css`
- Site: `test/e2e/reforged-node-panel-row-looks-like-its-node.spec.ts`

### T-an-edit-is-a-step

**An editor's Undo steps back what the reader did, not each write** (TODOs 560 and
561, Will, 2026-10-29). The draft is a plain object and each edit a pure function
on it, so a step is the draft and the edited definitions BEFORE and AFTER, held in
the data layer's `Journal` (capped, 100): they share structure, so a step is cheap.
The editor's draft is not a store, so it keeps the Journal itself; a store opts in
to the same class with `journal: N` (`T-a-store-keeps-its-history`).

- **One edit, one step, however many writes.** A placement that is connected, a Custom
  Node made (its definition and its use), a reconnect: each is `edit()`, and the
  step is recorded when the outermost one ends. The same tag within a second (a
  drag, a typed word) folds into one.
- **Across a Custom Node**: one journal for the workflow and every definition the
  tab edited, so an undo works in whatever level it was made, and leaving a level
  keeps it. A step holds each definition IT changed, before and after, and puts back
  only those, over the library as it is: a refresh of the library is not undone.
- **Save clears nothing; Discard resets it.** Save hands the draft over, and a step
  taken after it is still a step, a definition's too: Undo takes it back, it is a
  draft edit again, and the next Save hands that over (TODO 829). So a step holds the
  definition as it was, never the saved copy: that has the edit already. A definition
  a step made stays once saved: it is the app's.
- **The toolbar reports, the editor owns.** `sherpa-node-toolbar` fires
  `toolbar-select { action }`; the editor sets `data-can-undo` and `data-can-redo`
  from the journal. Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z (and Ctrl/Cmd+Y) are the keys,
  except in a text field, which keeps its own undo.
- **The toolbar floats at the bottom centre** (Will, 734), 16px up, level with the zoom controls, as the card floats
  32px in, so the card keeps 32px from the top. Under 44rem beside a card the
  toolbar yields to the card's right, in the canvas's own container units.
- **The Query editor steps its draft the same way.** It keeps a `Journal` of the
  Query's draft COPIES, whoever changed them (the graph, or a chip outside it), and a
  step is the Query's own restore (`restoreDraft`, which is `setQuery` where nothing
  waits), so every reader redraws and a held value stays. Where a scope waits for
  Apply a step moves the DRAFT only and leaves what is applied: an Apply is no step.

- Site: `src/core/ui/node-graph.ts`
- Site: `src/components/sherpa-node-toolbar/sherpa-node-toolbar.html`
- Site: `src/components/sherpa-node-toolbar/sherpa-node-toolbar.ts`
- Site: `test/e2e/reforged-node-undo.spec.ts`
- Site: `test/e2e/reforged-query-undo.spec.ts`
- Site: `test/unit/a-query-draft-is-restored-whole.test.mjs`
- Site: `src/core/ui/query-editor.ts`

### T-abort-signal-any-is-collected

**`AbortSignal.any()` loses its listeners in WebKit.** `on(target, type, handler,
{ while })` once passed `AbortSignal.any([this.signal, shorter])` to
`addEventListener`. Nothing held that joined signal but the listener, and WebKit
can collect it. When `shorter` then aborts, nothing reaches the listener, so it
stays on the window for good.

Measured (TODO 757, 2026-11-05): the node panel's drag puts `pointermove` and
`pointerup` on the window `while` the drag lasts. In WebKit, 5 of 10 runs kept
the drag's `pointerup`. The next click's release ran the old drag's end: it set
"a drag just ended", so the panel dropped that click, and no `node-add` went out.
Chromium and Firefox never did this. iOS is WebKit, so this is a real bug, not
a test flake.

The fix: `#either(shorter)` makes its own `AbortController` and aborts it from
both signals. The two listeners on the source signals hold it, so it lives as
long as they do. The run then passed 20 of 20. A signal given to `fetch` is held
by the fetch, so `stores.ts` keeps `AbortSignal.any`.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-query-panel.spec.ts`

### T-an-inactive-button-keeps-its-tip

**An inactive `sherpa-button` says `aria-disabled="true"` on its inner button,
never native `disabled`** (Will, TODO 806: "Tooltips should still work on
inactive buttons"). The tip is how a reader learns WHY a tool is off: the node
toolbar's Save as Custom Node says "pick two or more nodes". Native `disabled`
took the inner button out of the Tab order, and the look sheet's
`.sherpa-button:disabled` gave it `pointer-events: none`, so a hover landed on
the HOST. The tip system hears hover and focus in the button's OWN shadow root
(`T-a-tip-lives-in-the-top-layer`), so neither ever reached it. Measured: no
tip on hover or on Tab, in all three engines.

What native `disabled` gave for free, and where each one is now:

- **No press.** A pointer, Enter and Space all fire `click` on an
  `aria-disabled` button. The host's capture listener refuses it before any
  other, and its `preventDefault()` cancels the button's own activation: a
  `commandfor` a press set while the button was on does not run
  (`T-a-disabled-button-acts-on-nothing`).
- **No fill step.** `:hover` and `:active` now match, so an `aria-disabled`
  Button holds its base surface. Its pixels at rest, hovered and pressed are the
  same, and at rest they are byte for byte what they were.
- **Forced colours.** `:disabled` gets `GrayText` from the browser;
  `aria-disabled` gets it from the look sheet. Emulate forced colours BEFORE the
  mount: an adopted sheet did not hear the emulation turned on after it.
- **Tab.** An inactive button is a Tab stop now, as the APG allows. `controlsIn`
  passes a control only when it, or its own focus, is NATIVELY `:disabled`.
  Before, it passed any host with `[disabled]`. The arrows still move between
  live controls only. Focus can now sit on an off one, so `rovingFocus` steps
  from where it sits, not from the first live control. Before, Left from Redo
  went to Tie, past Undo.

The host's own `aria-disabled` is gone. It was written EMPTY, so it said
nothing, and the inner button is the control a screen reader reads.

Playwright will not `click()` an `aria-disabled` control. A spec presses it with
`page.mouse` at its centre, as a reader does.

- Site: `src/core/sherpa-button-look.css`
- Site: `src/core/ui/tab-stops.ts`
- Site: `src/core/ui/roving-focus.ts`
- Site: `src/components/sherpa-button/sherpa-button.ts`
- Site: `test/e2e/reforged-an-inactive-button-keeps-its-tip.spec.ts`

### T-the-layers-are-one-scale

**What floats over a page has ONE scale, by name, written once** — Will, TODO 832:
"a combination of component and app awareness of layers", then the game engine's
bands. `src/core/sherpa-layers.css` is adopted into every shadow root, so each
component reads it from its own host: `content` 1 (a page's layers, the header, a
panel area), `bars` 2 (the nav rail, a Context's fixed region), `banners` 100
("Unable to reach data"), `panels` 101 (docked on the right edge), `floating` 102
(a floating panel, plus its place in the tab's one stack:
`T-a-pressed-panel-comes-to-the-front`), `toasts` 1000. A menu, a dialog and a tip
are the UI band: the browser's top layer, over every number. A layer is
`var(--sherpa-layer-<name>, <the value>)`; Rule 20's fallback is required, and it
is the scale's own number, which `check:layers` reads and holds equal.

The other half is the component's: one with inner layers that could escape seals
them with `isolation: isolate` (the data grid, `T-a-grid-keeps-its-own-layers`),
so its own numbers (its head 3, its cells 2, its edges 5) never meet the page's. A component that HOLDS a floating box must not seal: the filter column floats, so its
toolbar stays open (sealed, its floating box drew UNDER the page beside it).
Those internal numbers stay bare and are COUNTED: `scripts/layers-baseline.json`
may only fall, per file, and a new bare z-index fails the hook and CI. A number
that reaches the page belongs on the scale, not in a baseline.

- Site: `src/core/sherpa-layers.css`
- Site: `scripts/check-layers.mjs`
- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.css`
- Site: `test/e2e/reforged-layer-bands.spec.ts`

### T-the-panel-keys-are-shift-and-a-number

**The panels' tabs have keys** (Will, 2026-11-06), installed by the app shell
(`src/core/ui/panel-keys.ts`, on `window`):

- **Left or Right Shift and a number** brings that number's panel of the left or right areas to the fore
  (`panel.front()`; the area hears `panel-front`); a tab opens to its last state. It never shuts one: with
  several panels docked and tabbed, a number is the tab's, so it cannot also minimise.
- **Shift and minus** shuts the focused panel, else the front one of that Shift's side, back to its tab;
  **Shift and plus** opens the focused tab, else the first tab on that side.
- **Ctrl and Shift and minus, or plus,** shuts or opens every panel and tab, whatever the side.
- **The number is the TAB's place on its side** (Will, 2026-11-06): the tabs in the row of an area that holds
  several open panels, in the row's order, then the tabs on the edge. A panel alone in its area has no tab, so
  no number (`tabbed`). A panel counts only if it is `data-minimisable`. A number with no tab does nothing.
- **Which Shift** comes from the key codes (`ShiftLeft`, `ShiftRight`) of the keydowns seen, since a key
  event only says `shiftKey`. Both held, or neither seen, name no side; a blur forgets them.
- **A field being typed in keeps its keys**, and Alt and Cmd chords are left alone.
- The panels answer `minimise(on?)`, `front()`, `minimised`, `side` and `shown`; a shut-to-tab by key also
  shuts its area's others, as the button does (`T-an-area-holds-two-panels-stacked`).

- Site: `src/core/ui/panel-keys.ts`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.ts`
- Site: `test/e2e/reforged-panel-keys.spec.ts`
- Site: `test/unit/parity-sweep.test.mjs`

### T-a-content-adopts-its-panels-header

**A panel's content puts its controls in the panel's header** (Will, TODO 847, decision B). A content element is a
child of the panel, and only the panel's own LIGHT children carry a `slot` into its header: its own shadow DOM
cannot. So `SherpaElement.adoptHeader(template)` clones the elements of a `<template class="…">` of the content's own
into the panel's light DOM, each with the `slot` it takes there, and removes them as the content leaves; a move
clones them again (`onConnect`). The filter panel clones its search (`description`), the count of filters applied
(`badge`), Suggest and Save (`actions`) and the ⋮ (`overflow`).

- **The panel's own buttons come first.** The `actions` slot is before the panel's Minimise, Float and Pop; the
  `actions-end` slot (the page's Show as toolbar) and `overflow` (the content's ⋮) are after them. Will, 11-06.
- **The clones sit in the page's DOM, so no shadow CSS reaches them.** Their look is their own components' (a
  `sherpa-button` each), and what the page offers is the `hidden` attribute
  the content sets on them (Suggest, Save, the count) from its own attributes.
- **The wiring looks in two places:** a column's own root for its templates and menus, the panel's header for its buttons
  (`header()` on `ColumnHost` and `HeaderHost`).

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`
- Site: `test/e2e/reforged-filter-panel.spec.ts`

### T-a-redraw-keeps-what-it-can

**A redraw changes only what changed: an element taken out and put back is a style and a layout again, and so is a value
written again** (measured on the Records filter graph, 2026-11-10: a node drag cost ~220 ms a move, now ~6 ms). Four things
each cost a frame on their own:

- **Rebuilt lines.** `drawConnections` made every connector new on each move, and `replaceChildren` took the old ones out. Each
  element in or out re-checks every `:has()` round it, up to `<html>` (the app shell's grid rules have `:has(> …)`), and the
  layout then starts at the page root. Now the lines drawn last time, keyed by what each is, are `morph`ed to the new ones,
  and `keepOrder` moves only one out of place.
- **`append` of what is already there** moves it: each stage left the canvas and came back each draw.
- **A `:state()` set again** (`states.add` of one already on) restyles the host's whole subtree in Chromium.
  `toggleState` writes only a change.
- **A count read straight after each draw** (`offsetTop`, then a write) is a layout per field: a graph of tag fields did one
  each. A tag field's `count()` waits for the next frame, with every other field's: all read, then all written.

The minimap is the same: its items are kept and take the new boxes, and a style is written only where its value changed.
Ask the trace before guessing: `LayoutInvalidationTracking` and `StyleRecalcInvalidationTracking` name each element and why.

- Site: `src/core/ui/keep-order.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `src/core/ui/node-stages-ui.ts`
- Site: `src/core/ui/node-lanes-ui.ts`
- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.ts`
- Site: `src/components/sherpa-input-text/input-tags.ts`

### T-a-node-is-three-columns

**A node is three columns: its input sockets, its card, its output sockets** (Will, 2026-11-10, TODO 887; plan-887). Every
socket stands OUTSIDE the card in its own SOCKET TAB (`part` `socket-tab-in`, `socket-tab-out`, `socket-tab-false`; Will
named it, 2026-11-11), a D flush with the card's edge: the input a reverse D, the outputs a D. A tab is the thing a look
styles to join a socket to the card. A row's tab in a grey box is the box's grey, and the grey BLEEDS from the box across
the card's edge into it (Will, 2026-11-11). It is ONE shape: the tab's own fill reaches into the card to the box and 1px
under it (`--_bleed`, the reach less the track, plus 1px), and its line is a `::before` on its outer 28px only (the card's
border, its three outer sides). Drawn as two shapes — the tab, and a shadow for the bleed — their edges met at the card's
edge on a fraction of a pixel and showed a faint seam and a different shade (Will saw it); an outline would draw over the
bleed besides, as an element's outline paints above its children.

- **A row is its own grid of the same three tracks** (`--_track`, 24px: the 16px socket and 4px each side — Will narrowed it,
  2026-11-11; a tab is 28px tall, `--_tab-h`, and the socket's 6px press area reaches past its sides, `--_tab-inset`),
  and it reaches past its grey box and the card's edge by `--_reach`, which the node sets for a row in a box and one on its
  own. So every row's columns line up, and its sockets meet the card where the header's do. A row with no socket on a side
  leaves that cell empty.
- **A tab never sets its row's height**: on a field row it sits on the control's line (the field's last line, one
  control high); on a label row it takes no height (`margin-block: -14px`) and sits on the label's middle. A tab that
  sized its row made every label row 8px taller, and a node over the next one.
- **A tab stands over a neighbour's card** (`z-index` on the content layer): it overhangs its own card, and a node set
  close on its right covered a row's output, so a drag from it began on the neighbour.
- **The tab is the tip's anchor, not the socket**: a tip is found as the first `.sherpa-tip` AFTER its anchor
  (`top-layer-tips`), and the socket sits inside its tab.
- **The host is still the card's width** (`nodeWidth`): the tabs overhang it 27px a side, as the header's always did, so
  no place, Arrange or Unfurl moves.
- **A fork's True and False tabs HANG from the card's top and bottom edges**, at its end (Will, 2026-11-11): round on the
  outer side, square where they join the card, and the card's end corners square to meet them; the caption steps aside
  for True. So a fork's footer takes no room, and True stands ABOVE the card: a node at the very top of the view puts it
  under the stage strip (two specs pan down for it). Collapsed, both stand in the end strip as before.
- **Collapsed, one strip a side, as before** (Will: "B when nodes are collapsed"): a tab is `display: contents` in a row,
  and clear on the header and False, and the stacks draw the strip. CSS cannot count sockets across the rows' shadow roots,
  so the strip's length is still the graph's count (`stackPlaces`).

- Site: `src/core/sherpa-node-sockets.css`
- Site: `src/components/sherpa-node/sherpa-node.css`
- Site: `src/components/sherpa-node-row/sherpa-node-row.css`

### T-webkit-drops-an-unheld-state-set

**WebKit collects an element's `internals.states` when no script holds it, and the next read is a NEW, EMPTY set; the
element still matches every `:state()` the old one had** (measured 2026-11-14, WebKit 26.6, for sherpa-demos-67: a panel
opened by `minimise(false)` kept `:state(minimised)`, so its body had `display: none`). `toggleState` writes only a change
(`T-a-redraw-keeps-what-it-can`), so it asked the new set, found no `minimised`, and never deleted it: the stale state
stayed matched for good. In a page of garbage, a bare custom element shows it: `[...states]` is empty while
`matches(':state(a)')` is true; one whose set a field holds keeps both. Chromium and Firefox keep the set with its element.

`SherpaElement` holds the set in `#states` from its first write, and `hasState` reads that one. Never read `states` fresh
off `internals` to test or change a state.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-a-state-outlives-a-collection.spec.ts`

### T-a-bend-is-a-smooth-point

**At a bend point the curve passes without a corner** (Will, TODO 999: "the midpoint should have a equal bezier handle so
that it doesn't kink at acute angles when moved"). `controlsThrough` gives each piece its two handles. A bend point's are
one straight line along the way from the point before to the point after, of one length on both sides: a third of the
shorter reach, and no more than half of each gap in x. So a control never passes its neighbours in x, and the curve,
sorted by x, still never loops back. An end socket's handles and a tie's slot stay flat: a tie's lines pass it side by
side. `pathThrough`, `dotsThrough` (the line a click lands on) and `handlesOf` (a piece's middle, on the curve as drawn)
all read the same handles, so the hit line and the handles sit on the line that is seen.

- Was: every piece flat at both ends, so a bend moved to an acute angle drew a kink.

- Site: `src/core/ui/connector-path.ts`
- Site: `test/unit/a-connector-bends-where-the-reader-put-them.test.mjs`

### T-a-line-sweeps-round-a-node

**An Unfurl writes a line's one bend only where its curve would meet a node, and sets its handles' turn** (Will, TODO 1010:
"The unfurled mid points of connectors cause the connector to be squiggly. The rotation of the handles of the point, as well
as the position, need to be set so that they create a nice consistent flow from one socket to another while also avoiding
any other nodes."). 999's middles, each laid out as a node's cell and written as its bend, sat off the line's natural path,
with handles along the way from the point before to the point after, so a line bent twice.

- **The middles still space the nodes**; then `sweepOf` (connector-path.ts) looks at each untied line's default curve: one
  that misses every node it does not join gets no bend. Else, of the bends that miss them all, the gentlest: on the curve or
  moved square off it, at the curve's own turn there or a little off it (`TURN_COST` px a degree), written as `{ x, y, turn }`.
- **A node's radius** (half its largest side) is the quick test, its box (`LINE_CLEAR` px round it) the real one.
- **The test samples every few px**: 17 dots a piece, as a click lands, slipped past a node's corner and passed a grazing
  curve as clear.
- **One bend cannot clear every line**: a line that leaves its socket already level with a node next to it keeps its flat
  end handle that far. Then the bend that meets the fewest dots wins. On reforged-node-unfurl's tangle: dots in a node a line
  does not join 36 → 4 (of 880), bends 11 → 2, the width the same.
- **A turn is the Unfurl's**: `controlsThrough` lays the bend's handles at it; a point the reader moves loses it
  (`placeBend`), and `clampedVia` keeps it.

- Site: `src/core/ui/connector-path.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `test/unit/a-line-sweeps-round-a-node.test.mjs`
- Site: `test/e2e/reforged-node-unfurl.spec.ts`

### T-a-graph-unfurls-when-it-opens

**A graph unfurls when it opens, unless a reader laid it out by hand** (Will, TODO 1000: "When a graph is loaded in the
canvas view it should get an unfurl applied once ready"; "Exiting Swimlane mode should apply an Unfurl to the graph,
also"; plan 1001 D4 A). One door, `unfurl()` in `bindWorkflow`, for a press, an opening and Swimlanes off.

- **The mark is a place**: `byHand` (graph-layout.ts) travels with the places, saves itself and never lights Save. A
  node's own place set (a drag, an arrow) or a group drag or an Arrange marks it; an Unfurl clears it
  (`place.byHand: false`). An agent's `unfurl: true` (TODO 958) still unfurls a graph, mark or not.
- **The opening is no step**: when nothing was done before it, the journal is cleared after it, so Undo never takes the
  graph back to how it was stored. Its places save themselves only where one changed (T5): an opening that moves
  nothing fires no `places-change`.
- **Not**: a page's Query (its lens lays it out), a body opened inside a node, a graph shown so that nothing moves; a
  preset (read only) unfurls for the tab alone (D3 B).
- **Swimlanes off unfurls**, as one Undo step with the lanes' going: both writes share a tag.
- **It opens where it reads** (Will, 1001c A, 2026-11-15): an open's fit (`openFit`: the first, the opening Unfurl's, a
  Custom Node's way in) goes no further out than `READABLE_ZOOM` (0.35). A graph wider than that opens at 0.35, its Start
  (inside a Custom Node, its Group Input) at the view's left middle. Fit and a zoom out by hand still show all of it
  (`canvas.fit()` with no `least`). A view its host or a reader moved after the graph opened is kept: the opening Unfurl
  lays the graph out, and fits only while the view is where it opened (`stillOpened`).
- **A spec whose graph must keep its own places says `byHand: true`**: it was laid out by hand. 31 specs say so.

- Site: `src/core/ui/node-graph.ts`
- Site: `test/unit/a-graph-unfurls-when-it-opens.test.mjs`
- Site: `test/e2e/reforged-a-graph-unfurls-when-it-opens.spec.ts`
