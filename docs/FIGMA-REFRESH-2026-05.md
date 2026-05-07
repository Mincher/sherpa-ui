# Figma Variables Refresh — Findings & Status

**Date:** 2026-05-06
**Scope:** Re-extract Figma variables (43 collections, 1379 vars) and propagate to CSS.

---

## TL;DR

The May 2026 Figma refactor made three structural changes that broke the
generator:

1. **`Alias` collection emptied** (was 179 vars → now effectively 0). Most of
   the lost vars were primitive→primitive convenience aliases that no one
   consumed. **18 semantic aliases** still referenced by component CSS or DTCG
   exports were rescued via a `MANUAL_ALIASES` block.
2. **`Density` collection renamed → `Density (Alias)`**. Generator now reads
   either name.
3. **Stale `aliasData` in DTCG exports** — Apex 2.0 Core's
   `surface/control/primary/*` and `border/control/primary/*` still point to a
   `color/primary/new/*` family that no longer exists. Generator now falls back
   to the resolved raw colour when an Alias target is missing.

After these patches, regeneration produces zero **net-new** unresolved tokens.
The 58 remaining unresolved component-CSS refs (`--sherpa-node-*`,
`--sherpa-z-*`, `--sherpa-effects-focus-ring`, `--sherpa-ai-accent-gradient`,
etc.) are pre-existing and unrelated to this Figma update.

---

## Files Changed (this task)

| File | Change |
| ---- | ------ |
| `scripts/extract-figma-vars.js` | Preserve hand-authored `slug` / `folder` keys when rebuilding `themes` block (Figma REST API does not return them). |
| `scripts/generate-css-tokens.js` | (a) Density loader accepts new `Density (Alias)` name. (b) `generateAlias()` skips `properties/*` and null-valued vars. (c) `MANUAL_ALIASES` block re-declares 18 semantic aliases lost to the Figma wipe. (d) `resolveAliasToVar()` falls back to raw value when Alias target name is missing from the lookup set (handles stale DTCG `aliasData`). |
| `figma-tokens/figma-variables.json` | Fresh extract; `themes.base.slug/folder` and `themes.extended[*].folder` patched in (extract bug had wiped them). |
| `figma-tokens/figma-variables.prev.json` | Backup of pre-refresh data for diffing — keep until refresh is reviewed. |
| `css/styles/tokens/sherpa-primitives.css` | Added `--sherpa-core-border-radius-450: 24px;`. Updated `--sherpa-core-color-basic-red-100` from `#f8c4b8` → `#ffd7ca`. |
| `css/styles/tokens/sherpa-alias.css` | Regenerated (reflects MANUAL_ALIASES + emptied Alias collection). |
| `css/styles/sherpa-theme-base.css` | Regenerated. |
| `css/styles/sherpa-theme-{apex-2-core,data-protection,classic}.css` | Regenerated (per-theme diff blocks). |

---

## Manual Aliases Re-Declared

Living in `scripts/generate-css-tokens.js` → `MANUAL_ALIASES`. Each entry is
sourced from `figma-variables.prev.json`'s old Alias collection. **If Figma
re-adds the alias, delete the row.**

```
border:
  --sherpa-border-rounding-sm    → border-radius-100  (2px)
  --sherpa-border-rounding-lg    → border-radius-300  (8px)
  --sherpa-border-rounding-full  → border-radius-1000 (9999px)
  --sherpa-border-width-sm       → border-stroke-200  (0.5px)
  --sherpa-border-width-base     → border-stroke-300  (1px)
  --sherpa-border-width-lg       → border-stroke-400  (2px)
  --sherpa-border-width-2xl      → border-stroke-600  (...)
color:
  --sherpa-color-brand-400       → color-extended-phlox-400
  --sherpa-color-brand-800       → color-extended-phlox-650
  --sherpa-color-brand-base      → color-extended-phlox-500
  --sherpa-color-critical-100    → color-basic-red-0
  --sherpa-color-critical-900    → color-basic-red-800
  --sherpa-color-info-100        → color-basic-blue-green-0
  --sherpa-color-info-900        → color-basic-blue-green-900
  --sherpa-color-neutral-0       → color-basic-monochrome-0
  --sherpa-color-neutral-700     → color-basic-greyscale-700
  --sherpa-color-success-100     → color-basic-green-0
  --sherpa-color-success-900     → color-basic-green-900
```

---

## Open Questions / Decisions for Design Team

1. **Alias collection wipe** — confirm intent. If permanent, the `MANUAL_ALIASES`
   block should be migrated into a hand-authored CSS partial and the generator
   block deleted.
2. **`color/primary/new/*` references in Apex 2.0 Core DTCG** — exports still
   point at a vanished alias family. Currently working via raw-value fallback,
   but Figma should clean these up.
3. **High Contrast mode** (NEW in all theme collections, ~75% populated):
   should we ship `:root[data-contrast="high"]` overrides now? If yes, the
   generator must be extended to triplet (light/dark/high) output and DTCG
   exports must include HC values (currently only Light + Dark are exported).
4. **`3. Mode` shadow tokens** — 16 vars, all unpopulated. Defer.
5. **2 removed Apex 2.0 vars** — confirm intentional:
   - `component/tag/border-rounding`
   - `component/toast/border-thickness-left`
6. **11 `color/basic/adlumin-blue-test/*` vars** added to Primitives — appear
   to be WIP / test scale, **not added to CSS**. Confirm they should be
   ignored or promoted to production.

---

## Generator Warnings Still Present (Expected)

```
⚠ --sherpa-font-base-size: non-color value differs between modes (Classic theme; light: 13px, dark: 14px) — using light value
⚠ --sherpa-font-xs-size:   non-color value differs between modes (Classic theme; light: 11px, dark: 10px) — using light value
```

These are pre-existing Classic-theme typography divergences and will need a
generator-side decision (light-dark() doesn't apply to non-color values).

---

## Verification

```bash
npm run tokens:generate     # produces 6 CSS files, 2 expected warnings
# Component CSS unresolved tokens: 58 (matches pre-refresh baseline; no net new)
# Stale internal refs in css/styles/: 0
```

---

## Not Yet Done (next phases)

- **Phase 4** — High Contrast wiring (architectural; needs design go-ahead).
- **Phase 5** — Shadow token Mode collection (waiting on Figma values).
- **Phase 7** — Cleanup the 58 pre-existing unresolved component tokens
  (`--sherpa-node-*`, `--sherpa-z-*`, `--sherpa-effects-focus-ring`, etc.).
- **Phase 8** — Run `npm run schemas` + `npm run component-docs` after token
  surface settles.
- **Phase 9** — Visual QA in `index.html` (theme/mode/density switcher).
