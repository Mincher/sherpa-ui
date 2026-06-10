# Sticker Sheet — Known Issues & Fix Plan

Triaged 2026-06-10. Issues are grouped by type; work roughly in order A → E.

**Status:** Section A complete (2026-06-10).

---

## A — Wrong attribute names

All of these are silently broken — the attributes are accepted by the browser but ignored by the component.

### A1 — `sticker-sheet/index.html` attribute mismatches

| Component | Line(s) | Current (incorrect) | Correct |
|-----------|---------|---------------------|---------|
| `sherpa-slider` all modes | 166–168 | `min` / `max` / `value` (native attrs) | `data-min` / `data-max` / `data-value` |
| `sherpa-slider` range | 167 | `data-value-start` / `data-value-end` | `data-value-low` / `data-value-high` |
| `sherpa-pagination` | 183 | `data-total` | `data-total-rows` |
| `sherpa-pagination` | 183 | `data-current-page` | `data-page` |
| `sherpa-message` | 315–319 | `data-title="…"` | `data-label="…"` |
| `sherpa-message` | 315–319 | `data-description="…"` | _(no equivalent — message is single-line; drop it)_ |
| `sherpa-callout` | 324–328 | `data-description="…"` | `data-heading="…"` + body text in default slot |
| `sherpa-empty-state` | 342 | `data-title="…"` | `data-label="…"` |
| `sherpa-switch` | 156–160 | `data-label="Feature"` | _(not a supported attribute — switch has no label; drop it)_ |
| `sherpa-switch` | 157, 160 | `checked` | `data-state="on"` |
| `sherpa-accordion` | 543–554 | `<span slot="label">…</span>` | `data-label="…"` attribute on the host element (no slot named "label" exists) |
| `sherpa-tabs` | 477–482 | `<button role="tab">` children | direct children with `data-tab-label="…"` attribute |
| `sherpa-nav-item` | 637 | `data-active="true"` | `data-state="selected"` |

### A2 — `sticker-sheet/sticker-sheet.js` attribute mismatches

| Location | Current (incorrect) | Correct |
|----------|---------------------|---------|
| Dialog open/close handlers | `setAttribute('open', '')` / `removeAttribute('open')` | `setAttribute('data-open', '')` / `removeAttribute('data-open')` |
| `dialog-cancel` event handler | `e.target.removeAttribute('open')` | `e.target.removeAttribute('data-open')` |

`sherpa-dialog` observes `data-open`, not the native `open` attribute. The current JS means clicking the trigger buttons does nothing.

---

### Notes on specific fixes

#### sherpa-switch

The switch has no label attribute. The `.switch-label` element inside it shows "ON"/"OFF" via CSS pseudo-content driven by `data-state`. If an accessible name is needed, use a native `<label>` in the light DOM:

```html
<label>
  Feature
  <sherpa-switch></sherpa-switch>
</label>
```

For the sticker sheet, the `ss-chip-label` already provides the state description, so the switch examples should simply drop `data-label` and use `data-state` for initial state:

```html
<div class="ss-chip"><span class="ss-chip-label">off</span><sherpa-switch></sherpa-switch></div>
<div class="ss-chip"><span class="ss-chip-label">on</span><sherpa-switch data-state="on"></sherpa-switch></div>
<div class="ss-chip"><span class="ss-chip-label">disabled off</span><sherpa-switch disabled></sherpa-switch></div>
<div class="ss-chip"><span class="ss-chip-label">disabled on</span><sherpa-switch data-state="on" disabled></sherpa-switch></div>
```

#### sherpa-tabs — full pattern

The component discovers tabs by filtering slotted children for those with a `data-tab-label` attribute. Replace the current `<button role="tab">` markup:

```html
<sherpa-tabs>
  <div data-tab-label="Overview"><p>Overview panel content</p></div>
  <div data-tab-label="Settings"><p>Settings panel content</p></div>
  <div data-tab-label="Activity"><p>Activity panel content</p></div>
  <div data-tab-label="Archived"><p>Archived panel content</p></div>
</sherpa-tabs>
```

