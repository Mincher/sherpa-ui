# Sherpa-UI — component specifications

The **contract** for each `sherpa-*` component: what it should DO and which variations it
should support. Grounded in `docs/DESIGN-SYSTEM-FIGMA-REFERENCE.md` (the structural
inventory), live Figma, the component descriptions, and existing code/docs. This is the
target the implementation + visual-diff pass must meet — where code diverges, the code is
wrong unless a `_divergence` note says otherwise.

> **Event-name ratification (2026-09-08):** where an event name in this doc disagreed with the
> name a component actually fires, **the code wins** — the names below have been updated to the
> real dispatched event. Do not rename events in code to match an older spec draft.

## Entry format (agreed on the Button pilot)

Each component gets:
- **Purpose** — one line: what it is / when to use it.
- **Anatomy** — the parts (from Figma), which are optional.
- **Variants** — the discrete named states it must support (Figma variant axes).
- **Properties** — the instance knobs (TEXT/BOOLEAN/INSTANCE_SWAP/SLOT) + their `data-*` names.
- **Appearance / status** — how look-tier (`data-look`) + status (`data-status`) apply (or "n/a").
- **Sizing / geometry** — Structure sizes / snap, if applicable.
- **States** — interactive/visual states (hover, active, disabled, current, error…) and how CSS owns them.
- **Behaviour + events** — what JS does (thin) + the noun-verb events it fires.
- **Composition** — what it composes / is composed by.
- **Notes / divergences** — anything code-specific or intentionally different from Figma.

---

## sherpa-button  (pilot — the agreed template)

- **Purpose:** the primary action control — a clickable button with an optional icon and/or badge.
- **Anatomy:** `.trigger` (the button box) › optional leading icon · label (slot/`data-label`) ·
  optional trailing icon · optional trailing badge. Icon-only form has no label.
- **Variants (Figma set):** `Type = icon | label`. (No primary/secondary/tertiary — that is
  appearance, below.)
- **Properties:** `data-label` (T), `data-icon-start` / `data-icon-end` (INSTANCE_SWAP glyph),
  `data-badge` (T / `badge` slot), native `disabled`.
- **Appearance / status:** emphasis via `data-look` — **omitted = default ("secondary")**:
  white surface, grey border, dark ink; **`saturated` ("primary")**: strong fill + light ink;
  **`transparent` ("tertiary")**: ghost, no fill/border. `data-status` (info/critical/warning/
  urgent/success) tints the active appearance. All routes through the Style `--_status-*` cascade.
- **Sizing / geometry:** Structure size modes `2xs | xs | sm | lg | xl` via `data-size`
  (omitted = base). Corners are snap-aware (`data-snap`) so buttons group seamlessly.
- **States:** hover / active (color-mix derivations of the surface), `:focus-visible` (2px ring),
  `disabled` (inactive tokens per property, never opacity). All CSS-owned off `data-*`.
- **Behaviour + events:** thin JS — mirror label/icons/badge; fire **`button-click`** on activate
  (suppressed when disabled). Native `<button>` gives keyboard/role for free.
- **Composition:** used everywhere; composes into Toolbar, Pagination, Container Footer, Calendar
  (as Calendar Button), etc.
