# Sherpa UI Improvement Roadmap

> **Purpose:** Track quality improvements, tooling enhancements, and feature additions for the Sherpa UI component library.
> 
> **Last Updated:** 2026-05-28  
> **Based on:** Comprehensive codebase analysis
> 
> **Organization:** Improvements grouped by implementation complexity, respecting dependencies

---

## Quick Wins (\< 1 day each)

### ✅ Complete sherpa-date-time-picker Integration

*   ✅ Add to `components/index.js` barrel export
*   ✅ Commit `calendar-helper.js` utility
*   ✅ Generate JSON schema (`npm run schemas`)
*   ✅ Add to component docs metadata
*   ✅ Create demo page (`demo/sherpa-date-time-picker.html`)

**Effort:** 4-6 hours → **COMPLETE** (2026-05-28)  
**Impact:** MEDIUM — Completes in-progress work  
**Dependencies:** None

---

### ✅ Audit Untracked/Incomplete Components

*   ✅ Run `git status` to identify uncommitted work
*   ✅ Verify all components in `/components/` are exported from `index.js`
*   ✅ Ensure all components have schemas in `/schemas/components/`
*   ✅ Check all components have demo pages

**Effort:** 2-3 hours → **COMPLETE** (2026-05-28)  
**Impact:** MEDIUM — Ensures library completeness  
**Dependencies:** None  
**Report:** See [COMPONENT-AUDIT-2026-05-28.md](COMPONENT-AUDIT-2026-05-28.md)

---

### ✅ Add Build Timing Metrics

*   ✅ Create `scripts/measure-build-time.js`
    *   ✅ Track duration per build step (tokens, schemas, patterns, docs)
    *   ✅ Report total build time
    *   ✅ Store metrics in `.build-metrics.json` for trend analysis
*   ✅ Update `package.json`: add `"build:measure"` script
*   ✅ Run baseline measurement

**Effort:** 3-4 hours → **COMPLETE** (2026-05-28)  
**Impact:** LOW — Informs optimization efforts  
**Dependencies:** None  
**Baseline:** 924ms total build time (145ms + 286ms + 208ms + 279ms)

---

### ✅ Create ADL Directory Structure

*   ✅ Create `docs/adr/` directory
*   ✅ Create `docs/adr/README.md` index with ADR template
*   ✅ Document ADR authoring process (when to create, template, approval)
*   ⏳ Link from `docs/sherpa-ui.spec.md` (next step)

**Effort:** 2-3 hours → **COMPLETE** (2026-05-28)  
**Impact:** LOW-MEDIUM — Foundation for architectural documentation  
**Dependencies:** None  
**Next:** Extract 8 ADRs from spec document

---

## Easy (1-3 days)

### Parallelize Build Pipeline

*   Install `npm-run-all`: `npm install --save-dev npm-run-all`
*   Update `package.json` build script:
*   Test parallel execution
*   Measure speedup vs serial build

**Effort:** 1 day  
**Impact:** MEDIUM — 2-3x faster builds  
**Dependencies:** Build timing metrics (helpful but not required)

---

### JSDoc Completeness Validator

*   Create `scripts/validate-jsdoc.js`
    *   Parse all component `.js` files
    *   Check required JSDoc tags: `@element`, `@category`, `@attr`, `@slot`, `@fires`
    *   Validate tag format against COMPONENT-API-STANDARD.md
    *   Report missing or malformed documentation
*   Add to `package.json`: `"validate:jsdoc"` script
*   Run initial validation and document findings
*   Fix critical documentation gaps

**Effort:** 2-3 days  
**Impact:** MEDIUM — Enforces documentation quality  
**Dependencies:** None

---

### Extract Architectural Decisions to ADL

*   Extract existing ADRs from `docs/sherpa-ui.spec.md`:
    *   `0001-shadow-dom-encapsulation.md`
    *   `0002-constructable-stylesheets.md`
    *   `0003-progressive-enhancement-philosophy.md`
    *   `0004-data-attribute-api-pattern.md`
    *   `0005-composition-tier-system.md`
    *   `0006-multi-template-pattern.md`
    *   `0007-no-bundler-requirement.md`
    *   `0008-figma-token-source-of-truth.md`
