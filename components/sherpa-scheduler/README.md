# sherpa-scheduler

> **Category:** data · **Base class:** SherpaElement

Recurrence/schedule picker. Composes sherpa-input-select (frequency), sherpa-input-date, sherpa-input-time, sherpa-input-checkbox-group (weekdays template), sherpa-input-number.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-frequency` | enum | once \| hourly \| daily \| weekly \| monthly | `weekly` | `once`, `hourly`, `daily`, `weekly`, `monthly` |

## Events

### `schedule-change`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  value: SchedulePayload,
};
```

```js
element.addEventListener("schedule-change", (e) => {
  console.log(e.detail.value);
});
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `value` | `object` | Current schedule object (getter/setter) | read/write |

## Usage

### Basic

```html
<sherpa-scheduler data-frequency="once"></sherpa-scheduler>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-scheduler/sherpa-scheduler.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-scheduler.js`](sherpa-scheduler.js) | Component class, lifecycle, events |
| [`sherpa-scheduler.css`](sherpa-scheduler.css) | Styles, variants, states |
| [`sherpa-scheduler.html`](sherpa-scheduler.html) | Shadow DOM template(s) |
