# Figma Variable Organisation vs. Sherpa CSS — Diff Report

_Generated: 2026-06-08. Source: [Apex 2.0] Core Figma file vs. `css/styles/tokens/`._

---

## Overview

| | Figma | Sherpa CSS |
|---|---|---|
| Total variables/tokens | 1,033 | ~1,734 |
| Primitive collections | 1 ("Primitives", 395 vars) | 1 (`primitives.css`, 381 tokens) |
| Semantic alias layer | 1 ("Alias", 168 actual semantic + palette vars) | `sherpa-alias.css` (532 tokens) |
| Theme collections | 5 (Apex 2.0 + 4 variants + Classic) | 5 themes in `sherpa-themes.css` (795 tokens) |
| Density | 1 ("Density (Alias)", 14 vars) | Covered in `sherpa-overrides.css` |
| Component-scoped | 10 collections (`->` prefix pattern) | Not mirrored in CSS |

---

## 1. Collection & Structure Organisation

**Figma** splits variables into 21 collections:

- **Tier 1 raw**: `Primitives` — absolute values, no aliases
- **Tier 2 semantic**: `Alias` — mode-less semantic palette (info/warning/critical/etc.) + border/space/size/font scales
- **Tier 3 themed**: `Apex 2.0`, `Apex 2.0 (Purple)`, `Apex 2.0 (Teal)`, `Apex 2.0 (Blue)`, `Classic` — Light/Dark modes per theme, alias-backed
- **Component-scoped**: 10 collections with `->` prefix (e.g. `-> button (size)`, `-> tabs (style)`) — local-only component state variables
- **Utility**: `Status`, `Density (Alias)`, `Layout`, `-> icon (size)`, `-> illustration (size)`

**Sherpa CSS** maps this well but with divergences detailed below.

---

## 2. Naming Convention Translation

The generator translates Figma's `/`-separated paths to CSS `--sherpa-` kebab-case:

| Figma | CSS |
|---|---|
| `color/brand/100` | `--sherpa-color-brand-100` |
| `border/rounding/sm` | `--sherpa-border-rounding-sm` |
| `space/base` | `--sherpa-space-base` |
| `color/basic/monochrome/0` | `--core-color-basic-monochrome-0` |
| `effects/opacity/0` | `--core-effects-opacity-0` |

> **Note:** Figma's `Alias` collection mixes two levels of concern — true semantic aliases (`color/info/*`, `color/brand/*`) and mechanical scale renames (`border/rounding/*`, `space/*`). CSS handles these identically (all in `sherpa-alias.css`). Splitting into two Figma collections would make the architecture cleaner but is not blocking.

---

## 3. Variables in Figma NOT in Sherpa CSS

### A. New typefaces — not yet in CSS

Figma has added new typeface entries since last generation. `--sherpa-fonts-context-brand` still maps to `manrope`.

| Figma variable | Missing CSS token | Response |
|---|---|---|
| `typeface/geist/style/name` + weights | `--sherpa-fonts-context-brand` remapped? | **Remap `--sherpa-fonts-context-brand` to Geist** if Geist is the new brand face. Add raw primitives (`--core-fonts-geist`, etc.) to `primitives.css` first. |
| `typeface/geist-mono/style/name` + weights | (none) | Add `--core-fonts-geist-mono` primitive; alias as `--sherpa-fonts-context-mono` if this replaces/extends the mono context. |
| `typeface/inter/style/name` + weights | (none) | Add `--core-fonts-inter` primitive. Assign to context alias only if Inter serves a defined semantic role (e.g. UI fallback). |
| `typeface/jetbrains-mono/style/name` + weights | (none) | Add `--core-fonts-jetbrains-mono` primitive; likely backs `--sherpa-fonts-context-data` for data/code contexts. |
| `fonts/context/brand/*` (new Alias) | (none) | Add `--sherpa-fonts-context-brand-*` (weight stops) to `sherpa-alias.css` aliasing the matching `--core-fonts-*` primitives. |
| `fonts/context/mono/*` (new Alias) | (none) | Add `--sherpa-fonts-context-mono-*` weight stops to `sherpa-alias.css`. |
| `fonts/context/data/*` (new Alias) | (none) | Add `--sherpa-fonts-context-data-*` weight stops to `sherpa-alias.css`. Data contexts (tables, code) likely need JetBrains Mono here. |

---

### B. Hero & data typography scale — missing from `sherpa-alias.css`

New type ramp in Figma's Alias collection with no CSS equivalent:

