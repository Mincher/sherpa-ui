# Phase 1 — Per-component audit (Figma "App Shell v2" vs code)

Ranked P0 (functional/theme-breaking) · P1 (visible mismatch) · P2 (token/cleanliness).
Audit only — fixes gated on approval.

## Batch 1 — App-shell spine

**Theme-safety: PASS.** Zero bare brand/accent hexes in component CSS — every hex is a
`var(--sherpa-*, #hex)` fallback. One bare-hex exception is in HTML (nav logo SVG).

### sherpa-nav (most gaps — under-implements Figma Nav v2 state spec)
| # | Sev | Finding | Location |
|---|---|---|---|
| 1 | P1 | Collapsed width **60px**, Figma = **40px** | `sherpa-nav.css:24` `--_w-collapsed` (+ container-query thresholds 319/320) |
| 2 | P1 | Settings-state fill **#f2f2f2 not implemented** (no per-state fill at all) | `sherpa-nav.css:36` |
| 3 | P1 | Uses generic `surface-container-secondary` not the dedicated `surface-app-product-nav-bg` token | `sherpa-nav.css:36,373,423` |
| 4 | P1 | Expanded/hover **elevation shadow missing** (Figma x12 y12 blur32 spread-4) | `sherpa-nav.css:45-55` |
| 5 | P1 | Brand-block **rounding 0→16 per state not implemented** | `.nav-logo` `sherpa-nav.css:380-388` |
| 6 | P1 | Bare `fill="#C046FF"` in logo SVG (breaks theming) | `sherpa-nav.html:42` |
| 7 | P2 | Header button set differs from Figma (Settings in footer; Recent/Fave as list sections) | `sherpa-nav.html:46-63` |
| 8 | P2 | Search placeholder doesn't swap to "Search settings items..." in Settings | `sherpa-nav.html:79` |
| 9 | P2 | Header label doesn't swap to "Settings" in Settings mode | `sherpa-nav.html:45` |
| 10 | P2 | Event names concatenated (`navitemclick`…) violate ratified `noun-verb` contract | `sherpa-nav.ts` @fires + dispatch sites |

**Correct:** Recents = last-5 selected (not history); Favorites, tagged items, collapsed
group/subgroup + dot, search states, 4 modes all present.

