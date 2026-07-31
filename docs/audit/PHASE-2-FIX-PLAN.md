# Phase 2 — Proposed fix plan (from the Phase-1 audit)

Grouped into verifiable batches, ordered by severity. Each batch = one commit, tests green.
DRAFT — pending the Batch 7+8 (data+viz) findings and your approval.

## Fix Batch A — P0 functional bugs + hygiene (do first; small, high-value)
1. **input-date empty day grid** (D1): `dayTpl` selector `.day-tpl` → `.cal-day-tpl`. One-word fix; verify the calendar renders days headless.
2. **switch pill variant** (S1+S2): reconcile the attribute contract (pick `data-mode="simple"` or `data-style`), wire it into observedAttributes + CSS, and confirm the 12px pill (999 radius) renders. Add a `simple` path.
3. **Remove committed `.orig`/`.rej` artifacts** (H1): delete `sherpa-input-password.ts.orig` + `.rej` from git.

## Fix Batch B — sherpa-nav to Figma v2 spec (6 P1 + safe P2s) [user pre-approved scope]
- Collapsed width 60→**40px** (+ container-query thresholds) (nav#1)
- Settings-state fill **#f2f2f2** (nav#2)
- Consume **surface-app-product-nav-bg** token not container-secondary (nav#3)
- Expanded/hover **elevation shadow** x12 y12 blur32 spread-4 (nav#4)
- Brand-block **rounding 0→16** per state (nav#5)
- Logo SVG `#C046FF` → `currentColor` / token (nav#6)
- Settings-mode **label→"Settings"** + **placeholder swap** (nav#8,9)
- nav-section active color: border-token → **content-active-base** for consistency (nav#11)
- (Event-name rename deferred — breaking, separate task.)

## Fix Batch C — foundation P1s
- **tabs**: add secondary (32/12/#fdfdfd) + product-bar styles via `data-style`; enforce text 14/20 & 12/16 (T1,T2)
- **slider**: replace bare `rgba(60,94,221,…)` glows with a token/fallback (L1) [theme-safety]
- **checkbox/radio**: add **Minimal** variant; radio add **Radio Card** (C1,R1)
- **tag**: correct fallback-hex drift (orange/pink/rose/violet) (G1)

## Fix Batch D — feedback + status consistency P1/P2
- **callout**: add `urgent` status icon + docstring (F1)
- **progress-step-tracker**: add distinct `info` + `urgent` status nodes; separate loading from info-blue (F2)
- toast docstring reconcile (F3); progress-steps focus-ring → accent (F4); message/key-value link fallbacks → accent (F5,K1)

## Fix Batch E — overlay + input P2s
- **overlay-item**: add **"Modified"** menu-item state (O1)
- **input family**: add **"minimal"** borderless variant (I1)
- switch track-on stale literal `#048142`→`#058142` (S3)

## Fix Batch F — viz theme-safety (4 P0 — HIGHEST value; the real theme-breaking cluster)
Follow the **barchart reference pattern**: assign `data-color-index="N"` and resolve via CSS
`var(--sherpa-data-viz-categorical-color-N, #hex)` instead of writing hex into inline `.style`.
- **line-chart** (V1): replace `DEFAULT_COLORS` inline `.style.color` with data-color-index + CSS.
- **donut-chart** (V2): drive conic-gradient stops from resolved data-viz tokens (read via a
  per-index CSS custom property or getComputedStyle); the dead `.color-N` classes already exist.
- **gauge-chart** (V3): the RAG segment ramp should consume **status tokens** (`--_status-*`), not
  a hardcoded green/amber/red array.
- **chart-legend** (V4): stop writing `swatchStyle: background-color: ${hex}`; use the token classes.
Verify headless: switch theme (apex-2-teal) and assert chart series colours actually change.

## Fix Batch G — data + viz variant gaps (P1)
- **barchart**: grouped (side-by-side) + full-stacked modes (V5); extend palette to 11 (V7).
- **line-chart**: stacked + full-stacked area (V6).
- **data-grid**: per-column header alignment API (left/center/right) (DG1); "Primary" cell type (DG2).
- **pagination**: numbered page buttons (PG1).
- (P2s: grid dropdown/edit cells, gauge level presets, breadcrumbs brand icon, doc fixes.)

## Recommended sequencing
**A (P0 bugs+hygiene) → F (viz P0 theme-safety) → B (nav) → C (foundation) → D/E (feedback/overlay/input P2) → G (variant gaps).**
A and F are the highest-value (functional + theme-breaking); do them first.

## Deferred (breaking / larger, separate tasks)
- nav event-name migration to ratified `noun-verb` contract (navitemclick → nav-item-click) — breaks consumers + tests.
- product-bar-v2 Layout=Small responsive variant.
- Unused typeface primitives cleanup (from Phase 0).

---

## EXECUTION STATUS (updated)
- ✅ **Batch A** (P0 functional + hygiene) — `cc82534`: input-date grid, switch pill, .orig/.rej.
- ✅ **Batch F** (P0 viz theme-safety) — `706593d`: line/donut/gauge/legend → tokens; new data-viz-colors.ts.
- ✅ **Batch B** (nav v2 spec) — `2c75c6b`: 40px, settings fill, product-nav token, shadow, rounding, SVG hex, label/placeholder swaps, nav-section active colour + product-nav token drift.
- ✅ **Batch C** (foundation P1) — `69e4b26`: slider glow→token, tabs 3 styles, checkbox/radio Minimal+Card, tag hex drift.
- ✅ **Batch G** (data variant gaps) — `196e47b`: grid per-column alignment, pagination numbered pages.

**All P0s fixed. All P1s except the deferred items below.**

### Deferred (larger / breaking — separate focused tasks)
- **barchart grouped + full-stacked** (V5) — multi-series side-by-side rendering; needs visual verification.
- **line-chart stacked/full-stacked area** (V6).
- **data-grid "Primary" cell type** (DG2) + dropdown/edit cell variants (DG3).
- **nav event-name rename** to noun-verb contract — breaking; updates consumers/tests.
- **product-bar-v2 Layout=Small** responsive variant.
- Remaining P2 polish (D/E batches): callout urgent, progress-steps info/urgent nodes, overlay-item
  "Modified" state, minimal input variant, misc docstring/fallback reconciliations, unused typeface primitives.
