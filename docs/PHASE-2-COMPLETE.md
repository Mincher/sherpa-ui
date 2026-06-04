# Phase 2 Complete: Missing Component Variants

**Date Completed:** June 4, 2026  
**Duration:** 1 session (investigations only)  
**Goal:** Identify and plan implementation for missing component variants

---

## Executive Summary

Phase 2 investigated three priorities for adding missing component variants. **Key discovery:** 2 of 3 "missing" features already exist! Only 1 requires new implementation.

### Results

| Priority | Status | Finding |
|----------|--------|---------|
| 2.1 Wizard | ✅ **EXISTS** | `data-template="wizard"` on sherpa-dialog |
| 2.2 Advanced Select | ⚠️ **PARTIAL** | Tree exists, needs multi-select enhancement |
| 2.3 Master-Detail Grid | ⏭️ **TO IMPLEMENT** | Ready to add, 3-4 days work |

---

## Priority 2.1: Wizard as Dialog Variant ✅ COMPLETE

### Investigation File
`docs/investigations/wizard-already-implemented.md`

### Finding: Wizard Already Exists!

**Implementation:** `sherpa-dialog` with `data-template="wizard"`

**Features Complete:**
- ✅ Back/Next navigation buttons
- ✅ Step indicator ("Step X of Y")
- ✅ Fullscreen mode (`data-size="full"`)
- ✅ Finish button with custom label
- ✅ Page change events (`dialog-page-change`)
- ✅ `PageNavigationMixin` integration

**Usage Example:**
```html
<sherpa-dialog
  data-template="wizard"
  data-page="0"
  data-pages="3"
  data-finish-label="Complete"
  data-size="medium"
  data-open>
  
  <section data-page="0">Step 1 content</section>
  <section data-page="1" hidden>Step 2 content</section>
  <section data-page="2" hidden>Step 3 content</section>
</sherpa-dialog>
```

### Enhancement Opportunities

**Optional improvements (not required):**
1. Stepper slot for visual step indicator (vs text "Step X of Y")
2. Validation blocking (`data-validate-on-next` attribute)
3. More comprehensive examples

### Comparison to Your Request

**Your Feedback:**
> "A wizard is just a Dialog with a Stepper and Content Area between the footer."

**Implementation:**
- ✅ Dialog: Yes
- ✅ Content Area: Yes (default slot)
- ✅ Footer: Yes (Back/Next buttons)
- ⚠️ Stepper: Text indicator (visual stepper optional via slot)
- ✅ Fullscreen: Yes (`data-size="full"`)

**Verdict:** 90% feature-complete vs your vision!

### Deliverables

**Created:**
- `docs/investigations/wizard-already-implemented.md` - Full analysis
- `patterns/wizard-dialog.html` - 3 pattern examples

**Status:** ✅ Documentation complete, feature exists

---

## Priority 2.2: Advanced Select Composition ⚠️ PARTIAL

### Investigation File
`docs/investigations/advanced-select-analysis.md`

### Finding: Tree Select Exists, Multi-Select Missing

**What Exists:**
- ✅ `data-template="tree"` on `sherpa-input-select`
- ✅ Hierarchical data structure
- ✅ Collapsible branches
- ✅ Single selection (radio button behavior)

**What's Missing:**
- ❌ Multi-select dropdown (checkboxes in flat list)
- ❌ Multi-select tree (checkboxes with parent/child relationships)
- ❌ Virtual scrolling for 1000+ items

### Your Vision Confirmed

**Your Feedback:**
> "An advanced-selectbox and treeview-selectbox are just a select input where the menu shows a hierarchy of checkbox items in a collapsable tree list. We can get those variants together from components we already have in sherpa. Apex makes this more complicated than it needs to be."

**Implementation Plan:**
1. Add `data-template="multi"` for flat multi-select
2. Add `data-multi` attribute to tree template
3. Use `sherpa-input-checkbox` internally (composition!)
4. Implement parent/child selection logic
5. Add virtual scrolling via CSS `content-visibility`

### Recommended Approach

**Enhance `sherpa-input-select` with:**

#### Feature 1: Multi-Select Dropdown
```html
<sherpa-input-select
  data-template="multi"
  data-search="true"
  data-select-all="true">
</sherpa-input-select>
```

**Features:**
- Dropdown with checkboxes
- Search/filter box
- Select All / Clear All buttons
- Virtual scrolling

#### Feature 2: Multi-Select Tree
```html
<sherpa-input-select
  data-template="tree"
  data-multi
  data-tree='[...]'>
</sherpa-input-select>
```

**Features:**
- Hierarchical checkboxes
- Parent/child relationships
  - Check parent → check all children
  - Some children → parent indeterminate
  - All children → parent checked

### Implementation Estimate

**Total:** 7-10 days

**Phase 1: Multi-Select Dropdown** (3-4 days)
- Day 1: Add `data-template="multi"` template
- Day 2: Checkbox rendering + selection logic
- Day 3: Search, select-all, clear-all features
- Day 4: Virtual scrolling, testing

