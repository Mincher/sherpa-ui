# Feedback Patterns

> **User communication patterns for system state and responses**

Feedback patterns demonstrate how to communicate system state, operation results, and guidance to users. These patterns ensure users understand what's happening and what actions they can take.

---

## Patterns in This Category

### [Confirmation Dialog](confirmation-dialog.html)

**Purpose:** Get user confirmation before executing destructive or important actions

**Structure:**
- `<sherpa-dialog>` — Modal container
- `<sherpa-callout>` — Warning or information message
- Description text explaining consequences
- `<sherpa-container-footer>` — Cancel/Confirm buttons

**When to use:**
- Before deleting data
- Before irreversible actions
- When user decision is critical
- Preventing accidental actions

**Variants:**

**Warning (Destructive Actions):**
```html
<sherpa-dialog data-label="Confirm Deletion">
  <sherpa-callout data-status="warning">
    <strong>Are you sure you want to delete this user?</strong>
    <p>This action cannot be undone. All associated data will be permanently removed.</p>
  </sherpa-callout>
  
  <sherpa-container-footer slot="footer">
    <sherpa-button data-variant="tertiary">Cancel</sherpa-button>
    <sherpa-button data-variant="primary" data-status="critical">
      Delete
    </sherpa-button>
  </sherpa-container-footer>
</sherpa-dialog>
```

**Information (Important Actions):**
```html
<sherpa-dialog data-label="Confirm Action">
  <sherpa-callout data-status="info">
    <strong>This will send notifications to all users.</strong>
    <p>Recipients: 1,234 active users</p>
  </sherpa-callout>
  
  <sherpa-container-footer slot="footer">
    <sherpa-button data-variant="tertiary">Cancel</sherpa-button>
    <sherpa-button data-variant="primary">Send</sherpa-button>
  </sherpa-container-footer>
</sherpa-dialog>
```

**Best Practices:**
- ✅ Be specific about what will happen
- ✅ Explain consequences clearly
- ✅ Provide escape hatch (Cancel button)
- ✅ Use warning status for destructive actions
- ✅ Make confirm button action-oriented ("Delete", not "OK")
- ❌ Don't overuse (causes fatigue)
- ❌ Don't show for routine actions

---

### [Empty State](empty-state.html)

**Purpose:** Communicate absence of data and guide next steps

**Structure:**
- `<sherpa-empty-state>` — Container with icon/illustration
- Heading explaining why it's empty
- Description with context
- Call-to-action button

**When to use:**
- No search results
- Empty list/grid
- First-time user experience
- Cleared filters showing no data

**Variants:**

**No Data Yet (Onboarding):**
```html
<sherpa-empty-state>
  <img 
    slot="illustration" 
    src="/assets/empty-users.svg" 
    alt=""
    aria-hidden="true">
  
  <h2 slot="header">No users yet</h2>
  
  <p slot="description">
    Get started by inviting your first team member.
  </p>
  
  <sherpa-button 
    slot="actions" 
    data-variant="primary"
    onclick="openInviteDialog()">
    Invite User
  </sherpa-button>
</sherpa-empty-state>
```

**No Results (Search/Filter):**
```html
<sherpa-empty-state>
  <sherpa-icon 
    slot="illustration" 
    data-icon="fa-solid fa-magnifying-glass"
    data-size="4xl">
  </sherpa-icon>
  
  <h2 slot="header">No results found</h2>
  
  <p slot="description">
    Try adjusting your search or filters to find what you're looking for.
  </p>
  
  <sherpa-button 
    slot="actions" 
    data-variant="secondary"
    onclick="clearFilters()">
    Clear Filters
  </sherpa-button>
</sherpa-empty-state>
```

**Error State:**
```html
<sherpa-empty-state>
  <sherpa-icon 
    slot="illustration" 
    data-icon="fa-solid fa-triangle-exclamation"
    data-status="critical">
  </sherpa-icon>
  
  <h2 slot="header">Failed to load data</h2>
  
  <p slot="description">
    An error occurred while fetching users. Please try again.
  </p>
  
  <sherpa-button 
    slot="actions" 
    data-variant="primary"
    onclick="retryLoad()">
    Retry
  </sherpa-button>
</sherpa-empty-state>
```

**Best Practices:**
- ✅ Use friendly, encouraging tone
- ✅ Provide actionable next step
- ✅ Show relevant illustration or icon
- ✅ Explain why it's empty (if possible)
- ❌ Don't blame the user
- ❌ Don't just say "No data"

---

