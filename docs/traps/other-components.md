# Traps — Other components

One of the eleven areas of [the traps](../TRAPS.md): each entry is here because its
first `Site:` is in this area (`npm run check:traps` holds it so). 65 entries.

### T-no-attribute-is-the-default-variant

**With no `data-nav-state` the rail is collapsed, and nothing writes the
attribute** (TODO 344: a default variant is the CSS's, never a write from TS).
The projected region puts Figma's PRIMARY mode, `default` (320px, open), on the
bare `:host`, but the rail RESTS collapsed. So the projector's navigation route
takes `unset: 'collapsed'`, and writes that mode's block as
`:host(:is([data-nav-state="collapsed"], :not([data-nav-state])))`; every
authored collapsed rule matches the same way. `unset` and the `.html` header's
`collapsed (default)` must name the same mode.

At rest the attribute is ABSENT. Read `nav.state`: a test that waits for
`data-nav-state` waits for ever.

- Site: `scripts/project-tokens.mjs`
- Site: `src/components/sherpa-nav/sherpa-nav.css`
- Site: `test/e2e/reforged-nav.spec.ts`

### T-the-nav-is-a-menu-on-a-phone

**On a phone the nav is a MENU, and it is the SAME `sherpa-nav`** — TODO 17b.
Below 768 px — the layout grid's own mobile mode — the shell hides
the rail with `visibility`, not `display` — a top-layer element under a
`display: none` ancestor is not drawn — and drops its inset; the header shows
a menu button right of the Context title, which asks (`nav-menu-request`) and
the SHELL opens the rail's `openMenu()`.

**The shell decides, and TELLS the header** (TODO 164). Each once read its own
width at 480 px, and the header is narrower than the shell by the rail: from
481 to 520 the button showed beside a rail that was still there, and a
desktop window, which stops near 500, never got the menu at all. Now the
shell's one query sets `--sherpa-app-header-nav-menu` on its header area, and
the button's `display` is that property — inherited, because a container
query cannot name a container across a shadow root with any certainty, and
an attribute would need JS. The header's FILTERS still go at its own 480. The nav then goes into the TOP LAYER
(`showPopover()` on its own host, so no containment or stacking clips it),
over the whole screen, open, with no Pin; Settings at the bottom and a Cancel
that goes nowhere. An Area only opens; a Context row closes it as it goes;
Escape closes it. One element in two presentations, so the rail and the menu
cannot disagree about the current row or an open Area.

**A page with no `<meta name="viewport" content="width=device-width">` is
drawn 980px wide on a phone**, so none of this ever shows — the test harness
had none, which the phone project found (2026-10-14). The starter and APP-GUIDE
carry it. `test/e2e/phone.spec.ts`, run by the `phone` project alone, checks
the menu, a dialog, a button's menu, the filter bar and a grid with a thumb.

- Site: `src/components/sherpa-nav/sherpa-nav.ts`
- Site: `src/components/sherpa-nav/sherpa-nav.html`
- Site: `src/components/sherpa-nav/sherpa-nav.css`
- Site: `test/e2e/phone.spec.ts`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.ts`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.css`
- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`
- Site: `src/components/sherpa-app-header/sherpa-app-header.html`
- Site: `src/components/sherpa-app-header/sherpa-app-header.css`

### T-a-second-container-type-drops-the-first

**`container-type: inline-size scroll-state` is ONE declaration, and an engine
that does not know `scroll-state` drops all of it** — the element is then no
container, and every size query on it is dead. The app header's did exactly
that in Firefox and WebKit: its 480 px rule (the filters go) never ran there,
found building the phone menu (TODO 17b). Write the plain type FIRST and the
pair SECOND, as a CSS function takes its longhand first
(`T-a-css-function-needs-its-longhand-first`): an engine keeps the last line
it understands. The shell and the grid use `scroll-state` alone, so they have
no size queries to lose.

- Site: `src/components/sherpa-app-header/sherpa-app-header.css`

### T-a-value-is-data-the-ticks-are-drawn

**`sherpa-select-group`'s value is its own DATA (`#picked`), and the child
boxes' ticks are drawn from it** — Will's "state first, then render" (TODO
113). It lived IN the boxes: a value set before `populate()` had no box to
tick, and every re-draw made new, unticked boxes, so both were lost with
nothing said. The setter stores and draws; `#render` draws again; a reader's
tick writes back. Until anything sets it, `#picked` is null and a SLOTTED
child's own tick is the answer, as before.

`sherpa-file-upload` does the same for each file's status line: kept by FILE,
so it survives the redraw an add or a remove makes, and follows its file when
a row above it goes.

- Site: `src/components/sherpa-select-group/sherpa-select-group.ts`
- Site: `test/e2e/reforged-select-group.spec.ts`
- Site: `src/components/sherpa-file-upload/sherpa-file-upload.ts`
- Site: `test/e2e/reforged-file-upload.spec.ts`

### T-a-disabled-button-acts-on-nothing

**A disabled `sherpa-button` refuses the click, as a native button does.** It
toggled `disabled` on its inner `<button>`, so a click on the inner control
did nothing — but a click on the HOST still reached every listener bound
there, and a menu's footer binds its Apply as `click` on the host. So Will's
calendar footer "looked inactive, yet they are still clickable and they work"
(TODO 83): paint, not behaviour.

A capture listener on the host stops the click while `disabled` — no host
listener, no ancestor, no `button-click`. Capture, because at the target a
capturing listener runs before every other, whoever bound it first. Since TODO
806 the inner button is `aria-disabled`, not native: its own clicks, and
Enter's and Space's, reach this listener too, and its `preventDefault()` keeps
a command from running (`T-an-inactive-button-keeps-its-tip`).

A test that pressed Apply on a menu it never OPENED only passed because of
this: a shut committing menu's footer is off (`dirty` needs `open`). Five tests
open their menu first now, as a reader must — and a draft set from code
(`values`, `condition`, `mode`, typed text) tells the footer too.

- Site: `src/components/sherpa-button/sherpa-button.ts`
- Site: `test/e2e/reforged-a-calendar-pick-wakes-the-footer.spec.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `test/e2e/reforged-grid-keeps-both-answers.spec.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `test/e2e/reforged-an-inactive-button-keeps-its-tip.spec.ts`

### T-calendar-anchors-where-the-data-is

`data-available` is a SET of ISO days, not a span. `data-min`/`data-max`
describe a range, which is the wrong shape for "only these days have records":
a column of order dates is a scatter, and a span would leave every empty day
between them selectable. Absent means EVERY day is selectable, and
`data-available=""` (empty, not missing) genuinely means none are.

The set also decides which month an UNPICKED calendar OPENS ON. Opening on
today when today holds none of the available days shows a grid where every cell
is disabled — nothing to click, and no hint the days are elsewhere. A chip
driven by such a calendar could never take a value at all, so it sat in the
amber "on but filtering nothing" state looking broken.

So the anchor is the LATEST available day: the most recent data, and the end a
reader usually wants. Stepping back from there is one click; finding a
populated month two years away is not. ISO strings sort chronologically as
text, so `max` is a plain string compare.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-slot-assigns-direct-children-only

`slot="header"` only assigns a **DIRECT CHILD of the slot's own host**. A node
one level deeper — inside the calendar, inside the menu — is never assigned,
which is exactly what happened: the projected month stepper existed, its
listeners worked, and it rendered NOWHERE.

So `#projectHeader` clones the light-DOM prototype into the PARENT element, not
into the calendar. The clone carries `slot="header"`, so a `sherpa-menu`
renders it in its own header region — the Figma Calendar node's first of three.
It is idempotent, because a re-render must not stack a second stepper.

That move splits the header across a shadow boundary, which is why `#headerEls`
returns a LIST rather than an element: a calendar has ONE header, but with
`data-embedded` it is a sibling in the parent rather than a descendant here, so
every listener and the label sync must reach either side. A list keeps both
cases on one code path instead of branching at each call.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-picking-stops-the-grid-following

`onChange` re-anchors the view to whatever value arrives. That is RIGHT for a
host setting one — the day should be on screen — and WRONG for the user's own
click, where the day is already on screen and moving to it moves everything
else.

The shipped bug: picking a start date in a RANGE calendar's right-hand month
scrolled that month to the left, so the days they were about to click as the
end were suddenly somewhere else. Stepping is theirs to do.

`#picking` is the one-bit guard, set only around `#pickRange`. It is cleared in
a `finally`, so an early return or a listener that throws still clears it — a
stuck flag would leave the calendar ignoring its host for good.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-two-months-share-one-grid

A RANGE calendar draws TWO months side by side — Figma's `Type=range`
(268:13874) is a 15-track grid: seven day columns, a divider, seven more. A
range is a span between two dates, and picking one whose ends fall in different
months through a single month that has to be stepped is the case the second
month exists for.

Both months go into **ONE grid**, not two, so every cell is a real `1fr` of the
same track set and the two halves cannot drift apart by a pixel.

Which means every cell must be PLACED explicitly. `#stampMonth` walks a `slot`
0..6 that wraps into the next ROW, and writes `gridColumn` (`column + slot`, 1
for the left month and 9 for the right, leaving track 8 as Figma's divider) and
`gridRow` on each. Left to auto-flow the two months STACKED: September's five
rows then October's five, **nine deep instead of five across**. A month with a
blank-led first week would also slide into its neighbour.

`data-two-up` is what CSS reads for the 15-track template, written on the GRID
and the caption row rather than the host — the month and year views share the
host and must be untouched by it. `Date` normalises December + 1 to January of
the next year on its own.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-cell-state-is-the-only-paint

`data-state` is `sherpa-calendar-cell`'s own API, mirroring the node's `State`
axis, and **the only thing the cell paints from**. `data-today` and
`data-selected` alone set no state, and the cell drew plain — which is why the
current month and the current year looked like every other one in the month and
year grids.

Both sets are written, and the reason is **not** the one this trap used to
give. It said the calendar's own CSS still reads the flags for those two grids.
Measured 2026-09-23: it reads **none** of them. `data-state` is the only paint
source anywhere, exactly as the heading says.

The flags stay because they are a **query surface**, which is a different job.
Eight assertions in `reforged-calendar.spec.ts` use them to count what the grid
drew, and each one is a single selector where `data-state` needs the values
OR'd:

```
[data-in-range]                                  one selector
[data-state="range-mid"], [data-state="range-start"], …   three
```

So: `data-state` PAINTS, the flags are read by TESTS, and no CSS reads the
flags. A flag that renders nothing is not automatically dead — check `test/`
and `../Sherpa Demos/app/` before removing one. Removing `.label` from `sherpa-tabs`
earlier in this same audit failed for exactly that reason.

Order is **TODAY first, SELECTED second** in all three grids, so a cell that is
both reads as selected.

The range half is THREE states where the node draws one: the two ENDS keep
their outer corners and square the ones that meet the band, so an end is
`range-start` or `range-end` and the band between is `range-mid`. A single-day
range is both ends at once, so it stays `selected` and fully rounded.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-describedby-must-not-be-a-live-region

`aria-describedby` is what makes the hint and the error text reach someone who
cannot see them beside the box. The ids are per INSTANCE, because two fields on
a page would otherwise both claim `#description` and a reader would be told the
wrong thing. Both ids are named, in reading order: the hint explains the field,
the error says what went wrong with it. An empty one is harmless — a
`describedby` pointing at empty text announces nothing.

**What is NOT there: `role="alert"` or `aria-live` on the message.** Putting
either on the element `aria-describedby` points at causes DOUBLE-SPEAK in JAWS
and NVDA — the live region fires, then the description fires again on focus —
and has been seen to make VoiceOver drop the association entirely. A live region
belongs on a form-level summary, once, on a failed submit.

`aria-invalid` is the other half of the announcement: `describedby` says WHAT is
wrong, `aria-invalid` says THAT something is.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`

### T-validate-on-blur-then-every-keystroke

Validation runs **on BLUR, not on every keystroke**. Telling someone their email
is wrong while they are still typing the `@` is nagging; telling them when they
leave the field is help.

Once a field HAS ERRED the rule inverts: `#onInput` re-checks on every
keystroke, so the message disappears the moment they fix it rather than
lingering until they leave the field. That is the whole condition —
`if (this.dataset['error'])`.

`#onInput` also re-syncs the FORM's copy of the value on every keystroke, so a
submit mid-typing sends what is on screen rather than what was there at the last
blur.

Inside `validate()`, **NATIVE CONSTRAINTS RUN FIRST**. `required`, `pattern` and
`minlength` are mirrored onto the real control and the browser already checks
them: it is free, it is localised by the browser, and a field with `required`
should say the browser's own "Please fill in this field" rather than a second
wording of our own. `data-rules` runs after, and is where a rule the platform
has no idea about goes.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`

### T-rules-are-named-not-carried

`data-rules` NAMES a rule set rather than carrying it: an attribute is a string,
and a rule is a function. Naming keeps the markup declarative while the rules
stay real code — and two fields checking the same thing share one definition
rather than two copies that can drift.

    SherpaInputText.defineRules('email', [required(), email()]);
    <sherpa-input-text data-rules="email">

An **unknown name is NOT an error**. A field naming a rule set the app has not
registered yet — script order, a lazy view — must stay usable rather than
refusing every value. The store's own guard is the line that has to hold.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`

### T-input-icon-sink-is-data-glyph

`#syncIcon` accepts either icon form, matching `sherpa-button`: a Font Awesome
CLASS LIST (`"fa-solid fa-magnifying-glass"`) or a raw CHARACTER (`"+"`).

Only the character path may go through `data-glyph`, whose CSS is
`content: attr(data-glyph)`. Handed a class list it printed the class list AS
TEXT — which is exactly what a menu's search field showed. The two components
took different forms until this was fixed, which is a trap for anyone composing
one into the other: the same attribute name meant two different things.

It is **NOT `SherpaElement.writeIcon`**, deliberately. `writeIcon`'s glyph sink
is `textContent`; this component's is the `data-glyph` ATTRIBUTE, because its
CSS draws the character with `content: attr(data-glyph)` (the
`.icon[data-glyph]::before` rule). Migrating would empty that attribute and the
raw-character icons would vanish.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`

### T-nav-state-writes-only-the-attribute

`#setState` writes `data-nav-state` and emits `nav-state-change`, and that is
ALL it does. Every transition funnels through it so the event fires exactly once
and the two header buttons stay in step with the attribute.

Two bugs came from breaking that:

1. **The `state` setter wrote the attribute directly.** `nav-state-change` then
   never fired, so the app-shell's content inset never moved and every host had
   to re-dispatch the event by hand. It goes through `#setState` now, so a host
   setting the mode is announced exactly as the rail's own pin and settings
   buttons are.
2. **The settings re-render lived in `#setState`.** A host that sets
   `nav.dataset.navState` by hand — which the example app does, to follow the
   URL — got no swap, and ended up in settings mode still showing the product
   tree. `onChange` owns that re-render now, so both paths behave the same.

`onChange` re-stamps on the SETTINGS EDGE ONLY. `#renderQuick` and
`#renderSections` had always branched on the mode, but nothing re-ran them when
the mode changed. The other four modes share one list, and re-rendering on every
hover would throw away each parent's expanded state.

SETTINGS shows a DIFFERENT list — its own pages, and NO quick items. Home /
Recent / Favorites are shortcuts into the PRODUCT tree, and settings is a
different place; offering them there would jump the user out of the section they
are configuring.

- Site: `src/components/sherpa-nav/sherpa-nav.ts`

### T-brand-icon-must-empty-its-host

`#applyIcon` is **NOT `SherpaElement.writeIcon`**, and this is the one place
that is correct.

`writeIcon` styles the element it is GIVEN. `.brand-icon` WRAPS a
`<slot name="icon">` holding a default `<i class="sherpa-icon-box" data-icon="group">`,
so adding classes to the wrapper would leave that fallback showing BESIDE the
real mark. The host must be emptied first, which is why this clones its child
from `template.brand-icon-tpl`.

A slotted icon still wins: `#renderBrand` applies the config's icon only when
the HOST has no `[slot="icon"]` child. It looked inside the wrapper, in the shadow
tree, where a slotted node never is — so the config's icon always won (found by
reading, 2026-10-15).

- Site: `src/components/sherpa-nav/sherpa-nav.ts`

### T-nav-search-uses-a-real-highlight

Typing narrows the rail to matching rows and highlights the matched text with
the **CSS Custom Highlight API** — a real `Highlight` of `Range`s, styled by
`::highlight(sherpa-nav-match)` — and a `<mark class="match">` around each hit.

Each row highlights its OWN label, through `sherpa-nav-item`'s `highlight()`,
adding its ranges to the one shared highlight; its `::highlight()` rule is in
that row's own sheet.

CSS owns the hiding; JS only marks the row with `data-filtered-out`. A section
with no surviving rows carries the same flag, so its label and rule hide too.

- Site: `src/components/sherpa-nav/sherpa-nav.ts`

### T-header-actions-are-composed-buttons

Every header action is a composed `sherpa-button`, exactly as Figma instances
them. Eight hand-rolled `<button>` elements with ~50 lines of CSS
re-implementing the component is precisely how the two drift apart.

So the listeners bind **`button-click`, not the native `click`**.
`sherpa-button` suppresses its own event when disabled, where a raw `click`
listener would still fire on the host element. The component's event is the
honest signal.

`ACTIONS` is listed in FIGMA'S ORDER (App Header 150:3690 `Actions` slot), so
the list reads like the bar does. There is no chat button — the code had
invented one.

- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`

### T-header-owns-the-filter-bar-surface

The quick-filter toolbar is slotted in the LIGHT DOM, so a host CAN reach it
with a `querySelector`. It should not have to: the header is what a view holds a
reference to, and a saved view that must know the toolbar's TAG NAME to set a
filter is a view coupled to this header's internals. So the header re-exposes
`values` — the toolbar's picks, or `{}` when no toolbar is slotted.

**PARITY.** Anything a reader can click here, a caller must be able to call — a
saved view, a deep link, a test, an agent with no pointer.

The `values` setter **REPLACES** the set: a chip the caller does not name is
switched off, because a view definition is a whole statement about the bar, not
a patch on whatever was showing before it. It is silent, like the toolbar's own
setter — the caller already knows.

`#stamp` never CREATES a child. The consumer must slot the empty host
(`<sherpa-breadcrumbs slot="breadcrumbs">`), and `populate()` only feeds it. A
child that has not upgraded yet has no `rendered` to wait on, so the registry
gets a turn first via `queueMicrotask` — see `T-custom-element-upgrade`.

- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`

### T-favourite-star-swaps-its-glyph

The favourite STAR's `data-favourite` attribute is the state and CSS paints from
it — but the GLYPH swaps too, outline → solid.

That is not decoration: the state has to survive for **anyone who cannot tell the
brand purple from the default ink**, so colour alone cannot carry it.
`aria-pressed` carries the same fact to a screen reader, which is why the star is
a TOGGLE button rather than a plain one.

Written as `fa-solid fa-star` and `fa-regular fa-star`, the two states swap
NOTHING: `iconName()` strips `solid` and `regular` as weight tokens before
resolving, so both spellings resolve to the one `star` drawing. The attribute
changes on every click and the path never does. The icons are Figma's, and the
set holds `star` AND `star-filled` as two separate drawings, so the fix is to
NAME them — in the star's markup, as a directive (`T-a-template-binds-by-markup`):

```html
data-icon-start="star" data-when-data-icon-start="data-favourite: star-filled"
```

A test that reads `data-icon-start` cannot catch this. The test reads the
rendered `<path d>`.

- Site: `src/components/sherpa-app-header/sherpa-app-header.html`
- Site: `test/e2e/reforged-app-header.spec.ts`

### T-an-expandable-row-is-not-a-destination

A nav row with children GROUPS them. It is not a page.

The whole row toggles — not only the chevron. A body that navigates would open
a view for `Favorites` or `Recent` the moment either carried an `href`, and put
the two behaviours a few pixels apart on the same row.

An expandable row also drops its `href` even when one is configured. A row
rendered as `<a href>` that goes nowhere lies to a middle-click, to "open in
new tab", and to a screen reader reading out a link.

This is a component rule, not a config convention, because a config can always
be written wrong: a row GAINS children at runtime (Favorites does, on the first
★) and must stop being a link at the same moment.

- Site: `src/components/sherpa-nav-item/sherpa-nav-item.ts`

### T-a-link-row-is-pressed-anywhere-in-its-box

**A nav row that is a link is pressed anywhere in its box, and goes where its link
goes** (TODO 800). The HOST is the row's box: its indent (32 px on a View row), its end
padding and its dot are the host's, not the `<a>`'s. The host hears every click and
reports `item-select`, so a press there lit the row (the nav sets `data-current-id`)
and named the header after it (the outlet), and navigated nowhere: the View chip and
the URL kept the old View. Measured 2026-11-05: a real press 10 px into the "My
accounts" row on Records lit it and headed the page "My accounts", the chip still on
All customers. The Demos flake (`reforged-nav-view-hierarchy.spec.ts:83`, up to 2 in 8
under load) left that same mark: both kept failures show the header named after the
pressed row, which only `nav-select` writes and any route after it rewrites. Not
caught live; a press while the opening rail (160 ms) is still narrow lands in the indent.

So the link's `::before` covers the box, behind the content (`z-index: -1` in the
host's isolated stack), and the dot takes no pointer. The label, the icon and a
trailing control keep their own presses; an Area, which has no destination, keeps
its toggle (`T-an-expandable-row-is-not-a-destination`).

- Site: `src/components/sherpa-nav-item/sherpa-nav-item.css`
- Site: `test/e2e/reforged-nav-item.spec.ts`

### T-advanced-checkbox-is-a-snapped-pair

`Checkbox - Advanced` is **two bordered boxes touching**, not one box with a
button beside it. Figma's own numbers say so:

| | corners | border left / right |
|---|---|---|
| `Wrapper - Checkbox` | `4 0 0 4` | 0.5 / **0.25** |
| `Button` | `0 4 4 0` | **0.25** / 0.5 |

Rounded on the outer edges, square where they meet, and **0.25 on each side of
the seam** — two halves of one hairline rather than two full strokes. Drop the
wrapper and you get a checkbox with a detached button, which is what the first
attempt shipped.

The wrapper is a real element with `.sherpa-border-edges`, and `.group` carries
`.sherpa-snap-group`. Three things about that are easy to get wrong:

**The joining is BY POSITION, not by `[data-snap]`.** That attribute is a plain
selector in `tokens.css`, which reaches the document and never a shadow root
(`T-datasnap-not-in-shadow`). It stays on each half as the honest description;
`.sherpa-snap-group` writes the four corner variables, and those DO cross a
shadow boundary — which is how the caret's inner `sherpa-button` gets its
square inner corner without a selector reaching into it.

**The `<slot>` must be OUTSIDE the group.** `.sherpa-snap-group > :last-child`
rounds the last child, and a slot sitting there took that role — leaving the
caret square on both edges and the pair looking clipped. The menu is a popover
in the top layer anyway, so it has no business in a layout group.

**The gap is 0 and FLUSH.** `--sherpa-structure-space-snapped` is an alias for
`space/none`; the seam is thinned by the two 0.25 weights, never by a negative
margin or an overlap. `T-two-snapped-tokens` says this and has had to say it
more than once.

A plain checkbox is untouched: `.box` is `display: contents` until
`data-advanced` is set, so the wrapper generates no box at all.

- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.css`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-calendar-view-is-not-the-figma-type

`sherpa-calendar` carries TWO axes that both look like "which calendar is this",
and only one of them is Figma's.

`data-type` (`single | range`) mirrors the Figma Calendar `Type` axis. `single`
holds one day in `data-value` as `YYYY-MM-DD`; `range` is a two-click
start→end selection holding `data-value-start` / `data-value-end`, with the days
between marked `data-in-range` and the two ends `data-range-end`.

`data-view` (`day | month | year`) is the CODE'S OWN zoom mechanism — the
equivalent of the Figma Calendar's Grid-collection swap, i.e. which grid the
component shows. It is **NOT** the Figma Type axis and is intentionally kept.
Clicking the header label zooms out (day → month → year); picking a month or
year zooms back in. The prev/next arrows then step by a month, a year, or a
decade to match. All three views share ONE cell template and CSS shows whichever
view is active.

`hasTime` (`data-has-time`) mirrors the Figma boolean and shows a native
`<input type="time">` in the footer; `data-value` then carries
`YYYY-MM-DDThh:mm` in single mode, while the grid still keys off the date part.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-range-header-names-both-months

A RANGE calendar draws TWO months, so its stepper label has to name both.

Stepping the header moves the PAIR, so a label reading only the left month would
say the wrong thing about half of what is on screen — and there is no second
header to correct it, because the two months share one grid (see
`T-two-months-share-one-grid`).

The year is stated ONCE when the two months share it, which is eleven months in
twelve: `January – February 2026`, and only `December 2025 – January 2026` at the
turn. Printing it twice every time reads as two separate calendars.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-embedded-footer-needs-a-public-verb

`sherpa-calendar.today()` is PUBLIC, and it looks like it should be private —
`#onToday` right beneath it does the work and nothing in this component calls the
public one.

The reason is EMBEDDING. When a calendar is embedded, the Today button is not in
this shadow root at all: it belongs to the HOST's footer, because Figma's
Calendar footer puts Today in the Container Footer's `left` slot. The host has to
be able to reach the behaviour, and the only alternative is reaching into private
state.

Same shape as `T-slot-assigns-direct-children-only` — an embedded calendar's
chrome lives on the other side of the boundary, so anything that chrome drives
needs a door.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-nav-item-writes-to-both-rows

A `sherpa-nav-item` template holds **TWO** activation rows — a `<button>` row and
an `<a href>` row — and CSS shows exactly one, via `:host([data-href])`.

So `this.$('.label')` / `this.$('.badge')` returns only the FIRST, which on a
LINK row is the HIDDEN `<button>` row. The bug it caused was invisible in the
best way: the visible badge stayed empty while a zero-width offscreen one held
the text, and `highlight()` appeared to do nothing on link rows because it had
marked the hidden label.

**Every write to a row's content goes to `$$`, not `$`** — the icon, the label,
the badge, the promo heading, the promo description, the `aria-current`, and the
search `<mark>`.

The one that CANNOT go through the shared `setAll` helper is the icon: icons are
Font Awesome class lists (`fa-solid fa-house`), so writing one as `textContent`
renders the class names. It goes through `writeIcon()` per element instead.

- Site: `src/components/sherpa-nav-item/sherpa-nav-item.ts`
- Site: `test/e2e/reforged-nav-item.spec.ts`

### T-custom-highlight-not-painted-in-shadow

`sherpa-nav-item.highlight()` uses **TWO** mechanisms for one search hit, and
that is deliberate — do not delete either.

1. **The CSS Custom Highlight API** — the right tool, and the one Will asked for.
   Every row adds its ranges to ONE shared `Highlight`, `sherpa-nav-match`, and
   its `::highlight()` rule is static, in `sherpa-nav-item.css`, so it is in
   every row's tree (TODO 344: no CSS built in TS).
2. **A real `<mark>` around the matched text** — the semantic element for a
   search hit, which assistive tech announces.

**Measured in TODO 344, reading pixels:** a custom highlight on text in a
shadow root now PAINTS in Chromium, Firefox and WebKit, and one shared
`Highlight` holding ranges from several shadow trees paints as well as one per
row. An earlier note said neither painted in Chromium 153; that is no longer
true. Both mechanisms stay: `<mark>` carries the meaning.

Both paint ONE tint, declared once in the CSS as `--_match-surface` and
`--_match-ink`.

`onDisconnect` takes the row's ranges out; the last row out deletes the shared
entry, so no orphan is left in the document-level registry.

- Site: `src/components/sherpa-nav-item/sherpa-nav-item.ts`
- Site: `src/components/sherpa-nav-item/sherpa-nav-item.css`
- Site: `test/e2e/reforged-nav-item.spec.ts`

### T-slider-second-thumb-is-revealed-not-built

`sherpa-slider` always holds **TWO** native `<input type="range">` elements, plus
two editable number fields. Range mode REVEALS the second of each; it never
builds one. So there is no `createElement`, and no template switch — the same
rule as `T-variant-attrs-or-one-way-door`.

Which input owns what:

- **single mode** — `#input` is the whole control; `#endInput` sits hidden,
  exactly as it always did. `--_pct-start` is written as `0%`, so the fill runs
  from the rail's head as it always has.
- **range mode** — `#input` owns the LOW end and `#endInput` the HIGH one.
  `#valueField` is the HIGH end's number field and `#startField` the low one's.

Every input is given the **SAME** `min`/`max`/`step`, so both rails map a
percentage to the same position and the two thumbs can be compared directly.
Both values are written even while one is being dragged, which is what keeps a
thumb from being pushed past its partner.

Each handler branches on `#isRange` ONCE rather than the template carrying two
sets, because the first input is the whole control in one mode and the low end in
the other.

The eight listeners are registered with the base class's `signal` instead of
eight paired `removeEventListener` calls — see
`T-abort-controller-per-connect`. There is then no teardown list to keep in step,
and nothing to forget when a ninth is added.

- Site: `src/components/sherpa-slider/sherpa-slider.ts`

### T-range-reads-ordered-but-drags-clamped

`sherpa-slider`'s two ends are handled **DIFFERENTLY** on the way out and on the
way in, and the asymmetry is the point.

**Reading `range` ORDERS the pair, low first**, whichever way the user dragged: a
range whose start is above its end is not a range, and every consumer would
otherwise have to sort it again. An ABSENT end defaults to the corresponding
bound, so a half-set range reads as "everything from here" rather than as a
broken one.

**Dragging CLAMPS the ends against each other rather than swapping them.**
Dragging the low thumb past the high one stops it AT the high one. Swapping would
hand the user a thumb they are no longer holding, and the pointer would carry on
moving the other end.

So `set range` sorts, and `#setEnd` clamps — they are not two spellings of the
same thing and must not be collapsed.

- Site: `src/components/sherpa-slider/sherpa-slider.ts`

### T-num-is-stricter-than-parsefloat

`sherpa-slider`'s `min`/`max`/`step` go through `num()`, which is **STRICTER**
than the `parseFloat` they used to use: `parseFloat('12px')` reads 12, `num()`
rejects it.

That is deliberate. A bound that is not a number is an AUTHOR ERROR, and quietly
reading half of it hides the mistake. These are native attribute names
(`min`/`max`/`step`), un-prefixed per the naming contract.

A `step` of 0 or less FALLS BACK to 1 rather than clamping: it cannot advance the
slider at all, and clamping would silently pick a step the author never named.

- Site: `src/components/sherpa-slider/sherpa-slider.ts`

### T-never-fight-a-focused-field

A `sherpa-slider` number field is **LEFT ALONE while it is focused**, and a
part-typed value is ignored until commit.

`#put()` returns early when the element is `shadowRoot.activeElement`, so a sync
can never rewrite what someone is in the middle of typing. `#partial()` treats
`''`, `'-'` and anything ending `'.'` as an intermediate state and skips the
`input` handler entirely — otherwise typing `-12` clamps to the minimum at the
`-`, and typing `1.5` clamps to 1 at the `1.`.

The COMMIT handler (`change`) then SNAPS the field to whatever the clamp settled
on, because the typed number may have been below the range's low end or outside
the bounds entirely. That snap is the only place a focused field is written.

- Site: `src/components/sherpa-slider/sherpa-slider.ts`

### T-select-card-keeps-both-footer-controls

A `sherpa-select-card` footer holds **BOTH** pre-placed select controls — a
`sherpa-select-radio` AND a `sherpa-select-checkbox` — and CSS shows exactly one,
off `data-select-mode` (radio by default, checkbox for multi-select).

`#syncControl()` mirrors the card's `name` / `value` / `disabled` / `checked`
onto **both**, not just the visible one. Keeping both in step means switching
`data-select-mode` never surfaces a STALE control. When a consumer slots their
own footer there are no `.footer-control`s at all, so the whole method is a no-op
and that control is theirs to wire — the card still reports selection through its
`change` event.

**Radio cards group as radios do**: `radioGroup()`, by HTML's rule — the same
tree, form and `name` (T-radios-in-shadow-roots-are-not-one-group). A
checkbox-mode card is not a member. Document-wide, as it was, reached across
forms and missed a shadow root.

`#toggle()` follows the semantics rather than the attribute: a RADIO card's
toggle means "select" — you cannot unselect one by re-clicking — while a CHECKBOX
card flips. The host's `role` and `aria-checked` follow the mode and the state
for the same reason.

**Both footer controls are `inert`.** The CARD is the control — the host has
the role, the tab stop and `aria-checked` — so a live radio inside it is a
control nested in a control, and an unnamed one. They only SHOW the state; a
press on one falls through to the card. TODO 117.

- Site: `src/components/sherpa-select-card/sherpa-select-card.ts`

### T-a-click-does-not-clear-indeterminate

`indeterminate` is a **JS-only property**. A user's click flips `checked` and
leaves `indeterminate` exactly as it was — the browser does not clear it.

So a mixed checkbox the reader clicked became `checked: true, indeterminate:
true`, and CSS draws the dash over the tick: the box still said "some" the
moment after the reader said "all". Measured on the live inner input, before and
after.

`sherpa-select-checkbox` carried a comment saying "native toggling clears
indeterminate", which is the opposite of what happens. It removed only the host
ATTRIBUTE, and CSS selects `:indeterminate` on the PROPERTY — so the attribute
went and the dash stayed.

The component now clears both in its own change handler, because a user's click
is exactly the gesture that ends the mixed state.

- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.ts`

### T-a-host-cannot-hold-aria-expanded

A `sherpa-button` that opens a menu keeps `aria-expanded` on its INNER
`.trigger`, because that is the real `<button>`. An author who writes
`aria-expanded="false"` on the HOST creates a second, frozen copy — and the host
is what a screen reader meets first, so an open menu announces as closed.

Measured on `sherpa-chart-legend`'s breakdown control: host `"false"` while the
inner trigger read `"true"`.

The button now strips a host-level `aria-expanded` when its menu toggles, and
the template that wrote one no longer does. `sherpa-quick-filter-toolbar` had it
right already — it sets `aria-haspopup` on the host (a static fact) and leaves
`aria-expanded` to the button (a changing one).

`sherpa-container-header` keeps a host `aria-expanded` and is NOT this trap: its
own TS maintains it, and it is a collapse toggle rather than a menu.

- Site: `src/components/sherpa-button/sherpa-button.ts`

### T-an-accordion-action-is-not-a-toggle

`sherpa-accordion`'s `actions` sit on its header row, and a click on one must
NOT open or shut the disclosure.

**They are OUTSIDE the `<summary>`** (TODO 406, Will asking for the View's Apply
on its header). A `<summary>` is a button, and a button may not hold buttons:
axe reports it (`nested-interactive`), the last structural failure in the
accessibility baseline once (TODO 117). The slot was inside it, with a
`preventDefault()` so a press did not flip the accordion too. Now the host is a
GRID: the `<details>` fills it, and the actions are a grid item laid over the
header row before the chevron; the titles leave them their measured room
(`--_actions`, from a ResizeObserver). A press is the control's alone. A host
whose header is sticky makes `::part(actions)` sticky too, or the header
scrolls over them (the filter panel does).

---
- Site: `src/components/sherpa-accordion/sherpa-accordion.ts`
- Site: `src/components/sherpa-accordion/sherpa-accordion.css`
- Site: `src/components/sherpa-accordion/sherpa-accordion.html`

### T-an-accordion-chevron-rides-the-heading-row

`sherpa-accordion`'s summary is ONE heading row, in an even padding — Will,
2026-10-26 (TODO 471): the chevron, icon and badge each centre on the heading's
LINE, and a description is the row under it, flush with the heading. So the
row is `align-items: start` and each glyph's margin centres it in that line.
(On 2026-10-22 Will had chosen the centre of the whole header, which put the
chevron halfway down a two-row one; 471 replaced it. A one-row header reads
the same either way.) The actions, outside the summary (TRAP
`T-an-accordion-action-is-not-a-toggle`), sit in a box exactly one heading line
tall, so a taller control overflows it evenly and stays on the heading's row.

The chevron keeps its OWN drawn size and centres itself within the heading's
line height. Setting `block-size` on it instead made it 20px and broke the
icon's own contract — `T-icon-box-is-not-the-glyph`.

---
- Site: `src/components/sherpa-accordion/sherpa-accordion.css`
- Site: `test/e2e/reforged-accordion.spec.ts`

### T-a-click-in-a-slotted-menu-is-not-a-press

`sherpa-button` opens a `slot="menu"` child on click. That menu is a LIGHT-DOM
child, so every click inside it BUBBLES to the button — which read each one as
a second press and shut the menu.

So the button ignores a click whose composed path includes its menu. Half of
the "Add filter closes when I click a row" bug was here; the other half was
`T-a-slotted-row-is-outside-its-own-popover`, and each one alone still closed
the menu.

---
- Site: `src/components/sherpa-button/sherpa-button.ts`

### T-the-shell-owns-the-panel-areas

`sherpa-app-shell` has `panel-start` and `panel-end` slots beside the Context.

A panel is APP CHROME: it survives a Context change, and where it sits beside
the content is the shell's question, not each Context template's. Before this
the filter panel lived inside `records.html`, wrapped in a `sherpa-stack` that
every other Context would have had to copy.

**The areas are `sherpa-layout-panels`'** (TODO 796, `T-a-panel-area-is-a-layout`):
the shell's body is one, its two slots forwarded into the layout's, so the
canvas's card docks by the same code. The shell hands it the widths and the
room, and reports an area's resize as its own; the parts `panel-start`,
`panel-end` and their edges are the layout's, exported.

**An empty area takes NO room**, so a Context that slots neither is exactly as
it was.

**A docked panel is FLUSH, and the row has no inset** (Will, TODO 796: "A docked
panel should be flush with the top, left, and bottom … There should be no shadow
either"). `.sherpa-grid` already applies `--sherpa-layout-grid-padding`, so
padding the row insets the Context twice. The area used to carry that inset
(16px top and bottom, 8px each side) so the panel's card lined up with the cards
beside it; now the panel fills its area, from the header to the window's foot,
with no edge, rounding or shadow of its own, and the area draws the divider. The
Context's own grid keeps its 16px from it.

**An area is THREE grid columns wide.** Will, 2026-09-26. Worked out in CSS
from the grid's own tokens — the column the body row would hold, `(100% − pad
− (cols − 1) × gap) / cols`, times three, plus two gutters and the area's own
inset — so the panel card measures exactly a 3-column card of the page with
the panel shut (294 / 374 / 454 at 1280 / 1600 / 1920). The Context keeps its
own grid in what is left: narrower, never re-counted. `--sherpa-panel-area-width`
still overrides it. It had been a 400px fallback, as the token was defined
nowhere.

**…and never under 464px** — Will, TODO 163: *"Increase the min width of panel
areas … to 150% of their current min width."* The area has no min of its own;
its narrowest is the 310px it is at 1280, where a panel first shows, and 150%
of that is 465, 464 on the 4px grid. Flush, the panel is 464 at 1280 and at
1600, and the three columns take over near 1900. It is a MIN, not the width: the
first build multiplied the width at every size, and Will sent it back.
`--sherpa-panel-area-min-width` overrides it, and `--sherpa-panel-area-max-width`
the 33% ceiling.

- Site: `src/components/sherpa-app-shell/sherpa-app-shell.css`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.html`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.ts`

### T-a-panel-area-is-a-layout

**ONE panel-area layout, `sherpa-layout-panels`, which the app shell's body and
the canvas both compose** — Will, TODO 796: "A docked panel should be flush with
the top, left, and bottom … no shadow either", and "a dedicated panel area system
like the layout grid to reuse functionality". A start area, one content cell, an
end area. Plan: `docs/history/plan-796-panel-areas.md`.

- **The AREA owns the width and the divider.** A docked panel fills it flush (a
  grid item stretches, so a host needs no `::slotted` sizing), and drops its own
  card edge, rounding and shadow while docked: the overlay panel fixed in an area,
  the node panel, the filter column. The divider is the area's `::after`, drawn
  over the panel's last pixel, so the panel keeps the area's whole width. The
  knobs: `--sherpa-panel-area-width` (three layout-grid columns), `-min-width`
  (16rem) and `-max-width` (33%).
- **The area follows its panels' width** (Will, TODO 858). No width of its own: it is as wide as its widest open panel (the panel's
  `--_width`, 24rem by default, which an overlay also uses, so the width carries across a dock) plus the 16px inset each side;
  empty, shut or every panel a tab, it takes nothing. A reader's drag or a host's `data-panel-<side>-width` asks for one, held
  as `--_asked-<side>` and handed to the panels. The panel is `contain: inline-size` so its content never sets the area's width.
- **The two areas SHARE the room** (Will, TODO 873). The areas `flex-shrink`, and the content keeps its least width,
  `--sherpa-content-min-width` (24rem): a start and an end panel together never starve it, whichever is the wider, and
  the shrink is the one rule for the shell's body and the canvas, as both compose this layout. A room under what the
  content and one area need is the host's `data-no-room` (the grid's 728 tablet band), not this rule's.
- **Forwarded slots.** A host's slot is slotted into the layout's
  (`<slot name="panel-start" slot="panel-start">`), so the layout reads its panel
  with `assignedElements({ flatten: true })`, and a `::slotted` rule there matches
  the host's SLOT, never the panel. The forwarded slot's `slotchange` reaches the
  layout's slot: its path runs through the slot it is assigned to.
- **Open.** An area shows while its panel is open: an element with an `open`
  property by that attribute ALONE (an overlay panel, a filter column); any other
  while it is neither `hidden` nor `display: none` in its own style (the Nodes
  card, or one a page hid so). Never by its computed style: WebKit keeps a column
  opened late at `display: none` under the shut area, so the area waited on it
  for ever (measured: Chromium and Firefox recompute it). It hears `open`,
  `hidden`, `style` and `data-floating`, and again once an un-upgraded panel is
  defined, as it has no `open` until then.
- **Floating, the panel stays slotted**: its area takes no width and covers the
  whole layout, the panel's ROOM, with its clicks passing through but on the
  panel's box. A slotted box cannot float out of a hidden area. `roomOf()` in
  `float-box.ts` finds the layout up the flat tree. The overlay panel floats as
  before, by leaving its area for the window.
- **No stacking context** on the host or a floating area, so a floating box's
  z-index meets the panels beside the layout (`T-a-pressed-panel-comes-to-the-front`).
  A DOCKED area is `z-index: 1`, so it paints over a view drawn under the layout.
  A STRIP of tabs is `auto`: the area is a flex item, and a flex item with a
  z-index is a stacking context even unpositioned. At 1, a panel peeking from
  its tab (101) was held in it, under the shell's fixed region (2) and its
  sticky metric group (measured 2026-11-10, Records, Chromium).
- **The room rule is the host's**: the shell's tablet rule reads `areaMin()` and
  hands back `data-no-room` (`T-the-panel-is-desktop-only`). The canvas has none.
- **The canvas's view runs UNDER the layout** (`T-a-canvas-owns-its-view`): the
  plane never moves as the card docks, floats or is resized.
- The start area is first in the tab order, as it is drawn first.

- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.ts`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.html`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.css`
- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.ts`
- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.html`
- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.css`
- Site: `test/e2e/reforged-layout-panels.spec.ts`
- Site: `test/e2e/reforged-app-shell.spec.ts`
- Site: `test/e2e/reforged-panel-areas-share-the-room.spec.ts`
- Site: `test/e2e/reforged-panel-areas-follow-their-content.spec.ts`

---

### T-a-row-span-is-keyed-by-value

`sherpa-container`'s height rule lists its values in the selector. A bare
`:host([data-row-span])` with a `var(--_rows, 6)` fallback looks equivalent and
is not: any value the value-rules do not name falls through to the default and
renders a 6-row card, silently.

Two live bugs came from that, both measured at 464px where 6 rows is 464px:

- `data-rows="5"` in a saved view (`dashboard-views.js`) — 5 was never a
  declared value, so a card meant to be 384px tall drew 464px for months.
- `data-rows="fit"` — the GRID's row MODE landed on a container, matched the
  bare selector, and became a 6-row card. The names no longer collide: the
  grid keeps `data-rows`, the container took `data-row-span`.

The `props` declaration cannot catch this. `kind: 'style'` means CSS selects on
it and the base class writes nothing, so nothing validates the value at runtime.
The selector IS the validation.

So the set is every integer from 1 to 12 — in the container, in the grid's
`data-row-span` and `data-row-count` (generated by a loop in
`project-tokens.mjs`), and in both props lists. It skipped 7, 9 and 11 until
TODO 177: a dragged height can be any whole number of rows.

- Site: `src/components/sherpa-container/sherpa-container.css`
- Site: `test/e2e/reforged-container-rows.spec.ts`
- Site: `test/e2e/reforged-layout-grid.spec.ts`

### T-fit-is-a-desktop-mode

`data-rows="fit"` applies from 1280 up and nowhere else.

At tablet and mobile a view is READ BY SCROLLING: pinning it to the fold would
squeeze every card on the way down, and the one that takes the remainder would
sit at its floor with everything above it crushed. Below the breakpoint the
rule simply does not apply, so the grid behaves as the default does.

Below it, `data-row-count` does nothing on a fit grid — the equal-row rule
skips it. Applied, every `1fr` row would grow as tall as the tallest card.

- Site: `scripts/project-tokens.mjs`
- Site: `test/e2e/reforged-layout-grid.spec.ts`
- Site: `src/components/sherpa-layout-grid/grid-resize.ts`

### T-a-fit-grid-needs-its-row-count

A grid item can never be taller than its ROW, so filling the remainder means
the LAST row must be `1fr` — and CSS has no way to name the last auto row. So
the count is AUTHORED: `data-row-count` counts every row, the last included,
and the grid is `repeat(count - 1, row-height) 1fr`.

Every row is one `size/row` tall — one metric — and every child states its
spans. Nothing is measured, so no child's content can size a row.

**It was measured until 2026-09-24, and that was the bug.** JS counted the
distinct TOPS above the filler. A card spanning six rows has ONE top, so on
Records the count came back 2 where the rows were 7: the `1fr` row fell inside
the charts, they took the slack, and the last card dropped into an implicit
`auto` row and hugged its content.

Seven shapes were measured before the count existed. Every one failed:

| tried | result |
|---|---|
| `grid-auto-rows: min-content` | filler 18px — a min-content row cannot grow |
| `grid-auto-rows: auto` | 242px — every row splits the slack equally |
| `grid-auto-rows: minmax(64px, auto)` | the same 242px |
| `grid-auto-rows: min-content 1fr` | the pattern REPEATS — right only on an even row |
| `grid-row: sibling-index() / -1` | supported, but that is a CHILD index: four metrics on one row make index 5 = row 2 |
| `align-self: stretch` + `height: 100%` | 18px — it stretches WITHIN its own row |
| flex-wrap, spans as basis | 242px — `align-content` splits between LINES |

`repeat(calc(n - 1), …)` works in all three engines. `repeat(0, …)` does not —
it drops the whole template — so a count of 1 is its own rule.

A DRAGGED fit grid counts its own rows (`T-a-fit-grid-counts-its-resized-rows`),
and a test fixture must still state every card's rows: without them the
filler lands in row 3 of 5, not the last.

- Site: `scripts/project-tokens.mjs`
- Site: `src/components/sherpa-layout-grid/grouped-grid.ts`
- Site: `test/e2e/reforged-layout-grid.spec.ts`
- Site: `test/e2e/reforged-layout-grid-resize.spec.ts`

### T-a-fit-grid-needs-a-sized-parent

`block-size: 100%` needs an unbroken chain of sized ancestors, and an app
shell built to SCROLL does not have one.

`sherpa-app-shell` had `min-block-size: 100vh` on its frame, so the shell GREW
with its content; a view's `100%` then resolved against that growth — 1809px
inside a 900px area — and a fit grid had nothing to measure.

Will's ruling: **the shell always fits the viewport; the CONTENT decides
whether it scrolls or fits.** So the frame caps at `100%`, `.view` passes the
height through, and a scrolling view simply overflows `.content` as it always
did. There is no `data-fit` on the shell — that put the choice at the wrong
level.

`.content` is a FLEX COLUMN, which is the half that is easy to miss: as a
plain block, a `block-size: 100%` view took the whole scroller and started
BELOW the 120px sticky header, so it ran a header's height past the fold.
`.view` takes what the header leaves instead.

**And the slotted Context must GROW to fill its frame** (`.context-frame
::slotted(*) { flex: 1 1 auto; min-block-size: 0 }`). Left at its content's
height, a fit grid's `100%` measured the CONTENT: the Records card was 586px
with ten rows and 632px with fifty, and the pager moved with it. The rule was
dropped when the scroller moved to `.context-frame` (142) and nothing failed,
because every test page was taller than its frame. Will, TODO 153.

- Site: `src/components/sherpa-app-shell/sherpa-app-shell.css`
- Site: `test/e2e/reforged-layout-grid.spec.ts`
- Site: `test/e2e/reforged-app-shell.spec.ts`

### T-a-trigger-shows-what-it-opened

A button that opens something and goes on looking closed reads as broken.

`sherpa-button` already draws `data-open` — the accent ring — for a menu it
OWNS as a slotted child. The header's notifications panel is not that: it lives
in the HOST, beside the header, so nothing inside the component could know it
had opened. The bell opened a panel four times a day and never once said so.

The fix is the system's own convention, not a new mechanism: `data-*` carries
state IN, an event carries intent OUT. The header emits `notifications-open`;
the host owns the panel, so the HOST sets `data-notifications-open` back, and
the header mirrors it onto the button it owns.

```js
appHeader.addEventListener('notifications-open', () => panel.toggle(bell));
panel.addEventListener('menu-open',  () => appHeader.toggleAttribute('data-notifications-open', true));
panel.addEventListener('menu-close', () => appHeader.toggleAttribute('data-notifications-open', false));
```

**Look for this wherever a trigger and its surface are separated.** The state
belongs to whoever owns the surface, and the trigger has to be told.

- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`
- Site: `src/components/sherpa-app-header/sherpa-app-header.html`
- Site: `test/e2e/reforged-app-header.spec.ts`

### T-scroll-state-is-chromium-only

`container-type: scroll-state` and `@container scroll-state(stuck: top)` are
**Chromium only**. Measured in all three engines 2026-09-23: Firefox and WebKit
drop the property and report `containerType: "normal"`.

`sherpa-app-header` uses it, where it is itself in a scroller, to take a drop
shadow once content slides underneath, with no JS. That degrades correctly —
the header is still `position: sticky`, still `z-index: 1`, still opaque, in
every engine. Only the shadow is missing. The data grid's pinned edges use
`scrollable` the same way.

A test must not assert the property in every engine. Assert that the guard
and the engine AGREE:

```ts
expect(containerType.includes('scroll-state')).toBe(CSS.supports('container-type', 'scroll-state'));
```

That catches Chromium losing the feature as well as an engine gaining it,
which a hardcoded expectation cannot.

In the APP SHELL the header is no longer in the scroller, so it is never
stuck: the shell draws the shadow another way (`T-only-the-context-scrolls`).

- Site: `src/components/sherpa-app-header/sherpa-app-header.css`

### T-only-the-context-scrolls

**In `sherpa-app-shell` only the CONTEXT scrolls. The header and both panel
areas stay where they are** — TODO 142, Will: the filter panel area
"shouldn't scroll with the other page content … it needs to be outside of
that scrollable wrapper". `.content` was the scroller, holding the header
(sticky) and the body row — panels and Context together — so a long page took
the filter panel up with it. The scroller is `.context-frame` now. The DOM
did not change: `.content` is `overflow: hidden`, a column of the header and
the body row, and each panel area fills the row's height and scrolls inside
itself.

**The header casts no shadow** (Will, TODO 401): the frame shows an inner
scroll shadow instead, while the shell has `data-scroll-shadow`
(`T-a-scroll-shadow-is-drawn-over-the-content`). Before, the header followed
the frame's scroll timeline through `timeline-scope`.

**A scroll-driven animation never FINISHES.** `__settled()` waited for every
animation's `finished` promise, and every test on a page with this one hung.
It waits for animations on the document's own timeline only.

- Site: `src/components/sherpa-app-shell/sherpa-app-shell.css`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.html`
- Site: `test/e2e/reforged-app-shell.spec.ts`

### T-a-grid-group-needs-css-if

`.sherpa-group-grid` computes each cell's column and row in a VALUE, then picks
its edges with CSS `if()` and `style()` queries. `if()` is **Chromium and WebKit
only** — Firefox has none.

`sherpa-grouping.css` already handles this, and says so beside the gate: *"The
`@supports` gate is for `if()`; without it every cell keeps the outer box below,
which is correct, just not joined."* So in Firefox a grid draws six separate
boxes rather than one joined block. That is the intended fallback, not a bug.

A ROW or a COLUMN group does not need `if()` — those use `:first-child` /
`:last-child` — which is why only the two grid tests failed.

The tests now branch on `CSS.supports('width', 'if(style(--x: 1): 1px; else: 2px)')`
and assert the documented fallback where it is absent, rather than asserting the
joined result everywhere.

- Site: `test/e2e/reforged-grouping.spec.ts`
- Site: `src/components/sherpa-group/sherpa-group.css`
- Site: `test/e2e/reforged-group.spec.ts`

### T-an-icon-is-known-by-the-set-not-its-spelling

Ask `hasIcon(value)`. Never test the string's SHAPE.

`sherpa-nav`'s `#applyIcon` decided with `/\bfa-/`: a value containing `fa-`
was an icon, anything else was a raw glyph character to print as text. That
worked for exactly as long as every icon name carried the prefix.

When the names were migrated to the Figma set — `fa-solid fa-cubes` → `group` —
every name failed the test and fell through to the text branch. The nav's brand
tile printed the word **"group"** where the product mark should be.

**Nothing failed.** No error, no empty box: a name is a perfectly valid string
to render as text, so the wrong branch produced a plausible result. Will found
it by looking at the running app.

The set is the only authority on what is an icon:

```ts
if (hasIcon(value)) { renderIcon(box, value); }
else { host.textContent = value; }   // a raw glyph — an emoji, a letter mark
```

`SherpaElement.writeIcon` already had this shape, which is why only the one
hand-rolled copy broke. `#applyIcon` cannot simply call `writeIcon` — see
`T-brand-icon-must-empty-its-host` — but it can ask the same question.

Covered by a test that renders both branches: a name must paint an SVG and
leave no text, and `★` must stay text.

- Site: `src/components/sherpa-nav/sherpa-nav.ts`
- Site: `test/e2e/reforged-nav.spec.ts`
- Site: `test/e2e/reforged-icons.spec.ts`

### T-a-document-rule-outranks-an-adopted-host-rule

A DOCUMENT class beats an adopted `:host` rule, at any specificity. Measured
both ways: a `.doc-rule { column-gap: 16px }` in the page wins over
`:host { column-gap: 99px }` in an adopted sheet, and still wins when the
adopted rule is tightened to `:host(.doc-rule)`.

This is the twin of `T-a-document-class-cannot-reach-a-shadow-root`, in the
other direction: a document rule reaches the HOST of a shadow root perfectly
well, and outranks what that root adopts.

`sherpa-layout-grid` hits it because its tracks come from `.sherpa-grid` in the
generated `tokens.css`, which names the element. `data-grouped` therefore cannot
set `column-gap: 0` from the component's own sheet. It re-points what the
document rule READS instead:

```css
:host([data-grouped]) {
  --sherpa-layout-grid-gap-horizontal: 0px;
  --sherpa-layout-grid-gap-vertical: 0px;
}
```

A custom property inherits, so the document rule resolves it at the host and
the gutters go. Whenever a document rule selects a host, the property is
the only lever it has.

- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.css`
- Site: `test/e2e/reforged-layout-grid.spec.ts`

### T-a-canvas-owns-its-view

**An infinite canvas OWNS its view — the pan and the zoom — as a grid owns
its scroll, and REPORTS each move** (`canvas-change { x, y, zoom }`). Will,
TODO 25. A host that must set it uses `panTo`, `zoomTo`, `fit()` or
`data-zoom`; the canvas writes `data-zoom` back, rounded to three places,
and a change to the value it just wrote is not heard as a host's.

- **The view is three custom properties** on the host — `--_x`, `--_y`,
  `--_zoom` — and everything that moves reads them: the plane's transform,
  the crosshair grid's mask position and size. The grid is a MASK over a
  token colour, so the crosses follow the theme.
- **Content says where it sits** with `--x` and `--y` on the plane — CSS,
  no JS placement.
- **A drag pans only off the content**, unless the Pan tool is on
  (`data-panning`, which also turns the content's own pointer events off) or
  it is the middle button. Ctrl or ⌘ with the wheel — a trackpad's pinch —
  zooms about the pointer; a plain wheel pans.
- **The keys are the view's own.** The canvas hears them only when the view
  itself has focus: a key in the content — a node's arrows, a `-` typed in a
  field — never pans or zooms it.
- **The minimap is PART of the canvas.** A second element would be a second
  owner of one value. It is scaled to the CONTENT alone, which takes half the
  map, in its middle: a zoom resizes the frame, and the content on the map
  holds still (Will, TODO 549). Scaled to the box round the content AND the
  view, the content shrank as the reader zoomed, and the map ran away under a
  dragged frame. It redraws when a piece's `style` changes, as a moved piece
  says where it is there. A press puts the view's middle there; a drag on the
  frame keeps its hold, and stops at the map's edge — or, for a frame larger
  than the map, keeps the map covered.
- `setPointerCapture` throws on a synthetic pointer in Firefox; both drags
  catch it and follow the pointer's own events.
- **Banners float in their own slot, `banner`** (Will, TODO 766): across the
  top, 32px in, beside the panel card, so they never pan, zoom or cover it. A
  hidden one takes no room. The slot comes before the view in the template, so
  a notice is read and reached before the content; the card, drawn first, is
  first of all. So the content's slot is `slot:not([name])`: a bare `slot`
  query found the banners', and the minimap and Fit measured the banners. And
  before the view, it would paint under it: it is lifted (`z-index: 1`).
- **The card's panel area** (TODO 796, `T-a-panel-area-is-a-layout`): the canvas
  composes `sherpa-layout-panels`, its `panel` slot forwarded into the start
  area, where the card docks flush, 18rem wide, its edge resizing it. The banners
  and the STAGE (the minimap, the controls) stack in the layout's one cell,
  beside the card. The VIEW is the whole canvas, UNDER the layout: nothing
  between it and the layout is positioned, so the layout is its box. So the
  plane never moves when the card docks, floats or is resized, and the node
  code's client-to-plane maths (from the canvas's box) holds. Fit, a zoom's
  centre and the minimap's frame read what the view SHOWS: the stage's box.
- **The toolbar is centred on the CANVAS, never over the card.** Centred beside
  the card, an inspector open on the right edge covered Save at 1600 (746 E4).
  Its row spans the canvas with a padding each side of where the stage begins
  plus 32px, `justify-content: safe center`: centred where it fits, past the card
  where it does not. The canvas MEASURES that start (`--_seen-start`, by a
  ResizeObserver on the stage) where the old `--_beside` sum guessed the card's
  width, which a dragged edge would break. Beside a card (`:state(beside)`) the
  minimap sits at the end over the controls; under 44rem of stage, both rise a
  toolbar row.
- **It makes no stacking context**: no `isolation`, no `container-type` on the
  host (the stage is the container), so a floating card's z-index meets the
  panels beside the canvas (`T-a-pressed-panel-comes-to-the-front`). The view
  isolates its own content, and the host clips all it holds.

- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.ts`
- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.html`
- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.css`
- Site: `test/e2e/reforged-layout-canvas.spec.ts`
- Site: `test/e2e/reforged-layout-canvas-banner.spec.ts`

### T-a-scaled-hairline-paints-past-its-box

**Every piece on the canvas's plane wears a clear ring one screen px wide or
more** (`box-shadow: 0 0 0 var(--_ring) transparent`, in the canvas's
`.plane ::slotted(*)`), because Chromium paints a ROUNDED hairline past its box
and repaints only the box when it moves. TODO 799, measured 2026-11-05.

- **What showed**: in Chromium only, a faint empty box where a moved node was:
  a drag, Arrange or Frame. It is one device px row or column just outside the
  old box, top, end and bottom, in the border's ink at about 12% (246,246,248 on
  white). The new place lacks the same line until something repaints it.
