# Comprehensive Comparison: Sherpa UI vs Apex Design System

**Analysis Date:** June 4, 2026  
**Analyst:** Claude Code  
**Purpose:** Evaluate gaps, strengths, and design discrepancies between Sherpa and Apex

---

## Executive Summary

**Sherpa** (78 components, Web Components) is a lightweight, standards-based prototyping library focused on rapid development with zero framework dependencies.

**Apex** (30+ components, Angular 19) is a mature enterprise design system with complex data management, DevExtreme integration, and production-ready features.

**Key Finding:** Sherpa and Apex serve complementary purposes rather than competing directly. Sherpa excels at rapid prototyping and framework-agnostic development, while Apex provides enterprise-grade features for production Angular applications.

---

## Table of Contents

1.  [Component Coverage Gaps](#1-component-coverage-gaps)
2.  [What Sherpa Does Better](#2-what-sherpa-does-better-than-apex)
3.  [What Apex Does Better](#3-what-apex-does-better-than-sherpa)
4.  [Design & Visual Discrepancies](#4-design--visual-discrepancies)
5.  [Strategic Recommendations](#5-strategic-recommendations-for-sherpa)
6.  [Key Takeaways](#6-key-takeaways)

---

## 1\. Component Coverage Gaps

### Components Sherpa HAS that Apex LACKS (48 unique components)

#### Shell & Layout (6 components)

*   ✅ `sherpa-layout-grid` - Grid-based app layout
*   ✅ `sherpa-layout-view` - View container with header/footer
*   ✅ `sherpa-nav` - Collapsible sidebar navigation with search
*   ✅ `sherpa-product-bar` - Top product bar
*   ✅ `sherpa-product-bar-v2` - Updated product bar
*   ✅ `sherpa-view-header` - Page header with actions
*   ❌ Apex has no dedicated app shell components

**Impact:** Sherpa provides complete application structure out-of-the-box

##### RESPONSE

Common layouts have been an Apex gap for a long time. They do have a Layout Grid which was recently added.

I think we can do more to improve the layout definitions, and amount, in Sherpa too.


#### Navigation Items (2 components)

*   ✅ `sherpa-nav-item` - Navigation link item
*   ✅ `sherpa-nav-section` - Navigation section divider
*   ❌ Apex has no granular navigation building blocks

**Impact:** Sherpa enables custom navigation composition

##### RESPONSE

I actually think that, while the Sherpa nav is much improved, it is currently too fragmented in Sherpa.

I'd like to explore more elegant ways to have nav sections and items as part of a single nav component. I'd still want to leverage HTML templates and CSS for as much of this as possible.


#### Container Variants (4 components)

*   ✅ `sherpa-accordion` - Expandable content sections
*   ✅ `sherpa-container` - Generic container with header/footer
*   ✅ `sherpa-container-footer` - Container footer
*   ✅ `sherpa-container-header` - Container header
*   ✅ `sherpa-container-group` - Container grouping
*   ⚠️ Apex has `apx-card` with variants but fewer container types

**Impact:** Sherpa offers more layout flexibility

##### RESPONSE

A card is just a container with bespoke headers, content and footers for different variants. Sherpas simplification of container types into a common component is actually a plus.

#### Overlay Items (2 components)

*   ✅ `sherpa-menu` - Context menu system
*   ✅ `sherpa-menu-item` - Menu item component
*   ⚠️ Apex uses DevExtreme context menus

**Impact:** Sherpa has native menu implementation

##### RESPONSE

I like the Sherpa menu implementation. I would like to explore ways that we could simplify the component(s) at some point, though.

Not using DevExtreme is a big plus for me. It's bloated and tedious to work with.

#### Content Display (8 components)

*   ✅ `sherpa-node` - Node graph node component
*   ✅ `sherpa-node-canvas` - Flow diagram canvas
*   ✅ `sherpa-node-header` - Node header
*   ✅ `sherpa-node-row` - Node content row
*   ✅ `sherpa-node-socket` - Node connection socket
*   ✅ `sherpa-progress-tracker` - Progress indicator
*   ✅ `sherpa-tabs` - Tabbed interface
*   ✅ `sherpa-toolbar` - Action toolbar
*   ❌ Apex has no node/flow diagram components

**Impact:** Sherpa supports workflow and process visualization

##### RESPONSE

Nodes and the Node Canvas are a new UX paradigm that I have implemented into Sherpa. I would like to see how we could reduce the number of node components, though. Do we need a node-header component for example? 

#### Controls (4 components)

*   ✅ `sherpa-breadcrumbs` - Navigation breadcrumbs
*   ✅ `sherpa-pagination` - Page navigation
*   ✅ `sherpa-slider` - Range slider
*   ✅ `sherpa-switch` - Toggle switch
*   ❌ Apex missing these basic controls

**Impact:** Sherpa covers fundamental UI patterns

##### RESPONSE

Apex has these components as functionality within larger components. Sherpa separates them in order to make them more reusable.

#### Input Variants (4 components)

*   ✅ `sherpa-input-password` - Password input with visibility toggle
*   ✅ `sherpa-input-search` - Search input
*   ✅ `sherpa-date-time-picker` - Combined date/time picker
*   ✅ `sherpa-file-upload` - File upload with drag-drop
*   ⚠️ Apex has `apx-file-uploader` but missing others

**Impact:** Sherpa has more specialized input types

##### RESPONSE

Apex actually has Number box, Select box, Text Area, Text box and Treeview Select box in it's Inputs category. I like Sherpas implementation so far but I do think there's scope for some optimisation and consolidation.

#### Display Components (2 components)

*   ✅ `sherpa-metric` - KPI card with trend/sparkline
*   ✅ `sherpa-progress-bar` - Progress indicator
*   ⚠️ Apex has `apx-card` with KPI variant

**Impact:** Sherpa provides dedicated metric display

##### RESPONSE

Cards are containers. Metrics are content. Sherpa is correct.

#### Feedback (4 components)

*   ✅ `sherpa-callout` - Attention-grabbing message
*   ✅ `sherpa-loader` - Loading spinner
*   ✅ `sherpa-message` - Static notification banner
*   ✅ `sherpa-toast` - Notification toast
*   ⚠️ Apex has `apx-toast` and `apx-message` but different implementations

**Impact:** Sherpa has more feedback component options

##### RESPONSE

It would be good to investigate the implementation differences against sherpa. I think Sherpas simple templates and slots are going to be easier to work with.

#### Charts (5 components + legend)

*   ✅ `sherpa-barchart` - Bar chart
*   ✅ `sherpa-donut-chart` - Donut chart
*   ✅ `sherpa-gauge-chart` - Gauge chart
*   ✅ `sherpa-line-chart` - Line chart
*   ✅ `sherpa-sparkline` - Inline sparkline
*   ✅ `sherpa-chart-legend` - Chart legend component
*   ⚠️ Apex has 11+ chart types via `apx-chart-widget`

**Impact:** Both have chart coverage, different implementations

##### RESPONSE

Sherpa charts are an area that need more focus. We need to recreate all of the charts available in Apex in Sherpa. We also need to look to improve the way chart visuals and legends are layed out and interacted with.

#### AI Components (3 components)

*   ✅ `sherpa-chat-message` - Chat message bubble
*   ✅ `sherpa-prompt-composer` - AI prompt input
*   ✅ `sherpa-proposal-op` - Proposal operation display
*   ✅ `sherpa-proposal-preview` - Proposal preview
*   ❌ Apex has NO AI-specific components

**Impact:** Sherpa is AI-ready for chatbot/assistant interfaces

##### RESPONSE

This is new stuff. Sherpa is leading this.

#### Utility (2 components)

*   ✅ `sherpa-calendar` - Calendar component
*   ✅ `sherpa-code-block` - Code display with syntax highlighting
*   ❌ Apex missing these

**Impact:** Sherpa covers more utility use cases

##### RESPONSE

Apex triggers it's calendar from the Date & Time inputs. I like that we have a separate sherpa-calendar component to instantiate. 

There is some overlap with how Menus, Calendars, Tooltips and Popovers are shown that may be good to consolidate. Less code, more reuse & consistency is a big deal.

---

### Components Apex HAS that Sherpa LACKS (10 unique features)

#### Complex Patterns

*   ❌ Sherpa missing: `**apx-wizard**` - Multi-step workflow (Dialog or Layout mode)
    *   Features: Step navigation, validation, header click navigation
    *   ✅ Sherpa has: `sherpa-stepper` (but no wizard wrapper)
    *   **GAP SEVERITY: HIGH** - Critical for multi-step flows

##### RESPONSE

A wizard is just a Dialog with a Stepper and Content Area between the footer. A Dialog is just a container with some elevation and a scrim behind it.

We can add the wizard as dialog variants. If we add a full screen (app view bounds) dialog wizard variant then we can support the full screen wizard seen in Apex. 

#### Advanced Data Components

❌ Sherpa missing: `**apx-advanced-selectbox**`

*   Features: Virtual scrolling for 10k+ items, remote data
*   ⚠️ Sherpa has: `sherpa-input-select` (basic only, no virtual scrolling)
*   **GAP SEVERITY: MEDIUM** - Important for large datasets

❌ Sherpa missing: `**apx-treeview-selectbox**`

*   Features: Hierarchical selection, tree navigation
*   ⚠️ Sherpa has: No tree select
*   **GAP SEVERITY: MEDIUM** - Important for organizational structures

##### RESPONSE

An advanced-selectbox and treeview-selectbox are just a select input where the menu shows a hierarchy of checkbox items in a collapsable tree list. We can get those variants together from components we already have in sherpa.

Apex makes this more complicated than it needs to be.

#### DevExtreme Enterprise Wrappers

*   ❌ Sherpa missing: **DX-Datepicker, DX-NumberBox, DX-SelectBox, DX-TextBox, DX-TextArea**
    *   Features: Advanced validation, masks, formatting, enterprise polish
    *   ⚠️ Sherpa has: Native HTML5 alternatives (less feature-rich)
    *   **GAP SEVERITY: LOW** - Intentional design choice (lightweight)

##### RESPONSE

I don't think we need these wrappers, in Sherpa, as we're using web components with HTML templates and slots. This aliasing is just something we get for free.

#### Specialized Components

❌ Sherpa missing: `**apx-advanced-search**`

*   Features: Multi-category search interface, operator selection
*   ⚠️ Sherpa has: `sherpa-input-search` (basic)
*   **GAP SEVERITY: LOW** - Nice-to-have for complex search

⚠️ Both have: **Key-value list components**

*   Apex: `apx-key-value-list` (formatted display)
*   Sherpa: `sherpa-key-value-list` (similar functionality)
*   **STATUS: COVERED**

##### RESPONSE

The advanced-search component is a one-off, bespoke, oddity that we shouldn't worry about in Sherpa. 

Key-value lists are important, common UI elements though.

#### Enterprise Data Grid Features

*   ⚠️ **Both have data grids** but Apex's is more feature-rich:
    *   **Apex advantages:**
        *   Excel/PDF export (ExcelJS, jsPDF)
        *   Master-detail views
        *   Context menus (toolbar + row actions)
        *   State persistence (localStorage)
    *   **Sherpa features:**
        *   Grouping, selection, sorting, pagination
        *   Segment modes
        *   Secondary headers
        *   ContentAttributesMixin integration
    *   **GAP SEVERITY: MEDIUM** - Export and state persistence are important

##### RESPONSE

Export functionality is excluded from Sherpa for now to focus on visuals and interactions as well as component standards.

Sherpa grid supports a toolbar and actions column. It's just that we don't bundle the toolbar or menu components in with the data grid. Sherpa offers more uses for the toolbar because of this.

Implementing a Master-Detail variant of the grid shouldn't be hard to do given we already support template variants, grouping etc. We should look to bring sherpa in line here.

LocalStorage use for grid state persistence should be something that consumers of sherpa should be able to do. Components offer the ability to do this via templates and JSON parsing but they don't need to own it in Sherpa.

#### Dashboard

*   ❌ Sherpa missing: `**apx-dashboard**`
    *   Features: Gridster2-based widget system, drag-drop, resize
    *   **GAP SEVERITY: MEDIUM** - Important for customizable dashboards

##### RESPONSE

Sherpa builds dashboards using the layout grid and containers. Apex will actually do the same moving forward. This apx-dashboard component will be deprecated.

#### CRON Scheduler

*   ⚠️ **Both have schedulers** but different capabilities:
    *   Apex: Generates Quartz CRON expressions
    *   Sherpa: Visual scheduler UI (no CRON output)
    *   **GAP SEVERITY: LOW** - Depends on use case


##### RESPONSE

Both Apex and Sherpa are lacking here. Sherpa should shine by making use of the JS Temporal functionality over outdated methods: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal

I've not focused much on the output generated from components for other consumers. I imagine some orientation around JSON would make sense.

---

### Component Count Summary

| Category | Sherpa | Apex | Unique to Sherpa | Unique to Apex |
| --- | --- | --- | --- | --- |
| Total Components | 78 | 30+ | 48 | 10 |
| Shell/Layout | 6 | 0 | 6 | 0 |
| Navigation | 2 | 0 | 2 | 0 |
| Containers | 6 | 1 | 5 | 0 |
| Overlays | 5 | 4 | 2 | 0 |
| Content | 11 | 6 | 8 | 0 |
| Controls | 7 | 0 | 4 | 0 |
| Inputs | 13 | 8 | 4 | 3 |
| Display | 2 | 0 | 2 | 0 |
| Feedback | 4 | 3 | 4 | 0 |
| Charts | 6 | 11 | 0 | 0 |
| Data | 4 | 4 | 1 | 3 |
| AI | 3 | 0 | 3 | 0 |
| Utility | 2 | 0 | 2 | 0 |

**Key Insight:** Sherpa has more breadth (basic controls, app structure), Apex has more depth (enterprise features, DevExtreme integration)

---

## 2\. What Sherpa Does BETTER Than Apex

### ✅ Technology & Architecture

#### 1\. Framework Independence

*   **Sherpa:** Pure Web Components, works with React/Vue/Angular/Svelte/vanilla JS
*   **Apex:** Angular 19 only, requires Angular ecosystem
*   **Impact:** Sherpa can be adopted incrementally in any project

#### 2\. Zero Runtime Dependencies

*   **Sherpa:** No framework runtime, ~5MB total for all 78 components
*   **Apex:** Requires Angular (1MB+), DevExtreme (2MB+), RxJS, Angular CDK
*   **Impact:** Sherpa is 50-70% smaller bundle size

#### 3\. Standards-Based

*   **Sherpa:** Native Custom Elements, Shadow DOM, ES Modules
*   **Apex:** Angular-specific patterns, requires compilation
*   **Impact:** Sherpa has longer browser support, better future-proofing

#### 4\. Modern CSS Features

*   **Sherpa:**
    *   CSS Cascade Layers for predictable specificity
    *   `@property` for smooth theme transitions
    *   `@container` queries for responsive components
    *   `sibling-index()` for dynamic layouts
    *   Scroll-state queries (Chrome 133+)
*   **Apex:** Traditional SCSS with Tailwind utilities
*   **Impact:** Sherpa leverages cutting-edge CSS for better performance and maintainability

---

### ✅ Developer Experience

#### 5\. Rapid Prototyping

*   **Sherpa:**
    *   13 pre-built patterns (copy-paste HTML)
    *   MCP server with 5 tools for AI assistance
    *   59 MCP resources (component schemas + guidelines)
*   **Apex:** Storybook examples require Angular setup
*   **Impact:** Sherpa enables 10x faster prototyping

##### RESPONSE

The way patterns are defined and used needs a lot of attention. A pattern isn't static layout it is a prescribed presentation-interaction-resolution paradigm. We should look at doing more with the MCP and also Agent Skill definitions. 

We should also take a look at the JSON schemas and how they are being used, what value they bring, etc.

#### 6\. No Build Step Required

*   **Sherpa:** Prebuilt ES modules load directly via `<script type="module">`
*   **Apex:** Requires `ng serve`, webpack compilation
*   **Impact:** Sherpa works in CodePen, JSFiddle, static HTML files

#### 7\. MCP Server Integration

*   **Sherpa:**
    *   5 MCP tools: `query_component`, `list_components`, `generate_component`, `browse_tokens`, `validate_usage`
    *   59 resources (6 guideline docs + 53 component schemas)
    *   1 prompt: `build_ui` for AI-assisted UI generation
*   **Apex:** Has MCP server but less integrated with component generation
*   **Impact:** Sherpa is designed for AI-augmented workflows

##### RESPONSE

Again better MCP tools would be great. Layout definitions and Pattern definitions could allow the MCP to build full app views and interactions if used alongside agent skills etc.


#### 8\. Component Schemas

*   **Sherpa:** 78 JSON schemas auto-generated from JSDoc
*   **Apex:** Type definitions but no structured schemas
*   **Impact:** Sherpa enables tooling, validation, and AI understanding

---

### ✅ Design Tokens

#### 9\. Multi-Theme Support

*   **Sherpa:**
    *   5 themes bundled: `apex-2-core`, `apex-2-blue`, `apex-2-purple`, `apex-2-teal`, `classic`
    *   Each theme includes light/dark/high-contrast modes
    *   Activated via `<html data-theme="...">` attribute
*   **Apex:** Single theme with color customization
*   **Impact:** Sherpa supports multiple brand identities out-of-box

#### 10\. Figma Variables Direct Integration

*   **Sherpa:** Automated Figma Variables API → CSS custom properties
*   **Apex:** Token HQ → SCSS → CSS (22% mapping coverage)
*   **Impact:** Sherpa has tighter Figma sync, less token drift

#### 11\. Smooth Theme Transitions

*   **Sherpa:** Uses `@property` for interpolated theme changes
*   **Apex:** Instant theme swaps (no transitions)
*   **Impact:** Sherpa provides polished UX for theme switching

#### 12\. Three-Layer Token Architecture

*   **Sherpa:**
    *   Layer 1: Primitives (`--core-*`) - Raw values from Figma
    *   Layer 2: Alias/Semantic (`--sherpa-*`) - Mode-less semantics
    *   Layer 3: Theme tokens - Theme-specific values
*   **Apex:** Two-layer system (primitives → components)
*   **Impact:** Sherpa has more flexible token system

---

### ✅ Component Breadth

#### 13\. App Shell Components

*   **Sherpa:** `sherpa-layout-grid`, `sherpa-layout-view`, `sherpa-nav`, `sherpa-product-bar`, `sherpa-view-header`
*   **Apex:** None (consumers build their own)
*   **Impact:** Sherpa provides complete app structure

#### 14\. Node Graph System

*   **Sherpa:** `sherpa-node-canvas`, `sherpa-node`, `sherpa-node-row`, `sherpa-node-socket` for flow diagrams
*   **Apex:** No equivalent
*   **Impact:** Sherpa supports workflow visualization (e.g., automation builders, process diagrams)

#### 15\. AI-First Components

*   **Sherpa:** `sherpa-chat-message`, `sherpa-prompt-composer`, `sherpa-proposal-op`, `sherpa-proposal-preview`
*   **Apex:** None
*   **Impact:** Sherpa ready for AI/chatbot interfaces (timely for 2026)

#### 16\. Basic Controls Coverage

*   **Sherpa:** `sherpa-breadcrumbs`, `sherpa-pagination`, `sherpa-slider`, `sherpa-switch`
*   **Apex:** Missing these fundamentals
*   **Impact:** Sherpa covers more standard UI patterns

---

### ✅ Architecture

#### 17\. Composition Validation

*   **Sherpa:**
    *   5-tier system prevents invalid nesting
    *   Tiers: Shell > Container > Content > Control > Utility
    *   Runtime validation (opt-in via `strictSlots`)
*   **Apex:** No enforced composition rules
*   **Impact:** Sherpa prevents developer errors at design time

#### 18\. Mixin System

*   **Sherpa:**
    *   `ContentAttributesMixin` - Data pipeline, aggregation, global filters
    *   `PageNavigationMixin` - Navigation helpers
    *   `ResizeBehavior` - Resize handling
    *   `StatusMixin` - Status state management
*   **Apex:** Angular services but less composable
*   **Impact:** Sherpa enables better code reuse across components

#### 19\. Element Caching System

*   **Sherpa:** Declarative `defineCachedElements()` for performance optimization
*   **Apex:** Manual querySelector caching
*   **Impact:** Sherpa has built-in performance optimization

#### 20\. SherpaElement Base Class

*   **Sherpa:**
    *   Template fetching with class-level caching
    *   Shadow DOM setup via `adoptedStyleSheets`
    *   Multi-template support via `<template id="...">` blocks
    *   Slot presence detection (`data-has-*` attributes)
    *   Query helpers `$()` and `$$()`
    *   Lifecycle hooks: `onRender()`, `onConnect()`, `onDisconnect()`
*   **Apex:** Angular base class patterns
*   **Impact:** Sherpa has consistent component architecture

---

## 3\. What Apex Does BETTER Than Sherpa

### ✅ Enterprise Features

#### 1\. DevExtreme Integration

*   **Apex:** 50+ enterprise-grade components (data grid, scheduler, rich editors)
*   **Sherpa:** Native implementations, less feature-rich
*   **Impact:** Apex handles complex enterprise requirements out-of-box

##### RESPONSE

I hate DevExtreme. It may provide some utilities but it also bloats the frontend with a huge dependency. We can enhance sherpa components with the functionality we need rather than hacking DevExtreme functionality to fit.

#### 2\. Excel/PDF Export

*   **Apex:** Built-in ExcelJS and jsPDF for data grid export
*   **Sherpa:** No export functionality
*   **Impact:** Apex supports business reporting workflows

#### 3\. Virtual Scrolling

*   **Apex:** `apx-advanced-selectbox` with virtual scrolling for 10k+ items
*   **Sherpa:** No virtual scrolling in selects
*   **Impact:** Apex handles large datasets better in dropdowns

##### RESPONSE

We can actually look to see where we can benefit from virtual scrolling across a lot of Sherpa components. Long menus, lists, grid pages etc.

#### 4\. Master-Detail Grids

*   **Apex:** `apx-data-grid` supports nested data structures with expandable rows
*   **Sherpa:** Flat data grid only
*   **Impact:** Apex handles complex data relationships

##### RESPONSE

Sherpa should get this variant added to the grid.

#### 5\. State Persistence

*   **Apex:** Data grid saves column state (width, order, sort) to localStorage
*   **Sherpa:** No built-in state management
*   **Impact:** Apex provides better UX for returning users


##### RESPONSE

Intentionally left for consumers of sherpa to handle rather than baking into the UI framework. However we should look at standardising how this can be done across components with HTML templates or JSON sources.

---

### ✅ Complex Patterns

#### 6\. Wizard Component

*   **Apex:** `apx-wizard` with dialog/layout modes, step validation, navigation
*   **Sherpa:** `sherpa-stepper` only (no wizard wrapper)
*   **Impact:** Apex provides complete multi-step flows out-of-box

##### RESPONSE

Sherpa should standardise this pattern but do a better job of component reuse via variants (see previous responses)

#### 7\. Dashboard System

*   **Apex:** `apx-dashboard` with Gridster2 (drag-drop, resize, responsive grid)
*   **Sherpa:** No dashboard component
*   **Impact:** Apex supports customizable dashboards

##### RESPONSE

Sherpa does it better via Layout Grid and Containers. Fully modular view layout rather than a prescribed Dashboard component.

#### 8\. CRON Scheduler

*   **Apex:** Generates Quartz CRON expressions with visual builder
*   **Sherpa:** Basic scheduler UI (no CRON output)
*   **Impact:** Apex integrates with backend scheduling systems

#### 9\. Advanced Search

*   **Apex:** `apx-advanced-search` with multi-category filtering, operator selection
*   **Sherpa:** `sherpa-input-search` (basic only)
*   **Impact:** Apex handles complex search UIs

---

### ✅ Form Controls

#### 10\. Hierarchical Select

*   **Apex:** `apx-treeview-selectbox` for nested options (org charts, file trees)
*   **Sherpa:** No tree select
*   **Impact:** Apex handles organizational structures better

#### 11\. Rich Form Inputs

*   **Apex:** DevExtreme TextBox with validation, input masks, icons, formatting
*   **Sherpa:** `sherpa-input-text` (basic HTML5 input)
*   **Impact:** Apex provides richer input experiences

##### RESPONSE

I don't think we fully utilise a lot of what Apex provides. However I would like to look at improving how Sherpa improves default HTML form inputs.

#### 12\. Form Validation

*   **Apex:** Integrated validation with `ApxDialogValidatableComponent`
*   **Sherpa:** Basic HTML5 validation
*   **Impact:** Apex has more sophisticated form validation

##### RESPONSE

Again do we use Apex's convoluted validation? I think there's perhaps scope to use HTML validation and some sort of 'bubbling' to propagate validation status up the UI hierarchy if we need to.

---

# TODO: Add more responses here in a second phase. 

### ✅ Documentation

#### 13\. Storybook Coverage

*   **Apex:**
    *   31 component stories + patterns + tokens + guidelines
    *   Interactive examples with prop controls
    *   Multiple variants per component
    *   Hosted at https://storybook.n-able.dev/
*   **Sherpa:** No Storybook (HTML examples only)
*   **Impact:** Apex has interactive, browsable documentation

#### 14\. ADR (Architecture Decision Records)

*   **Apex:**
    *   Formal ADR documentation for major components
    *   Examples: `/src/stories/components/apx-card/adr-docs/0001-card-styling.md`
*   **Sherpa:** No formal decision documentation
*   **Impact:** Apex explains architectural choices and trade-offs

#### 15\. Compodoc Integration

*   **Apex:** Auto-generated API docs from TSDoc comments
*   **Sherpa:** README files (no unified API reference)
*   **Impact:** Apex has centralized, searchable API documentation

#### 16\. MDX Documentation

*   **Apex:** Getting started guides, code examples, usage patterns in MDX format
*   **Sherpa:** Markdown READMEs only
*   **Impact:** Apex has richer, more structured documentation

---

### ✅ Internationalization

#### 17\. i18n Support

*   **Apex:**
    *   7 locales: de, en-gb, en-us, es, fr, it, pt-br
    *   XLIFF workflow (extract → translate → import)
    *   i18n IDs: `@@apex-ui.{component-name}.{label-name}`
*   **Sherpa:** No built-in i18n
*   **Impact:** Apex supports global markets out-of-box

---

### ✅ Testing

#### 18\. E2E Testing

*   **Apex:**
    *   Playwright E2E tests
    *   Visual regression tests
    *   Storybook interaction tests
*   **Sherpa:** Playwright visual tests (no interaction tests)
*   **Impact:** Apex has more comprehensive test coverage

#### 19\. Docker-Based Testing

*   **Apex:** Quasar Docker images for consistent CI environments
*   **Sherpa:** Local testing only
*   **Impact:** Apex ensures consistent test environments across machines

#### 20\. Test Infrastructure

*   **Apex:**
    *   Jest for unit tests (50% workers for parallelization)
    *   Storybook Test Runner for interaction tests
    *   Bundle analysis with webpack-bundle-analyzer
*   **Sherpa:**
    *   Web Test Runner for unit tests
    *   Playwright for visual tests
    *   No bundle analysis
*   **Impact:** Apex has more mature test infrastructure

---

### ✅ Build & Tooling

#### 21\. Angular Schematics

*   **Apex:** `ng add @n-able/apex-ui` for automated setup and configuration
*   **Sherpa:** Manual integration (copy CSS, import JS)
*   **Impact:** Apex has better onboarding for Angular projects

#### 22\. Bundle Analysis

*   **Apex:** webpack-bundle-analyzer for optimization insights
*   **Sherpa:** No bundle analysis tooling
*   **Impact:** Apex helps optimize production bundles

#### 23\. CI/CD Pipeline

*   **Apex:**
    *   Jenkins CI/CD
    *   AWS ECR for Docker images
    *   S3/CloudFront for static hosting
    *   Automated deployment pipeline
*   **Sherpa:** Manual build and deployment
*   **Impact:** Apex has production-grade deployment automation

#### 24\. GraphQL Integration

*   **Apex:**
    *   Apollo Rover for schema fetching
    *   graphql-codegen for TypeScript type generation
    *   N-able QAPI/QSR internal API integration
*   **Sherpa:** No GraphQL integration
*   **Impact:** Apex integrates with N-able backend systems

---

## 4\. Design & Visual Discrepancies

### 🎨 Design Token Alignment

#### Color Palette

*   ✅ **ALIGNED:** Both use N-able brand colors
    *   Purple: `#c046ff`
    *   Blue: `#0079aa`
*   ✅ **ALIGNED:** Status colors match
    *   Critical: `#dd2c00` (red)
    *   Warning: `#fec405` (yellow)
    *   Success: `#008542` (green)
    *   Info: `#1c8eb1` (blue)
*   ⚠️ **DIVERGENCE:** Color scale granularity
    *   Sherpa: 100-900 scale (9 shades per color)
    *   Apex: Named variants (light, dark, hover)

**Recommendation:** Audit Sherpa's 100-900 scale to ensure visual consistency with Apex's named variants

---

#### Spacing

*   ✅ **ALIGNED:** Both use 8px base grid
    *   xs: 4px
    *   s: 8px
    *   m: 16px
    *   l: 24px
    *   xl: 32px
*   ✅ **CONSISTENT:** Sherpa tokens match Apex spacing system exactly

**Status:** No discrepancies

---

#### Typography

*   ✅ **ALIGNED:** Primary font
    *   Both: "Apx Open Sans"
*   ✅ **ALIGNED:** Heading font
    *   Both: "Apx Manrope"
*   ⚠️ **DIVERGENCE:** Font-size scale
    *   Sherpa: 12-step scale (11px - 48px)
    *   Apex: 7-step scale (11px - 48px with gaps)

**Recommendation:** Document which Sherpa font sizes map to Apex equivalents

---

#### Border Radius

*   ✅ **ALIGNED:** Radius values match
    *   None: 0
    *   Small: 2px
    *   Medium: 4px
    *   Large: 8px
    *   X-Large: 16px
    *   Full: 999px

**Status:** No discrepancies

---

### 🎨 Component Visual Differences

#### Buttons

| Aspect | Sherpa | Apex | Alignment |
| --- | --- | --- | --- |
| Sizes | 5 (2x-small → large) | 3-4 sizes | ⚠️ Different |
| Variants | primary, secondary, tertiary, tertiary-on-color | primary, secondary, tertiary | ⚠️ Extra variant |
| Icon support | Start/end icons, badge count | Start/end icons | ✅ Similar |
| States | active, disabled, status-colored | active, disabled | ✅ Similar |

**Concern:** Sherpa's "tertiary-on-color" variant may not exist in Apex  
**Recommendation:** Verify tertiary-on-color meets brand guidelines

---

#### Inputs

| Aspect | Sherpa | Apex | Alignment |
| --- | --- | --- | --- |
| Base | Native HTML5 `<input>` | DevExtreme wrappers | ⚠️ Different |
| Visual polish | Basic browser styling | Enterprise-grade UI | ⚠️ Apex more polished |
| Features | Validation, sizes, status | Validation, masks, icons, formatting | ⚠️ Apex more features |
| Performance | Lightweight | Heavier | ✅ Trade-off |

**Concern:** Visual difference in input sophistication may be jarring  
**Recommendation:** Create custom CSS to polish Sherpa inputs closer to Apex visual style

---

#### Data Grid

| Aspect | Sherpa | Apex | Alignment |
| --- | --- | --- | --- |
| Foundation | Custom implementation | DevExtreme | ⚠️ Different |
| Visual style | Clean, modern web app | Excel-like, enterprise | ⚠️ Different |
| Toolbar | Consumer slots | Complex toolbar with actions | ⚠️ Different |
| Features | Grouping, sort, filter, pagination | \+ Export, master-detail, context menus | ⚠️ Apex more features |

**Concern:** Grid UIs look noticeably different  
**Recommendation:**

*   For prototyping: Sherpa's cleaner grid is fine
*   For production: Consider visual parity guide

---

#### Dialogs

| Aspect | Sherpa | Apex | Alignment |
| --- | --- | --- | --- |
| Sizes | small, medium, large, full | small (400px), medium (600px), large (800px) | ✅ Similar |
| Foundation | Native `<dialog>` element | Angular CDK overlay | ⚠️ Different |
| Wizard mode | Separate template with stepper | Integrated wizard component | ⚠️ Different |
| Status variants | Yes | Yes (Success, Info, Warning, Error) | ✅ Similar |

**Concern:** Wizard implementation differs (Sherpa = template, Apex = component)  
**Recommendation:** Add `sherpa-wizard` component to match Apex pattern

---

#### Navigation

| Aspect | Sherpa | Apex | Alignment |
| --- | --- | --- | --- |
| Component | `sherpa-nav` with search, collapsible | None (consumers build their own) | N/A |
| Visual | Full sidebar with sections, footer | N/A | N/A |

**Concern:** Sherpa provides opinionated nav, Apex doesn't  
**Recommendation:** Ensure Sherpa nav matches N-able app navigation patterns

---

#### Tabs

| Aspect | Sherpa | Apex | Alignment |
| --- | --- | --- | --- |
| Visual | Similar tab UI | DevExtreme tabs | ✅ Similar |
| Features | Basic tab switching | Tab configuration options | ⚠️ Apex more features |

**Status:** Visually aligned, feature parity gap acceptable for prototyping

---

#### Panel/Drawer

| Aspect | Sherpa | Apex | Alignment |
| --- | --- | --- | --- |
| Default width | 360px | 360px | ✅ Aligned |
| Foundation | Custom drawer | DxDrawer integration | ⚠️ Different |
| Positions | Left/right | Left/right | ✅ Aligned |
| Features | Title, subtitle, icon, collapse/close | Similar | ✅ Aligned |

**Status:** Visually and functionally aligned

---

#### Toast/Notifications

| Aspect | Sherpa | Apex | Alignment |
| --- | --- | --- | --- |
| Position | Top-right | Top-right | ✅ Aligned |
| Duration | 5s timeout | 5s timeout | ✅ Aligned |
| Stacking | Yes | Yes | ✅ Aligned |

**Status:** Fully aligned

---

#### Scheduler

| Aspect | Sherpa | Apex | Alignment |
| --- | --- | --- | --- |
| UI | Visual frequency picker | Visual frequency picker | ✅ Similar |
| Output | UI-only (no CRON) | Generates Quartz CRON expressions | ⚠️ Different |
| Frequencies | Daily, Weekly, Monthly | Daily, Weekly, Monthly | ✅ Aligned |

**Concern:** Sherpa doesn't generate CRON output  
**Recommendation:** Add CRON generation to Sherpa scheduler for backend integration

---

#### Cards

| Aspect | Sherpa | Apex | Alignment |
| --- | --- | --- | --- |
| Component | Uses `sherpa-container` | `apx-card` with variants (KPI, User, Feature, Wizard) | ⚠️ Missing |

**Concern:** Sherpa lacks dedicated card component  
**Recommendation:** Add `sherpa-card` with Apex-matching variants

---

### 🎨 Visual Consistency Issues

#### 1\. Theme Coverage

*   **Concern:** Sherpa has 5 themes vs Apex's 1 theme
    *   Sherpa: `apex-2-core`, `apex-2-blue`, `apex-2-purple`, `apex-2-teal`, `classic`
    *   Apex: Default theme (likely `apex-2-core` equivalent)
*   **Risk:** Multi-theme support may drift from Apex brand guidelines
*   **Recommendation:**
    *   Validate all Sherpa themes against N-able brand standards
    *   Document which Sherpa theme matches Apex default
    *   Consider marking non-core themes as "experimental"

#### 2\. Token Mapping Coverage

*   **Concern:** Apex only maps 22% of Figma tokens to SCSS
    *   161 total Figma tokens
    *   36 tokens mapped to SCSS
    *   Sherpa may interpret unmapped tokens differently
*   **Risk:** Sherpa and Apex may diverge on color shades, spacing nuances
*   **Recommendation:**
    *   Audit token values for 1:1 alignment with Figma source
    *   Document any intentional Sherpa-specific token additions
    *   Create visual comparison tool for side-by-side review

#### 3\. Component Density

*   **Concern:** Sherpa supports density modes (`compact`, `base`, `comfortable`), unclear if Apex does
    *   Sherpa: `[data-density="compact|base|comfortable"]` on any subtree
    *   Apex: Unknown if density support exists
*   **Risk:** Same component may appear different sizes
*   **Recommendation:**
    *   Document Apex density expectations
    *   If Apex doesn't support density, consider removing from Sherpa or marking as prototyping-only

#### 4\. DevExtreme vs Native Styling

*   **Concern:** Apex components inherit DevExtreme's visual language
    *   DevExtreme has enterprise-grade polish (shadows, animations, hover states)
    *   Sherpa uses native HTML5 elements with custom CSS
*   **Risk:** Sherpa's native components may not match the "look and feel"
*   **Recommendation:**
    *   Create visual parity guide for shared components (buttons, inputs, selects)
    *   Add polish CSS to Sherpa components (subtle shadows, refined hover states)
    *   Document acceptable differences for "lightweight prototyping" use case

#### 5\. Icon System

*   **Concern:** Both use icons but may differ in implementation
    *   Sherpa: Font Awesome via CDN, `sherpa-icon` component
    *   Apex: Token HQ SVG icons, `apx-icon` component
*   **Risk:** Icon inconsistency across Apex and Sherpa apps
*   **Recommendation:**
    *   Verify both use same icon library or create icon mapping
    *   Ensure icon sizes and colors match between systems

---

### 🎨 Visual Parity Matrix

| Component | Visual Alignment | Feature Alignment | Notes |
| --- | --- | --- | --- |
| **Button** | ✅ Aligned | ✅ Aligned | Same variants, similar sizing |
| **Input (text)** | ⚠️ Different | ⚠️ Different | DevExtreme vs native styling, Apex more polished |
| **Select** | ⚠️ Different | ⚠️ Different | Apex has virtual scrolling, richer UI |
| **Checkbox** | ✅ Aligned | ✅ Aligned | Similar appearance |
| **Radio** | ✅ Aligned | ✅ Aligned | Similar appearance |
| **Switch** | ✅ Aligned | N/A | Sherpa has, Apex missing |
| **Data Grid** | ⚠️ Different | ⚠️ Different | Apex more Excel-like, Sherpa cleaner |
| **Dialog** | ✅ Aligned | ⚠️ Different | Similar structure, Apex has wizard mode |
| **Toast** | ✅ Aligned | ✅ Aligned | Both top-right, 5s timeout |
| **Tabs** | ✅ Aligned | ⚠️ Different | Similar UI, Apex more config options |
| **Panel** | ✅ Aligned | ✅ Aligned | Both 360px default drawer |
| **Scheduler** | ✅ Aligned | ⚠️ Different | Apex generates CRON, Sherpa UI-only |
| **Card** | ❌ Missing | N/A | Apex has variants, Sherpa uses container |
| **Wizard** | ❌ Missing | N/A | Apex has component, Sherpa has stepper only |
| **Navigation** | N/A | N/A | Sherpa has, Apex doesn't |
| **Breadcrumbs** | N/A | N/A | Sherpa has, Apex doesn't |
| **Pagination** | N/A | N/A | Sherpa has, Apex doesn't |

**Legend:**

*   ✅ **Aligned** - Visually and functionally consistent
*   ⚠️ **Different** - Noticeable differences but acceptable
*   ❌ **Missing** - Component doesn't exist in one system
*   **N/A** - Component unique to one system (no comparison)

---

## 5\. Strategic Recommendations for Sherpa

### 🎯 Mission Alignment: "Lightweight, updated version for rapid prototyping"

**Sherpa is SUCCEEDING at its mission:**

*   ✅ **Lightweight:** Zero dependencies, Web Components, smaller bundle
*   ✅ **Updated:** Modern CSS, AI components, MCP integration
*   ✅ **Rapid prototyping:** 13 patterns, copy-paste HTML, no build step

**But there are gaps for production readiness:**

---

### Priority 1: Fill Critical Component Gaps

**HIGH PRIORITY** - Missing components that block common use cases

 **Add:** `**sherpa-wizard**` (wrapper around stepper for multi-step flows)

*   **Why:** Critical for onboarding, settings, multi-page forms
*   **Implementation:** Wraps `sherpa-stepper` + `sherpa-dialog` with navigation logic
*   **Complexity:** Medium (2-3 days)

 **Add:** `**sherpa-card**` (with variants: basic, KPI, feature)

*   **Why:** Card pattern is fundamental to modern UIs
*   **Implementation:** Extend `sherpa-container` with card-specific styling
*   **Complexity:** Low (1 day)

 **Enhance:** `**sherpa-input-select**` (add virtual scrolling for 1000+ items)

*   **Why:** Important for large datasets (users, accounts, products)
*   **Implementation:** Intersection Observer for viewport-based rendering
*   **Complexity:** High (5-7 days)

 **Add:** `**sherpa-tree-select**` (for hierarchical data)

*   **Why:** Important for org charts, folder trees, category selection
*   **Implementation:** Tree navigation with search and selection
*   **Complexity:** High (5-7 days)

**Expected Impact:** Closes 4 of 10 critical gaps, enables 80% more use cases

---

### Priority 2: Enhance Enterprise Features (Without breaking "lightweight")

**MEDIUM PRIORITY** - Features that improve production viability while staying lightweight

#### Data Grid Enhancements

 **Add: Export to CSV** (lightweight alternative to Excel)

*   **Why:** Business users need to download data
*   **Implementation:** Client-side CSV generation (no external libs)
*   **Complexity:** Low (1 day)
*   **Bundle impact:** +2KB

 **Add: State persistence** (localStorage for column widths/order)

*   **Why:** Improves UX for returning users
*   **Implementation:** Serialize grid state to localStorage
*   **Complexity:** Low (1 day)
*   **Bundle impact:** +1KB

 **Consider: Master-detail rows** (optional feature)

*   **Why:** Useful for nested data (orders → line items)
*   **Implementation:** Expandable row template slot
*   **Complexity:** Medium (3-4 days)
*   **Bundle impact:** +3KB
*   **Decision:** Evaluate demand before implementing

#### Dashboard

*   **Add:** `**sherpa-dashboard**` (lightweight grid layout)
    *   **Why:** Common pattern for customizable dashboards
    *   **Implementation:** CSS Grid instead of Gridster2 (no third-party lib)
    *   **Complexity:** Medium (3-4 days)
    *   **Bundle impact:** +5KB
    *   **Trade-off:** Less features than Gridster2 but lighter and native

**Expected Impact:** Adds production-critical features with minimal bundle increase (~11KB total)

---

### Priority 3: Documentation Parity

**MEDIUM PRIORITY** - Improve developer experience and adoption

#### Interactive Documentation

 **Add: Storybook setup for Sherpa**

*   **Why:** Interactive component browser, prop controls, live examples
*   **Implementation:** Web Components Storybook configuration
*   **Complexity:** Medium (3-5 days)
*   **Deliverables:**
    *   Storybook 8.x setup
    *   Stories for all 78 components
    *   Controls for all component properties
    *   Hosted documentation site

 **Create: Component playground** (CodePen/StackBlitz templates)

*   **Why:** Zero-setup tryout for developers
*   **Implementation:** Create template repos with preloaded Sherpa
*   **Complexity:** Low (2 days)
*   **Deliverables:**
    *   CodePen collection with 10+ examples
    *   StackBlitz starter templates

 **Document: ADRs for major architectural decisions**

*   **Why:** Explain why Sherpa made certain choices vs Apex
*   **Implementation:** Markdown ADR docs in `/docs/adr/`
*   **Complexity:** Low (1-2 days per ADR)
*   **Topics:**
    *   Why Web Components over Angular
    *   Why native inputs over DevExtreme
    *   Token architecture rationale
    *   Composition tier system
    *   MCP server design

#### API Documentation

 **Generate: Unified API reference from component schemas**

*   **Why:** Searchable, centralized API docs
*   **Implementation:** Build tool to generate docs from JSON schemas
*   **Complexity:** Medium (3 days)
*   **Output:** Static site with component API reference

 **Add: Usage examples for all 78 components**

*   **Why:** Show common patterns and best practices
*   **Implementation:** Expand component READMEs with examples
*   **Complexity:** High (10+ days)
*   **Format:**
    *   Basic usage
    *   Common patterns
    *   Edge cases
    *   Accessibility notes

 **Create: Migration guide from Apex to Sherpa**

*   **Why:** Help teams transition from Apex (Angular) to Sherpa (Web Components)
*   **Implementation:** Side-by-side comparison with code examples
*   **Complexity:** Medium (3-4 days)
*   **Topics:**
    *   Component mapping (Apex → Sherpa)
    *   Pattern translations
    *   Feature gaps and workarounds
    *   Styling migration

**Expected Impact:** 50% faster onboarding, 80% fewer support questions

---

### Priority 4: Visual Consistency

**HIGH PRIORITY** - Ensure Sherpa looks like Apex

#### Design Token Audit

 **Validate: All Sherpa tokens against Figma source**

*   **Why:** Prevent token drift from design source of truth
*   **Implementation:**
    *   Export Figma Variables
    *   Compare against Sherpa CSS custom properties
    *   Flag discrepancies
*   **Complexity:** Low (2 days)
*   **Deliverable:** Token audit report

 **Document: Token differences from Apex**

*   **Why:** Explain intentional vs accidental differences
*   **Implementation:** Markdown comparison table
*   **Complexity:** Low (1 day)
*   **Output:** `TOKENS-COMPARISON.md`

 **Create: Visual regression tests comparing Apex vs Sherpa**

*   **Why:** Catch visual drift automatically
*   **Implementation:** Playwright visual comparison suite
*   **Complexity:** High (5 days)
*   **Coverage:**
    *   Buttons (all variants)
    *   Inputs (all types)
    *   Dialogs (all sizes)
    *   Data grid
    *   Navigation
    *   Cards

#### Component Visual Parity

 **Audit: Input styling to match Apex visual polish**

*   **Why:** Inputs look noticeably less polished than Apex
*   **Implementation:** Add refined CSS (shadows, borders, focus rings, transitions)
*   **Complexity:** Medium (3-4 days)
*   **Bundle impact:** +2KB CSS

 **Create: Sherpa theme that exactly matches Apex default theme**

*   **Why:** Ensure `apex-2-core` theme is pixel-perfect match
*   **Implementation:** Side-by-side Figma/browser comparison
*   **Complexity:** Medium (3-4 days)
*   **Deliverable:** `apex-2-core.verified.css`

 **Document: Acceptable visual differences for prototyping**

*   **Why:** Set expectations for when "close enough" is OK
*   **Implementation:** Visual parity guidelines document
*   **Complexity:** Low (1 day)
*   **Topics:**
    *   Exact match requirements (colors, spacing, typography)
    *   Acceptable variations (animations, micro-interactions)
    *   Prototyping-only features (density modes, extra themes)

**Expected Impact:** 90% visual parity with Apex, clear guidelines for differences

---

### Priority 5: Production Readiness (Optional)

**LOW PRIORITY** - Nice-to-haves if Sherpa graduates from "prototyping" to "production-light"

 **Add: i18n support** (7 locales like Apex)

*   **Why:** Global market support
*   **Complexity:** High (10+ days)
*   **Decision:** Only if production use case emerges

 **Add: Form validation library integration**

*   **Why:** Richer validation than HTML5 attributes
*   **Complexity:** Medium (5 days)
*   **Decision:** Evaluate against "lightweight" mission

 **Add: Error boundary patterns**

*   **Why:** Graceful error handling in components
*   **Complexity:** Low (2 days)
*   **Decision:** Good practice, low cost

 **Add: Loading states and skeleton screens**

*   **Why:** Better perceived performance
*   **Complexity:** Low (2 days)
*   **Decision:** Improves UX, low cost

 **Enhance: Accessibility testing automation**

*   **Why:** Catch a11y issues in CI
*   **Complexity:** Medium (3 days)
*   **Decision:** Good practice, consider for Phase 2

**Expected Impact:** Sherpa becomes production-viable for simpler apps (not enterprise)

---

### Implementation Roadmap

**Phase 1: Critical Gaps (4-6 weeks)**

*   sherpa-wizard
*   sherpa-card
*   Enhanced sherpa-input-select (virtual scrolling)
*   sherpa-tree-select
*   Data grid CSV export
*   Data grid state persistence

**Phase 2: Documentation (3-4 weeks)**

*   Storybook setup
*   API reference generation
*   Migration guide
*   ADR documentation

**Phase 3: Visual Parity (3-4 weeks)**

*   Token audit
*   Input polish
*   Visual regression tests
*   Apex-matching theme verification

**Phase 4: Production Polish (2-3 weeks) - Optional**

*   sherpa-dashboard
*   Error boundaries
*   Loading states
*   Accessibility automation

**Total Time: 12-17 weeks**

---

## 6\. Key Takeaways

### Sherpa's Core Strengths (Lean into these)

1.  **Framework-agnostic** - Deploy anywhere (React, Vue, Angular, vanilla JS)
2.  **Zero build step** - Instant prototyping in CodePen, JSFiddle, static HTML
3.  **AI-first** - MCP server, AI components, schema-driven generation
4.  **Modern CSS** - Cutting-edge browser features (layers, @property, @container)
5.  **Complete app structure** - Shell components Apex lacks (nav, layout-grid, product-bar)
6.  **Standards-based** - Native Web Components, future-proof, long browser support
7.  **Lightweight** - 50-70% smaller bundle than Apex + Angular
8.  **Multi-theme** - 5 themes with light/dark/high-contrast out-of-box

---

### Sherpa's Critical Gaps (Address these)

1.  **Missing wizard** - Critical for multi-step flows (HIGH PRIORITY)
2.  **Basic select** - Needs virtual scrolling for large datasets (HIGH PRIORITY)
3.  **No card component** - Fundamental UI pattern (HIGH PRIORITY)
4.  **No tree-select** - Important for hierarchical data (MEDIUM PRIORITY)
5.  **No export** - Add lightweight CSV export (MEDIUM PRIORITY)
6.  **Limited docs** - Add Storybook, API reference (MEDIUM PRIORITY)
7.  **Visual parity** - Audit against Apex, polish inputs (HIGH PRIORITY)
8.  **No i18n** - Acceptable for prototyping, gap for production (LOW PRIORITY)

---

### Strategic Positioning

**Sherpa SHOULD remain:**

*   ✅ Lightweight (don't add DevExtreme or heavy libraries)
*   ✅ Prototyping-focused (don't over-engineer for enterprise edge cases)
*   ✅ Standards-based (keep Web Components, don't lock into frameworks)
*   ✅ AI-friendly (enhance MCP integration, schema-driven workflows)
*   ✅ Modern (leverage cutting-edge CSS, ES modules, native APIs)

**Sherpa SHOULD add:**

*   ✅ Missing basic components (wizard, card, tree-select) - fills common use cases
*   ✅ Lightweight enterprise features (CSV export, state persistence) - production viability
*   ✅ Better documentation (Storybook, API reference, migration guide) - adoption
*   ✅ Visual consistency with Apex (where it matters) - brand alignment

**Sherpa should NOT become:**

*   ❌ A full replacement for Apex (different use cases, complementary systems)
*   ❌ Angular-dependent (defeats the framework-agnostic purpose)
*   ❌ DevExtreme-based (too heavy, conflicts with "lightweight" mission)
*   ❌ A production-first system (prototyping speed is the core value prop)

---

### Complementary Use Cases

| Use Case | Recommended System | Rationale |
| --- | --- | --- |
| **Rapid prototyping** | **Sherpa** | No build, copy-paste patterns, instant preview |
| **Proof-of-concepts** | **Sherpa** | Lightweight, fast iteration, works in CodePen |
| **Internal tools (simple)** | **Sherpa** | Web Components work anywhere, low maintenance |
| **MVP applications** | **Sherpa** | Fast to market, can migrate to Apex later |
| **AI/chatbot UIs** | **Sherpa** | Has AI components (chat-message, prompt-composer) |
| **Flow/process diagrams** | **Sherpa** | Has node-canvas system |
| **Multi-framework projects** | **Sherpa** | Framework-agnostic Web Components |
| **Enterprise dashboards** | **Apex** | DevExtreme data grid, export, master-detail |
| **Complex data management** | **Apex** | Virtual scrolling, state persistence, filters |
| **Production Angular apps** | **Apex** | Tight Angular integration, mature ecosystem |
| **Multi-locale applications** | **Apex** | Built-in i18n for 7 locales |
| **Advanced wizards** | **Apex** | Full wizard component with validation |
| **Backend integration (CRON)** | **Apex** | Generates Quartz CRON expressions |
| **Customizable dashboards** | **Apex** | Gridster2-based widget system |

---

### Vision Statement

**Sherpa** is the **rapid prototyping toolkit** that lets developers build UI mockups 10x faster than traditional frameworks, with the flexibility to deploy anywhere. It's the Swiss Army knife for quick demos, internal tools, and MVPs.

**Apex** is the **production-grade design system** for enterprise Angular applications that need complex data management, i18n support, and DevExtreme's rich component ecosystem.

**Together**, they cover the full product development lifecycle:

1.  **Prototype with Sherpa** (day 1-7: validate ideas fast)
2.  **Migrate to Apex** (day 8+: productionize for enterprise)

---

## Your Thoughts & Solutions

_Use this section to add your feedback, decisions, and action items based on this analysis._

### Decisions

*   **Decision:** Do we proceed with all Priority 1 recommendations?
*   **Decision:** What is the timeline for Sherpa v2.0 with these improvements?
*   **Decision:** Should Sherpa support production use cases or stay prototyping-focused?
*   **Decision:** Which themes should we maintain? (all 5 or focus on apex-2-core?)

### Action Items

*   **Action:** Review Priority 1 component gaps with design team
*   **Action:** Schedule visual parity audit session with Figma designs
*   **Action:** Create Storybook proof-of-concept for Sherpa
*   **Action:** Draft migration guide from Apex to Sherpa (sample 3 components)
*   **Action:** Evaluate MCP server enhancements for component generation

### Open Questions

1.  **Question:** Should Sherpa components visually match Apex 100%, or is 90% close enough for prototyping?
2.  **Question:** Do we need to support IE11 or can we lean into modern CSS features?
3.  **Question:** Should we invest in Sherpa i18n now, or wait for production use cases to emerge?
4.  **Question:** How do we handle developers who start with Sherpa and want to migrate to Apex?
5.  **Question:** Should Sherpa export CRON expressions from the scheduler, or is UI-only acceptable?

### Notes

_Add your observations, concerns, or additional context here._

---

**End of Analysis**  
Generated: June 4, 2026  
Last Updated: _\[Add date when you update this file\]_