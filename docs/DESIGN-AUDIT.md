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
- **`border-width-xs` (0.25px) misuse — 12 uses across 7 components.** Every use carried a `1px` fallback, i.e. all intended a 1px hairline but bound the 0.25px token (too thin on hi-DPI). Confirmed against Figma (accordion binds `component/accordion/border-width`=1px, not `width/xs`). Repointed all → `border-width-base` (1px): accordion, button, calendar, callout, select-group, input-base.
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

## Third pass — variable collections, modes, aliasing & scoping (mode-axis replication)

**Trigger:** "The figma variable collections, modes, and how they are aliased and scoped needs to be checked over again … Modes in variable collections change the assigned variable, similar to how CSS classes would."

Pulled all **20 Figma collections + their mode structure** and mapped every mode axis to its CSS mechanism, then verified each swap **numerically in a real browser** (`getComputedStyle` on `:root` with mode attributes toggled).

### Mode-axis → CSS map (the "modes = CSS classes" contract)
| Figma collection | Modes | CSS mechanism | Status |
|---|---|---|---|
| Primitives | Value | `:root` `--core-*` | ✅ |
| Alias | Value | `:root` `--sherpa-*` | ✅ |
| Apex 2.0 (+ Purple/Teal/Blue/Classic) | Light / Dark | `[data-theme]` + `[data-mode]` (+ `prefers-*`) | ✅ verified swap |
| **Density (Alias)** | Base / Compact / Comfortable | `[data-density]` | 🔧 **was fully broken — fixed** |
| Status | default/info/critical/warning/urgent/success | `[data-status]` → `--_status-*` inherited props | ✅ verified swap (+1 fix) |
| Layout | Desktop / Tablet / Mobile | *(none — unused)* | ⏭️ unreplicated but 0 consumers |
| 11 component-scoped (`-> tag (colors)`, `-> button (size)`, `-> tab (style)`, …) | per-component | per-component `[data-color]` / `[data-size]` / `[data-variant]` CSS | ✅ correct architecture (spot-checked tag → 11 `[data-color]` selectors) |

### 🔧 Fixes
- **Density axis was a no-op.** `--sherpa-space-base` returned 16px in *every* density mode. Two stacked failures:
  1. **Stale/sparse extract** — the committed `figma-variables.json` had only 3 Density vars, all `null`, so the generator emitted literal `--sherpa-space-*: null;` (invalid CSS, dropped by the parser). Root cause: the REST `/variables/local` endpoint returns **truncated data** for large collections (Alias=1 var, Primitives=1, Density=14-but-null), and the extractor's abort-guard (correctly) blocks the whole atomic write — so Density never refreshed either.
  2. **Name divergence** — Figma's Density collection names the mid step `space/default`; 18 component files consume `space/base` (an Alias synonym for the same value). Even with good data, `space/base` would never rescale.
  Fixed by (a) patching the live Density values (13 `space/*` vars aliasing `@scale/N`, pulled via the plugin API which returns complete data) into the committed JSON, and (b) making the generator mirror `space/default` → `space/base` inside each `[data-density]` block. Verified: base 16 / compact 12 / comfortable 20px, both synonyms tracking.
- **`--_status-border-strong` never existed.** `sherpa-dialog` consumed it for the status header rule, but the Status collection has no strong-border token, so it always fell through to the neutral fallback and the header border ignored `[data-status]`. Repointed to `--_status-border` (the single status-border swap). Verified it now resolves per status.
- **Breakpoint tokens didn't match Figma.** `token-overrides.json` carried Bootstrap values (576/768/992/1200); Figma's Layout collection is 375/768/1280/1920. Aligned to Figma (JS-consumption-only tokens, 0 CSS consumers). Guarded the generator against the new `_doc` meta key.

### Systemic guards added
- **Extractor all-null guard** (`extract-figma-vars.js`) — rejects any validated collection that returns the right var *count* but entirely `null` values (the exact failure that silently disabled density). Driven by a new `collectionValidation` block in `figma-config.json` (`Density (Alias)` ≥13, `Status` ≥20).
- **`test/e2e/token-modes.spec.ts`** — asserts the Density, Status, and Theme/mode swaps actually happen on `:root`, so a regressed generator can't silently ship a dead mode axis again. 3 tests, all green (147 total).