| Figma variable | Response |
|---|---|
| `type/hero-1` → `type/hero-5` (size + line-height) | Add `--sherpa-type-hero-1` through `--sherpa-type-hero-5` (size + line-height pairs) to `sherpa-alias.css`. Back each with a `--core-*` primitive size value. |
| `type/data-xl` (size + line-height) | Add `--sherpa-type-data-xl-size` and `--sherpa-type-data-xl-line-height`. Should use `--sherpa-fonts-context-data` font family. |
| `type/data-lg` (size + line-height) | Same as above for `data-lg`. These two data stops plus existing stops define the data type ramp — check for any `data-sm/xs` in Figma too. |

---

### C. `color/accent/classic/*` — missing stops

CSS has `--sherpa-color-primary-classic-*` but is missing several stops present in Figma:

| Missing stop | Figma value | Response |
|---|---|---|
| `color/accent/classic/400` | | Add `--sherpa-color-primary-classic-400` to `sherpa-alias.css` (and backing `--core-*` primitive if not already present). |
| `color/accent/classic/650` | | Same — non-standard stop; confirm it's used in a Classic theme token before adding. |
| `color/accent/classic/700` | | Add. |
| `color/accent/classic/750` | | Add — non-standard stop, same caveat as 650. |
| `color/accent/classic/800` | | Add. |
| `color/accent/classic/1000` | | Add. Note: if 1000 == black/full-saturation, verify it doesn't duplicate `color/accent/classic/900`. |

---

### D. `color/brand/overlay-low` and `color/brand/overlay-high` — missing

These primitives exist in Figma but have no `--core-*` or `--sherpa-*` token.

| Figma variable | Response |
|---|---|
| `color/brand/overlay-low` | Add `--core-color-brand-overlay-low` to `primitives.css`. Expose as `--sherpa-color-brand-overlay-low` only if it's consumed semantically (e.g. scrim, backdrop). |
| `color/brand/overlay-high` | Same. If both are alpha variants of the brand colour, document the opacity level in the token name comment or use `--alpha()` to derive them from the brand primitive. |

---

### E. New elevation XL + focus tint tokens — missing from themes

Added to Figma's Apex 2.0 collection, not yet generated into `sherpa-themes.css`:

| Figma variable | Response |
|---|---|
| `elevation/blur/xl` | Add to all 5 theme blocks in `sherpa-themes.css`. Check whether the `--shadow-lg()` CSS function needs an `xl` variant or if components should compose it manually. |
| `elevation/spread/xl` | Add alongside `blur/xl`. |
| `elevation/offset/x/xl` | Add alongside `blur/xl`. |
| `elevation/offset/y/xl` | Add alongside `blur/xl`. Together these four define `--shadow-xl()` — worth adding that function to `sherpa-functions.css` once the values land. |
| `elevation/tint/focus` | Add as `--sherpa-elevation-tint-focus` in themes. This is likely the colour used for focus-ring box-shadows — cross-reference the explicit focus ring pattern in CLAUDE.md to ensure components use this token rather than hardcoded hex. |

---

### F. `border/rounding/2xl` + `border/radius/450` primitive — missing

| Figma variable | Resolves to | Response |
|---|---|---|
| `border/rounding/2xl` (Alias) | `border/radius/450` | Add `--sherpa-border-rounding-2xl` to `sherpa-alias.css` aliasing `--core-border-radius-450`. |
| `border/radius/450` (Primitives) | new raw value | Add `--core-border-radius-450` with the raw px value to `primitives.css`. The 450-stop suggests it sits between the existing 400 and 500 stops — confirm exact value from Figma. |

---

### G. `size/base` stop — missing

Figma's Alias collection includes `size/base` but CSS only has `--sherpa-size-sm`, `md`, `lg`, etc. — no `base` stop.

| Figma variable | Response |
|---|---|
| `size/base` | Add `--sherpa-size-base` to `sherpa-alias.css`. Confirm its value relative to the existing `sm/md/lg` stops — if it's the mid-point default (likely equal to `md`), it may just be an alias of `--sherpa-size-md`. |

---

### H. Breakpoint tokens — missing

Figma's Layout collection defines breakpoints with no CSS equivalents:

| Figma variable | Response |
|---|---|
| `breakpoint/sm` | Add `--sherpa-breakpoint-sm` etc. to the platform layer (`sherpa-overrides.css` or a new `sherpa-platform.css`). **CSS custom properties cannot be used inside `@media` conditions** — these tokens are for JS consumption and documentation only. Any component responsive logic must use `@container` queries per the architecture rules. |
| `breakpoint/md` | Same. |
| `breakpoint/lg` | Same. |
| `breakpoint/xl` | Same. Consider exporting these as a typed JS constant (`tokens/breakpoints.ts`) so JS consumers have a single source of truth without needing to `getComputedStyle`. |

---

### I. `color/basic/greyscale/150` and `greyscale/950` — missing stops

| Figma variable | Response |
|---|---|
| `color/basic/greyscale/150` | Add `--core-color-basic-greyscale-150` to `primitives.css`. Low priority unless it's actively referenced by a theme token. |
| `color/basic/greyscale/950` | Add `--core-color-basic-greyscale-950`. Check if the dark-mode themes reference it — its absence would cause a silent fallback to `initial`. |

---

### J. Missing Apex 2.0 theme tokens

New tokens in the Apex 2.0 theme collection not yet generated into CSS:

| Figma variable | Response |
|---|---|
| `content/primary/hover` | Add `--sherpa-content-primary-hover` to the Apex 2.0 block in `sherpa-themes.css` (and all variant themes). Check if `sherpa-button` or interactive controls reference a hover content colour — they may be falling back silently. |
| `surface/app/product-nav/sub-active` | Add to all 5 themes. Likely needed by the product-nav component for its active sub-item state. |
| `surface/app/product-bar/product-name` | Add to all 5 themes. |
| `surface/app/product-bar/product-text` | Add to all 5 themes. The `product-bar` tokens suggest the app shell's top bar has new named slots — worth confirming the `sherpa-product-bar` component (if it exists) consumes these rather than relying on generic surface tokens. |

---

## 4. Variables in Sherpa CSS NOT in Figma

### A. `color/primary-blue` vs `color/primary-new` — duplicate token groups

Both `--sherpa-color-primary-blue-*` and `--sherpa-color-primary-new-*` map to identical Figma variables (the `color/accent/*` / neon-blue path). Figma only has one of these now. These appear to be a leftover from a rename.

| CSS token group | Status | Response |
|---|---|---|
| `--sherpa-color-primary-blue-*` | Duplicate of `primary-new` | **Deprecate and remove** after confirming no component CSS or external consumer references it. Run `grep -r 'primary-blue' components/` first. The `-blue` name is the legacy one given the Figma rename. |
| `--sherpa-color-primary-new-*` | Duplicate of `primary-blue` | Keep as the canonical group, but **rename to `--sherpa-color-primary-*`** (dropping `-new`) once the old group is cleared. `-new` is a transitional name that will age poorly. |

---

### B. `adlumin-blue-test` naming — stale `-test` suffix

Figma has renamed `color/basic/adlumin-blue-test/*` to `color/basic/adlumin-blue/*`. CSS still generates `--sherpa-color-palette-adlumin-blue-test-*`.

| | Response |
|---|---|
| Drop `-test` suffix from CSS token names | Rename in the generator template and regenerate. **Breaking change** — grep for `adlumin-blue-test` across `components/` and `patterns/` before shipping; update any references in one pass. Consider a one-release alias (`--sherpa-color-palette-adlumin-blue-test-*: var(--sherpa-color-palette-adlumin-blue-*)`) if external consumers need a migration window. |

---

### C. `--sherpa-effects-shadow-200` — hardcoded raw value

Defined as `rgba(55,47,79,0.2)` in CSS rather than aliasing to a `--core-*` primitive. In Figma this resolves to `color/extended/slate/750` with 20% opacity.

| | Response |
|---|---|
| Alias to `--core-color-extended-slate-750` with opacity instead | Replace the raw `rgba()` with `color-mix(in srgb, var(--core-color-extended-slate-750, #372f4f) 20%, transparent)`. Alternatively use the existing `--alpha()` CSS function from `sherpa-functions.css` — but note it's Chromium 139+ only, so include a hardcoded rgba fallback as the `--_*` intermediate variable. |

---

## 5. Component-scoped Collections — Not Mirrored in CSS (by design)

The 10 `->` prefixed collections (`-> button (size)`, `-> tabs (style)`, `-> input (variants)`, `-> switch`, etc.) are Figma-internal design-time variant controls. Components use `data-*` attributes; CSS selects on those. **Correct and intentional — no action needed.**

---

## 6. Priority Summary