#### sherpa-callout

Callout has no `data-description` attribute. `data-heading` sets the summary row text; body content goes in the default slot. See section B5 for corrected markup.

---

## B — Missing examples / thin content

### B1 — Buttons: no menu or button-group examples

Add two sub-sections inside the `sherpa-button` container:

**With menu** — uses `data-menu` attribute; a `sherpa-container-overlay` is lazily populated via `menu-populate` event or `setMenuItems()`:

```html
<sherpa-section-header data-label="With menu" data-heading-level="tertiary"></sherpa-section-header>
<div class="ss-strip">
  <div class="ss-chip">
    <span class="ss-chip-label">split button</span>
    <div class="grouped-component">
      <sherpa-button data-variant="primary" data-icon-start="fa-solid fa-plus">Add item</sherpa-button>
      <sherpa-button data-variant="primary" data-type="icon" data-menu data-icon-start="fa-solid fa-chevron-down" aria-label="More actions"></sherpa-button>
    </div>
  </div>
  <div class="ss-chip">
    <span class="ss-chip-label">menu trigger</span>
    <sherpa-button data-variant="secondary" data-menu data-icon-end="fa-solid fa-chevron-down">Actions</sherpa-button>
  </div>
</div>
```

Populate menu items via JS in `sticker-sheet.js`:
```js
document.querySelectorAll('sherpa-button[data-menu]').forEach(btn => {
  btn.addEventListener('menu-populate', e => {
    e.detail.menu.setItems([
      { label: 'Edit',   icon: 'fa-solid fa-pen' },
      { label: 'Duplicate', icon: 'fa-solid fa-copy' },
      { label: 'Delete', icon: 'fa-solid fa-trash', status: 'critical' },
    ]);
  });
});
```

**Button group** — move the `grouped-component` examples from the CSS Utilities section into a sub-section here (or duplicate them). The CSS Utilities section can keep a brief reference row.

### B2 — Buttons: size variants missing icons

The size row only shows text labels. Each size chip should also include an `icon-start` so the sizing relationship between icon and text is visible. Update to:

```html
<sherpa-button data-variant="primary" data-size="2x-small" data-icon-start="fa-solid fa-plus">Label</sherpa-button>
```

Repeat for all five sizes.

### B3 — Toast: no static visual examples

The current section shows only JS-trigger buttons. Add static `<sherpa-toast>` elements (no `data-timer-dismiss`) after the trigger strip so all status variants are visible at a glance:

```html
<sherpa-section-header data-label="Static examples" data-heading-level="tertiary"></sherpa-section-header>
<div style="display:flex;flex-direction:column;gap:var(--sherpa-space-xs,8px);max-width:420px">
  <sherpa-toast data-status="info"     data-label="Information"   data-value="This is an informational notification."></sherpa-toast>
  <sherpa-toast data-status="success"  data-label="Saved"         data-value="Your changes have been saved."></sherpa-toast>
  <sherpa-toast data-status="warning"  data-label="Review needed" data-value="Some fields require your attention."></sherpa-toast>
  <sherpa-toast data-status="critical" data-label="Error"         data-value="An error occurred. Please try again."></sherpa-toast>
  <sherpa-toast data-status="info"     data-label="Dismissible"   data-value="This toast has a close button." data-show-close></sherpa-toast>
</div>
```

### B4 — Empty state: only one example, no illustrations

Add a strip of all six built-in illustrations:

```html
<sherpa-section-header data-label="Illustrations" data-heading-level="tertiary"></sherpa-section-header>
<div class="ss-strip" style="flex-wrap:wrap;gap:var(--sherpa-space-sm,12px)">
  <sherpa-empty-state data-label="No data"          data-description="Nothing here yet."         data-illustration="empty"   style="width:200px"></sherpa-empty-state>
  <sherpa-empty-state data-label="No results"       data-description="Try a different search."   data-illustration="search"  style="width:200px"></sherpa-empty-state>
  <sherpa-empty-state data-label="Empty folder"     data-description="This folder is empty."     data-illustration="folder"  style="width:200px"></sherpa-empty-state>
  <sherpa-empty-state data-label="No data loaded"   data-description="Connect a data source."    data-illustration="data"    style="width:200px"></sherpa-empty-state>
  <sherpa-empty-state data-label="Something broke"  data-description="Try refreshing the page."  data-illustration="error"   style="width:200px"></sherpa-empty-state>
  <sherpa-empty-state data-label="All done!"        data-description="Nothing left to do."       data-illustration="success" style="width:200px"></sherpa-empty-state>
</div>
```

