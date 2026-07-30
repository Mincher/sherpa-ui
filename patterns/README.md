# Sherpa UI Patterns

> **Reusable composition templates for common UI layouts and workflows**

Patterns are pre-composed HTML templates that show how to combine Sherpa UI components to solve common design problems. Unlike individual components, patterns demonstrate real-world component composition and provide a starting point for building complete features.

---

## What is a Pattern?

A **pattern** is:
- ✅ A composition of multiple Sherpa components
- ✅ A solution to a common UI/UX problem
- ✅ Copy-paste ready HTML markup
- ✅ A best-practice example of component usage

A pattern is **not**:
- ❌ A component itself (patterns are consumed, not instantiated)
- ❌ Framework-specific (patterns are pure HTML)
- ❌ Executable code (patterns are templates, not scripts)

---

## Pattern Categories

### 🏗️ [Layouts](layouts/) — Application Scaffolding (7 patterns)

Page-level structural patterns for organizing application views.

- **[App Shell](layouts/app-shell.html)** — Full-page layout with nav, header, content, footer
- **[List View](layouts/list-view.html)** — Data table/grid with filters and pagination
- **[Detail View](layouts/detail-view.html)** — Single-item detail page with metadata
- **[View with Rails](layouts/view-with-rails.html)** — Content area with left/right sidebars
- **[Dashboard Grid](layouts/dashboard-grid.html)** — Responsive metric/chart grid
- **[Settings Form](layouts/settings-form.html)** — Configuration form with sections
- **[Flex Truncate](layouts/flex-truncate.html)** — Responsive layout with text truncation

**When to use:** Starting a new view, organizing complex layouts

---

### 🔄 [Flows](flows/) — CRUD Interaction Patterns (3 patterns)

Multi-step workflows for create, read, update, delete operations.

- **[Add Flow](flows/add.html)** — Create new item (form → validation → confirmation)
- **[Edit Flow](flows/edit.html)** — Update existing item (load → modify → save)
- **[Delete Flow](flows/delete.html)** — Remove item (confirm → delete → feedback)

**When to use:** Implementing data management features

---

### 💬 [Feedback](feedback/) — User Communication Patterns (3 patterns)

Patterns for communicating system state to users.

- **[Confirmation Dialog](feedback/confirmation-dialog.html)** — Destructive action confirmation
- **[Empty State](feedback/empty-state.html)** — No data / zero state messaging
- **[Loading State](feedback/loading-state.html)** — Async operation feedback

**When to use:** Providing user feedback and state visualization

---

## How to Use Patterns

### 1. Browse & Select

Find a pattern that matches your use case in the categories above.

### 2. Copy the HTML

```html
<!-- Example: Copy from patterns/layouts/list-view.html -->
<sherpa-layout-grid data-content="static">
  <sherpa-view-header data-label="Users"></sherpa-view-header>
  
  <sherpa-quick-filter-toolbar>
    <!-- Filters -->
  </sherpa-quick-filter-toolbar>
  
  <sherpa-data-grid>
    <!-- Grid configuration -->
  </sherpa-data-grid>
  
  <sherpa-pagination></sherpa-pagination>
</sherpa-layout-grid>
```

### 3. Customize

Modify attributes, add/remove components, adjust content to fit your needs.

### 4. Wire Up Data

Connect to your data sources, add event handlers, integrate with application state.

---

## Pattern vs Component vs Template

| Aspect | Component | Pattern | Template (in components/) |
|--------|-----------|---------|---------------------------|
| **Purpose** | Reusable UI primitive | Composition example | Component internal structure |
| **Location** | `components/sherpa-*/` | `patterns/*/` | Inside `.html` component files |
| **Usage** | `<sherpa-button>` | Copy HTML markup | Cloned by component JS |
| **Customization** | Attributes, slots | Edit HTML directly | Fixed by component definition |
| **Instantiation** | Custom element | Copy-paste | `template.cloneNode()` |

---

## Creating Your Own Patterns

### When to Create a Pattern

Create a pattern when you:
- ✅ Find yourself composing the same components repeatedly
- ✅ Have a well-tested solution to a common problem
- ✅ Want to document best practices for component usage
- ✅ Need to share a design across teams or projects

### Pattern Checklist

- [ ] Uses only Sherpa UI components (no custom elements)
- [ ] Demonstrates real-world composition (not toy example)
- [ ] Includes semantic HTML structure
- [ ] Uses data-* attributes correctly
- [ ] Provides slots for customization
- [ ] Works without JavaScript (progressive enhancement)
- [ ] Includes inline comments explaining key decisions
- [ ] Follows accessibility best practices (ARIA, roles, labels)

### Pattern File Structure

```html
<!--
  Pattern Name
  
  Purpose: [What problem does this solve?]
  When to use: [Specific use cases]
  Accessibility: [Key a11y considerations]
-->

<sherpa-layout-grid data-content="static">
  <!-- Main content -->
  <sherpa-container>
    <!-- Component composition -->
  </sherpa-container>
</sherpa-layout-grid>

<!--
  Customization Notes:
  - [How to adapt this pattern]
  - [What to modify for your use case]
-->
```

---

## Pattern Index

Patterns are cataloged in [`patterns/index.json`](index.json) for programmatic access (used by MCP server, docs site, tooling).

Generated via:
```bash
npm run patterns  # Extracts pattern metadata
```

---

## Resources

- [Component Documentation](../docs/) — Individual component APIs
- [Composition Tier System](../docs/COMPONENT-CATEGORIES.md) — Valid component nesting rules
- [Design Patterns](../docs/sherpa-ui.spec.md) — Architecture and patterns spec
- [MCP Server](../mcp-server/README.md) — AI-assisted pattern usage

---

## Contributing Patterns

1. Create HTML file in appropriate category directory
2. Add descriptive comments (purpose, usage, customization)
3. Test pattern in isolation
4. Run `npm run patterns` to regenerate index
5. Submit PR with pattern + screenshots (optional)

---

**Questions?** See [Sherpa UI Documentation](../docs/) or reach out to the Design System team.
