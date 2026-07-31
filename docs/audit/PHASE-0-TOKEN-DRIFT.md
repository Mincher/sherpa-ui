# Phase 0 — Token Drift Report (Figma "App Shell v2" vs codebase)

Ground truth extracted via the Figma plugin API, alias chains resolved to root.
**Audit only — no code changed.** Fix list is gated on approval.

## Summary
The scales (size, space, font, type, density, border-width) are **clean**. Drift is
concentrated in two semantic-mapping bugs + a cluster of 1–2-digit primitive hex
near-misses + stale font fallbacks.

## 1. Semantic mapping bugs (HIGHEST — wrong ramp step, functional)
| Token | Codebase → | Figma | Fix |
|---|---|---|---|
| `--sherpa-border-control-active-default` | brand-700 `#8500cc` | `#c046ff` (brand-base) | Repoint to brand-base in `sherpa-themes.css` |
| `--sherpa-surface-container-secondary-default` | `#fafafa` | `#fdfdfd` (neutral-100) | Repoint one step |

Both are consumed by real components (e.g. QFT chip menu uses `surface-container-secondary`;
active borders use `border-control-active`).

## 2. Primitive hex near-misses (1–2 digits, fix in `primitives.css`)
| Primitive | Codebase | Figma |
|---|---|---|
| basic-monochrome-25 (neutral-100) | #fafafa | #fdfdfd |
| extended-phlox-550 (brand-600) | #a90cff | #a90aff |
| extended-neon-blue-600 (accent-700) | #163382 | #173382 |
| extended-neon-blue-650 (accent-800) | #0e1057 | #0f0f57 |
| basic-blue-green-400 (info-400) | #3cc4f5 | #3dc4f5 |
| basic-blue-green-700 (info-700) | #0179aa | #0079aa |
| basic-red-400 (critical-500) | #f1441a | #f0451c |
| basic-green-600 (success-600) | #04a753 | #01a753 |
| basic-green-700 (success-700) | #048142 | #058142 |
| basic-orange-600 (urgent-600) | #ed6d02 | #ed6d03 |
| basic-orange (warning-600) | #fcb72c | #fcb72d *(borderline)* |
| (warning-700) | #ffae0c | #ffae0b *(borderline)* |

Note: `success-625` already holds the correct #01a753, but `success/600` is wired to green-600.

## 3. Missing scale step
- `--sherpa-border-rounding-2xl` = **24px** — absent (scale jumps xl 16 → full). Primitive
  `--core-border-radius-450: 24px` exists; just add the alias.

## 4. Fonts
- **Token layer correct**: brand/default = Inter; monospaced/data = JetBrains Mono.
- **Stale fallbacks to retire** (contradict Figma, render only if token fails):
  - `sherpa-text-classes.css`: "Open Sans", "Manrope", "Source Code Pro" fallbacks + a
    "Brand font (Manrope)" comment.
  - `reset.css:60`: "Open Sans" fallback.
  - `primitives.css:104-123`: unused Manrope/Open Sans/Roboto/Source Code Pro typeface
    primitive blocks (zero non-definition references — dead).

## 5. Stale / extra (flag only)
- `--sherpa-border-rounding-full` → 9999px vs Figma 999 (both pill — cosmetic).
- `--sherpa-color-palette-*`, Classic-theme families — legitimate extras (Classic theme +
  palette exposure), not drift.

## Proposed fix priority (for the Phase 2 token batch)
1. `border-control-active-default` → brand-base (functional).
2. `surface-container-secondary-default` → #fdfdfd.
3. ~10 primitive hex corrections in `primitives.css`.
4. Add `--sherpa-border-rounding-2xl: 24px`.
5. Retire stale Manrope/Open Sans/Source Code Pro fallbacks + unused typeface primitives.
