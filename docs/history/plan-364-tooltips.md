# Plan 364 — one tooltip system

DEFERRED (Will, 2026-10-20: "defer tooltips to much later"). A read-only study,
kept so the work can start from it. Nothing here is built. Line numbers are
as of 2026-10-20 and will drift.

Four read-only agents: two maps, a design, and a check of the design against
the code. Their reports follow as they wrote them.

## 1. Map — the mechanisms

I mapped every tooltip path in `src/` and found the cause of TODO 364, then reproduced it in Chromium and Firefox. The cause is not anchoring. The code that lifts a tip into the top layer listens on the `document`, and the browser does not deliver that event to the `document` when the pointer or focus moves between two parts inside the same component.

### Tooltip study — TODO 364

#### 1. The answer

A Button's tip is shown by one thing and lifted by another, and the two can disagree. A chip's tip has only one switch.

- **What shows a Button's tip:** CSS. `src/core/sherpa-anchor.css:58-62` shows `.sherpa-tip` whenever its `.sherpa-anchor` matches `:hover` or `:focus-visible`. Hover follows the flattened tree, so this rule is always right.
- **What lifts it:** a separate listener. `src/core/ui/top-layer-tips.ts:54-60` listens for `pointerover`, `pointerout`, `focusin` and `focusout` on the `document`. Only when it hears one does it call `showPopover()` (`:37-40`) or `hidePopover()` (`:42-51`).
- **Why the listener misses:** in the DOM spec's event-path algorithm, a boundary or focus event stops at the shadow host where its target and its `relatedTarget` retarget to the same node. So when the pointer glides, or Tab moves, from one control to the next inside one composite, the `document` hears nothing:
  - Measured, both engines: app header Labs → Switch to dark mode, toolbar Refresh data → More actions, card header Collapse → Close (pointer and Tab), bar → bar, ring hole → slice.
  - "document heard 0 pointerover/out" and "document heard: nothing" in every case.
- **What the reader sees:** CSS still shows the tip, but in place. It is `position: fixed` (`sherpa-anchor.css:8`) inside a box with layout containment, such as `src/components/sherpa-container-header/sherpa-container-header.css:8` `container: … / inline-size`. That box holds and clips it, and it paints in that box's stacking context. In a probe with real components, the same Close tip:
  - painted above a `z-index: 1` neighbour when the pointer came from outside the card;
  - painted under that neighbour when it glided over from Collapse.
- **It gets worse over time:** the tip that was left never hears `pointerout`/`focusout`, so it stays `:popover-open` but hidden by CSS. Its next lift is skipped by `!found.tip.matches(':popover-open')` (`top-layer-tips.ts:39`). It keeps its old top-layer slot, under any menu or dialog opened since. In the Demos app, after one Tab or Escape the Account tip stayed open for the rest of the session.
- **Why the chip is fine:**
  - `src/components/sherpa-tooltip/sherpa-tooltip.ts:33-37` listens for `pointerenter`/`pointerleave`/`focusin`/`focusout` on the anchor itself. The chip's anchor is `.chip` (`src/components/sherpa-quick-filter/sherpa-quick-filter.html:104`, `data-anchor=".chip"`), so the anchor is always on the event path, whichever way the pointer comes.
  - The bubble can only be seen while `:popover-open` (`sherpa-tooltip.css:47-54`, `79-82`).
  - Each show calls `showPopover()` fresh after `#hide()` (`sherpa-tooltip.ts:68`, `86-92`), so it is always the newest top-layer entry. Measured: gliding chip Customer → Region opens Region's tip in the top layer and closes Customer's.
- **A second, smaller miss:** `tipOf()` (`top-layer-tips.ts:25-33`) uses `composedPath()[0].closest('.sherpa-anchor')`, and `closest()` cannot cross a shadow or slot boundary. If the pointer lands first on one of these, CSS shows the tip but it is never lifted (both engines):
  - a slotted element child, such as `<sherpa-button data-tip><span>Apply</span></sherpa-button>`;
  - the button's own `<sherpa-badge>`, which has its own shadow root.

  Nothing in the library or Demos uses `data-tip` today, so this only bites apps for now.
- **Why the earlier fixes (157, 300) and tests passed:** every check enters from outside the composite.
  - `test/e2e/reforged-button-tip.spec.ts:74-75`/`92` hovers a lone light-DOM button.
  - `reforged-chart-tooltips.spec.ts:89` jumps in with one move.
  - The "66 pages" probe (TRAPS.md:17465-17470) entered each anchor fresh.

  So the TRAP text "hears pointerover and focusin on the DOCUMENT … finds the anchor under the deepest target" (TRAPS.md:17318-17320) is the wrong assumption.

#### 2. How I checked
- I read the code and TRAPs listed below.
- I copied `dist/` (built 10:35 today) to `/private/tmp/claude-502/tooltip-study/dist` and probed it with Playwright from a throwaway static server on :47391.
- I also started my own Demos server on :4391 to sweep the real app. Both servers are stopped. Will's :4200 was not touched, and the repo's `git status` is clean.
- Starting servers and running Playwright went a little beyond the "grep/sed/cat" list. Nothing in either repo was written.
- Probe scripts are in `/private/tmp/claude-502/tooltip-study/probe/`:
  - `run.cjs` — slotted child and badge misses;
  - `neighbour.cjs` — gliding in Demos;
  - `card.cjs` — screenshots `card-lifted-chromium.png` and `card-glide-chromium.png`;
  - `tab.cjs` — keyboard;
  - `charts.cjs`, `radial.cjs` — charts;
  - `stale.cjs`, `stale2.cjs` — stuck-open tips;
  - `chips.cjs` — chip comparison;
  - `aria.cjs` — accessibility check.

#### 3. Every tooltip mechanism in `src/`

There are three systems: the shared anchored tip, the `sherpa-tooltip` element, and native `title`.

##### 3.1 Shared anchored tip — `.sherpa-tip` and `top-layer-tips.ts`

**Engine**
- **Sheet:** `src/core/sherpa-anchor.css`, adopted into every root (`src/core/ui/sherpa-element.ts:251-259`, line 259).
- **Lift:** `src/core/ui/top-layer-tips.ts`, installed once per page from `connectedCallback` (`sherpa-element.ts:460-462`).

**Where it renders**
- A `popover="manual"` element in the host's shadow root.
- In the top layer only while the lift has fired; otherwise in place, which is the bug.
- The UA popover box is undone at `sherpa-anchor.css:7-13`.

**How it is placed**
- CSS anchor positioning: `position-anchor: var(--_anchor)`, `position-area: var(--_area, block-start)` and `position-try-fallbacks` (`:14-24`, tries at `:82-92`).
- `position-visibility: anchors-visible` (`:73-75`).
- Anchor naming (`:96-98`): `.sherpa-anchor`, a child `.sherpa-anchor-el`, or a zero-size `.sherpa-anchor-point` (`:64-71`).

**How it looks**
- Default-mode colours (`:34-37`) — the text colour reads Theme (`--sherpa-theme-content-body-4`).
- Shadow spelled out from primitives (`:44-49`).
- A literal 120ms fade (`:55`).
- No arrow.

**TRAPs:** `T-a-tip-lives-in-the-top-layer`, `T-anchoring-is-generic`, `T-every-button-says-its-action`, `T-chart-tip-is-a-sibling-of-its-dot`, `T-a-tooltip-is-not-an-axis`.

**Who uses it**