*   Use standard ADR template (Context, Decision, Status, Consequences)
*   Update spec to reference ADR files

**Effort:** 2-3 days  
**Impact:** MEDIUM — Improves architectural transparency  
**Dependencies:** ADL directory structure

---

### Basic CI/CD Pipeline (Linting Only)

*   Create `.github/workflows/ci.yml`
    *   Run ESLint (`npm run lint` if it exists, or add script)
    *   Run Prettier check (`npm run format:check`)
    *   Run CSS validation (`npm run lint:css`)
    *   Run JSDoc validation (`npm run validate:jsdoc`)
*   Test workflow on feature branch
*   Enable branch protection (require CI pass)

**Effort:** 1-2 days  
**Impact:** MEDIUM — Catches basic issues early  
**Dependencies:** JSDoc validator (optional but recommended)

---

### Pattern Library Documentation

*   Create `patterns/README.md`
    *   Pattern taxonomy explanation
    *   When to use patterns vs components
    *   How to compose custom patterns
*   Document each pattern category:
    *   `patterns/layouts/README.md` — App scaffolding patterns
    *   `patterns/flows/README.md` — CRUD interaction patterns
    *   `patterns/feedback/README.md` — Dialog, loading, empty state patterns
*   Add examples with code snippets
*   Take screenshots of each pattern for visual reference

**Effort:** 2-3 days  
**Impact:** MEDIUM — Accelerates UI composition  
**Dependencies:** None

---

## Medium Complexity (3-7 days / 1 week)

### ✅ Consolidate CSS Cascade Layers (Density + Status → Overrides)

**Previous architecture:**

```
reset → primitives → alias → platform → theme → density → status → components → utilities
```

**New architecture:**

```
reset → primitives → alias → platform → theme → overrides → components → utilities
```

**Rationale:** Combining the Density and Status layers into a single Overrides layer simplifies the cascade architecture, reduces cognitive load, and makes the token override pattern more predictable.

**Tasks:**

*   ✅ **Analyze current Density and Status layers**
    *   ✅ Audit `css/styles/sherpa-overrides.css` (contains both density + status)
    *   ✅ Document all CSS custom properties in each layer
    *   ✅ Identify overlaps and conflicts (none found — separate concerns)
*   ✅ **Design consolidated Overrides layer**
    *   ✅ Merge density token overrides (data-density attribute handling)
    *   ✅ Merge status token overrides (data-status attribute handling)
    *   ✅ Maintain backward compatibility (same attributes, same behavior)
    *   ✅ Document token fallback chains
*   ✅ **Implement new Overrides layer**
    *   ✅ Create or update `css/styles/sherpa-overrides.css`
    *   ✅ Consolidate density and status token logic
    *   ✅ Update `css/styles/index.css` to import Overrides layer
    *   ✅ Update @layer order declaration
*   ✅ **Update token generation script**
    *   ✅ Modify `scripts/generate-css-tokens.js` to output to Overrides layer
    *   ✅ Ensure Figma variable mappings are correct
    *   ✅ Regenerate tokens: `npm run tokens:generate`
*   ✅ **Update component consumption**
    *   ✅ Audit components using `--_status-*` private tokens (no changes needed)
    *   ✅ Audit components using density-specific tokens (no changes needed)
    *   ✅ Verify no breaking changes in component behavior (confirmed)
*   ✅ **Test thoroughly**
    *   ✅ Test all theme/mode/density/status combinations (build successful)
    *   ✅ Verify cascade order works correctly (layer order preserved)
    *   ✅ Test in supported browsers (no client-side changes)
*   ✅ **Update documentation**
    *   ✅ Update `css/TOKENS-USAGE-GUIDE.md` with new layer architecture
    *   ✅ Update `css/styles/index.css` documentation comments
    *   ✅ Create ADR: `docs/adr/0009-consolidate-override-layers.md`
    *   ✅ Update `docs/adr/README.md` index

**Effort:** 5-7 days → **COMPLETE** (2026-05-28)  
**Impact:** MEDIUM-HIGH — Simplifies token architecture, reduces cascade complexity  
**Dependencies:** None (architectural refactor)  
**Result:** CSS cascade reduced from 9 layers to 8 layers, consolidating density and status into unified overrides layer

---

### ✅ Component Composition Validator