### sherpa-nav-item / nav-section
| # | Sev | Finding | Location |
|---|---|---|---|
| 11 | P2 | Active-color inconsistency: nav-item uses `content-active-base` (#8500cc); nav-section uses `border-control-active-default` (#c046ff) as **text color** — a border token driving `color` | `sherpa-nav-section.css:121,137` |

### sherpa-product-bar (v1, @deprecated)
| # | Sev | Finding | Location |
|---|---|---|---|
| 12 | P2 | Brand block uses `surface-control-primary` (accent #3c5edd); Figma product-block = brand #8500cc | `sherpa-product-bar.css:48` |

### sherpa-product-bar-v2
| # | Sev | Finding | Location |
|---|---|---|---|
| 13 | P2 | Missing Figma **Layout=Small (375px)** responsive variant (no narrow `@container`) | `sherpa-product-bar-v2.css` |

### sherpa-app-header
| # | Sev | Finding | Location |
|---|---|---|---|
| 14 | P2 | Dead breadcrumb CSS (`.crumb`, `.crumb-sep`) — crumbs now delegate to child | `sherpa-app-header.css:53-68` |

**Correct:** breadcrumbs delegate, favorite/back/slots match Figma 3-region anatomy.

### sherpa-view-header
| # | Sev | Finding | Location |
|---|---|---|---|
| 15 | P2 | Extra affordances beyond Figma (feedback iframe, debug toggles, inline theme selectors) | `sherpa-view-header.html:65-80`, `.ts:135-168` |

**Correct:** view selection NOT re-implemented (moved to QFT); owns title/breadcrumbs/fave/export/back.

### Batch-1 roll-up
- **P0:** none.
- **P1 (6, all sherpa-nav):** collapsed 40px; settings #f2f2f2 fill; product-nav surface token;
  expanded shadow; brand rounding 0→16; bare #C046FF SVG.
- **P2 (9):** nav header/placeholder/label swaps + event contract; active-color inconsistency;
  product-bar v1 token; product-bar-v2 small variant; app-header dead CSS; view-header scope creep.

## Batch 2 — Foundation controls

**Theme-safety:** all brand/accent hexes are `var(--token,#hex)` fallbacks EXCEPT two bare
`rgba(60,94,221,…)` accent glows in the slider (theme-breaking smell).

### sherpa-button — FULLY COMPLIANT ✅
All 4 types (primary/secondary/tertiary/tertiary-on-color) × 5 sizes (32/48/24/20/16 exact) +
icon-only, theme-safe. (P2: extra `ai` variant/`active` state are superset — flag only.)

### sherpa-switch
| # | Sev | Finding | Location |
|---|---|---|---|
| S1 | **P0** | `simple`/pill variant template does not exist (only `default`) | `sherpa-switch.html:29` |
| S2 | **P0** | Attribute contract broken — CSS keys `data-style="compact"`, docs/TS use `data-mode="simple"`; neither observed/wired → 12px pill unreachable | css:31 vs html:11 / ts:36 |
| S3 | P2 | Track-ON fallback `#048142` vs Figma `#058142` (token now correct post-Phase-0; only literal stale) | css:19 |

### sherpa-tabs
| # | Sev | Finding | Location |
|---|---|---|---|
| T1 | P1 | Only 1 of 3 Figma styles — secondary (32px/12px/#fdfdfd) + product-bar (transparent) unimplemented; no `data-style` | `sherpa-tabs.css` |
| T2 | P1 | Text size/lh not enforced (14/20 primary, 12/16 secondary); relies on `font: inherit` | css:64 |
| T3 | P2 | Confirm selected indicator (2px #c046ff border) vs Figma | css:82 |
**Correct:** selected content #8500cc, default #404047, fill/border match.

### sherpa-tag
| # | Sev | Finding | Location |
|---|---|---|---|
| G1 | P1 | Fallback-hex drift: orange #ffaa01≠#ffaa00, pink #f3689d≠#f3699d, rose #d1115a≠#d1105a, violet rgba #7892fa≠#8197f1 | css:84-96 |
**Correct:** all 11 colours present, transparent @66α (≈0.4), dark/white text split.

### sherpa-select-checkbox
| # | Sev | Finding | Location |
|---|---|---|---|
| C1 | P1 | **Minimal** variant not implemented | `sherpa-select-checkbox.*` |
**Correct:** 16px control, 2px radius, checked accent #3c5edd, Default/Hover/Disabled.

### sherpa-select-radio
| # | Sev | Finding | Location |
|---|---|---|---|
| R1 | P1 | **Minimal** + **Radio Card** variants not implemented | `sherpa-select-radio.*` |
| R2 | P2 | Dot 10px vs Figma 14px-inner (deliberate deviation — confirm) | check.css:138 |

### sherpa-slider
| # | Sev | Finding | Location |
|---|---|---|---|
| L1 | P1 | Bare `rgba(60,94,221,…)` accent glow — no token/fallback, breaks theming | css:169,177 |
| L2 | P2 | Bare `4px`/`24px` track/handle literals (tokenize); `range` vs Figma "Dual" naming | css:43-44 |
**Correct:** single+dual, handle Default/Hover/Active, disabled, accent fills theme-safe.

### Batch-2 roll-up
- **P0 (2):** switch simple-variant missing + attribute-contract broken.
- **P1 (7):** tabs 2-of-3-styles + text-size; slider bare-rgba glow; checkbox Minimal; radio Minimal+Card; tag fallback drift.
- **P2:** switch green literal; radio dot size; slider literals/naming; tabs indicator; button superset.

## Batch 3+4 — Inputs + Overlays

**Theme-safety: PASS.** Every accent/brand hex is a `var(--token,#hex)` fallback. input-base
sharing clean (all 9 field inputs extend SherpaInputBase; file-upload correctly extends
SherpaElement as a dropzone).

### sherpa-input-date
| # | Sev | Finding | Location |
|---|---|---|---|
| D1 | **P0** | `dayTpl` selector `.day-tpl` ≠ HTML class `.cal-day-tpl` → els.dayTpl null → #renderCalendar bails → **empty calendar day grid**. Sibling date-range uses `.cal-day-tpl` correctly. | `sherpa-input-date.ts:57` vs `.html:64` |
**Correct:** all date states (Today/Selected/Focus/Disabled/Hover) styled — but unreachable due to D1.

### sherpa-overlay-item (Menu Item)
| # | Sev | Finding | Location |
|---|---|---|---|
| O1 | P1 | **"Modified" state absent** (6 of 7 Figma menu-item states). No data-modified in CSS/TS. | `sherpa-overlay-item.*` |
| O2 | P2 | Figma "Destructive" ↔ code `data-variant="danger"` (naming) | `.css:99` |
**Correct:** Default/Hover/Active/Destructive/Destructive-Hover/Inactive, heading/section, ARIA.

### sherpa-input-text (+ family)
| # | Sev | Finding | Location |
|---|---|---|---|
| I1 | P2 | Figma **"Input Field (minimal)"** borderless variant not implemented anywhere in the input family | input family |
**Correct:** Input Area = data-multiline textarea; validation/inactive/readonly states.

### Cross-cutting hygiene
| # | Sev | Finding | Location |
|---|---|---|---|
| H1 | P2 | Committed `.orig` + `.rej` failed-patch artifacts in git | `sherpa-input-password.ts.orig`, `.rej` |

### CORRECT (no findings): input-base, container-overlay, dialog, tooltip, file-upload.

### Batch 3+4 roll-up
- **P0 (1):** input-date empty day-grid (selector bug).
- **P1 (1):** overlay-item missing "Modified" state.
- **P2 (3):** minimal input variant; danger/Destructive naming; committed .orig/.rej.

## Batch 5+6 — Feedback + Content

**Theme-safety: PASS.** Zero bare hexes. Status components all use the `--_status-*` cascade
(no hardcoded per-status blocks). Card/list-item/panel implement full Figma state matrices.

### Feedback
| # | Sev | Finding | Location |
|---|---|---|---|
| F1 | P1 | **callout missing `urgent` status** (no icon glyph; docstring omits it) — inconsistent with message/toast | `sherpa-callout.css:61-64` |
| F2 | P1 | progress-step-tracker status-node lacks distinct **info + urgent**; `in-progress` conflated with info-blue | `.ts:50`, `.css:156-165` |
| F3 | P2 | toast status docstring mismatch (CSS 4 vs HTML 5/urgent); no CSS icon-glyph map | `sherpa-toast.css:8` |
| F4 | P2 | progress-steps focus ring brand-purple, inconsistent with accent-blue primary | `.css:102` |
| F5 | P2 | message action link fixed accent, not status-tinted | `sherpa-message.css:100` |
**Correct:** accordion, loader, progress-bar (determinate+indeterminate) fully compliant.

### Content — ALL CORRECT (1 P2)
| # | Sev | Finding | Location |
|---|---|---|---|
| K1 | P2 | key-value link/focus fallbacks (info-blue/brand-purple) inconsistent with accent | `.css:157,166` |
**Correct:** container (Default/Hover/Active card + footer), container-header/footer/group, panel
(inline left/right collapse/expand + overlay), list, list-item (4 states), empty-state, section-header.

### Batch 5+6 roll-up
- **P0:** none.
- **P1 (2):** callout urgent; progress-steps info/urgent nodes.
- **P2 (4):** toast docstring; progress-steps focus; message link; key-value link fallbacks.

## Batch 7+8 — Data + Viz

**Theme-safety: 4 P0s** — the only real theme-breaking cluster in the codebase. line-chart,
donut, gauge, chart-legend hardcode hex color arrays applied via inline `.style`, overriding
theme tokens → **chart colors don't re-theme**. barchart is the correct reference (data-color-index
→ `var(--sherpa-data-viz-categorical-color-N)`); metric/sparkline clean.

### Viz
| # | Sev | Finding | Location |
|---|---|---|---|
| V1 | **P0** | line-chart inline hardcoded palette (`DEFAULT_COLORS` → `.style.color`) | `sherpa-line-chart.ts:36-44,467,527` |
| V2 | **P0** | donut inline hardcoded palette; CSS `.color-N` token classes are DEAD (never applied) | `sherpa-donut-chart.ts:46-53,336-357` |
| V3 | **P0** | gauge segment inline hardcoded palette (RAG ramp — should use STATUS tokens) | `sherpa-gauge-chart.ts:29-32,180-191` |
| V4 | **P0** | chart-legend inline `swatchStyle: background-color: ${hex}` overrides token classes | `sherpa-chart-legend.ts:36-37,103` |
| V5 | P1 | barchart: **grouped** (side-by-side) + **full-stacked** modes missing (only series[0] non-stacked) | `sherpa-barchart.ts:932-959` |
| V6 | P1 | line-chart: stacked + full-stacked **area** missing (only line/area) | `sherpa-line-chart.ts:90` |
| V7 | P2 | barchart palette capped at 8, Figma defines 11 (colors 9-11 unreachable) | `.ts:57`, `.css:577` |
| V8 | P2 | gauge 25/50/75 level presets not modeled | `sherpa-gauge-chart` |
**Correct:** barchart token model (reference), metric (status trend), sparkline (status cascade).

### Data
| # | Sev | Finding | Location |
|---|---|---|---|
| DG1 | P1 | data-grid: no per-column header **alignment API** (left/center); only numeric auto-right | `sherpa-data-grid.css:238` |
| DG2 | P1 | data-grid: **"Primary" cell type** not implemented (emphasized identity cell) | `sherpa-data-grid` |
| DG3 | P2 | data-grid: **dropdown + inline-edit** cell variants missing (has default/date/status/link/boolean) | `#createCell ts:888-931` |
| PG1 | P1 | pagination: no **numbered page buttons** (uses "N of total" indicator) | `sherpa-pagination.html:36-40` |
| BC1 | P2 | breadcrumbs: no **brand-icon** slot (Classic/Apex-2.0) | `sherpa-breadcrumbs` |
| PG2 | P2 | pagination: stale `pagechange` doc comment (code fires `page-change`) | `.html:16` |
**Correct:** grid numeric right-align, tristate parent checkbox (Advanced), selection+action cols;
breadcrumbs Historic/Current treatment; pagination page-size/prev/next.

### Batch 7+8 roll-up
- **P0 (4):** line/donut/gauge/legend hardcoded palettes (theme-breaking).
- **P1 (5):** barchart grouped/full-stacked; line-chart stacked area; grid header-align + Primary cell; pagination numbered pages.
- **P2 (5):** barchart 8-vs-11 palette; grid dropdown/edit cells; gauge levels; breadcrumbs brand icon; pagination doc.

---

# CONSOLIDATED ROLL-UP (all batches)
- **P0 (7):** switch pill-variant+attr (×2), input-date empty grid, line/donut/gauge/legend hardcoded palettes (×4).
- **P1 (~20):** nav v2 states (6), tabs styles (2), slider glow, checkbox/radio Minimal/Card (2), tag drift,
  callout urgent, progress-steps nodes, barchart/line modes (2), grid header-align + Primary (2), pagination pages.
- **P2 (~22):** naming/docstrings, fallback-hex drift, missing minor variants, dead CSS, committed artifacts.
- **Theme-safety:** clean everywhere EXCEPT the 4 viz P0s + slider glow. Content/feedback/foundation-button/
  overlays/inputs-base are exemplary.