### Intentional divergences from Figma (confirmed with Will — not gaps)
- **Status is an override model, not literal per-token application.** Sherpa treats `[data-status]` as a CSS override layer for **fills, borders, and content colours (text + icons)** via the inherited `--_status-*` props. Figma instead reassigns every control token per mode (the 19 unmapped `border/control/*`, `text/control/*`, `icon/control/*`, `surface/control/*` vars). Sherpa deliberately does **not** map those — the override layer is sufficient and DRY. This is by design; do not treat the 19 unmapped vars as a gap.
- **Layout collection is kept for future use.** Hero/data type scales, `nav-width`, `device-width`, and breakpoints have zero consumers today but are intentionally retained — responsive work will use them later. Sherpa uses container queries (not viewport media) inside components, so the eventual CSS mechanism for Desktop/Tablet/Mobile modes is TBD (likely app-shell level).

**Root-cause note for future refreshes:** the Figma REST Variables API returns sparse/truncated data for this file's large collections. `npm run tokens:refresh` currently **cannot** fully refresh — it aborts (correctly) to protect the good hand-preserved `primitives.css`/`sherpa-alias.css`. Reliable full extraction needs the **plugin API** (`figma_execute`), which returns complete resolved values. Migrating the extractor from REST to plugin transport is the real long-term fix.

## Fourth pass — construction, variants, modes vs on-canvas documentation

**Trigger:** audit each component's **construction, variants, and modes** against the App Shell v2 file's on-canvas per-component documentation. Branch: `design-audit-components`. Method: pull each Figma component set's `variantGroupProperties` + `componentPropertyDefinitions` (the real construction) via the plugin API, read the `.Docs Header` narrative, measure variant specs, diff vs the Sherpa build, fix, verify numerically, guard.

