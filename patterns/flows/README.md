# CRUD Flow Patterns

> **Multi-step workflows for create, read, update, delete operations**

Flow patterns demonstrate how to compose Sherpa UI components into complete CRUD workflows. These patterns show the full interaction sequence from user initiation to completion feedback.

---

## Patterns in This Category

### [Add Flow](add.html)

**Purpose:** Create a new item with validation and confirmation

**Flow Steps:**
1. **Trigger** — User clicks "Add" button
2. **Form** — Modal dialog with input fields
3. **Validation** — Client-side validation feedback
4. **Submit** — Server request with loading state
5. **Confirmation** — Success message and redirect/close

**Structure:**
- `<sherpa-button>` — Trigger button
- `<sherpa-dialog>` — Modal container
- `<sherpa-input-*>` — Form inputs with validation
- `<sherpa-container-footer>` — Cancel/Save actions
- `<sherpa-toast>` — Success/error feedback

**When to use:**
- Adding users, devices, configurations
- Creating new entities
- Form-based data entry

**Key Features:**
- Modal dialog workflow
- Required field validation
- Server-side error handling
- Optimistic UI updates
- Success confirmation

**Code Example:**
```html
<sherpa-button data-variant="primary" onclick="openAddDialog()">
  Add User
</sherpa-button>

<sherpa-dialog id="add-dialog" data-label="Add New User">
  <form>
    <sherpa-input-text 
      data-label="Name" 
      required>
    </sherpa-input-text>
    
    <sherpa-input-text 
      data-label="Email" 
      type="email" 
      required>
    </sherpa-input-text>
    
    <sherpa-container-footer slot="footer">
      <sherpa-button data-variant="tertiary" onclick="cancelAdd()">
        Cancel
      </sherpa-button>
      <sherpa-button data-variant="primary" onclick="submitAdd()">
        Save
      </sherpa-button>
    </sherpa-container-footer>
  </form>
</sherpa-dialog>
```

---

### [Edit Flow](edit.html)

**Purpose:** Update an existing item with pre-filled form

**Flow Steps:**
1. **Load** — Fetch existing item data
2. **Display** — Pre-populate form fields
3. **Modify** — User edits values
4. **Validate** — Check changes
5. **Save** — Submit updates
6. **Feedback** — Confirm success

**Structure:**
- Same as Add Flow, but with:
  - Pre-filled form values
  - Optional "discard changes" warning
  - Diff indication (changed fields highlighted)

**When to use:**
- Editing user profiles, settings, configurations
- Updating existing records
- Modifying entity properties

**Key Features:**
- Load existing data
- Pre-populate inputs
- Detect unsaved changes
- Confirmation on navigate away
- Partial update support

**Differences from Add:**
- `value` attributes pre-filled
- "Discard changes?" prompt on cancel if dirty
- PATCH vs POST request
- May include "Delete" action

---

### [Delete Flow](delete.html)

**Purpose:** Remove an item with destructive action confirmation

**Flow Steps:**
1. **Trigger** — User clicks "Delete" button
2. **Confirm** — Modal asking "Are you sure?"
3. **Delete** — Server request with loading
4. **Feedback** — Success toast or redirect
5. **Update UI** — Remove item from list

**Structure:**
- `<sherpa-button>` — Delete trigger (often data-status="critical")
- `<sherpa-dialog>` — Confirmation dialog
- `<sherpa-callout data-status="warning">` — Warning message
- `<sherpa-container-footer>` — Cancel/Confirm actions
- `<sherpa-toast>` — Deletion confirmation

**When to use:**
- Deleting users, items, records
- Removing configurations
- Destructive actions requiring confirmation

**Key Features:**
- Two-step confirmation (prevents accidents)
- Clear warning message
- Escape hatch (cancel button)
- Loading state during deletion
- Undo option (optional, via toast action)

**Code Example:**
```html
<sherpa-button 
  data-variant="tertiary" 
  data-status="critical"
  onclick="confirmDelete(itemId)">
  Delete
</sherpa-button>

<sherpa-dialog id="delete-dialog" data-label="Confirm Deletion">
  <sherpa-callout data-status="warning">
    <p>Are you sure you want to delete <strong id="item-name"></strong>?</p>
    <p>This action cannot be undone.</p>
  </sherpa-callout>
  
  <sherpa-container-footer slot="footer">
    <sherpa-button data-variant="tertiary" onclick="cancelDelete()">
      Cancel
    </sherpa-button>
    <sherpa-button 
      data-variant="primary" 
      data-status="critical"
      onclick="executeDelete()">
      Delete
    </sherpa-button>
  </sherpa-container-footer>
</sherpa-dialog>
```