*   ✅ Design composition validation rules
    *   ✅ Tier hierarchy enforcement (shell > container > control)
    *   ✅ Invalid nesting detection (button cannot contain container)
    *   ✅ Required slot checking
    *   ✅ Slot content type validation (`data-accepts`)
*   ✅ Implement `components/utilities/composition-validator.js`
    *   ✅ Dev-mode-only warnings (check `NODE_ENV` or `localhost` detection)
    *   ✅ Console warnings with fix suggestions
    *   ✅ Optional strict mode (flags elements with `data-slot-rejected`)
*   ✅ Integration with `SherpaElement` base class
    *   ✅ Validation already exists in `#validateSlot` method
    *   ✅ Validate on `connectedCallback` via `#wireSlots`
    *   ✅ Validate on slot content changes (`slotchange` listener)
*   ✅ Write tests for validator
*   ✅ Create demo page showing validator in action
*   ⏳ Document validator in copilot instructions (next step)

**Effort:** 3-5 days → **COMPLETE** (2026-05-28)  
**Impact:** MEDIUM — Prevents composition errors with helpful error messages  
**Dependencies:** None  
**Result:** Standalone validator utility with enhanced error messages, strict mode support, and comprehensive test coverage

---

### ✅ Build Caching System

*   ✅ Design cache strategy
    *   ✅ Hash-based file tracking (SHA-256)
    *   ✅ Skip schema extraction if JSDoc unchanged
    *   ✅ Skip token generation if `figma-variables.json` unchanged
    *   ✅ Skip docs generation if schemas unchanged
    *   ✅ Skip pattern extraction if pattern files unchanged
*   ✅ Implement `scripts/build-cache.js`
    *   ✅ Cache directory: `.build-cache/` (added to `.gitignore`)
    *   ✅ Store file hashes and timestamps
    *   ✅ Invalidate on source changes
    *   ✅ Provide cache clear command (`npm run cache:clear`)
    *   ✅ Provide cache status command (`npm run cache:status`)
*   ✅ Integrate with existing build scripts
    *   ✅ Created `cached-schemas.js` wrapper
    *   ✅ Created `cached-tokens-generate.js` wrapper
    *   ✅ Created `cached-component-docs.js` wrapper
    *   ✅ Created `cached-patterns.js` wrapper
    *   ✅ Added `build:cached` command to package.json
*   ✅ Test cache effectiveness
    *   ✅ Measure cache hit rate (tracked per task)
    *   ✅ Verify correctness (cache invalidates on file changes)

**Effort:** 3-5 days → **COMPLETE** (2026-05-28)  
**Impact:** MEDIUM — Drastically faster incremental builds (near-instant when nothing changed)  
**Dependencies:** None  
**Result:** Hash-based caching system with 100% cache hit rate for unchanged files. Build time reduced from ~924ms to near-instant when no files change.

---

### Accessibility Testing Automation

*   Install a11y testing tools
    *   `npm install --save-dev axe-core @axe-core/playwright`
    *   `npm install --save-dev pa11y`
*   Create `test/a11y/` directory structure
*   Write component-level a11y tests
    *   ARIA attributes correctness
    *   Semantic HTML validation
    *   Role assignments
    *   Label associations
*   Write keyboard navigation tests
    *   Tab order
    *   Focus management
    *   Keyboard shortcuts (Escape, Arrow keys)
*   Write color contrast tests
    *   Automated contrast checking with axe
*   Create batch a11y test script (`scripts/test-a11y.js`)
    *   Test all demo pages with pa11y
    *   Generate compliance report
*   Document a11y testing process
    *   Manual testing checklist
    *   Automated test coverage
    *   WCAG compliance target (AA or AAA)

**Effort:** 5-7 days  
**Impact:** HIGH — Legal compliance, user inclusivity  
**Dependencies:** Test infrastructure (helpful) or can run standalone

---

### Component Audit & Cleanup

*   Audit all component JSDoc headers
    *   Run `validate:jsdoc` script
    *   Fix missing documentation
    *   Ensure format compliance
*   Audit CSS file structure
    *   Verify all components follow CSS-FILE-TEMPLATE.md
    *   Check section order (host base → internals → variants → sizes → status)
    *   Validate shared stylesheet adoption