| Component | Anchor → tip | What shows it | Text | A11y |
|---|---|---|---|---|
| sherpa-button | `.trigger.sherpa-anchor` + sibling `.tip` (`sherpa-button.html:32,41`; icon template `:45,51`); name `--sherpa-button-tip` on `:host` (`sherpa-button.css:146`) | CSS `:hover`/`:focus-visible` sibling rule; hidden when empty, `data-no-tip` or `data-open` (`sherpa-button.css:147-149`) | `data-tip`; or, when there is no visible label, the `aria-label` (`sherpa-button.ts:86-93`) | tip is `aria-hidden` (`.html:41`), so the name already says it. A labelled button's `data-tip` text never reaches assistive tech. |
| sherpa-barchart | `button.bar-col.sherpa-anchor`, anchored on child `.bar.sherpa-anchor-el`; tip is a child (`sherpa-barchart.html:52-58`) | CSS descendant rule | `fillTip` (`src/core/ui/chart-parts.ts:55-58`) | `role="tooltip"`, not referenced; the column carries an `aria-label` (`sherpa-barchart.ts:121-122`) |
| sherpa-line-chart | `button.hotspot.sherpa-anchor` + sibling tip (`.html:71-74`); `pairAnchor` names per dot (`chart-parts.ts:49-51`; `sherpa-line-chart.ts:181-185`) | CSS sibling rule | `fillTip` | dot `aria-label` (`.ts:184`) |
| sherpa-sparkline (and **sherpa-metric**, which composes it at `sherpa-metric.html:36`) | `span.hotspot.sherpa-anchor` + sibling tip (`sherpa-sparkline.html:34-35`) | CSS sibling rule | `formatValue` (`sherpa-sparkline.ts:75-87`) | hotspots are `aria-hidden` (`.html:23`); the chart carries an `aria-description` trend (`.ts:86`) |
| sherpa-radial-chart | `.chart-segment[data-index]` (SVG) → tip paired by index; `.sherpa-anchor-point` (`.html:66-67`); `--_area` (`.ts:162-164`) | **only the lift** (`src/core/sherpa-chart-segments.css:41-44`; `top-layer-tips.ts:16,27-32`). Measured: entered from the ring hole, the tip never shows at all. | `fillTip` | arc `role="img"` + `aria-label` (`.ts:150-151`) |
| sherpa-gauge-chart | same as radial (`.html:106-107`; `.ts:205-216`) | only the lift | band name + range | arc `aria-label` (`.ts:222`) |

**Colour pins:** `'& .sherpa-tip': default` for the five charts in `scripts/figma-data/state-pins.yaml:123-138`, which become `src/core/sherpa-style-modes.css:1759,1787,1815,1843,1871`. This pins the same thing a second time; the button relies only on the direct binding in `sherpa-anchor.css:34-37`.

##### 3.2 `sherpa-tooltip` element — JS-placed popover

**Source:** `src/components/sherpa-tooltip/sherpa-tooltip.{ts,css,html}`.

**Who uses it**
- sherpa-quick-filter's value tip (`.count-wrap`, `sherpa-quick-filter.html:104`). This covers every chip in the toolbar, the filter panel, data-grid headings and legends that use chips.
- Apps directly.

**What shows it**
- JS listeners on the anchor: the host itself, or `data-anchor` resolved in the host's own root (`sherpa-tooltip.ts:33-37`, `49-54`).
- Hides on any scroll or resize while open (`:74-77`).
- An empty text never opens (`:64`).
- A text change re-places or shuts the bubble (`:42-46`).

**Where it renders and how it is placed**
- Always the top layer: `.bubble` is `popover="manual"` (`sherpa-tooltip.html:24`).
- Measured from `getBoundingClientRect`: the preferred side, or the opposite one, clamped to the viewport, written as `--_x`/`--_y` (`.ts:106-139`; `.css:26-29`).
- Measured, not CSS-anchored, because the anchor and the bubble are in different trees (`T-anchor-cross-root`, TRAPS.md:23).
- Arrow, with side states (`.css:61-71`, `86-108`).

**What it says:** `data-text` or a `tip` slot (`.html:25-26`). The chip writes `data-text` (`sherpa-quick-filter.ts:812-813`).

**A11y**
- `role="tooltip"`.
- `aria-describedby` is set on the host, pointing at an id inside its own shadow root (`.ts:24-28`). That reference does not resolve: measured `ariaDescribedByElements` = 0, and the trigger has no description.
- The chip works around this by writing the same words as `aria-description` on `.body` (`sherpa-quick-filter.ts:814-817`).

**Colours:** its own pin (`state-pins.yaml:142-144` → `sherpa-style-modes.css:1927`), different tokens from `.sherpa-tip`, `var(--sherpa-shadow-md)` (`.css:45`) and motion tokens (`.css:51-53`).

**TRAPs:** `T-a-tooltip-is-always-in-the-top-layer` (TRAPS.md:17445), `T-anchor-cross-root`.

**Documented example shows two tips at once:** `sherpa-tooltip.example.json` wraps an icon `sherpa-button`. Measured: both the bubble and the button's own tip open together.

##### 3.3 Native `title` — drawn by the operating system

- `sherpa-menu` greyed rows: `row.setAttribute('title', why)` (`src/components/sherpa-menu/sherpa-menu.ts:1369-1377`), beside `aria-description`.
- `sherpa-input-text` select options: `el.title = option.title` (`sherpa-input-text.ts:289-290`).
- Never clipped, but not styled and not shown on focus.

##### 3.4 Toolbar and panel

Neither has a tooltip system of its own.
- **Toolbar:** its action buttons are `sherpa-button`s (`sherpa-quick-filter-toolbar.html:128-181`), and each chip owns its tip (`sherpa-quick-filter-toolbar.ts:411-413`).
- **Panel:** field buttons are `sherpa-button`s (`sherpa-filter-panel.html:171-203`), and the moved-scope wording is shared with the chip tip through `movedTo()` (`src/core/ui/shared-constants.ts:24-30`; `sherpa-filter-panel.ts:668-679`).

#### 4. Duplication and drift (what "one system" has to fold together)
1. **Two engines:** the CSS-anchored tip with a document-level lift, and the element with listeners on its anchor plus measured placement.
2. **Two rules for showing a tip inside the shared engine:** `:hover` (`sherpa-anchor.css:58-62`) and `:popover-open` (`sherpa-chart-segments.css:41-44`). Only the second can never show a tip that is not lifted.
3. **Two looks:** different tokens for the fill, text and shadow, and an arrow on only one.
4. **Two ways to fall back:**
   - The CSS tries above, then sideways, then below.
   - The JS tries one side, then the opposite one.
   - They also behave differently on scroll: one follows its anchor, the other hides.
5. **Three a11y patterns:**
   - `aria-hidden` (button);
   - `role="tooltip"` that nothing references (charts);
   - an `aria-describedby` that does not resolve (`sherpa-tooltip`).
6. **Stale comments:**
   - `sherpa-quick-filter.html:42-46` says the tip is "a local copy … pure CSS on .count-wrap:hover"; it is a nested `sherpa-tooltip`.
   - `sherpa-quick-filter.css:11-13` and `:152-154`, and `sherpa-quick-filter.ts:18`, describe "FLOATING mode", which was removed in TODO 300.
   - `sherpa-gauge-chart.css:76` warns that a clip cuts off tips; tips are lifted now.

#### 5. Two options for one system
- **A — one tip, opened from the anchor's own root (recommended).**
  - Keep `.sherpa-tip` and CSS anchor positioning. The anchor and the tip share a root, so it already works from the top layer.
  - Make `:popover-open` the only thing that shows a tip, as segments already do, so a tip can never show in place.
  - Have `SherpaElement` wire `pointerover`/`pointerout`/`focusin`/`focusout` on its own shadow root, which is always on the path, instead of on `document`. Find the anchor from `composedPath()` rather than `closest()`.
  - Then `sherpa-tooltip` (the chip) becomes a `.sherpa-tip` beside `.chip` in the chip's root. The element is either kept only for apps that wrap light-DOM content, or deleted.
  - Fix the a11y once, there.
- **B — make `sherpa-tooltip` the one system.** Every button and chart mark would compose a tooltip element and its measured placement. That means more elements and JS per mark (charts have many), and it still needs per-root listeners for marks. I don't recommend it.

## 2. Map — the callers

### Tooltip callers, tests and spec API (sherpa-ui + Sherpa Demos)

This was a read-only study: nothing was edited, built or run against the repo. The two counting scripts are in `/private/tmp/claude-502/tooltip-study/` (`buttons.mjs` counts the `<sherpa-button>` tip paths, `specs.mjs` pulls the tip strings from the specs).

#### 0. Summary counts

