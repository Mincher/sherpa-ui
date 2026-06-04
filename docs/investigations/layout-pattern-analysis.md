# Layout & Pattern System Investigation

**Date:** June 4, 2026  
**Investigation:** Phase 4, Priority 4  
**Goal:** Analyze layout system and transform pattern paradigm

---

## Your Feedback

### On Layouts:
> "Common layouts have been an Apex gap for a long time. They do have a Layout Grid which was recently added. I think we can do more to improve the layout definitions, and amount, in Sherpa too."

### On Patterns:
> "The way patterns are defined and used needs a lot of attention. A pattern isn't static layout it is a prescribed presentation-interaction-resolution paradigm. We should look at doing more with the MCP and also Agent Skill definitions."

---

## Part 1: Layout System Analysis

### Current Layout Components (6)

| Component | Purpose | Status |
|-----------|---------|--------|
| `sherpa-layout-grid` | 12-column responsive grid | ✅ Exists |
| `sherpa-layout-view` | View container with header/footer | ✅ Exists |
| `sherpa-container` | Generic container | ✅ Exists |
| `sherpa-container-header` | Container header | ✅ Exists |
| `sherpa-container-footer` | Container footer | ✅ Exists |
| `sherpa-container-group` | Container grouping | ✅ Exists |
| `sherpa-panel` | Drawer/side panel | ✅ Exists |
| `sherpa-view-header` | Page header with actions | ✅ Exists |

**Total:** 8 layout-related components

---

### Current Layout Patterns (7 from index.json)

From `patterns/index.json`:

**Layouts Category:**
1. **App Shell** - Full application frame (nav + content)
2. **List View** - Filterable list with toolbar/pagination
3. **Detail View** - Single item detail page
4. **View with Rails** - Content with side panels
5. **Dashboard Grid** - Metric cards + visualizations
6. **Settings Form** - Grouped form sections
7. **Flex Truncate** - Progressive hiding of flex children

**Total:** 7 layout patterns documented

---

### Actual Pattern Files

**From filesystem:**
```
patterns/
  wizard-dialog.html (NEW - added today)
  layouts/
    app-shell.html
    dashboard-grid.html
    detail-view.html
    flex-truncate.html
    list-view.html
    settings-form.html
    view-with-rails.html
  flows/
    add.html
    delete.html
    edit.html
  feedback/
    confirmation-dialog.html
    empty-state.html
    loading-state.html
```

**Total:** 14 pattern files (13 + wizard)

---

### Layout Gap Analysis

#### Layouts Sherpa HAS

✅ **App Shell** - Navigation + content grid
✅ **List View** - Data table with filters
✅ **Detail View** - Single item display
✅ **Dashboard Grid** - Widget grid
✅ **Settings Form** - Form layout
✅ **View with Rails** - Content + side panels
✅ **Flex Truncate** - Responsive truncation

---

#### Layouts Sherpa COULD ADD

**Your feedback suggests more layouts needed. Common patterns missing:**

❌ **Split View** (Resizable Panels)
- **Use Case:** Code editor, file browser + preview
- **Components:** Two panels with resize handle
- **Complexity:** MEDIUM (3-4 days)
- **Need:** Resizable splitter logic

❌ **Masonry/Pinterest Layout**
- **Use Case:** Image galleries, card grids
- **Components:** Dynamic grid with varying heights
- **Complexity:** MEDIUM (2-3 days)
- **Need:** Masonry layout algorithm

❌ **Sidebar Layouts** (Beyond App Shell)
- **Use Case:** Different sidebar configurations
- **Variants:**
  - Left sidebar only
  - Right sidebar only
  - Dual sidebars (left + right)
  - Collapsible sidebars
- **Complexity:** LOW (1-2 days)
- **Need:** CSS grid variants

❌ **Master-Detail Split**
- **Use Case:** Email client (list + message), file browser
- **Components:** List on left, detail on right
- **Complexity:** LOW (1-2 days)
- **Need:** CSS grid layout

❌ **Kanban Board Layout**
- **Use Case:** Task boards, swimlanes
- **Components:** Horizontal columns with cards
- **Complexity:** MEDIUM (3-4 days)
- **Need:** Drag-drop, column scrolling

❌ **Timeline/Gantt Layout**
- **Use Case:** Project schedules, event timelines
- **Components:** Horizontal timeline with items
- **Complexity:** HIGH (5-7 days)
- **Need:** Timeline rendering, date positioning

❌ **Multi-Column Form**
- **Use Case:** Wide forms, data entry
- **Components:** 2-3 column form layout
- **Complexity:** LOW (1 day)
- **Need:** CSS grid for forms

