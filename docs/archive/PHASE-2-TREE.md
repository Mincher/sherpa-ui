# Phase 2 — Shared Tree Primitive → Advanced SelectBox + Treeview

**Date:** 2026-07-30
**Delivered:** one tree engine (`sherpa-tree`), two use-sites. Closes two Apex gaps (Advanced SelectBox + Treeview) in a single build, deliberately simpler than Apex.

## What shipped

### `sherpa-tree` — the primitive
A standalone hierarchical tree component. All node rendering, expand/collapse, keyboard a11y, and selection live here.

- **Render:** recursive clone from a `<template class="node-tpl">` prototype — no `createElement` / structural `innerHTML` (house rule).
- **Keyboard (WAI-ARIA tree):** ArrowUp/Down (visible rows), Left/Right (collapse/expand or ascend/descend), Home/End, type-ahead, Enter/Space (activate), `*` (expand all); roving tabindex on rows.
- **ARIA:** `role="tree"` → `treeitem[aria-expanded]` → `group`; `aria-selected` on the selected leaf; `aria-disabled` honoured.
- **Selection modes** (`data-selection`):
  - `single` (default) — one selectable leaf → `tree-select` + `change` with `{value, path}`.
  - `multi` — checkboxes, checking a parent cascades to all leaf descendants, parents show **indeterminate** when partially checked → `change` with `{value: string[]}`.
  - `none` — display/navigation only.
- **API:** `data-nodes` JSON forest / `setNodes()`, `getValue()`/`setValue()`, `expandAll()`/`collapseAll()`; `empty` slot (`data-accepts="content,display,html"`).

### Advanced SelectBox = `sherpa-input-select` + `data-template="tree"`
The tree-in-a-dropdown. `sherpa-input-select` now hosts a `<sherpa-tree>` inside its popup panel and reacts to its `tree-select` event; it owns only the dropdown open/close + value display. This **replaced** the old hand-built tree DOM (the Phase 0.1 `createElement`/`innerHTML` violations — now resolved). Deliberately **simpler than Apex**: no server datasource, toolbar, or state-storing.

### Treeview = `sherpa-tree` in any container
**There is no separate `sherpa-treeview` element.** A standalone treeview is just the primitive dropped into a panel/list/container:

```html
<!-- Treeview: the primitive in a plain container -->
<sherpa-panel data-heading="Files">
  <sherpa-tree data-nodes='[{"value":"src","label":"src","children":[…]}]'></sherpa-tree>
</sherpa-panel>

<!-- Advanced SelectBox: the same primitive inside a dropdown -->
<sherpa-input-select data-template="tree" data-tree='[…]'></sherpa-input-select>

<!-- Multi-select treeview with checkboxes + indeterminate parents -->
<sherpa-tree data-selection="multi" data-nodes='[…]'></sherpa-tree>
```

"Structured Flexibility" — same engine, different host.

## Verification
- Type-check ✓ · 0 lint errors · 0 TS suppressions · MCP schema correct.
- Core algorithms unit-tested (recursion → leaf flattening; indeterminate math; toggle cascade — all pass).
- Full DOM + keyboard + axe test written at `test/sherpa-tree/sherpa-tree.test.ts` — runs once the web-test-runner harness is provisioned (no launcher/esbuild adapter installed yet; a Phase 7 task).
- Conformance: `sherpa-input-select` tree violations cleared (7→3 createElement, all remaining are legit native `<option>`).

## Follow-ups (not blocking)
- **Hierarchical nav (Phase 3):** `sherpa-nav-section` can reuse `sherpa-tree` where a true tree structure applies.
- **Test harness (Phase 7):** install `@web/test-runner-puppeteer` + `@web/dev-server-esbuild` and add a `web-test-runner.config.js` so the written tree tests (and the other 10 `.test.ts` files) actually execute.
- **Multi-select in the SelectBox:** the primitive supports `data-selection="multi"`; exposing it through `sherpa-input-select` (multi-value chips in the trigger) is a small follow-on if needed.