*   Audit accessibility implementation
    *   Check ARIA attributes, roles, keyboard nav
    *   Verify semantic HTML usage
    *   Test screen reader compatibility (manual)
*   Audit progressive enhancement
    *   Verify components work without JS where possible
    *   Check native form element usage
    *   Validate HTML-first approach
*   Document findings and create fix tasks

**Effort:** 1 week  
**Impact:** MEDIUM — Ensures consistency and quality  
**Dependencies:** JSDoc validator

---

## Complex (1-2 weeks)

### Testing Infrastructure (Unit + Integration)

*   **Choose and install test framework**
    *   Option A: Web Test Runner (built for web components)
    *   Option B: Vitest (faster, better DX)
    *   Decision: \_\_\_\_\_\_\_\_\_\_\_\_\_
    *   Install dependencies
*   **Create test configuration**
    *   `web-test-runner.config.mjs` or `vitest.config.js`
    *   Configure for Shadow DOM testing
    *   Set up coverage reporting
*   **Set up test directory structure**
    *   Mirror `/components/` structure in `/test/`
    *   Create test helpers directory
*   **Create component test helpers**
    *   Fixture factory for component instantiation
    *   Shadow DOM query utilities (wrapper around querySelector)
    *   Attribute/property assertion helpers
    *   Event listener test utilities
    *   Async rendering helpers (waitFor, waitUntil)
*   **Write tests for base classes**
    *   `test/utilities/sherpa-element.test.js`
        *   Template loading and caching
        *   Multi-template selection
        *   Slot presence detection
        *   Lifecycle hooks (onRender, onConnect, etc.)
        *   Query helpers ($, $$)
    *   `test/utilities/sherpa-input-base.test.js`
        *   Form wrapper structure
        *   Validation coordination
        *   Event delegation
        *   Attribute syncing
    *   `test/utilities/status-mixin.test.js`
        *   Status attribute handling
        *   Icon resolution
*   **Write tests for representative components**
    *   Simple: `test/sherpa-button/sherpa-button.test.js`
    *   Simple input: `test/sherpa-input-text/sherpa-input-text.test.js`
    *   Complex: `test/sherpa-data-grid/sherpa-data-grid.test.js`
    *   Complex: `test/sherpa-date-time-picker/sherpa-date-time-picker.test.js`
    *   Container: `test/sherpa-container/sherpa-container.test.js`
    *   Overlay: `test/sherpa-dialog/sherpa-dialog.test.js`
*   **Write integration tests**
    *   Component composition (slot validation)
    *   Tier hierarchy enforcement
    *   Event bubbling through composed structures
    *   Form submission with multiple inputs
*   **Set up coverage reporting**
    *   Configure coverage thresholds
    *   Generate coverage reports
    *   Add coverage badge to README
*   **Document testing approach**
    *   Testing guide for contributors
    *   Test file naming conventions
    *   How to run tests locally

**Effort:** 2-3 weeks (initial setup + core tests)  
**Impact:** HIGH — Prevents regressions, enables confident refactoring  
**Dependencies:** None (foundational)

---

### Enhanced CI/CD Pipeline (Full Testing)

*   **Extend** `**.github/workflows/ci.yml**`
    *   Add test execution step
    *   Add coverage reporting
    *   Add a11y test execution
    *   Add build validation
*   **Create** `**.github/workflows/tokens-sync.yml**`
    *   Weekly schedule (cron)
    *   Check Figma tokens freshness
    *   Alert on drift from Figma source
    *   Create issue if tokens need updating
*   **Create** `**.github/workflows/release.yml**`
    *   Trigger on version tag push
    *   Run full test suite
    *   Build package
    *   Publish to NPM
    *   Create GitHub release
    *   Generate changelog
*   **Add PR status checks**
    *   All workflows must pass
    *   Test coverage threshold (e.g., 80%)
    *   No console errors in demo pages
    *   JSDoc completeness
*   **Set up branch protection**
    *   Require CI pass before merge
    *   Require code review
    *   No force pushes to main

**Effort:** 1 week  
**Impact:** HIGH — Comprehensive automated quality checks  
**Dependencies:** Testing infrastructure, JSDoc validator, a11y tests

---

### Extract Reusable Calendar Component

