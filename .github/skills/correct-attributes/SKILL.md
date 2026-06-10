---
name: correct-attributes
description: 'Check before writing any Sherpa markup; when uncertain which attribute name to use; when composing charts, dialogs, inputs, or navigation; before calling query_component or generating markup.'
---

# Correct Attributes

**Check this skill before writing any Sherpa UI markup.** It surfaces the most common silent-failure patterns without requiring the full architecture document.

---

## Attribute Quick Reference — Common Gotchas

These components have attribute names that differ from HTML conventions. Agents consistently generate wrong names — check this table before writing any markup.

| Component | ❌ Wrong (silent failure) | ✅ Correct | Notes |
|---|---|---|---|
| `sherpa-button` | text content between tags | `data-label="..."` | Inner text is never rendered |
| `sherpa-progress-bar` | `value`, `max` | `data-value` | Native attrs silently ignored; `data-value` is 0–100 % |
| `sherpa-callout` | `data-description` | `data-heading` + default slot | Heading = summary row; body text in default slot |
| `sherpa-message` | `data-title`, `data-description` | `data-label` only | Single-line; no body slot |
| `sherpa-switch` | `checked`, `data-label` | `data-state="on"` | No label attr; wrap in `<label>` for a11y |
| `sherpa-dialog` | native `open` | `data-open` | Component observes `data-open` only |
| `sherpa-tabs` | `<button role="tab">` children | children with `data-tab-label="..."` | Component discovers tabs by this attr |
| `sherpa-nav-item` | `data-active` | `data-state="selected"` | Enum: `selected` \| `active` \| `inactive` |
| `sherpa-slider` | `min`, `max`, `value` | `data-min`, `data-max`, `data-value` | Range mode: `data-value-low` / `data-value-high` |
| `sherpa-container-header` | `data-label` | `data-title` | Panel/container heading text |
| `sherpa-empty-state` | `data-title` | `data-label` | |
| `sherpa-accordion` | `<span slot="label">` child | `data-label="..."` on host | No slot named "label" exists |
| `sherpa-pagination` | `data-total`, `data-current-page` | `data-total-rows`, `data-page` | |

---

## Composition Requirements

### sherpa-donut-chart — parent must provide both width AND height

The ring renders via `min(100cqw, 100cqh)`. A parent with only `container-type: inline-size` produces a zero-height ring.

```html
<!-- ✅ Wrapper with both axes -->
<div style="container-type:size; width:300px; height:300px;">
  <sherpa-donut-chart></sherpa-donut-chart>
</div>

<!-- ✅ Inside sherpa-container — sizing is automatic -->
<sherpa-container data-col-span="6" data-row-span="2">
  <sherpa-donut-chart></sherpa-donut-chart>
</sherpa-container>

<!-- ❌ Wrong — ring collapses to 0 height -->
<div style="container-type:inline-size; width:300px;">
  <sherpa-donut-chart></sherpa-donut-chart>
</div>
```

### sherpa-metric — sparklines require setValues() after render

`data-trend` and `data-delta` control the arrow and delta text only. To render the sparkline:

```js
// Preferred: full summary payload
metric.setData({
  name: 'Active Devices',
  summary: { total: 60, delta: 22, deltaPercent: 58, values: [38, 45, 41, 52, 49, 60] },
});

// Or set sparkline data independently after render:
await metric.rendered;
metric.setValues([38, 45, 41, 52, 49, 60]);
```

### sherpa-nav — nav-items are direct children, no slot attribute

```html
<!-- ✅ Correct -->
<sherpa-nav>
  <sherpa-nav-item data-label="Home"></sherpa-nav-item>
</sherpa-nav>

<!-- ❌ Wrong — slot attribute causes item to be ignored -->
<sherpa-nav>
  <sherpa-nav-item slot="item" data-label="Home"></sherpa-nav-item>
</sherpa-nav>
```

### sherpa-dialog — always use data-open, never native open

```js
el.setAttribute('data-open', '');   // open
el.removeAttribute('data-open');    // close
```

---

## Input Action Pattern

**Never use `<sherpa-button>` as a constrained control inside an input's shadow DOM.** Sherpa-button creates its own shadow DOM asynchronously, causing sizing conflicts and icon rendering failures inside 32px input rows.

```html
<!-- ❌ Wrong — sherpa-button fights the 32px constraint -->
<sherpa-button class="input-action" data-icon-start="fa-solid fa-xmark"></sherpa-button>

<!-- ✅ Correct — native button styled directly -->
<button type="button" class="search-clear input-action" aria-label="Clear search">
  <i class="fa-solid fa-xmark" aria-hidden="true"></i>
</button>
```

Reference implementations: `sherpa-input-number` (steppers), `sherpa-input-password` (toggle), `sherpa-input-search` (clear).

`<sherpa-button>` IS appropriate for full-size first-class actions: dialog close, wizard Back/Next, toolbar Add buttons, nav edit/confirm controls.

---

## MCP Verification Workflow

Always run this two-step sequence before writing and after writing:

```
query_component('sherpa-foo')         → confirms correct attribute names and enum values
get_component_examples('sherpa-foo')  → shows proven usage patterns
```

After generating: run `validate_usage(html)` and fix every warning before shipping.
