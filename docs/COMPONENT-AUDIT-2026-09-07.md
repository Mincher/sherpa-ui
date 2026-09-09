# Component audit — code vs Figma (2026-09-07)

Method: per component, Figma screenshot + literal MCP structure read vs code TS/CSS/HTML.
Buckets: STRUCTURE / LOOK / BEHAVIOUR / CONVENTION. Severity high/med/low.

## HIGH — build or major rework

| component | core problem |
|---|---|
| ~~sherpa-chip~~ ✅ | BUILT 2026-09-07 — 3 files + index/sandbox reg + spec + 3 e2e. Near-square neutral token (radius 2), icon+label+dismissible, chip-remove event. |
| ~~sherpa-grid-cell~~ ✅ | BUILT 2026-09-07 — 4 types (cell/header/filter/group), opt-in checkbox/actions, group toggle; sort-change/menu-open/group-toggle events. 4 e2e. (Slot renamed checkbox→selection to avoid data-has-* collision.) |
| ~~sherpa-pagination~~ ✅ | REWORKED 2026-09-07 — rows-per-page select + first/prev/page-input/of-N/next/last stepper. data-current-page→data-page; +data-page-size/data-rows-options/pageSize; +page-size-change event. Tests rewritten. |
| ~~sherpa-nav-section~~ ✅ | REWORKED 2026-09-07 — now the tiny SECTION label+rule divider (data-label, data-collapsed). Removed settings-panel + item-select/populate/NavSectionItem-Group. Tests rewritten. |
| ~~sherpa-overlay-panel~~ ✅ | REWORKED 2026-09-07 — rich header: icon+link title+description row+toolbar (collapse/expand/external/close). data-heading→data-title; +panel-collapse/expand/external events; icon/description slots. |
| ~~sherpa-toast~~ ✅ | REWORKED 2026-09-07 — icon badge + heading + value + action + close anatomy; card neutralised (status hue on badge only, matches callout); data-message kept as heading alias so factories still work; toast-action event added. 6 e2e. |
| ~~sherpa-calendar~~ ✅ | REWORKED 2026-09-07 — Monday-first weekdays + offset math (verified); Today/Cancel/Apply footer; +calendar-cancel/calendar-apply events. |
| ~~sherpa-gauge-chart~~ ✅ | REWORKED 2026-09-07 — threshold-zone bands (data-zones) + caption (data-caption/slot). Additive; display-only. |
| ~~sherpa-data-grid~~ ✅ | REWORKED 2026-09-07 — grid-sort-change→sort-change; +data-selectable (checkbox col + selection-change) + data-filterable (filter row + filter-change). Selection = view-index (flagged).  |

## MED — targeted fixes  (ALL DONE 2026-09-07 ✅)

Done via parallel subagents (edit-only) + central build/wire/test. e2e 267/0.
| component | fix |
|---|---|
| callout | ✅ neutral box + badge hue (theme 1) |
| input-text | ✅ leading/trailing icon + actions slots; filled red validation bar |
| select-group | ✅ header divider + validation row (data-error) + options slot; options now light-DOM slotted |
| button | ✅ data-badge slot; size enum → real Structure set (2xs/xs/sm/lg/xl); no default md |
| accordion | ✅ chevron moved trailing; data-description + slot (toggle kept native) |
| panel / dialog | ✅ documented: compose sherpa-container-header for the rich header (plain label otherwise) |
| container-header | ✅ noun-verb events (theme 3); accordion variant = data-collapsible (documented) |
| nav-item | ✅ trailing expand chevron (data-expandable/data-expanded + item-expand); promo = code-only |
| quick-filter | ✅ funnel icon + indicator dot (theme 4) |
| quick-filter-toolbar | ✅ divergence recorded (action cluster delegated to slots) |
| loader | ✅ arc re-pointed to accent blue #3b4ccd (style-indicator-accent) |
| tooltip | ✅ pointer arrow (per-placement, CSS triangle) |
| empty-state | ✅ icon tile (theme 4) + small-print region + de-emoji glyphs |
| prompt-composer | ✅ default leading attach+lab buttons (composer-attach/lab); slot actions→extras |
| code-block | ✅ line-number gutter (data-line-numbers); literal lowercase language; tinted panel |
| app-header | ✅ notif badge → accent-blue (Figma truth, NOT red); raw brand prim → semantic active alias |
| transfer-list | ✅ sentence-case pane headings (removed uppercase) |
| key-value-list | ✅ value renders as grey pill |
| select-card | ✅ removed createElement (both controls pre-placed, CSS-gated); data-multiple→data-select-mode; documented data-footer |

## LOW — nits / close matches  (ALL DONE 2026-09-07 ✅)

