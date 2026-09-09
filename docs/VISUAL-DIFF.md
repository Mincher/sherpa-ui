# Sherpa-UI — visual-diff pass (Figma vs code render)

By-eye comparison of each component's **code render** (via `scripts/vd-shot.mjs` + the
`vd-harness.html` sample markup, light mode) against its **Figma default** (the COMPONENT /
COMPONENT_SET node on its `✅` page, exported live via the Desktop Bridge). Both at 2×,
light mode, `data-theme="sherpa"`.

**Verdict key:** ✅ match · 🟡 minor (spacing / colour / weight nits) · 🔴 major (wrong
layout / missing parts / clearly off). Each 🟡/🔴 lists the concrete fix.

**Scope:** the 42 static-renderable components first. 11 data-driven ones (barchart,
breadcrumbs, chart-legend, data-grid, donut-chart, key-value-list, line-chart,
progress-step-tracker, quick-filter-toolbar, transfer-list, tabs-strip) render empty from
static markup and are deferred to a populate()-wired second pass. sparkline/line-chart/
barchart have no true Figma node.

Node ids: see scratchpad `vd-nodemap.json`.

---

## Controls

Method: token-by-token data compare (Figma node `boundVariables` + resolved values vs CSS).

### sherpa-button — ✅ match
- Figma: h32, radius4, padding8, gap8, border 0.5px `style-border/base` #b3b3c3, fill #fff `style-surface/base`, label 14 #35353d `style-content/base`, icon14 `icon-size`.
- Code: matches via `--sherpa-*` tokens.
- Diffs: border-width — Code hardcodes `1px` on `.trigger` → should be `var(--sherpa-style-border-width, 0.5px)`. icon-size fallback `16px` vs Figma 14 (token drives it; fallback nit).

### sherpa-tag — 🟡 minor
- Diffs: radius — Figma `rounding-xl`=16px vs Code `999px` pill. padding-inline — Figma 4px vs Code 8px. font-size — Figma 10px (`content/size/xs`) vs Code 12px. font-weight — Figma regular vs Code semibold.

### sherpa-chip — 🟡 minor
- Diffs: padding — Figma 4px all sides vs Code 2px block / 8px inline. border-width — Figma 1px (`border/width/base`) vs Code 0.5px. font-weight — Figma regular vs Code semibold.

### sherpa-switch — ✅ match
- Diffs: `.track` width fallback 40px vs token/Figma 48px (stale fallback nit).

### sherpa-select-checkbox — ✅ match
- Diffs: box radius — Figma 4 (`structure-rounding`) vs Code `display-border-rounding-sm` (2px fb). border-width — Figma 1px vs Code 0.5px.

### sherpa-select-radio — ✅ match
- Diffs: border-width — Figma 1px vs Code 0.5px. dot size — Figma 8px vs Code 10px (::after).

### sherpa-select-group — ✅ match
- Diffs: heading font — Figma 14 vs Code 16px (`body-large`). description — Figma 12 vs Code 14px. inline padding — Figma 8 vs Code none (minor).

### sherpa-slider — 🟡 minor
- Diffs: root gap — Figma 8px vs Code 4px. value field — Figma dresses it as Input Field (atom); Code uses bare number input (accepted divergence per CSS header).

### sherpa-input-text — ✅ match
- Diffs: field gap — Figma 4px vs Code 8px. label font — Figma 12/medium vs Code 14/semibold. control font — Figma 14 vs Code 16px (`body-large`).

### sherpa-quick-filter — 🟡 minor (biggest geometry gap)
- Diffs: height — Figma 24px vs Code 28px. radius — Figma 3px soft-corner rect vs Code 999px pill. inline padding — Figma 2px vs Code 12px. default ink — Figma `style-content/base` #35353d regular vs Code muted `theme-content-body-2` medium.

### sherpa-pagination — ✅ match
- Diffs: rows-label/total font — Figma 12 vs Code 14px. host gap layout differs slightly (accept).

