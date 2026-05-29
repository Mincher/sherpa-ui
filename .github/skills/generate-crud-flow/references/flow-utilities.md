# Flow Utilities API Reference

## FlowManager

```js
import { FlowManager } from 'sherpa-ui/components/utilities/flow-manager.js';
```

### Constructor Options

```js
new FlowManager({
  entity:      string,          // Required — entity name (e.g. 'device', 'user')
  contentArea: HTMLElement,     // Element with [data-dataset] for event dispatch
  dialogs: {
    addEdit?: HTMLElement,      // sherpa-dialog for Add/Edit flows
    delete?:  HTMLElement,      // sherpa-dialog for Delete confirmation
  },
  onSave?:    async (editingRecord: Object, flowType: 'add'|'edit') => savedRecord,
  onDelete?:  async (ids: any[]) => count,
  onRefresh?: () => void,       // Called after successful save or delete
  labels?: {
    addTitle?:    string,       // Default: "Add {Entity}"
    editTitle?:   string,       // Default: "Edit {Entity}"
    saveLabel?:   string,       // Default: "Save {Entity}"
    updateLabel?: string,       // Default: "Update {Entity}"
    deleteTitle?: string,       // Default: "Delete {Entity}"
  },
})
```

### Public Methods

| Method | Parameters | Description |
|--------|-----------|-------------|
| `startAdd()` | — | Opens `addEdit` dialog in add mode (blank form) |
| `startEdit(record)` | `record: Object` | Opens `addEdit` dialog pre-populated with record |
| `startDelete(ids, message?)` | `ids: any[]`, `message?: string` | Opens delete confirmation dialog |

### Events Dispatched

All dispatched on `contentArea`. All `bubbles: true, composed: true`.

| Event | `detail` | When |
|-------|----------|------|
| `flow-start` | `{ flow: 'add'|'edit'|'delete', entity: string, data?: Object }` | Dialog opens |
| `flow-progress` | `{ flow, entity, data?: Object }` | Save / Delete clicked |
| `flow-complete` | `{ flow, entity, data: Object }` | API call succeeds |
| `flow-cancel` | `{ flow, entity }` | User cancels |
| `flow-error` | `{ flow, entity, error: string }` | API call throws |

FlowManager also calls `SherpaToast.success()` on `flow-complete` and `SherpaToast.critical()` on `flow-error` automatically.

---

## FormManager

```js
import { FormManager } from 'sherpa-ui/components/utilities/form-manager.js';
```

Discovers all elements with a `name` attribute inside the container (any `sherpa-input-*` component). Works with any containing element — dialog, form, div.

### Constructor

```js
const form = new FormManager(container: HTMLElement);
```

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `read()` | `Object` | All field values as `{ fieldName: value }` map |
| `get(name)` | `string` | Single field value by name, or `''` if not found |
| `populate(data)` | `void` | Set fields from object — only touches fields that exist |
| `clear()` | `void` | Reset all named fields to empty string |
| `validate()` | `string[]` | Names of `required` fields that are currently empty |

### Usage Pattern

```js
// Add flow
form.clear();
flow.startAdd();

// Edit flow
form.populate(record);  // Set fields from record object
flow.startEdit(record);

// Inside onSave callback
async onSave(editingRecord, flowType) {
  const values  = form.read();     // { name: "WS-01", type: "workstation" }
  const missing = form.validate(); // [] if all required fields are filled
  if (missing.length) throw new Error('Fill in all required fields.');
  return await api.save(values);
}
```

---

## refreshDataset

```js
import { refreshDataset } from 'sherpa-ui/components/utilities/grid-refresh.js';

refreshDataset(contentArea, loader);
```

Re-dispatches `datasetfiltered` on the `contentArea` element. This causes any `sherpa-data-grid` or content-attributes-aware component in that subtree to re-fetch and re-render its data.

Call in `onRefresh` so grids update after save or delete:
```js
onRefresh: () => refreshDataset(contentArea, loader),
```

`loader` is optional — pass a `sherpa-loader` element to show/hide a loading overlay during refresh.

---

## SherpaToast

```js
import { SherpaToast } from 'sherpa-ui/components/sherpa-toast/sherpa-toast.js';
```

Static methods — no component instance or element needed. Automatically called by FlowManager, but available for direct use.

| Method | Visual | When to use |
|--------|--------|-------------|
| `SherpaToast.success(message)` | Green | Action completed successfully |
| `SherpaToast.critical(message)` | Red | Action failed or error occurred |
| `SherpaToast.warning(message)` | Amber | Caution or non-blocking issue |
| `SherpaToast.info(message)` | Blue | Informational / in-progress notice |