- **Why**: a node's border is 0.5px, drawn 1px, and the plane scales it. Under 1,
  it is thinner than a device px, and Chromium widens a thin ROUNDED stroke to
  one device px about its middle, so a quarter of it lands outside the box. A
  square border is drawn as rects and does not bleed. A move repaints the node's
  box (its visual rect) and no further, so the bled pixels stay.
- **Measured** in the harness (a 0.5 zoom, a pixel-aligned pan): 128 to 183 stale
  pixels after a drag, Arrange or Frame, and 751 when a frame's header drags it
  and its nodes; 0 at zoom 1 and over; 0 in Firefox and WebKit. `border-radius: 0`
  stops the bleed; hiding the sockets, the grid, the tips or the connections does not.
  With the ring: 0 round the moved piece, at zooms 0.25 to 1.25, the frame too.
  Up to six pixels, by up to 23 levels, can still differ at 0.75 where a redrawn
  connection meets a socket: the ring is on the pieces, not on a connection's path.
- **The ring is clear**: the canvas reads the same with it and without it, at
  rest, picked and mid-drag, in all three engines. It is ONE device px at any
  zoom, which covers the most the bleed can reach (half a device px). Of the
  clear things tried, only a box shadow grows what a move repaints: a clear 2px
  `outline` on the node, or a clear `::before` 2px past it, left all 128 pixels.
