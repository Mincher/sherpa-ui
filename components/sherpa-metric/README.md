# sherpa-metric

> **Category:** data-display · **Base class:** SherpaElement

KPI card with value, trend, and sparkline. Extends ContentAttributesMixin(SherpaElement) for data pipeline. Trend-derived colouring via data-status on internal .metric-card.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-metric-id` | string | Unique identifier for the metric | — | — |
| `data-status` | enum | success \| warning \| critical \| info \| urgent | — | `success`, `warning`, `critical`, `info`, `urgent` |
| `data-trend` | enum | up \| down \| flat — trend direction | — | `up`, `down`, `flat` |
| `data-label` | string | Metric heading/label | — | — |
| `value` | string | Formatted metric value | — | — |
| `data-delta` | string | Change amount (e.g. "+12.5%") | — | — |

## Methods

| Method | Description |
| ------ | ----------- |
| `setVisible(visible)` | Set data-visible to "true"/"false" |
| `isVisible()` | Returns boolean |
| `getTransferableConfig(type)` | Config for switching presentation type |
| `getData()` | Returns metric config |
| `setData(data)` | Data pipeline entry |

### `setVisible(visible)`

Set data-visible to "true"/"false"

**Parameters:**

- `visible` (`any`) — 

### `getTransferableConfig(type)`

Config for switching presentation type

**Parameters:**

- `type` (`any`) — 

### `setData(data)`

Data pipeline entry

**Parameters:**

- `data` (`any`) — 

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_background-color`
- `--_border-color`
- `--_icon-color`
- `--_text-color`

## Usage

### Basic

```html
<sherpa-metric data-metric-id="value" data-status="success" data-trend="up" data-label="Example Label"></sherpa-metric>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-metric/sherpa-metric.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-metric.js`](sherpa-metric.js) | Component class, lifecycle, events |
| [`sherpa-metric.css`](sherpa-metric.css) | Styles, variants, states |
| [`sherpa-metric.html`](sherpa-metric.html) | Shadow DOM template(s) |
