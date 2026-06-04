# Advanced Select Investigation

**Date:** June 4, 2026  
**Investigation:** Phase 2, Priority 2.2  
**Goal:** Create multi-select and tree-select via composition

---

## Your Feedback

> "An advanced-selectbox and treeview-selectbox are just a select input where the menu shows a hierarchy of checkbox items in a collapsable tree list. We can get those variants together from components we already have in sherpa. Apex makes this more complicated than it needs to be."

---

## Discovery: Tree Select Already Exists!

### Current Implementation

**File:** `components/sherpa-input-select/sherpa-input-select.ts`

✅ **Tree template already implemented** (line 9-10):
```typescript
@attr {enum}   [data-template] — default | tree (hierarchical picker)
@attr {json}   [data-tree]     — (tree) Node forest [{value,label,children?,disabled?}]
```

**Usage:**
```html
<sherpa-input-select 
  data-template="tree"
  data-tree='[{"value":"engineering","label":"Engineering","children":[...]}]'>
</sherpa-input-select>
```

### Tree Template Structure

From `sherpa-input-select.html` (line 26-35):
```html
<template id="tree">
  <div class="tree-wrapper">
    <input type="hidden" class="input-field tree-value" />
    <button type="button" class="tree-button" aria-haspopup="tree" aria-expanded="false">
      <span class="tree-display"></span>
      <i class="select-chevron fa-solid fa-chevron-down" aria-hidden="true"></i>
    </button>
    <div class="tree-panel" role="tree"></div>
  </div>
</template>
```

**Features:**
- ✅ Hierarchical data structure
- ✅ Collapsible branches
- ✅ Single selection (radio behavior)
- ❌ Multi-selection not supported
- ❌ No checkboxes

---

## What's Missing

### 1. Multi-Select (No Tree)

**Use Case:** Select multiple items from a flat list

**Current:** Native `<select multiple>` (poor UX, no checkboxes)

**Needed:** Dropdown with checkboxes

**Composition:**
- `sherpa-input-select` (trigger button)
- `sherpa-menu` (dropdown panel)
- `sherpa-input-checkbox` (selection items)

---

### 2. Multi-Select Tree

**Use Case:** Select multiple items from a hierarchy

**Current:** Tree select exists but single-selection only

**Needed:** Tree with checkboxes + parent/child relationships

**Composition:**
- `sherpa-input-select` tree template (trigger + panel)
- `sherpa-input-checkbox` (replace radio buttons)
- Parent/child selection logic (check parent → check children)

---

## Implementation Approach

### Approach 1: Enhance Existing Tree Select

**Modify `sherpa-input-select` tree template:**
- Add `data-multi` attribute
- Render checkboxes instead of radio buttons
- Support multiple values (array)
- Handle parent/child relationships

**Pros:**
- ✅ Centralizes tree logic
- ✅ Form integration works
- ✅ Consistent with existing tree template

**Cons:**
- ❌ Adds complexity to input-select
- ❌ Mixes single/multi modes

---

### Approach 2: Composition Pattern (Your Vision)

**Create patterns using existing components:**

**Pattern 1: Multi-Select Dropdown**
```html
<div class="sherpa-multi-select">
  <!-- Trigger -->
  <button type="button" class="multi-select-trigger" data-expanded="false">
    <span class="selection-display">2 selected</span>
    <i class="fa-solid fa-chevron-down"></i>
  </button>
  
  <!-- Dropdown Menu -->
  <sherpa-menu data-position="bottom-start">
    <sherpa-input-checkbox data-label="Option 1" value="opt1"></sherpa-input-checkbox>
    <sherpa-input-checkbox data-label="Option 2" value="opt2" checked></sherpa-input-checkbox>
    <sherpa-input-checkbox data-label="Option 3" value="opt3" checked></sherpa-input-checkbox>
  </sherpa-menu>
</div>
```