❌ **Sticky Header + Footer**
- **Use Case:** Fixed navigation, persistent actions
- **Components:** Header, content, footer
- **Complexity:** LOW (1 day)
- **Need:** CSS positioning pattern

---

### Layout Priority Ranking

#### Tier 1: HIGH PRIORITY (Common Needs)

1. **Split View with Resize** (3-4 days)
   - Very common pattern
   - Used in many apps
   - Requires resize handle logic

2. **Master-Detail Split** (1-2 days)
   - Email, file browsers
   - Similar to split view but simpler
   - No resize needed (or optional)

3. **Multi-Column Form** (1 day)
   - Simple CSS grid
   - Wide form layouts
   - Easy win

---

#### Tier 2: MEDIUM PRIORITY (Nice-to-Have)

4. **Sidebar Variants** (1-2 days)
   - Left/right/dual configurations
   - CSS grid templates
   - Document existing patterns

5. **Masonry Layout** (2-3 days)
   - Image galleries
   - Card grids
   - CSS grid or library

6. **Sticky Header+Footer** (1 day)
   - Fixed positioning pattern
   - CSS-only solution
   - Document pattern

---

#### Tier 3: LOW PRIORITY (Specialized)

7. **Kanban Board** (3-4 days)
   - Drag-drop complex
   - Specialized use case
   - May need library

8. **Timeline/Gantt** (5-7 days)
   - Complex date rendering
   - Specialized visualization
   - Consider component vs pattern

---

## Part 2: Pattern Paradigm Shift

### Current Pattern System (Static HTML)

**Structure:**
```html
<!-- patterns/layouts/list-view.html -->
<template id="list-view">
  <sherpa-view-header></sherpa-view-header>
  <sherpa-filter-bar></sherpa-filter-bar>
  <sherpa-data-grid></sherpa-data-grid>
  <sherpa-pagination></sherpa-pagination>
</template>
```

**Pattern Index:**
```json
{
  "id": "list-view",
  "name": "Filterable list with toolbar and pagination",
  "category": "layouts",
  "file": "patterns/layouts/list-view.html",
  "description": "Provides a standard list page layout",
  "status": "stable",
  "components": ["sherpa-view-header", "sherpa-filter-bar", ...]
}
```

**Limitations:**
- ❌ Static HTML only
- ❌ No interaction logic
- ❌ No resolution outcomes
- ❌ Consumer must wire everything
- ❌ No AI generation support

---

### Proposed Pattern System (Behavior-Driven)

**Your Vision:**
> "A pattern isn't static layout it is a prescribed presentation-interaction-resolution paradigm."

**New Pattern Definition:**

```json
{
  "id": "add-entity-flow",
  "name": "Complete add-entity flow",
  "category": "flows",
  
  "presentation": {
    "layout": "dialog",
    "components": [
      {"type": "sherpa-dialog", "id": "add-dialog", "size": "medium"},
      {"type": "sherpa-input-text", "id": "name-input", "required": true},
      {"type": "sherpa-button", "id": "submit-btn", "variant": "primary"}
    ],
    "template": "patterns/flows/add.html"
  },
  
  "interaction": {
    "triggers": [
      {"event": "button:click", "target": "submit-btn", "action": "validate_and_submit"},
      {"event": "dialog:close", "target": "add-dialog", "action": "cancel_flow"}
    ],
    "validations": [
      {"field": "name-input", "rule": "required", "message": "Name is required"},
      {"field": "name-input", "rule": "minLength:3", "message": "Name must be at least 3 characters"}
    ],
    "navigation": {
      "next": ["validate", "submit", "close_dialog"],
      "cancel": ["close_dialog"],
      "error": ["show_message", "focus_invalid_field"]
    }
  },
  
  "resolution": {
    "success": {
      "action": "close_dialog",
      "events": ["entity:created"],
      "feedback": {
        "type": "toast",
        "message": "Entity created successfully",
        "status": "success"
      },
      "navigation": "refresh_list"
    },
    "cancel": {
      "action": "close_dialog",
      "events": ["flow:cancelled"]
    },
    "error": {
      "action": "show_message",
      "events": ["validation:failed", "api:error"],
      "feedback": {
        "type": "callout",
        "message": "Failed to create entity",
        "status": "critical"
      }
    }
  },
  
  "metadata": {
    "status": "stable",
    "version": "1.0.0",
    "mcp_compatible": true,
    "agent_skill": "patterns/skills/add-entity.js"
  }
}
```

---

### Pattern Schema Structure