| Priority | Issue |
|---|---|
| **High** | `adlumin-blue-test` → `adlumin-blue` rename in generator + CSS |
| **High** | New font context variables (`geist`, `inter`, `jetbrains-mono`, `fonts/context/data`) |
| **High** | Hero type scale (`type/hero-1–5`, `type/data-xl/lg`) missing from alias |
| **Medium** | `border/rounding/2xl` + `border/radius/450` primitive missing |
| **Medium** | `color/primary-blue` vs `color/primary-new` duplication — consolidate |
| **Medium** | New elevation XL + focus tint tokens missing from themes |
| **Medium** | `color/brand/overlay-low/high` missing |
| **Medium** | Breakpoint tokens — consider adding to platform layer |
| **Low** | `greyscale/150` and `greyscale/950` stops missing |
| **Low** | `--sherpa-effects-shadow-200` hardcoded rgba |
| **Low** | `color/accent/classic` missing stops |
| **Low** | Missing Apex 2.0 theme tokens (`content/primary/hover` etc.) |

---

## 7. Component-Level CSS Impact Assessment

_Assessed: 2026-06-08. Grep coverage: 87 CSS files across `components/`._

---

### 7.1 Font context tokens — naming mismatch will prevent adoption

**Affected files:** `sherpa-code-block.css`

Three `--sherpa-fonts-context-*` names are currently in active use across components:

| Token in use | Component(s) | Defined as |
|---|---|---|
| `--sherpa-fonts-context-default` | `sherpa-data-grid`, `sherpa-sparkline`, `sherpa-barchart`, `reset.css`, `sherpa-text-classes.css` (+ ~30 others) | `var(--core-typeface-open-sans-style-name)` |
| `--sherpa-fonts-context-brand` | `sherpa-metric` | `var(--core-typeface-manrope-style-name)` |
| `--sherpa-fonts-context-monospaced` | `sherpa-code-block` | `var(--core-typeface-source-code-pro-style-name)` |

The new Figma token path `fonts/context/mono/*` would generate `--sherpa-fonts-context-mono-*` — a different name from the existing `--sherpa-fonts-context-monospaced`. **`sherpa-code-block` will silently keep using Source Code Pro via its fallback string and will never pick up JetBrains Mono unless the component is updated.** Either the new alias must be named `--sherpa-fonts-context-monospaced` to match current usage, or a same-value bridge alias is needed during a transition.

**Recommendation:** When adding the `mono` and `data` context tokens, match existing names (`monospaced`) rather than the raw Figma path, or update all component references in the same commit.

---

### 7.2 Data visualisation components — wrong context when `fonts/context/data` lands

**Affected files:** `sherpa-data-grid.css:50`, `sherpa-sparkline.css:291`, `sherpa-barchart.css:184,253,339,355`

These four components use `--sherpa-fonts-context-default` (Open Sans) for axis labels, tick text, and table cells — precisely the contexts the new `fonts/context/data` token is intended for. Once `--sherpa-fonts-context-data` is introduced (backed by JetBrains Mono), these components will not automatically adopt it and will continue rendering in Open Sans.

**Recommendation:** When `--sherpa-fonts-context-data` is added, update these four files to reference it. This is intentionally deferred from the token addition itself — do it in a separate component-level PR so the change can be reviewed for visual regression.

---

### 7.3 Brand font remap — `--sherpa-fonts-context-default` is not affected

**Affected files:** None immediately — but `sherpa-metric.css:148` uses `--sherpa-fonts-context-brand`.

`--sherpa-fonts-context-default` and `--sherpa-fonts-context-brand` are separate tokens. Remapping `brand` to Geist (section 3A recommendation) will only affect `sherpa-metric` and any other components that explicitly reference the `brand` context. The ~30 components using `default` (Open Sans) are unaffected. `sherpa-metric` should be visually verified after the remap; its fallback string `"Open Sans"` will no longer reflect the intended face and should be updated to `"Geist"`.

---

### 7.4 Elevation tint fallback — 7 components embed the hardcoded rgba

**Affected files:** `sherpa-container.css:211,217,224`, `sherpa-container-overlay.css:25`, `sherpa-view-header.css:192`, `sherpa-toast.css:47`, `sherpa-dialog.css:34`

All seven reference `var(--sherpa-elevation-tint-default, rgba(55, 47, 79, 0.2))`. This is the same raw value as `--sherpa-effects-shadow-200` (section 4C). The fallback is baked in light-mode slate — it does not adapt under dark themes because a static rgba cannot respond to theme token changes. When `--sherpa-effects-shadow-200` is fixed to alias `--core-color-extended-slate-750`, the component fallback strings must also be updated in the same pass; leaving them as `rgba(55,47,79,0.2)` defeats the fix.

