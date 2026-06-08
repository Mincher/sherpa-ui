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
| `typeface/geist/style/name` + weights | `--sherpa-fonts-context-brand` remapped? | |
| `typeface/geist-mono/style/name` + weights | (none) | |
| `typeface/inter/style/name` + weights | (none) | |
| `typeface/jetbrains-mono/style/name` + weights | (none) | |
| `fonts/context/brand/*` (new Alias) | (none) | |
| `fonts/context/mono/*` (new Alias) | (none) | |
| `fonts/context/data/*` (new Alias) | (none) | |

---

### B. Hero & data typography scale — missing from `sherpa-alias.css`

New type ramp in Figma's Alias collection with no CSS equivalent:

| Figma variable | Response |
|---|---|
| `type/hero-1` → `type/hero-5` (size + line-height) | |
| `type/data-xl` (size + line-height) | |
| `type/data-lg` (size + line-height) | |

---

### C. `color/accent/classic/*` — missing stops

CSS has `--sherpa-color-primary-classic-*` but is missing several stops present in Figma:

| Missing stop | Figma value | Response |
|---|---|---|
| `color/accent/classic/400` | | |
| `color/accent/classic/650` | | |
| `color/accent/classic/700` | | |
| `color/accent/classic/750` | | |
| `color/accent/classic/800` | | |
| `color/accent/classic/1000` | | |

---

### D. `color/brand/overlay-low` and `color/brand/overlay-high` — missing

These primitives exist in Figma but have no `--core-*` or `--sherpa-*` token.

| Figma variable | Response |
|---|---|
| `color/brand/overlay-low` | |
| `color/brand/overlay-high` | |

---

### E. New elevation XL + focus tint tokens — missing from themes

Added to Figma's Apex 2.0 collection, not yet generated into `sherpa-themes.css`:

| Figma variable | Response |
|---|---|
| `elevation/blur/xl` | |
| `elevation/spread/xl` | |
| `elevation/offset/x/xl` | |
| `elevation/offset/y/xl` | |
| `elevation/tint/focus` | |

---

### F. `border/rounding/2xl` + `border/radius/450` primitive — missing

| Figma variable | Resolves to | Response |
|---|---|---|
| `border/rounding/2xl` (Alias) | `border/radius/450` | |
| `border/radius/450` (Primitives) | new raw value | |

---

### G. `size/base` stop — missing

Figma's Alias collection includes `size/base` but CSS only has `--sherpa-size-sm`, `md`, `lg`, etc. — no `base` stop.

| Figma variable | Response |
|---|---|
| `size/base` | |

---

### H. Breakpoint tokens — missing

Figma's Layout collection defines breakpoints with no CSS equivalents:

| Figma variable | Response |
|---|---|
| `breakpoint/sm` | |
| `breakpoint/md` | |
| `breakpoint/lg` | |
| `breakpoint/xl` | |

---

### I. `color/basic/greyscale/150` and `greyscale/950` — missing stops

| Figma variable | Response |
|---|---|
| `color/basic/greyscale/150` | |
| `color/basic/greyscale/950` | |

---

### J. Missing Apex 2.0 theme tokens

New tokens in the Apex 2.0 theme collection not yet generated into CSS:

| Figma variable | Response |
|---|---|
| `content/primary/hover` | |
| `surface/app/product-nav/sub-active` | |
| `surface/app/product-bar/product-name` | |
| `surface/app/product-bar/product-text` | |

---

## 4. Variables in Sherpa CSS NOT in Figma

### A. `color/primary-blue` vs `color/primary-new` — duplicate token groups

Both `--sherpa-color-primary-blue-*` and `--sherpa-color-primary-new-*` map to identical Figma variables (the `color/accent/*` / neon-blue path). Figma only has one of these now. These appear to be a leftover from a rename.

| CSS token group | Status | Response |
|---|---|---|
| `--sherpa-color-primary-blue-*` | Duplicate of `primary-new` | |
| `--sherpa-color-primary-new-*` | Duplicate of `primary-blue` | |

---

### B. `adlumin-blue-test` naming — stale `-test` suffix

Figma has renamed `color/basic/adlumin-blue-test/*` to `color/basic/adlumin-blue/*`. CSS still generates `--sherpa-color-palette-adlumin-blue-test-*`.

| | Response |
|---|---|
| Drop `-test` suffix from CSS token names | |

---

### C. `--sherpa-effects-shadow-200` — hardcoded raw value

Defined as `rgba(55,47,79,0.2)` in CSS rather than aliasing to a `--core-*` primitive. In Figma this resolves to `color/extended/slate/750` with 20% opacity.

| | Response |
|---|---|
| Alias to `--core-color-extended-slate-750` with opacity instead | |

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