### sherpa-tooltip — ✅ match
- Diffs: label font-weight — Figma regular vs Code semibold(600).

---

## Charts · data viz · misc

### sherpa-metric — 🟡 minor (biggest single-component gap)
- Diffs: value font-size — Figma 24 (`heading-h1`) vs Code **36px**. value weight — Figma semibold vs Code **bold**. label — Figma 12/regular vs Code 14/semibold. label colour — Figma `content/body/+1` #35353d vs Code `content-body-base` #0c0b11. delta — Figma 12 vs Code 14. host gap — Figma 8 vs Code 4.

### sherpa-key-value-list — 🟡 minor
- Diffs: column-gap — Figma 8 (`space/xs`) vs Code 16px (`display-space-base`). value text colour — Figma `content/body/+1` #35353d vs Code `content-body-base` #0c0b11.

### sherpa-chart-legend — ✅ match
- Diffs: swatch radius — Figma 4 vs Code 2px (minor). value weight semibold(code) vs regular(Figma) nit.

### sherpa-donut-chart — 🟡 minor
- Diffs: value weight — Figma semibold vs Code bold. sub font — Figma 10 (`content/size/xs`) vs Code 12px. size 200(Figma) vs 180(code) cosmetic.

### sherpa-gauge-chart — 🟡 minor
- Diffs: scale font — Figma 10 vs Code 12px. track token — Figma binds legacy `_old_border/base` #b3b3c3 (FIGMA-SIDE DRIFT — flag for Figma cleanup, not code). zone fill = opt-in.

### sherpa-calendar — 🟡 minor
- Diffs: card radius — Figma 3 (`border/radius/150`) vs Code 4px. border colour — Figma `border/default/+2` #b3b3c3 vs Code `style-border-base` #e8e8f6. border width — Figma ~1px vs Code 0.5px. (time-clock analog panel = known one-to-many, not a bug.)

### sherpa-chat-message — ✅ match
- Diffs: avatar size — Figma 14 vs Code 24px (design choice). assistant bubble fill — Figma `style-surface/base` #fff vs Code `theme-surface-default-1` #e8e8f6 lavender tint (token swap).

### sherpa-prompt-composer — 🟡 minor
- Diffs: radius — Figma 3 vs Code 4px. border colour — Figma `border/default/+2` #b3b3c3 vs Code `style-border-base` #e8e8f6. input font — Figma 14 vs Code 16px (`body-large`). padding top/bottom 12/8(Figma) vs symmetric 8(code). (send-button subtle-vs-accent = design intent.)

### sherpa-code-block — 🟡 minor
- Diffs: card radius — Figma 3 vs Code 4px. border colour — Figma `border/default/+2` #b3b3c3 vs Code `style-border-base` #e8e8f6. border width — Figma ~1px vs Code 0.5px. header v-padding — Figma 8 vs Code 4.

### sherpa-transfer-list — 🟡 minor
- Diffs: host gap — Figma 12 (`space/sm`) vs Code 16px. pane border colour — Figma `border/default/+2` #b3b3c3 vs Code `style-border-base` #e8e8f6. pane radius — Figma 3 vs Code 4px. pane header fill — Figma tinted #e8e8f6 vs Code transparent (code omits header surface). move-buttons gap — Figma 4 vs Code 8.

### sherpa-loader — ✅ match
- Diffs: track colour — Figma `style-surface/darker` #b3b3c3 vs Code `style-border-base` #d5d5d5 (minor token/value nit).

### sherpa-progress-bar — ✅ match
- Diffs: track colour token — Figma `style-surface/base` #fff vs Code `theme-surface-default-1` #fdfdfd (near-identical). fill token agrees.

### sherpa-progress-step-tracker — 🟡 minor
- Diffs: marker size — Figma 24 (`display-size-lg`) vs Code **28px**. num weight — Figma regular vs Code semibold. (connector + colours align.)