**Pattern 2: Tree Multi-Select**
```html
<div class="sherpa-tree-select">
  <button type="button" class="tree-select-trigger">
    <span class="selection-display">Engineering (3)</span>
    <i class="fa-solid fa-chevron-down"></i>
  </button>
  
  <sherpa-menu>
    <ul class="tree-list" role="tree">
      <li>
        <sherpa-input-checkbox data-label="Engineering" value="eng" indeterminate></sherpa-input-checkbox>
        <ul role="group">
          <li><sherpa-input-checkbox data-label="Frontend" value="eng-fe" checked></sherpa-input-checkbox></li>
          <li><sherpa-input-checkbox data-label="Backend" value="eng-be" checked></sherpa-input-checkbox></li>
          <li><sherpa-input-checkbox data-label="DevOps" value="eng-devops"></sherpa-input-checkbox></li>
        </ul>
      </li>
    </ul>
  </sherpa-menu>
</div>
```

**Pros:**
- ✅ Pure composition (no component changes)
- ✅ Flexible (consumers control structure)
- ✅ Reuses all existing components
- ✅ Validates "composition over components" principle

**Cons:**
- ❌ More boilerplate HTML
- ❌ Consumer handles selection logic
- ❌ No built-in form integration

---

### Approach 3: Hybrid (Recommended)

**Enhance `sherpa-input-select` with multi-select mode:**

```html
<!-- Single-select tree (existing) -->
<sherpa-input-select 
  data-template="tree"
  data-tree='[...]'>
</sherpa-input-select>

<!-- Multi-select tree (NEW) -->
<sherpa-input-select 
  data-template="tree"
  data-multi
  data-tree='[...]'>
</sherpa-input-select>

<!-- Multi-select dropdown (NEW) -->
<sherpa-input-select 
  data-template="multi"
  data-options='[...]'>
</sherpa-input-select>
```

**Implementation:**
1. Add `data-multi` attribute to enable multi-selection
2. Add `data-template="multi"` for flat multi-select
3. Tree template uses checkboxes when `data-multi` present
4. Value becomes array: `["eng-fe", "eng-be"]`
5. Form integration: hidden inputs for each selected value

**Benefits:**
- ✅ Form integration works
- ✅ Consistent API with existing select
- ✅ Internal use of checkboxes (composition)
- ✅ Single component for all select use cases

---

## Recommended Solution

### Enhance `sherpa-input-select` with Two New Features:

#### Feature 1: Multi-Select Template

**Attribute:** `data-template="multi"`

**HTML:**
```html
<template id="multi">
  <div class="multi-wrapper">
    <button type="button" class="multi-button" aria-haspopup="listbox">
      <span class="multi-display">0 selected</span>
      <i class="select-chevron fa-solid fa-chevron-down"></i>
    </button>
    <div class="multi-panel" role="listbox">
      <!-- Checkboxes rendered here -->
    </div>
  </div>
</template>
```

**Features:**
- Dropdown with checkboxes
- "Select All" / "Clear All" buttons
- Search/filter box
- Virtual scrolling for 1000+ items

---

#### Feature 2: Multi-Select Mode for Tree

**Attribute:** `data-multi` on existing tree template

**Changes:**
- Render `<sherpa-input-checkbox>` instead of radio buttons
- Support array values
- Parent/child relationship logic:
  - Check parent → check all children
  - Uncheck parent → uncheck all children
  - Some children checked → parent indeterminate
  - All children checked → parent checked

---

## Virtual Scrolling Integration

### Need

Both multi-select and tree-select need virtual scrolling for large datasets:
- ✅ Multi-select: 1000+ options
- ✅ Tree-select: Large org charts, file trees

### Implementation

**Option 1: Intersection Observer**
```typescript
class VirtualList {
  constructor(container, itemHeight, renderItem) {
    this.observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.renderVisibleItems();
        }
      });
    });
  }
}
```

**Option 2: Scroll Event + Viewport Calc**
```typescript
panel.addEventListener('scroll', () => {
  const scrollTop = panel.scrollTop;
  const startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
  const endIndex = startIndex + VISIBLE_COUNT;
  renderItems(startIndex, endIndex);
});
```

**Option 3: CSS `content-visibility`** (Simplest)
```css
.multi-item {
  content-visibility: auto;
  contain-intrinsic-size: 32px;
}
```

**Recommendation:** Start with Option 3 (CSS), add Option 2 if needed

---

## Parent/Child Selection Logic

### Checkbox States

