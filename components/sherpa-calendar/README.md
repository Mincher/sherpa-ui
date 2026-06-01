# sherpa-calendar

> **Category:** utility · **Base class:** SherpaElement

Standalone calendar component for date selection. Supports single date and date range selection modes. Used by sherpa-input-date, sherpa-input-date-range, and sherpa-date-time-picker.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-value` | string | Selected date (ISO format: YYYY-MM-DD) | — | — |
| `data-value-end` | string | End date for range selection (ISO format) | — | — |
| `data-min` | string | Minimum selectable date (ISO format) | — | — |
| `data-max` | string | Maximum selectable date (ISO format) | — | — |
| `data-mode` | enum | single \| range (default: single) | — | `single`, `range` |
| `data-view` | enum | day \| month \| year (default: day) | — | `day`, `month`, `year` |
| `data-view-date` | string | Currently displayed month (ISO format, defaults to today) | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `header` | Custom header content (replaces default month/year navigation) |
| `footer` | Footer content (e.g., action buttons, shortcuts) |

Slot usage:

```html
<sherpa-calendar>
  <div slot="header"><!-- Custom header content (replaces default month/year navigation) --></div>
  <div slot="footer"><!-- Footer content (e.g., action buttons, shortcuts) --></div>
</sherpa-calendar>
```

## Events

### `dateselect`

Dispatched when a single date is selected

**Propagation:** bubbles

**Detail:**

```js
event.detail = {
  value: string (ISO),
  valueAsDate: Date,
};
```

```js
element.addEventListener("dateselect", (e) => {
  console.log(e.detail.value);
});
```

### `rangeselect`

Dispatched when a date range is selected

**Propagation:** bubbles

**Detail:**

```js
event.detail = {
  start: string (ISO),
  end: string (ISO),
  startAsDate: Date,
  endAsDate: Date,
};
```

```js
element.addEventListener("rangeselect", (e) => {
  console.log(e.detail.start);
});
```

### `viewchange`

Dispatched when month/year view changes

**Propagation:** bubbles

**Detail:**

```js
event.detail = {
  viewDate: string (ISO),
  view: 'day'|'month'|'year',
};
```

```js
element.addEventListener("viewchange", (e) => {
  console.log(e.detail.viewDate);
});
```

## CSS Parts

Style internal elements from outside the shadow DOM:

- `header`
- `prev-button`
- `month-label`
- `next-button`
- `weekdays`
- `days-grid`
- `footer`

```css
sherpa-calendar::part(header) {
  /* custom styles */
}
```

## Usage

### Basic

```html
<sherpa-calendar data-value="value" data-value-end="value" data-min="value">
  <span slot="header"><!-- Custom header content (replaces default month/year navigation) --></span>
  <span slot="footer"><!-- Footer content (e.g., action buttons, shortcuts) --></span>
</sherpa-calendar>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-calendar/sherpa-calendar.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-calendar.js`](sherpa-calendar.js) | Component class, lifecycle, events |
| [`sherpa-calendar.css`](sherpa-calendar.css) | Styles, variants, states |
| [`sherpa-calendar.html`](sherpa-calendar.html) | Shadow DOM template(s) |