### sherpa-file-upload — 🟡 minor
- Diffs: dropzone bg — Figma `surface/transparent` (transparent) vs Code `theme-surface-default-2` #f2f2f2 opaque grey. border width — Figma ~1px vs Code 0.5px. dropzone padding — Figma 20 all vs Code 24/20. section gap — Figma 12 vs Code 4. (dashed magenta border matches.)

### sherpa-sparkline / sherpa-line-chart / sherpa-barchart — no Figma node
- No dedicated Figma component to diff against; code + Data Viz tokens are the target.

---

## Containers · surfaces

### sherpa-container — ✅ match
- Box tokens (radius 4, border 0.5px `style-border/base`, fill #fff) all agree. Header/footer chrome delegated to child components (diffs live there).

### sherpa-panel — 🟡 minor
- Diffs: radius — Figma 0 (`border/rounding/none`, square) vs Code 4px. border weights — Figma per-side vs Code uniform (docking artifact, low concern).

### sherpa-dialog — ✅ match
- Box tokens agree. shadow-lg + ::backdrop are correct modal chrome Figma doesn't model.

### sherpa-overlay-panel — 🟡 minor
- Diffs: title font — Figma 14/medium vs Code 16px/semibold (`body-large`). title colour — Figma `content/link/+1` #2b34b4 vs Code `content-link-base` #3c5edd. (toolbar action set differs = intentional composition.)

### sherpa-accordion — 🔴 major
- Diffs: structure — Figma composes a Container Header (icon slot, Button toggle) + Container Footer; Code is native `<details>/<summary>` with a bespoke summary + CSS chevron and NO footer. summary v-padding — Figma 8 vs Code 16. (Native details is a deliberate PE choice; the missing footer + header anatomy are the real gap. Needs a ratify: keep native-details shape or match Figma's Container-composition.)

### sherpa-container-header — 🔴 major
- Diffs: title font — Figma 14/medium vs Code **16px/semibold**. description — Figma 12 vs Code 14px. row h-padding — Figma 8 vs Code 16. row gap — Figma 4 vs Code 8.

### sherpa-container-footer — 🟡 minor
- Diffs: block padding — Figma 8 vs Code 16px. gap — Figma 4 vs Code 8.

### sherpa-select-card — 🟡 minor
- Diffs: border width — Figma 1px vs Code 0.5px. border colour — Figma `border/default/+2` #b3b3c3 vs Code `style-border-base` #e8e8f6. region padding — Figma 16 vs Code 12.

### sherpa-callout — 🔴 major
- Diffs: radius — Figma 2px (`border/rounding/sm`) vs Code fallback 8px. **left accent bar** — Figma has a thick left border (`border/width/lg`); Code has uniform 0.5px border + a round colour badge disc instead (structural). title — Figma 14/semibold vs Code 16px. body — Figma 12 vs Code 14px.

### sherpa-toast — 🟡 minor
- Diffs: radius fallback — Figma 4 vs Code fb 8px. status signalling — Figma plain leading icon vs Code filled badge disc (same as callout, stylistic).

### sherpa-empty-state — 🔴 major
- Diffs: title — Figma 14px **regular** vs Code **20px semibold** (`heading-h2`). container padding — Figma 32 vs Code 24. (icon tile, gap, small-print agree.)

### sherpa-section-header — 🔴 major
- Diffs: title — Figma 14/medium vs Code **20px semibold** (`heading-h2`). description — Figma 12 vs Code 14px. divider — Figma always-on (`border/default/+2` #b3b3c3); Code opt-in (`data-divider`) + lighter `style-border-base` #e8e8f6.

---

## Navigation · lists · app chrome

### sherpa-breadcrumbs — 🟡 minor
- Diffs: link colour — Figma `content/link/+1` #2b34b4 vs Code `content-link-base` #3c5edd. link weight — Figma regular vs Code semibold. current-crumb colour — Figma #35353d vs Code near-black. crumb font — Figma 12 vs Code 14px.

### sherpa-tabs — 🟡 minor
- Diffs: tab inline padding — Figma 0 vs Code 16px. tab gap — Figma 8 vs Code 12. resting underline — Figma `border/width/lg` vs Code 0.5px. label weight — Figma regular vs Code semibold.

### sherpa-list — ✅ match
- Diffs: divider token — Figma `border/default/+2` vs Code `style-border-base` (same resolved hairline; exactness nit).

### sherpa-list-item — 🟡 minor
- Diffs: title font — Figma 14 vs Code 16px (`body-large`). description — Figma 12 vs Code 14px. selection control — Figma 20×20 vs Code 16px checkbox.

### sherpa-nav — 🟡 minor
- Diffs: rail border — Figma NONE on rail (divider is header-bottom) vs Code draws a right border. header padding — Figma 8 vs Code 12. content padding/gap — Figma 8 vs Code 12.

### sherpa-nav-item — 🟡 minor
- Diffs: row padding — Figma 8 inline/0 block vs Code 2/4. label weight — Figma light vs Code medium. height — Figma fixes 24 vs Code no min. ink — Figma #35353d vs Code near-black fallback.

### sherpa-nav-section — ✅ match
- Diffs: none. (Code adds uppercase+letter-spacing; Figma chars already uppercase — harmless.)

### sherpa-app-header — 🟡 minor
- Diffs: content padding — Figma 8 all vs Code 8 block/12 inline. (loading bar + notif badge = intentional runtime affordances.)

### sherpa-toolbar — 🔴 major
- Diffs: **fill** — Figma transparent bare strip vs Code fills `style-surface-base`. block padding — Figma 8 vs Code 16. inline padding — Figma 0 vs Code 16. gap — Figma 8 vs Code 2. radius — Figma none vs Code 2px.

### sherpa-data-grid — 🟡 minor
- Diffs: cell padding — Figma 4 vs Code 8/12. border width — Figma 0.5px vs Code 1px. header fill — Figma `style-surface/dark` #e8e8f6 vs Code `surface-default-2` #f2f2f2. (`<table>` vs flat stack = intentional.)

### sherpa-grid-cell — 🟡 minor
- Diffs: cell gap — Figma 8 vs Code 4. inline padding — Figma 4 vs Code 8. header/group fill — Figma one `style-surface/dark` for both vs Code two lighter tiers. action-button — Figma 16 vs Code 20px.

### sherpa-quick-filter-toolbar — 🟡 minor
- Diffs: bar gap — Figma 8 vs Code 12. block padding — Figma 4 vs Code 8. chip-run gap — Figma 8 vs Code 4. divider token — Figma `border/default/+2` 1px vs Code `style-border-base` 0.5px.

---

## Fix pass applied (2026-09-08)

The 4 systemic causes + 2 one-offs were fixed across ~44 components (card-radius 3→4 was
NOT changed — no 3px token; kept 4px). Verified: `npm run build` ✅, `lint:css` 53/0/0 ✅,
`npm test` **266 passed / 0 failed** ✅. Two section-header tests updated for the new behaviour
(divider default-on; size scale re-ordered sm12<base14<lg20). Accordion kept native `<details>`
(spec note only). Re-pulled Figma data for toolbar + section-header confirms the code now matches.

Deferred (needs its own ratify): **content-ink token** — `style-content-base`/`theme-content-body-base`
resolve to #0c0b11 (near-black) in code where Figma binds #35353d (softer secondary) for body text.
Recurs across metric, key-value-list, breadcrumbs, quick-filter, section-header title, etc. Not
fixed per-component (would be scattered fallbacks); ratify the token mapping once instead.

Figma-side (not code): gauge-chart track binds a legacy `_old_border/base` token → Figma cleanup.
