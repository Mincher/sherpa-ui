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

---

# Phase −1 — Compiler-rework ground-clearing (2026-08-13)

**Context:** Prep for the bidirectional Figma⇄code composition-compiler rework (see memory `sherpa-figma-code-compiler-plan`). "Cleanup first" = only deletions safe **without** the compiler as justification. Branch: `design-audit-components`.

## 🗑️ Deleted (verified zero-importer / zero-reference this session)
| Item | Verification |
|---|---|
| `scripts/lib/differ.js` | 0 importers (grep: only its own file + incidental prose). Token-Studio staged-diff workflow that no longer exists. |
| `scripts/lib/resolver.js` | 0 importers. The MCP's `resolveTokenChain` is a **separate** impl in `mcp-server/lib/loader.js`; `inject-css-fallbacks.js` has its own inline resolver. |
| `figma-tokens/Apex 2.0 (N-able Core)/`, `.../(N-able Data Protection)/`, `Classic/` | 0 code refs; gitignored (`.gitignore:19-20`). Stale W3C `.tokens.json` exports from the Apex-2.0 era. |

## 📝 Stale-doc fixes (REST extraction is superseded by the plugin API — see `docs/DESIGN-AUDIT.md:102`)
Added a truthful "superseded / aborts on sparse data → use plugin API" note at each spot still presenting REST `tokens:extract`/`tokens:refresh` as the working source of truth: `README.md`, `CONTRIBUTING.md`, `css/TOKENS-USAGE-GUIDE.md`, `docs/adr/0005-semantic-tokens-only.md`, `ARCHITECTURE-DIAGRAM.md` (EXTRACT node). Commands left in place (they exist) — only their status clarified.

## 📦 Archived → `docs/archive/` (completed-migration artifacts, git mv, history preserved)
`APEX-SHERPA-DIFF.md`, `APEX-SHERPA-PLAN.md`, `FIX-AUTO-ROW-SPAN.md`.

## ↩️ NOT touched (reversal from the cleanup inventory)
`figma-token-diff-report.md` — the inventory flagged it as archivable, but Phase 00's log already **reversed** that: upstream actively tracks & regenerates it. **Kept tracked & in place.**

## ⏭️ Deferred (need the compiler as justification — folded into later phases)
Legacy `set*` aliases, dual `setData()`/`setMenuItems()` surfaces, duplicate components (product-bar v1 / view-header / quick-filter v1), the ~367 dead alias tokens, the 3-way audit-script overlap.