### B5 — Callout: no body text, no dismissible example

Each `sherpa-callout` needs body text via its default slot, and one example should use `data-dismissible`:

```html
<sherpa-callout data-status="info" data-heading="Something to note" data-expanded>
  Context and guidance goes here. Use callouts to give users actionable information inline.
</sherpa-callout>
<sherpa-callout data-status="warning" data-heading="Review before proceeding" data-expanded>
  This action may have unintended side effects on related records.
</sherpa-callout>
<sherpa-callout data-status="critical" data-heading="Action required" data-expanded data-dismissible>
  Critical issue detected — review the details below before continuing.
</sherpa-callout>
<sherpa-callout data-status="success" data-heading="Completed" data-expanded>
  All records have been processed successfully.
</sherpa-callout>
```

### B6 — Message: no dismissible example

Add one `data-dismissible` variant:

```html
<sherpa-message data-status="info"       data-label="This message has a dismiss button" data-dismissible></sherpa-message>
```

### B7 — Toolbar: wrong button sizes and wrong content

Remove `data-size="small"` from all toolbar buttons (they should be `base` to match the search input height). Replace the content:

```html
<sherpa-toolbar>
  <!-- Leading: primary action + overflow menu -->
  <sherpa-button slot="leading" data-variant="primary" data-icon-start="fa-solid fa-plus">Add item</sherpa-button>
  <sherpa-button slot="leading" data-variant="secondary" data-menu data-icon-end="fa-solid fa-chevron-down">Actions</sherpa-button>

  <!-- Center: grows to fill -->
  <sherpa-input-search slot="center" placeholder="Search…"></sherpa-input-search>

  <!-- Trailing: icon buttons -->
  <sherpa-button slot="trailing" data-variant="tertiary" data-type="icon" data-icon-start="fa-solid fa-download" aria-label="Export"></sherpa-button>
  <sherpa-button slot="trailing" data-variant="tertiary" data-type="icon" data-icon-start="fa-solid fa-gear"     aria-label="Settings"></sherpa-button>
</sherpa-toolbar>
```

### B8 — Metrics: sparklines not showing

`sherpa-metric` renders a sparkline only when multi-bucket time-series data has been loaded. The sticker sheet currently only sets `data-trend` and `data-delta`. Populate each metric via JS in `sticker-sheet.js`:

```js
const sparkData = [38, 45, 41, 52, 49, 60, 55, 68, 72, 80, 75, 88];
document.querySelectorAll('sherpa-metric[data-metric-id]').forEach(m => {
  // Attach appropriate sparkline data per metric
  m.setValues?.(sparkData);
});
```

Individual metric IDs should be added to the sticker sheet HTML so each can get a suitable dataset.

### B9 — Section header: examples stack with no breathing room

The four heading-level variants (`primary`, `secondary`, `tertiary`, `with-divider`) render flush. Wrap each in a `<div>` with `margin-bottom` or change the container to `flex-direction: column; gap: var(--sherpa-space-md, 24px)`:

```html
<div style="display:flex;flex-direction:column;gap:var(--sherpa-space-lg,32px)">
  <sherpa-section-header data-label="primary"      data-heading-level="primary"></sherpa-section-header>
  <sherpa-section-header data-label="secondary"    data-heading-level="secondary"></sherpa-section-header>
  <sherpa-section-header data-label="tertiary"     data-heading-level="tertiary"></sherpa-section-header>
  <sherpa-section-header data-label="With divider" data-heading-level="secondary" data-divider></sherpa-section-header>
</div>
```

