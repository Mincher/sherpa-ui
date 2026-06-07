# Component Tier Mapping

Maps every sherpa component to a `ComponentTier` value as defined in
`components/utilities/types.ts`:

```
'atom' | 'molecule' | 'organism' | 'structure'
```

These are **atomic design** tiers and are a separate axis from the numeric
composition tiers (1–4) in `component-categories.ts`, which describe
slot-hosting rules (shell at 1, leaves at 4). The two systems coexist:
numeric tiers govern _where_ a component may be slotted; string tiers
describe _structural complexity_.

**Definitions:**

| Tier | Criteria |
| --- | --- |
| `atom` | Single-purpose primitive. Not internally composed of other Sherpa components. Cannot be broken into smaller Sherpa pieces. |
| `molecule` | Composed of 2–3 atoms or structurally groups repeating atoms. Serves one focused workflow step. |
| `organism` | Complex, self-contained section with its own data/interaction logic. Stands alone in a page region. |
| `structure` | Structural wrapper that provides layout or surface — no inherent business logic of its own. |

---

## Mapping

### structure

Pure layout/surface wrappers. They hold content but carry no domain logic.

| Component | Reasoning |
| --- | --- |
| `sherpa-app-shell` | Top-level page scaffold; distributes named slots to regions |
| `sherpa-layout-grid` | CSS grid wrapper only |
| `sherpa-container` | Generic surface / card wrapper |
| `sherpa-container-group` | Groups containers; adds grouping semantics, not logic |
| `sherpa-panel` | Collapsible/resizable surface pane |
| `sherpa-accordion` | Expand/collapse wrapper; content is fully slotted |
| `sherpa-node-canvas` | Structural canvas surface; sibling to layout-grid for presenting content |

---

### organism

Complex, self-sufficient components with their own data, interaction, or
coordination logic. Typically fill a named region or page section.

| Component | Reasoning |
| --- | --- |
| `sherpa-nav` | Full nav rail — owns section/item layout, collapse, active tracking |
| `sherpa-product-bar` | Page-level product chrome with nav and actions |
| `sherpa-product-bar-v2` | As above (v2 variant) |
| `sherpa-view-header` | Complex header: breadcrumbs, tabs, filter, back/actions wiring |
| `sherpa-container-header` | Organism placed inside a container |
| `sherpa-container-footer` | Organism placed inside a container |
| `sherpa-dialog` | Floating overlay with lifecycle management; content is slotted |
| `sherpa-data-grid` | Full table with sort, filter, pagination, selection |
| `sherpa-filter-bar` | Multi-filter orchestrator with active-filter display |
| `sherpa-calendar` | Full month-picker with date range logic, keyboard nav |
| `sherpa-transfer-list` | Dual-list selection widget with drag/filter |
| `sherpa-scheduler` | Time-grid scheduling widget |
| `sherpa-list` | Sub-container / content section for list-item atoms |
| `sherpa-toolbar` | Can contain multiple, varied molecules and atoms |
| `sherpa-pagination` | Can contain multiple, varied molecules and atoms |
| `sherpa-metric` | Contains multiple molecules and atoms |
| `sherpa-barchart` | Full chart with axes, gridlines, tooltip, legend |
| `sherpa-line-chart` | As above (line variant) |
| `sherpa-donut-chart` | As above (donut variant) |
| `sherpa-gauge-chart` | Radial gauge with scale and threshold logic |
| `sherpa-prompt-composer` | Multi-modal AI input with attachment, history, toolbar |
| `sherpa-proposal-op` | AI operation proposal card with action surface |
| `sherpa-proposal-preview` | AI proposal rendered output with diff/preview logic |
| `sherpa-code-block` | Syntax-highlighted viewer with copy/language switching |

---

### molecule

Composed of atoms, or structurally groups repeating atomic elements.
Serves one focused workflow step but stays simpler than an organism.