```typescript
interface Pattern {
  // Identity
  id: string;
  name: string;
  category: 'layouts' | 'flows' | 'feedback' | 'data' | 'forms';
  description: string;
  
  // Presentation - Visual layout and components
  presentation: {
    layout: string; // 'dialog' | 'page' | 'panel' | 'inline'
    components: ComponentDefinition[];
    template: string; // Path to HTML template
    styles?: string; // Optional CSS
  };
  
  // Interaction - User actions and behaviors
  interaction: {
    triggers: TriggerDefinition[];
    validations?: ValidationRule[];
    navigation: NavigationMap;
    state?: StateDefinition;
  };
  
  // Resolution - Expected outcomes
  resolution: {
    success: ResolutionOutcome;
    cancel?: ResolutionOutcome;
    error: ResolutionOutcome;
  };
  
  // Metadata
  metadata: {
    status: 'draft' | 'stable' | 'deprecated';
    version: string;
    mcp_compatible: boolean;
    agent_skill?: string; // Path to skill definition
  };
}
```

---

### Benefits of New Pattern System

#### 1. AI Generation Support

**Current:** AI generates static HTML  
**New:** AI generates complete interactive flows

**MCP Tool Enhancement:**
```typescript
// patterns-mcp/generate_pattern.ts
async function generatePattern(params) {
  const { patternId, data } = params;
  const pattern = await loadPattern(patternId);
  
  // Generate HTML from presentation
  const html = generateHtml(pattern.presentation, data);
  
  // Generate JavaScript for interaction
  const js = generateInteractionLogic(pattern.interaction, data);
  
  // Return complete implementation
  return { html, js, events: pattern.resolution };
}
```

#### 2. Validation & Consistency

**New patterns can be validated:**
- Required components exist
- Event targets are valid
- Resolution outcomes are complete
- Navigation flows are correct

#### 3. Testing

**Patterns are testable:**
```javascript
// patterns/__tests__/add-flow.test.js
describe('Add Entity Flow', () => {
  it('completes successfully when valid', async () => {
    const flow = await loadPattern('add-entity-flow');
    const result = await simulateFlow(flow, { name: 'Test' });
    expect(result.outcome).toBe('success');
    expect(result.events).toContain('entity:created');
  });
});
```

#### 4. Documentation

**Auto-generated docs:**
- Interaction flowcharts
- Event diagrams
- Component dependencies
- Usage examples

---

## Pattern Transformation Plan

### Phase 1: Schema Definition (2-3 days)

**Actions:**
1. Define complete pattern schema (TypeScript interfaces)
2. Create pattern validator
3. Document schema with examples
4. Add JSON schema for validation

**Deliverable:** Pattern schema v1.0

---

### Phase 2: Migrate Existing Patterns (5-7 days)

**Actions:**
1. Convert 13 existing patterns to new schema
2. Add interaction logic to each
3. Define resolution outcomes
4. Test each pattern

**Priority Order:**
1. Add flow (example pattern)
2. Edit flow
3. Delete flow
4. List view
5. Detail view
6. Dashboard grid
7. App shell
8. Settings form
9. View with rails
10. Confirmation dialog
11. Empty state
12. Loading state
13. Flex truncate

**Deliverable:** 13 patterns in new format

---

### Phase 3: MCP Integration (3-4 days)

**Actions:**
1. Enhance `generate_pattern` MCP tool
2. Add `validate_pattern` tool
3. Add `list_patterns` with filters
4. Update pattern resources

**New MCP Tools:**
- `generate_pattern(patternId, data)` - Generate complete flow
- `validate_pattern(patternSchema)` - Validate pattern definition
- `simulate_pattern(patternId, inputs)` - Test pattern logic
- `list_patterns({ category, compatible_with })` - Find patterns

**Deliverable:** Enhanced MCP server

---

### Phase 4: Agent Skill Integration (3-4 days)

**Actions:**
1. Create agent skill definitions for patterns
2. Link patterns to skills in metadata
3. Document skill usage
4. Test AI generation

**Agent Skill Example:**
```javascript
// patterns/skills/add-entity.js
export const skill = {
  name: 'add-entity',
  description: 'Generate a complete add-entity flow',
  pattern: 'add-entity-flow',
  
  async generate(params) {
    const { entityType, fields } = params;
    return await generatePattern('add-entity-flow', {
      dialog: { title: `Add ${entityType}` },
      fields: fields.map(f => generateInputForField(f)),
      submitLabel: `Create ${entityType}`,
    });
  }
};
```

**Deliverable:** Pattern generation skills

---

### Phase 5: Tooling & Documentation (2-3 days)

**Actions:**
1. Pattern playground (visual builder)
2. Pattern documentation site
3. Migration guide (old → new)
4. Best practices guide

**Deliverable:** Pattern authoring toolkit

---

## Implementation Estimates

### Layouts (New Patterns): 8-13 days

**Priority 1:**
- Split View with Resize: 3-4 days
- Master-Detail Split: 1-2 days
- Multi-Column Form: 1 day