### B10 — Panel: no expanded content demo

Add an `open` attribute example with richer dummy content so the panel body is visible:

```html
<sherpa-panel data-variant="inline" data-label="User details" open style="width:320px">
  <sherpa-key-value-list>
    <dt>Name</dt>   <dd>Alice Martin</dd>
    <dt>Role</dt>   <dd>Administrator</dd>
    <dt>Status</dt> <dd>Active</dd>
    <dt>Joined</dt> <dd>Jan 2024</dd>
  </sherpa-key-value-list>
</sherpa-panel>
```

### B11 — Charts and data grid not rendering

The components load from `/sticker-sheet/data/*.json` — files exist and appear well-formed. Likely causes:

1. **No explicit dimensions** — canvas-based charts need a container with a measurable height. The current inline `style="width:100%;height:240px"` should be sufficient, but verify this is being applied before the component's `onRender`.
2. **Gauge chart** — `data-min` / `data-max` are set to strings (`"0%"`, `"100%"`) — the component may expect plain numbers: `data-min="0"` `data-max="100"` with a separate label.
3. **Data grid** — `height:280px` may conflict with the grid's internal auto-sizing. Try removing the fixed height and letting the grid size to its rows.
4. **Filter bar** — the JSON uses `"values"` as a flat string array; verify the filter-bar expects that shape versus a richer object array.

Each chart/grid should be checked in the browser with DevTools network/console open to confirm the fetch succeeds and the data is being parsed.

### B12 — Accordion: no gap between examples

Add `gap: var(--sherpa-space-sm, 12px)` to the accordion container body, or wrap each accordion in a `<div style="margin-bottom:...">`.

---

## C — CSS bugs (component files)

### C1 — `sherpa-tag` primary: white text on white background in dark mode

**File:** `components/sherpa-tag/sherpa-tag.css`

