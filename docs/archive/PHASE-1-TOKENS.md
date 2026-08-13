# Phase 1 — Token & Naming Consolidation — Findings

**Date:** 2026-07-30
**Context:** upstream rewrote the token pipeline to be **config-driven** (`figma-config.json` + `token-overrides.json` → `generate-css-tokens.js`) shortly before this phase. All work below was re-scoped against that current pipeline.

## Fixes shipped

| # | Item | Outcome |
|---|---|---|
| 1.6 | **Brand-status import drop** (generator bug) | `emitIndex()` omitted `@import "sherpa-brand-status.css"`, so every build silently dropped it and broke `[data-status="brand"]`. Fixed; regeneration now yields zero diff. |
| 1.5 | **Platform drift** (font-weights, motion) | Moved hardcoded values into `token-overrides.json` (mirroring breakpoints); corrected the stale "no Figma source" header. Verified: font weights + motion **do** exist in Figma (weights as style *names* not CSS numbers; motion as `motion/duration/*`). Values unchanged — pure refactor. Breakpoints were already config-sourced upstream. |

## Verification — clean pass (no fixes needed)

| # | Check | Result |
|---|---|---|
| 1.2 | **Data-viz palette** | ✅ All **99** `--sherpa-data-viz-*` tokens generated (categorical ×11, sequential per-hue, divergent ×11 across ramps — full Apex parity). Every hex in chart CSS is a `var(--sherpa-data-viz-*, #hex)` **fallback — zero bare hardcodes** in barchart/gauge/donut. Charts consume the token palette correctly. |
| 1.4 | **Themes** | ✅ All 5 present: `apex-2-core`, `apex-2-blue`, `apex-2-purple`, `apex-2-teal`, `classic`. |
| 1.4 | **Modes** | ✅ `light` / `dark` / `hc` + `prefers-color-scheme` & `prefers-contrast` (auto). Sherpa `hc` is a superset over Apex. |
| 1.4 | **Density** | ✅ `compact` / `comfortable` (+ base default). |
| 1.1 | **App-shell v1 tokens** | ✅ product-bar (3), product-nav (10), surface-app (14), app-product (13), nav- (10) all present. |

## Open items (deferred, correctly)

| Item | Note | When |
|---|---|---|
| **App Shell v2 tokens** | The v2 branch collections `-> navigation-menu (tbd)` and `-> filter-bar (tbd)` are **not yet extracted** (filter-bar tokens = 0). Add when those components are built. | Phase 3 (nav/header) / Phase 4 (quick-filter) |
| **`fonts/context/data`** | Apex Figma defines a `data` font context (JetBrains Mono, tabular). Sherpa has `brand`/`default`/`monospaced` but **no `data` context**. Decide: map `data` → `monospaced`, add a dedicated token, or leave folded into `default`. | Low priority; revisit with typography work |
| **Breakpoints from Figma** | Now config-sourced (`token-overrides.json`) but the values are hand-set, not pulled from Figma's `breakpoint/*` (Layout collection: 375/768/1280). Reconcile if exact parity matters. | Low priority |

## Verdict
The token layer is in **strong shape** — full data-viz/theme/mode/density parity, no bare-hardcoded chart colours, and the two real bugs (brand-status drop, platform provenance drift) are fixed. Remaining items are net-new v2 tokens (owned by later phases) and minor typography questions, none blocking.
