# Layout Patterns

> **Application scaffolding and page-level structural patterns**

Layout patterns provide the foundational structure for application views. They demonstrate how to organize navigation, content areas, sidebars, headers, and footers using Sherpa UI components.

---

## Patterns in This Category

### [App Shell](app-shell.html)

**Purpose:** Full-page application layout with persistent navigation

**Structure:**
- `<sherpa-app-shell>` — Full-page layout shell (nav + product bar + main content)
- `<sherpa-nav>` — Global navigation sidebar (slot="nav" on app-shell)
- `<sherpa-product-bar-v2>` — Top product bar (slot="product-bar" on app-shell)
- `<sherpa-layout-grid data-content="static" data-fill="viewport">` — Main page content grid in the app shell's default slot
- `<sherpa-view-header slot="view-header">` — Page title and actions inside the layout grid
- `<sherpa-data-grid>`, `<sherpa-panel>`, `<sherpa-container>` — Body content, rails, and cards inside the layout grid

**When to use:**
- Starting a new application
- Creating the base layout for all views
- Need consistent navigation across pages

**Key Features:**
- Responsive navigation (collapsible on mobile)
- Sticky header and nav
- Scrollable content area
- Layout grid header / rails / body composition
- Footer at bottom

---

### [List View](list-view.html)

**Purpose:** Data table/grid with filtering and pagination

**Structure:**
- `<sherpa-view-header>` — Page title and actions
- `<sherpa-filter-bar>` — Search and filter controls
- `<sherpa-data-grid>` — Tabular data display
- `<sherpa-pagination>` — Page navigation

**When to use:**
- Displaying lists of items (users, devices, logs, etc.)
- Need search, filter, sort capabilities
- Large datasets requiring pagination

**Key Features:**
- Global search input
- Filter chips with remove
- Sortable columns
- Row selection
- Bulk actions
- Pagination controls

---

### [Detail View](detail-view.html)

**Purpose:** Single-item detail page with metadata and actions

**Structure:**
- `<sherpa-view-header>` — Item name and actions
- `<sherpa-container-group>` — Grouped information sections
- `<sherpa-key-value-list>` — Metadata display
- `<sherpa-tabs>` — Tabbed sections for complex data

**When to use:**
- Showing details for a single entity
- Read-only information display
- Item detail after selecting from list

**Key Features:**
- Breadcrumb navigation
- Action buttons (Edit, Delete, etc.)
- Grouped information sections
- Tabbed content organization

---

### [View with Rails](view-with-rails.html)

**Purpose:** Content area with left and/or right sidebars

**Structure:**
- Left rail: Navigation or filters
- Center: Primary content
- Right rail: Contextual actions or metadata

**When to use:**
- Complex views needing auxiliary panels
- Contextual navigation alongside content
- Multi-panel dashboards

**Key Features:**
- Flexible rail widths
- Collapsible sidebars
- Responsive (rails collapse on mobile)

---

### [Dashboard Grid](dashboard-grid.html)

**Purpose:** Responsive grid of metrics, charts, and widgets

**Structure:**
- `<sherpa-layout-grid>` — CSS Grid container
- `<sherpa-metric>` — KPI displays
- Chart components — Data visualizations
- `<sherpa-container>` — Widget wrappers

**When to use:**
- Overview/summary pages
- Metrics dashboards
- Analytics views

**Key Features:**
- Responsive grid (auto-flow)
- Drag-to-reorder (via `sherpa-layout-grid`)
- Metric cards with sparklines
- Chart containers

---

### [Settings Form](settings-form.html)

**Purpose:** Configuration form with logical sections

**Structure:**
- `<sherpa-view-header>` — Page title
- `<sherpa-container>` — Form sections
- `<sherpa-input-*>` — Form controls
- `<sherpa-container-footer>` — Save/Cancel buttons

**When to use:**
- User settings pages
- Application configuration
- Preference forms

**Key Features:**
- Sectioned form layout
- Input validation
- Sticky footer with actions
- Form state management

---

### [Flex Truncate](flex-truncate.html)

**Purpose:** Responsive layout with text truncation in flexible containers

**Structure:**
- Flexbox containers with truncation
- Ellipsis for overflow text
- Responsive width adjustments

**When to use:**
- Variable-length text in constrained spaces
- Responsive layouts with text content
- Preventing text overflow

**Key Features:**
- CSS-only truncation
- Responsive behavior
- Tooltip on hover (shows full text)

---

## Usage Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="stylesheet" href="node_modules/sherpa-ui/css/styles/index.css">
</head>
<body>
  <!-- Copy pattern HTML here -->
  <sherpa-app-shell>
    <sherpa-nav slot="nav">...</sherpa-nav>
    <sherpa-product-bar-v2 slot="product-bar" data-product-name="My App"></sherpa-product-bar-v2>
    <sherpa-layout-grid data-content="static" data-fill="viewport" data-pad data-gap="base">
      <sherpa-view-header slot="view-header" data-label="Home"></sherpa-view-header>
      <!-- page content lives in the default slot of sherpa-layout-grid -->
    </sherpa-layout-grid>
  </sherpa-app-shell>

  <script type="module">
    import 'sherpa-ui';
    // Your application code
  </script>
</body>
</html>
```

---

## Composition Guidelines

### Layout Hierarchy

```
Page
└── App Shell
    ├── Navigation (sherpa-nav)
    ├── Header (sherpa-product-bar)
    └── View (sherpa-layout-grid)
        ├── View Header (sherpa-view-header, slot="view-header")
    ├── Left rail (slot="side-panel-start")
    ├── Content (default slot: sherpa-container / sherpa-data-grid / filters)
    ├── Right rail (slot="side-panel-end")
        └── Footer (sherpa-pagination / actions)
```

### Responsive Behavior

Most layout patterns use:
- **Container queries** for component-level responsiveness
- **Flexbox/Grid** for adaptive layouts
- **CSS custom properties** for adjustable spacing

Mobile breakpoints:
- < 768px: Single column, collapsed nav
- 768px - 1024px: Tablet layout, optional sidebars
- > 1024px: Full desktop layout

---

## Accessibility Considerations

- **Landmarks:** Use semantic `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`
- **Skip links:** Provide "Skip to content" for keyboard users
- **Focus management:** Maintain logical tab order
- **ARIA labels:** Label navigation regions (`aria-label="Main navigation"`)
- **Responsive:** Ensure keyboard navigation works on mobile

---

## Customization Tips

1. **Adjust spacing:** Modify `gap`, `padding` on containers
2. **Change layout:** Swap grid for flex, adjust columns
3. **Add sections:** Insert additional containers as needed
4. **Remove elements:** Delete unused components
5. **Theme:** Use `data-theme`, `data-mode` for dark mode

---

## Related Patterns

- [Flows](../flows/) — CRUD workflows to embed in layouts
- [Feedback](../feedback/) — State communication patterns

---

**See also:** [Component Categories](../../docs/COMPONENT-CATEGORIES.md) for valid component nesting rules.
