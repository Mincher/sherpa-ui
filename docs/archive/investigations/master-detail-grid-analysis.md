# Master-Detail Grid Investigation

**Date:** June 4, 2026  
**Status:** Backlog — `data-expandable-rows` API not yet implemented in `sherpa-data-grid`  
**Investigation:** Phase 2, Priority 2.3  
**Goal:** Add master-detail (expandable detail rows) to sherpa-data-grid

---

## Your Feedback

> "Implementing a Master-Detail variant of the grid shouldn't be hard to do given we already support template variants, grouping etc. We should look to bring sherpa in line here."

---

## Current Implementation Analysis

### File: `components/sherpa-data-grid/sherpa-data-grid.ts` (2,059 lines)

**Existing Features:**
- ✅ Grouping with expand/collapse (group-parent-row + child rows)
- ✅ Template-based row rendering (`row-tpl`, `group-row-tpl`)
- ✅ Row selection (checkboxes)
- ✅ Row actions column
- ✅ Sorting, pagination, filtering
- ✅ Toolbar with actions
- ✅ Content attributes mixin (data pipeline)

**Key Architecture:**
1. **Row Templates** - Uses `<template class="row-tpl">` for row rendering
2. **Group Rendering** - Already has expandable parent rows (`#createGroupElement`)
3. **Expand/Collapse State** - Managed via `#expandedGroups` Set
4. **Click Handlers** - Parent row click toggles expansion

---

## Master-Detail Requirements

### What is Master-Detail?