- **The ring is in WHOLE plane px, `ceil(1 / zoom)`**, never `1px / zoom`: every
  node inherits the plane's value, and one write restyles them all — 1.5 s a zoom
  step at 2,000 nodes (Demos, 2026-11-11), 55 ms with whole px, which change 4
  times from 0.25 to 1. Plan 852.
- **Forced colours drop every box shadow**, so the ring goes there, and the line
  can stay in Chromium under 1 zoom.
- A piece's own `box-shadow`, set in the page's CSS, wins over the ring.
- **The spec measures what a move did not repaint**: a screenshot after the
  move, against one after the canvas is hidden for a frame and shown again,
  which repaints all of it. The two must match round the old place and the new.

- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.css`
- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.ts`
- Site: `test/e2e/reforged-a-moved-node-leaves-no-trace.spec.ts`

### T-a-node-moves-itself-and-reports

**A node MOVES ITSELF and reports each move; a press only ASKS to select it.**
Will, TODO 78. Its place is `data-x` and `data-y`, in plane px, and it writes
them as the canvas's `--x` and `--y`. A drag on its header, or an arrow key
there, writes the new place and fires `node-move { x, y }` — as the canvas owns
its view and reports it. With `data-locked` the host owns the place: the node
reports where it was asked to go, and moves nothing.

