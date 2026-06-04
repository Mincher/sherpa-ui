# Sherpa UI Improvement & Investigation Plan

**Based on:** APEX-COMPARISON.md analysis + William's feedback  
**Date:** June 4, 2026  
**Purpose:** Actionable roadmap for Sherpa enhancements based on Apex comparison

---

## Executive Summary

This plan synthesizes findings from the Apex comparison with your strategic feedback to create a prioritized improvement roadmap. Key themes:

1. **Consolidation over proliferation** - Reduce component count through variants and composition
2. **Composition over monoliths** - Leverage existing components rather than building specialized ones
3. **Standards over dependencies** - Avoid DevExtreme-style bloat, use native web capabilities
4. **Patterns over static layouts** - Define interaction paradigms, not just UI templates
5. **Component reuse** - Maximize use of existing components through creative composition

---

## Table of Contents

1. [Priority 1: Component Consolidation & Simplification](#priority-1-component-consolidation--simplification)
2. [Priority 2: Missing Component Variants](#priority-2-missing-component-variants)
3. [Priority 3: Chart System Overhaul](#priority-3-chart-system-overhaul)
4. [Priority 4: Layout & Pattern Enhancement](#priority-4-layout--pattern-enhancement)
5. [Priority 5: Input Enhancement & Consolidation](#priority-5-input-enhancement--consolidation)
6. [Priority 6: Virtual Scrolling Infrastructure](#priority-6-virtual-scrolling-infrastructure)
7. [Priority 7: Scheduler Modernization](#priority-7-scheduler-modernization)
8. [Priority 8: MCP & AI Tooling Enhancement](#priority-8-mcp--ai-tooling-enhancement)
9. [Priority 9: Validation Strategy](#priority-9-validation-strategy)
10. [Priority 10: Overlay Consolidation Investigation](#priority-10-overlay-consolidation-investigation)
11. [Phase 2: Investigations](#phase-2-investigations)

---

## Priority 1: Component Consolidation & Simplification

### 1.1 Navigation Consolidation

**Current State:**
- `sherpa-nav` - Main navigation component
- `sherpa-nav-item` - Navigation link item
- `sherpa-nav-section` - Navigation section divider

**Your Feedback:**
> "I actually think that, while the Sherpa nav is much improved, it is currently too fragmented in Sherpa. I'd like to explore more elegant ways to have nav sections and items as part of a single nav component. I'd still want to leverage HTML templates and CSS for as much of this as possible."

**Action Items:**
- [ ] **Investigate:** Can `sherpa-nav` consume nav structure from HTML templates instead of separate components?
- [ ] **Design:** Template-based nav definition (e.g., `<template id="nav-structure">` with sections/items)
- [ ] **Prototype:** Single `sherpa-nav` component that parses template for structure
- [ ] **Evaluate:** Trade-offs between flexibility and simplicity
- [ ] **Decision:** Keep separate components or consolidate?

**Success Criteria:**
- Navigation structure defined in declarative HTML template
- CSS handles visual hierarchy (sections, items, nesting)
- Single component with lower cognitive load
- No loss of functionality (search, collapsible, icons)

**Complexity:** Medium (4-5 days)  
**Impact:** High - sets pattern for other component consolidation

---

### 1.2 Node Component Reduction

**Current State:**
- `sherpa-node` - Node graph node component
- `sherpa-node-canvas` - Flow diagram canvas
- `sherpa-node-header` - Node header
- `sherpa-node-row` - Node content row
- `sherpa-node-socket` - Node connection socket

**Your Feedback:**
> "Nodes and the Node Canvas are a new UX paradigm that I have implemented into Sherpa. I would like to see how we could reduce the number of node components, though. Do we need a node-header component for example?"

**Action Items:**
- [ ] **Audit:** Which node sub-components are actually reused outside of `sherpa-node`?
- [ ] **Investigate:** Can `sherpa-node-header` be replaced with `sherpa-node-row` variant?
- [ ] **Design:** Consolidate node sub-components into fewer variants
- [ ] **Prototype:** 
  - Option A: `sherpa-node` with `data-variant="header|row|socket"`
  - Option B: Keep socket separate, merge header/row
- [ ] **Decision:** Which components to keep as standalone vs slots/templates

**Success Criteria:**
- Reduce 5 components to 2-3 components
- Maintain full node graph functionality
- Simpler API for node composition
- Better template reuse

**Complexity:** Medium (3-4 days)  
**Impact:** Medium - cleaner node API, reduced maintenance

---

### 1.3 Menu Simplification Investigation

**Your Feedback:**
> "I like the Sherpa menu implementation. I would like to explore ways that we could simplify the component(s) at some point, though. Not using DevExtreme is a big plus for me. It's bloated and tedious to work with."

**Action Items:**
- [ ] **Document:** Current menu/menu-item API and usage patterns
- [ ] **Investigate:** Can `sherpa-menu-item` be replaced with styled list items + CSS?
- [ ] **Research:** How do other lightweight systems handle menus? (Shoelace, Fast, Lion)
- [ ] **Prototype:** Template-driven menu (menu-item as template, not component)
- [ ] **Evaluate:** Is separate `sherpa-menu-item` component necessary?

**Success Criteria:**
- Simpler menu API without losing functionality
- Maintain keyboard navigation, ARIA, focus management
- Reduced component count if feasible

**Complexity:** Low-Medium (2-3 days)  
**Impact:** Low-Medium - incremental improvement

---

## Priority 2: Missing Component Variants

### 2.1 Wizard as Dialog Variant

**Your Feedback:**
> "A wizard is just a Dialog with a Stepper and Content Area between the footer. A Dialog is just a container with some elevation and a scrim behind it. We can add the wizard as dialog variants. If we add a full screen (app view bounds) dialog wizard variant then we can support the full screen wizard seen in Apex."

**Action Items:**
- [ ] **Design:** Wizard template structure
  ```html
  <sherpa-dialog data-template="wizard" data-size="large|fullscreen">
    <sherpa-stepper slot="header"></sherpa-stepper>
    <div slot="content"><!-- Step content --></div>
    <div slot="footer"><!-- Navigation buttons --></div>
  </sherpa-dialog>
  ```
- [ ] **Implement:** Wizard-specific dialog styling
- [ ] **Implement:** Fullscreen dialog variant (100vh, no modal backdrop)
- [ ] **Add:** Wizard helper methods (nextStep, prevStep, gotoStep)
- [ ] **Add:** Validation integration (block navigation on invalid step)
- [ ] **Document:** Wizard pattern in patterns/ directory
- [ ] **Test:** Multi-step flows (3-5 steps, validation, skip steps)

**Success Criteria:**
- Wizard pattern works without new component
- Fullscreen and dialog modes supported
- Step validation integrated
- Matches Apex wizard functionality

**Complexity:** Low-Medium (2-3 days)  
**Impact:** HIGH - closes critical gap without new component

---

### 2.2 Advanced Select as Composition

**Your Feedback:**
> "An advanced-selectbox and treeview-selectbox are just a select input where the menu shows a hierarchy of checkbox items in a collapsable tree list. We can get those variants together from components we already have in sherpa. Apex makes this more complicated than it needs to be."

**Action Items:**
- [ ] **Design:** Compose `sherpa-input-select` + `sherpa-menu` + `sherpa-input-checkbox` for multi-select
- [ ] **Implement:** Tree menu template (nested lists with collapse/expand)
- [ ] **Implement:** Virtual scrolling in menu (see Priority 6)
- [ ] **Add:** Tree selection state management (parent/child relationships)
- [ ] **Add:** Search/filter in select menu
- [ ] **Document:** Advanced select composition pattern
- [ ] **Example:** Org chart select, file tree select

**Success Criteria:**
- Multi-select dropdown with checkboxes
- Hierarchical (tree) selection
- Virtual scrolling for 1000+ items
- No new components, just composition

**Complexity:** Medium-High (5-7 days)  
**Impact:** HIGH - fills major gap with composition

---

### 2.3 Master-Detail Grid Variant

**Your Feedback:**
> "Implementing a Master-Detail variant of the grid shouldn't be hard to do given we already support template variants, grouping etc. We should look to bring sherpa in line here."

**Action Items:**
- [ ] **Design:** Expandable row template structure
  ```html
  <sherpa-data-grid>
    <template id="detail-row">
      <!-- Detail content here, receives row data -->
    </template>
  </sherpa-data-grid>
  ```
- [ ] **Implement:** Row expansion state management
- [ ] **Implement:** Detail row rendering (insert below master row)
- [ ] **Add:** Expand/collapse icons in row
- [ ] **Add:** Keyboard navigation (arrow keys to expand)
- [ ] **Add:** Data pipeline for detail rows (nested data)
- [ ] **Document:** Master-detail pattern and examples
- [ ] **Test:** Nested data (orders → line items, users → permissions)

**Success Criteria:**
- Expandable rows with custom detail content
- Template-driven detail rendering
- Keyboard accessible
- Works with existing grouping/sorting

**Complexity:** Medium (3-4 days)  
**Impact:** MEDIUM - closes data grid gap

---

## Priority 3: Chart System Overhaul

**Your Feedback:**
> "Sherpa charts are an area that need more focus. We need to recreate all of the charts available in Apex in Sherpa. We also need to look to improve the way chart visuals and legends are layed out and interacted with."

### 3.1 Chart Component Audit

**Action Items:**
- [ ] **Audit:** List all Apex chart types (11+ from `apx-chart-widget`)
  - Identify: Area, Bar, Line, Doughnut, Icon Number, KPI, Sparkline, Color Bar, Status Bar, Gauge, etc.
- [ ] **Compare:** Which exist in Sherpa? Which are missing?
- [ ] **Gap Analysis:** Create chart parity matrix

**Missing Charts (Initial Assessment):**
- Area chart
- Icon number chart
- KPI chart (different from sherpa-metric?)
- Color bar chart
- Status bar chart
- Gauge variants

---

### 3.2 Chart Architecture Improvements

**Action Items:**
- [ ] **Investigate:** Chart legend integration
  - Current: `sherpa-chart-legend` is separate component
  - Improve: Automatic legend generation from chart data?
  - Layout: Better positioning (top, bottom, left, right, floating)
- [ ] **Investigate:** Chart interactivity
  - Hover tooltips
  - Click events (drill-down)
  - Zoom/pan for large datasets
- [ ] **Investigate:** Responsive chart sizing
  - Container queries for responsive breakpoints
  - Auto-resize on container size change
- [ ] **Investigate:** Chart accessibility
  - ARIA labels for data points
  - Keyboard navigation
  - Screen reader announcements
- [ ] **Investigate:** Chart theming
  - Use design tokens for colors
  - Support theme switching
  - Custom color palettes

---

### 3.3 Implement Missing Chart Types

**Action Items:**
- [ ] **Implement:** `sherpa-area-chart` (line chart filled below)
- [ ] **Implement:** `sherpa-kpi-chart` (large number + trend indicator)
- [ ] **Implement:** `sherpa-status-bar-chart` (horizontal bars with status colors)
- [ ] **Implement:** `sherpa-icon-number` (icon + large number display)
- [ ] **Consider:** Are some charts just variants? (area = line with fill)

**Success Criteria:**
- Chart parity with Apex (11+ chart types)
- Consistent API across all charts
- Better legend integration
- Responsive and accessible

**Complexity:** HIGH (15-20 days across all charts)  
**Impact:** HIGH - critical for data visualization use cases

---

## Priority 4: Layout & Pattern Enhancement

### 4.1 Layout System Expansion

**Your Feedback:**
> "Common layouts have been an Apex gap for a long time. They do have a Layout Grid which was recently added. I think we can do more to improve the layout definitions, and amount, in Sherpa too."

**Action Items:**
- [ ] **Audit:** Current Sherpa layouts
  - `sherpa-layout-grid` - Grid-based app layout
  - `sherpa-layout-view` - View container with header/footer
- [ ] **Research:** Common app layout patterns
  - Sidebar + content (collapsible sidebar)
  - Header + sidebar + content + footer
  - Split view (resizable panels)
  - Masonry/Pinterest layout
  - Dashboard grid
- [ ] **Design:** Additional layout components or variants
  - `sherpa-layout-split` (resizable split view)?
  - `sherpa-layout-masonry` (dynamic grid)?
  - Or: More layout CSS utilities?
- [ ] **Prototype:** 5+ new layout patterns
- [ ] **Document:** Layout composition guide

**Success Criteria:**
- 10+ ready-to-use layouts (vs current ~3)
- Clear documentation on when to use each
- Examples covering common app types

**Complexity:** Medium (5-7 days)  
**Impact:** HIGH - better out-of-box experience

---

### 4.2 Pattern Paradigm Shift

**Your Feedback:**
> "The way patterns are defined and used needs a lot of attention. A pattern isn't static layout it is a prescribed presentation-interaction-resolution paradigm. We should look at doing more with the MCP and also Agent Skill definitions."

**Current Patterns (13 static HTML files):**
- Layouts: App Shell, List View, Detail View, View with Rails, Dashboard Grid, Settings Form, Flex Truncate
- Flows: Add Flow, Edit Flow, Delete Flow
- Feedback: Confirmation Dialog, Empty State, Loading State

**New Pattern Definition:**
- **Presentation** - Visual layout and component composition
- **Interaction** - User actions and component behaviors
- **Resolution** - Expected outcomes and state changes

**Action Items:**
- [ ] **Define:** Pattern schema structure
  ```json
  {
    "name": "Add Flow",
    "category": "flow",
    "presentation": {
      "layout": "dialog",
      "components": ["sherpa-dialog", "sherpa-stepper", "sherpa-button"],
      "template": "path/to/template.html"
    },
    "interaction": {
      "triggers": ["button:click", "stepper:complete"],
      "validations": ["form:required", "step:complete"],
      "navigation": ["next", "cancel", "submit"]
    },
    "resolution": {
      "success": { "action": "close_dialog", "event": "item:created" },
      "cancel": { "action": "close_dialog", "event": "flow:cancelled" },
      "error": { "action": "show_message", "event": "validation:failed" }
    }
  }
  ```
- [ ] **Migrate:** Convert existing 13 patterns to new schema
- [ ] **Implement:** Pattern validation (check if components/events exist)
- [ ] **Enhance:** MCP server to understand new pattern schema
- [ ] **Add:** Agent skill for pattern-based generation
- [ ] **Document:** Pattern authoring guide

**Success Criteria:**
- Patterns are more than HTML templates
- MCP can generate complete flows from pattern definitions
- Patterns include interaction logic, not just layout
- Reusable across different contexts

**Complexity:** HIGH (10-15 days)  
**Impact:** VERY HIGH - transforms Sherpa into behavior-driven system

---

## Priority 5: Input Enhancement & Consolidation

### 5.1 Input Component Optimization

**Your Feedback:**
> "Apex actually has Number box, Select box, Text Area, Text box and Treeview Select box in it's Inputs category. I like Sherpas implementation so far but I do think there's scope for some optimisation and consolidation."

**Current Sherpa Inputs (13):**
- sherpa-input-checkbox, sherpa-input-checkbox-group
- sherpa-input-date, sherpa-input-date-range, sherpa-date-time-picker
- sherpa-input-number
- sherpa-input-password
- sherpa-input-radio, sherpa-input-radio-group
- sherpa-input-search
- sherpa-input-select
- sherpa-input-tag
- sherpa-input-text
- sherpa-input-time
- sherpa-file-upload

**Action Items:**
- [ ] **Investigate:** Can date/time inputs consolidate?
  - `sherpa-input-date` + `sherpa-input-time` → `sherpa-date-time-picker` variants?
  - Or keep separate for flexibility?
- [ ] **Investigate:** Can checkbox/radio groups be a single "choice-group" component?
  - `sherpa-input-choice-group` with `data-type="checkbox|radio"`?
- [ ] **Investigate:** Input enhancement without DevExtreme bloat
  - Input masks (phone, credit card, date formats)
  - Auto-formatting (currency, percentage)
  - Rich text input (basic formatting)
- [ ] **Document:** Input consolidation recommendations

**Success Criteria:**
- Fewer input components if consolidation makes sense
- Maintain full functionality
- Avoid DevExtreme-style complexity

**Complexity:** Medium (5-7 days investigation + implementation)  
**Impact:** MEDIUM - cleaner input system

---

### 5.2 Form Input Enhancement

**Your Feedback:**
> "I don't think we fully utilise a lot of what Apex provides. However I would like to look at improving how Sherpa improves default HTML form inputs."

**Action Items:**
- [ ] **Research:** What HTML5 input features are underutilized?
  - `pattern` attribute for regex validation
  - `inputmode` for mobile keyboards
  - `autocomplete` for autofill hints
  - `list` for datalist suggestions
- [ ] **Implement:** Sherpa input enhancements
  - Better focus states (not just browser default)
  - Clear/reset buttons
  - Character count for text inputs
  - Input hints/helper text
  - Inline validation feedback
- [ ] **Design:** Input polish without heavy dependencies
  - Subtle shadows
  - Smooth transitions
  - Refined hover states
- [ ] **Document:** Input best practices guide

**Success Criteria:**
- Sherpa inputs feel polished (not "basic HTML5")
- Still lightweight (no big dependencies)
- Better UX than raw HTML inputs
- Match or exceed Apex visual polish

**Complexity:** Medium (4-5 days)  
**Impact:** HIGH - improves perceived quality

---

## Priority 6: Virtual Scrolling Infrastructure

**Your Feedback:**
> "We can actually look to see where we can benefit from virtual scrolling across a lot of Sherpa components. Long menus, lists, grid pages etc."

### 6.1 Virtual Scrolling Library/Utility

**Action Items:**
- [ ] **Research:** Virtual scrolling approaches
  - Intersection Observer API
  - Scroll event + viewport calculation
  - CSS `content-visibility: auto` (simpler approach)
- [ ] **Design:** Reusable virtual scroll utility
  ```javascript
  // Example API
  class VirtualScroller {
    constructor(container, itemHeight, renderItem) {}
    setData(items) {}
    scrollToIndex(index) {}
  }
  ```
- [ ] **Implement:** Virtual scroll mixin or utility class
- [ ] **Test:** Performance with 10k, 50k, 100k items

**Success Criteria:**
- Reusable virtual scroll code
- Works with variable item heights
- Smooth scrolling performance
- Keyboard navigation support

**Complexity:** MEDIUM-HIGH (5-7 days)  
**Impact:** HIGH - enables large dataset handling

---

### 6.2 Apply Virtual Scrolling to Components

**Action Items:**
- [ ] **Integrate:** `sherpa-input-select` dropdown (Priority 2.2)
- [ ] **Integrate:** `sherpa-menu` (long menus)
- [ ] **Integrate:** `sherpa-list` (large lists)
- [ ] **Integrate:** `sherpa-data-grid` (pagination alternative)
- [ ] **Consider:** `sherpa-nav` (many nav items)

**Success Criteria:**
- All list-based components handle 1000+ items smoothly
- No new dependencies
- Opt-in via attribute (e.g., `data-virtual-scroll="true"`)

**Complexity:** MEDIUM (3-4 days per component)  
**Impact:** HIGH - major performance improvement

---

## Priority 7: Scheduler Modernization

**Your Feedback:**
> "Both Apex and Sherpa are lacking here. Sherpa should shine by making use of the JS Temporal functionality over outdated methods: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal. I've not focused much on the output generated from components for other consumers. I imagine some orientation around JSON would make sense."

### 7.1 Temporal API Integration

**Action Items:**
- [ ] **Research:** Temporal API current browser support
  - Polyfill needed? (temporal-polyfill package)
  - Feature detection strategy
- [ ] **Design:** Scheduler output format
  ```json
  {
    "frequency": "weekly",
    "interval": 2,
    "startDate": "2026-06-04T09:00:00",
    "endDate": "2026-12-31T17:00:00",
    "daysOfWeek": ["monday", "wednesday", "friday"],
    "timezone": "America/New_York",
    "temporal": {
      "startPlainDateTime": "...",
      "duration": "P2W"
    }
  }
  ```
- [ ] **Implement:** Temporal-based scheduler logic
  - Replace Date objects with Temporal.PlainDate
  - Use Temporal.Duration for intervals
  - Support timezones with Temporal.ZonedDateTime
- [ ] **Add:** CRON generation from Temporal (optional)
- [ ] **Add:** JSON output via property or method
- [ ] **Document:** Scheduler output format

**Success Criteria:**
- Uses Temporal API (with polyfill for older browsers)
- Outputs structured JSON
- Can generate CRON expressions if needed
- Better than Apex and Sherpa v1

**Complexity:** MEDIUM-HIGH (5-7 days)  
**Impact:** MEDIUM - modernizes scheduler, better backend integration

---

## Priority 8: MCP & AI Tooling Enhancement

### 8.1 JSON Schema Review

**Your Feedback:**
> "We should also take a look at the JSON schemas and how they are being used, what value they bring, etc."

**Action Items:**
- [ ] **Audit:** Current schema usage
  - Where are schemas consumed? (MCP server, docs, validation)
  - What's missing from schemas? (events, slots, variants)
  - Are schemas accurate/up-to-date?
- [ ] **Enhance:** Schema content
  - Add slot definitions
  - Add event definitions
  - Add variant/template information
  - Add example values
- [ ] **Validate:** Schema accuracy
  - Compare schemas to actual component APIs
  - Flag discrepancies
  - Automate validation in CI
- [ ] **Document:** Schema authoring guide

**Success Criteria:**
- Schemas are comprehensive (props, slots, events, variants)
- Schemas are accurate (validated against components)
- Schemas enable better AI generation

**Complexity:** MEDIUM (3-4 days)  
**Impact:** MEDIUM - better AI tooling

---

### 8.2 Enhanced MCP Tools

**Your Feedback:**
> "Better MCP tools would be great. Layout definitions and Pattern definitions could allow the MCP to build full app views and interactions if used alongside agent skills etc."

**Current MCP Tools (5):**
- query_component
- list_components
- generate_component
- browse_tokens
- validate_usage

**Action Items:**
- [ ] **Add:** `generate_layout` tool
  - Input: App requirements (sidebar, header, etc.)
  - Output: Complete layout HTML
- [ ] **Add:** `generate_flow` tool
  - Input: Flow type (add, edit, delete) + data model
  - Output: Complete flow HTML with pattern
- [ ] **Add:** `compose_advanced_select` tool
  - Input: Select requirements (multi, tree, search)
  - Output: Composed select + menu + checkboxes
- [ ] **Enhance:** `generate_component` to use new pattern definitions
- [ ] **Add:** `validate_composition` tool
  - Input: Component HTML
  - Output: Composition errors (tier violations, missing attributes)
- [ ] **Document:** MCP tool usage examples

**Success Criteria:**
- MCP can generate complete views, not just single components
- Patterns inform generation
- Layouts are auto-generated from requirements
- AI can build full features via MCP

**Complexity:** HIGH (10-12 days)  
**Impact:** VERY HIGH - transforms AI-assisted development

---

## Priority 9: Validation Strategy

### 9.1 HTML5 Validation Enhancement

**Your Feedback:**
> "Again do we use Apex's convoluted validation? I think there's perhaps scope to use HTML validation and some sort of 'bubbling' to propagate validation status up the UI hierarchy if we need to."

**Action Items:**
- [ ] **Research:** HTML5 validation capabilities
  - `:valid` / `:invalid` pseudo-classes
  - `checkValidity()` / `reportValidity()` methods
  - Custom validation messages
  - Form-level validation
- [ ] **Design:** Validation state propagation
  ```
  <sherpa-dialog>
    <form>
      <sherpa-input-text required></sherpa-input-text>
      <sherpa-input-email required></sherpa-input-email>
    </form>
  </sherpa-dialog>
  
  // Dialog knows form is invalid, disables submit
  ```
- [ ] **Implement:** Validation mixin or utility
  - Listen for `invalid` events from child inputs
  - Propagate validation state up component tree
  - Update component states (disable submit buttons, show errors)
- [ ] **Implement:** Enhanced validation messages
  - Custom error message templates
  - Localized error messages
  - Inline vs tooltip vs banner errors
- [ ] **Test:** Complex forms (10+ fields, conditional validation)

**Success Criteria:**
- HTML5 validation is primary strategy
- Validation state bubbles up to containers
- No complex validation framework needed
- Better UX than Apex validation

**Complexity:** MEDIUM (4-5 days)  
**Impact:** MEDIUM - simpler validation, better DX

---

## Priority 10: Overlay Consolidation Investigation

**Your Feedback:**
> "There is some overlap with how Menus, Calendars, Tooltips and Popovers are shown that may be good to consolidate. Less code, more reuse & consistency is a big deal."

### 10.1 Overlay Architecture Audit

**Current Overlay Components:**
- `sherpa-dialog` - Modal dialog
- `sherpa-menu` - Context menu
- `sherpa-popover` - Floating content
- `sherpa-tooltip` - Hover tooltip
- `sherpa-calendar` - Calendar picker

**Common Overlay Features:**
- Positioning (relative to trigger)
- Show/hide logic
- Focus management
- Click-outside to close
- ESC key to close
- Scroll behavior
- Z-index management

**Action Items:**
- [ ] **Audit:** What code is duplicated across overlay components?
- [ ] **Research:** Floating UI library (https://floating-ui.com)
  - Could Sherpa use it for positioning logic?
  - Or build lightweight alternative?
- [ ] **Design:** Shared overlay base class or mixin
  ```javascript
  class OverlayMixin {
    position(trigger, content, placement) {}
    show() {}
    hide() {}
    handleOutsideClick() {}
    handleEscKey() {}
  }
  ```
- [ ] **Prototype:** Refactor 1-2 overlays to use shared code
- [ ] **Evaluate:** Does consolidation help or hurt?

**Success Criteria:**
- Less duplicated positioning/focus logic
- Consistent overlay behavior
- Easier to maintain
- No functionality regressions

**Complexity:** MEDIUM-HIGH (7-10 days)  
**Impact:** MEDIUM - DRY principles, easier maintenance

---

## Phase 2: Investigations

### Investigation 1: Feedback Component Implementation Comparison

**Your Feedback:**
> "It would be good to investigate the implementation differences against sherpa. I think Sherpas simple templates and slots are going to be easier to work with."

**Action Items:**
- [ ] **Compare:** Apex `apx-toast` vs Sherpa `sherpa-toast`
- [ ] **Compare:** Apex `apx-message` vs Sherpa `sherpa-message`
- [ ] **Document:** Implementation differences (Angular vs Web Components)
- [ ] **Document:** API differences (properties, events, slots)
- [ ] **Evaluate:** Is Sherpa simpler? Where can Sherpa improve?
- [ ] **Recommend:** Any features to adopt from Apex?

**Deliverable:** Comparison document with recommendations

**Complexity:** LOW (2-3 days)

---

### Investigation 2: State Persistence Strategy

**Your Feedback:**
> "Intentionally left for consumers of sherpa to handle rather than baking into the UI framework. However we should look at standardising how this can be done across components with HTML templates or JSON sources."

**Action Items:**
- [ ] **Design:** Standard state persistence pattern
  ```javascript
  // Example: Component exposes state as JSON
  const gridState = document.querySelector('sherpa-data-grid').getState();
  localStorage.setItem('grid-state', JSON.stringify(gridState));
  
  // Restore state
  const savedState = JSON.parse(localStorage.getItem('grid-state'));
  document.querySelector('sherpa-data-grid').setState(savedState);
  ```
- [ ] **Implement:** `getState()` / `setState()` for all stateful components
  - Data grid (columns, sort, filters)
  - Tabs (active tab)
  - Accordion (expanded sections)
  - Navigation (collapsed/expanded)
- [ ] **Document:** State persistence guide
- [ ] **Example:** Sample app with state persistence

**Success Criteria:**
- Standard pattern for state persistence
- Consistent API across components
- Consumer-controlled (not baked in)
- JSON-based for portability

**Complexity:** MEDIUM (5-7 days)  
**Impact:** MEDIUM - enables better UX without framework bloat

---

### Investigation 3: Container vs Card Philosophy

**Your Feedback:**
> "A card is just a container with bespoke headers, content and footers for different variants. Sherpas simplification of container types into a common component is actually a plus."
> 
> "Cards are containers. Metrics are content. Sherpa is correct."

**Action Items:**
- [ ] **Document:** Sherpa's container/content philosophy
  - Containers: `sherpa-container`, `sherpa-panel`, `sherpa-dialog`
  - Content: `sherpa-metric`, `sherpa-key-value-list`, `sherpa-list`
- [ ] **Document:** Why this is better than Apex's card variants
- [ ] **Create:** Examples showing container flexibility
  - Same container, different content → different "card" types
- [ ] **Validate:** Does this philosophy hold for all use cases?

**Deliverable:** Architecture decision document

**Complexity:** LOW (1-2 days)

---

### Investigation 4: Export Functionality Scope

**Your Feedback:**
> "Export functionality is excluded from Sherpa for now to focus on visuals and interactions as well as component standards."

**Action Items:**
- [ ] **Decision:** Will Sherpa ever add export?
- [ ] **If yes:** CSV export only (lightweight) or also Excel/PDF?
- [ ] **If yes:** Baked into components or consumer responsibility?
- [ ] **If no:** Document recommended approach for consumers
  - Example code for CSV export from grid data
  - Libraries consumers can use (ExcelJS, jsPDF)
- [ ] **Document:** Export philosophy and recommendations

**Deliverable:** Export strategy document

**Complexity:** LOW (1-2 days discussion + docs)

---

## Implementation Timeline

### Phase 1: Foundation (Weeks 1-4)
- **Week 1-2:** Priority 1 (Component Consolidation)
  - Navigation consolidation investigation
  - Node component reduction
  - Menu simplification investigation
- **Week 3-4:** Priority 2 (Missing Variants)
  - Wizard as dialog variant
  - Master-detail grid variant
  - Advanced select investigation

### Phase 2: Enhancement (Weeks 5-8)
- **Week 5-6:** Priority 5 (Input Enhancement)
  - Input consolidation investigation
  - Form input enhancement
- **Week 7-8:** Priority 6 (Virtual Scrolling)
  - Virtual scrolling infrastructure
  - Apply to 2-3 components

### Phase 3: Major Features (Weeks 9-14)
- **Week 9-11:** Priority 3 (Chart System)
  - Chart audit
  - Architecture improvements
  - Implement 3-4 missing charts
- **Week 12-14:** Priority 4 (Layouts & Patterns)
  - Layout system expansion
  - Pattern paradigm shift

### Phase 4: Modernization (Weeks 15-18)
- **Week 15-16:** Priority 7 (Scheduler)
  - Temporal API integration
  - JSON output format
- **Week 17-18:** Priority 8 (MCP Enhancement)
  - Schema review
  - Enhanced MCP tools

### Phase 5: Polish (Weeks 19-20)
- **Week 19:** Priority 9 (Validation)
  - HTML5 validation enhancement
  - Validation state propagation
- **Week 20:** Priority 10 (Overlay Consolidation)
  - Overlay architecture audit
  - Consolidation investigation

### Phase 6: Investigations (Ongoing)
- Investigation 1-4 can run in parallel with other work
- Completed as time permits

**Total Time: ~20 weeks (5 months)**

---

## Success Metrics

### Component Count Reduction
- **Before:** 78 components
- **Target:** 65-70 components (10-15% reduction through consolidation)

### Feature Parity with Apex
- **Before:** 10 gaps identified
- **Target:** 7+ gaps closed (wizard, master-detail, advanced select, virtual scrolling, more charts)

### Pattern Quality
- **Before:** 13 static HTML patterns
- **Target:** 20+ behavior-driven patterns (presentation + interaction + resolution)

### Chart Coverage
- **Before:** 6 chart types
- **Target:** 11+ chart types (match Apex)

### MCP Capabilities
- **Before:** 5 MCP tools
- **Target:** 10+ MCP tools (layouts, flows, compositions)

### Developer Experience
- **Before:** Manual component assembly
- **Target:** AI-assisted view generation via MCP

---

## Key Principles (Reminders)

1. **Composition over proliferation** - Build from existing components, don't create new ones
2. **Variants over components** - Use `data-template`, `data-variant`, `data-type` attributes
3. **Templates over hard-coding** - Leverage HTML templates and CSS for flexibility
4. **Standards over dependencies** - Use native web APIs, avoid heavy libraries
5. **Patterns as behaviors** - Define interaction paradigms, not just layouts
6. **JSON all the things** - Components should be able to output/input JSON state
7. **Let consumers handle persistence** - Provide APIs, don't bake in localStorage
8. **HTML5 validation first** - Use native validation, enhance where needed
9. **Virtual scroll everywhere** - Make all list-based components handle large datasets
10. **Simplify, consolidate, refine** - Always look for ways to reduce complexity

---

## Next Steps

1. **Review this plan** - Validate priorities and approach
2. **Adjust timeline** - Based on team capacity and business priorities
3. **Start with Priority 1** - Navigation consolidation investigation (proves the approach)
4. **Iterate** - Learn from first consolidation, apply to others
5. **Track progress** - Update this document as work progresses

---

**End of Plan**  
Generated: June 4, 2026  
Last Updated: _[Add date when you update this file]_