**Parent checkbox has 3 states:**
1. **Unchecked** - No children selected
2. **Indeterminate** - Some children selected
3. **Checked** - All children selected

### Selection Rules

**When parent checkbox clicked:**
```typescript
if (parent.checked) {
  // Check all children
  children.forEach(child => child.checked = true);
} else {
  // Uncheck all children
  children.forEach(child => child.checked = false);
}
```

**When child checkbox clicked:**
```typescript
const allChecked = children.every(c => c.checked);
const someChecked = children.some(c => c.checked);

if (allChecked) {
  parent.checked = true;
  parent.indeterminate = false;
} else if (someChecked) {
  parent.checked = false;
  parent.indeterminate = true;
} else {
  parent.checked = false;
  parent.indeterminate = false;
}
```

---

## API Design

### Multi-Select Dropdown

```html
<sherpa-input-select
  data-template="multi"
  data-label="Select Categories"
  data-search="true"
  data-select-all="true"
  data-max-selections="5">
</sherpa-input-select>
```

**Attributes:**
- `data-template="multi"` - Enable multi-select mode
- `data-search` - Show search box
- `data-select-all` - Show Select All / Clear All buttons
- `data-max-selections` - Limit selection count

**Methods:**
- `getValues()` → `string[]`
- `setValues(values)` → `void`
- `selectAll()` → `void`
- `clearAll()` → `void`

**Events:**
- `change` - Selection changed, `detail: { values: string[] }`

---

### Multi-Select Tree

```html
<sherpa-input-select
  data-template="tree"
  data-multi
  data-tree='[...]'
  data-expand-all="false">
</sherpa-input-select>
```

**Attributes:**
- `data-template="tree"` - Tree mode
- `data-multi` - Multi-selection enabled
- `data-tree` - Hierarchical data
- `data-expand-all` - Expand all nodes by default

**Methods:**
- `getSelectedValues()` → `string[]`
- `getSelectedPaths()` → `string[][]`
- `setSelectedValues(values)` → `void`
- `expandAll()` / `collapseAll()` → `void`

---

## Implementation Plan

### Phase 1: Multi-Select Dropdown (3-4 days)

1. **Day 1:** Add `data-template="multi"` to sherpa-input-select
2. **Day 2:** Implement checkbox rendering + selection logic
3. **Day 3:** Add search, select-all, clear-all features
4. **Day 4:** Test with 1000+ items, add virtual scrolling

### Phase 2: Multi-Select Tree (3-4 days)

1. **Day 1:** Add `data-multi` support to tree template
2. **Day 2:** Replace radio buttons with checkboxes
3. **Day 3:** Implement parent/child selection logic
4. **Day 4:** Test hierarchical scenarios, add examples

### Phase 3: Polish & Document (1-2 days)

1. Create pattern documentation
2. Add comprehensive examples
3. Update README files
4. Add to patterns directory

**Total Time:** 7-10 days

---

## Comparison to Apex

### Apex `apx-advanced-selectbox`
- Virtual scrolling for 10k+ items
- Remote data support
- Custom filtering
- Complex DevExtreme wrapper

### Sherpa Multi-Select
- ✅ Virtual scrolling (CSS `content-visibility`)
- ✅ Search/filter
- ✅ Lightweight (no DevExtreme)
- ✅ Native form integration

---

### Apex `apx-treeview-selectbox`
- Hierarchical selection
- Single-select only (from analysis)
- DevExtreme tree component

### Sherpa Tree Multi-Select
- ✅ Hierarchical selection
- ✅ Multi-select with checkboxes
- ✅ Parent/child relationships
- ✅ Lightweight implementation

**Verdict:** Sherpa can match or exceed Apex functionality with composition

---

## Next Steps

### Immediate:
1. ✅ Complete this investigation
2. Start implementation (Multi-select dropdown first)
3. Add `data-template="multi"` to sherpa-input-select
4. Render checkboxes in dropdown panel
5. Implement selection logic

### After Multi-Select:
1. Add `data-multi` to tree template
2. Implement parent/child checkbox logic
3. Create comprehensive examples
4. Document patterns

---

**End of Investigation**  
Status: Ready to implement multi-select and tree multi-select  
Approach: Enhance sherpa-input-select with new templates (composition within component)  
Next: Start implementation
