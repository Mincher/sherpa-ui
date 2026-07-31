# Phase 1 — Per-component audit plan (Figma vs code)

## Audit dimensions (per component)
1. **Anatomy** — code shadow structure / slots / parts vs the Figma component's layers & slots.
2. **Variants & modes** — every Figma variant + extension-collection mode represented in code.
3. **Token correctness** — right `--sherpa-*` tokens for fill/border/content/spacing (vs the resolved Figma values).
4. **Theme-safety** — NO bare brand/accent hexes (#f8ebff/#8500cc/#c046ff/#3c5edd…) as values; must consume `--sherpa-*` brand/accent tokens so themes switch. (`var(--token, #hex)` fallbacks OK.)
5. **Sizing** — dimensions vs Figma (button 32/48/24/20/16, chip 24, switch control 16/12, etc.).

Severity: **P0** functional/theme-breaking · **P1** visible mismatch · **P2** token/cleanliness.

## Figma page ↔ code component map
| Figma page | Code | Priority |
|---|---|---|
| Quick Filter Toolbar | quick-filter-toolbar, quick-filter | ✅ done |
| Product Bar / v2 | product-bar, product-bar-v2 | App-shell core |
| Product Navigation v2 | nav, nav-item, nav-section | App-shell core |
| App Header | app-header | App-shell core |
| View Header | view-header | App-shell core |
| Button | button | Foundation |
| Tab | tabs | Foundation |
| Tag / Chip | tag, quick-filter | Foundation |
| Switch / Checkbox / Radio | switch, select-checkbox, select-radio | Foundation |
| Slider | slider | Foundation |
| Input Field(s) / Date&Time / Field Validation | input-text/number/password/search/select/tag/date/date-range/time | Inputs |
| Dialog / Popover / Overlay / Menu / Tooltip | dialog, container-overlay, overlay-item, tooltip | Overlays |
| Accordion / Banner / Callout / Toast / Loader / Progress Bar / Progress Steps | accordion, message, callout, toast, loader, progress-bar, progress-step-tracker | Feedback |
| Card / Panel / List / Key Value / Empty State / Widget / Headers | container(+header/footer/group), panel, list(+item), key-value-list, empty-state, section-header | Content |
| Data Grid | data-grid | Data |
| Breadcrumbs / Pagination | breadcrumbs, pagination | Nav |
| File Uploader | file-upload | Inputs |
| Data Viz | barchart, line-chart, donut-chart, gauge-chart, metric, sparkline, chart-legend | Viz |
| (node-graph family) | node, node-canvas, node-row, node-socket | DEFERRED |
| (AI / N-zo) | prompt-composer, proposal-*, chat-message | AI (per Figma "update required") |

## Execution approach
Because subagents can't reach the Figma desktop bridge reliably, **I read each Figma
component page's anatomy/variants/token usage** (plugin API) and save a compact spec per
family to `docs/audit/specs/`. Then per-family diff (code vs spec + token/theme rules)
produces a ranked gap list.

Batch order (by app-shell value, foundation-first):
1. **App-shell spine**: product-bar(+v2), nav family, app-header, view-header
2. **Foundation controls**: button, tabs, tag, switch, checkbox, radio, slider
3. **Inputs**: input-* family, file-upload
4. **Overlays**: dialog, container-overlay, overlay-item, tooltip
5. **Feedback**: accordion, message, callout, toast, loader, progress-bar, progress-steps
6. **Content**: container family, panel, list, key-value, empty-state, section-header
7. **Data**: data-grid
8. **Nav/misc**: breadcrumbs, pagination
9. **Viz**: charts, metric, sparkline, legend

Each batch → gap report appended to `PHASE-1-AUDIT.md`. **GATE: full audit reviewed before any Phase 2 fixes.**