Verified all vs Figma; fixed real nits, confirmed the rest match. e2e 267/0.
- slider: corrected stale "neutral" comment (accent fill is correct).
- donut-chart: empty-ring fallback token fixed (+hex fallback, style-border-base).
- chart-legend: toggled-off row opacity → content-body-2 (no opacity for state).
- metric: resting tile now carries a subtle surface (surface-default-1).
- list: dividers now DEFAULT (was opt-in); the "divided" variant value retired, "plain" added.
- list-item: data-heading→data-label (data-heading alias kept); item-click detail heading→label.
- chat-message: added data-name/timestamp/message primaries (old author/time/content kept as aliases).
- file-upload: resting drop-zone dash → brand magenta (border-active-2).
- progress-bar: fill → blue accent #3b4ccd (was purple brand); matches loader.
- container-footer: added the action-bar top stroke.
- tabs: active = purple (content-active / border-active) KEPT — Will: a tab reads as a SURFACE (active family), not a control (accent). Intentional, correct.
- toolbar: 3-zone start/center/end is a superset of Figma leading/trailing — naming divergence only, left.
- Already matched (no change): switch, select-checkbox, select-radio, tag, section-header, breadcrumbs, sparkline, barchart, line-chart, nav, container.

## AUDIT COMPLETE 2026-09-07 — all 52 components reconciled to Figma. Build clean, lint 0, e2e 267/0.

## Cross-cutting themes (fix once, apply broadly)
1. **Whole-box status fill** — callout + toast fill the box with status colour; Figma keeps
   the surface neutral and puts the hue on the icon badge. Likely more components.
   ✅ DONE callout (2026-09-07): box surface/border/content now fixed neutrals; only the
   `.icon` badge follows `--_status-surface-strong`. Verified live Figma top fill =
   style-surface/base = white in every status. Rewrote 2 stale e2e tests that asserted the
   old whole-box fill (and mislabelled it "Figma model"). ✅ toast DONE 2026-09-07 with its
   HIGH rework — card neutralised + a status-hued icon badge added, so it now matches the
   callout model (neutral surface, hue on the badge only).
2. **@fires in HTML comment but not TS JSDoc** — toast, prompt-composer, code-block (MCP parses TS).
   ✅ DONE 2026-09-07: audited ALL components (not just the 3 spotted) — 12 real misses:
   barchart, button, chart-legend, code-block, prompt-composer, quick-filter, quick-filter-toolbar,
   select-card, select-checkbox, select-radio, tag, toast. Added an accurate `@fires <event> — …
   detail: {…}` line to each TS header (detail shapes read from the real emit() calls). Build +
   lint + e2e 259/0. Convention confirmed: re-dispatched native `change` DOES get an @fires (per switch).
3. **Bare-verb event names** — accordion `toggle`, container-header `dismiss/toggle/drag` (want noun-verb).
   ✅ DONE 2026-09-07 (hard rename, no dual-emit — Will: consistent standards, clean break):
   container-header `dismiss`→`header-dismiss`, `toggle`→`header-collapse`, `drag`→`header-drag`;
   app-header `back`→`back-click`. Updated TS emit + @fires + HTML Fires: + the two e2e listeners.
   accordion `toggle` KEPT — it's a native <details> toggle re-dispatch (same exception as
   change/input/close). No external components listened to the old names. Final scan: 0 bare-verb
   custom events remain (only native re-dispatches change/input/close/toggle).
   BONUS FIX: generate-component-spec.mjs had a stale-event bug — it UNIONed prior-yaml event
   names with @fires, so renamed/removed events lingered in every .component.yaml forever. Fixed:
   event set is now driven by the code's Fires: list (ground truth); prior spec only supplies the
   trigger block. Regenerated affected specs — old names gone. e2e 259/0.
4. **Missing icon badges / status-icon instances** — callout, toast, quick-filter, empty-state.
   ✅ DONE 2026-09-07 (quick-filter + empty-state):
   - quick-filter: added leading `.icon` (data-icon-start, Figma "Icon" funnel) + `.indicator` dot
     (data-indicator, Figma "Indicator (atom)", opt-in) to HTML; CSS gates both via :host([data-*]);
     TS mirrors the icon glyph. Verified Figma Left frame = Indicator(hidden default)+Icon(visible)+Label.
   - empty-state: added the soft rounded grey TILE behind the glyph (surface/default/+2, radius 8) —
     the old CSS comment wrongly said "no disc (matches Figma)"; live Figma illustration IS a
     surface/default/+2 rounded rect. Glyph shrunk to 0.6× to sit inside the padded tile.
   - callout badge was already correct (done in theme 1). toast badge deferred to its HIGH rebuild.
   - Emoji-glyph→line-art + small-print for empty-state left to its own MED fix (not a badge concern).
   Build + e2e 259/0.
5. **Two components mapped to the wrong/absent Figma node** — nav-section, grid-cell/data-grid.