- **A drag is in PLANE px.** The canvas scales the node, so a screen px is
  `1 / zoom` plane px. The node reads its zoom from its own box, the drawn
  width over the laid-out one, and never asks the canvas: two components never
  speak.
- **Selection is one node of many**, and only the host sees them all. So a
  click on the node, or Enter or Space on its header, fires `node-select`, and
  the HOST writes `data-current` — on that node, and off the others. The node
  pins Style=active for it and tells assistive tech (`aria-current`).
- **A drag is no press** (Will, 2026-10-29). A press becomes a drag once the
  pointer goes 4px; the click a drag ends with then selects nothing, and the
  next press clears the mark, so a click with no drag after it is never lost.
- **Its sockets are its host's to draw** — the header's for the whole node,
  each `sherpa-node-row`'s for its field — from one family sheet,
  `sherpa-node-sockets.css`, on the card's edges. A connector asks
  `socketRect(side)` where one is, and never reaches into a shadow root.

- Site: `src/components/sherpa-node/sherpa-node.ts`
- Site: `src/components/sherpa-node/sherpa-node.html`
- Site: `test/e2e/reforged-node.spec.ts`

### T-a-form-control-follows-its-fieldset

**A form control is disabled by its `<fieldset>` too, and a reset puts back
its first state** (TODO 214). A form-associated element matches `:disabled`
for EITHER cause, so each control reads `this.matches(':disabled')` — never
`hasAttribute('disabled')` — for its inner control and its presses, and its
CSS selects `:host(:disabled)`. `formDisabledCallback` only re-syncs.