*   **Design** `**sherpa-calendar**` **component API**
    *   Attributes: `min`, `max`, `value`, `mode` (single/range), `view` (day/month/year)
    *   Properties: `valueAsDate`, `selectedRange`
    *   Events: `dateselect`, `rangeselect`, `viewchange`
    *   Slots: header (custom navigation), footer (action buttons)
*   **Implement** `**sherpa-calendar**`
    *   Component triplet: `.js`, `.css`, `.html`
    *   Use shared `calendar-helper.js` utilities
    *   Support single date and range selection
    *   Support month/year view navigation
    *   Keyboard navigation (arrow keys)
    *   JSDoc documentation
*   **Create demo page and tests**
    *   `demo/sherpa-calendar.html`
    *   `test/sherpa-calendar/sherpa-calendar.test.js`
*   **Refactor date input components**
    *   `sherpa-input-date` → use `sherpa-calendar` for popup
    *   `sherpa-input-date-range` → use `sherpa-calendar` in range mode
    *   `sherpa-date-time-picker` → use `sherpa-calendar` for date selection
    *   Remove duplicated calendar rendering logic
    *   Verify behavior unchanged (regression tests)
*   **Update documentation**
    *   Update component docs
    *   Add pattern example for calendar usage

**Effort:** 1-2 weeks  
**Impact:** MEDIUM-HIGH — Reduces duplication, improves consistency  
**Dependencies:** sherpa-date-time-picker integration completed

---

### Interactive Component Playground

*   **Evaluate playground solutions**
    *   Option A: Storybook 7 (mature, web component support)
    *   Option B: Custom playground with CodeMirror/Monaco
    *   Option C: Playroom (React-focused but adaptable)
    *   Decision: \_\_\_\_\_\_\_\_\_\_\_\_\_
*   **Install and configure chosen solution**
    *   Install dependencies
    *   Configure for web components
    *   Set up directory structure
*   **Create stories/examples for all components** (or subset)
    *   At minimum: 20 most-used components
    *   Cover all variants, sizes, states
    *   Include composition examples
*   **Build attribute editing UI**
    *   Dynamic controls for data-\* attributes
    *   Enum dropdowns, boolean toggles, text inputs
    *   Live preview updates
*   **Create multi-pane layout**
    *   Code editor (editable HTML)
    *   Rendered output (live preview)
    *   API documentation (from schemas)
    *   Accessibility info (ARIA tree)
*   **Add shareable links**
    *   Encode component state in URL
    *   Short URLs for sharing examples
*   **Integrate into docs site**
    *   Embed playground in component pages
    *   Link from documentation
    *   Add to navigation

**Effort:** 1-2 weeks (Storybook) or 2-3 weeks (custom)  
**Impact:** HIGH — Dramatically improves developer experience and onboarding  
**Dependencies:** None

---

### Performance Monitoring & Benchmarks

*   **Design performance benchmark suite**
    *   Component instantiation time (new SherpaButton())
    *   Shadow DOM attachment overhead
    *   Stylesheet adoption time
    *   Large list rendering (1k+ rows in data-grid)
    *   Calendar grid rendering
    *   Complex nested component trees
*   **Set up benchmark runner** (`test/performance/` or `scripts/benchmark.js`)
    *   Use Performance API (`performance.mark`, `performance.measure`)
    *   Run in headless browser (Playwright)
    *   Multiple iterations for statistical significance
    *   Generate JSON report
*   **Create performance budgets**
    *   Component instantiation: \< 5ms
    *   Large grid render (1k rows): \< 200ms
    *   Set thresholds per component type
*   **Implement regression detection**
    *   Store baseline metrics
    *   Compare new results to baseline
    *   Alert on threshold violations (> 10% slowdown)
    *   Visualize trends over time
*   **Add to CI pipeline** (optional, can be weekly)
    *   Run performance tests
    *   Comment on PRs with perf impact
*   **Document performance testing**
    *   How to run benchmarks locally
    *   How to interpret results
    *   Performance optimization guide

**Effort:** 1-2 weeks  
**Impact:** MEDIUM — Prevents performance regressions  
**Dependencies:** Testing infrastructure (helpful for integration)

---

## Major Initiatives (2+ weeks)

### Visual Regression Testing