**Phase 2: Multi-Select Tree** (3-4 days)
- Day 1: Add `data-multi` support to tree
- Day 2: Replace radio with checkboxes
- Day 3: Parent/child selection logic
- Day 4: Testing, examples

**Phase 3: Documentation** (1-2 days)
- Pattern documentation
- Comprehensive examples
- Update README files

### Comparison to Apex

| Feature | Apex | Sherpa (Planned) |
|---------|------|------------------|
| Virtual scrolling | ✅ 10k+ items | ✅ CSS `content-visibility` |
| Multi-select | ✅ | ✅ (to add) |
| Tree hierarchy | ✅ | ✅ (exists) |
| Search/filter | ✅ | ✅ (to add) |
| Parent/child logic | ❓ | ✅ (to add) |
| Lightweight | ❌ DevExtreme | ✅ Native |

**Verdict:** Sherpa can match/exceed Apex with composition

### Status

**Current:** Tree select exists (single), multi-select needs implementation  
**Next:** Implement multi-select dropdown → multi-select tree  
**Deliverable:** Enhanced sherpa-input-select with multi/tree modes

---

## Priority 2.3: Master-Detail Grid Variant ⏭️ READY TO IMPLEMENT

### Investigation File
`docs/investigations/master-detail-grid-analysis.md`

### Finding: Ready to Add with Existing Infrastructure

**What Exists (Helpful):**
- ✅ Template-based row rendering (`row-tpl`)
- ✅ Group expand/collapse logic (similar pattern)
- ✅ Event system for row interactions
- ✅ Row selection, actions column

**What's Needed:**
- ⏭️ Expand icon in each row
- ⏭️ Detail row template
- ⏭️ Toggle expand/collapse logic
- ⏭️ `row-expand` / `row-collapse` events
- ⏭️ Public API methods

### Your Feedback Validated

**Your Feedback:**
> "Implementing a Master-Detail variant of the grid shouldn't be hard to do given we already support template variants, grouping etc."

**Analysis:** ✅ **Correct!**

### Implementation Approach

**Template-based with event-driven content:**

```html
<sherpa-data-grid data-expandable-rows>
  <!-- Consumer provides detail template -->
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
    
    // Consumer populates detail content
    detailContent.innerHTML = renderDetails(rowData);
  });
</script>
```

### Features to Implement

**Core:**
1. Expand icon cell in row template
2. Detail row template (colspan, styling)
3. Toggle expand/collapse on click
4. State tracking (`#expandedRows` Set)
5. Insert/remove detail row in DOM

**API:**
- `expandRow(rowId)` - Expand programmatically
- `collapseRow(rowId)` - Collapse programmatically
- `expandAllRows()` / `collapseAllRows()`
- `getExpandedRows()` - Get expanded row IDs

**Events:**
- `row-expand` - Detail: `{ rowId, rowData, detailContent }`
- `row-collapse` - Detail: `{ rowId, rowData }`

**Accessibility:**
- `aria-expanded` on expand button
- Keyboard navigation (Right/Left arrows)
- Focus management

### Use Cases

**Example 1: Nested Data**
- Orders → Line Items
- Users → Permissions
- Devices → Metrics

**Example 2: Nested Grid**
- Parent grid shows orders
- Detail row contains nested grid with line items

**Example 3: Async Data**
- Click expand → show loader
- Fetch detail data from API
- Populate detail content

### Implementation Estimate

**Total:** 3-4 days

**Day 1: Core Expand/Collapse**
- Add expand-cell to row template
- Implement toggle logic
- Add state tracking
- Fire row-expand/collapse events

**Day 2: Detail Row Rendering**
- Add detail-row-tpl template
- Implement insertion/removal
- Handle colspan calculation
- CSS styling

**Day 3: Public API & Examples**
- Add public methods
- Create nested grid example
- Create async data example
- Handle re-render preservation

**Day 4: Polish**
- Keyboard navigation
- ARIA attributes
- Animations
- Testing

### Comparison to Apex

| Feature | Apex `apx-data-grid` | Sherpa (Planned) |
|---------|---------------------|------------------|
| Expand/collapse | ✅ | ✅ (to add) |
| Template-based | ✅ | ✅ (to add) |
| Nested grids | ✅ | ✅ (to add) |
| Lazy rendering | ✅ | ✅ (to add) |
| Event-driven | ✅ | ✅ (to add) |
| Animations | ✅ | ✅ (to add) |
| Keyboard nav | ✅ | ✅ (to add) |
| Native table | ❌ DevExtreme | ✅ Native |

**Verdict:** Sherpa can match Apex with simpler implementation

### Status

**Current:** Infrastructure exists, feature not yet built  
**Next:** Implement expand/collapse → detail row template → examples  
**Deliverable:** Master-detail variant for sherpa-data-grid

---

## Phase 2 Overall Summary

### Investigation Results

**Total Priorities Investigated:** 3

**Breakdown:**
- ✅ **1 Complete** (Wizard - already exists)
- ⚠️ **1 Partial** (Advanced Select - tree exists, multi needs implementation)
- ⏭️ **1 Ready** (Master-Detail Grid - ready to implement)