Reset follows Will's ruling B: `checked` keeps reflecting the current state,
so the FIRST value seen is the reset default — the switch, checkbox, radio,
select card, slider, calendar and transfer list each keep theirs; the file
upload empties, as a native one does.

Five controls submitted nothing and join their form now: the slider (a value,
or a range's two ends), the select card (its value while selected — its
footer controls are parts and join no form), the calendar (a day, or two
ends), the file upload (its files), the transfer list (its selected values).
`FormValue.value()` takes a list for those: one entry each, under the host's
`name`.

- Site: `src/components/sherpa-switch/sherpa-switch.ts`
- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.ts`
- Site: `src/components/sherpa-select-radio/sherpa-select-radio.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `src/components/sherpa-slider/sherpa-slider.ts`
- Site: `src/components/sherpa-select-card/sherpa-select-card.ts`
- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`
- Site: `src/components/sherpa-file-upload/sherpa-file-upload.ts`
- Site: `src/components/sherpa-transfer-list/sherpa-transfer-list.ts`
- Site: `test/e2e/reforged-forms-complete.spec.ts`

### T-a-native-name-where-a-native-element-does-the-job

**Where a native element does the same job, a component takes its name,
unprefixed** (Will, D6; the lexicon, `docs/LEXICON.md`; TODO 279). `value`,
`min`, `max`, `step` on gauge, calendar and slider, as `<meter>`,
`<input type=date>` and `<input type=range>` have them; `checked` on a ticked
control; `accept`, `multiple` and `placeholder` where a file or text control
wraps the native one. What no native element names keeps `data-`: a range's two
ends are `data-value-start` and `data-value-end` on the slider and the calendar
alike, and a chart's axis bound stays `data-min`/`data-max`.

**The type-checker cannot see the rename.** `this.dataset['accept']` still
compiles after `accept` stops being a `data-*` attribute, and reads
`undefined` for ever. `check:props` catches a `this.dataset` read of a name no
prop declares; it found five in the first pass. A native name is read with
`getAttribute`.

**What stays text.** The metric's and the toast's `data-value` are the
formatted string shown, not a number on a scale: the metric's number is its
`value` property already.

- Site: `src/components/sherpa-slider/sherpa-slider.ts`
- Site: `test/unit/the-lexicon-holds.test.mjs`

### T-an-icon-button-still-slots-its-menu

**An icon-only `sherpa-button` must still slot its menu.** The button has two
templates; only the default one had `<slot name="menu">`. The chart legend's
Other row puts its Breakdown menu in an ICON button (since ad7f91be, which
moved it in to fix the light-dismiss race), so from then on the menu had no
slot: it opened — the button read `data-open`, the popover read
`:popover-open` — and drew nothing, 0x0. Will saw it as "the Other menu
doesn't display any more".

Every state said open, which is why a state test could never catch it — the
test reads the popover's BOX.

- Site: `src/components/sherpa-button/sherpa-button.html`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-a-form-value-follows-every-write

**A form control tells its form what it holds after EVERY write** — a
keystroke, a `value` set from code, an attribute (`required`, `pattern`), a
select's options filled late — or the form reads a stale answer. Found by the
API audit (TODO 86): `sherpa-input-text` told its form only on `input` and
`change`, so the Add customer dialog's Customer select, filled after it
rendered, read EMPTY to a form, and an Edit's name and email, set from code,
read empty too. `form.reportValidity()` would have refused every save.

The four form controls (`sherpa-input-text`, `-select-checkbox`,
`-select-radio`, `sherpa-switch`) each import `FormValue`
(`src/core/ui/form-value.ts`) — a helper, never a base class — and call it
from every path that moves their value. A checkbox, a switch or a radio
submits its value when ticked and nothing when not; a radio's REQUIRED is its
group's (`T-radios-in-shadow-roots-are-not-one-group`).

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.ts`
- Site: `src/components/sherpa-switch/sherpa-switch.ts`
- Site: `test/e2e/reforged-form-controls.spec.ts`

