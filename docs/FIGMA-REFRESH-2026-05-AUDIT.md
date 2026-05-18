# Figma Refresh 2026-05 — Component Audit

**Started:** 2026-05-07
**Source of truth:** Figma file `K9CTAzip5gwJmhOQpyfbvM` (Apex 2.0 N-able Core)
**Method:** Per component → pull node tree via figma-console MCP (`figma_execute` walk
with resolved `boundVariables`), diff vs source, apply small fixes, record larger
deltas as follow-ups.

## Status legend
⬜ pending · 🔄 in-progress · ✅ clean · 🟡 fixed-with-followups · ❌ blocked

## Component matrix
| # | Figma page | Sherpa tag | Status | Tokens | Icons | Slots | Variants | Status-scope | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Accordion | sherpa-accordion | 🟡 | swapped to `--sherpa-component-accordion-*`, `text-default-label`, `space-2xs` paddings | chevron rotation (vs Figma's icon swap) — equiv | gap: no `Left Slot` analogue | Type × State (4) | none | Panel pad widened vs Figma (8/16 vs 8/8) — see followups |
| 2 | Banner | sherpa-message | 🟡 | radius pill→`component-banner-border-rounding`, status-tinted bg/border via `--_status-surface-subtle`/`--_status-border`, padding xs/sm, gap xs, font base | leading status icon (driven by `data-status`); inline action link uses `fa-arrow-up-right-from-square`; close uses `sherpa-button data-type=icon data-variant=tertiary` | **none** — converted from slots (heading/default/action) to attribute-driven (`data-label`, `data-action-label`, `data-action-href`, `data-action-icon`) | single component, `has Close` boolean | **full** — bg, border, leading icon all status-tinted | API surface change: removed slots; new attrs `data-label`, `data-action-label`, `data-action-href`, `data-action-icon`. Schemas regenerated. |

---

## Per-component findings

### sherpa-accordion
**Figma node:** `5296:27142` (Component Set)
**Variants:** Type=Collapsed/Expanded × State=Default/Hover (4 total)
**Component properties:** Header Label (TEXT), Content Area (SLOT), Right Slot (SLOT), Left Slot (SLOT)

**Figma variables used**
- `surface/container/default`, `surface/container/hover`
- `component/accordion/border-color`, `component/accordion/border-width`, `component/accordion/border-rounding`
- `space/xs` (8), `space/2xs` (4), `space/none`, `space/default` (16, implicit)
- `content/default/label`
- Typography: `font/base/size`, `font/base/letter-spacing`, `font/body/medium/line-height`, `typeface/open-sans/weight/300`
- Trailing button: instance of tertiary `Button (Icon only)` (its own token chain)
- Icons: `chevron-down` (collapsed), `chevron-up` (expanded)

**Status scope:** none — no status variant; no `--_status-*` consumption needed.

**Fixes applied**
- `--sherpa-border-width-base` → `--sherpa-component-accordion-border-width`
- `--sherpa-border-container-default` → `--sherpa-component-accordion-border-color`
- `--sherpa-border-rounding-sm` → `--sherpa-component-accordion-border-rounding`
- Trigger padding `8/12` → `4/8` (`--sherpa-space-2xs` × `--sherpa-space-xs`)
- Trigger-left gap `8` → `4` (`--sherpa-space-2xs`)
- Trigger label colour `--sherpa-text-default-body` → `--sherpa-text-default-label`
- Panel padding `8/16` → `8/8` (matches Figma Content Area)
- Open-state separator now uses component border tokens (was generic subtle border)

**Follow-ups**
- Figma defines a **Left Slot** (component property) for prefix content alongside the label; code only has trailing `actions` slot. Decide whether to add `<slot name="leading">` (would need `data-accepts="control,display,media"` + tier check). Currently `data-icon` attribute satisfies basic icon-prefix case.
- Figma Expanded variant nests a `Header` frame inside the root with padding=0 on root. Code uses single `<details>` with summary padding always-on. Visual outcome is identical because border lives on host; structural difference doesn't warrant a rewrite.
- Figma swaps icon (`chevron-down`/`chevron-up`); code rotates. Functionally equivalent and accessibility-wise comparable. No change.

---

### sherpa-message (Banner)
**Figma node:** `15046:34907` (single COMPONENT, not a set)
**Component properties:** `has Close` (BOOLEAN, default true), `Content` (SLOT), `Icon` (INSTANCE_SWAP, default status-neutral)

**Figma variables used**
- `surface/subtle/default` — banner bg (NEUTRAL, not status-tinted)
- `border/default` — banner border (NEUTRAL, not status-tinted)
- `border/width/base`
- `component/banner/border-rounding` (4px)
- `space/xs` (8) — padding-block, content-slot itemSpacing
- `space/sm` (12) — padding-inline
- `surface/status/default/strong/default` — leading icon fill (status-driven)
- `content/default/body` — banner text
- `text/link` — link-style action text
- Typography: `font/base/size` (14), `font/base/letter-spacing`, `font/body/medium/line-height`, `fonts/open sans/weight/200`
- Trailing close: tertiary `Button (Icon only)` (size/lg=20)
- Icons: status-neutral leading icon, `open-externally` inline link icon, `close` for dismiss

**Status scope:** **full** — `--_status-surface-subtle` drives bg, `--_status-border` drives border, leading icon picks up `--_status-surface-strong`. Figma's `surface/subtle/default` and `border/default` are status-aware aliases.

**Fixes applied**
- `border-radius: --sherpa-border-rounding-full` (pill) → `--sherpa-component-banner-border-rounding` (4px)
- `background-color`: status-tinted via `--_status-surface-subtle`
- `border-color`: status-tinted via `--_status-border`
- `--_padding-inline`: `space-default` (16) → `space-sm` (12)
- `--_gap`: `space-sm` (12) → `space-xs` (8)
- `--_text-font-size`: `scale-sm` (12) → `scale-base` (14)
- `.message-icon` colour: `--_status-surface-strong` (matches Figma `surface/status/default/strong/default`)
- **Removed slots entirely** (`heading`, default, `action`). Replaced with attribute-driven content: `data-label`, `data-action-label`, `data-action-href`, `data-action-icon`.
- Close button is now a `sherpa-button data-type="icon" data-variant="tertiary" data-icon="fa-solid fa-xmark"` on the right (was bespoke `<button>`).
- Inline action link renders with trailing `fa-arrow-up-right-from-square` icon by default (matches Figma `open-externally`).
- Density compact/comfortable rescaled around the new base padding/gap/font.

**Follow-ups**
- Missing semantic aliases in token output: `--sherpa-surface-subtle-default`, `--sherpa-border-default`, `--sherpa-text-link`. Consumers fall back via existing chain. Re-extract Figma variables when these are published.
- No `[data-status="neutral"]` block in `sherpa-status.css`. When no `data-status` is set, bg/border fall back via hardcoded neutral chain.
- JS `get status()` now returns `''` when no status set (was `'info'`). Behavioural change for consumers reading the prop without first setting `data-status`.

---

## Gap analysis (running)
- **In Figma, missing in code:** Left Slot on accordion (deferred).
- **In code, missing in Figma:** sherpa-message `data-density` axis (no Figma density variants for Banner).
- **Cross-cutting drift:** Banner now fully attribute-driven (no slots). If callout/toast follow Figma's same banner-style spec, expect similar slots→attrs refactors.
- **Missing semantic aliases (token regen needed):** `surface/subtle/default`, `border/default`, `text/link`, `[data-status="neutral"]` block.
