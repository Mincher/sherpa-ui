# Slot Contracts (`data-accepts`) — Authoring Standard

**Purpose:** every slot that accepts author-provided content declares what it legitimately holds, so the generative-UI validator (Phase 8) can enforce *structural nesting* — not just attributes. This is the Phase 0.4 foundation for Phase 8.

## How the two enforcement layers work (already in `SherpaElement`)

`SherpaElement.#validateSlot` (`components/utilities/sherpa-element/sherpa-element.ts`) enforces:

1. **Tier rule — always on, even without `data-accepts`.** A child whose composition tier is *lower* (more page-level) than its host is rejected. Tiers come from `component-categories.ts`.
2. **Allowlist rule — only when `data-accepts` is present.** The slotted child's **category** must be in the slot's `data-accepts` list. Non-sherpa elements are allowed only if the list includes `html`.

Warnings are advisory unless the component sets `static strictSlots = true`.

## The vocabulary — `ComponentCategory` (from `component-categories.ts`)

`data-accepts` is a comma-separated list drawn from these category tokens (**not** tag names):

| Token | Meaning | Example members |
|---|---|---|
| `container` | Structural card/tile wrappers | sherpa-container, -group, -header, -footer, accordion |
| `content` | Content molecules | sherpa-list-item, key-value-list, metric, section-header |
| `control` | Interactive atoms | sherpa-button, breadcrumbs, pagination, switch |
| `input` | Form inputs | sherpa-input-*, calendar, file-upload, select-* |
| `display` | Display/feedback | sherpa-tag, message, loader, progress-bar, tooltip |
| `data` | Data-heavy | sherpa-data-grid, charts |
| `overlay` | Overlay items | sherpa-overlay-item |
| `html` | **Allow non-sherpa light-DOM** (plain elements/text) | any `<div>`, `<span>`, text |

**Rule of thumb:** list every category the slot legitimately holds, and add `html` when authors may pass plain markup/text (most content/action slots should). Omit `html` for slots that must contain only specific sherpa components (e.g. a toolbar `actions` slot = `control` only).

## Authoring examples (canonical)

```html
<!-- holds list-item molecules + arbitrary markup -->
<slot data-accepts="content,html"></slot>

<!-- a container-group holds only container tiles -->
<slot data-accepts="container,html"></slot>

<!-- toolbar region: mixed interactive + display + markup -->
<slot name="leading" data-accepts="control,input,display,content,html"></slot>

<!-- strict action slot: only buttons -->
<slot name="actions" data-accepts="control"></slot>
```

## Status (Phase 0.4)

Baseline audit (`node scripts/slot-contract-audit.mjs .`): **35 components with slots, 138 slots, ~9% annotated** at start.

**Annotated in this pass (starter set — stable, high-value generative-UI targets):**
- `sherpa-list` default slot → `content,html`
- `sherpa-container-group` default → `container,html`
- `sherpa-container-footer` `start` slot → `control,input,display,content,html`
- `sherpa-toolbar` — completed the second template's `leading/center/trailing` slots (were unannotated) to match the first.

### Backlog — remaining slots to annotate, grouped by when

**Do during Phase 0.4 continuation (stable containers/layout):**
- `sherpa-layout-grid` (main + side-panel slots → `container,content,html`; header/tab-row → specific)
- `sherpa-container`, `sherpa-container-header`, `sherpa-accordion`, `sherpa-callout`, `sherpa-dialog`, `sherpa-tabs`, `sherpa-section-header`, `sherpa-empty-state`, `sherpa-list-item`, `sherpa-nav-item`, `sherpa-nav-section`, `sherpa-select-group`, `sherpa-tag`, `sherpa-loader`.

**Defer to owning phase (component being reworked):**
- App-shell / nav / product-bar-v2 / view-header → **Phase 3** (App Shell v2 rewrites these; annotate as built).
- filter-bar → **Phase 4** (replaced by quick-filter-toolbar).
- AI surface (panel, chat-message, prompt-composer, proposal-op, proposal-preview) + node family (node, node-canvas, node-row, node-header) → **Phase 5**.
- data-grid, container-overlay, overlay-item → annotate when next touched (Phase 6 / overlay work).

**Skip (deprecated):** `sherpa-product-bar` (v1), `sherpa-node-header` — being removed (see [DEPRECATIONS.md](DEPRECATIONS.md)).

### Definition of done for Phase 0.4
Every **stable, non-reworked** component with slots has accurate `data-accepts` on every content-bearing slot; the audit script reports 100% for that set; reworked components carry the obligation into their phase (noted in each phase's DoD). Turn on `static strictSlots = true` per component once its contracts are firm and tested.

## Reproduce
`node scripts/slot-contract-audit.mjs .` — lists every slot and its allowlist status + a coverage summary.