**Priority 2:**
- Sidebar Variants: 1-2 days
- Masonry Layout: 2-3 days
- Sticky Header+Footer: 1 day

**Total:** 9-13 days for 6 new layouts

---

### Pattern Paradigm Shift: 15-21 days

**Phases:**
- Schema Definition: 2-3 days
- Migrate Existing: 5-7 days
- MCP Integration: 3-4 days
- Agent Skills: 3-4 days
- Tooling: 2-3 days

**Total:** 15-21 days for pattern transformation

---

### Combined Total: 23-34 days

**If done sequentially:**
- Layouts: 8-13 days
- Patterns: 15-21 days

**Can parallelize:**
- Some layout work can happen while patterns transform
- MCP work can overlap with layout creation

**Realistic:** 3-5 weeks

---

## Comparison to Apex

### Layouts

| Feature | Apex | Sherpa Current | Sherpa Planned |
|---------|------|----------------|----------------|
| App Shell | ⚠️ Gap noted | ✅ | ✅ |
| List View | ✅ | ✅ | ✅ |
| Detail View | ✅ | ✅ | ✅ |
| Dashboard | ✅ | ✅ | ✅ |
| Settings | ✅ | ✅ | ✅ |
| Split View | ❓ | ❌ | ✅ (to add) |
| Master-Detail | ❓ | ❌ | ✅ (to add) |
| Forms | ✅ | ✅ | ✅ (enhance) |
| Total Count | ~5-7 | 7 | 13+ |

**Verdict:** Sherpa has good coverage, planned additions exceed Apex

---

### Patterns

| Feature | Apex | Sherpa Current | Sherpa Planned |
|---------|------|----------------|----------------|
| Static HTML | ✅ | ✅ | ✅ |
| Interaction Logic | ❌ | ❌ | ✅ (to add) |
| Resolution Outcomes | ❌ | ❌ | ✅ (to add) |
| MCP Integration | ⚠️ Basic | ⚠️ Basic | ✅ Enhanced |
| AI Generation | ❌ | ⚠️ Basic | ✅ Full support |
| Testable Patterns | ❌ | ❌ | ✅ (to add) |

**Verdict:** Proposed pattern system significantly exceeds Apex capabilities

---

## Key Findings

### Finding 1: Layouts are Adequate, Need Expansion

**Current:** 7 layout patterns (good foundation)  
**Needed:** 6+ additional layouts (split view, master-detail, etc.)  
**Effort:** 8-13 days to add priority layouts

**Assessment:** Not a gap, but room for growth

---

### Finding 2: Pattern Paradigm Shift is Innovative

**Your vision of patterns as "presentation-interaction-resolution"** is significantly better than current approach.

**Benefits:**
- ✅ AI can generate complete flows (not just HTML)
- ✅ Patterns are testable
- ✅ Patterns are validatable
- ✅ Better MCP integration
- ✅ Agent skill support

**Assessment:** Major innovation opportunity

---

### Finding 3: Pattern Work is Most Impactful

**Layout work:** Incremental value (nice-to-have)  
**Pattern work:** Transformative value (game-changer)

**Recommendation:** Prioritize pattern paradigm shift over new layouts

---

## Recommendations

### Immediate Actions

1. **Pattern Schema Definition** (2-3 days)
   - Define complete schema
   - Create validator
   - Document with examples

2. **Proof-of-Concept** (2-3 days)
   - Convert one pattern (add-flow) to new format
   - Implement interaction logic
   - Test MCP generation

3. **Validate Approach** (1 day)
   - Review POC with stakeholders
   - Confirm schema completeness
   - Adjust based on feedback

### Medium-Term Enhancements

4. **Migrate All Patterns** (5-7 days)
   - Convert 13 existing patterns
   - Add interaction logic
   - Test each pattern

5. **MCP Enhancement** (3-4 days)
   - Enhanced generation tools
   - Pattern validation
   - Simulation capabilities

6. **Add Priority Layouts** (3-5 days)
   - Split View
   - Master-Detail
   - Multi-Column Form

---

## Status Summary

**Current Layouts:** 7 patterns (adequate coverage)  
**Planned Layouts:** 6+ additions (incremental value)  
**Current Patterns:** Static HTML (functional but limited)  
**Planned Patterns:** Behavior-driven (transformative)

**Total Effort:**
- Layouts: 8-13 days
- Patterns: 15-21 days
- Combined: 23-34 days (3-5 weeks)

**Recommendation:** Start with pattern paradigm shift (highest value), add layouts as needed

---

**End of Investigation**  
Status: Layout inventory complete, pattern transformation designed  
Next: Pattern schema POC → Migrate patterns → Add layouts  
Highest Value: Pattern paradigm shift (presentation-interaction-resolution)