**Recommendation:** Fix the component fallbacks at the same time as the alias. Replace the rgba literal with a `color-mix()` expression so the fallback itself is also theme-safe, e.g.:

```css
var(--sherpa-elevation-tint-default, color-mix(in srgb, var(--core-color-extended-slate-750, #372f4f) 20%, transparent))
```

---

### 7.5 Elevation XL — additive, zero breaking impact

**Affected files:** None.

No component currently references an `xl` elevation tier. The addition of `elevation/blur/xl` etc. is purely additive. However, `sherpa-container.css:25` documents its `data-elevation` enum as `none | sm | md | lg` — once `xl` is available, this JSDoc comment should be updated to include `xl` and the component should add the corresponding `:host([data-elevation="xl"])` rule.

---

### 7.6 `elevation/tint/focus` — not yet consumed; focus rings need auditing

**Affected files:** No current references.

The new `--sherpa-elevation-tint-focus` theme token has no component consumers yet. CLAUDE.md mandates `box-shadow: 0 0 0 2px var(--sherpa-border-control-primary-default, #3c5edd)` for focus rings. Once the focus tint token lands, interactive components should be audited to determine whether their focus ring colour should migrate from `--sherpa-border-control-primary-default` to `--sherpa-elevation-tint-focus`. The two tokens may serve different purposes (border vs. elevation tint), so this is a design decision, not a mechanical find-and-replace.

---

### 7.7 `surface/app/product-bar/*` tokens — components exist but use generic tokens

**Affected files:** `sherpa-product-bar.css:56`, `sherpa-nav.css:353,396,404`

`sherpa-product-bar` already has a `.product-name` element styled with generic scale tokens (`--sherpa-fonts-scale-lg`, `--sherpa-font-weight-semibold`). The missing `surface/app/product-bar/product-name` and `product-bar/product-text` tokens from section 3J are the semantic tokens these elements should be consuming once they exist. Separately, `sherpa-nav.css:533` already references `--sherpa-surface-app-product-nav-promo-bg` — confirming the `surface/app/product-nav/*` namespace is in active use, which makes `sub-active` (also from 3J) the natural next token for the nav's active sub-item state.

**Recommendation:** After adding the 3J tokens to `sherpa-themes.css`, update `sherpa-product-bar.css` and `sherpa-nav.css` in a follow-on PR to consume them.

---

### 7.8 Token renames — no component-level breakage, external consumer risk remains

**Affected tokens:** `--sherpa-color-primary-blue-*`, `--sherpa-color-primary-new-*`, `--sherpa-color-palette-adlumin-blue-test-*`

None of these appear in any component CSS file. Renaming or removing them carries **zero risk within this repo**. The risk is entirely external — application-level stylesheets or third-party consumers that import the token file directly. A deprecation alias period is advisable (see section 4A and 4B responses).

---

### 7.9 Summary table — component impact by report item

| Report item | Components affected | Impact type | Requires component CSS edit? |
|---|---|---|---|
| 3A — New font context tokens | `sherpa-code-block` (naming mismatch) | Silent no-op on JetBrains Mono adoption | Yes — after token lands |
| 3A — Brand font remap to Geist | `sherpa-metric` | Visual change; stale fallback string | Yes — update fallback |
| 3B — Hero/data type scale | None currently | Additive | No |
| 3E — Elevation XL | None currently | Additive | Yes — `sherpa-container` enum + new rule |
| 3E — `elevation/tint/focus` | None currently | Additive; needs design decision | Possibly — focus ring audit |
| 3J — `surface/app/product-bar/*` | `sherpa-product-bar`, `sherpa-nav` | Components exist; currently use generic tokens | Yes — follow-on PR |
| 3J — `content/primary/hover` | None currently | Additive | No |
| 4A — `primary-blue/new` rename | None | No component impact | No |
| 4B — `adlumin-blue-test` rename | None | No component impact | No |
| 4C — `effects-shadow-200` alias fix | `sherpa-container`, `sherpa-container-overlay`, `sherpa-view-header`, `sherpa-toast`, `sherpa-dialog` | 7 hardcoded fallbacks must be updated in same pass | Yes — same PR as alias fix |
| Data viz `default` → `data` context | `sherpa-data-grid`, `sherpa-sparkline`, `sherpa-barchart` | Intentional deferred migration | Yes — separate PR |