| Path | What it is | Components in src that use it | Template sites | Demos app sites |
|---|---|---|---|---|
| **A. `.sherpa-tip` (shared anchored tip)** | CSS shows and places it; a document-wide JS listener lifts it to the top layer | 6: button, barchart, line-chart, radial-chart, gauge-chart, sparkline | 7 | 0 written directly. It arrives through composed components: 2 icon buttons, plus the charts |
| **B. `<sherpa-tooltip>` element** | The element opens its own popover and places it from measured coordinates | 1: sherpa-quick-filter, which 4 other components compose at 9 sites | 1 | 0 |
| **C. Native `title`** | The browser's own tooltip | 2: sherpa-menu row, sherpa-input-text `<option>` | 2 (TS) | 0 |
| **D. `aria-description` only** | Screen-reader text, no visual tip | 5 sites (2 of them pair with B or C) | n/a | 0 |
| **E. `data-tooltip` attribute** | does not exist | 0 | 0 | 0 |

- **Tests:** 16 spec files touch tips (13 in sherpa-ui, 3 in Demos), about 40 tests. Only **2 tests** check that a button tip is *not clipped*, and both use a bare icon button.
- **Specs:** tip-related Public API exists in 2 specs: `sherpa-button` (`data-tip`, `data-no-tip`) and `sherpa-tooltip` (`data-text`, `data-placement`, `data-anchor`). 5 chart specs list `.sherpa-tip` in their anatomy only.

---

#### 1. System A: `.sherpa-tip` (the button and chart path)

**How it works**
- **Shared sheet:** `src/core/sherpa-anchor.css`. Every shadow root adopts it.
  - Base rule `.sherpa-tip` (lines 7–56): `position: fixed`, `position-anchor: var(--_anchor)` (line 14), `position-area` (line 17), `position-try-fallbacks` (lines 21–24), `display: none` (line 53).
  - **CSS alone decides whether it shows:** `.sherpa-anchor:is(:hover, :focus-visible) + .sherpa-tip` and the descendant form (lines 58–62).
  - `position-visibility: anchors-visible` (lines 73–75). Anchor names are at lines 96–98.
- **The lift:** `src/core/ui/top-layer-tips.ts`.
  - `liftTips()` (lines 54–61) adds capture listeners on `document` for `pointerover`, `pointerout`, `focusin` and `focusout`.
  - `tipOf()` (lines 23–35) takes `composedPath()[0].closest('.sherpa-anchor')` (lines 25–28). The tip is the anchor's next sibling or a child (lines 30–33). It must be `popover="manual"` (line 34).
  - `lift` calls `showPopover()` (lines 37–40). `drop` hides it one frame after `pointerout` (lines 42–51).
  - It is installed from `SherpaElement.connectedCallback` (`src/core/ui/sherpa-element.ts:462`).
- **Charts only:** `pairAnchor()` / `fillTip()` (`src/core/ui/chart-parts.ts:49–58`). Segment tips are shown by the lift: `src/core/sherpa-chart-segments.css:41–44`.
- **TRAPs:** `T-a-tip-lives-in-the-top-layer` (docs/TRAPS.md:17300), `T-anchoring-is-generic` (:13710), `T-every-button-says-its-action` (:17475), `T-chart-tip-is-a-sibling-of-its-dot` (:9086).

**Callers**

| Component | Site | Anchor | Text from |
|---|---|---|---|
| sherpa-button (default) | `sherpa-button.html:41`, trigger at :32 | `.trigger.sherpa-anchor`, `--_anchor: --sherpa-button-tip` (`sherpa-button.css:146`) | `#syncTip` (`sherpa-button.ts:86–93`): `data-tip`, or `aria-label` when there is no visible label. Hidden when empty, `data-no-tip` or `data-open` (`sherpa-button.css:147–149`). `aria-hidden="true"`, no `role`. |
| sherpa-button (icon) | `sherpa-button.html:51`, trigger at :45 | same | same |
| sherpa-barchart | `sherpa-barchart.html:56`, a child of `.bar-col.sherpa-anchor` | `.sherpa-anchor-el` (the bar) | `fillTip`, `role="tooltip"` |
| sherpa-line-chart | `sherpa-line-chart.html:72`, sibling of the hotspot | `.hotspot.sherpa-anchor` | `fillTip` (`sherpa-line-chart.ts:174`) |
| sherpa-radial-chart | `sherpa-radial-chart.html:67` | `.sherpa-anchor-point` | `sherpa-radial-chart.ts:157` |
| sherpa-gauge-chart | `sherpa-gauge-chart.html:107`, paired by `data-index` | `.sherpa-anchor-point` | lift by index |
| sherpa-sparkline | `sherpa-sparkline.html:35` | `.hotspot.sherpa-anchor` | `pairAnchor` (`sherpa-sparkline.ts:81`) |

**Which `<sherpa-button>`s get a tip.** This is a static scan of the HTML templates. "Gets a tip" means it has `aria-label`, no visible label and no `data-no-tip`, or it has `data-tip`.