### T-a-dragged-layout-is-kept-per-column-count

**An author writes names; a drag writes COUNTS, per column count.** TODO 177.
A width class (`data-col-span="medium"`) is the author's, and it changes with
the breakpoint. A dragged width is a number of tracks, and it only means
something at the column count it was dragged at. So a drag writes the grid's
OWN attributes — `data-col-span-12="5"`, `data-row-span-8="3"` — and never
`data-col-span` or `data-row-span`. Every attribute has one writer, and putting
the authored layout back is a plain removal.

- The rules are GENERATED in `tokens.css`, only for bands of 6 or more columns
  (8 and 12 today), AFTER the name rules at the same weight, so a count wins.
  A document rule also outranks the grid's adopted sheet and
  `sherpa-container`'s own `:host` height.
- A counted row span carries its `block-size`, so it is a real height in
  every row mode.
- The stranded-row fill (`grid-column: 1 / -1`) has far more weight than a
  count, so it is excluded with `:not([data-col-span-<C>])`, not out-weighed.
- `--_grid-fit: 1` marks a fit grid for the JS, which never asks the viewport
  (`T-fit-is-a-desktop-mode`). Named `--_grid-*`: a custom property inherits
  into every child.
- The first width written at a count freezes EVERY child at that count, so
  one changed card cannot reflow the names around it.

