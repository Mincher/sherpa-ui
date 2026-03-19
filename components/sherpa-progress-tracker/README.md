# sherpa-progress-tracker

> **Category:** feedback · **Base class:** SherpaElement

Vertical timeline with status-coloured milestone nodes. Milestones rendered via cloning prototype from template.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-heading` | string | Tracker heading text | — | — |
| `data-percentage` | string | Completion text (e.g. "60% Complete") | — | — |

## Methods

| Method | Description |
| ------ | ----------- |
| `setMilestones(milestones)` | Set milestones: [{ label, status, description?, timestamp? }] |

### `setMilestones(milestones)`

Set milestones: [{ label, status, description?, timestamp? }]

**Parameters:**

- `milestones` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `milestones` | `Array` | Current milestones array (getter-only) | read/write |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_connector-color`
- `--_node-bg`
- `--_node-border`
- `--_node-icon`
- `--_node-icon-color`

## Usage

### Basic

```html
<sherpa-progress-tracker data-heading="value" data-percentage="value"></sherpa-progress-tracker>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-progress-tracker/sherpa-progress-tracker.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-progress-tracker.js`](sherpa-progress-tracker.js) | Component class, lifecycle, events |
| [`sherpa-progress-tracker.css`](sherpa-progress-tracker.css) | Styles, variants, states |
| [`sherpa-progress-tracker.html`](sherpa-progress-tracker.html) | Shadow DOM template(s) |
