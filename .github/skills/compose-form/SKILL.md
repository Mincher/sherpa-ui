---
name: compose-form
description: 'Build a form using Sherpa input components. Use when: creating a form with input fields; choosing the right input type (text, number, password, select, checkbox, radio, date, date-range, search, tag, time, file-upload); applying horizontal or inline layout; grouping fields with sherpa-section-header; annotating fields with data-description and data-helper; using FormManager to read values, validate, and pre-populate edit forms.'
---

# Compose Form

## When to Use
- Building a settings page, profile form, or wizard step
- Creating form fields inside an Add / Edit dialog
- Selecting the right input component for each data type
- Grouping, labelling, and annotating fields correctly
- Integrating FormManager for read / validate / populate / clear

## Input Selection Guide

| Data type | Component | Key extra attributes |
|-----------|-----------|----------------------|
| Single-line text | `sherpa-input-text` | `placeholder`, `minlength`, `maxlength`, `pattern` |
| Multi-line text | `sherpa-input-text` | `data-multiline` |
| Integer or decimal | `sherpa-input-number` | `min`, `max`, `step` |
| Password | `sherpa-input-password` | — (show/hide toggle built-in) |
| Search / filter query | `sherpa-input-search` | `placeholder` |
| Free-entry tags | `sherpa-input-tag` | `placeholder` |
| Time | `sherpa-input-time` | — |
| Single date | `sherpa-input-date` | `min`, `max` (ISO string) |
| Date range | `sherpa-input-date-range` | — |
| Dropdown (single) | `sherpa-input-select` | `<option>` children |
| Single checkbox | `sherpa-input-checkbox` | `checked`, `indeterminate` |
| Checkbox group (multi-select) | `sherpa-select-group` | child `sherpa-select-checkbox` |
| Radio group (single-select) | `sherpa-select-group` + `data-type="radio"` | child `sherpa-select-radio` |
| Boolean toggle | `sherpa-switch` | — (not a full form input) |
| File upload | `sherpa-file-upload` | `accept`, `multiple`, `data-max-size` |

---

## Form Inside a Dialog (Add / Edit)

```html
<sherpa-dialog data-label="Add Device" data-size="medium" data-dismissible>

  <sherpa-input-text data-label="Name" name="name" required
                     placeholder="Enter device name"></sherpa-input-text>

  <sherpa-input-select data-label="Type" name="type" required>
    <option value="">Select type…</option>
    <option value="workstation">Workstation</option>
    <option value="server">Server</option>
    <option value="mobile">Mobile</option>
  </sherpa-input-select>

  <sherpa-input-number data-label="Port" name="port"
                       min="1" max="65535" step="1" value="443"></sherpa-input-number>

  <sherpa-input-text data-label="Notes" name="notes"
                     data-multiline placeholder="Optional notes"></sherpa-input-text>

  <!-- Footer actions — always in the footer slot -->
  <sherpa-button slot="footer" data-label="Cancel" data-variant="secondary"></sherpa-button>
  <sherpa-button slot="footer" data-label="Save Device" data-variant="primary"></sherpa-button>
</sherpa-dialog>
```

---

## Standalone Settings Page