A drag let go where it began puts back what it found and reports nothing:
the freeze alone was saved as a layout. A hidden child holds no width, so it
never stops a layout being put back. A grid with a set `data-row-count` (and
no fit) shares its height between rows, so it gets no row handles.

- Site: `scripts/project-tokens.mjs`
- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.html`
- Site: `test/e2e/reforged-layout-grid.spec.ts`
- Site: `src/components/sherpa-layout-grid/grid-resize.ts`
- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.ts`

### T-a-gutter-moves-a-line

**A drag moves ONE line; the span across it gives way.** TODO 177, Will:
*"If there's no space on the row to grow an element's column span (siblings
already at their minimum span) then dragging won't increase the width.
Dragging to resize height/row span can't force neighbouring rows of content
to span lower than the highest min row span on elements in that row."*

Both rules only mean something if a neighbour SHRINKS, so: the span on the
line's near side grows, and the spans across it give way — nearest first, each
down to its floor — then free space (empty columns at a row's end, a page that
scrolls, a fit grid's filler). A step nobody can give is dropped, so with
every sibling at its minimum the drag grows nothing. The total is kept.

One pure function, `moveLine`, serves both axes: a row's cards (floor 3
columns) and a grid's bands (floor = the band's highest `data-min-row-span`).
A locked segment (floor = ceil = span) passes a move through unchanged.
`reach` says how far a line can go each way, for Home, End and the aria
values.

**Found by the review of 177**, each now held by a test:
- A locked segment passes a move through on the GROWING side too. The Dashboard's
  Summary hugs its content, so its row is locked, and the row above it could
  grow but never shrink back: the page takes the rows through it.
- A row's first card never shrinks enough to fit beside the row above, or it
  jumps up a row. A taller card from an earlier row limits a row's free columns.
- A band taller than 12 rows is locked: no rule reads 13 and up.
- A handle states where its LINE sits — the column or row it follows — so its
  value, its range and its words move together through a cascade.

- Site: `src/components/sherpa-layout-grid/grid-lines.ts`
- Site: `test/unit/a-gutter-moves-a-line.test.mjs`
- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.ts`
- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.css`
- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.html`
- Site: `test/e2e/reforged-layout-grid-resize.spec.ts`

### T-a-handle-is-never-restamped-mid-drag

**A held handle is never replaced.** TODO 177. The layout grid draws its
gutter handles with `renderItems`, which EMPTIES `.handles` and stamps anew.
A drag reflows the grid at every snapped step, and the set of handles can
change under it — a row's trailing handle comes and goes as its free columns
do. Removing the node that holds pointer capture ends the drag silently and
loses focus.

So the handles are re-stamped only when the set of keys changed AND none is
`[data-dragging]`; otherwise each node is moved in place by its `data-key`.
After a re-stamp, focus goes back to the handle with the same key. The
`handle-tpl` is a SIBLING of `.handles`, never inside it: the first re-stamp
would delete it.

Each stamp has its OWN AbortController, let go at the next stamp: the
handles' listeners were held by the grid's for as long as it lived. A grid
taken out and put back re-stamps, so its handles are wired to the new
connection, not the aborted one. A row a drag filled keeps its end handle, to
give the columns back; and a focused handle that went is followed by the
nearest one the same way, never by the page.

- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.ts`
- Site: `test/e2e/reforged-layout-grid-resize.spec.ts`

### T-a-fit-grid-counts-its-resized-rows

**A dragged fit grid writes its row count INLINE, beside the author's.**
TODO 177. A fit grid's rows are `repeat(--_row-count − 1, row) 1fr`, and the
author states the count (`data-row-count`). When a drag grows a row, the
count must grow with it, or the filler's `1fr` lands under the grown cards.
The grid writes `--_row-count` on its own inline style — which beats the
`[data-row-count='N']` rule — and never touches `data-row-count`. So the
attribute can say 5 while 7 is drawn: read `grid.layout.rowCount`.

It is written only once a row has moved: an untouched grid keeps its authored
count. The filler gives only whole rows, down to two (its floor), so it keeps
the part-row left over and still ends at the grid's foot.

The count is the rows before the filler, as laid out, plus what moved — not
a sum of every band: a tall card beside two stacked ones is three bands and
three rows, not five.

**A KEPT count is counted again as it is put back** (TODO 515). It is a
number worked out from the layout, and the layout can change under it: Demos'
Records lost its metrics row to the fixed region (484), and a count of 5 kept
before that left the grid's card in a fixed 88px row with the `1fr` empty
below it. So `writeLayout` lays the kept spans out, then counts the rows before
the filler as they land, plus one, and drops the inline count where it equals
the authored one. Only while fit is on: below it the count draws nothing.

- Site: `src/components/sherpa-layout-grid/grid-resize.ts`
- Site: `test/e2e/reforged-layout-grid-resize.spec.ts`

### T-a-composed-native-event-goes-out-twice

**A native `input` is composed, so it crosses the shadow root — and so does the
host's own.** TODO 188. `sherpa-input-text` re-emits `input` from its host, as
a component should; but the inner `<input>`'s native `input` is `composed`
too, so a listener outside heard TWO per keystroke. (`change` is not composed,
which is why only `input` doubled.) The native one now stops at the control;
the host's goes on.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `test/e2e/reforged-input.spec.ts`

### T-a-shadow-reach-is-a-missing-door

**A host that reaches into a component's shadow root is asking for a door
the component does not have** (TODO 191). Sherpa Demos reached in three
times, and each one broke silently the day the markup inside changed:

| it reached for | the door now |
|---|---|
| the nav's open Area rows, before a populate redraws them | none: the nav KEEPS them across a populate (TODO 116); `nav.expandedIds` reads them |
| the header's bell, for the notifications panel to anchor to | `header.notificationsAnchor` |
| the header's theme button, to set its glyph and words | `data-theme-mode="light\|dark"` — the header draws them |

`data-theme-mode`, not `data-mode`: `data-mode` on any element re-tints
everything under it. With an attribute on the host there is nothing to write
before the header renders, so the app's "set it again once rendered" step
went too.

