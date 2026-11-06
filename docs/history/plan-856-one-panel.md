# Plan 856 — one panel, one state attribute

Written for: Will. Status: PLAN, nothing built. Asked 2026-11-06 (TODO 855, 856). Build starts when the integrator says the
847 swap (the filter panel onto the overlay panel) has landed, so the filter panel moves with the rest.

## What was asked

**(A)** Replace the four attributes `data-fixed`, `data-overlay`, `data-minimised`, `data-floating` with ONE attribute,
`data-dock-state`, in the markup (not only in JS), with the values `floating`, `tab`, `hover`, `overlay`, `fixed`, and two new
ones: `drill-down` (the panel fills the window in the SAME tab) and `new-tab` (it looks the same, in a new browser tab). CSS
selects on it. Demos' saved state, the layouts and the specs move in the same change. No alias.

**(B)** Every panel is built from the same component, `sherpa-overlay-panel`; a copy is deleted. Then 855, Open in New Tab,
which shows ONLY the panel content, full screen, as a drill-down, is written once.

## The panels today

| Panel | Built on | Moves |
|---|---|---|
| Assistant, Details, Node details (inspector), Nodes (node list) in Demos | `sherpa-overlay-panel` | none: already on it |
| Filter column | `sherpa-quick-filter-toolbar` (portrait, column) | the 847 lane is putting it on `sherpa-overlay-panel` now; migrated here once it lands |
| `sherpa-node-panel` | deleted in 846 | none |
| `sherpa-panel` (an inline `<section>` card) | itself | decision D4 below; it is not docked, floated or tabbed anywhere in Demos |
| `sherpa-dialog` (modal), Settings overlay, `sherpa-notifications` (a menu) | their own | not panels: they are modal or menus, and stay |
| Starter, Gallery | none | nothing to move |

So after 847, every docked panel in the apps is an overlay panel. The work in (B) is mostly (A) plus 855.

## The attribute map, old to new

| Old | New | Notes |
|---|---|---|
| `data-fixed` (and `="start"`) | `data-dock-state="fixed"` + `data-dock-side="start"` | the side was folded into the value; it becomes its own attribute (D1) |
| `data-overlay` | `data-dock-state="overlay"` | the router's own `data-overlay` (names of overlay routes) is a different thing and is NOT touched |
| `data-minimised` | `data-dock-state="tab"` | |
| (the peek, an internal state) | `data-dock-state="hover"` | transient; never saved |
| `data-floating` | `data-dock-state="floating"` | `data-x`, `data-y`, `data-width`, `data-height` stay: they are the box, not the state |
| `data-maximised` | `data-dock-state="drill-down"` | it already is the full-screen drill-down with a trail (D2) |
| (new) | `data-dock-state="new-tab"` | the panel as the page of a new tab |
| (no state) | the LAST docked state, `fixed` or `overlay` | a floating, tab or drill-down panel returns to it: kept as `data-dock-was` (private to the panel; saved with the rest) |

Never `hover` and `fixed` together: a hover opens a panel over the content (a fixed panel hovered shows as `hover`, and its
docking button docks it as `overlay`). `collapsed` is not a dock state and stays `data-collapsed`.

## What changes

- `sherpa-overlay-panel`: `.ts`, `.css`, `.html`, the spec: one `data-dock-state`; `dockState` reads and writes it; the buttons
  (Minimise, Float, Dock as overlay / inline, drill-down, open in new tab) are transitions between its values; the CSS selects
  on it instead of `:state()` flags and four attributes.
- `sherpa-layout-panels` and `sherpa-layout-canvas`: read `data-dock-state` for "this area gives its room back"
  (`floating`, `tab`, `overlay`, `hover`, `drill-down`).
- The filter panel (`sherpa-filter-panel`), after 847.
- `sherpa-float.css`, `node-graph.ts` (the inspector starts as a `tab`), the panel keys (`panel-keys.ts`).
- Demos: `index.html`, `panel-float.js` (`restorePanel`, `keepPanel`: one value instead of five), `panel-tabs.js`, `records.html`.
- Docs: the traps (`T-a-floating-panel-is-a-state`, `T-a-minimised-panel-is-a-tab`, `T-a-panel-peeks-from-its-tab`, the area traps).
- Specs (14 in sherpa-ui, 6 in Demos, plus the parity sweep): `layer-bands`, `layout-panels`, `node-box-select`, `node-panel`,
  `outlet-layers`, `overlay-panel`, `-float`, `-minimise`, `panel-area-edge`, `-area-tabs`, `panel-keys`, `panel-overlay`,
  `router` (only its own `data-overlay`, which stays); Demos `node-panel`, `page-layers`, `panel-area-edge`, `panel-float`,
  `panel-tabs`, `records-details`.

## 855 Open in New Tab, written once

- The panel reports `panel-external`; the app opens `?panel=<id>`; that page sets the panel's `data-dock-state="new-tab"` and
  the shell shows only it: no header, no nav, no other panel, the content filling the window as a drill-down (D3).
