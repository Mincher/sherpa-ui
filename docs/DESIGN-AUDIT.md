# Design-Accuracy Audit — Sherpa vs Figma

**Date:** 2026-07-30
**Trigger:** the quick-filter chip was built with a `999px` pill radius when the Figma design uses `4px`. That prompted a systematic pass: audit every relevant Sherpa component against its Figma counterpart in the Apex 2.0 library.

## Method (repeatable)

1. **Connect** the figma-console Desktop Bridge to the App Shell v2 file (`gfI2qK577EvUl4mdCt2BXP`) — it exposes the full Apex 2.0 component library (327 components) + `figma_search_components`.
2. **Map** Sherpa component → Figma node via `figma_search_components` (single-term queries only).
3. **Pull specs** with `mcp__claude_ai_Figma__get_design_context(fileKey, nodeId, disableCodeConnect:true)`. The returned React+Tailwind classNames encode the real tokens + resolved fallback values, e.g. `rounded-[var(--border\/rounding\/base,4px)]` = radius token `border/rounding/base` = 4px.
4. **Diff** the extracted radius/border/color/font/spacing against the component CSS.
5. **Fix real drift**, then **verify numerically in a real browser** (`getComputedStyle`) — never trust the CSS edit alone.

### Calibration rules (what counts as drift)
- **Flag:** wrong radius (esp. `999px`/`rounding-full` where design is `4px`/`2px`, and vice-versa), wrong border width (`0.5px sm` vs `1px base`), wrong font size, hardcoded values that should be tokens, wrong token *families*.
- **Don't flag:** theme-color differences where Sherpa uses a correct *semantic* token (blue fallback → purple in the apex-2-purple theme is correct theming, not drift).
- **Confirm, don't "fix":** legitimately-pill things (switch track, slider track/thumb, radio, progress bar, notification dots, and — it turns out — status tags at `rounding/xl` 16px).

## Results

### ✅ Verified accurate (no change)
`sherpa-button` (4px, correct semantic tokens) · `sherpa-switch` · `sherpa-slider` · `sherpa-select-radio` · `sherpa-input-text` · `sherpa-message` · `sherpa-callout` · `sherpa-tabs` (active-underline correct) · `sherpa-empty-state` (minor fallback-only notes).

### 🔧 Fixed — real drift
| Component | Was | Now (Figma) | Node |
|---|---|---|---|
| **sherpa-quick-filter** chip | 999px pill | **4px** radius, white bg, 0.5px border, per-state colors, Inter 14px | 26938:43351 |
| **sherpa-input-tag** chip | 999px pill | **2px** (Chip) | 15642:63496 |
| **sherpa-select-checkbox** | 4px radius, 2px grey border | **2px** radius, **1px brand** border | 15893:81930 |
| **sherpa-dialog** | 8px radius, 14px title | **4px** radius, **16px/24** title, 14px desc | 9564:1283 |
| **sherpa-accordion** | 16px header gap | **4px** gap | 5296:27142 |
| **sherpa-tag** (status) | *(see correction)* | **16px** radius, **10px** font, **2px/8px** padding, 16px line, 0.1px ls | 15642:63413 |
| **sherpa-nav-item** | 16px gap+padding | **8px** (space/xs) | 24486:25430 |
| **sherpa-product-bar-v2** | 14px product name | **16px/24** (type/lg) | 4868:3691 |
| **sherpa-metric** value | brand font, 400, 1em | **mono/data** family, **500**, 32px line | 16531:41950 |
| focus-ring fallback hex | `#0066cc` | `#3c5edd` (design primary) — accordion/tabs/list-item | — |

### ⏭️ Skipped (no clean Apex 2.0 counterpart)
- **sherpa-tooltip** — Figma "Popover" is a light, interactive header+body overlay; Sherpa's tooltip is a small dark hover label. Different components.
- **sherpa-section-header** — Apex 2.0 splits this into "Header (Generic)" (L1) + "Section Divider" (L2); no single 3-level match.
- **sherpa-pagination** — Apex has only chevron icons, no dedicated pagination component (Sherpa composition).
- Net-new Sherpa families with no Figma source: node-graph, AI surface (chat/prompt/proposal), calendar, code-block.

## A correction worth recording
`sherpa-tag` was **first audited against the wrong node** ("Chip" `15642:63496`) and set to 2px radius / 12px font. The correct node is **"Tag (status)" `15642:63413`**, which is a rounded status pill: **16px radius, 10px font, 2px/8px padding**. The original values (10px font) were actually right; the "fix" regressed them before batch 3 re-verified against the correct node and corrected it. Lesson: confirm the component→node mapping (Chip ≠ Tag(status) ≠ status Badge — Apex distinguishes them), and always verify numerically.

## Second pass — token/variable-level (checking Figma variable bindings)

Pulled the real Apex 2.0 **Alias** variable collection (ground truth): radius sm=2/base=4/lg=8/xl=16/full=999; border-width **xs=0.25**/sm=0.5/base=1/lg=2; fonts 2xs=8/xs=10/sm=12/base=14/lg=16; space 3xs=2/2xs=4/xs=8/sm=12/base=16/lg=20/xl=24. This surfaced two **systemic** issues the visual pass missed:

### 🔧 Systemic fixes
- **`border-width-xs` (0.25px) misuse — 12 uses across 7 components.** Every use carried a `1px` fallback, i.e. all intended a 1px hairline but bound the 0.25px token (too thin on hi-DPI). Confirmed against Figma (accordion binds `component/accordion/border-width`=1px, not `width/xs`). Repointed all → `border-width-base` (1px): accordion, button, calendar, callout, container-group, select-group, input-base.
- **174 wrong token-fallback literals across 44 files.** Scanned every `var(--token, fallback)`; 174 fallbacks didn't match the token's true value (`rounding-base,6px`→4, `fonts-scale-sm,14px`→12, `space-xs,4px`→8, …). Rendered output unchanged (fallbacks only apply on token-load failure), but corrected for accuracy/robustness.

### Batch 4 (via `figma_execute` node lookup on Apex 2.0 Core)
| Component | Fix | Node |
|---|---|---|
| **overlay-item** | radius 2px→**4px**; padding 4/12→**8** uniform; desc font 10.8px hack→**14px** | Menu Item 16000:136445 |
| **file-upload** | drop-zone radius 2px→**4px**; border→width-lg token, colour #8d8d99 | .File uploader 6812:5372 |
| **toolbar** | add missing **1px bottom border** | Toolbar 10950:29904 |
| **toast** | close-button radius 2px→**4px** | Toast 13224:52946 |
| **list-item** | uniform **8px** padding; title↔desc gap 4px→**2px** | List item 4635:6089 |
| **container** | ✅ accurate (Widget) — no change | Widget 19800:86795 |

Skipped (no clean counterpart): list (icon-only node), section-header (Figma node is a page banner), pagination (no Apex component), key-value column gap (multi-row grid design choice).

**Recurring pattern confirmed:** radius `sm`(2px) used where Figma binds `base`(4px) — now fixed in overlay-item, file-upload, toast-close (same family as the quick-filter pill and dialog/checkbox drifts from pass 1).

## Guard against recurrence
`test/e2e/sherpa-quick-filter.spec.ts` asserts the chip's 4px radius + populated purple/semibold, so the pill regression can't silently return. Consider adding similar radius/font guards for tag, checkbox, and dialog if these prove regression-prone.