**Master Row:** Main data row (e.g., Order #12345)  
**Detail Row:** Nested content shown when expanded (e.g., Line items for that order)

**Example Use Cases:**
1. **Orders → Line Items** - Click order to see products
2. **Users → Permissions** - Click user to see permission list
3. **Devices → Metrics** - Click device to see telemetry
4. **Projects → Tasks** - Click project to see task breakdown

---

## Implementation Approach

### Approach 1: New Template (Recommended)

Add a **detail row template** that consumers provide:

```html
<sherpa-data-grid data-expandable-rows>
  <!-- Consumer provides detail template -->
  <template class="detail-row-tpl">
    <tr class="detail-row">
      <td class="detail-cell" colspan="{{totalCols}}">
        <div class="detail-content">
          <!-- Detail content will be injected here -->
          <!-- Can use nested grid, list, or custom HTML -->
        </div>
      </td>
    </tr>
  </template>
</sherpa-data-grid>
```

**Features:**
- ✅ Fully customizable detail content
- ✅ Consumer controls layout
- ✅ Supports any content (grid, list, chart, form)
- ✅ Template-based (consistent with existing approach)

---

### Approach 2: Slot-Based Detail (Alternative)

Use slots for detail content:

```html
<sherpa-data-grid>
  <template data-row-id="order-123" slot="detail">
    <div class="order-details">
      <!-- Detail content for this specific row -->
    </div>
  </template>
</sherpa-data-grid>
```

**Pros:**
- ✅ Very flexible
- ✅ No JS needed for simple cases

**Cons:**
- ❌ Requires pre-rendering all details (performance issue)
- ❌ Doesn't work with dynamic data

---

### Approach 3: Event-Driven Detail (Hybrid)

Grid fires event when row expanded, consumer provides content:

```html
<sherpa-data-grid data-expandable-rows></sherpa-data-grid>

<script>
  grid.addEventListener('row-expand', (e) => {
    const { rowId, rowData, detailCell } = e.detail;
    
    // Consumer renders detail content
    detailCell.innerHTML = `
      <div class="order-line-items">
        ${rowData.lineItems.map(item => `
          <div>${item.product} - ${item.qty}</div>
        `).join('')}
      </div>
    `;
  });
</script>
```

**Pros:**
- ✅ Lazy rendering (only render when expanded)
- ✅ Full control over content
- ✅ Works with async data loading

**Cons:**
- ❌ Requires JavaScript
- ❌ More complex for consumers

---

## Recommended Hybrid Approach

**Combine Template + Event:**

1. **Consumer provides template** (for structure)
2. **Grid fires event** (for data injection)
3. **Lazy rendering** (only create detail when expanded)

```html
<sherpa-data-grid data-expandable-rows>
  <template class="detail-row-tpl">
    <tr class="detail-row">
      <td class="detail-cell" colspan="{{totalCols}}">
        <div class="detail-content">
          <!-- Placeholder, populated by row-expand event -->
        </div>
      </td>
    </tr>
  </template>
</sherpa-data-grid>

<script>
  grid.addEventListener('row-expand', (e) => {
    const { rowId, rowData, detailContent } = e.detail;
    
    // Consumer populates detail content
    detailContent.innerHTML = renderOrderDetails(rowData);
  });
</script>
```

---

## Implementation Details

### 1. Add Expand/Collapse Icon to Rows

**Modified row template:**
```html
<template class="row-tpl">
  <tr class="grid-row" role="row">
    <!-- NEW: Expand icon cell -->
    <td class="expand-cell">
      <button 
        type="button" 
        class="expand-btn" 
        aria-label="Expand row" 
        aria-expanded="false">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    </td>
    
    <td class="selection-cell">
      <input type="checkbox" class="sherpa-check row-check" />
    </td>
    
    <!-- Data cells... -->
  </tr>
</template>
```

**CSS:**
```css
.expand-btn {
  transform: rotate(0deg);
  transition: transform 0.2s;
}

.grid-row[data-expanded] .expand-btn {
  transform: rotate(90deg);
}
```

---

### 2. Detail Row Template

**New template:**
```html
<template class="detail-row-tpl">
  <tr class="detail-row" hidden>
    <td class="detail-spacer"></td> <!-- Align with expand-cell -->
    <td class="detail-cell" colspan="{{colspan}}">
      <div class="detail-content">
        <!-- Content injected here -->
      </div>
    </td>
  </tr>
</template>
```

---

### 3. Expand/Collapse Logic

**Pseudocode:**
```typescript
class SherpaDataGrid {
  #expandedRows = new Set<string>(); // Row IDs currently expanded
  #detailRowTpl: HTMLTemplateElement | null = null;

  onRender() {
    // Cache detail template
    this.#detailRowTpl = this.$<HTMLTemplateElement>("template.detail-row-tpl");
  }

  #createRowElement(rowData, columns) {
    const rowTpl = this.#rowTpl.content.cloneNode(true);
    const row = rowTpl.querySelector('.grid-row');
    const rowId = rowData['_rowId'];
    
    row.dataset['rowId'] = rowId;
    
    // Wire expand button
    const expandBtn = row.querySelector('.expand-btn');
    if (expandBtn && this.#detailRowTpl) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Don't trigger row selection
        this.#toggleRowExpansion(rowId, rowData);
      });
    } else {
      // No detail template = hide expand cell
      row.querySelector('.expand-cell')?.remove();
    }
    
    // ... rest of row rendering
    
    return row;
  }

  #toggleRowExpansion(rowId, rowData) {
    const isExpanded = this.#expandedRows.has(rowId);
    
    if (isExpanded) {
      // Collapse: remove detail row, update state
      this.#expandedRows.delete(rowId);
      this.#removeDetailRow(rowId);
      this.#fireRowCollapse(rowId, rowData);
    } else {
      // Expand: insert detail row, update state
      this.#expandedRows.add(rowId);
      this.#insertDetailRow(rowId, rowData);
      this.#fireRowExpand(rowId, rowData);
    }
  }

  #insertDetailRow(rowId, rowData) {
    const masterRow = this.$(`tr[data-row-id="${rowId}"]`);
    if (!masterRow || !this.#detailRowTpl) return;
    
    // Clone detail template
    const detailTpl = this.#detailRowTpl.content.cloneNode(true);
    const detailRow = detailTpl.querySelector('.detail-row');
    detailRow.dataset['rowId'] = rowId;
    
    // Set colspan (total columns + expand + selection + actions)
    const totalCols = this.#columns.length + 3;
    detailRow.querySelector('.detail-cell')?.setAttribute('colspan', String(totalCols - 1));
    
    // Insert after master row
    masterRow.insertAdjacentElement('afterend', detailRow);
    
    // Mark master row as expanded
    masterRow.dataset['expanded'] = '';
    masterRow.querySelector('.expand-btn')?.setAttribute('aria-expanded', 'true');
    
    // Show detail row
    detailRow.hidden = false;
  }

  #removeDetailRow(rowId) {
    const detailRow = this.$(`tr.detail-row[data-row-id="${rowId}"]`);
    detailRow?.remove();
    
    const masterRow = this.$(`tr.grid-row[data-row-id="${rowId}"]`);
    delete masterRow?.dataset['expanded'];
    masterRow?.querySelector('.expand-btn')?.setAttribute('aria-expanded', 'false');
  }

  #fireRowExpand(rowId, rowData) {
    const detailRow = this.$(`tr.detail-row[data-row-id="${rowId}"]`);
    const detailContent = detailRow?.querySelector('.detail-content');
    
    this.dispatchEvent(new CustomEvent('row-expand', {
      bubbles: true,
      detail: {
        rowId,
        rowData,
        detailRow,
        detailContent, // Consumer populates this
      },
    }));
  }

  #fireRowCollapse(rowId, rowData) {
    this.dispatchEvent(new CustomEvent('row-collapse', {
      bubbles: true,
      detail: { rowId, rowData },
    }));
  }
}
```

---

### 4. Public API

**New Attributes:**
- `data-expandable-rows` - Enable expandable row feature

**New Methods:**
- `expandRow(rowId)` - Programmatically expand a row
- `collapseRow(rowId)` - Programmatically collapse a row
- `expandAllRows()` - Expand all rows
- `collapseAllRows()` - Collapse all rows
- `getExpandedRows()` - Get list of expanded row IDs

**New Events:**
- `row-expand` - Fired when row expanded
  - `detail: { rowId, rowData, detailRow, detailContent }`
- `row-collapse` - Fired when row collapsed
  - `detail: { rowId, rowData }`

---

## Usage Examples

### Example 1: Simple Detail Content

```html
<sherpa-data-grid 
  data-expandable-rows
  data-label="Orders">
  
  <template class="detail-row-tpl">
    <tr class="detail-row">
      <td class="detail-spacer"></td>
      <td class="detail-cell" colspan="999">
        <div class="detail-content"></div>
      </td>
    </tr>
  </template>
</sherpa-data-grid>

<script>
  grid.addEventListener('row-expand', (e) => {
    const { rowData, detailContent } = e.detail;
    
    detailContent.innerHTML = `
      <div class="order-details">
        <h4>Line Items</h4>
        <ul>
          ${rowData.lineItems.map(item => `
            <li>${item.product} - Qty: ${item.qty} - $${item.price}</li>
          `).join('')}
        </ul>
        <p><strong>Total:</strong> $${rowData.total}</p>
      </div>
    `;
  });
</script>
```

---

### Example 2: Nested Grid

```html
<sherpa-data-grid 
  id="orders-grid"
  data-expandable-rows>
  
  <template class="detail-row-tpl">
    <tr class="detail-row">
      <td class="detail-spacer"></td>
      <td class="detail-cell" colspan="999">
        <div class="detail-content"></div>
      </td>
    </tr>
  </template>
</sherpa-data-grid>

<script>
  ordersGrid.addEventListener('row-expand', async (e) => {
    const { rowData, detailContent } = e.detail;
    
    // Create nested grid
    const nestedGrid = document.createElement('sherpa-data-grid');
    nestedGrid.dataset['label'] = 'Line Items';
    nestedGrid.dataset['showToolbar'] = 'false';
    
    // Load line items
    const lineItems = await fetchLineItems(rowData.orderId);
    nestedGrid.setData({ rows: lineItems });
    
    detailContent.appendChild(nestedGrid);
  });
</script>
```

---

### Example 3: Async Data Loading

```html
<sherpa-data-grid data-expandable-rows></sherpa-data-grid>

<script>
  grid.addEventListener('row-expand', async (e) => {
    const { rowId, rowData, detailContent } = e.detail;
    
    // Show loading state
    detailContent.innerHTML = '<sherpa-loader></sherpa-loader>';
    
    try {
      // Fetch detail data
      const details = await fetch(`/api/orders/${rowData.orderId}/details`)
        .then(r => r.json());
      
      // Render details
      detailContent.innerHTML = renderOrderDetails(details);
    } catch (err) {
      detailContent.innerHTML = '<p class="error">Failed to load details</p>';
    }
  });
</script>
```

---

## Keyboard Navigation

**Accessibility Requirements:**

1. **Arrow Keys:**
   - Right Arrow on master row → expand
   - Left Arrow on expanded row → collapse

2. **ARIA Attributes:**
   - `aria-expanded="true|false"` on expand button
   - `role="button"` on expand icon
   - `aria-controls="{detailRowId}"` linking master to detail

3. **Focus Management:**
   - Tab into expand button
   - Enter/Space to toggle
   - Tab into detail content when expanded

---

## Comparison to Apex

### Apex `apx-data-grid` Master-Detail:
- DevExtreme master-detail feature
- Nested grid support
- Template-based detail content
- Expand/collapse animations

### Sherpa `sherpa-data-grid` Master-Detail (Proposed):
- ✅ Native HTML `<table>` structure
- ✅ Template-based detail content
- ✅ Event-driven population
- ✅ Lazy rendering (performance)
- ✅ Supports nested grids
- ✅ Keyboard accessible

**Verdict:** Sherpa can match Apex functionality with simpler implementation

---

## Implementation Complexity

### Estimated Effort: 3-4 days

**Day 1: Core Expand/Collapse**
- Add expand-cell to row template
- Implement toggle logic
- Add expanded state tracking
- Fire row-expand/row-collapse events

**Day 2: Detail Row Rendering**
- Add detail-row-tpl template
- Implement detail row insertion/removal
- Handle colspan calculation
- Add CSS for detail row styling

**Day 3: Public API & Examples**
- Add expandRow/collapseRow methods
- Add expandAllRows/collapseAllRows
- Create nested grid example
- Create async data example

**Day 4: Polish & Testing**
- Keyboard navigation
- ARIA attributes
- Visual polish (animations)
- Test with various scenarios

---

## Challenges & Solutions

### Challenge 1: Re-rendering Destroys Detail Content

**Problem:** When grid re-renders (sort, filter), detail rows are lost

**Solution:** 
- Store expanded row IDs in `#expandedRows` Set
- After re-render, re-insert detail rows for expanded IDs
- Fire `row-expand` event again to repopulate content

```typescript
#render() {
  const prevExpanded = Array.from(this.#expandedRows);
  
  // Clear and re-render table
  this.#tbody.innerHTML = '';
  this.#renderRows();
  
  // Restore expanded states
  for (const rowId of prevExpanded) {
    const rowData = this.#findRowData(rowId);
    if (rowData) {
      this.#insertDetailRow(rowId, rowData);
    }
  }
}
```

---

### Challenge 2: Colspan Calculation

**Problem:** Detail cell needs correct colspan to span full width

**Solution:**
- Calculate: `columns.length` + expand-cell + selection-cell + actions-cell
- Update dynamically when columns change

```typescript
#getDetailColspan(): number {
  let cols = this.#columns.length;
  if (this.hasAttribute('data-expandable-rows')) cols++; // expand-cell
  if (this.hasAttribute('data-selectable')) cols++; // selection-cell
  if (this.hasAttribute('data-show-actions')) cols++; // actions-cell
  return cols - 1; // -1 because detail-spacer takes first cell
}
```

---

### Challenge 3: Grouping + Master-Detail

**Problem:** What happens when both grouping and expandable rows are enabled?

**Solution:** Both can coexist:
- Group rows expand to show child master rows
- Master rows expand to show detail rows
- Two levels of expansion

Or: Disable master-detail when grouping is active (simpler)

**Recommendation:** Support both, but document the complexity

---

## CSS Enhancements

```css
/* Expand button */
.expand-cell {
  width: 40px;
  padding: 0;
}

.expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  color: var(--sherpa-content-text);
  transition: transform 0.2s ease;
}

.expand-btn:hover {
  color: var(--sherpa-primary-blue);
}

.grid-row[data-expanded] .expand-btn {
  transform: rotate(90deg);
}

/* Detail row */
.detail-row {
  background: var(--sherpa-surface-container-lowest);
}

.detail-cell {
  padding: var(--sherpa-spacing-m);
  border-bottom: 1px solid var(--sherpa-border-subtle);
}

.detail-content {
  max-width: 100%;
  overflow: auto;
}

/* Animations */
@keyframes expand-detail {
  from {
    max-height: 0;
    opacity: 0;
  }
  to {
    max-height: 500px;
    opacity: 1;
  }
}

.detail-row:not([hidden]) {
  animation: expand-detail 0.2s ease-out;
}
```

---

## Status Summary

| Feature | Status | Complexity |
|---------|--------|------------|
| Expand icon in rows | ⏭️ To implement | Low |
| Detail row template | ⏭️ To implement | Low |
| Toggle expand/collapse | ⏭️ To implement | Medium |
| row-expand/collapse events | ⏭️ To implement | Low |
| Public API methods | ⏭️ To implement | Low |
| State persistence on re-render | ⏭️ To implement | Medium |
| Keyboard navigation | ⏭️ To implement | Medium |
| Nested grid example | ⏭️ To implement | Low |
| Async data example | ⏭️ To implement | Low |

---

## Conclusion

**Your Feedback:**
> "Implementing a Master-Detail variant of the grid shouldn't be hard to do given we already support template variants, grouping etc."

**Analysis Confirms:** ✅ **Correct!**

**Why it's easy:**
1. ✅ Grid already uses template-based rendering
2. ✅ Group expand/collapse logic exists (similar pattern)
3. ✅ Row insertion/removal is straightforward
4. ✅ Event system already in place

**Estimated Effort:** 3-4 days

**Recommended Approach:**
- Template-based detail rows
- Event-driven content population
- Lazy rendering for performance
- Keyboard accessible

---

**End of Investigation**  
Status: Ready to implement master-detail grid variant  
Next: Add detail-row-tpl template + expand/collapse logic  
After: Create comprehensive examples (nested grid, async data)