In the default `:host` rule, `--_tag-text` is set to `--sherpa-content-default-on-color-body` (#fafafa). In dark mode, the `primary` variant's fill token also resolves to a very light value, causing white-on-white.

**Fix:** Add a dark-mode override that switches `--_tag-text` to a dark content token when the fill is light. This likely requires checking what `--sherpa-surface-control-primary-default` resolves to in each theme/mode and ensuring the text token has enough contrast.

### C2 — `sherpa-slider` handle overflow causes misalignment

**File:** `components/sherpa-slider/sherpa-slider.css`

Handles extend beyond the track boundary via margin or absolute positioning, which causes them to overlap adjacent sibling elements.

**Fix:** Inset the track by padding the `.track-area` horizontally by half the handle size so handles are contained within the component's layout box:

```css
:host .track-area {
  padding-inline: calc(var(--_handle-size) / 2);
}
:host .track {
  /* track fills remaining space after padding, no negative margin needed */
}
```

The handles are positioned absolutely along the percentage of the track. With the inset approach, 0% and 100% handle centres align with the start/end of the padded track, and the component's block stays flush with siblings.

### C3 — `sherpa-input-number` nested buttons: wrong size and missing icon

**File:** `components/sherpa-input-number/sherpa-input-number.css` (and possibly `.html`)

The increment/decrement buttons shrink to fit a placeholder icon rather than staying at the field height, and they may not be receiving their icon correctly.

Investigate:
- Does the template use `<sherpa-button>` for the spinners? If so, verify `data-icon-start` is being set correctly and the button size matches the input field height.
- Does `::slotted(sherpa-button)` or `:host .spin-btn` have an explicit height or `flex: 0 0 auto` that matches the input's height token?

### C4 — `sherpa-container` elevation: no visible shadow

**File:** `components/sherpa-container/sherpa-container.css`

`data-elevation="md"` should produce a visible box-shadow but none appears in the sticker sheet.

Investigate: Is the shadow rule using `--shadow-md()` CSS function (Chromium 139+ only) without a fallback? Is there a token like `--sherpa-elevation-*` that resolves to `none` or `transparent` in the current theme? Check that the stacking context of the container doesn't clip the shadow (`overflow: hidden` would cancel it).

### C5 — Date / time picker popovers clipped by container z-axis

**Files:** `components/sherpa-input-date/sherpa-input-date.css`, `sherpa-input-date-range`, `sherpa-input-time`

The calendar/time pickers are `position: absolute; z-index: 200` but get clipped by the `sherpa-container` parent which likely creates a new stacking context (via `transform`, `will-change`, or `overflow: hidden`).

**Fix options (in order of preference):**
1. Migrate pickers to use the native `popover` attribute (`position-anchor` / `anchor-positioned`). Popovers escape all stacking contexts.
2. Use `position: fixed` with JS-calculated anchor coordinates so the picker paints in the viewport layer.
3. On the sticker sheet only, add `overflow: visible` to the affected containers as a temporary workaround while the component fix is developed.

---

## D — Component refactor: `sherpa-step-tracker`

### Background

`sherpa-stepper` handles in-flow wizard steps; `sherpa-progress-tracker` handles side-panel milestone timelines. They share a conceptual model (ordered steps with status) but diverged into two separate implementations. Maintaining both is redundant and confusing.

### Proposed unified component: `sherpa-step-tracker`

**Attributes:**

| Attribute | Values | Notes |
|-----------|--------|-------|
| `data-layout` | `horizontal` \| `vertical` | replaces `data-template` on stepper |
| `data-mode` | `steps` \| `milestones` | `steps` = interactive wizard; `milestones` = read-only timeline |
| `data-current-step` | integer (1-based) | active step in `steps` mode |
| `data-linear` | boolean | steps must complete in order |
| `data-show-step-numbers` | boolean | show step index badges |
| `data-heading` | string | optional heading (milestones mode) |
| `data-src-json` | URL | load steps/milestones from JSON |

**Unified JSON schema:**

```json
{
  "steps": [
    {
      "label": "string",
      "description": "string (optional)",
      "timestamp": "string (optional, milestones mode)",
      "sublabel": "string (optional)",
      "status": "default | in-progress | success | warning | error",
      "completed": true,
      "disabled": false
    }
  ]
}
```

**Migration:**
- `sherpa-stepper` becomes a thin alias: re-exports `SherpaStepTracker` registered under both tag names, `data-template="default"` maps to `data-layout="horizontal"` + `data-mode="steps"`, `data-template="timeline"` maps to `data-layout="vertical"` + `data-mode="milestones"`.
- `sherpa-progress-tracker` similarly maps: no `data-layout` attribute defaults to `vertical` + `data-mode="milestones"`.

**Files to create:**
- `components/sherpa-step-tracker/sherpa-step-tracker.ts`
- `components/sherpa-step-tracker/sherpa-step-tracker.css`
- `components/sherpa-step-tracker/sherpa-step-tracker.html`

**Files to update:**
- `components/sherpa-stepper/sherpa-stepper.ts` — alias wrapper
- `components/sherpa-progress-tracker/sherpa-progress-tracker.ts` — alias wrapper
- `sticker-sheet/index.html` — replace both example sections with a single `sherpa-step-tracker` section showing horizontal + vertical, steps + milestones
- `index.ts` (component registry) — export new component

---

## E — Remove `data-status="brand"` from sticker sheet

The CSS Utilities section currently has a `data-status="brand"` showcase. The user has confirmed this section "makes no sense." Remove it entirely — the container (lines 710–731 in the current HTML), leaving the three `.sherpa-icon` and `.grouped-component` sections above it.

The `data-status="brand"` CSS utility itself (in `css/styles/`) is retained; it just doesn't need a dedicated sticker-sheet section.

---

## Priority order

1. **A** — Attribute fixes: quick wins, these are silently broken
2. **E** — Remove brand status section: one-liner
3. **B** — Missing content: sticker sheet HTML additions only
4. **C1–C4** — CSS bug fixes: focused component changes
5. **C5** — Popover z-axis: needs investigation; may require component API change
6. **D** — `sherpa-step-tracker` refactor: large new component, schedule separately