| Where | Buttons | Icon type | `aria-label` | `data-tip` | `data-no-tip` | Gets a tip |
|---|---|---|---|---|---|---|
| sherpa-ui, 24 component templates | 116 | 68 | 67 | **0** | **4** | **about 50** |
| Demos `app/` markup | 18 (+1 made in `contexts/records.js:256`, labelled) | 2 | 2 | 0 | 0 | **2** (`app/index.html:165,167`, Previous/Next record in the overlay panel's actions) |

Per component (gets a tip / total): app-header 8/9, calendar 4/9, menu 4/20, quick-filter-toolbar 4/9, pagination 4/4, container-header 3/3, filter-panel 3/15, layout-canvas 3/4, prompt-composer 3/3, nav 2/3, overlay-panel 2/2, provider 2/2. Callout, chart-legend, chip, file-upload, input-text, select-checkbox, tag and toast have 1 each. Container, notifications, outlet and transfer-list have 0.

All 4 `data-no-tip` uses are the input-text steppers: `sherpa-input-text.html:118,121,152,155`.

#### 2. System B: the `<sherpa-tooltip>` element

**How it works**
- **TS** (`src/components/sherpa-tooltip/sherpa-tooltip.ts`):
  - Props are at lines 18–22.
  - It puts `aria-describedby` on the **host**, not on the trigger (lines 24–28).
  - Its own listeners are `pointerenter`, `pointerleave`, `focusin` and `focusout` on the anchor (lines 32–38). The anchor is the element itself, or the box `data-anchor` names (lines 49–54).
  - `showPopover()` comes first, then `#place()` measures with `getBoundingClientRect` and writes `--_x` / `--_y` (lines 62–78 and 106–139). Its side flips when there is no room, and the side is a custom state, `side-*`.
  - It hides on any scroll or resize while open (lines 74–77).
- **CSS** (`sherpa-tooltip.css`): the bubble is lines 17–54, the arrow 61–71, the side states 86–108.
- **TRAPs:** `T-a-tooltip-is-always-in-the-top-layer` (docs/TRAPS.md:17445) and `T-anchor-cross-root` (:23).

**Callers**

| Caller | Site | Notes |
|---|---|---|
| sherpa-quick-filter | `sherpa-quick-filter.html:104`: `<sherpa-tooltip class="count-wrap" data-anchor=".chip">` | Zero-size and absolutely placed (`sherpa-quick-filter.css:121–129`). `#writeTip` writes `data-text` (`sherpa-quick-filter.ts:803–818`) and mirrors it to `.body`'s `aria-description` (:816). |
| ↳ reached through quick-filter-toolbar | `.html:104` (saved), `:197` (chip), `:202`, `:205` (organise) | |
| ↳ reached through filter-panel | `.html:128` (saved), `:209` (value chip) | |
| ↳ reached through data-grid | `.html:156` (head-filter), `:161` (head-sort, says "Sort by Name") | |
| ↳ reached through chart-legend | `.html:19` (key entry) | |
| Example / reference | `sherpa-tooltip.example.json:2–5` and `docs/components/sherpa-tooltip.md:20` | **This wraps an icon `sherpa-button aria-label="Delete"`, so the button's own A-tip ("Delete") and the B bubble ("Delete this item") both open above the same trigger.** That is the duplication Will describes, in the shipped example. |
| Sherpa Gallery | `stories/sherpa-tooltip.stories.js:6–7` | Outside the scope I was given. Noted only. |

#### 3. Path C: native `title`
- `src/components/sherpa-menu/sherpa-menu.ts:1373/1376` sets the `title` of a ruled-out row (paired with `aria-description` at :1372). Will asked for this in TODO 176.
- `src/components/sherpa-input-text/sherpa-input-text.ts:290` sets the `title` of a disabled `<option>`.
- No template has a `title=` attribute (grep found 0).

#### 4. Path D: `aria-description` with no visual tip
`sherpa-sparkline.ts:86`, `sherpa-gauge-chart.ts:131`, `core/ui/saved-filter-menu.ts:103`, `sherpa-menu.ts:1412` (a row note, drawn by CSS and not on hover), and `sherpa-quick-filter.ts:816` (the twin of B).

#### 5. How A and B differ (the duplication Will wants gone)

| | A: `.sherpa-tip` | B: `<sherpa-tooltip>` |
|---|---|---|
| Show | CSS `:hover`/`:focus-visible` (anchor.css:58–62), then a separate lift | its own listeners on the anchor (ts:32–38) |
| Place | CSS anchor positioning + `position-try-fallbacks` | JS measure, 4 sides, flip (ts:106–139) |
| Hide | 1 rAF after `pointerout`/`focusout` (top-layer-tips.ts:42–51) | at once, and on scroll or resize |
| Arrow | none | CSS triangle |
| Colours | `--sherpa-style-default-content-base` bg; ink is a **Theme** read, `--sherpa-theme-content-body-4` (anchor.css:36–37) | `--sherpa-style-content-base` / `-surface-base`, with a Style=default pin (`sherpa-style-modes.css:1927`, `state-pins.yaml:142`) |
| Shadow | written out from primitives (anchor.css:44–49) | `var(--sherpa-shadow-md)` (css:45) |
| Motion | literal `opacity 120ms ease` (anchor.css:55) | `--sherpa-motion-base` / `-ease` |
| a11y | button: `aria-hidden`; charts: `role="tooltip"`, nothing linked | `role="tooltip"`; `aria-describedby` on the host, which in a chip is a zero-size, unfocusable element |
| Same in both | max 16rem, padding, font | |

Chart tips also carry per-host Style pins: `sherpa-style-modes.css:1759, 1787, 1815, 1843, 1871`. The button tip has none and relies on the `-default-` names instead.

#### 6. Tests that cover tooltips

**sherpa-ui `test/e2e`**

| File:line | Path | Asserts |
|---|---|---|
| `reforged-button-tip.spec.ts:9` | A | **text** (aria-label / `data-tip`), **shown** (display), **position**: above and near the centre, only for the `icon` case (:42–49). No tip for a labelled button, `data-no-tip` or a nameless button. A saturated button's tip keeps its bg. |
| `reforged-button-tip.spec.ts:68` | A | **open state** `:popover-open` on hover and on focus. **Clipping**: an icon button in a 40px `overflow:hidden; container-type` div; the tip is wider than the box on both sides and its pixel outside the box is dark. It closes on leave. The barchart tip is lifted. |
| `reforged-tooltip.spec.ts:11, 30, 57, 73, 90, 108` | B | text plus `aria-describedby` → bubble id; shut by default and opens in the top layer on hover, shuts on leave; **clipping**: whole and above an `overflow:hidden` box; flips to the bottom with `side-bottom`; defaults to top and writes no attribute; `text` property reflects. **No focus test.** |
| `reforged-chart-tooltips.spec.ts:14` | A | anchor-name equals position-anchor, area `block-start`, fallback order, hidden by default, `pointer-events:none`, label and value |
| `:70` | A | bar tip **position**: above, 4px gap, centred, has size, text |
| `:125`, `:183`, `:251` | A | donut, gauge and sparkline tips are siblings with the right text. The gauge overlay sits outside the `.gauge` clip. |
| `:302` | A + B | a sparkline tip and the B bubble ignore the surrounding status (bg) |
| `reforged-chart-keyboard.spec.ts:43, 91, 136` | A | focus shows the tip (display); slice 13 and zone 7 are `:popover-open` |
| `reforged-gauge-chart.spec.ts:111, 223` | A | tip count and text; tip name matches the legend |
| `reforged-barchart.spec.ts:264`, `reforged-sparkline.spec.ts:27` | A | value text, exact |
| `reforged-a-moved-element-keeps-its-listeners.spec.ts:48` | B | opens (`:popover-open`) after a move, via a synthetic `pointerenter` |
| `reforged-quick-filter.spec.ts:259` | B | text, `aria-description`, hidden, then visible on hover, top layer, **position** above and centred, hides on leave |
| `reforged-quick-filter.spec.ts:599` | B | text (superseded chip) |
| `reforged-chip-tips.spec.ts:16, 59, 84, 116, 134` | B | `data-text` strings (number, range, date, matches, sort, group, grid heading). `:134` is open on hover whether the chip is on or off. |
| `reforged-filter-conditions.spec.ts:601`; `reforged-quick-filter-toolbar.spec.ts:2665, 2732`; `reforged-data-grid.spec.ts:2980` | B | text only |
| `reforged-quick-filter-toolbar.spec.ts:2790`; `reforged-filter-conditions.spec.ts:950` | C | the `title` value of a menu row / option |

**Demos `test/e2e`** (all text only, path B): `reforged-chip-results.spec.ts:44` (tip unchanged on or off), `reforged-filter-coordination.spec.ts:23` (`sortTip` is "Name, descending", :241), `reforged-limit-options.spec.ts:57` ("Limited by the filters before it: no matches.").

**Not tested (relevant to Will's bug)**
- No test checks that a button tip is lifted or unclipped when the button sits inside **another component's shadow root**: a container-header in a card, the app-header, the filter-panel or the overlay-panel actions. The 2 tests that check clipping use a bare button in a div.
- No lift test for a labelled button with `data-tip`. The `told` case at button-tip.spec.ts:53 checks only text and display.
- No test for a tip under a still pointer after a re-render.

#### 7. Spec Public API for tooltips (`*.component.json`)
- **sherpa-button:** props `data-tip` (props[12]) and `data-no-tip` (props[8]); state `no-tip` (`:host([data-no-tip])`); `populate` shape `tip?, noTip?`; anatomy `.tip.sherpa-tip`, part `tip`, in both templates.
- **sherpa-tooltip:** props `data-anchor`, `data-placement` (top|bottom|left|right), `data-text`; slots default and `tip`; parts `anchor`, `bubble`, `arrow`; Figma name "Tooltip (atom)".
- **sherpa-quick-filter:** anatomy root child `el: sherpa-tooltip`. Tips are mentioned in the descriptions of `aria-label`, `data-count`, `data-unavailable`, `disabled` and `refresh()`.
- **barchart, line-chart, radial-chart, gauge-chart, sparkline:** `.sherpa-tip` (`role=tooltip`) in the anatomy only. No tip props.
- **input-text:** the only match is the word "tooltip" in a divergence note. No API.

#### 8. Stale text found on the way (not fixed, read-only)
- `sherpa-quick-filter.html:42–46` says the tip is "a local copy of the sherpa-tooltip look… Reveal is pure CSS on .count-wrap:hover". Line 104 composes `<sherpa-tooltip>`.
- `test/e2e/reforged-tooltip.spec.ts:4–7` says "Show/hide is pure CSS (:hover / :focus-within)". It is JS now.
- `test/e2e/reforged-quick-filter.spec.ts:292` mentions "FLOATING mode". `data-floating` was removed (TRAPS.md:17457).
- `test/e2e/reforged-chart-tooltips.spec.ts:4` says the rules are in `core/sherpa-base.css`. They are in `sherpa-anchor.css`.

#### 9. Leads for the clipping bug (not proven)
This is the third time this bug has been reported (TODO 157, TODO 300, now).

1. **An A tip is shown by CSS whether or not the lift ran** (anchor.css:58–62). If the lift misses, the tip still shows, in the page, as a `position: fixed` box that a `container-type` ancestor holds and clips (TRAPS.md:17305–17310). B has no such split: it is shown only by opening the popover.
2. **Where the lift can miss.** `tipOf` uses `composedPath()[0].closest('.sherpa-anchor')` (top-layer-tips.ts:25–28), and `closest()` does not cross a shadow boundary. These targets give no lift:
   - a nested custom element inside `.trigger`, such as `<sherpa-badge>` (`sherpa-button.html:36`);
   - slotted light-DOM label content (`:34`);
   - a button re-rendered under a still pointer, because no new `pointerover` arrives. The TRAP records this cost for chart segments.

## 3. Design

### TODO 364: one tooltip system for every component

Nothing in either repo was edited, built or committed. The working tree now shows `M README.md`, `M docs/TODO.md` and two untracked `LICENSE` files. I did not make those changes.

`docs/TODO.md:1375-1378` marks 364 as deferred by Will. It says the plan is kept in `docs/history/plan-364-tooltips.md`, but that file does not exist yet.

#### 0. What I measured, beyond the study

The probes are in `/private/tmp/claude-502/tooltip-study/design/`. They ran in Playwright 1.63 against Chromium 153, Firefox 155 and WebKit 26.6. I used my own static server on :47392, and it is stopped. I did not run Playwright against the repo's server.

- **`features.cjs`**
  - All three engines support `popover="hint"`, `anchor-name`, `position-area`, `position-try-fallbacks` and `position-visibility`.
  - `interestfor` exists in Chromium only.
  - A named anchor in each of several shadow roots: every tip lands on its own anchor, in all three engines.
  - Gliding between two anchors in one root: the document hears nothing, but the root hears `pointerout` and `pointerover`. Same in all three engines.
- **`hint.cjs`**, identical in all three engines:
  - Only one hint is open at a time.
  - Showing a hint never closes an `auto` or a `manual` popover.
  - Escape closes the hint first.
  - On pointerup, a press closes the hint.
  - Opening an `auto` popover closes any hint.
- **`source.cjs`**: in Firefox 155, `showPopover({source})` with `position-anchor: auto` stays on the first source it was given. Keep named anchors.
- **`anchored.cjs`**: `@container anchored(fallback: …)` works only in Chromium.
- **`proto/`**: the design below, patched into a copy of `dist/` (`proto/tips.js`). The probes are `proto/probe.cjs` and `probe2.cjs` to `probe5.cjs`. In all three engines:
  - Gliding from Collapse to Close opens Close's tip and shuts Collapse's. Tab does the same.
  - Moving the pointer straight onto a slotted label, or onto the button's `sherpa-badge`, opens the tip.
  - Gliding from bar to bar works. Moving from the ring hole to a slice opens the slice's tip.
  - A tip shut by hand while hovered is `display: none`, so it never shows in place.
  - Hovering a row in a slotted menu does not open its button's tip.
  - Programmatic `.focus()` still opens the tip. The tests rely on this at `reforged-chart-keyboard.spec.ts:60`, `reforged-gauge-chart` and `reforged-button-tip.spec.ts:116`. `:focus-visible` matched in all three engines.
  - Inside a modal `<dialog>`, the first Escape shuts the tip and the second shuts the dialog (`probe5`).

#### 1. The chosen system

There is one tip: `.sherpa-tip`. It is a popover in the anchor's own shadow root. CSS anchor positioning places it. CSS shows it only while it is open. A listener on that same root opens and closes it.

1. **Where the tip is.** It is the next sibling of its `.sherpa-anchor`, or a child of it, in the same shadow root. A chart segment pairs with its tip by `data-index`. This is how it works now (`top-layer-tips.ts:30-33`).
2. **What it says.** The tip's own text:
   - Button: `data-tip`. If the button has no visible label, its `aria-label` (`sherpa-button.ts:86-93`).
   - Chip: its answer (`sherpa-quick-filter.ts:803-818`).
   - Chart: `fillTip` (`chart-parts.ts:55-58`).
   - An empty tip never opens.
3. **What shows it.** One rule: `.sherpa-tip:popover-open { display: flex; opacity: 1 }`. If the tip is not opened, nothing shows. A clipped tip can no longer appear.
4. **What opens it.** Each root that holds a tip listens, in the capture phase, for `pointerover`, `pointerout`, `focusin` and `focusout`.
   - It walks `event.composedPath()`.
   - It takes the first segment or `.sherpa-anchor` that is in this root. It stops at the root, and it stops at any element with a `popover` attribute that comes first.
   - It opens on hover, or on focus that matches `:focus-visible`.
   - It closes one frame after both hover and keyboard focus have gone. The frame is for Firefox's `:hover` timing (`top-layer-tips.ts:45-46`).
5. **Look and words.** The tip binds Style names, as Figma binds them, with one class pin. The tip is `aria-hidden`. Its words reach a screen reader from the control, as the control's name or as its `aria-description`.

Why this system:

- **It removes the cause.** The study found the document never hears a glide or a Tab inside one component. The DOM event path is cut where the target and the relatedTarget retarget to the same node. The root is always on that path; I measured this in all three engines.
- **HTML and CSS come first.** HTML and CSS do the placing and the showing: anchor positioning, `:popover-open` and the `popover` attribute. JS keeps only the open and close, in about 40 lines.
  - `interestfor` would do this in HTML, but it exists only in Chromium.
  - Even there, it cannot serve the span and SVG anchors in the charts.
- **It is the smallest move.** About 50 buttons and 5 charts already use this tip. Only the chip uses the other engine.
- **Two kinds of JS go.** The JS measuring (`sherpa-tooltip.ts:106-139`) and the hide-on-scroll (`:74-77`) are deleted. A tip now follows its anchor when the page scrolls. `position-visibility: anchors-visible` (`sherpa-anchor.css:73-75`) hides it when the anchor leaves the view.
- **The other way was rejected.** Making every mark use `<sherpa-tooltip>` needs an element, listeners and measuring per mark. Its anchor and its bubble are in different roots, so CSS anchoring cannot work (`T-anchor-cross-root`, `TRAPS.md:23`).
- **The arrow goes.** An arrow that points to the side the browser chose needs anchored container queries, which only Chromium has. So the shared tip keeps no arrow, as on every button and chart today. Figma's "Tooltip (atom)" should lose its arrow to match. If Will wants the arrow, it is one rule that works in Chromium only.

#### 2. What each mechanism becomes

| Now | Becomes | Commit |
|---|---|---|
| Document listeners (`top-layer-tips.ts:54-61`) and `closest()` (`:25-28`) | `hearTips(root)`: listeners per root and a walk along the composed path | C1 |
| `.sherpa-anchor:is(:hover, :focus-visible)` show rule (`sherpa-anchor.css:58-62`) | `.sherpa-tip:popover-open` only | C1 |
| Segment show rule (`sherpa-chart-segments.css:39-44`) | deleted; it is now the same as the shared rule | C1 |
| Button `.tip` (`sherpa-button.html:41,51`) and its hide rules (`sherpa-button.css:147-149`) | same tip; hide rules on `data-no-tip` and `data-open` only; `popover="hint"` (C2); `data-tip` also becomes `.trigger`'s `aria-description` (C4) | C1, C2, C4 |
| 5 chart tips (`barchart.html:56`, `line-chart.html:72`, `radial-chart.html:67`, `gauge-chart.html:107`, `sparkline.html:35`) | `popover="hint"` (C2); `aria-hidden="true"` and no `role="tooltip"`, because each mark's `aria-label` already says it (`barchart.ts:121-122`, `line-chart.ts:184`, `radial.ts:151`, `gauge.ts:222`; sparkline `.hotspots` is `aria-hidden` at `.html:23`) (C4) | C2, C4 |
| Tip colours: `-default-` names and a Theme ink (`sherpa-anchor.css:34-37`), shadow from primitives (`:44-49`), a literal 120ms (`:55`) | Style names, as the bubble binds them (`sherpa-tooltip.css:21-23`); `var(--sherpa-shadow-md)` (`tokens.css:3961`); `--sherpa-motion-base` and `--sherpa-motion-ease` | C3 |
| 5 chart pins and the bubble pin (`state-pins.yaml:121-144`) | one class key, `.sherpa-tip: '&': default`. It is supported as `.menu-row` is (`state-pins.yaml:51`; `project-tokens.mjs:976-1013`) | C3, C6 |
| Chip `<sherpa-tooltip class="count-wrap" data-anchor=".chip">` (`quick-filter.html:104`) | `.chip` gains `sherpa-anchor`, with `<span class="tip sherpa-tip" popover="hint" part="tip" aria-hidden="true">` after it | C5 |
| `<sherpa-tooltip>` element: arrow (`.css:56-71, 86-108`), placement (`.ts:106-139`), `aria-describedby` that does not resolve (`.ts:24-28`) | deleted (D1 A) | C6 |
| Native `title` on a menu row (`sherpa-menu.ts:1373`) and on an `<option>` (`sherpa-input-text.ts:290`) | **no change.** The row is light DOM in its host's tree (`state-pins.yaml:46-48`), which may be the page, where the shared sheet is not adopted. An `<option>` in a native select cannot hold a popover. | — |

#### 3. Commits, in order

For every commit:
1. Build, then run `npm test` (three engines), `npm run test:a11y`, `npm run spec:check` and `npm run check:traps`.
2. Make `npm run map:write <changed files>` the last step.
3. Build sherpa-ui after each commit, because Demos uses it through a symlink.

##### C1 fix(tips): 364 — each root hears its own tips; a tip shows only from the top layer

**Code**
- `src/core/ui/top-layer-tips.ts:1-61`
  - Replace `liftTips()` with `hearTips(root: ShadowRoot)`, run once per root (WeakSet).
  - `tipOf(root, event)` walks the composed path as in section 1, rule 4. This replaces `closest()` at `:25-28`, so a slotted label and the badge (`sherpa-button.html:34,36`) now find the trigger.
  - Lift: skip an empty tip. On `focusin`, open only when the focused node matches `:focus-visible`. If the tip is already open, show it again so it is the newest.
  - Drop: as `:42-51`, but "focused" means the deepest active element is `:focus-visible` and sits inside the anchor in the flat tree.
  - The working version is `/private/tmp/claude-502/tooltip-study/design/proto/tips.js`.
- `src/core/ui/sherpa-element.ts`
  - Remove the import at `:22` and the call at `:461-462`.
  - In `#stamp` (`:961`), call `hearTips(this.root)` when `body` names `sherpa-tip`. Only the 6 components with tips (7 after C5) pay for the listeners.
- `src/core/sherpa-anchor.css`: the rule at `:58-62` becomes the popover-only rule, and the comment at `:9-11` is updated.
- `src/core/sherpa-chart-segments.css:39-44`: delete.
- `src/components/sherpa-button/sherpa-button.css:147-149` becomes `:host([data-no-tip]) .tip, :host([data-open]) .tip { display: none; }`.
- Stale comments: `sherpa-gauge-chart.css:76-77` and `test/e2e/reforged-chart-tooltips.spec.ts:4`.

**Tests**
- New `test/e2e/reforged-a-tip-is-heard-in-its-own-root.spec.ts`:
  1. **Glide.** A `sherpa-container` with `sherpa-container-header data-collapsible data-dismissible`, beside a `z-index: 1` neighbour. Glide from Collapse to Close: Close is `:popover-open` and Collapse is not. The pixel outside the card is the tip's fill (read it as at `reforged-button-tip.spec.ts:100-109`).
  2. **Tab** from Collapse to Close: the tip follows focus. WebKit needs `Alt+Tab` to reach a button.
  3. The pointer lands first on a slotted `<span>`, and on the badge: the tip opens.
  4. Glide from bar to bar.
  5. Move from the radial's ring hole to a slice: the slice's tip opens.
  6. Hover, then call `hidePopover()` by hand: the tip is `display: none`.
  7. Hover a row of a slotted `sherpa-menu`: the button's tip stays shut.
- Must stay green with no change: `reforged-button-tip`, `reforged-chart-tooltips`, `reforged-chart-keyboard`, `reforged-gauge-chart`, `reforged-barchart`, `reforged-sparkline`. The prototype passed their sequences in `probe4.cjs`.

**TRAPs**
- New `T-a-hover-inside-a-component-never-reaches-the-document`: the event-path rule, measured in all three engines. Sites: `top-layer-tips.ts` and the new spec.
- Rewrite `T-a-tip-lives-in-the-top-layer` (`TRAPS.md:17305-17343`):
  - each root listens;
  - the popover is the only show rule;
  - delete "With no JS the tip still shows" (`:17321-17322`) and the segment exception (`:17327-17335`), but keep the still-pointer cost;
  - remove the Site `sherpa-chart-segments.css`.
- Add to `T-anchoring-is-generic` (`TRAPS.md:13714`): do not move to `position-anchor: auto` with `showPopover({source})`, because Firefox 155 keeps the first source.

##### C2 feat(tips): one tip at a time (follows D2)

**D2 A (`popover="hint"`)**
- Change `popover="manual"` to `"hint"` at the 7 tip sites:
  - `sherpa-button.html:41,51`
  - `barchart.html:56`, `line-chart.html:72`, `radial-chart.html:67`, `gauge-chart.html:107`, `sparkline.html:35`
- The check at `top-layer-tips.ts:34` changes to `'hint'`.
- Regenerate the 6 specs with `node scripts/generate-component-spec.mjs <name>`, then run `npm run manifest && npm run reference`.

**D2 B (`popover="manual"`)**: one line in the lift shuts the last open tip when a new one opens.

**Tests** (in the new spec):
- Keyboard focus is on icon button A and the pointer hovers B: only B's tip is open.
- A: Escape shuts a hovered tip.
- A: pointerup on the trigger shuts its tip.
- A tip shown while a `sherpa-menu` is open leaves the menu open. Menus are `popover="manual"` (`sherpa-menu.html:116`).

**TRAP**: add the hint behaviour to `T-a-tip-lives-in-the-top-layer`.

##### C3 style(tips): one look, bound like Figma

**Code**
- `sherpa-anchor.css`
  - `:36-37`: background `var(--sherpa-style-content-base, #0c0b11)`, colour `var(--sherpa-style-surface-base, #ffffff)`.
  - `:44-49`: `var(--sherpa-shadow-md, 8px 8px 16px -4px #35353d4c)`.
  - `:55`: the motion tokens.
- `state-pins.yaml:121-138`: replace the 5 chart pins with the `.sherpa-tip` class pin, then run `node scripts/project-tokens.mjs`. The blocks at `sherpa-style-modes.css:1759, 1787, 1815, 1843, 1871` become one.
- `scripts/lint-css.mjs:239-240`: lint `sherpa-anchor.css` as it lints `sherpa-button-look.css`, so `theme-colour` can see it.

**Tests**
- No change needed: `reforged-chart-tooltips.spec.ts:302` and `reforged-button-tip.spec.ts:56`.
- Extend `:302`: a button's tip inside `data-status="critical"` has the same background as the sparkline's tip.
- Take one screenshot in dark mode: the ink moves from Theme `content-body-4` to Style `surface-base`.

**TRAP**: rewrite `T-every-button-says-its-action` `:17493-17500`. The colour boundary is now the class pin, through `T-a-state-colour-binds-the-style-mode`.

##### C4 a11y(tips): the words reach a screen reader once

**Code**
- The 5 chart tip templates get `aria-hidden="true"` and lose `role="tooltip"`.
- `sherpa-button.ts:86-93`, `#syncTip`: when `data-tip` is set, write it as `.trigger`'s `aria-description`; otherwise remove it. The name still comes from `labelTarget` (`:35`).
- The chip already does this (`quick-filter.ts:814-817`). Regenerate the specs.

**Tests**
- `reforged-button-tip.spec.ts:9`:
  - `#told .trigger` has accessible description `'Apply every change'`;
  - `#icon .trigger` has name `'Settings'` and no description.
- Chart: the bar column's name is `One: 4`, and its tip is `aria-hidden`.
- `npm run test:a11y`: the baseline may only fall.

**TRAPs**: `T-every-button-says-its-action` gains "a labelled button's `data-tip` is its description". `T-a-tip-lives-in-the-top-layer` gains the a11y rule in one line.

##### C5 refactor(chip): the chip's tip is the shared tip

**Code**
- `sherpa-quick-filter.html`
  - Delete the comment and element at `:102-104`.
  - `.chip` (`:101`) gains `sherpa-anchor`.
  - Add the tip span after `</div>` (`:136`).
  - Shorten the doc at `:42-46` to one line.
- `sherpa-quick-filter.css`
  - Add `:host { --_anchor: --sherpa-chip-tip; }`.
  - Add `:host([data-open]) .tip { display: none; }`. `data-open` is declared at `.ts:40`, so a chip's tip never shows over its own open menu.
  - Delete `.count-wrap` at `:118-129`.
  - Fix the comments at `:11-13` and `:152-154`.
- `sherpa-quick-filter.ts`: remove the import at `:18-19`. At `:811-813`, write the `.tip` textContent instead.

**Tests**: change every read of `.count-wrap`'s `dataset.text` or `.bubble` to `.tip` textContent or `.tip:popover-open`.

| Repo | File | Reads |
|---|---|---|
| sherpa-ui | `reforged-chip-tips` | 6 |
| sherpa-ui | `reforged-quick-filter` (`:259` block, `:599`) | 2 |
| sherpa-ui | `reforged-quick-filter-toolbar` | 2 |
| sherpa-ui | `reforged-filter-conditions` | 1 |
| sherpa-ui | `reforged-data-grid` | 1 |
| Demos | `reforged-chip-results` | 1 |
| Demos | `reforged-filter-coordination` | 1 |
| Demos | `reforged-limit-options` | 1 |

- New: glide from chip to chip in a toolbar (B open, A shut); a chip in an `overflow: clip` box shows its whole tip.
- Regenerate the quick-filter spec.

##### C6 refactor(tips): delete `<sherpa-tooltip>` (D1 A)

**Delete or edit**
- Delete `src/components/sherpa-tooltip/` (all 5 files).
- `src/components.ts:72`.
- `state-pins.yaml:142-144`.
- `name-map.yaml:111-113`: mark `deprecated`, with a note that `.sherpa-tip` draws the atom.
- `check-traps.mjs:105` (`'tooltip'`).
- `test/reforged/harness.html:33`.
- `weight-baseline.json:332`.
- `size-baseline.json:74,433,510`.
- Run `npm run reference && npm run manifest`.

**Tests**
- Delete `reforged-tooltip.spec.ts`.
- `reforged-a-moved-element-keeps-its-listeners.spec.ts:48`: use a button whose tip opens after the move instead.
- `reforged-chart-tooltips.spec.ts:302`: drop the bubble half.

**TRAPs**
- Delete `T-a-tooltip-is-always-in-the-top-layer` (`:17449-17477`). Fold its one lesson into the top-layer TRAP: a closed popover is `display: none`.
- Remove the tooltip Site lines from these TRAPs, then run `npm run traps:write`:

| TRAP | Site line | Prose |
|---|---|---|
| `T-anchor-cross-root` | `:39` | — |
| `T-scope-does-not-stop-inheritance` | `:180` | `:177` |
| `T-abort-controller-per-connect` | `:503` | — |
| `T-a-layout-read-belongs-in-a-frame` | `:15263` | `:15243` |
| `T-a-tip-lives-in-the-top-layer` | — | `:17337` |
| `T-every-button-says-its-action` | — | `:17488` |

- `check:mcp-pack`.
- Tell Will about `../Sherpa Gallery/stories/sherpa-tooltip.stories.js`. It is a sibling project.

#### 4. Risks

1. **Escape and a press now close a tip (D2 A).** Inside a modal `sherpa-dialog`, the first Escape shuts only the tip. The dialog uses `showModal`, `sherpa-dialog.ts:68`, and leaves Escape to the browser (`:157-159`). Measured in all three engines.
   - Menus and non-modal dialogs handle their own Escape (`sherpa-menu.ts:1704`, `sherpa-dialog.ts:159`), so they still close at once.
   - Demos has 4 specs that press Escape for real, including `reforged-settings-overlay`. Run them.
2. **A re-render under a still pointer shows no tip until the pointer moves.** This is the same cost as today (`TRAPS.md:17334`).
3. **Two tips in different roots, one inside the other.** The capture order runs the outer root first and the inner root last, so with hint the innermost tip wins. Write this in the TRAP.
4. **Script focus counts as keyboard focus.** `.focus()` matched `:focus-visible` in all three engines, so a tip opens on script focus. This is as today for buttons.
5. **Cost.** There are 4 passive listeners on each root that holds a tip. The walk runs only on boundary and focus events, never on pointermove.
6. **Do not "simplify" the anchors.** Keep named anchors (Firefox `source` bug) and keep the small JS (`interestfor` is Chromium only).
7. **Removing a public component (D1 A)** breaks any app markup that uses it. Demos uses none; the Gallery has one story. The MCP list and the Figma name-map change.
8. **Test churn.** About 15 read sites across 9 files in two repos, 1 test file deleted, 1 new. `check:weight` goes down, because the chip no longer imports the tooltip.
9. **Touch.** A tap opens the tip and pointerup closes it, so touch users see no tip, about as today. Their words come from the name or the description.

#### 5. Decisions for Will

**D1. What happens to `<sherpa-tooltip>`?**
- **A. Delete it (my pick).** Every library use moves to `.sherpa-tip`, and an app gives a control a tip with `data-tip`. The element's words can never reach a screen reader. Its `aria-describedby` (`sherpa-tooltip.ts:24-28`) points into its own shadow root and does not resolve; the study measured 0 `ariaDescribedByElements`. A slotted trigger cannot point into it either. Its own example opens two tips at once (`sherpa-tooltip.example.json:2-5`).
- **B. Keep it as a thin wrapper built from `.sherpa-tip`.** No JS; `data-placement` maps to `--_area`; `data-anchor` is dropped. This keeps a code twin for the Figma atom and the Gallery story. It also keeps the screen-reader gap and a second public way to make a tip.

**D2. Which kind of popover is a tip?**
- **A. `popover="hint"` (my pick).** The browser keeps one tip open, and Escape or a press closes it. This meets WCAG 1.4.13 "dismissible" (AA), and it fixes the stale-open tip. The cost: in a modal dialog with a tip open, the first Escape closes only the tip.
- **B. `popover="manual"`, as now, plus one JS line that keeps one tip open.** Escape goes straight to the dialog or menu. A tip cannot be dismissed without moving the pointer or focus away, as today.

## 4. Check of the design

**Verdict on TODO 364's tooltip design, checked against HEAD**

The core of the design holds: each shadow root listens for its own tips, a tip shows only while it is an open popover, and the chip moves to the shared tip. But 10 claims are wrong and 15 things are missed. Three of the missed items matter most:
- **M1:** the button's own CSS hides some tips that the browser still holds open, and an open hidden tip takes the first Escape press.
- **M3:** under D2 A, a click shuts a chip's tip, which goes against what Will asked for in 363.
- **M5:** deleting `<sherpa-tooltip>` leaves an app no way to give a tip to anything except a `sherpa-button`.

HEAD moved during the review: a peer agent committed 814c52ee (TODO 305). That commit shifts every line in `docs/TRAPS.md` after line 7985 down by 2. So `T-a-tip-lives-in-the-top-layer` is now at :17307, `T-anchoring-is-generic` at :13716 and `T-a-tooltip-is-always-in-the-top-layer` at :17451. Earlier lines in TRAPS.md and line numbers in other files are unchanged.

#### Wrong (10)

- **W1. The TODO and the plan file.** `docs/TODO.md:1375-1378` is the end of 363's entry, not 364's. The 364 entry sits about 10 lines lower, and the peer is still editing `docs/TODO.md`. It names no file, only "its map and design go in `docs/history/`". `plan-364-tooltips.md` is the design's own name for that file.
- **W2. The working-tree note is stale.** The LICENSE files were committed in 413188b7. The tree now shows only `M docs/TODO.md`, and Demos shows only `?? perf/.new-elements.mjs`.
- **W3. Wrong spec file for the gauge.** `reforged-gauge-chart.spec.ts` never focuses, hovers or reads a popover. The gauge's focus-tip tests are in `reforged-chart-keyboard.spec.ts:91-134` and `:136-170`.
- **W4. Wrong lines in the C5 table.** The `reforged-quick-filter` reads are at `:290-327` (the `.count-wrap .bubble` locator is `:296`) and at `:629`, not `:259` and `:599`.
- **W5. "About 50 buttons" is low.** The library templates hold 116 `<sherpa-button` sites.
- **W6. Gauge comment lines.** The stale comment is at `sherpa-gauge-chart.css:75-76`, not `:76-77`.
- **W7. Wrong name-map status.** `status: deprecated` means the Figma component is retired (`name-map.yaml:6`). Here Figma keeps "Tooltip (atom)" and the code goes, so the matching status is `figma-only` (`figmaOnly[]`).
- **W8. The case against the CSS-anchored bubble is overstated.** In wrapper mode, `.anchor` (`sherpa-tooltip.html:20-22`) and `.bubble` (`:24`) are in the same root. Only `data-anchor` reaches into another tree. The rejection still stands on the other reasons.
- **W9. "Meets WCAG 1.4.13 (AA)" is half true.** The tip meets "dismissible" but not "hoverable": it has `pointer-events: none` (`sherpa-anchor.css:50`) and closes as the pointer leaves the anchor.
- **W10. "Touch is about as today" is plausible but untested, and probably wrong.** Today a tap leaves a sticky `:hover`, so both the CSS rule (`sherpa-anchor.css:58`) and the drop check (`top-layer-tips.ts:49`) keep the tip up. Under D2 A, pointerup light-dismisses the hint, so touch users lose tips. Mobile is a target. D2 B keeps them.

#### Missed (15)

- **M1. An open tip that CSS hides.**
  - The lift skips only empty tips. A `data-no-tip` tip still holds the button's `aria-label` (`sherpa-button.ts:92`), for example the 4 steppers at `sherpa-input-text.html:118,121,152,155`. A `data-open` tip is never empty either.
  - Both stay `:popover-open` while `display: none`.
  - Under D2 A such a tip still closes other tips, and it takes the first Escape in a modal dialog.
  - Fix: write `''` under `data-no-tip`, and skip the lift while the host has `data-open`.
- **M2. A tip emptied while open shows as an empty dark pill.**
  - C1 drops the `.tip:empty` hide (`sherpa-button.css:147`).
  - `<sherpa-tooltip>` hid an emptied bubble (`sherpa-tooltip.ts:42-45`).
  - The chip's `#writeTip` can write `''` while hovered (`sherpa-quick-filter.ts:811-813`).
  - Fix: keep `.sherpa-tip:empty { display: none }` in the shared sheet.
- **M3. D2 A changes 363.**
  - A click on a chip (toggling it on or off) shuts its tip at pointerup. Today it stays up until pointerleave (`sherpa-tooltip.ts:34-37`).
  - The 363 test (`reforged-chip-tips.spec.ts:134-153`) still passes, because it moves away and hovers again. But Will said on/off should have no bearing on the tip's visibility, and now the toggle click hides it.
  - Every button press and bar click also closes its tip.
- **M4. Escape inside dialogs.**
  - Keyboard focus on any icon button opens its tip. So in a modal `sherpa-dialog`, Escape needs two presses in the normal keyboard case, not only the rare one. `probe5` measured exactly this path.
  - Non-modal dialogs (`data-type="overlay"`, `sherpa-dialog.ts:37`) call `preventDefault` on Escape (`:160`). That cancels the close request, so the tip stays open as the dialog hides.
- **M5. D1 A removes the only general tip.**
  - `data-tip` exists only on `sherpa-button` (`sherpa-button.ts:27`).
  - `.sherpa-tip` and the listeners exist only inside shadow roots (`sherpa-element.ts:251-261`); `page.css` has neither.
  - `<sherpa-tooltip>` takes any content, a rich `tip` slot (`sherpa-tooltip.html:15,26`) and `data-placement`.
  - After C6, an app cannot give a tip to a span, an icon, a badge or a truncated cell. D1 needs a third option.
- **M6. Gates left out of the per-commit list.**
  - `check:size` runs in the hook. Baselines are `top-layer-tips.ts` 62 lines and `sherpa-button.ts` 196; C1 and C4 grow them.
  - `check:weight` and `test/unit/weight.test.mjs` run in `npm test`. C1 grows the base module every entry imports, and the weight may only fall.
  - Also missing: `lint:css`, `check:props`, `check:docs`, `check:map`.
  - Growth must be recorded on purpose with `--update-baseline`.
- **M7. A TRAP citation goes missing.** C1 deletes the citation at `sherpa-element.ts:461`, but the TRAP still lists `sherpa-element.ts` as a Site. Keep the citation at the new `#stamp` call, or `check:traps` fails.
- **M8. Stale comments not listed:**
  - `sherpa-line-chart.html:69`
  - `sherpa-barchart.html:48`
  - the header of `sherpa-chart-segments.css:2-4`
  - the header of `top-layer-tips.ts:2-6`
  - `sherpa-button.ts:83`
  - `sherpa-button.css:143-145`
  - `TRAPS.md:17490` ("pure CSS on :hover"), which goes stale at C1, not C6
- **M9. Keep the gauge's other pin.** The gauge block also holds `'& .zone[data-rest]': default` (`state-pins.yaml:139-140`), and C3 must keep it. The generated class pin is `:where(.sherpa-tip…)`, which has 0 specificity (`project-tokens.mjs:1004`). It joins the first `/default` host pin, `sherpa-quick-filter[data-pending]` (`state-pins.yaml:30`). That works.
- **M10. C4 can double-announce.** A button whose `data-tip` equals its `aria-label` gets the same words as both name and description. Skip the description when the two are equal.
- **M11. More test sites.**
  - `reforged-quick-filter.spec.ts:319-323` asserts the tip is above the chip and centred within 3px. The prototype never ran it, and the shift fallbacks lose the centring.
  - `reforged-chart-tooltips.spec.ts:332,339`: the `trigger` half of that test also uses the tooltip, so it goes in C6.
  - sherpa-ui's own `reforged-grid-keeps-its-heading.spec.ts:186` presses a real Escape. The risk is low.
- **M12. The Gallery also lists the tooltip** in `app.json:330,389`, not only in its story.
- **M13. Removing the Figma arrow is a Figma change.** It should be a decision for Will (D3), not a "should".
- **M14. A second tooltip system remains.** The native `title` on menu rows and options is what Will asked to remove, so it needs his sign-off as a listed decision.
- **M15. A peer agent is live on this branch.** Every commit must follow the shared-branch rule.

#### On the adversarial questions

- **Clipping:** no step clips a tip. M2 shows an empty pill instead.
- **Double-announce:** M10 only.
- **Chart hover tips:** these work. Gliding from bar to bar and moving from the ring hole onto a slice now open the right tip. A click closes the tip under D2 A.
- **The quick-filter chip (363):** see M3.
- **Tests:** see W3, M6, M7 and M11.

#### Confirmed: 89

Every other file:line claim matches the code at HEAD. They cover:
- the tip mechanism today: `top-layer-tips.ts`, `sherpa-element.ts:22,461-462,961`, `sherpa-anchor.css`, `sherpa-chart-segments.css:39-44`;
- the button: `sherpa-button.html/.css/.ts`;
- the 5 chart tip templates and their `aria-label` lines;
- the chip: `sherpa-quick-filter.html/.css/.ts`;
- `<sherpa-tooltip>`: `.ts:24-28,74-77,106-139` and `.css:21-23,56-71,86-108`;
- the colour and style data: `tokens.css:3961`, `state-pins.yaml:46-51,121-144`, `project-tokens.mjs:976-1013`, `lint-css.mjs:239-240`, the 5 generated blocks in `sherpa-style-modes.css`;
- the TRAPS line numbers at 06f7a4f2;
- the files C6 deletes or edits;
- the test sites and read counts;
- the Escape handling: `sherpa-dialog.ts:68,157-159`, `sherpa-menu.ts:1704`, and the 4 Demos specs.

Nothing in either repo was edited. I wrote one scratch file, `/private/tmp/claude-502/tooltip-study/traps-06f7.md` (`TRAPS.md` as it was at 06f7a4f2).