- Site: `src/components/sherpa-nav/sherpa-nav.ts`
- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`
- Site: `test/e2e/reforged-nav.spec.ts`
- Site: `test/e2e/reforged-app-header.spec.ts`

### T-a-selected-nav-row-wears-its-edge

**The selected nav row is the Default look's Active mode, not the Transparent
look's** — Will, TODO 498: *"The fill on its own is far too low contrast."* The
Transparent look's Active tint is a 30% wash, and its border is 0%. So the row
binds its edge — an inset shadow from `--sherpa-style-border-base`, which takes
no room — and the selected row's state pin is `active`: a solid pale fill and
the purple edge. Every other row stays Transparent, where the edge is nothing.

- Site: `src/components/sherpa-nav-item/sherpa-nav-item.css`
- Site: `test/e2e/reforged-nav-item.spec.ts`

### T-the-node-panel-asks-it-places

**The node panel LISTS and ASKS; it never places a node** (plan 713 M8, Will's
D14 and D16). A click on an item, Enter on it, or a drag let go off the card is
`node-add { kind, point? }`; "Add a node" is `askAdd(context)` and comes back on
`node-add` with the same `context`. The editor that hears it makes the node through
`editWorkflow { add }`, the one door, and picks it.

- **The card floats in the canvas's `panel` slot**, not on the plane: a node in
  the default slot pans and zooms with it. The slot's box sits 32px from the
  canvas's top, bottom and left, in CSS.
- **A drag is pointer events, not the HTML drag-and-drop**: a press that moves
  four pixels. WebKit's drag events do not come from a script's pointer, and a
  test drives the pointer. The click that ends a drag is eaten.
- **A click is a place at the middle of the view**; a drag is a place where it
  is let go, and a point off the canvas places nothing.

- Site: `src/components/sherpa-node-list/sherpa-node-list.html`
- Site: `src/components/sherpa-node-list/sherpa-node-list.ts`

### T-a-node-panel-lists-under-sticky-headings

**The node panel is ONE list, and each category's heading STICKS** (Will, TODOs
786, 784): no accordions. The list is the one scroll box; a heading is
`position: sticky` at its top, inside its category's block, so it stays while
that category's items pass under it and the next category's pushes it on. Its
surface is opaque: what scrolls under it never shows through.

- **Two TABS, no Jump to** (Will, 2026-11-06): Preset Nodes (every category but
  Custom Nodes) and Custom Nodes (that category, with its tags). Each category
  block says its tab in `data-group`; CSS hides the other tab's. A search runs
  across BOTH: each tab wears a count badge (`sherpa-tabs`' `badge`) of its matches
  while something is typed, and none otherwise, so a match on the other tab is
  seen. The empty message speaks for the open tab.
- **A Custom Node is listed under EACH of its tags**, inside its category, after
  the ones with none; a tag is one in any case, said as first met. A tag's heading
  does not stick. The search
  finds a node by a tag (`paletteMatch`), and a node found shows under every tag it
  has. Tags are the entity's `tags` (entity.v1), a Custom Node definition's too
  (nodes.v1), tidied on the way in (`tidyTags`, in its own module so the outlet
  carries only it), never part of its version. A
  preset's are read only, as the rest of it is.
- **A search hides a heading with nothing under it**, a tag's too: `data-filtered`
  on its block, which CSS hides.

- Site: `src/components/sherpa-node-list/sherpa-node-list.ts`
- Site: `src/components/sherpa-node-list/sherpa-node-list.css`
- Site: `test/e2e/reforged-node-panel-headings.spec.ts`
- Site: `test/unit/a-custom-node-has-tags.test.mjs`

### T-a-tag-field-counts-what-css-clips

`sherpa-input-text data-type="tags"` holds `sherpa-chip`s; its `value` is the comma
string and `.tags` the array. Plan 749 P2, Will 2026-11-05.

- **CSS clips; JS only counts.** The chips sit in one `flex-wrap` box one chip tall
  with `overflow: hidden`: a chip with no room wraps below the box, whole, never cut
  in half. CSS cannot count what wrapped, so a `ResizeObserver` counts the chips
  whose `offsetTop` is on a later row into `data-overflow`, and marks them `inert`
  (out of the tab order). CSS draws the `+N` off `data-overflow`.
- **The `+N` and the chevron open the SAME menu**, a `sherpa-menu
  data-select="multiple"` of every tag, ticked. An untick removes the tag; while the menu
  stays open, a tick returns it to its place. The button is always there, so the way to
  the menu does not depend on the width.
- **The typed word is not the value.** The text box's own `input` and `change` stop at
  the field. A tag set fires `tags-change { tags, added, removed }`, then `input` and
  `change` with `{ value }` (the comma string), so a form listener still works.
- **The chip's own x stays out of the tab order** (`data-no-tab`): the arrows and
  Delete move and remove, and the text box is the one tab stop (`focus()` goes to it).
- **`required` is read from the tags**, not the empty text box.
- **A tag is matched as written**: `Email` and `email` are two tags; a repeat is dropped.
  A comma ends a tag, so a tag never holds one. A word that names a `.suggestions` entry, by
  its value or its label in any case, is taken as that value, and its chip shows the label.
- **`.suggestions` are offered in the menu, unticked** after the tags; a tick adds one. With
  `data-closed` they are the ONLY values: a stranger is refused, kept in the text for the
  reader to mend, and the field's message says so; a change of the word ends the refusal.
  A host's `.tags` write is silent and is not checked: a host that holds a stranger says so
  itself (the node editor does, `T-a-row-says-its-own-fault`).
- **The typed word gives way to the tags** (`flex: 1 1 6rem`, down to `3rem`): in a narrow
  field, a node's row, the box did not shrink and cut the first chip in half.

- Site: `src/components/sherpa-input-text/input-tags.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.html`
- Site: `src/components/sherpa-input-text/sherpa-input-text.css`
- Site: `test/e2e/reforged-input-tags.spec.ts`

### T-a-host-error-is-the-hosts

**A message a HOST wrote in `data-error` is the host's to take away.** Plan 749 P4. A node row
draws its own fault in its field's `data-error`; `validate()` runs on every blur and, the
value being valid to the field, cleared it, so a click in and out wiped the host's words
until the next draw. The field now remembers the message it wrote itself: a pass clears only
that one, and while a host's shows, the field's own (a native check, a rule, a refused tag)
waits behind it, with `aria-invalid` still true. The host removes its own, as the reset
prompt does on input, and the field's own check speaks again on the next blur.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `test/e2e/reforged-input-tags.spec.ts`
- Site: `test/e2e/reforged-node-row-controls.spec.ts`

### T-the-panel-is-the-bar-in-portrait

**A filter panel's section is the filter toolbar in portrait.** The panel's own half (its header, its float, its tab, its close) was deleted from the toolbar at TODO 847: it is `sherpa-filter-panel` in a `sherpa-overlay-panel` now, and the toolbar keeps the strip and the sections the panel is made of (`data-orientation="portrait"`, `data-flat`). `data-panel-mode` stays: the bars' step back while the panel answers.

- Site: `src/components/sherpa-filter-panel/panel-column.ts`

### T-a-shut-column-draws-nothing

**A toolbar column draws its sections only once it is OPEN** — TODO 425. The
column is the panel area's occupant on every page, shut in toolbars mode. Each
section is a toolbar that asks the provider for its scope, and drawing one asks
for data — so a shut column cost a trip back to Records over a slow store
about 700 ms (Firefox: 270 ms with the classic panel, 990 with the column;
Demos `reforged-a-reopen-shows-at-once`). Shut, `drawScopes` only keeps the
scopes; `open` draws them. The classic panel does the same (`#stale`).

- Site: `src/components/sherpa-filter-panel/panel-column.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`

### T-one-line-between-a-context-and-a-panel-area

**One gap sits between a Context and an open panel area, and it is the area's inset** (Will, TODO 867, then 871; 8px
since 2026-11-08). A docked panel is a card inset from the nav, the header, the window's edge and the content, with a
border and four rounded corners of its own, so no line of the area's is drawn (TODO 867's shared line is gone). The shell says, from the
area's state (`start-open`, `end-open`), that the Context's frame takes no gutter on that side
(`--sherpa-context-gutter-start|end: 0`, read by the grid's inline padding in the generated tokens): the area's inset is
the whole gap. The resize handle (`.edge-*`) draws only on hover, focus or drag, so it adds none.

**Its top and bottom meet the Context's cards** (Will, 2026-11-10). The area's block inset is the host's,
`--sherpa-panel-area-padding-block` (8px); the shell sets it to the layout grid's block padding
(`--sherpa-layout-grid-padding`, 16px), so a fixed panel's top is the first cards' top and its bottom the last cards'
bottom. At 8px it stood 8px above the metric cards and 8px below the records card. The canvas keeps 8px: it has no
cards to meet. The lit box of a drop at an empty edge reads the same inset.

- Site: `src/components/sherpa-app-shell/sherpa-app-shell.css`
- Site: `test/e2e/reforged-shell-one-line-at-a-panel-area.spec.ts`
- Site: `test/e2e/reforged-layout-panels.spec.ts`

### T-a-canvas-draws-live-html

**`sherpa-canvas` with `data-drawn` draws its content into a REAL canvas, where the engine draws HTML in a canvas**
(Chrome 157 on: the canvas's `content="drawable"`, each drawn element `drawable`, `drawElementImage` in its `paint`
event). Without it, or where the engine cannot, its template is a plain layer, as a plane (Will, 2026-11-11; plan 852). A
drawn element stays live: a press where it is DRAWN reaches it, its fields take focus and typing, assistive tech reads
it; `getBoundingClientRect()` says where it is drawn.

- **Plain is the default; drawn is ASKED for** (Will, plan 852: A). Measured in Demos at 2,000 nodes, drawn is slower to
  pan (52 ms a step against 40), zoom (81 against 54) and drag (80 against 54), and faster only to type (41 against 68).
  `sherpa-layout-canvas`'s `data-drawn` hands the ask to its plane. The template is picked by `data-drawn`, so it is in
  `variantAttrs`, and `templateId` names `default` too: a null id never re-stamps, so the ask could not be taken back.

- **Inside the canvas an element lays out in FLOW**: `position` computes to `static`, so `left`/`top` move nothing and
  `offsetLeft`/`offsetTop` read 0. Its `left`/`top` still resolve, from `--x`/`--y`: the canvas reads its place there.
- **Only what the view shows is `drawable`.** Each `drawable` costs every paint, drawn or not: 2,000 of them cost a step
  60 ms with 15 drawn, 17–22 ms with only those in view.
- **An element not drawn has no drawn place**: its box reads as its hidden place in flow. Code must read a place from the
  model, never from layout (plan 852, step 2).
- **Every box is read before the first draw**, and `drawable` written after the last: a draw dirties layout, so a
  read after one laid the whole canvas out again — 16 layouts a pan step at 2,000 nodes, now 2 (one is the engine's).
- **What overhangs an element is drawn** from a source box `OVERHANG` px (64) past it each way (a node's socket tabs, a
  fork's True and False, its caption); without it, the snapshot is clipped to the element's own box. 32 cut a 40px
  socket's tab.
- **The node canvas's plane is one** (`sherpa-layout-canvas`'s `.plane`; plan 852, step 3): pan and zoom write its
  `data-x`, `data-y`, `data-zoom`. A node's scale is the one it is DRAWN at, so a zoom shows in a drag only after the
  canvas's next paint: a test that zooms and drags waits a frame.
- **The lines are one SVG, drawn too** (step 4): its box is the connections' bounds and a handle past them (`fitLines`), its
  `viewBox` at that box, so its coordinates stay the plane's. A 1×1 box drew no line. A line drawn by hand takes the
  whole view, as it may go anywhere.
- **One that moves while not drawn fires no `paint`**: a MutationObserver on each element's `style` asks for one.
- **It takes no press of its own** (`pointer-events: none`; its content `auto`): a press on its blank reaches what is
  under it, as the plane's 0×0 box let it.
- Feature test: a canvas given `content="drawable"` reads it back, and `drawElementImage` exists. The bundled Playwright
  Chromium (153) has only the trial API behind a flag: it draws the plain layer. The `chrome` project runs in Google
  Chrome, and its fixture makes every layout canvas ask, so the drawn path is tested.

- Site: `src/components/sherpa-canvas/sherpa-canvas.ts`
- Site: `src/components/sherpa-canvas/sherpa-canvas.html`
- Site: `src/components/sherpa-canvas/sherpa-canvas.css`
- Site: `playwright.config.ts`
- Site: `test/e2e/reforged-canvas.spec.ts`


### T-a-relayout-eases-by-its-viewport

**A re-layout's easing (Unfurl, Arrange) is marked on the canvas's `.viewport`, `data-settling`, not a `:state()`** (TODO
902). In WebKit (Playwright's, 2026-11-11) the canvas's `ElementInternals.states` read empty — `has('settling')` false, the
set empty — while `:state(settling)` still matched, so the state could not be taken off: the lines stayed hidden and the
nodes kept their transition. A tiny element alone drops a state as it should; the canvas does not. An attribute on a node
of its own shadow is private to it and drops in every engine. It ends when the pieces' moves end (their `getAnimations()`
finished), a timer the floor.

- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.ts`