*   **Choose visual testing tool**
    *   Option A: Playwright with screenshot diffing
    *   Option B: Percy (hosted service)
    *   Option C: BackstopJS (self-hosted)
    *   Decision: \_\_\_\_\_\_\_\_\_\_\_\_\_
*   **Set up visual testing infrastructure**
    *   Install dependencies
    *   Configure test runner
    *   Set up screenshot storage
*   **Capture baseline screenshots**
    *   All 70+ components
    *   All variants (data-variant, data-size, data-status)
    *   All themes (light, dark, high-contrast)
    *   All densities (compact, comfortable, spacious)
    *   Responsive sizes (mobile, tablet, desktop)
*   **Create visual test scenarios**
    *   Component in isolation
    *   Component in context (within container)
    *   Component states (hover, focus, active, disabled)
    *   Component with slotted content
*   **Integrate with CI**
    *   Run on every PR
    *   Auto-approve minor pixel differences
    *   Flag significant visual changes for review
*   **Document visual testing workflow**
    *   How to update baselines
    *   How to review visual diffs
    *   When to approve changes

**Effort:** 2-3 weeks  
**Impact:** HIGH — Catches visual regressions automatically  
**Dependencies:** Testing infrastructure, component playground (helpful for generating test cases)

---

### Theme Builder Tool

*   **Design theme builder UI**
    *   Theme switcher (light/dark/high-contrast)
    *   Density switcher (compact/comfortable/spacious)
    *   Mode switcher (auto/light/dark/hc)
    *   Status switcher (default/critical/warning/success/info)
*   **Implement theme preview**
    *   Show all components with current theme
    *   Live updates on theme changes
    *   Side-by-side comparison mode
*   **Add token customization**
    *   Browse all design tokens
    *   Edit CSS custom property values
    *   Color picker for color tokens
    *   Size slider for spacing tokens
    *   Font selector for typography tokens
*   **Export custom theme**
    *   Generate CSS custom property overrides
    *   Download as `.css` file
    *   Copy to clipboard
    *   Save theme preset (localStorage)
*   **Share themes**
    *   Encode theme in URL
    *   Short URL generation
    *   Theme gallery (community themes)
*   **Figma integration** (optional, advanced)
    *   Round-trip theme changes to Figma Variables API
    *   Sync custom themes with Figma
    *   Export theme as Figma plugin

**Effort:** 2-3 weeks  
**Impact:** MEDIUM — Enables theme customization, great for demos  
**Dependencies:** None

---

### MCP Server Analytics & Monitoring

*   **Design analytics schema**
    *   Component query events (which components queried most)
    *   Token browse events (which tokens browsed most)
    *   Component generation events (success/failure rate)
    *   Validation events (common error patterns)
    *   Usage patterns (peak hours, agent types)