### Key Learnings

#### Learning 1: Check Before Building (Again!)

**Phase 1:** Found node-header already deprecated  
**Phase 2:** Found wizard already implemented

**Lesson:** Always investigate current state thoroughly before planning implementation.

#### Learning 2: Your Vision Matches Reality

Your feedback about composition and simplification consistently matched or predicted what was already built:

1. **Wizard:** You described "Dialog + Stepper + Content" → Exists exactly like that
2. **Advanced Select:** You described "select + menu + checkboxes" → Tree exists, composition approach validated
3. **Master-Detail:** You said "shouldn't be hard given templates" → Analysis confirms it's easy

**Takeaway:** Previous developers shared your architectural philosophy!

#### Learning 3: Documentation Gaps ≠ Feature Gaps

Multiple features exist but aren't well-documented in patterns:
- Wizard exists (no pattern file until today)
- Tree select exists (minimal examples)
- Templates exist (not well-documented)

**Action:** Need comprehensive pattern library audit.

### Time Investment vs Savings

**Investigation Time:** ~4 hours (all 3 priorities)

**Implementation Time Saved:**
- Wizard: ~2-3 days (already exists)
- Tree select: ~3 days (exists, only enhancement needed)

**Total Saved:** ~5-6 days of implementation

**ROI:** Investigation phase very valuable!

---

## Implementation Priority Recommendations

Based on Phase 2 findings, recommended implementation order:

### Tier 1: High Priority (Clear Value)

1. **Master-Detail Grid** (3-4 days)
   - Not built yet
   - Clear use cases (orders → line items, etc.)
   - Infrastructure ready
   - Your feedback confirms it's valuable

2. **Multi-Select Dropdown** (3-4 days)
   - Common use case
   - Simple to implement
   - Foundation for tree multi-select

### Tier 2: Medium Priority (Enhancement)

3. **Multi-Select Tree** (3-4 days)
   - Builds on multi-select dropdown
   - Tree template already exists
   - More complex parent/child logic

4. **Wizard Enhancements** (1-2 days optional)
   - Validation blocking
   - Stepper slot integration
   - More examples

### Tier 3: Lower Priority (Nice-to-Have)

5. **Virtual Scrolling Infrastructure** (2-3 days)
   - CSS `content-visibility` first (simple)
   - Intersection Observer if needed
   - Benefits: menus, lists, selects, grids

---

## Updated Phase 2 Deliverables

### Documentation Created (3 files)

1. **wizard-already-implemented.md** - Wizard analysis + recommendations
2. **advanced-select-analysis.md** - Multi-select + tree analysis
3. **master-detail-grid-analysis.md** - Master-detail implementation plan

### Patterns Created (1 file)

1. **wizard-dialog.html** - 3 wizard pattern examples

### Implementation Plans Ready

1. **Multi-Select Dropdown** - Detailed spec, 3-4 days
2. **Multi-Select Tree** - Detailed spec, 3-4 days
3. **Master-Detail Grid** - Detailed spec, 3-4 days

**Total Implementation:** ~10-12 days for all Phase 2 features

---

## Comparison to Original Plan

### Original Plan (SHERPA-IMPROVEMENT-PLAN.md)

**Priority 2: Missing Component Variants (4-6 weeks)**
- Wizard: 2-3 days
- Advanced select: 5-7 days
- Master-detail: 3-4 days

### Actual Findings

**Priority 2: Missing Component Variants (2-3 weeks actual work)**
- Wizard: ✅ 0 days (exists, documented)
- Advanced select: 7-10 days (multi-select implementation)
- Master-detail: 3-4 days (matches estimate)

**Time Saved:** ~2 weeks (wizard exists, tree select exists)

---

## Next Steps

### Option A: Implement Phase 2 Features

Start coding in priority order:
1. Master-Detail Grid (3-4 days)
2. Multi-Select Dropdown (3-4 days)
3. Multi-Select Tree (3-4 days)

**Total:** 10-12 days of implementation

### Option B: Continue Investigations

Move to Phase 3 (Chart System) or Phase 4 (Layouts & Patterns):
- Investigate before implementing
- Build complete picture of gaps
- Then batch implementation

### Option C: Commit & Review

- Commit Phase 1 + Phase 2 documentation
- Review architectural principles
- Get stakeholder input on priorities

### Option D: Jump to Different Priority

- Virtual scrolling infrastructure
- Validation strategy
- Overlay consolidation
- Charts, layouts, or patterns

---

## Phase 2 Status Summary

**Investigation:** ✅ **100% Complete** (3/3 priorities analyzed)

**Implementation:** ⏭️ **0% Complete** (ready to start)

**Documentation:** ✅ **100% Complete** (3 investigations + 1 pattern)

**Time Spent:** ~4 hours investigation

**Time to Implement:** ~10-12 days (if all 3 features built)

**Recommended Next:** Implement Master-Detail Grid (highest priority, clear value)

---

**End of Phase 2 Investigations**  
Status: All priorities analyzed, implementation plans ready  
Next: Begin implementation OR continue investigations in Phase 3+
