---
name: generate-crud-flow
description: 'Generate a complete CRUD user flow in Sherpa UI. Use when: implementing Add, Create, Edit, Update, or Delete entity flows; wiring a dialog form with Save and Cancel buttons; using FlowManager and FormManager utilities; handling flow-start, flow-progress, flow-complete, flow-error, flow-cancel lifecycle events; showing SherpaToast success or error feedback after save or delete operations.'
---

# Generate CRUD Flow

## When to Use
- Adding an "Add entity" or "Create" action that opens a dialog form
- Adding an "Edit entity" action that pre-populates a dialog form
- Adding a "Delete entity" action with a confirmation dialog
- Wiring FlowManager + FormManager + SherpaToast together

## Quick Start with MCP
```
generate_flow({ entity: "device", flow: "add" })
generate_flow({ entity: "device", flow: "edit" })
generate_flow({ entity: "device", flow: "delete" })
```

Or read canonical patterns directly:
- `patterns/flows/add.html`
- `patterns/flows/edit.html`
- `patterns/flows/delete.html`

## Flow Lifecycle

```
idle → started → in-progress → complete
                             → cancelled
                             → error
```

State lives in **JS memory** (FlowManager) — never in DOM attributes.

### Events (all `bubbles: true, composed: true`)

| Event | When | `detail` |
|-------|------|---------|
| `flow-start` | Dialog opens | `{ flow, entity, data? }` |
| `flow-progress` | Save / Delete clicked | `{ flow, entity, data? }` |
| `flow-complete` | API call succeeds | `{ flow, entity, data }` |
| `flow-cancel` | User cancels | `{ flow, entity }` |
| `flow-error` | API call fails | `{ flow, entity, error: string }` |

---

## Add Flow

### HTML

```html
<!-- Trigger — in toolbar or view-header actions slot -->
<sherpa-button id="add-btn" data-label="Add Device"
               data-variant="primary" data-icon-start="&#xf067;"></sherpa-button>

<!-- Dialog — FlowManager opens/closes this -->
<sherpa-dialog id="entity-dialog" data-label="Add Device"
               data-size="medium" data-dismissible>

  <sherpa-input-text data-label="Name" name="name" required
                     placeholder="Enter device name"></sherpa-input-text>
  <sherpa-input-select data-label="Type" name="type">
    <option value="">Select type…</option>
    <option value="workstation">Workstation</option>
    <option value="server">Server</option>
  </sherpa-input-select>
  <sherpa-input-text data-label="Notes" name="notes"
                     data-multiline placeholder="Optional notes"></sherpa-input-text>

  <sherpa-button slot="footer" data-label="Cancel" data-variant="secondary"></sherpa-button>
  <sherpa-button slot="footer" data-label="Save Device" data-variant="primary"></sherpa-button>
</sherpa-dialog>
```

### JavaScript

```js
import { FlowManager }   from 'sherpa-ui/components/utilities/flow-manager.js';
import { FormManager }   from 'sherpa-ui/components/utilities/form-manager.js';
import { refreshDataset } from 'sherpa-ui/components/utilities/grid-refresh.js';

const dialog      = document.getElementById('entity-dialog');
const contentArea = document.querySelector('[data-dataset="devices"]');
const loader      = document.querySelector('sherpa-loader');

const form = new FormManager(dialog);
const flow = new FlowManager({
  entity: 'device',         // Drives default dialog titles and toast messages
  contentArea,
  dialogs: { addEdit: dialog },

  async onSave(editingRecord, flowType) {
    const values  = form.read();
    const missing = form.validate();     // Returns names of empty required fields
    if (missing.length) throw new Error('Please fill in all required fields.');
    return await api.create(values);     // Return the saved record
  },

  onRefresh: () => refreshDataset(contentArea, loader),
});

document.getElementById('add-btn').addEventListener('button-click', () => {
  form.clear();       // Reset fields for a fresh Add
  flow.startAdd();    // Opens dialog with "Add Device" title + "Save Device" button
});
```

---

## Edit Flow

Same dialog as Add, pre-populated from a row record. Triggered by a row action.

```js
// grid fires row-action for each row menu item click
grid.addEventListener('row-action', (e) => {
  if (e.detail.action !== 'edit') return;
  const record = e.detail.rowData;
  form.populate(record);   // Set each [name] field from the record object
  flow.startEdit(record);  // Opens dialog — "Edit Device" title, "Update Device" button
});

// FlowManager calls onSave(record, 'edit') — use flowType to distinguish Add vs Edit:
async onSave(editingRecord, flowType) {
  const values = form.read();
  if (flowType === 'add')  return await api.create(values);
  if (flowType === 'edit') return await api.update(editingRecord.id, values);
},
```

**Key difference from Add:** call `form.populate(record)` before `flow.startEdit(record)`.

---

## Delete Flow

Uses a separate confirmation dialog with a warning callout — no form fields.

### HTML

```html
<sherpa-dialog id="delete-dialog" data-label="Delete Device"
               data-size="small" data-dismissible>
  <sherpa-callout data-status="warning">
    <span slot="message">This action cannot be undone.</span>
  </sherpa-callout>
  <sherpa-button slot="footer" data-label="Cancel"        data-variant="secondary"></sherpa-button>
  <sherpa-button slot="footer" data-label="Delete Device" data-variant="primary"
                 data-status="critical"></sherpa-button>
</sherpa-dialog>
```

### JavaScript

```js
const flow = new FlowManager({
  entity: 'device',
  contentArea,
  dialogs: { delete: document.getElementById('delete-dialog') },

  async onDelete(ids) {
    await api.delete(ids);
    return ids.length;
  },

  onRefresh: () => refreshDataset(contentArea, loader),
});

// From a row action
grid.addEventListener('row-action', (e) => {
  if (e.detail.action !== 'delete') return;
  flow.startDelete([e.detail.rowData.id], `Delete "${e.detail.rowData.name}"?`);
});

// From bulk selection
deleteBtn.addEventListener('button-click', () => {
  const ids = grid.getSelectedRows();
  flow.startDelete(ids, `Delete ${ids.length} device(s)?`);
});
```

---

## Combined Add + Edit + Delete

Pass both dialog refs and both callbacks to a single FlowManager:

```js
const flow = new FlowManager({
  entity: 'device',
  contentArea,
  dialogs: {
    addEdit: document.getElementById('entity-dialog'),
    delete:  document.getElementById('delete-dialog'),
  },
  async onSave(record, type) {
    const values = form.read();
    if (type === 'add')  return await api.create(values);
    if (type === 'edit') return await api.update(record.id, values);
  },
  async onDelete(ids) {
    await api.delete(ids);
    return ids.length;
  },
  onRefresh: () => refreshDataset(contentArea, loader),
});
```

---

## SherpaToast — Direct Use

FlowManager calls these automatically, but you can also call them directly:

```js
import { SherpaToast } from 'sherpa-ui/components/sherpa-toast/sherpa-toast.js';

SherpaToast.success('Device saved successfully.');
SherpaToast.critical('Failed to save. Please try again.');
SherpaToast.warning('Session will expire in 5 minutes.');
SherpaToast.info('Sync in progress…');
```

Static methods — no element instance needed.

---

See [references/flow-utilities.md](./references/flow-utilities.md) for the full FlowManager constructor options and FormManager method signatures.