### Components audited — 34 across the full library (fixes in bold)
| Component | Figma construction | Outcome |
|---|---|---|
| **Quick Filter chip** | Type(Default/AI/Populated) × State(7) + has Menu/Icon/Content/Badge | Constant purple 0.5px border + always-semibold; [data-active] drives fill/text; dropped invented AI 1px border; badge 8→**10px** |
| **Quick Filter toolbar** | Type(View/Data) + Slot-Content/Right-Actions | Order-zone Group/Sort chips → purple border + semibold + active purple; dividers 0.5→**1px** |
| **Button** | Type(primary/secondary/tertiary/tertiary-on-color) × State(5) + size collection | Construction correct; **restored the accent (blue) ramp** — see below |
| **Tab** | Type(Default/Active) × State(3) + style collection | Active 2px **purple** indicator + purple label; labels **semibold** all states; per-tab 1px rule |
| Switch | State(False/True) × Type(Active/Inactive) + default/simple collection | ✅ Faithful — radius-4 track / pill-simple, green on, #5c5c66 off, 16px thumb |
| Accordion | Type(Collapsed/Expanded) × State(2) | ✅ Construction matches; label emphasis fixed via dead-class fix |
| **Checkbox** | State(3) + is Selected/is Partial | Rest border grey → **accent blue** (Figma binds border/control/primary) |
| Radio | State(3) + has Description/Icon | ✅ Already accent border + dot |
| Badge | Type(Value/Collection/Dot/Notification) | Value type verified (16px/4px/0.5px grey/10px mono = the chip count badge) |
| **Callout** | single status-driven component | Full 1px border → **4px leading status accent bar** (top/right/bottom 0) |
| **Toast** | single status-driven, 520px | Removed 6px left accent → **uniform 1px** status border (8px radius) |
| **Tooltip** | dark #2e2e33, 4px, 12px Semi Bold | radius 2→**4px**, added **semibold**, opaque #2e2e33 bg |
| Card | State(Default/Hover/Active) | ✅ = sherpa-container (4px, 1px #d5d5d5, white) |
| Tag | Type(primary/secondary) + has Icon | ✅ Faithful (16px pill, 2/8, 10px semibold) |
| **Chip / input-tag** | Type(Outline/Solid) + has Icon/Button | Added **semibold** label (2px radius) |
| **Banner / message** | single status-driven | Inline padding 12→**16px** (8/16, 4px, 1px status border) |
| **Menu / overlay-item** | State(Default/Hover/Active/Destructive/Inactive/Modified) | Added missing **Active/selected** state (purple) |
| **Input** | State(Default/Read-only/Inactive/Validation) | **Semibold label**; focus border brand-purple → **accent blue** |
| Popover | single + Popover Header | ✅ = container-overlay (4px, md shadow) |
| Dialog | single, 4px, 16px/600 title | ✅ Verified (fixed prior pass) |
| **List item** | State(4), 14px **Regular** label, Active purple | **Reverted** earlier over-reach — label is Regular not semibold; active = purple Regular |
| **Progress Bar** | Determinate/Indeterminate, fill = border/container/active | Fill accent-blue → **brand-purple #8500cc** (Figma binding) |
| Slider | Type(Dual/Single) × State(2) | ✅ Faithful — fill correctly accent-blue, pill track, white thumb |
| **Loader** | spinner arc = border/container/active | Arc #c046ff → **brand-700 #8500cc** |
| Empty State | single | ✅ Faithful — title 16px/600, desc 14 Regular, 20px gap |
| File Upload | .File uploader | ✅ Left as-is (Figma border was a tool-placeholder, not a token) |
| Breadcrumbs | .Breadcrumb set | ✅ Faithful — links 12px/600 accent-blue, current Regular |
| **Progress Steps** | Step State(Current/Inactive/Complete) | active/completed info-blue/success-green → **accent blue** (Figma binds control/primary) |
| **Key-Value** | key 14px **Regular** secondary, value Regular body | Key label semibold → **Regular** (colour carries the distinction) |
| Footer | Footer (Generic) | ✅ Faithful — 48px, 8/12, 1px #d5d5d5 top border |
| **View Header** | title 16px **Bold** | heading-lg semibold → **700 Bold** on the view title |
| **Product Nav v2 / Nav Item** | State(default/hover/selected) | selected bg #e2adff→**#f8ebff**, text #c046ff→**#8500cc** (host + child) |
| App Header | composite (product-bar 32 + view-header 68 + loading 2) | ✅ Slot-based composition of audited parts |
| **Data Grid** | Grid Cell(Primary/Default/Numerical/Selection), Column Header(align) | cell 32 / header 40 semibold / link cells accent-blue **+ semibold** |

### 🔧 Systemic fixes (high impact)
- **Accent (blue) ramp was entirely missing.** `color/accent/*` (blue, base = neon-blue/550 #3c5edd) was never emitted into `sherpa-alias.css` — the REST Alias extract (169 vars) sits below the 530-var write guard, so the hand-preserved file stayed frozen without it. Every primary button, link, and primary focus ring fell back to a hardcoded **#8500cc purple**. Figma separates **accent (blue → primary actions)** from **brand (purple → AI/quick-filter)**. Restored the ramp; guarded with a token-modes test (accent≠brand, primary→accent). See the [[sherpa-accent-vs-brand]] memory.
- **`border-control-active-default`** aliased `color/brand/700` (#8500cc, stale) → corrected to `color/brand/base` (#c046ff) via themeCorrections. Surfaces on the quick-filter chip + tab active indicator.
- **Dead text class `text-body-emphasised-*`** (doesn't exist; real class is `text-emphasis-*`) was used by **accordion, tabs, list-item** — their labels never got semibold. Fixed accordion + tabs; list-item was later reverted to Regular (its Figma label *is* Regular).
- **Fallback-literal consistency sweep.** After the accent fix, ~25 fallback literals no longer matched their token's resolved value. Corrected every `*-control-primary-default` fallback → **#3c5edd** (accent blue) and every `*-control-active-default` fallback → **#c046ff** (brand purple) across ~15 components. Cosmetic (fallbacks only apply on token-load failure) but keeps them truthful.

### Accent (blue) vs brand (purple) — the per-component split
The audit pinned down which token each component's accent actually binds to in Figma:
- **Accent blue (#3c5edd)** — primary buttons, links, input focus, checkbox/radio borders, **slider** fill, **progress-step** current/complete, data-grid link cells, breadcrumbs.
- **Brand purple (#8500cc / #c046ff)** — quick-filter chip, tab active indicator, **progress-bar** fill, **loader** arc, menu/list/nav **selected** states.

This distinction was invisible before because the accent ramp was missing and everything fell back to purple. Each component now points at the correct family. See [[sherpa-accent-vs-brand]].

### Token-chain sweep
Diffed 43 key control/surface/content/border theme tokens against Figma plugin-API ground truth. After the accent + border-active fixes, only `component/product-nav/item-rounding` remains (unused). All 9 Figma color ramps (accent/brand/critical/info/neutral/success/tones/urgent/warning) confirmed present.

### Recurring construction findings
- **Semibold labels**: accordion, tabs, input, chip, tag, breadcrumbs, data-grid headers, view-header title (Bold) are all semibold+ in Figma. List item + key-value keys are **Regular** — colour, not weight, carries their hierarchy.
- **Status components** (callout, toast, banner) share the subtle-fill + status-border pattern, but differ in border shape: callout = 4px leading bar, toast/banner = uniform 1px.
- **Selected/active states** across menu, list, nav all use the light-purple #f8ebff + #8500cc brand treatment.

## Guard against recurrence
`test/e2e/sherpa-quick-filter.spec.ts` asserts the chip's Type×State matrix (4px radius, constant purple border, semibold, active fill/text). `test/e2e/token-modes.spec.ts` asserts the density/status/theme mode swaps **and** accent≠brand / primary→accent. All caught in CI (148 tests).
