# Input Components Quick Reference

All input components extend `SherpaInputBase` and share the attributes and events below.

## Shared Base Attributes

| Attribute | Type | Notes |
|-----------|------|-------|
| `name` | string | Field name — required for FormManager to discover the field |
| `data-label` | string | Label text shown above or beside the field |
| `data-description` | string | Secondary text shown below the label |
| `data-helper` | string | Hint text shown below the input |
| `data-layout` | enum | `horizontal` \| `inline` (default: stacked) |
| `data-status` | enum | `critical\|warning\|success\|info` — applies status coloring |
| `disabled` | boolean | Native disabled state |
| `readonly` | boolean | Native read-only |
| `required` | boolean | Marks field required — `FormManager.validate()` checks this |
| `value` | string | Current field value (JS property + HTML attribute) |
| `placeholder` | string | Input placeholder text |
| `novalidate` | boolean | Opt out of built-in validation display |

## Shared Events

Both events: `bubbles: true, composed: true`

| Event | `detail` | When |
|-------|----------|------|
| `input` | `{ value: string }` | On every keystroke or incremental change |
| `change` | `{ value: string }` | On commit (blur, Enter, selection, checkbox toggle) |

---

## Components

### `sherpa-input-text`
Single-line text input. Add `data-multiline` for a textarea.

```html
<sherpa-input-text
  data-label="Display name"
  name="display_name"
  placeholder="Enter name"
  required
  minlength="2"
  maxlength="100"></sherpa-input-text>

<!-- Multi-line textarea -->
<sherpa-input-text
  data-label="Notes"
  name="notes"
  data-multiline
  placeholder="Enter notes"></sherpa-input-text>
```

Extra: `placeholder`, `pattern`, `minlength`, `maxlength`, `data-multiline`

---

### `sherpa-input-number`
Numeric input with increment/decrement controls.

```html
<sherpa-input-number
  data-label="Port"
  name="port"
  min="1"
  max="65535"
  step="1"
  value="443"></sherpa-input-number>
```

Extra: `min`, `max`, `step`

---

### `sherpa-input-password`
Password field with show/hide toggle built in.

```html
<sherpa-input-password
  data-label="Password"
  name="password"
  required></sherpa-input-password>
```

---

### `sherpa-input-select`
Single-select dropdown. Children are native `<option>` and `<optgroup>` elements.

```html
<sherpa-input-select data-label="Status" name="status" required>
  <option value="">Select status…</option>
  <option value="active">Active</option>
  <option value="inactive">Inactive</option>
  <optgroup label="Legacy">
    <option value="archived">Archived</option>
  </optgroup>
</sherpa-input-select>
```

---

### `sherpa-input-date`
Date picker with calendar popover.

```html
<sherpa-input-date
  data-label="Start date"
  name="start_date"
  min="2024-01-01"
  max="2030-12-31"></sherpa-input-date>
```

Extra: `min`, `max` (ISO 8601 date strings: `YYYY-MM-DD`)

---

### `sherpa-input-date-range`
Date range picker — start and end date in one field.

```html
<sherpa-input-date-range
  data-label="Date range"
  name="date_range"></sherpa-input-date-range>
```

`form.read()` returns the range as a string; use component API to get individual start/end values.

---

### `sherpa-input-time`
Time picker.

```html
<sherpa-input-time
  data-label="Start time"
  name="start_time"></sherpa-input-time>
```

---

### `sherpa-input-search`
Search input. Fires `search` event on Enter or clear. Typically used in toolbars without a label.

```html
<sherpa-input-search
  placeholder="Search devices…"></sherpa-input-search>
```

Extra event: `search` — `detail: { value: string }` — fired on Enter or when cleared.

---

### `sherpa-input-tag`
Free-entry tag field. Enter a string and press Enter or comma to add a tag.

```html
<sherpa-input-tag
  data-label="Tags"
  name="tags"
  placeholder="Add tag…"></sherpa-input-tag>
```

Value is a comma-separated string of all entered tags.

---

### `sherpa-select-checkbox`
Single checkbox. Use inside `sherpa-select-group` for grouped selections.

```html
<!-- Standalone -->
<sherpa-select-checkbox
  data-label="Send notifications"
  name="notify"
  checked></sherpa-select-checkbox>
```

Extra: `checked`, `indeterminate`

---

### `sherpa-select-group`
Unified selection group. Default is multi-select checkboxes; set `data-type="radio"` for
single-select. `name` on the group — individual items have `value`.

```html
<!-- Checkbox group (multi-select) -->
<sherpa-select-group data-label="Platforms" name="platforms">
  <sherpa-select-checkbox value="windows" data-label="Windows"></sherpa-select-checkbox>
  <sherpa-select-checkbox value="macos"   data-label="macOS"></sherpa-select-checkbox>
  <sherpa-select-checkbox value="linux"   data-label="Linux"></sherpa-select-checkbox>
</sherpa-select-group>

<!-- Radio group (single-select) -->
<sherpa-select-group data-type="radio" data-label="Priority" name="priority">
  <sherpa-select-radio value="high"   data-label="High"></sherpa-select-radio>
  <sherpa-select-radio value="medium" data-label="Medium" checked></sherpa-select-radio>
  <sherpa-select-radio value="low"    data-label="Low"></sherpa-select-radio>
</sherpa-select-group>
```

Group value is always a `string[]`. Use `data-select-all` to show a "Select all" header
checkbox. Use `data-max="N"` to cap selections (checkbox mode only).

---

### `sherpa-file-upload`
File picker with drag-and-drop support.

```html
<sherpa-file-upload
  data-label="Upload configuration"
  name="config_file"
  accept=".json,.yaml,.yml"
  data-max-size="5242880"></sherpa-file-upload>
```

Extra: `accept` (MIME types or extensions), `multiple` (boolean), `data-max-size` (bytes)

---

### `sherpa-switch`
Boolean on/off toggle. Not a full form field — not discovered by FormManager by default. Use `name` to make it readable.

```html
<sherpa-switch
  data-label="Enable feature"
  name="feature_enabled"></sherpa-switch>
```

Fires `change` event with `detail: { checked: boolean }`.