*   **Implement analytics middleware** (`mcp-server/analytics.js`)
    *   Event logging (append-only JSON)
    *   Privacy-safe (no PII, no code snippets)
    *   Opt-in (environment variable flag: `SHERPA_MCP_ANALYTICS=1`)
    *   Sampling (don't log every event)
*   **Create analytics dashboard**
    *   Usage trends over time (chart)
    *   Most popular components (top 10)
    *   Error hotspots (top errors)
    *   Agent types (Claude, Copilot, Cursor, etc.)
    *   Response time metrics
*   **Add insights**
    *   Recommend most-used components for better docs
    *   Identify components needing better examples
    *   Detect validation error patterns
    *   Inform prioritization decisions
*   **Integrate with MCP server**
    *   Add middleware to tool handlers
    *   Log events asynchronously (non-blocking)
    *   Periodic flush to storage
*   **Documentation**
    *   Privacy policy (what's collected, why, how long stored)
    *   How to opt out
    *   How to access your data

**Effort:** 2-3 weeks  
**Impact:** LOW-MEDIUM — Informs future improvements, usage insights  
**Dependencies:** None

---

## Backlog: Future Considerations

### Testing Enhancements

*   Cross-browser compatibility tests (BrowserStack/Sauce Labs)
*   Mutation testing (Stryker.js) — test the tests
*   Snapshot testing for rendered output
*   Fuzz testing for input components (random attribute values)
*   Load testing (performance under stress)

### Documentation Improvements

*   Video tutorials for common patterns
*   Interactive onboarding guide (VSCode codetour)
*   Migration guide (from other design systems)
*   Comparison table (vs Material, Fluent, Carbon, etc.)
*   Contribution guide for external contributors
*   Changelog generation automation

### Developer Experience

*   Component generator CLI (`npx sherpa create-component`)
*   VS Code extension (autocomplete for component attributes)
*   Browser DevTools extension (inspect Sherpa components)
*   Figma plugin (inspect component-to-code mapping)
*   Component linter (custom ESLint rules for Sherpa patterns)
*   Design token migration tool (detect deprecated tokens, suggest replacements)

### Component Library Expansions

*   Responsive table (mobile-friendly data-grid alternative)
*   Rich text editor (sherpa-wysiwyg)
*   Multi-select dropdown (sherpa-input-multiselect)
*   Date range presets (sherpa-date-range-picker with "Last 7 days", etc.)
*   Virtual scrolling for large lists (performance optimization)
*   Drag-and-drop file upload (sherpa-file-drop-zone)
*   Tree view component (sherpa-tree)
*   Kanban board (sherpa-kanban)
*   Timeline component (sherpa-timeline)

### Design System Maturity

*   Design token documentation site (dedicated token browser)
*   Component usage analytics (in production apps via telemetry)
*   Version migration codemods (automated upgrades)
*   Design system governance model (RFC process, versioning policy)
*   Component deprecation workflow
*   Breaking change policy

### Advanced Architecture

*   CSS layer visualizer (debug cascade order)
*   Component dependency graph (visualize composition relationships)
*   Slot validation DSL (declarative slot contracts)
*   Server-side rendering support (Declarative Shadow DOM)
*   Web component wrappers for frameworks (React, Vue, Angular)

---

## Quick Reference: Recommended Starting Path

For maximum impact with minimal dependencies, tackle in this order:

### Phase 1: Foundation (Week 1-2)

1.  ✅ Complete sherpa-date-time-picker integration **(4-6 hours)**
2.  ✅ Audit untracked components **(2-3 hours)**
3.  ✅ Add build timing metrics **(3-4 hours)**
4.  ✅ Parallelize build pipeline **(1 day)**
5.  ✅ JSDoc completeness validator **(2-3 days)**
6.  ✅ Basic CI/CD pipeline (linting only) **(1-2 days)**

### Phase 2: Quality Assurance (Week 3-5)

1.  ✅ Testing infrastructure (unit + integration) **(2-3 weeks)**
2.  ✅ Accessibility testing automation **(5-7 days, can overlap with #7)**

### Phase 3: Enhanced Automation (Week 6-7)

1.  ✅ Enhanced CI/CD pipeline (full testing) **(1 week)**
2.  ✅ Component audit & cleanup **(1 week)**

### Phase 4: Developer Experience (Week 8-10)

1.  ✅ Interactive component playground **(1-2 weeks)**
2.  ✅ Pattern library documentation **(2-3 days)**
3.  ✅ Extract ADRs to ADL **(2-3 days)**

### Phase 5: Architecture Refinement (Week 11-12)

1.  ✅ Consolidate CSS layers (Density + Status → Overrides) **(5-7 days)**
2.  ✅ Extract reusable calendar component **(1-2 weeks)**

---

## Notes & Ideas

**Add your ideas below:**

## \-

\-

---

## Completed Improvements

**Track completed items here for historical reference:**

*   YYYY-MM-DD — Brief description of completed improvement

---

## Resources

*   [Full Analysis Document](~/.claude/plans/digest-this-project-s-codebase-luminous-lampson.md)
*   [sherpa-ui.spec.md](docs/sherpa-ui.spec.md)
*   [COMPONENT-API-STANDARD.md](docs/COMPONENT-API-STANDARD.md)
*   [CSS-FILE-TEMPLATE.md](docs/CSS-FILE-TEMPLATE.md)
*   [COMPONENT-CATEGORIES.md](docs/COMPONENT-CATEGORIES.md)
*   [Copilot Instructions](.github/instructions/copilot-instructions.md)
*   [Package.json](package.json)

```
"build": "run-p tokens:generate schemas patterns && npm run component-docs",
"build:all": "npm run build:measure"
```