### [Loading State](loading-state.html)

**Purpose:** Indicate asynchronous operation in progress

**Structure:**
- `<sherpa-loader>` — Spinner/progress indicator
- Optional loading message
- Optional cancel button (for long operations)

**When to use:**
- Fetching data from server
- Processing large operations
- Waiting for external service
- File uploads

**Variants:**

**Inline Loading (Small):**
```html
<sherpa-loader data-size="small"></sherpa-loader>
<span>Loading...</span>
```

**Page Loading (Overlay):**
```html
<div class="loading-overlay">
  <sherpa-loader data-size="large"></sherpa-loader>
  <p>Loading users...</p>
</div>

<style>
.loading-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sherpa-space-md);
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}
</style>
```

**Skeleton Loading (Progressive):**
```html
<sherpa-container>
  <div class="skeleton-header"></div>
  <div class="skeleton-content"></div>
  <div class="skeleton-content"></div>
  <div class="skeleton-content"></div>
</sherpa-container>

<style>
.skeleton-header,
.skeleton-content {
  height: 20px;
  background: linear-gradient(
    90deg,
    var(--sherpa-surface-skeleton-from) 0%,
    var(--sherpa-surface-skeleton-to) 50%,
    var(--sherpa-surface-skeleton-from) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.skeleton-header { width: 40%; height: 24px; }
.skeleton-content { margin-top: 12px; }

@keyframes skeleton-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
```

**Progress Bar (Determinate):**
```html
<sherpa-progress-bar value="65" max="100"></sherpa-progress-bar>
<p>Uploading file... 65%</p>
```

**Best Practices:**
- ✅ Show immediately (< 100ms delay)
- ✅ Use skeleton for content-heavy loads
- ✅ Provide cancel option for long operations
- ✅ Show progress when possible (file uploads, etc.)
- ❌ Don't show for < 200ms operations (causes flicker)
- ❌ Don't block entire UI unless necessary

---

## Feedback Timing

### Immediate (< 100ms)
- No feedback needed
- Operation appears instant

### Short (100ms - 1s)
- Inline loader
- Button loading state
- Minimal UI

### Medium (1s - 5s)
- Full loading indicator
- Progress message
- Cancellable

### Long (> 5s)
- Progress bar (if possible)
- Detailed status messages
- Cancel button required
- Consider background processing

---

## Toast Notifications

For transient feedback after operations complete:

```html
<sherpa-toast 
  data-status="success"
  data-dismissible>
  User deleted successfully
</sherpa-toast>
```

**Status Types:**
- `success` — Operation completed
- `info` — Informational message
- `warning` — Action succeeded with caveat
- `critical` — Operation failed

**Best Practices:**
- ✅ Auto-dismiss after 4-6 seconds
- ✅ Make dismissible (close button)
- ✅ Keep message concise (< 2 lines)
- ✅ Use action buttons for undo (optional)
- ❌ Don't stack multiple toasts
- ❌ Don't use for critical errors (use dialog instead)

---

## Combining Feedback Patterns

### CRUD Operation Flow

```
1. User clicks "Delete"
   → [Confirmation Dialog] appears

2. User confirms
   → [Loading State] in dialog
   → Dialog shows loader, disables buttons

3. Operation completes
   → [Toast] appears (success/error)
   → Dialog closes
   → If error: Dialog stays open, shows error message

4. No data after delete
   → [Empty State] appears in list
```

---

## Accessibility Considerations

### Confirmation Dialogs

- Focus trap within dialog
- Escape key closes
- Clear button labels
- ARIA labels for icons

### Empty States

- Alt text for illustrations
- Actionable CTA is keyboard accessible
- Heading hierarchy (h2, not h1)

### Loading States

- `aria-live="polite"` for status updates
- `aria-busy="true"` on loading containers
- Keyboard-accessible cancel button
- Screen reader announces when loading completes

---

## Error Message Guidelines

### Good Error Messages

- ✅ "Email address is required"
- ✅ "Password must be at least 8 characters"
- ✅ "Unable to save changes. Please try again."

### Bad Error Messages

- ❌ "Error"
- ❌ "Invalid input"
- ❌ "Error code 500"

**Formula:** What happened + Why + What to do

**Example:**
> "Unable to delete user because they own active projects. Reassign projects first or contact an administrator."

---

## Related Patterns

- [Flows](../flows/) — CRUD flows that use feedback patterns
- [Layouts](../layouts/) — Views that contain feedback patterns

---

**See also:** [Feedback Components](../../components/#feedback) for component APIs.
