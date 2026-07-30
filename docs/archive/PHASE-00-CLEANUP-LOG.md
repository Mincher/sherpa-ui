# Phase 00 — Repository Cleanup — Decision Log

**Date:** 2026-07-30 (re-applied after rebasing onto updated `origin/main`)
**Method:** survey → Delete / Verify / Keep buckets → verify build & gates.

> **Rebase note:** Phase 00 was first done on an older local `main`, then the branch was rebased onto `origin/main` (which had advanced 11 commits). During re-application each deletion was **re-checked against current upstream** — and one original verdict was reversed (see below).

## 🗑️ Deleted (re-verified safe vs current upstream)

| Item | Why removed |
|---|---|
| `--version/` | Accidental Husky artifact (real hooks in `.husky/`; `core.hooksPath=.husky`). Untracked. |
| `scripts/codemod-compat-aliases.js` (+ `tokens:codemod` npm script) | One-shot Token-Pipeline-v2 migration. Re-verified: the `sherpa-platform.css` §2 compat block it targets is **still absent** (0 mentions) → migration complete even on the newer upstream. |
| `scripts/puppeteer-mcp-check.mjs`, `puppeteer-screenshot.mjs` | Unreferenced spikes — still 0 references in current `package.json`/hooks/CI. |
| `COMPONENT-AUDIT-REPORT.json`, `figma-tokens/figma-variables.prev.json` | Generated/scratch; gitignored. |

## 📦 Archived → `docs/archive/investigations/`
The 7 investigation docs (advanced-select, chart-system, layout-pattern, master-detail-grid, nav/node-consolidation, wizard) — roadmap research, present & untouched upstream. Moved out of active `docs/`, retained.

## ↩️ REVERSED verdict (kept — was going to delete)

| Item | Original Phase 00 verdict | Why reversed |
|---|---|---|
| `figma-token-diff-report.md` | delete (thought it was stale generated cruft) | **Upstream now actively tracks and regenerates it** — origin commits `75215e2 Token Diff Report`, `e04613b Tokens script rewrite`, `e25e0b7 Token generation tweaks` rewrote the token pipeline around it. Deleting would fight active upstream work. **KEPT and left tracked.** (My earlier `.gitignore` entry for it was also dropped in the rebase — correctly, since upstream tracks it.) |

## ✅ Kept — essential (unchanged from original)
Sticker-sheet demo pages (`index.html` → `sticker-sheet.html`), suppression-budget scripts (enforced by `.husky/pre-commit`), `audit-components.js`, `mcp-cli.mjs`, `docs/migrations/node-header-to-node-row.md`, all generator-pipeline scripts, source dirs, build config.

## 🐛 Bug re-confirmed on newer upstream (Phase 1)
`npm run build` **still** regenerates `css/styles/index.css` without the `@import "sherpa-brand-status.css";` line (would break `[data-status="brand"]`). Reverted the regeneration; do not commit a built `index.css` until `generate-css-tokens.js` is fixed (Phase 1 deliverable #6).

## ✔️ Verification
`type-check` ✓ · `build` ✓ (brand-status regeneration reverted) · staged set contains only intentional cleanup.
