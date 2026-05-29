---
name: feedback-and-states
description: 'Add UX feedback states to Sherpa UI views. Use when: showing a loading state with spinner or skeleton; displaying an empty state placeholder when no data exists; adding a confirmation dialog before destructive actions; showing SherpaToast success, error, info, or warning notifications; choosing between sherpa-message (persistent inline) and sherpa-toast (transient popup); applying data-status for critical, warning, success, or info coloring on inputs, callouts, and containers.'
---

# Feedback and States

## When to Use
- View is loading data → loading state
- View has no data to show → empty state
- User is about to do something destructive → confirmation dialog
- API call completes or fails → toast notification
- Persistent inline error or system message needed → callout or message banner
- Field has a validation error → `data-status="critical"` on the input

## Decision Tree

```
Is a destructive action about to happen (delete, reset)?
  → Confirmation dialog (sherpa-dialog + sherpa-callout[data-status="warning"])

Is this a persistent page-level or section-level message?
  → sherpa-message (dismissible banner, top of section)
  → sherpa-callout (inline, non-dismissible, near related content)

Is this a transient "action result" notification?
  → SherpaToast.success() / .critical() / .info() / .warning()

Is the entire view or a panel loading?
  → loading-state pattern or sherpa-loader overlay

Is the view loaded but has no data?
  → sherpa-empty-state
```

---

## Loading State

### Short wait (<2s): spinner overlay

```html
<sherpa-loader data-label="Loading…"></sherpa-loader>
```

Toggle programmatically via `data-loading` on the content container:
```js
container.toggleAttribute('data-loading', true);
// ... when data arrives:
container.toggleAttribute('data-loading', false);
```

Many Sherpa container components respond to `data-loading` automatically — the grid shows a loading overlay when `data-loading` is present on `sherpa-data-grid`.

### Skeleton (perceived performance for longer waits)

```
get_pattern({ id: "loading-state" })
```

Or inline:
```html
<sherpa-loader data-size="large" data-variant="skeleton"></sherpa-loader>
```

---

## Empty State

Show when content has loaded but there are zero rows / results.

```html
<sherpa-empty-state
  data-label="No devices found"
  data-description="Add a device to get started, or adjust your filters."
  data-icon="&#xf108;">
  <sherpa-button slot="actions" data-label="Add Device"
                 data-variant="primary" data-icon-start="&#xf067;"></sherpa-button>
</sherpa-empty-state>
```

MCP: `get_pattern({ id: "empty-state" })`

**When to show it:** After data loads and `rows.length === 0`. Replace `sherpa-data-grid` with the empty state, or use the grid's built-in empty-state slot.

---

## Confirmation Dialog

For destructive or irreversible actions. Always use `sherpa-callout[data-status="warning"]` to communicate the risk.

```html
<sherpa-dialog id="confirm-dialog" data-label="Delete Device"
               data-size="small" data-dismissible>
  <sherpa-callout data-status="warning">
    <span slot="message">
      This will permanently delete the device and all associated data.
      This action cannot be undone.
    </span>
  </sherpa-callout>
  <sherpa-button slot="footer" data-label="Cancel"        data-variant="secondary"></sherpa-button>
  <sherpa-button slot="footer" data-label="Delete Device" data-variant="primary"
                 data-status="critical"></sherpa-button>
</sherpa-dialog>
```

```js
import { SherpaToast } from 'sherpa-ui/components/sherpa-toast/sherpa-toast.js';

const dialog    = document.getElementById('confirm-dialog');
const deleteBtn = dialog.querySelector('[data-label="Delete Device"]');

// Open the dialog
triggerBtn.addEventListener('button-click', () => dialog.show());

// Confirm action
deleteBtn.addEventListener('button-click', async () => {
  try {
    await api.delete(selectedIds);
    dialog.close();
    SherpaToast.success(`${selectedIds.length} device(s) deleted.`);
    grid.setData(await api.fetchAll());
  } catch (err) {
    dialog.close();
    SherpaToast.critical('Failed to delete. Please try again.');
  }
});
```

> For CRUD flows, prefer `FlowManager` which handles confirmation, API call, toast, and refresh automatically. See the `generate-crud-flow` skill.

MCP: `get_pattern({ id: "confirmation-dialog" })`

---

## SherpaToast — Transient Notifications

Static methods — no component element required.

```js
import { SherpaToast } from 'sherpa-ui/components/sherpa-toast/sherpa-toast.js';

SherpaToast.success('Device saved successfully.');
SherpaToast.critical('Failed to connect. Check your network.');
SherpaToast.warning('Session will expire in 5 minutes.');
SherpaToast.info('Sync in progress…');
```

**Use for:**
- Confirming successful actions (save, delete, copy, export)
- Reporting async failures (API errors, network timeouts)
- Non-blocking informational nudges (background sync, session warnings)

**Do not use for:**
- Persistent system messages → use `sherpa-message`
- Inline field validation errors → use `data-status` on inputs
- Actions requiring a response → use `sherpa-dialog`

---

## Inline Feedback: sherpa-callout vs sherpa-message

| | `sherpa-callout` | `sherpa-message` |
|--|--|--|
| **Use for** | Contextual inline callouts near related content | Page or section-level status banners |
| **Position** | Inline with surrounding content | Typically at top of a view or section |
| **Dismissible** | No | Yes (`data-dismissible`) |
| **Status** | `data-status="critical\|warning\|success\|info"` | Same |
| **Content slot** | `slot="message"` | `slot="message"` |

```html
<!-- Inline error near a form field or dialog -->
<sherpa-callout data-status="critical">
  <span slot="message">The IP address format is invalid.</span>
</sherpa-callout>

<!-- Dismissible page-level notice -->
<sherpa-message data-status="info" data-dismissible>
  <span slot="message">
    Scheduled maintenance window: Sunday 02:00–04:00 UTC.
  </span>
</sherpa-message>
```

---

## Status on Input Fields

To mark a field as having a validation error, set `data-status` directly on the input. Pair with `data-helper` for the error message:

```html
<sherpa-input-text
  data-label="Email"
  name="email"
  data-status="critical"
  data-helper="Please enter a valid email address."></sherpa-input-text>

<sherpa-input-select
  data-label="Type"
  name="type"
  data-status="warning"
  data-helper="This type is deprecated."></sherpa-input-select>
```

`data-status` flows the `--_status-*` CSS custom properties into the component, which drives border, label, and helper text coloring automatically.