- **Notes / divergences:** the `badge` slot name must not collide with a `data-has-badge` API
  (it doesn't — `data-badge` is the value). Icon glyphs are text-glyph based, not an icon font.

---

# Form controls

## sherpa-switch
- **Purpose:** a binary on/off toggle for a single setting, with an optional inline ON/OFF label.
- **Anatomy:** `<label>` wrapping a native `<input type="checkbox" role="switch">` › track · sliding thumb · optional inline ON/OFF text.
- **Variants:** `Value = off | on`. (`data-style` default|simple is a code appearance knob, not a Figma variant.)
- **Properties:** `hasLabel` (B); native `checked`, `disabled` (reflected JS props).
- **Appearance / status:** ON track = success green (component-scoped `switch-*`), OFF neutral. `data-status` re-inks via cascade but ON=success is intrinsic. No `data-look`.
- **Sizing / geometry:** component-scoped `switch-size/*` + `switch-radius/*` (own tokens, not shared Structure). Rounded-full.
- **States:** hover / :focus-visible / disabled (inactive tokens). CSS-owned off :checked/:disabled.
- **Behaviour + events:** native-first label+input; JS mirrors checked/disabled + re-dispatches native change as composed **`change`** (detail { checked }).
- **Composition:** forms, Menu List Item rows, settings.
- **Notes / divergences:** native change isn't composed → re-dispatch needed. `data-style default|simple` is code-only.

## sherpa-select-checkbox
- **Purpose:** a single labelled checkbox — atomic box + label + optional description.
- **Anatomy:** native `<input type="checkbox">` box+tick/dash · label · optional description.
- **Variants:** none (state is behavioural).
- **Properties:** `data-label` (T), `data-description` (T), `hasDescription` (B); native name/value/required/disabled; JS checked/indeterminate/value.
- **Appearance / status:** box=control-surface/default+control-border/default, indicator=control-indicator/accent, tick=control-content/on-accent. `data-status` tints. No `data-look`.
- **Sizing / geometry:** fixed 16×16 atom; shared type roles. No snap.
- **States:** checked / indeterminate (dash) / hover / :focus-visible / disabled — CSS-owned.
- **Behaviour + events:** thin wrapper; mirrors attrs, re-fires composed **`change`** (detail { checked, value, indeterminate }).
- **Composition:** Fieldset, Menu List Item checkbox rows, Grid Cell selection.
- **Notes / divergences:** formalised component; atomic Checkbox box is its sub-part.

## sherpa-select-radio
- **Purpose:** a single labelled radio — atomic circle+dot + label + optional description.
- **Anatomy:** native `<input type="radio">` circle+dot · label · optional description.
- **Variants:** none.
- **Properties:** `data-label` (T), `data-description` (T), `hasDescription` (B); native name/value/required/disabled; JS checked/value. Shared `name` groups natively.
- **Appearance / status:** same control-surface/border/indicator/content pattern as checkbox. `data-status` tints. No `data-look`.
- **Sizing / geometry:** fixed atom; shared type roles. No snap.
- **States:** checked (dot) / hover / :focus-visible / disabled — CSS-owned.
- **Behaviour + events:** thin wrapper; re-fires composed **`change`** (detail { checked, value }). Native name grouping = mutual exclusion.
- **Composition:** Fieldset, Select Card footer, Menu List Item.
- **Notes / divergences:** formalised alongside Select Checkbox.

## sherpa-select-group  (Figma "Fieldset")
- **Purpose:** groups selectable controls under a legend with one group validation line.
- **Anatomy:** legend (Section Header) › divider › `options` slot (Select Checkbox/Radio children, light-DOM) › validation line. Description + validation optional.
- **Variants:** none (multi-vs-single is a property).
- **Properties:** `legend`→`data-label` (T), `description`→`data-description` (T), `hasDescription` (B), `validation`→`data-error` (T), `hasValidation` (B), `options` (SLOT). Code `data-multiple` (B: set=checkboxes, omitted=radios). `populate([{value,label,description?,disabled?}])`.
- **Appearance / status:** neutral; `data-status`/`data-error` re-ink heading+validation via cascade. No `data-look`.
- **Sizing / geometry:** stack; shared type roles. No snap.
- **States:** error (validation shown) / status-tinted — CSS-owned; child states on children.
- **Behaviour + events:** aggregates children's composed change → re-emits composed **`change`** (detail { value }: string[] when multiple, else string|null).
- **Composition:** composes Select Checkbox/Radio; in forms/flows.
- **Notes / divergences:** legend = Section Header instance; public API is the code contract.

## sherpa-slider
- **Purpose:** pick one value from a numeric range by dragging or typing.
- **Anatomy:** optional label › row [track (fill + thumb)] [optional editable value input].
- **Variants:** none.
- **Properties:** `data-label` (T), Figma `fill`/`fill-secondary` (SLOT); native min/max/step/value/disabled; code `data-show-value` (B), `data-value-readonly` (B); JS value (clamped).
- **Appearance / status:** accent fill; `data-status` tints. No `data-look`.
- **Sizing / geometry:** value input uses display-size tokens; track full-width. No snap.
- **States:** hover / dragging / :focus-visible / disabled — CSS-owned. JS gives CSS the fill length (`--_*`).
- **Behaviour + events:** native `<input type=range>` for drag/keyboard/a11y; JS copies attrs, sets fill prop, re-fires **`input`** (during drag) + **`change`** (on commit), detail { value }.
- **Composition:** standalone; pairs with value Input.
- **Notes / divergences:** fill = resized slot (Figma) / private CSS var (code) — same trick as Progress Bar.

## sherpa-input-text  (Figma "Input Field")
- **Purpose:** a single/multi-line text field with a label — the standard form input.
- **Anatomy:** label › optional description › control-row [optional leading icon · native input/textarea · optional trailing icon · optional `actions` slot] › optional validation bar · optional helper.
- **Variants:** `State = default | error` (style-only).
- **Properties:** `data-label`, `data-description`, `data-error` (T), `data-icon-start`/`data-icon-end` (glyph), `actions` (SLOT), `hasLeadingIcon`/`hasTrailingIcon`/`hasActions` (B); native placeholder/name/value/required/disabled/readonly/minlength/maxlength/pattern/inputmode/autocomplete; code `data-multiline` (B), `data-style=minimal`.
- **Appearance / status:** neutral control-row; error State + `data-error` shows a FILLED critical validation bar; `data-status` tints. No `data-look`.
- **Sizing / geometry:** display-size tokens; numeric values right-aligned + mono, text left/body. No snap.
- **States:** hover / :focus-visible / disabled / error — CSS-owned; `data-has-actions` auto-set from slot presence.
- **Behaviour + events:** thin JS mirrors label/desc/error/icons/attrs, exposes value, re-fires **`input`** (keystroke) + **`change`** (commit), detail { value }.
- **Composition:** Toolbar, Pagination (page-size), Prompt Composer, View Header, Slider value, Calendar time inputs.
- **Notes / divergences:** intentionally a fuller molecule than the Figma atom; one Figma "Input Field" → many HTML type components (each its own set + Layout axis).

---

# Chips · tags · indicators

## sherpa-tag
- **Purpose:** a compact labelled pill for status/metadata.
- **Anatomy:** `.pill` › optional leading `.icon` (slot `icon`/`data-icon`) · `.label` (slot) · optional `.close`. `dot` form = bare status dot.
- **Variants:** `Type = full | dot`.
- **Properties:** `data-label`/slot (T), `data-icon`+`icon` slot, `data-dismissible` (B), `data-type="dot"`.
- **Appearance / status:** neutral by default; `data-status` (info/success/warning/critical/urgent) drives fill/border/text via cascade; content/inverse for dark label on light fill. No `data-look`.
- **Sizing / geometry:** Structure sizes; dismiss = xs icon Button; pill radius (not snap-grouped).
- **States:** hover/active on dismiss only; pill static. CSS-owned.
- **Behaviour + events:** thin JS mirrors icon; dismiss fires **`tag-remove`** (app removes it).
- **Composition:** Nav Item, list rows, cards, headers; composes dismiss Button.
- **Notes / divergences:** app-driven removal (component doesn't self-remove).

## sherpa-chip
- **Purpose:** status-tinted pill with icon + label + built-in dismiss (chip-shaped, dismiss-first).
- **Anatomy:** `.pill` › optional `.icon` · `.label` (slot) · optional `.close`.
- **Variants:** none.
- **Properties:** `data-label`/slot (T), `data-icon`+`icon` slot, `data-dismissible` (B).
- **Appearance / status:** bordered pill (subtle surface, grey border, dark ink); colour via `data-status` cascade. No `data-look`.
- **Sizing / geometry:** Structure sizes; dismiss = xs icon Button; pill radius.
- **States:** hover/active on dismiss; pill static. CSS-owned.
- **Behaviour + events:** thin JS mirrors icon; dismiss fires **`chip-remove`** (detail {}).
- **Composition:** near-identical shape to Tag; composes dismiss Button.
- **Notes / divergences:** distinct from Tag (dismiss-oriented); keep `chip-remove` ≠ `tag-remove`.

## sherpa-quick-filter  (Figma "Filter Chip atom")
- **Purpose:** a single toggleable filter chip (brand-purple), in the Quick Filter Toolbar.
- **Anatomy:** `.chip` › optional leading `.icon` (`data-icon-start`) · `.label` · optional `.count` · optional trailing chevron · optional indicator.
- **Variants:** `State = default`.
- **Properties:** `data-label` (T), `data-count` (T), `data-icon-start` (B/glyph), `hasMenu`→chevron, `hasIndicator`, `hasLabel`; native disabled; `data-current` (+ `current` JS prop); `data-icon-only` reduces the chip to JUST its menu button — a 24 square with a funnel, body/count/indicator/value-label all hidden in CSS — for a filter affordance whose field is named elsewhere (a data-grid column heading). Pair it with `data-locked` wherever the menu holds no tickable rows, or the chip reads "nothing ticked" as "off".
- **Appearance / status:** brand purple accent (AI/quick-filter, not action accent); on-tint/count/caret/disabled all CSS off `data-current`/`disabled`. No `data-look`.
- **Sizing / geometry:** Structure sizes; pill radius.
- **States:** default · current · inactive/disabled (click guarded). CSS-owned.
- **Behaviour + events:** toggles `data-current`, fires **`quick-filter-click`** (detail { active }); a slotted menu's commit fires **`quick-filter-change`** (detail { values }).
- **Label rule:** with EXACTLY ONE menu value picked the chip rewrites `data-label` to `Field: Value` (the row's visible text, not its raw value). Two or more revert to the bare field name and let `data-count` carry the number.
- **Count rule:** `data-count` means **how many VALUES are picked**, never how many rows match. A menu sets it only at **2 or more** picks — at one the label already names the value — so the badge never reads `1`, and a plain toggle chip never gets one. Hovering the badge reveals `.count-tip` above it listing the chosen values (CSS-only; the same list is on the badge's `aria-label`, since the bubble is `aria-hidden`).
- **Composition:** composed-by quick-filter-toolbar.
- **Notes / divergences:** GAP — Figma intent also names quick-filter-menu-open/-dismiss/-ai-accept; code fires only quick-filter-click (menu/dismiss/AI unimplemented).

## sherpa-quick-filter-toolbar  (Figma "Filter Toolbar")
- **Purpose:** a bar of quick-filter chips + a slot for host action controls.
- **Anatomy:** `view` slot (leading) · `.organise-zone` (Group/Sort) · `.chips` · `.actions-zone` (the built-in action cluster). Cloning prototype stamps chips.
- **Variants:** `Type = data | view` (Figma), implemented as `data-type`. `view` adds the snapped ★|Save|▾ group to the cluster.
- **Properties:** `data-type = data | view`, `data-no-actions` (hide the cluster), `data-favourite`; chips via `populate([{id,label,type?,active?,icon?,options?,select?}])`; Group/Sort columns via `organise({group,sort})`; `actions` (SLOT, host extras, rendered BEFORE the cluster), `view` (SLOT). No `count` — a badge on a toggle chip could only mean a RESULT count, which a host with a server-side query does not know when the bar is built.
- **Appearance / status:** neutral toolbar; chips carry brand purple; cluster buttons are `data-look="transparent"` (tertiary). A lit ★ takes the brand ink (`theme-content-active-2`), matching app-header's own favourite.
- **Sizing / geometry:** full-width; Structure sizes for chips. The cluster is `flex: 0 0 auto` with `margin-inline-start: auto`, so it stays at the trailing edge even when the chip run wraps.
- **States:** per-chip current; `data-favourite` on the host. CSS-owned.
- **Behaviour + events:** `addCustomFilter({id,label,value})` is public — it puts a chip whose value was TYPED, not picked, on the bar (the data grid's column filters); same id replaces, null value removes. Such chips carry `data-custom` and are reported in `quick-filter-change`'s `custom` map (`{id: on}`) — they appear in neither `active` (which skips menu chips) nor `values` (which reads ticked rows), so without it a host could not see one turned off. `customFilters` is the getter. `quick-filter-change` (detail { active, values, picked }), `group-change`, `sort-change`, plus the cluster: `filter-add`, `filter-clear`, `ai-filter-request`, `filter-configure`, `data-refresh`, `filter-overflow`, and for `view`: `view-save`, `view-favorite` (detail { favourite }), `view-menu-open`. `clearAll()` is public — the undo button resets rather than merely announcing.
- **Composition:** composes quick-filter + button; above Grid/List, or in app-header's `filters` slot (the view-level bar).
- **Notes / divergences:** the action cluster is now BUILT IN, reversing the earlier "delegated to slots" decision (Will, 2026-09-11) — Figma models it as one component and every host had to rebuild the same seven buttons. The view group's snapped corners are set in the toolbar's own CSS, NOT by `data-snap`: that selector lives in tokens.css, which is loaded into the document and deliberately not in `sharedStyles`, so it never reaches a button inside a shadow root.

## sherpa-loader  (Figma "Loading Spinner atom")
- **Purpose:** an indeterminate spinner for unknown-duration work.
- **Anatomy:** track ring + accent arc + optional `label`.
- **Variants:** `Size = sm | md | lg` (default md) via `data-size`.
- **Properties:** `data-size`, `data-orientation = horizontal | vertical`, `data-panel` (B), `label` slot / `hasLabel` (B).
- **Appearance / status:** accent arc (`style-indicator/accent` #3b4ccd) on neutral track; `data-status` may tint. No `data-look`.
- **Sizing / geometry:** per-component sm/md/lg (not shared Structure).
- **States:** always animating; no interactive states; motion CSS (degrades). CSS-owned.
- **Behaviour + events:** minimal JS sets role="status" + aria-live="polite". No events.
- **Composition:** in Containers/buttons/panels/overlays.
- **Notes / divergences:** indeterminate only; determinate = progress-bar.

## sherpa-progress-bar  (Figma "Progress Bar atom")
- **Purpose:** determinate horizontal progress for known-duration work.
- **Anatomy:** optional `.label` › full-width rounded `.bar` track with a fill sized to value.
- **Variants:** none.
- **Properties:** `value` (0–100, native `<progress>`), `data-indeterminate` (B), `data-label` (T), `data-status`. Figma models fill as a `fill(SLOT)`.
- **Appearance / status:** neutral track; fill = accent (#3b4ccd), tinted by `data-status`. Rounded-full. No `data-look`.
- **Sizing / geometry:** full-width; Structure sizes for height.
- **States:** determinate (value fill) vs `data-indeterminate` (sweep). Display-only, CSS-owned.
- **Behaviour + events:** thin JS mirrors value/indeterminate + label onto native `<progress>`. No events.
- **Composition:** pairs with loader; File Uploader, flows.
- **Notes / divergences:** code uses native `<progress>` (native role/aria) vs Figma `fill(SLOT)` workaround — intentional native-first.

## sherpa-tooltip  (Figma "Tooltip atom")
- **Purpose:** a small hover/focus hint bubble describing the wrapped element.
- **Anatomy:** default slot (trigger) · dark `.bubble` with white `.tip-text` + ONE rotatable pointer wedge + shadow (9-slice).
- **Variants:** none (placement is a property).
- **Properties:** `data-text` (T), `data-placement = top|bottom|left|right` (default top), `tip` slot (rich), default slot (trigger).
- **Appearance / status:** fixed dark bubble + white text (not status-tinted). No `data-look`/`data-status`.
- **Sizing / geometry:** bubble hugs content; positioned per placement; one wedge CSS-rotated.
- **States:** shown on hover + :focus-visible of the trigger — pure CSS, no JS toggling.
- **Behaviour + events:** minimal JS mirrors data-text + wires aria-describedby. No events.
- **Composition:** wraps any trigger.
- **Notes / divergences:** canonical native-first (CSS hover/focus visibility).

---

# Containers · surfaces

## sherpa-container
- **Purpose:** base inline surface (card) with header/content/footer + loading/empty/error states; the tier the others specialise.
- **Anatomy:** `.header` slot (opt) › `.body` (default) › `.footer` slot (opt) › `.state` overlay (loading/empty/error). Chrome collapses when empty.
- **Variants:** none (type = element name now). Code `data-variant = fill | fit` (hug vs stretch layout).
- **Properties:** `hasHeader`/`hasFooter` (B) → reflected `data-has-*`; `content` (SLOT) = default. Code: `data-elevation`, `data-padding`, `data-loading`, slot-driven empty/error.
- **Appearance / status:** NO `data-look` (a surface, not a control). `data-status` recolours + cascades `--_status-*`; SUBTLE default.
- **Sizing / geometry:** `fit` hugs / `fill` stretches; rounded base (snap where grouped).
- **States:** loading / empty / error (overlay). Passive. CSS-owned off `data-*`/`data-has-*`.
- **Behaviour + events:** fires nothing; consumers wire controls into slots.
- **Composition:** composed-by Dialog/Panel/Overlay Panel/Accordion/Callout; composes Container Header/Footer.
- **Notes / divergences:** loading/empty/error + `data-elevation`/`data-padding` are runtime chrome beyond Figma's prop list.

## sherpa-panel
- **Purpose:** a persistent in-flow panel (not floating, not disclosure).
- **Anatomy:** `<section>.root` › `.header` (slot + `.heading-text`) › `.body` (default) › `.footer` (slot).
- **Variants:** none (specialisation of Container).
- **Properties:** `hasHeader`/`hasFooter` (B) → `data-has-*`; `content` (SLOT); `data-heading` (T), `data-collapsed` (B).
- **Appearance / status:** no `data-look`; `data-status` cascades.
- **Sizing / geometry:** grows in flow; rounded base.
- **States:** `data-collapsed` (CSS hide of body/footer). CSS-owned.
- **Behaviour + events:** fires nothing; JS mirrors heading + collapse.
- **Composition:** composes Container Header (rich chrome lives there), Container Footer.
- **Notes / divergences:** native `<section>`, not `<dialog>`/`<details>` (D2/D12).

## sherpa-dialog
- **Purpose:** modal surface on native `<dialog>` — blocks page, dims, traps focus.
- **Anatomy:** `<dialog>.root` › `.header` (slot + `.heading-text`) › `.body` (default) › `.footer` (slot). Native `::backdrop`.
- **Variants:** none.
- **Properties:** `hasHeader`/`hasFooter` (B) → `data-has-*`; `content` (SLOT); `data-heading` (T); native `open` (get reflects, set = showModal/close).
- **Appearance / status:** no `data-look`; `data-status` cascades.
- **Sizing / geometry:** content-sized, top-layer; rounded base.
- **States:** open/closed via native `open`; focus-trap/ESC/top-layer native. CSS/native-owned.
- **Behaviour + events:** thin JS; re-dispatches native close as composed **`close`** (detail {}).
- **Composition:** composes Container Header/Footer; orchestrated by FlowManager.
- **Notes / divergences:** native `.showModal()`; doesn't build header chrome (compose Container Header).

## sherpa-overlay-panel
- **Purpose:** NON-modal floating panel (top layer, no backdrop/trap/ESC).
- **Anatomy:** `<dialog>.root` (show()) › rich `.header` [icon · link-style title · description metadata row · `.toolbar` collapse/expand/external/close] › `.body` (default) › `.footer` (slot).
- **Variants:** none.
- **Properties:** `hasFooter` (B) → `data-has-footer`; `content` (SLOT); `data-icon`, `data-title` (T); native `open` (show()/close()); `data-collapsed`; toolbar toggles `data-collapsible`/`data-expandable`/`data-external`/`data-dismissible`; slots icon/description/default/footer.
- **Appearance / status:** no `data-look`; `data-status` cascades.
- **Sizing / geometry:** floats content-sized; rounded base; toolbar buttons Transparent icon-buttons.
- **States:** open/closed (native open via show()), `data-collapsed`; toolbar buttons opt-in per `data-*`, CSS-gated.
- **Behaviour + events:** wires four toolbar buttons; fires **`panel-collapse`** ({ collapsed }), **`panel-expand`** ({}), **`panel-external`** ({}), **`close`** ({}).
- **Composition:** composes Container Footer; header mirrors Container Header (Panel).
- **Notes / divergences:** `.show()` over Popover API to share dialog structure; DOES build its own header chrome.

## sherpa-accordion
- **Purpose:** standalone disclosure card on native `<details>`/`<summary>`.
- **Anatomy:** `<details>.root` › `<summary>.header` [`.titles` (`.heading` + optional `.description`) + trailing `.chevron`] › `.body` (default).
- **Variants:** none.
- **Properties:** `hasHeader` (B); `content` (SLOT); `data-heading` (T; slot overrides), `data-description` (T; slot overrides), native `open`.
- **Appearance / status:** no `data-look`; `data-status` cascades.
- **Sizing / geometry:** grows on disclosure; rounded base; chevron rotates via CSS on `[open]`.
- **States:** open/closed = native `<details open>` (no `data-*`); `<summary>` = button role/keyboard/focus free.
- **Behaviour + events:** clicking summary toggles natively; JS re-dispatches native toggle as composed **`toggle`** (detail { open }).
- **Composition:** body accepts any content.
- **Notes / divergences:** native details/summary (D2/D12) — `data-expanded` must TRACK native `open`, not be a second source of truth. RATIFIED 2026-09-08 (visual-diff): the code keeps the **native `<details>/<summary>`** shape (progressive-enhancement: works without JS, free keyboard/a11y) and does NOT rebuild to Figma's Container-Header + body + Container-Footer composition. Consequences vs Figma: bespoke summary + CSS chevron instead of a Button toggle, and **no footer region** (add a footer slot only if a concrete need appears). Figma's Accordion-as-Container is the design reference, not the code contract.

## sherpa-container-header
- **Purpose:** the header bar for a container's `header` slot.
- **Anatomy:** `.header` › `.row` [`.drag` (opt) · `.icon` (slot, opt) · `.labels` (`.title` + `.description`) · `.actions` (slot + `.toggle` + `.close`)] › `.metadata` slot row.
- **Variants:** `Variant = default | accordion | Panel`. Code = default|panel; accordion = default + `data-collapsible`.
- **Properties:** `heading`→`data-heading`, `hasDragHandle`→`data-draggable`, `hasActions`→`data-has-actions`, `actions` (SLOT), `hasIcon`→`data-icon`+`icon` slot, `metadata` (SLOT)+`hasMetadata`; code `data-description`, `data-dismissible`, `data-collapsible`, `data-collapsed`.
- **Appearance / status:** no `data-look`; `data-status` cascades (inherits from container).
- **Sizing / geometry:** header strip; trailing = Transparent icon-buttons, snap-aware when grouped (Panel).
- **States:** `data-collapsed` rotates toggle + aria-expanded; hover on buttons. Visibility CSS-gated.
- **Behaviour + events:** fires **`header-dismiss`** ({}), **`header-collapse`** ({ collapsed }), **`header-drag`** ({}).
- **Composition:** composed-by Container/Panel/Dialog; composes Button.
- **Notes / divergences:** Figma `accordion` variant = `data-collapsible` on default; standalone disclosure card = sherpa-accordion. `Panel`→`panel`.

## sherpa-container-footer
- **Purpose:** the footer bar for a container's `footer` slot — a row of slotted controls with a top divider.
- **Anatomy:** `<footer>.row` › default slot; top divider; appears only when slot has content.
- **Variants:** `Type = action-bar` (single value).
- **Properties:** `content` (SLOT) → `data-has-content`. Figma `left`+`right` (SLOT); code models left/right via `data-align = start | end (default) | between`. `data-accepts="control,input"`.
- **Appearance / status:** no `data-look`; `data-status` cascades from container.
- **Sizing / geometry:** full-width strip.
- **States:** none of its own (empty→hidden); slotted controls carry states.
- **Behaviour + events:** fires nothing; slotted controls emit their own (footer-cancel/footer-apply are slotted-button conventions).
- **Composition:** composed-by Container/Dialog/Panel/Overlay Panel/Calendar; composes Button.
- **Notes / divergences:** RATIFIED 2026-09-08 → single default slot + `data-align start|end|between` (Figma's discrete left/right slots are dropped).

## sherpa-select-card
- **Purpose:** a selectable gallery card (whole card is the pick target) with a footer radio/checkbox.
- **Anatomy:** `.card` › `.header` (slot, else `.label`+`.description`) › `.body` (default) › `.footer` (slot, else pre-placed radio+checkbox, one shown per mode).
- **Variants:** none.
- **Properties:** `data-label`, `data-description` (T), `data-selected` (B + JS prop), `data-select-mode = radio|checkbox` (default radio), `data-orientation`, `data-footer=none`, native disabled/value/name; slots header/default/footer.
- **Appearance / status:** no `data-look`; `data-status` tints; `data-selected` = selected look.
- **Sizing / geometry:** `data-orientation` places footer beside/below; rounded base.
- **States:** selected / disabled (inactive tokens) / hover — CSS-owned; footer control synced to host.
- **Behaviour + events:** click toggles + fires **`change`** (detail { selected, value }).
- **Composition:** composes Select Radio + Select Checkbox in the footer.
- **Notes / divergences:** RATIFIED 2026-09-08 → fires **`change`** (detail { selected, value }); the Figma card-click/card-select names are dropped. Both controls pre-placed + CSS-gated (no createElement).

---

# Feedback · messaging

## sherpa-callout
- **Purpose:** inline subtle-status contextual message (Container-tier note).
- **Anatomy:** `.box` (2-col GRID) › icon column (spans rows) | `.content` (title + message slot + optional action) · optional `.close`.
- **Variants:** none.
- **Properties:** `data-heading` (T); default slot = body; `data-dismissible` (B); `data-status`.
- **Appearance / status:** SUBTLE by default; box surface NEUTRAL, status hue on the ICON BADGE only; `data-status` via cascade. No `data-look`.
- **Sizing / geometry:** fixed padding-lg; rounding. No snap.
- **States:** close:focus-visible; hover on close/action; status states. CSS-owned.
- **Behaviour + events:** mirror heading; dismiss fires **`callout-dismiss`**. GAP: Figma intent `callout-toggle` (expand/collapse) NOT yet in code.
- **Composition:** a Container variant; composes icon + optional Button.
- **Notes / divergences:** Figma exposes only `heading`; code adds `data-dismissible`+`data-status`. Missing `callout-toggle`.

## sherpa-banner  ⚠️ no code yet
- **Purpose:** full-width page-level status announcement (message + optional link).
- **Anatomy:** row › icon · message · optional link. Full-bleed.
- **Variants:** none (node 62:274).
- **Properties:** `message` (T)→`data-message`; `hasLink` (B, default true)→`data-has-link`/`link` slot.
- **Appearance / status:** Info+Subtle default; `data-status` via cascade.
- **Sizing / geometry:** full-width; no size axis.
- **States:** hover/:focus-visible on link; status states. CSS-owned.
- **Behaviour + events:** display chrome; link = native `<a>`. No Sherpa event defined.
- **Composition:** page-level; composes icon + native link.
- **Notes / divergences:** NO code dir yet — build native-first, status-driven, `data-message` + `link` slot.

## sherpa-toast
- **Purpose:** transient elevated status notification with optional action.
- **Anatomy:** `.toast` (role="alert") › `.icon` badge · `.content` (`.heading` slot + optional `.value` + optional `.action`) · optional `.close`.
- **Variants:** none.
- **Properties:** `data-heading`/slot (T), `data-value` (T), `data-action` (T), `data-duration` (ms, default 5000, 0=off). Figma `hasClose`/`hasAction`.
- **Appearance / status:** card NEUTRAL, status hue on the icon badge; Info default; `data-status` via cascade. No `data-look`.
- **Sizing / geometry:** Elevation md pinned (floats); rounding. No snap.
- **States:** action:focus-visible; hover; presence states. CSS-owned.
- **Behaviour + events:** auto-dismiss timer; fires **`toast-dismiss`** (close/timeout) + **`toast-action`** (action). (Figma close/action → ratified names.)
- **Composition:** stacked in a region; composes icon + Button.
- **Notes / divergences:** event names diverge from Figma close/action by design; `data-duration`+auto-dismiss are code additions.

## sherpa-empty-state
- **Purpose:** centred placeholder for blank list/grid/region (zero-data/first-run).
- **Anatomy:** `.empty` (centred col) › `.icon` tile (slot/glyph) · `.heading` (title + message slot) · `.actions` (slot) · `.small-print` (slot).
- **Variants:** none.
- **Properties:** `data-heading`, `data-description`, `data-small-print` (T), `data-illustration` (empty|search|folder|data|error|success) or `icon` slot; Figma hasSmallPrint/hasActions.
- **Appearance / status:** NEUTRAL — n/a status/look (grey tokens).
- **Sizing / geometry:** `data-size = sm|md|lg` (component-local). No snap.
- **States:** presence states only; CTA states on slotted Button. CSS-owned.
- **Behaviour + events:** display-only — NO events (actions are slotted Buttons).
- **Composition:** in a List/Grid/Panel; composes icon + Button(s).
- **Notes / divergences:** `data-illustration` + `data-size` are code extensions. Icon tile = grey rounded surface/default+2.

## sherpa-section-header
- **Purpose:** semantic heading row titling a section (heading + description + actions + optional divider).
- **Anatomy:** `<header>.row` › `.lead` (heading slot + `.description` slot) · `.actions` (slot, right/fill) · optional `<hr>.divider`.
- **Variants:** none.
- **Properties:** `data-heading`, `data-description` (T), `data-divider` (B); Figma hasDivider/hasActions/hasDescription + `Actions` SLOT.
- **Appearance / status:** NEUTRAL — n/a status/look.
- **Sizing / geometry:** `data-size = sm|md|lg` (component-local). No snap.
- **States:** presence states only; actions carry their own. CSS-owned.
- **Behaviour + events:** display-only — NO events.
- **Composition:** atop Panels/Lists/Fieldsets; composes Button(s).
- **Notes / divergences:** native `<header>`+`<hr>`; `data-size` is a code extension.

## sherpa-chat-message
- **Purpose:** a single chat bubble (AI/messaging thread); compose many for a conversation.
- **Anatomy:** `<article>.message` (grid) › optional `.avatar` (slot) · `.stack` (`.meta` = `.author` + `<time>` · `.bubble` = content + default slot).
- **Variants:** `Type = assistant | user | system` (left/neutral, right/accent, centred/muted).
- **Properties:** `data-author`/`data-name` (T, alias), `data-timestamp`/`data-time` (T, alias), `data-content`/`data-message` (T, alias; slot overrides), `hasAvatar` (B).
- **Appearance / status:** bubble colour driven by `Type` (user=accent, system=muted); NOT `data-status`. No `data-look`.
- **Sizing / geometry:** bubble corners group-aware (snap) for same-author clusters; no size axis.
- **States:** presence states only. Display-only. CSS-owned.
- **Behaviour + events:** display-only — NO events; JS mirrors fields + resolves aliases.
- **Composition:** into a thread; composes avatar + native `<time>`.
- **Notes / divergences:** dual aliases reconcile Figma prop names with code; default variant = assistant.

## sherpa-prompt-composer
- **Purpose:** AI prompt input (growing textarea + leading tool buttons + send), brand purple.
- **Anatomy:** `<form>.form` › `.input` (`<textarea rows=1>` auto-grow) · `.tools` (`.leading` = attach + lab + `extras` slot · `.send`).
- **Variants:** none.
- **Properties:** `data-placeholder` (T), `data-no-leading-actions` (B), native disabled, JS `value` + `clear()`. Figma `hasLeadingActions`.
- **Appearance / status:** brand-purple send (accent). n/a status.
- **Sizing / geometry:** buttons off structure-height; rounding. No snap.
- **States:** disabled (all controls), lead-btn:focus-visible, has-extras. Native submit/validation/reset.
- **Behaviour + events:** Enter/send fires **`prompt-submit`** ({ text }) when non-empty; attach fires **`composer-attach`**; lab fires **`composer-lab`**.
- **Composition:** composes Input (textarea) + Button(s); pairs with Chat Message.
- **Notes / divergences:** `data-no-leading-actions` (negated), value prop, composer-attach/lab are code additions beyond Figma's single prompt-submit.

## sherpa-code-block
- **Purpose:** monospace code panel (optional header + line-number gutter + body).
- **Anatomy:** `.header` (`.language` label + `.copy` button) · `<pre>.pre` › `<code>.code` (`.gutter` numbers + `.code-text` default slot).
- **Variants:** none.
- **Properties:** `data-code` (T/slot), `data-language` (T), `data-line-numbers` (B), JS `code`. Figma hasHeader/hasLineNumbers.
- **Appearance / status:** neutral surfaces (code on tinted panel, header white); copied state = success tokens. n/a status/look.
- **Sizing / geometry:** no size axis; header/copy off display-size/structure-space. No snap.
- **States:** `data-copied` (transient), `data-line-numbers` (gutter), copy:focus-visible. CSS-owned.
- **Behaviour + events:** copy writes clipboard + fires **`code-copy`** (detail { code }), toggles `data-copied`.
- **Composition:** composes Button (copy) + native pre/code.
- **Notes / divergences:** Figma desc lists code-copied/code-highlight-error/code-language-detected; code = only `code-copy`. Highlight/language-detect are stubs (highlighting out of scope). Lowercase language label; tinted panel.

## sherpa-progress-step-tracker  (Figma "Progress Steps")
- **Purpose:** horizontal stepper showing ordered progress; one step current.
- **Anatomy:** `<ol>.steps` (role=list) of cloned `.step` `<li>` › `.marker` (`.number`+`.check`) · `.text` (`.label`+`.description`) · connectors.
- **Variants:** none; per-step state Complete/Current/Inactive (data-driven).
- **Properties:** Figma `Content` (SLOT); code JS props `steps` (array) + `currentStep`/`data-current-step` (0-based).
- **Appearance / status:** markers use style-surface/content; complete=filled/check, current=accent ring, inactive=muted. n/a status knob.
- **Sizing / geometry:** markers off display-size-xl; connector display-border-width-lg. No public size axis; no snap.
- **States:** per-step complete/current/inactive (CSS off current index); marker :focus-visible + aria-current="step".
- **Behaviour + events:** clicking a step fires **`step-click`** (detail { index, label }). GAP: Figma `step-change` (advance) not yet in code.
- **Composition:** composes step markers + connectors (Progress Step/Connector atoms). Cloning-prototype template.
- **Notes / divergences:** name maps to Figma "Progress Steps"; `step-change` missing; data-driven via steps/currentStep not the Figma Content slot.

---

# Navigation · lists · structure

## sherpa-breadcrumbs
- **Purpose:** show the path back up the page hierarchy (a trail of links).
- **Anatomy:** `<nav aria-label="Breadcrumb">` › `<ol>` of cloned `<li>` crumbs (link + separator); last = current page (no link).
- **Variants:** none.
- **Properties:** Figma = none; code JS prop `items` (array of { label, href }); `data-current` marks the last.
- **Appearance / status:** NEUTRAL — n/a look/status.
- **Sizing / geometry:** no size axis; no snap.
- **States:** hover/:focus-visible on links; current = plain text (aria-current="page"). CSS-owned.
- **Behaviour + events:** clicking a crumb fires **`breadcrumb-select`** (detail { index, href, label }).
- **Composition:** composes native links; sits in app/view chrome.
- **Notes / divergences:** RATIFIED 2026-09-08 → fires **`breadcrumb-select`** (the Figma breadcrumb-click name is dropped). Active crumb marked with `aria-current="page"`. Cloning-prototype `<li>`.

## sherpa-tabs  (Figma "Tab Group")
- **Purpose:** switch between sibling views; one tab active.
- **Anatomy:** `<div role="tablist">` (tablist SLOT of `sherpa-tab`) + slotted panels.
- **Variants:** none.
- **Properties:** Figma `tablist` (SLOT); code `data-active` (index/id), JS wiring.
- **Appearance / status:** tab surface = a SURFACE not a control (active tab reads as raised surface); n/a `data-look`.
- **Sizing / geometry:** no size axis; snap where a tab abuts panel edge.
- **States:** active (aria-selected) / hover / :focus-visible / disabled. CSS-owned off `data-active`.
- **Behaviour + events:** roving-tab keyboard; selecting fires **`tab-change`** (detail { index/id }). GAP: Figma `tab-load` (lazy panel) not in code.
- **Composition:** composes sherpa-tab; wraps panels.
- **Notes / divergences:** active tab styled as surface (ratified earlier). `tab-load` missing.

## sherpa-tab
- **Purpose:** one clickable tab inside a Tab Group.
- **Anatomy:** `<button role="tab">` › optional icon · label · optional count.
- **Variants:** none.
- **Properties:** `data-label` (T), `data-active` (B), native disabled.
- **Appearance / status:** surface-like (see Tab Group); n/a `data-look`.
- **Sizing / geometry:** no size axis; snap-aware in the strip.
- **States:** active / hover / :focus-visible / disabled. CSS-owned.
- **Behaviour + events:** click bubbles to Tab Group (which fires `tab-change`); no own event.
- **Composition:** composed-by Tab Group.
- **Notes / divergences:** thin; state driven by parent.

## sherpa-pagination
- **Purpose:** page through a long list/grid (prev/next + page numbers + result count).
- **Anatomy:** `<nav>` › result text (opt) · prev button · page-number buttons (cloned) · next button.
- **Variants:** none.
- **Properties:** `data-page-size`, `data-current-page`, `data-total-pages` (T/num), `data-has-results` (B).
- **Appearance / status:** buttons are Transparent-look; current page = filled/accent; n/a `data-status`.
- **Sizing / geometry:** no size axis; no snap.
- **States:** current (aria-current) / disabled prev-next at bounds / hover / :focus-visible. CSS-owned.
- **Behaviour + events:** clicking fires **`page-change`** (detail { page }).
- **Composition:** composes Button(s); sits under List/Grid.
- **Notes / divergences:** page numbers = cloning prototype.

## sherpa-list
- **Purpose:** a semantic container for a stack of list items.
- **Anatomy:** `<ul>`/`<ol>` (role=list) › default slot of items; empty-state slot.
- **Variants:** none.
- **Properties:** Figma none; code `data-empty` (B) + empty slot.
- **Appearance / status:** NEUTRAL — n/a look/status.
- **Sizing / geometry:** no size axis; no snap.
- **States:** empty (shows empty slot). CSS-owned.
- **Behaviour + events:** display-only — NO events (items emit their own).
- **Composition:** composes List Item / Menu List Item / Empty State.
- **Notes / divergences:** thin semantic wrapper.

## sherpa-list-item  (Figma "Menu List Item")
- **Purpose:** one row in a list/menu: leading control/icon · label+description · trailing.
- **Anatomy:** `.row` › `.drag` (opt) · `.leading-control` (swap/slot, opt) · `.leading-icon` (opt) · `.text` (`.label`+`.description`) · `.trailing` (slot) · `.expand` chevron (opt).
- **Variants:** none.
- **Properties:** `data-label`, `data-description` (T), `hasDescription`→`data-has-description`, `hasLeadingIcon`→`data-icon`, `hasDragHandle`→`data-draggable`, `leadingControl`(swap)+`hasLeadingControl`, `hasLeading`, `hasExpand`→`data-expandable`, `trailing` (SLOT).
- **Appearance / status:** neutral row; selected/active tint; `data-status` cascade allowed; no `data-look`.
- **Sizing / geometry:** no public size axis; snap in a grouped list.
- **States:** hover / :focus-visible / selected / active / expanded / disabled / draggable. CSS-owned.
- **Behaviour + events:** row activation fires **`item-click`** ({ label }); the leading checkbox toggle fires **`item-select`** ({ selected }); expand fires **`item-expand`** ({ expanded }); drag fires **`item-drag`**. (Ratified = code names.)
- **Composition:** composed-by List/Menu; composes checkbox/radio (leading), Button/Tag (trailing).
- **Notes / divergences:** code element name `sherpa-list-item` maps to Figma "Menu List Item".

## sherpa-nav  (Figma "Primary Navigation")
- **Purpose:** the app's main side rail — collapsible list of nav sections/items.
- **Anatomy:** `<nav>` › `content` slot (nav sections + items); collapse/expand affordance.
- **Variants:** none.
- **Properties:** Figma `content` (SLOT); code `data-maximised`/`data-collapsed` (B), `content` slot.
- **Appearance / status:** rail surface; n/a `data-look`.
- **Sizing / geometry:** full-height rail; width = maximised vs collapsed (CSS). No snap.
- **States:** maximised / collapsed. CSS-owned off `data-*`.
- **Behaviour + events:** toggle fires **`nav-toggle`** (detail { maximised }).
- **Composition:** composes Nav Section + Nav Item.
- **Notes / divergences:** `isMaximised` (Figma) ↔ `data-maximised` code.

## sherpa-nav-item  (Figma "Navigation Item")
- **Purpose:** one link/row in the nav rail (icon · label · optional indicator).
- **Anatomy:** `<a>`/`<button>.row` › `.icon` (opt) · `.label` · `.indicator` (opt, badge/dot).
- **Variants:** none.
- **Properties:** `hasIcon`→`data-icon`, `hasIndicator`→`data-indicator`, `isMaximised`→`data-maximised`, `content` (SLOT); native href/aria-current.
- **Appearance / status:** active = accent surface/content; n/a `data-look`.
- **Sizing / geometry:** collapses label when rail collapsed (CSS via `data-maximised`). No snap.
- **States:** active (aria-current="page") / hover / :focus-visible / has-indicator. CSS-owned.
- **Behaviour + events:** click fires **`item-click`** (detail { label, href }); expand fires **`item-expand`**; native `<a href>` when `data-href` set, else native `<button>`. (Ratified = code names.)
- **Composition:** composed-by Nav Section / Nav.
- **Notes / divergences:** label hidden (not removed) when collapsed — CSS, not JS.

## sherpa-nav-section  (Figma "Navigation Section/default")
- **Purpose:** a labelled group of nav items in the rail.
- **Anatomy:** `<section>` › optional group label · default slot of nav items.
- **Variants:** none.
- **Properties:** `isMaximised`→`data-maximised` (B); code `data-heading` (T) opt; default slot.
- **Appearance / status:** neutral; n/a `data-look`.
- **Sizing / geometry:** hides label when collapsed (CSS). No snap.
- **States:** maximised/collapsed (mirrors rail). CSS-owned.
- **Behaviour + events:** display-only — NO events (items emit `item-click`; the rail itself fires `nav-select`/`nav-search`).
- **Composition:** composed-by Nav; composes Nav Item.
- **Notes / divergences:** thin group wrapper.

---

# App chrome · data

## sherpa-app-header
- **Purpose:** the top application bar — title row · history · actions · optional loading bar + notifications.
- **Anatomy:** `<header>` › `Title Row` (SLOT) · `History` (SLOT) · `Actions` (SLOT) · `loading-bar` (SLOT, opt) · notifications (opt).
- **Variants:** none.
- **Properties:** `hasNotifications`→`data-has-notifications`, `hasLoadingBar`→`data-loading`, plus 4 SLOTs (loading-bar, Actions, History, Title Row).
- **Appearance / status:** app-chrome surface; n/a `data-look`; `data-loading` shows the bar.
- **Sizing / geometry:** full-width bar. No snap.
- **States:** loading (bar visible) / has-notifications. CSS-owned off `data-*`.
- **Behaviour + events:** slotted controls emit their own; header may fire **`notifications-open`** if it owns that button (confirm vs code).
- **Composition:** composes Toolbar / Button / Tag (notification count); top of app shell.
- **Notes / divergences:** four discrete SLOTs — keep them (do not collapse to one).

## sherpa-toolbar
- **Purpose:** a horizontal strip of controls with leading + trailing zones.
- **Anatomy:** `.bar` › `leading` (SLOT) · `trailing` (SLOT).
- **Variants:** none.
- **Properties:** Figma `leading` + `trailing` (SLOT); code models via `data-*` slot detection.
- **Appearance / status:** neutral strip; n/a `data-look`.
- **Sizing / geometry:** full-width; no snap.
- **States:** presence states only. CSS-owned.
- **Behaviour + events:** display-only — NO events (slotted controls emit their own).
- **Composition:** composes Button / Tabs / Quick Filter etc.
- **Notes / divergences:** RATIFIED 2026-09-08 → **2 zones** only, slots `leading`/`trailing` (the former centre zone was removed to match Figma).

## sherpa-view-header  ⚠️ no code yet
- **Purpose:** header for a content VIEW (below app header) — left title zone + right actions.
- **Anatomy:** `.row` › `left` (SLOT) · `right` (SLOT).
- **Variants:** none (single component).
- **Properties:** `left` (SLOT), `right` (SLOT).
- **Appearance / status:** neutral; n/a `data-look`.
- **Sizing / geometry:** full-width; no snap.
- **States:** presence states only. CSS-owned.
- **Behaviour + events:** display-only — NO events.
- **Composition:** composes Breadcrumbs / Section Header / Button / Tabs.
- **Notes / divergences:** NO code dir yet — build native-first, 2 slots.

## sherpa-menu  ⚠️ no code yet
- **Purpose:** a floating menu surface (list of Menu List Items) anchored to a trigger.
- **Anatomy:** floating surface (Popover API / top layer) › default slot of list items.
- **Variants:** none.
- **Properties:** code TBD — `data-open` (B), anchor wiring; default slot.
- **Appearance / status:** elevated surface; n/a `data-look`.
- **Sizing / geometry:** content-sized float; Elevation md; rounding. No snap.
- **States:** open/closed / item hover+focus. CSS/native-owned.
- **Behaviour + events:** open/close fires **`menu-open`** / **`menu-close`**; item pick fires **`menu-select`** (confirm on build).
- **Composition:** composes List Item; triggered by a Button.
- **Notes / divergences:** NO code dir yet — build on Popover API + native focus; reuse List Item.

## sherpa-data-grid  (Figma "Grid Cell")
- **Purpose:** a data table — flat column-stack of cells (header/cell/group/filter).
- **Anatomy:** `<table>` (code) / column-stack (Figma) › rows of Grid Cell (Type = cell|header|group|filter); optional selection column.
- **Variants (cell):** `Type = cell | header | group | filter`.
- **Properties:** `Content` (SLOT), `hasCheckbox`→`data-has-checkbox`, `hasActions`→`data-has-actions`; grid-level `data-sort-field`/`data-sort-direction` (asc|desc), `data-group-field`, `data-filter-fields` (space-separated, external filter), `data-column-filters` (filter button per heading), `data-segment-field`/`data-segment-mode`.
- **Appearance / status:** neutral; header surface; selected-row tint; `data-status` cascade per row allowed; no `data-look`.
- **Sizing / geometry:** column widths; snap on grouped edges. No size axis.
- **States:** sorted (asc/desc) / selected / hover / group-collapsed / filter-active. CSS-owned. A column acting on the view — SORTED, or narrowed by a FILTER — takes Style mode `active` (`data-status="active"`) on its header cell ONLY, never on the secondary filter cell; the grid feeds `--_status-*` itself, because the `[data-status]` block in tokens.css is a document rule and cannot reach a shadow root. A filter set OUTSIDE the grid (a quick-filter toolbar) reaches the headers via `data-filter-fields` — a space-separated field list written by `SherpaDataSource`, since the grid only ever receives the surviving rows and cannot otherwise know which column shrank the table.
- **Column filters:** `data-column-filters` puts a filter button in each heading, LEFT of the sort control. It is an icon-only `<sherpa-quick-filter>` (`data-icon-only` + `data-locked`), so the menu, its cross-shadow placement and its Apply footer are the chip's rather than a second copy. The menu is shaped by the column's `type`: **text** = condition `<select>` + value `<input>` (`contains`, `notcontains`, `startswith`, `endswith`, `eq`, `ne`); **number** = condition + value, or two boxes in Range mode (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`); **date** = an embedded `<sherpa-calendar>`, one day or a span, no condition list. Conditions are DevExtreme's binary filter operations and each `<option>` value IS a store `FilterOp`. Number and date lead with a RANGE switch (`data-range` on the menu; a range is the store's `between`). Any other type carries `data-unsupported` and shows no button. A number column's clause values are COERCED to numbers — the store only compares numerically when both sides are numbers. Apply fires **`column-filter-change`** ({ field, header, op, value, from, to, clause, label }); `clause` is a ready `FilterClause` and `label` the chip text ("Contains: ana"). The footer also carries **Remove filter** (`data-removable`), which ends the column's filter outright and reports as a clear. The grid does NOT narrow its own rows — it holds one column's clause and cannot know what else filters the view; it DOES mark the matched substring in TEXT cells (`<mark class="match">`, substring conditions only — never number or date). Three public methods drive it from outside: `clearColumnFilter(field?)` DELETES one (or all) silently — what Remove does; `suspendColumnFilter(field, on?)` keeps the clause but stops applying it (the heading unlights and its marks come off) — what toggling the toolbar chip's body does; `columnClause(field)` returns the clause, suspended or not, so a host can put it back. `openColumnFilter(field, anchor)` re-opens that column's own menu anchored anywhere, which is how the toolbar chip is edited. The chip carries `data-plain` (a real `background: transparent` on its caret, NOT a token re-point — a custom property set on the host inherits into the slotted menu, and `@scope` cannot stop that) and the grid resets `--_status-*` on it so the column's tint stops at the heading.
- **Column sort:** the sort control is a second icon-only `<sherpa-quick-filter>` (`.head-sort`), matching the filter one beside it — no menu, because a sort has nothing to pick. Clicking cycles TRI-STATE: not-this-column → ascending → descending → OFF, the same three states the toolbar's Sort chip has. Only ONE column sorts at a time (`data-sort-field` holds one field). The heading row reads LABEL, FILTER, SORT. The toolbar now observes `data-sort-field`/`data-sort-direction` and ticks its Sort menu's radio to match, so the two are one value in both directions.
- **Behaviour + events:** sort fires **`sort-change`** ({ field, direction }) — `field: null` when the cycle reaches OFF; select fires **`selection-change`**; row click fires **`row-click`**; filter fires **`filter-change`**. (Ratified 2026-09-08 = code names.)
- **Grouping vs sorting:** `data-group-field` sorts the group keys A→Z and `data-sort-field` orders the rows WITHIN each group. When the two name the SAME column they are one key, so `data-sort-direction` orders the GROUPS.
- **Composition:** composes Grid Cell + Checkbox + Button; pairs with Pagination.
- **Notes / divergences:** code `<table>` vs Figma flat column-stack — intentional (see memory sherpa-figma-data-grid). Selection slot renamed `checkbox`→`selection` (collision fix).

## sherpa-grid-cell  (Figma "Grid Cell")
- **Purpose:** one cell in the data grid (header/body/group/filter).
- **Anatomy:** `<td>`/`<th>` › optional selection slot · `Content` slot · optional actions slot.
- **Variants:** `Type = cell | header | group | filter`.
- **Properties:** `Content` (SLOT), `hasCheckbox`→`data-has-checkbox`, `hasActions`→`data-has-actions`, `data-type`.
- **Appearance / status:** neutral; header surface; no `data-look`.
- **Sizing / geometry:** column width; snap on edges. No size axis.
- **States:** sorted / selected / hover / filter-active. CSS-owned.
- **Behaviour + events:** header sort fires **`sort-change`**; menu fires **`menu-open`**; group toggle fires **`group-toggle`** (bubble to grid). (Ratified = code names.)
- **Composition:** composed-by Data Grid; composes Checkbox / Button / Tag.
- **Notes / divergences:** selection slot must NOT be named `checkbox` (collides with auto `data-has-checkbox`) — use `selection`.

## sherpa-transfer-list  (Figma "Transfer List")
- **Purpose:** move items between two lists (available ↔ selected).
- **Anatomy:** two `sherpa-list` panels · centre move-buttons (add/remove/all).
- **Variants:** none.
- **Properties:** Figma none; code JS props `available`/`selected` (arrays), `data-*` for labels.
- **Appearance / status:** neutral; n/a `data-look`.
- **Sizing / geometry:** two-column layout; no snap.
- **States:** item selected (in either list) / move-button disabled at bounds. CSS-owned.
- **Behaviour + events:** move fires **`transfer-change`** (detail { selected, moved, direction }). (Ratified = code detail shape.)
- **Composition:** composes List + List Item + Button.
- **Notes / divergences:** state (which side) is behavioural; confirm event name vs code @fires.

## sherpa-file-upload  (Figma "File Uploader")
- **Purpose:** drag/drop + browse to upload files; shows a list of file rows.
- **Anatomy:** `.dropzone` (icon + prompt + browse button + native `<input type=file>`) · `.files` list of File Item rows.
- **Variants:** none.
- **Properties:** native `<input>` (accept, multiple); code `data-*` for prompt text; file rows cloned.
- **Appearance / status:** neutral; drag-over tint; error per row; no `data-look`.
- **Sizing / geometry:** no size axis; no snap.
- **States:** drag-over / uploading / error / complete (per row). CSS-owned.
- **Behaviour + events:** file add fires **`file-add`**; row remove fires **`file-remove`** (confirm vs code @fires).
- **Composition:** composes File Item rows + Button + native file input.
- **Notes / divergences:** Figma "File Item" rendered as cloned rows in code (not a separate custom element).

---

# Charts · data viz · date

## sherpa-barchart
- **Purpose:** a bar chart (categories × values), optional multi-series.
- **Anatomy:** `<svg>` plot › axes (Chart Axis) · bars (cloned marks) · optional legend (Chart Legend).
- **Variants:** none.
- **Properties:** JS props `data` (series/values); `data-segment-field`/`data-segment-mode`, `data-orientation` (vertical|horizontal).
- **Appearance / status:** series colour = Data Viz colour-set (raw marks, NOT recoloured by look/status); n/a `data-look`.
- **Sizing / geometry:** fills container (@container); no snap.
- **States:** bar hover / focus / selected segment. CSS-owned where possible.
- **Behaviour + events:** bar interaction fires **`segment-select`** / **`bar-click`** (confirm vs code @fires).
- **Composition:** composes Chart Axis + Chart Legend + Metric.
- **Notes / divergences:** chart marks stay raw colour (memory rule); data-driven via JS, not Figma slots.

## sherpa-line-chart  ⚠️ thin / weak Figma node
- **Purpose:** a line/area chart over a continuous axis.
- **Anatomy:** `<svg>` › axes · path line(s) · optional points/area · legend.
- **Variants:** none.
- **Properties:** JS `data`; `data-segment-field`/`data-segment-mode`.
- **Appearance / status:** series colour = Data Viz set; n/a `data-look`.
- **Sizing / geometry:** fills container; no snap.
- **States:** point hover/focus; series toggle via legend. CSS-owned where possible.
- **Behaviour + events:** point/series interaction fires **`segment-select`** (confirm vs code).
- **Composition:** composes Chart Axis + Chart Legend.
- **Notes / divergences:** weak/absent Figma node — treat code + Data Viz tokens as the target; keep marks raw.

## sherpa-donut-chart  (Figma "Donut Chart")
- **Purpose:** a donut/pie of proportional segments with a centre label.
- **Anatomy:** `<svg>` › arc segments (Segments SLOT / cloned arcs) · centre metric · optional legend.
- **Variants:** none.
- **Properties:** Figma `Segments` (SLOT); code JS `data` (segments), `data-segment-field`.
- **Appearance / status:** segment colour = Data Viz set; n/a `data-look`.
- **Sizing / geometry:** fills container; no snap.
- **States:** segment hover/focus/selected. CSS-owned where possible.
- **Behaviour + events:** segment interaction fires **`segment-select`** (confirm vs code).
- **Composition:** composes arcs + Metric (centre) + Chart Legend.
- **Notes / divergences:** arcData + vectorPaths in Figma; code draws from JS data. Marks raw.

## sherpa-gauge-chart  (Figma "Gauge Chart")
- **Purpose:** a radial gauge showing one value against a range.
- **Anatomy:** `<svg>` › track arc · value arc (Arcs SLOT) · centre value.
- **Variants:** none.
- **Properties:** Figma `Arcs` (SLOT); code JS `value`/`min`/`max`, `data-*`.
- **Appearance / status:** arc colour = Data Viz set / threshold; n/a `data-look`.
- **Sizing / geometry:** fills container; no snap.
- **States:** threshold band (colour by value). CSS/JS.
- **Behaviour + events:** display-only — NO events (or `gauge-click`; confirm).
- **Composition:** composes arcs + Metric.
- **Notes / divergences:** value-driven arc; marks raw.

## sherpa-sparkline  ⚠️ thin / no Figma node
- **Purpose:** a tiny inline trend line (no axes), for Metric etc.
- **Anatomy:** `<svg>` › single path, no axes/labels.
- **Variants:** none.
- **Properties:** JS `data` (values); `data-*` minimal.
- **Appearance / status:** single accent/series colour; n/a `data-look`.
- **Sizing / geometry:** inline, fills host; no snap.
- **States:** none (display-only). 
- **Behaviour + events:** display-only — NO events.
- **Composition:** composed-by Metric (Sparkline SLOT).
- **Notes / divergences:** no Figma node — code + tokens are the target; keep it minimal.

## sherpa-chart-legend  (Figma "Chart Legend")
- **Purpose:** the key for a chart — labelled colour swatches, optional values.
- **Anatomy:** `.legend` › cloned Legend Item rows (swatch · label · optional value).
- **Variants:** none.
- **Properties:** Figma `Content` (SLOT); Legend Item P: label(T), value(T), hasValue(B). Code JS `items`.
- **Appearance / status:** swatch = Data Viz colour; n/a `data-look`.
- **Sizing / geometry:** no size axis; no snap.
- **States:** item toggle (series on/off) / hover / :focus-visible. CSS-owned.
- **Behaviour + events:** clicking an item fires **`legend-item-click`** (detail { index, label, active }). (Ratified = code name; `active` now in detail.)
- **Composition:** composes Legend Item; composed-by charts.
- **Notes / divergences:** Legend Item is a cloned row, not a separate custom element.

## sherpa-metric
- **Purpose:** a single KPI — label · big value · optional delta · optional sparkline.
- **Anatomy:** `.metric` › `.label` · `.value` · `.delta` (opt, up/down) · `Sparkline` (SLOT, opt).
- **Variants:** none.
- **Properties:** `data-label`, `data-value`, `data-delta` (T); `Sparkline` (SLOT).
- **Appearance / status:** delta colour = success/critical by sign (status-like), value neutral; no `data-look`.
- **Sizing / geometry:** `data-size` (component-local) opt; no snap.
- **States:** delta positive/negative. CSS-owned off delta sign.
- **Behaviour + events:** display-only — NO events.
- **Composition:** composes Sparkline; composed-by dashboards/cards.
- **Notes / divergences:** delta direction/colour derived from value sign.

## sherpa-key-value-list  (Figma "Key Value Pair")
- **Purpose:** a list of key→value rows (details/spec panels).
- **Anatomy:** `<dl>` › cloned rows (`<dt>` key · `<dd>` value).
- **Variants:** none.
- **Properties:** Figma Key Value Pair P: key(T), value(T); code JS `items` (array of { key, value }).
- **Appearance / status:** neutral; n/a `data-look`/status.
- **Sizing / geometry:** no size axis; no snap.
- **States:** none (display-only). 
- **Behaviour + events:** display-only — NO events.
- **Composition:** composes key/value rows; composed-by panels.
- **Notes / divergences:** native `<dl>/<dt>/<dd>`; rows = cloning prototype.

## sherpa-calendar  (Figma "Calendar")
- **Purpose:** a date picker — single date or a range, optional time.
- **Anatomy:** `header` (SLOT: month nav) · day grid (cloned Calendar Buttons) · optional time row · footer (apply/cancel).
- **Variants:** `Type = single | range`.
- **Properties:** Figma `content` (SLOT), `header` (SLOT), `hasTime`→`data-has-time` (B); Calendar Button V: State=default|today|selected-range, P: label(T).
- **Appearance / status:** selected day = accent; today = ring; in-range = subtle; no `data-look`.
- **Sizing / geometry:** grid; no snap.
- **States:** selected / today / in-range / disabled / hover / :focus-visible. CSS-owned off day `data-state`.
- **Behaviour + events:** picking fires **`calendar-apply`** (detail { date | range }); cancel fires **`calendar-cancel`**.
- **Composition:** composes Calendar Button (days) + Container Footer + Time Picker (when hasTime).
- **Notes / divergences:** RATIFIED 2026-09-08 → fires **`calendar-apply`**/**`calendar-cancel`** (plus `datetime-change`/`range-select`); the older datetime-submit/close names are dropped.

## sherpa-time-picker  ⚠️ no code yet
- **Purpose:** pick a time (hours/minutes, optional period).
- **Anatomy:** hour · minute · optional AM/PM segments (native `<input type=time>` or steppers).
- **Variants:** two Figma components — one plain (no props) + one P: value(T).
- **Properties:** `value` (T) / native `<input type=time>`; `data-*` minimal.
- **Appearance / status:** neutral; n/a `data-look`.
- **Sizing / geometry:** no size axis; no snap.
- **States:** focus / disabled / invalid. Native + CSS-owned.
- **Behaviour + events:** change fires **`time-change`** (detail { value }) (confirm on build).
- **Composition:** composed-by Calendar (hasTime); composes native time input.
- **Notes / divergences:** NO code dir yet — build native-first on `<input type=time>`.