```html
<sherpa-view-header data-label="Settings"></sherpa-view-header>

<!-- ── Section 1 ── -->
<sherpa-section-header data-label="General"></sherpa-section-header>
<sherpa-container>
  <sherpa-input-text  data-label="Display name" name="display_name" required
                      data-description="Name shown in the product navigation bar"></sherpa-input-text>
  <sherpa-input-text  data-label="Email" name="email" required></sherpa-input-text>
  <sherpa-input-select data-label="Timezone" name="timezone">
    <option value="utc">UTC</option>
    <option value="us-east">US Eastern</option>
    <option value="us-west">US Pacific</option>
  </sherpa-input-select>
</sherpa-container>

<!-- ── Section 2 ── -->
<sherpa-section-header data-label="Notifications"></sherpa-section-header>
<sherpa-container>
  <sherpa-switch data-label="Email notifications" name="notify_email"></sherpa-switch>
  <sherpa-switch data-label="In-app notifications" name="notify_app"></sherpa-switch>
</sherpa-container>

<!-- ── Section 3 ── -->
<sherpa-section-header data-label="Appearance"></sherpa-section-header>
<sherpa-container>
  <sherpa-select-group data-type="radio" data-label="Theme" name="theme">
    <sherpa-select-radio value="auto"  data-label="Auto (system)"></sherpa-select-radio>
    <sherpa-select-radio value="light" data-label="Light"></sherpa-select-radio>
    <sherpa-select-radio value="dark"  data-label="Dark"  checked></sherpa-select-radio>
  </sherpa-select-group>
</sherpa-container>

<!-- ── Save/Cancel ── -->
<div class="form-actions">
  <sherpa-button data-label="Cancel"       data-variant="secondary"></sherpa-button>
  <sherpa-button data-label="Save changes" data-variant="primary"></sherpa-button>
</div>
```

---

## Field Layout Options

Set `data-layout` on individual inputs, or on a parent container to apply to all children:

```html
<!-- Stacked (default): label stacked above the input -->
<sherpa-input-text data-label="Name" name="name"></sherpa-input-text>

<!-- Horizontal: label left of input — good for dense settings forms -->
<sherpa-input-text data-label="Name" name="name" data-layout="horizontal"></sherpa-input-text>

<!-- Inline: compact, no block layout — for toolbars or filter bars -->
<sherpa-input-text data-label="Name" name="name" data-layout="inline"></sherpa-input-text>
```

---

## Field Annotations

```html
<!-- data-description: shown below label, explains the field's purpose -->
<sherpa-input-text
  data-label="API Key"
  data-description="Used to authenticate API requests. Treat this as a password."
  name="api_key"></sherpa-input-text>

<!-- data-helper: shown below the input, provides format/constraint hint -->
<sherpa-input-text
  data-label="IP Address"
  data-helper="Format: 192.168.1.1"
  name="ip_address"></sherpa-input-text>

<!-- required: marks field as required (FormManager.validate() checks this) -->
<sherpa-input-text data-label="Name" name="name" required></sherpa-input-text>
```

---

## Checkbox and Radio Patterns

```html
<!-- Checkbox group: multi-select. value is string[] -->
<sherpa-select-group data-label="Platforms" name="platforms">
  <sherpa-select-checkbox value="windows" data-label="Windows"></sherpa-select-checkbox>
  <sherpa-select-checkbox value="macos"   data-label="macOS"></sherpa-select-checkbox>
  <sherpa-select-checkbox value="linux"   data-label="Linux"></sherpa-select-checkbox>
</sherpa-select-group>

<!-- Radio group: single-select. value is string[] with one element -->
<sherpa-select-group data-type="radio" data-label="Priority" name="priority">
  <sherpa-select-radio value="high"   data-label="High"></sherpa-select-radio>
  <sherpa-select-radio value="medium" data-label="Medium" checked></sherpa-select-radio>
  <sherpa-select-radio value="low"    data-label="Low"></sherpa-select-radio>
</sherpa-select-group>
```

---

## FormManager Integration

```js
import { FormManager } from 'sherpa-ui/components/utilities/form-manager.js';

const form = new FormManager(dialog);  // Or any container with [name] fields

// Read all field values as an object
const values = form.read();
// → { name: 'WS-01', type: 'workstation', port: '443', notes: '' }

// Validate required fields — returns names of empty required fields
const missing = form.validate();
if (missing.length) throw new Error('Please fill in all required fields.');

// Pre-populate for Edit flow
form.populate({ name: 'WS-01', type: 'workstation', port: 443 });

// Clear for Add flow
form.clear();

// Read a single field
const name = form.get('name');
```

---

See [references/input-components.md](./references/input-components.md) for per-component attribute listings and HTML examples.