- The other tab keeps the row in step (the BroadcastChannel in Demos' `panel-tabs.js` today); that sync is app code and stays
  in the app, but the page mode is the library's, so no app writes it again.

## Order

1. WAIT for 847 to land (the integrator says when). Work in a lane worktree; the commits are small but merge as one change,
   since there is no alias and a half-migrated tree would not pass.
2. P1 `sherpa-overlay-panel`: the attribute, `dockState`, the CSS, its spec and tests.
3. P2 the layouts, the float CSS, `node-graph.ts`, `panel-keys.ts`.
4. P3 the filter panel.
5. P4 Demos: markup, `restorePanel` / `keepPanel` (and a one-time read of the old kept keys so a reader's state is not lost).
6. P5 specs and traps; manifests and references regenerate.
7. P6 `drill-down` and `new-tab`, then 855.

## Decisions for you (two options each)

- **D1. The side.** `data-dock-side="start|end"` as its own attribute (my pick), or fold it into the value (`fixed-start`).
- **D2. Maximised.** `data-maximised` becomes the `drill-down` value (my pick: one state), or stays a second flag on top.
- **D3. The new-tab page.** The shell owns it, as `data-panel-only="<id>"` (my pick: written once), or the app keeps its own
  CSS and script, as Demos does now.
- **D4. `sherpa-panel` (the inline card).** Keep it as the card it is (my pick: it is not a docked panel), or fold it into
  the overlay panel as an `inline` state.

## Risks

- A reader's saved panel state (five kept values per panel) must still restore: P4 reads the old shape once, then writes the new.
- `data-dock-state` changes are the single write path, so the layouts' mutation watchers (`data-floating`, `data-minimised`,
  `data-overlay`) all move to it in the same commit as the panel.

## Spike 862 — one `<template>` per state family (`full`, `tab`)

Asked 2026-11-06 (TODO 862): swap between a full panel (`fixed`, `overlay`, `floating`) and a tab by switching the panel's HTML
`<template>` on `data-dock-state`, and let CSS do the layout. Measured on the tip (`fea5defbe`); the "after" numbers are
estimates from what each file holds, as the swap is not built.

**What the base class already gives.** `SherpaElement` picks a template by `templateId` and RE-STAMPS when an attribute
named in `variantAttrs` changes (`#restampIfVariantChanged`: the shadow root is replaced from a cached template, no fetch;
`onRender()` runs again). The filter toolbar already works this way (`data-orientation`, `data-column`). So the swap needs
`static variantAttrs = ['data-dock-state']`, a `templateId` getter (`tab` for `tab`, else `full`) and two `<template>`s.

**Cost, measured.** A re-stamp of the heaviest component that does it, the filter toolbar (`portrait` and `landscape`, alternating,
30 times): median 1.0 ms, p90 1.4 ms, max 1.7 ms, set to settled. A panel's chrome is a header and a few buttons: smaller.

**What must survive the swap, and does.** The content is the panel's LIGHT DOM, slotted: a re-stamp replaces only the shadow
root, so the content, its scroll, its focus and its open sections are not torn down. The panel's `.body` clips and the slotted
element owns its scroll. What is lost is shadow chrome: the focus on a header button, a button's pressed state, the `<dialog>`'s
open state. `onRender` already calls `show()` again where `open` is set, and rewires the header, the float box and the edge.

**What it would remove (lines now, `.ts` 617, `.css` 353, `.html` 145).** Tab-only code: about 120 lines of TS (`#peek`,
`#onPeek`, `#onTab`, `#onPeekPress`, `#onPeekMove`, `#minimise`, `notify`, the `minimised` / `peeking` / `overlaid` states);
about 95 lines of CSS (every rule written as `:host([data-minimised][open]) .tab` and its variants, the rail, the peek); about
19 lines of HTML (the tab and the rail, which would sit in their own template). After: the tab template holds its own small CSS,
the `full` template holds none of it. I estimate TS −60 to −90 lines, CSS −40 to −60, HTML +0 (moved). That is 15 to 20 percent of
the component, not half: the docking cycle, float, drag, resize, the width carry and the saved state are not tab code.

**The catch: `hover`.** A hovered tab shows the FULL chrome while the panel is still "a tab". If `hover` is its own `data-dock-state`
value that selects the `full` template, then a hover is a swap `tab` to `full` and the swap back as the pointer leaves: two
re-stamps (about 1 ms each). The tab under the pointer is replaced by the panel, so the leave test cannot rely on `pointerleave`
of the old tab; the existing document-level pointer check (the pointer outside the panel's box) already does not.

**Accessibility.** The tab template is a real `<button>` with the panel's name and a state ("Open Nodes"); the full template keeps
the dialog and its header. A swap loses the focus that was in the chrome: the panel must hand it to the equivalent control in the
new template (the tab button to the Minimise button, back again), in `onRender` (about 8 lines). Content focus is untouched.

**Verdict: yes, with two conditions.** (1) `hover` selects `full`, not a third template. (2) Build it with the `data-dock-state`
migration, in one change, since both rewrite the same selectors. It will not halve the code; it makes the tab a separate,
smaller thing with its own CSS and takes the `[data-minimised][open]` conditions out of the full panel's. If Will wants the
most reduction, the larger saving is not the template swap but deleting `#peek` for CSS `:hover` on the tab (`:host(:hover)`
shows the overlay): a CSS-only peek, which this swap would make simple, but which gives up the pointer-leave check for touch.

**Order.** P1 of the plan becomes: `variantAttrs`, the two templates, `data-dock-state`, the CSS of each, then the specs.

### Spike 862, way (b): the same panel, a `tab` state, CSS only

Asked by Will: no tab component and no template swap; in `data-dock-state="tab"` CSS hides the body, the footer and all of the
container header but its title and the one button that opens it, sizes the box to the label, and rotates it at the area's edge.
One DOM. And the SAME box is the hover target: on hover (or a tap) it grows from the rotated label into the overlay.

**Prototype, measured.** On the real panel, one rule block of 4 lines added from outside (hide `.body`, `.footer`, `.trail`,
`.resize`, `.corner`, `.toolbar`, `.grip`, `.description`; `writing-mode: vertical-rl` on `.header`; the box fixed at the
edge, `inline-size: auto`): the 396 by 800 panel became a 47 by 18 box with the title and the icon showing and the close button
hidden. It is not a finished tab: the container header lays its title out inside its own shadow, so the rotation and the size need
the header to take the `writing-mode` and to size to its label (a few lines in `sherpa-container-header`, or a part). Realistic
size of the finished CSS: about 30 to 35 lines, against about 95 now.

**What (b) deletes.** (Lines now: TS 617, CSS 353, HTML 145; the total 1115.)
- HTML: the `.tab`, `.tab-open`, `.tab-title`, `.tab-mark` and `.rail` elements, about 19 lines. The tab's name comes from the header
  (`role="button"` and `tabindex="0"`, set by the template's own directives from `data-dock-state`, no JS). The "!" is the header's
  existing `badge` slot, shown while `data-updated`.
- TS: the whole peek (`#onPeek`, `#onTab`, `#onPeekPress`, `#onPeekMove`, `#peek`, the `requestAnimationFrame` check, the
  document listeners, the `peeking`, `minimised`, `overlaid` states, the tab's `pointerenter` / `click` wiring): about 120 lines.
  What stays: a tap or press toggles `hover`, and a press outside or Escape ends it for a finger: about 15 lines. For a mouse, hover is
  CSS: `:host([data-dock-state="tab"]:hover)` draws the overlay, so there is no pointer-leave check, no hand-over from a tab to a
  panel, no gap between them to flicker in, and no edge cases (a drag from its edge, a synthetic pointer event, WebKit): the
  flaky WebKit hover specs would go with the code.
- CSS: the `.tab`, `.rail`, `.tab-open`, `.tab-mark` and the `peeking` rules: about 60 of the 95 lines.
- A re-stamp, none: the DOM is never replaced (focus, pressed states and the `<dialog>` stay).

**What (b) loses, and the answer.** The hovered panel's content must exist: it does, it is the same slotted light DOM, just hidden
by `display: none` while it is a tab (as now). A name and a role: the header carries them (above). Focus: on the same element, so it
stays. The "updated" mark: the badge slot. Sizing to the label: `inline-size: fit-content` with the vertical writing mode.
Several tabs stacking down the edge: unchanged, `--_tab-index` stays (about 15 lines). Hover growth: the box changes size on
`:hover`, which a plain CSS transition can do; the panel's own pointer-leave then is CSS too.

**Numbers side by side.**

| | now | (a) template swap | (b) CSS only |
|---|---|---|---|
| TS lines removed | 0 | 60 to 90 | about 105 (120 less 15 kept) |
| CSS lines removed | 0 | 40 to 60 | about 60 to 65 (95 less 30 to 35 new) |
| HTML lines removed | 0 | 0 (moved) | about 15 (19 less 4) |
| A re-stamp on each change | none | 2 (1 ms each; focus handed over) | none |
| A hover | peek code + a hand-over | two re-stamps | CSS `:hover`, nothing to hand over |
| New moving parts | none | `variantAttrs`, two templates | a few lines in `sherpa-container-header` |

**Recommendation: (b), and drop (a).** It deletes more (about 180 of 1115 lines, 16 percent, against 100 to 150), has no re-stamp and no
focus hand-over, and takes out the hover code that has been the source of the WebKit flakes. The one real cost is the work in
`sherpa-container-header` so a header can size to its label and take a writing mode. It also fits the plan's own principle
(state is an attribute CSS reads): build it with the `data-dock-state` migration, in the same change. Open question for Will: on a
touch screen a tap shows the overlay and a second tap, or a press outside, shuts it: keep as is.