| Component | Reasoning |
| --- | --- |
| `sherpa-container-overlay` | Unified non-modal overlay surface (popover + menu variants); anchor-positioned |
| `sherpa-overlay-item` | Single option row inside an overlay; can contain button atoms |
| `sherpa-list-item` | Single row within a list; can contain atoms |
| `sherpa-key-value-list` | Structured label/value pair layout |
| `sherpa-tabs` | Tab button strip + content panel coordination |
| `sherpa-stepper` | Sequence of labelled steps with index state |
| `sherpa-progress-tracker` | Step sequence with visual progress through states |
| `sherpa-breadcrumbs` | Chain of navigable link atoms |
| `sherpa-section-header` | Heading + optional subtitle + optional action slot |
| `sherpa-nav-section` | Section label + grouped `nav-item` atoms |
| `sherpa-nav-item` | Icon + label + optional badge |
| `sherpa-node` | `node-header` + sockets + rows — composed sub-elements |
| `sherpa-node-row` | Single I/O row; contains molecules and atoms |
| `sherpa-chart-legend` | Legend swatch + label rows (repeating atom group) |
| `sherpa-chat-message` | Avatar + content + timestamp |
| `sherpa-empty-state` | Contains multiple atoms (illustration, text, buttons) |
| `sherpa-input-text` | Labelled field with helper, error, icon slots |
| `sherpa-input-number` | Numeric field with optional stepper buttons |
| `sherpa-input-password` | Text field with visibility toggle atom |
| `sherpa-input-search` | Text field with search icon atom |
| `sherpa-input-select` | Dropdown with trigger, listbox, and option atoms |
| `sherpa-input-time` | Time picker with segmented field atoms |
| `sherpa-select-group` | Unified checkbox/radio group; `data-type` drives child element type |
| `sherpa-input-date` | Text input + calendar trigger + formatted-value display |
| `sherpa-input-date-range` | Two `input-date` molecules coordinated as a range |
| `sherpa-input-tag` | Text input + growing set of tag atoms |
| `sherpa-file-upload` | Drop zone + file list + button trigger |

---

### atom

Single-purpose primitives. No internal composition of other Sherpa
components; cannot be meaningfully split further.

| Component | Reasoning |
| --- | --- |
| `sherpa-button` | Fundamental action primitive |
| `sherpa-icon` | SVG sprite display; no behaviour |
| `sherpa-tag` | Labelled chip with optional dismiss |
| `sherpa-switch` | Binary toggle control |
| `sherpa-slider` | Range-selection control |
| `sherpa-tooltip` | Hover text attached to a trigger; no slotted content |
| `sherpa-loader` | Indeterminate spinner/skeleton |
| `sherpa-progress-bar` | Linear progress indicator |
| `sherpa-sparkline` | Tiny inline trend line — display-only, no interaction |
| `sherpa-message` | Inline alert/message |
| `sherpa-callout` | Block-level callout with icon and text |
| `sherpa-toast` | Timed notification |
| `sherpa-input-checkbox` | Single checkbox + label |
| `sherpa-input-radio` | Single radio + label |
| `sherpa-node-header` | Icon + title; single-purpose header row |
| `sherpa-node-socket` | Single connection point on a node |

---

## Rename candidates

Two atoms were flagged for renaming to better reflect their `select-*`
semantic rather than the `input-*` namespace:

| Current name | Proposed name |
| --- | --- |
| `sherpa-input-checkbox` | `sherpa-select-checkbox` |
| `sherpa-input-radio` | `sherpa-select-radio` |

---

## Remaining ambiguity

- **`sherpa-view-header`** — placed in `organism` due to breadcrumbs, tab
  strip, filter-bar, and back-button coordination. Could be argued as
  `structure` if you treat all its wiring as slot-delegation.

---

## Relationship to numeric tiers

Rough correspondence only (they are independent axes):

| String tier | Numeric tiers | Roles |
| --- | --- | --- |
| `structure` | 1–2 | `shell`, `container`, `overlay` (surfaces) |
| `organism` | 1, 3–5 | `shell`, `content`, `data`, `media`, `utility` (complex standalone pieces) |
| `molecule` | 3–4 | `content`, `nav`, `control`, `input` (grouped primitives) |
| `atom` | 4 | `control`, `input`, `display`, `feedback`, `media` (leaf primitives) |
