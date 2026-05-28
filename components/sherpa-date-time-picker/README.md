# sherpa-date-time-picker

A combined date and time selection component featuring an integrated calendar picker and time spinners.

## Features

- **Integrated Calendar Picker** — Monthly calendar view with month/year navigation
- **Time Spinners** — Hour/minute input with increment/decrement buttons
- **24-hour Format** — Native 24-hour time format (AM/PM toggle available via `data-24hour` attribute)
- **Form Integration** — Native form submission support via hidden input
- **Accessibility** — Semantic HTML with ARIA labels and keyboard navigation
- **Compact & Full Sizes** — Responsive layout modes
- **Status Indicators** — Support for critical/warning states via `data-status` attribute
- **Token-based Styling** — Consistent with Sherpa design system tokens

## Basic Usage

```html
<sherpa-date-time-picker
  name="event_datetime"
  data-label="Event Date & Time"
  data-description="When should this event occur?"
></sherpa-date-time-picker>
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | — | Field name for form submission |
| `value` | string | — | Current value in ISO format: `YYYY-MM-DDTHH:mm` |
| `disabled` | boolean | false | Disable input and interaction |
| `readonly` | boolean | false | Allow viewing but not changing value |
| `required` | boolean | false | Mark field as required for form validation |
| `data-label` | string | — | Visible label text |
| `data-description` | string | — | Secondary description (shown when set) |
| `data-helper` | string | — | Helper or hint text below input |
| `min` | string | — | Minimum date-time (ISO format) for validation |
| `max` | string | — | Maximum date-time (ISO format) for validation |
| `data-24hour` | boolean | true | Use 24-hour time format (false = 12-hour with AM/PM) |
| `data-compact` | boolean | false | Compact layout mode |
| `data-size` | string | md | Size variant: `sm`, `md`, `lg` |
| `data-status` | string | — | Status indicator: `critical`, `warning` |

## Methods

### `getValue()`
Returns the current date-time value in ISO format.

```javascript
const picker = document.querySelector('sherpa-date-time-picker');
console.log(picker.getValue()); // "2026-05-27T14:30"
```

### `setValue(dateTimeString)`
Set the date-time value programmatically.

```javascript
picker.setValue('2026-05-20T10:00');
```

## Events

### `datetime-change`
Fired whenever the date or time selection changes (including calendar clicks and time input changes).

```javascript
picker.addEventListener('datetime-change', (e) => {
  console.log('Selected:', e.detail.value);        // "2026-05-27T14:30"
  console.log('Display:', e.detail.displayValue);  // "05/27/2026 14:30"
});
```

**Event Detail:**
- `value` (string) — ISO format date-time
- `displayValue` (string) — Human-readable format

### `datetime-submit`
Fired when the "Apply" button is clicked.

```javascript
picker.addEventListener('datetime-submit', (e) => {
  console.log('Submitted:', e.detail.value);
  // Send to server, close dialog, etc.
});
```

### `datetime-cancel`
Fired when the "Cancel" button is clicked.

```javascript
picker.addEventListener('datetime-cancel', () => {
  // Close dialog or reset state
});
```

## Examples

### In a Form Dialog

```html
<sherpa-dialog>
  <form slot="content">
    <sherpa-date-time-picker
      name="start_time"
      data-label="Event Start"
      required
    ></sherpa-date-time-picker>
    <sherpa-date-time-picker
      name="end_time"
      data-label="Event End"
      required
    ></sherpa-date-time-picker>
  </form>
</sherpa-dialog>
```

### With Time Zone Support (Future)

```html
<sherpa-date-time-picker
  value="2026-05-27T14:30"
  data-include-time-zone="true"
></sherpa-date-time-picker>
```

### Compact Mode for Inline Selection

```html
<sherpa-date-time-picker
  data-compact="true"
  data-size="sm"
></sherpa-date-time-picker>
```

### With Status Indicator

```html
<sherpa-date-time-picker
  data-label="Deadline"
  data-status="warning"
  data-helper="This deadline is approaching"
></sherpa-date-time-picker>
```

## Styling

The component uses Sherpa design tokens for all colors, spacing, and typography. To customize the theme:

```html
<div data-theme="apex-2-teal">
  <sherpa-date-time-picker></sherpa-date-time-picker>
</div>
```

### CSS Parts (for advanced styling)

- `calendar` — Calendar grid container
- `time-spinners` — Time input spinners
- `actions` — Action buttons area

## Accessibility

- **Semantic HTML** — Uses `<button>` and `<input>` elements with proper roles
- **ARIA Labels** — Navigation buttons and spinners have `aria-label` attributes
- **Keyboard Navigation** — Tab through controls, use arrow keys in spinners
- **Focus Indicators** — 2px blue focus ring on focused elements
- **Forced Colors** — Works in high-contrast mode

## Design System Integration

This component follows Sherpa's 3-layer architecture:
- **HTML** — Semantic structure with Template Completeness Rule (all elements exist from start)
- **CSS** — 9-section organization with token-based values and no raw literals
- **JavaScript** — SherpaElement extension with lifecycle hooks and event emission

See [new-component skill](.github/skills/new-component/SKILL.md) for component creation guidelines.

## Related Components

- [`sherpa-input-date`](../sherpa-input-date/) — Simple date picker
- [`sherpa-input-time`](../sherpa-input-time/) — Simple time picker
- [`sherpa-input-date-range`](../sherpa-input-date-range/) — Date range picker
- [`sherpa-dialog`](../sherpa-dialog/) — Container for date-time picker
- [`sherpa-input-text`](../sherpa-input-text/) — For custom date-time formats