---

## Flow State Management

All CRUD flows follow this state machine:

```
IDLE → OPEN → LOADING → SUCCESS/ERROR → CLOSED
  ↑                                        ↓
  └────────────────────────────────────────┘
```

**States:**
- **IDLE:** No interaction, waiting for trigger
- **OPEN:** Dialog visible, form ready
- **LOADING:** Server request in progress (disable inputs, show loader)
- **SUCCESS:** Operation complete (show toast, close dialog)
- **ERROR:** Operation failed (show error message, keep dialog open)
- **CLOSED:** Dialog dismissed, return to idle

---

## Validation Patterns

### Client-Side Validation

```javascript
// Validate on input
input.addEventListener('input', () => {
  if (!input.validity.valid) {
    input.setAttribute('data-status', 'critical');
    input.setAttribute('data-helper', input.validationMessage);
  } else {
    input.removeAttribute('data-status');
    input.removeAttribute('data-helper');
  }
});
```

### Server-Side Validation

```javascript
async function submitForm() {
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    
    if (!response.ok) {
      const errors = await response.json();
      // Show errors on respective fields
      displayFieldErrors(errors);
    } else {
      showSuccessToast();
      closeDialog();
    }
  } catch (error) {
    showErrorToast(error.message);
  }
}
```

---

## Accessibility Considerations

### Modal Dialogs

- **Focus trap:** Keep focus within dialog
- **Escape key:** Close on Escape press
- **Initial focus:** Focus first input on open
- **Return focus:** Restore focus to trigger on close
- **ARIA:** `role="dialog"`, `aria-labelledby`, `aria-modal="true"`

### Form Validation

- **Error announcements:** Use `aria-live` for dynamic errors
- **Field associations:** Link errors to inputs via `aria-describedby`
- **Required fields:** Mark with `required` attribute and `aria-required`
- **Error summary:** Provide list of errors at top of form

### Destructive Actions

- **Clear labeling:** "Delete User" not just "Delete"
- **Confirmation:** Require explicit confirmation
- **Warning:** Use `<sherpa-callout data-status="warning">`
- **Reversibility:** Offer undo if possible

---

## Error Handling

### Network Errors

```javascript
catch (error) {
  if (error.name === 'NetworkError') {
    showToast('Network error. Please check your connection.', 'critical');
  } else if (error.status === 403) {
    showToast('You don\'t have permission to perform this action.', 'critical');
  } else {
    showToast('An unexpected error occurred.', 'critical');
  }
}
```

### Validation Errors

- Display field-specific errors below inputs
- Highlight invalid fields with `data-status="critical"`
- Show error summary at form top for multiple errors
- Don't disable submit button (let validation run)

---

## Optimistic UI Updates

For better perceived performance, update the UI immediately and rollback on error:

```javascript
// 1. Optimistically add to UI
addItemToList(newItem);

// 2. Make server request
try {
  await saveItem(newItem);
  // Success - keep UI as is
} catch (error) {
  // Error - rollback
  removeItemFromList(newItem);
  showErrorToast();
}
```

---

## Integration with Data Grid

CRUD flows typically work alongside data grids:

```html
<!-- List view with CRUD actions -->
<sherpa-data-grid id="users-grid">
  <!-- Grid content -->
</sherpa-data-grid>

<!-- Add button -->
<sherpa-button onclick="openAddDialog()">Add User</sherpa-button>

<!-- Add dialog -->
<sherpa-dialog id="add-dialog">...</sherpa-dialog>

<!-- Edit dialog (same form, different mode) -->
<sherpa-dialog id="edit-dialog">...</sherpa-dialog>

<!-- Delete confirmation -->
<sherpa-dialog id="delete-dialog">...</sherpa-dialog>

<script>
  // Refresh grid after CRUD operations
  function onCRUDSuccess() {
    document.querySelector('#users-grid').refresh();
  }
</script>
```

---

## Customization Tips

1. **Form fields:** Add/remove inputs as needed
2. **Validation rules:** Customize `pattern`, `min`, `max`, etc.
3. **Server integration:** Replace placeholder fetch calls
4. **Success redirect:** Navigate to detail view or stay on list
5. **Undo action:** Add toast action button for delete undo

---

## Related Patterns

- [Layouts](../layouts/) — Views that contain CRUD flows
- [Confirmation Dialog](../feedback/confirmation-dialog.html) — Reusable confirmation pattern

---

**See also:** [Form Components](../../components/#form) for input component APIs.
