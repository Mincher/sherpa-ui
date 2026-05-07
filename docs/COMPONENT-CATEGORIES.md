# Component Categories (Roles)

> Every Sherpa component declares a single **role** via the `@category` JSDoc
> tag. Roles are the unit of slot composability — slots in component templates
> declare which roles they accept via `data-accepts`, and the runtime validates
> slotted children against that allowlist **and** a global tier hierarchy.

This taxonomy is **role-oriented** (what a component _is for_), not
layout-oriented (where it sits in a sidebar). It is intentionally small.

---

## 1 The Eleven Roles

| Role        | Tier | Purpose                                                        | Examples                                                                                                              |
| ----------- | :--: | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `shell`     | 1 | Top-level page scaffolding.                                       | `sherpa-view-header`, `sherpa-product-bar`, `sherpa-product-bar-v2`, `sherpa-nav`, `sherpa-layout-grid`, `sherpa-layout-view`, `sherpa-footer`, `sherpa-container-pdf-exporter` |
| `nav`       | 1 | Navigation chrome children, only inside the `shell` nav rail.     | `sherpa-nav-item`, `sherpa-nav-promo`, `sherpa-section-nav` |
| `container` | 2 | Surfaces that hold other components.                              | `sherpa-card`, `sherpa-container`, `sherpa-content-section`, `sherpa-accordion`, `sherpa-panel`, `sherpa-list-panel`, `sherpa-ai-panel` |
| `overlay`   | 2 | Floating UI surfaces.                                             | `sherpa-dialog`, `sherpa-popover`, `sherpa-tooltip`, `sherpa-menu`, `sherpa-menu-item` |
| `content`   | 3 | Structural sub-elements (headings, toolbars, tabs, lists).        | `sherpa-section-header`, `sherpa-container-header`, `sherpa-toolbar`, `sherpa-list`, `sherpa-list-item`, `sherpa-key-value-list`, `sherpa-tabs`, `sherpa-stepper`, `sherpa-progress-tracker` |
| `control`   | 4 | Actionable / clickable controls.                                  | `sherpa-button`, `sherpa-switch`, `sherpa-tag`, `sherpa-slider`, `sherpa-pagination`, `sherpa-breadcrumbs` |
| `input`     | 4 | Form fields capturing user data.                                  | `sherpa-input-text`, `sherpa-input-number`, `sherpa-input-select`, `sherpa-input-date`, `sherpa-input-checkbox`, `sherpa-file-upload` |
| `display`   | 4 | Read-only data presentation primitives.                           | `sherpa-metric`, `sherpa-sparkline`, `sherpa-progress-bar`, `sherpa-gauge-chart` |
| `feedback`  | 4 | Status, messages, notifications.                                  | `sherpa-message`, `sherpa-callout`, `sherpa-toast`, `sherpa-loader`, `sherpa-empty-state` |
| `media`     | 4 | Charts, illustrations, visual media.                              | `sherpa-barchart`, `sherpa-line-chart`, `sherpa-donut-chart`, `sherpa-gauge-chart`, `sherpa-chart-legend` |
| `data`      | 4 | Interactive datasets.                                             | `sherpa-data-grid`, `sherpa-transfer-list`, `sherpa-scheduler`, `sherpa-filter-bar` |

> Some components naturally span two purposes (e.g. `sherpa-gauge-chart` is
> both `media` and `display`). Pick the **primary** role.

---

## 2 Declaring a Role

In every component's JS file, add a single `@category` tag to the JSDoc
header, after `@element`:

```js
/**
 * sherpa-button.js
 * SherpaButton — Primary action control.
 *
 * @element sherpa-button
 * @category control
 *
 * @attr {enum} data-variant — primary | secondary | tertiary
 * ...
 */
```

The role appears in the generated schema as a top-level `category` field.

---

## 3 Constraining a Slot

In the component's HTML template, add `data-accepts="<role[,role]>"` to any
`<slot>` that should restrict its children:

```html
<!-- sherpa-accordion.html -->
<template id="default">
  <header class="summary">
    <span class="label"><slot name="label"></slot></span>
    <slot name="actions" data-accepts="control"></slot>
  </header>
  <div class="content"><slot></slot></div>
</template>
```

Multiple roles are comma-separated:

```html
<slot name="footer" data-accepts="control,content"></slot>
```

Slots **without** `data-accepts` are unconstrained (back-compatible).

---

## 4 Composition Tiers

Roles are grouped into four tiers reflecting where they live in the
application structure:

| Tier | Roles                                                  | Meaning                                |
| :--: | ------------------------------------------------------ | -------------------------------------- |
|  1   | `shell`, `nav`                                         | Page chrome — the outermost frame.     |
|  2   | `container`, `overlay`                                 | Major surfaces that hold content.      |
|  3   | `content`                                              | Structural sub-elements within surfaces.|
|  4   | `control`, `input`, `display`, `feedback`, `media`, `data` | Leaf primitives.                  |

### The tier rule

> A slot in a tier-N component may host children whose tier is **N or
> deeper** (i.e. tier number ≥ N).

In practice:

- A `shell` slot can host anything.
- A `container` slot can host containers, overlays, content, or leaves —
  but **not** other shells or nav-rail children.
- A `content` slot can host content or leaves.
- A leaf slot can only host other leaves.

The runtime validator enforces this for every slot, regardless of whether
`data-accepts` is set. Annotating a slot with `data-accepts` adds an
additional role-level filter on top of the tier rule.

### Why `nav` is tier 1

`nav` components (`sherpa-nav-item`, `sherpa-nav-promo`, `sherpa-section-nav`)
are children of the `sherpa-nav` shell rail and never belong inside a
container or content host. Pairing them with `shell` at tier 1 enforces this
naturally.

### Breadcrumbs

`sherpa-breadcrumbs` is a `control` (tier 4). The view-header renders
breadcrumbs inline via the `data-breadcrumbs` JSON attribute rather than
exposing a slot — see `sherpa-view-header`.

---

## 5 Runtime Behaviour

When `SherpaElement.strictSlots` is enabled, a child whose category is not in
its slot's `accepts` list is:

1. **Kept in the DOM** (non-destructive — preserves consumer state).
2. Flagged with `data-slot-rejected="true"`.
3. Hidden by a global CSS rule (`sherpa-* > [data-slot-rejected] { display: none !important; }`).
4. Logged once via `console.warn` with the slot name and offending tag.

Free-form HTML (non-`sherpa-*` elements) is rejected by default; opt in per
slot with `data-accepts="...,html"`.

---

## 6 Adding a New Component

1. Pick the single best-fitting role from §1.
2. Add `@category <role>` to the JSDoc header.
3. Re-run `npm run schemas` to regenerate `schemas/components/<tag>.json`.
4. The component is now offered automatically in any matching slot picker
   (playground, MCP `recommend_components_for_slot`).

If no existing role fits, propose a new one **before** adding it — the
taxonomy is intentionally small.
