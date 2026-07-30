# Sherpa-UI Roadmap Plan

**Generated:** 2026-07-30
**Companion to:** [APEX-SHERPA-DIFF.md](APEX-SHERPA-DIFF.md)
**Inputs:** the diff report + Will's decisions on each gap + the **App Shell v2** Figma branch (`gfI2qK577EvUl4mdCt2BXP`, node `24486-24349`).

This plan sequences all agreed work. It's ordered so that **foundations that everything else depends on come first** (naming/architecture consistency → tokens), then the **highest-value net-new surface (App Shell v2)**, then **gap-closing components**, then the **superset improvements**, then **tooling/docs**. Each phase lists concrete deliverables, dependencies, and a definition of done.

---

## Decisions captured (from review)

| Item | Decision |
|---|---|
| Data Grid | Iterative improvement toward parity. **Not immediate.** |
| Advanced SelectBox | Build as a **select whose menu is a tree hierarchy**, optional checkboxes for multi-select. Avoid Apex's complexity. |
| Treeview | Same tree content as the Advanced SelectBox menu, in a different container. **Consolidate** into one shared tree primitive. |
| Worksheet | **Not needed** — dumb wrapper, doesn't warrant a component. |
| Layout patterns | Superseded by **App Shell v2**: improved Navigation + new **App Header** (Product Bar + View Header merged), plus **Quick Filter Toolbar** with **Quick Filter Chips**. All in the Figma branch. |
| App Shell / App Header / Quick Filters | Net-new Sherpa surface — build from the branch. |
| Node Graph / AI Surface | Keep as Sherpa superset; **future improvement work**. |
| Consistency | Enforce HTML-templates / CSS / JS-for-data-and-events split; consistent property & variable naming. |
| MCP & docs | Improve the Sherpa MCP server and documentation. |
| Generative UI | Sherpa will be used in **generative UI** use cases. MCP must **validate any HTML template passed to a component against a schema**. **HTML is the canonical format end-to-end**; support a **JSON mirror of the HTML template** where agent pipelines need it, via a lossless HTML↔JSON bridge. See **Phase 8**. |

**Resolved open questions (from follow-up):**

| Q | Decision |
|---|---|
| Event / element naming | **`sherpa-` prefix everything** — all Sherpa-UI custom elements are `sherpa-*`. (Applies to element names; the node-graph `sherpa-*` *event* prefix is no longer a special case — see Phase 0 naming contract.) |
| filter-bar vs quick-filter-toolbar | **Replaced.** `sherpa-filter-bar` is superseded by `sherpa-quick-filter-toolbar`. |
| view-header | **Keep `sherpa-view-header` for legacy UI recreation only.** `sherpa-app-header` is the new baseline. |
| Treeview container | **Tree primitive placed in a container** — no dedicated wrapper element. "Structured Flexibility." |

---

## Phase map (at a glance)

```
Phase 00 Repository cleanup ─ strip to essentials ────┐  (do first — declutter before building)
Phase 0  Consistency & architecture audit ───────────┤  (foundation)
Phase 1  Token & naming consolidation ───────────────┘
Phase 2  Shared Tree primitive → Advanced SelectBox + Treeview
Phase 3  App Shell v2  (Navigation v2 · App Header · App Shell)
Phase 4  Quick Filter Toolbar + Quick Filter Chips
Phase 5  Superset polish  (Node Graph · AI Surface)
Phase 6  Data Grid iterative parity  (ongoing, parallelisable)
Phase 7  MCP server + documentation uplift  (ongoing, parallelisable)
Phase 8  Generative UI: schema-validated templates (HTML canonical · JSON mirror)  (ongoing, parallelisable)
```

Phase 00 clears dev-phase cruft so the conformance sweep (Phase 0) runs against only real, essential files. Phases 0–1 gate everything (they define the conventions new components must follow). Phase 2 unblocks 3–4 (tree is used in nav/filters). Phases 6, 7 and 8 run continuously alongside the others (Phase 8 builds on Phase 0.4's slot contracts).

---

## Phase 00 — Repository cleanup (strip to essentials)

**Goal:** remove the scripts, files, and artifacts left over from earlier development phases so the codebase is only the essentials before any new work starts. Everything after this runs against a lean tree.

**Why first:** dev-phase cruft (one-shot codemods, generated reports, accidental artifacts, stale sticker sheets) pollutes the Phase 0 conformance sweep, inflates search results, and confuses agents/contributors about what's load-bearing. Clear it before it gets copied forward.

**Method (safe, not blind):** work in three buckets — **Delete / Keep / Verify-then-decide**. Do it on a branch, one commit per bucket, so anything can be reverted. For each candidate: check `git ls-files` (tracked?), `git log -1 --` (last touched?), and grep for references (package.json scripts, imports, docs links) before removing. Nothing tracked is deleted without confirming it's unreferenced.

### Candidates found in the current tree (2026-07-30 survey)

**🗑️ Delete — accidental / regenerable / stale (verified low-risk):**
- **`--version/`** — accidental artifact (a dir named `--version` containing only `_/`; almost certainly a mis-parsed CLI flag writing to disk). **Untracked.** Delete.
- **`COMPONENT-AUDIT-REPORT.json`** — generated output of `npm run audit`; already `.gitignore`d. Delete the working copy (regenerates on demand).
- **`figma-token-diff-report.md`** — generated token-diff output (tracked). Confirm it's a report artifact, not hand-authored docs, then delete + gitignore it (like `COMPONENT-AUDIT-REPORT.json`).
- **`figma-tokens/figma-variables.prev.json` / `.staged.json`** — diff-scratch snapshots; already gitignored. Delete working copies (regenerate via `tokens:refresh`).
- **Stale sticker sheets** — `sticker-sheet.html`, `sticker-sheet-nav.html` at root: confirm superseded by Storybook/`index.html` demo before removing (tracked — verify first).

**🔎 Verify-then-decide — one-shot / dev-phase tooling that may have served its purpose:**
- **`scripts/codemod-compat-aliases.js`** (+ `tokens:codemod` script) — a migration codemod whose *own header* says the compat aliases "can be deleted" once applied. If the migration is complete, remove the script + the `token:codemod` npm script + the compat-alias block it targets in `sherpa-platform.css` §2 (coordinate with Phase 1's platform-file work).
- **`scripts/count-suppressions.js` / `check-suppression-regression.cjs`** (+ `ts:suppressions*`, `ts:check-regression`) — TS `@ts-expect-error` budget tooling (`.fallowrc.json`). **Keep if the suppression budget is still enforced**; retire only if that governance is being dropped. Decision, not automatic.
- **`scripts/audit-components.js`** (+ `audit*`) — component audit tooling. Keep if still run; fold into Phase 0/7 tooling if it overlaps with `validate-jsdoc`/lint. Decide.
- **`scripts/puppeteer-mcp-check.mjs` / `puppeteer-screenshot.mjs`** — check whether these are live test/CI helpers or leftover spikes.
- **`docs/investigations/`, `docs/migrations/`, `docs/AUDIT-IMPROVEMENT-PLAN.md`** — archive completed investigations/migrations (move to a `docs/archive/` or delete) so `docs/` holds only current standards (`COMPONENT-API-STANDARD.md`, `-CATEGORIES`, `-TEMPLATE`, `TYPESCRIPT-STANDARDS.md`, etc.).
- **Root loose files** — `mcp-cli.mjs`, `index.html`: confirm each is still used (MCP CLI entry / demo page) vs. leftover.

**✅ Keep — essential, do not touch:**
- Source: `components/`, `css/`, `patterns/`, `mcp-server/`, `test/`.
- Build/config: `package.json`, `tsconfig*.json`, `.gitignore`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `TESTING.md`.
- Generator pipeline scripts in active `package.json` use: `extract-figma-vars`, `generate-css-tokens`, `inject-css-fallbacks`, `diff-tokens`, `copy-component-assets`, `extract-pattern-index`, `lint-component-css`, `test-a11y`, `validate-jsdoc`, `jsdoc-utils`, `scripts/lib/*`.
- Tracked Figma bootstrap: `figma-tokens/figma-config.json`, `token-overrides.json` (per `.gitignore` notes).
- The three planning docs: `APEX-SHERPA-DIFF.md`, `APEX-SHERPA-PLAN.md`, `ARCHITECTURE-DIAGRAM.md`.

### Deliverables
1. **Cleanup branch** with per-bucket commits (Delete / codemod-retirement / docs-archive).
2. **Decision log** for every Verify item (kept vs removed + why) — a short table appended here or in `CONTRIBUTING.md`.
3. **`.gitignore` tune-up** — ensure every generated artifact (audit report, token-diff report, prev/staged snapshots) is ignored so cruft can't reaccumulate.
4. **package.json script prune** — remove npm scripts pointing at deleted tooling; confirm `npm run build` + `npm test` still pass afterward.
5. **Root-tidy** — repo root holds only essentials; anything kept "for reference" moves to `docs/archive/`.

**Definition of done:** `git status` clean; `npm run build`, `npm test`, `npm run mcp` all pass; repo root and `scripts/` contain only referenced, essential files; a decision log records what was removed and what was deliberately kept.

> ⚠️ Note: run **before Phase 1's `sherpa-platform.css` work** so the codemod-alias removal and the platform-file token reconciliation are coordinated (both touch that file).

---

## Phase 0 — Consistency & architecture audit

**Goal:** lock down the conventions before adding new surface area, so App Shell v2 is built on a clean, consistent base rather than propagating drift.

**Why first:** every later phase adds components. If naming/structure conventions aren't pinned now, the new work multiplies the inconsistency and the cleanup cost.

### Deliverables
1. **Architecture conformance sweep** across all 73 components against the CLAUDE.md golden rules:
   - HTML `<template>` for all structure; no `createElement()` / structural `innerHTML`.
   - CSS owns all visibility (`:host([data-*])`); JS never toggles `display`/`hidden`/`classList` for visual state.
   - `:host(:not())` functional form (no chained/`&`-nested host selectors).
   - Focus rings use explicit `box-shadow` fallback, not `--focus-ring()`.
   - Disabled uses inactive tokens, never `opacity`.
   - Events `bubbles: true` (+ `composed: true` where crossing shadow boundary).
   - Produce a **conformance matrix** (component × rule → pass/fail) and a fix backlog.
2. **JSDoc `@fires` accuracy pass** — reconcile code-dispatched events with documented ones (diff flagged: `sherpa-dialog` → `dialog-finish`/`dialog-page-change`, `sherpa-node` → `sherpa-node-value-change`, etc.). This directly improves MCP schema quality (feeds Phase 7).
3. **Deprecation cleanup plan** — `sherpa-product-bar` (→ App Header), `sherpa-node-header` (→ `sherpa-node-row`), `sherpa-node-socket data-multi`. Note that App Shell v2 will retire `product-bar` and likely `view-header` too (merged into App Header).
4. **Slot-contract completeness pass (feeds generative UI / Phase 8).** Every component that accepts slotted content must declare its allowlist via `<slot data-accepts="…">`, and every container/composition component must have accurate slot definitions in its JSDoc. This is the raw material the schema validator uses to enforce *structural* nesting (e.g. "`sherpa-quick-filter-toolbar` accepts only `sherpa-quick-filter`"). Turn on `static strictSlots = true` where a component's composition rules are firm. Today `data-accepts` exists but is under-populated and only warns — make it complete and authoritative.

### Naming consistency rules to ratify (becomes the contract for all later phases)
- **Attributes:** `data-*` for public API; native attrs (`disabled`, `name`, `value`, `hidden`) un-prefixed. Standard enums reused verbatim: `data-variant`, `data-size`, `data-status` (critical\|warning\|success\|info\|urgent), `data-type`, `data-layout`, `data-active`, `data-selected`.
- **CSS custom props:** `--core-*` (never in component CSS) → `--sherpa-*` (always with hardcoded fallback) → `--_*` (private).
- **Element names:** every Sherpa-UI custom element is `sherpa-*` — ratified, no exceptions.
- **Events:** currently mixed `noun-verb` (`button-click`, `page-change`) vs `sherpa-*` namespace (node family). **Ratified:** standardise on **unprefixed `noun-verb`** event names across all components (e.g. `tree-select`, `quick-filter-change`). Migrate the node-graph family off its `sherpa-*` *event* prefix during Phase 5 (the element names stay `sherpa-*`; only the event strings normalise). Document the migration so listeners update.
- **Sort/segment attrs:** standardise `data-sort-field`/`data-sort-direction`, `data-segment-field`/`data-segment-mode` across all data/chart components (already mostly consistent — enforce).

**Definition of done:** conformance matrix published; fix backlog triaged into "block new work" vs "opportunistic"; naming contract written into CLAUDE.md; `@fires` accurate.

---

## Phase 1 — Token & naming consolidation

**Goal:** guarantee the token layer is complete and correctly aliased before new components consume it, and fold in App Shell v2's new tokens.

**Why here:** App Header, Nav v2, and Quick Filters (Phase 3–4) reference nav/product-bar/filter-bar token collections that already exist in Figma. Get them into Sherpa's alias layer first.

### Deliverables
1. **Regenerate `--sherpa-*` alias layer** from the Apex 2.0 Figma variables, including the **App Shell v2 branch** additions. Confirm coverage of:
   - `surface/app/product-bar/*`, `surface/app/product-nav/*`, `content/app/product-bar/*`, `content/app/product-nav/*`, `component/product-nav/*` (nav + header).
   - `-> filter-bar (tbd)` collection (default/active/inactive) → Quick Filter states.
   - `-> navigation-menu (tbd)` (maximised/minimised) → Nav v2 states.
2. **Data-viz palette parity check** (flagged in diff): ensure chart components consume the full `data-viz/*` set — categorical ×11, sequential per-hue ×5, divergent ×11 across ramps. Fix any hardcoded chart colours.
3. **Font-context parity** (flagged in diff): map `fonts/context/brand|mono|data` (Geist / Inter / JetBrains Mono / Manrope / etc.) into Sherpa typeface tokens.
4. **Theme + mode verification:** all 5 themes (`apex-2-core/blue/purple/teal`, `classic`) × light/dark, plus Sherpa's `hc` mode, resolve for the new tokens. Verify **Density** (Base/Compact/Comfortable) and **Layout** (Large/Medium/Small) collections are represented via the density cascade layer + container queries.
5. **Reconcile `sherpa-platform.css` drift with Figma (verified gap).** The file's header claims "no Figma source" for **font weights, motion durations, breakpoints** — but the Apex 2.0 library *does* define all three (verified via figma-console): `motion/duration/0–500` (Primitives), `typeface/*/weight/*` + semantic `fonts/context/*/weight/*` (Primitives/Apex 2.0), `breakpoint/sm|md|lg` (Layout collection). These were added to Figma after the platform file was hand-authored and the generator was never taught to emit them. Actions:
   - Teach `generate-css-tokens.js` to emit **font weights** — note Figma stores *names* (`weight/100→"Light"`, `200→"Regular"`, `300→"Semibold"`, `400→"Bold"`), a positional scale, **not** CSS numbers; needs a name→CSS-weight mapping (400/500/600/700), not passthrough.
   - **Motion:** decide policy — Figma has `150/225/300/425/600`ms; Sherpa hand-tuned to `150/250/400`ms *by intent* (comment says "tuned without re-extracting Figma"). Either adopt Figma values or **keep the hand-tune but update the comment** to say it's a deliberate override, not "no source."
   - **Breakpoints:** generate the numeric values from the `Layout` collection; they stay JS-only (custom props can't be used in `@media` — that caveat is correct).
   - Correct the stale header comment either way so it stops asserting "no Figma source" for tokens that have one.

**Definition of done:** alias layer regenerated and diffed; no hardcoded colours in chart/nav/header components; typography contexts mapped; all themes/modes render App Shell v2 tokens; `sherpa-platform.css` header is accurate and font-weight/breakpoint (and motion, per policy) tokens are generator-sourced or explicitly documented as intentional overrides.

---

## Phase 2 — Shared Tree primitive → Advanced SelectBox + Treeview

**Goal:** one tree engine, two containers. Deliver Advanced SelectBox (tree-in-a-dropdown, optional multi-select checkboxes) and consolidate Treeview onto the same core.

**Why here:** it's a self-contained, high-value gap-closer, and the tree is reused by Nav v2 (hierarchical nav) — so building it before Phase 3 pays off.

### Design
- **`sherpa-tree` (new internal/primitive)** — renders a hierarchical list from a data model: expand/collapse, keyboard nav (roving tabindex, arrow keys, type-ahead), optional `data-selection="single|multi"` with checkboxes, indeterminate parent state, lazy-children hook. Built on HTML `<template>` cloning prototypes (no `createElement`), CSS-owned expand/collapse via `data-expanded`, `change`/`tree-expand`/`tree-select` events.
- **Advanced SelectBox** = extend `sherpa-input-select` with `data-template="tree"` (already stubbed) so its popup menu hosts `sherpa-tree`. Single-select returns `{value, path}`; multi-select returns `{value: string[]}` with checkboxes. **Deliberately simpler than Apex** — no server datasource/toolbar/state-storing.
- **Treeview** = `sherpa-tree` placed in a plain container (panel/list context) rather than a dropdown. **Ratified: no dedicated wrapper element — the tree primitive dropped into a container *is* the treeview.** "Structured Flexibility."

### Deliverables
1. `sherpa-tree` primitive + tests (keyboard a11y is the hard part — cover it).
2. `sherpa-input-select` tree template wired to it (single + multi).
3. Treeview usage documented as "drop `sherpa-tree` into a container" (no separate component).
4. MCP schema + examples for both.

**Definition of done:** tree-select works single & multi with full keyboard a11y; same primitive renders as a standalone treeview; a11y audit passes.

---

## Phase 3 — App Shell v2 (Navigation v2 · App Header · App Shell)

**Goal:** implement the new application chrome from the Figma branch. This supersedes the old layout-pattern gap and retires `sherpa-product-bar`/`sherpa-view-header`.

**Source (branch `gfI2qK577EvUl4mdCt2BXP`):** App Header component (1600×120), Navigation v2 (maximised/minimised), Product Navigation v2, Quick Nav Items, full dashboard examples in light+dark.

### 3a. Navigation v2 (`sherpa-nav` evolution)
Rework `sherpa-nav` / `sherpa-nav-item` / `sherpa-nav-section` to the v2 design:
- Maximised (expanded, ~full width) ↔ minimised (collapsed, ~52px) states — CSS-driven via `data-nav-state`, consuming the `-> navigation-menu (tbd)` tokens.
- Navigation Section v2 (grouping, expand/collapse, reorder), Navigation Item v2 (icon, badge, status, pinned, favourite), Product Navigation v2 (product switcher block), Quick Nav Items, "Search navigation…" field.
- Preserve existing rich event surface (`navitemclick`, `navpinchange`, `navsectionexpand`, `navfavoritechange`, `navmodechange`, edit-mode events…).
- Hierarchical sections can reuse the **Phase 2 tree primitive** where a tree structure applies.

### 3b. App Header (`sherpa-app-header` — NEW)
Merge Product Bar + View Header into one component per the branch. Regions observed in the design:
- **Branding / Product name / Product Icon** (left).
- **Breadcrumbs + View title** (`.Breadcrumb`, "View title", Title Row).
- **Save-n-Fave** (favourite + save actions), **View Details**.
- **App History & Actions** (History, contextual Actions), **Notifications**, right-side action slot (`Slot - Right Actions`).
- Hosts the **Quick Filter Toolbar** (Phase 4) as a sub-region.
- Public API via `data-*`: `data-product-name`, `data-view-title`, breadcrumbs data, `data-favorite`, `data-show-history/-notifications`, slots for right actions. Events: favourite-toggle, view-header-back, save, history-open, notifications-open, etc.
- **Deprecate `sherpa-product-bar-v2`** in favour of this. **Retain `sherpa-view-header` for legacy UI recreation only** — `sherpa-app-header` is the new baseline for all new work (migration notes, but view-header is not removed).

### 3c. App Shell (`sherpa-app-shell` evolution)
Recompose the shell to host Nav v2 (left rail) + App Header (top) + main content region, matching the branch's dashboard layouts. Wire the collapse/expand coordination between shell and nav. Provide the `layout-grid`-based content region.

### Deliverables
- `sherpa-nav*` v2 · `sherpa-app-header` · `sherpa-app-shell` recomposition · migration guide from v1 (product-bar/view-header) · MCP schemas · light/dark visual checks against the branch screenshots.

**Definition of done:** app-shell renders Nav v2 + App Header + content matching the Figma dashboard examples in light & dark; collapse works; old components deprecated with migration path.

---

## Phase 4 — Quick Filter Toolbar + Quick Filter Chips

**Goal:** the new filtering surface that lives in the App Header. Depends on Phase 3b (header hosts it) and Phase 2 (chip menus may present tree/option lists).

**Source components (branch):**
- **Quick Filter Toolbar** — `Type = View | Data` (2 variants).
- **Quick Filter** chip — `Type = Default | AI | Populated`, `State = Neutral | Active | Inactive | Thinking | Suggested | Active On | Active Off`.

### Design
- **`sherpa-quick-filter` (chip — NEW)**: a toggle/menu chip.
  - `data-type="default|ai|populated"`, `data-state=…`, `data-active`, `data-label`, `data-count`/value display for populated, menu trigger.
  - **Default**: toggle or opens a menu (options/tree) → `container-overlay`/`sherpa-tree`.
  - **Populated**: shows a selected value + on/off active states.
  - **AI**: `Thinking`/`Suggested` states — ties into the **AI Surface** (Phase 5). An AI-suggested filter the user can accept/dismiss.
  - Events: `quick-filter-change`, `quick-filter-toggle`, `quick-filter-menu-open`, `quick-filter-ai-accept/-dismiss`.
- **`sherpa-quick-filter-toolbar` (NEW — replaces `sherpa-filter-bar`)**: horizontal strip of chips, `data-type="view|data"` (View = saved-view filters; Data = data-scoped filters). Add/overflow handling; consumes the `-> filter-bar (tbd)` tokens. **This supersedes `sherpa-filter-bar` outright** — migrate filter-bar's field-filter editing capabilities into the quick-filter chips' menus (a chip opens into detailed field filtering). Deprecate `sherpa-filter-bar` with a migration guide.

### Deliverables
- `sherpa-quick-filter` · `sherpa-quick-filter-toolbar` · integration into `sherpa-app-header` · **`sherpa-filter-bar` deprecation + migration guide** · MCP schemas · AI-state hooks stubbed for Phase 5.

**Definition of done:** toolbar renders both View/Data types with all chip types/states matching the branch; chips toggle and open menus; AI states render (behaviour wired in Phase 5).

---

## Phase 5 — Superset polish (Node Graph · AI Surface)

**Goal:** mature the two distinctive Sherpa-only subsystems. Sequenced after the shell so the AI surface can integrate with the Quick Filter AI chips and the app chrome.

### 5a. AI Surface
- Harden `sherpa-chat-message`, `sherpa-prompt-composer`, `sherpa-panel` (`ai` variant), `sherpa-proposal-preview`/`sherpa-proposal-op`.
- **Integrate with Quick Filter AI chips** (Phase 4): AI-suggested filters (`Thinking`/`Suggested`) surface through the same AI proposal model.
- Define the proposal/diff data model consistently (add/remove/update/add-edge/remove-edge already exist on `proposal-op`).

### 5b. Node Graph Editor
- Improve `sherpa-node-canvas` / `sherpa-node` / `sherpa-node-row` / `sherpa-node-socket`: edge routing, multi-select, subgraph enter/exit, viewport/minimap, validation states.
- Complete deprecation of `sherpa-node-header` → `sherpa-node-row`.
- Ensure the `sherpa-*` event namespace stays internally consistent (ratified in Phase 0).

**Definition of done:** AI surface + node graph reach an agreed "v2 usable" bar; AI filter suggestions flow end-to-end; deprecated node components removed.

---

## Phase 6 — Data Grid iterative parity (ongoing, parallel)

**Goal:** close the biggest Apex gap incrementally. **Not blocking** — runs alongside all phases.

### Milestone ladder (each shippable independently)
1. Column model + cell customization + no-data/empty states (baseline solid).
2. **Virtual scrolling** (perf-critical for large datasets).
3. **Export** (data export to CSV/etc.).
4. **Filter builder** + advanced filters (can reuse Phase 2 tree + Phase 4 quick-filter patterns).
5. **State storing** (incl. state-to-URL).
6. **Master–detail** rows.
7. Side panel · cell editing · (later) nquery-style datasource abstraction.

**Definition of done (per milestone):** feature matches documented Apex behaviour for that capability, with tests + a11y (keyboard nav is a named Apex doc — match it).

---

## Phase 7 — MCP server + documentation uplift (ongoing, parallel)

**Goal:** make the Sherpa MCP the best way for agents to build with the system, and keep docs in lockstep with the new components.

### Deliverables
1. **Schema accuracy** — feed Phase 0's `@fires`/attribute cleanup into the 23 MCP tools; ensure every new component (tree, app-header, quick-filter*, nav v2) has `query_component`/examples/`get_component_source` coverage.
2. **Pattern system** — advance the `patterns/IMPLEMENTATION-STATUS.md` roadmap (Phase 1–2 done): migrate patterns, add App Shell v2 as a first-class pattern/composition, integrate patterns into MCP (`compose_view`, `generate_flow`, `generate_pattern`).
3. **Docs** — component reference for all net-new components; migration guides (product-bar/view-header → App Header; v1 nav → Nav v2); update the diff report; keep CLAUDE.md's rule tables current.
4. **Validation tooling** — extend `validate_usage` / lint rules to catch the Phase 0 anti-patterns automatically (CSS lint already exists; add checks for chained host selectors, `opacity` disabled, JS visibility toggling). The *structural* HTML-template validation for generative UI is its own workstream — **Phase 8**.

**Definition of done:** every shipped component is queryable + example-backed in MCP; migration guides published; lint catches the ratified anti-patterns.

---

## Phase 8 — Generative UI: schema-validated templates (HTML canonical · JSON mirror)

**Goal:** let AI pipelines generate Sherpa UI safely — validate any HTML template passed to a component against the component schema, keep **HTML as the canonical format end-to-end**, and support an **equivalent JSON representation** for pipelines that prefer it, via a lossless HTML↔JSON bridge.

**Why this fits Sherpa's API cleanly (the key insight):** Sherpa's public API *is* HTML — components are driven by `data-*` attributes + slotted light-DOM children, so a generated HTML string *is* the real invocation (no framework binding layer to cross). The MCP already models every component as a structured schema (JSDoc → JSON: tags, attributes, enum values, slots, `data-accepts`, events), and already ships **one JSON→HTML component-tree renderer** (the v2 flow patterns' `presentation.components` tree). Phase 8 generalises that proven shape; the runtime components need **no new ingestion channel** — JSON always compiles to HTML *before* it reaches a component.

### Design principles
- **HTML is the source of truth.** It degrades gracefully, matches the runtime API 1:1, and needs no new component code. JSON is an *equivalent mirror*, never a parallel truth.
- **JSON never touches a component.** The bridge compiles JSON → HTML string first; components only ever see attributes + slotted DOM. No virtual DOM, no JSON-node runtime.
- **Validation is structural, not just token-level.** Today `validate_usage` is regex-based (no DOM parse, no nesting checks, no line numbers). Generative UI needs a real parse that enforces attribute enums, required attributes, **and slot-nesting allowlists** (from Phase 0's `data-accepts` completeness pass).

### Deliverables
1. **Canonical JSON template schema** — formalise the existing flow-pattern `presentation.components` tree (`{ type, attributes, slots/children }`) into a documented, versioned JSON Schema for a Sherpa component tree. One shape, reused everywhere (flows, compositions, generative output).
2. **Lossless HTML ↔ JSON bridge** (MCP layer, not runtime):
   - `template_to_json(html)` → component-tree JSON (real DOM parse — reuse the `DOMParser` path already in `sherpa-element.ts`).
   - `json_to_template(json)` → HTML string (generalise `generatePatternComponent`).
   - **Round-trip guarantee:** `html → json → html` is semantically identical (attribute order/whitespace-normalised). Property-based round-trip tests.
3. **Schema-validated `validate_template` MCP tool** — upgrade/replace regex `validate_usage` with a DOM-parsing validator that checks, per node: unknown tags, unknown/mis-typed attributes, enum-value violations, required attributes, and **slot `data-accepts` nesting**. Accepts **either** HTML **or** JSON input (JSON is validated against the same schema before compile). Returns structured findings with node paths/line numbers.
4. **Generation guardrail** — `generate_component`/`generate_pattern`/`compose_view` run their output through `validate_template` before returning, so the MCP never emits invalid UI. Add a "repair" mode that reports violations back to the calling agent for correction.
5. **Constrained-generation aids** — expose per-component/per-slot schemas (allowed children, allowed attribute values) so an agent can be *guided* to valid output, not just validated after the fact. This is where the Phase 0 slot-contract pass pays off.
6. **Docs** — "Building generative UI with Sherpa" guide: HTML-first workflow, when/why the JSON mirror exists, the round-trip contract, and the validation surface.

### Definition of done
- Any HTML (or JSON) component template can be validated against the schema with structural nesting enforcement and actionable findings.
- HTML↔JSON round-trips losslessly, with tests.
- MCP generators self-validate and never emit invalid UI.
- HTML remains canonical throughout; JSON is a documented, optional, lossless mirror.

### Dependencies & sequencing
- **Depends on Phase 0.4** (complete, authoritative `data-accepts` slot contracts) — without it, structural validation has nothing to enforce.
- **Trails each component phase** — as tree / app-header / quick-filter* / nav v2 ship, their schemas + slot contracts feed the validator. Practically: build the bridge + validator early (right after Phase 0/1), then keep extending coverage as components land. Runs **parallel** like Phases 6–7.

---

## Dependency graph

```
Phase 00 (cleanup) ──> Phase 0 (conventions ─┬─> 0.4 slot contracts) ──> Phase 2 (tree) ──┬──> Phase 3 (App Shell v2) ──> Phase 4 (Quick Filters) ──> Phase 5 (AI/Node)
                       Phase 1 (tokens) ──────┘                                            └──> Phase 3b nav hierarchy
Phase 6 (Data Grid)  ── parallel, reuses tree(2) + quick-filter(4) patterns
Phase 7 (MCP/docs)   ── parallel, consumes cleanups from every phase
Phase 8 (Generative UI) ── parallel; depends on 0.4 slot contracts; extends coverage as components land
```
*(Phase 00 gates Phase 1's `sherpa-platform.css` work — the codemod retirement and platform-token reconciliation both touch that file.)*

## Suggested sequencing rationale
1. **00 first** — declutter before building; the conformance sweep and every later search runs against a lean tree, and cruft doesn't get copied forward.
2. **0 & 1 next** — cheap to do now, expensive to skip; they define the contract new components follow and get App Shell v2 tokens in place.
3. **2 before 3** — the tree primitive is reused by hierarchical nav and by filter menus, and it closes two gaps (Advanced SelectBox + Treeview) in one build.
4. **3 before 4** — the App Header hosts the Quick Filter Toolbar.
5. **4 before/with 5** — Quick Filter's AI chip states integrate with the AI surface.
6. **6, 7 & 8 continuous** — Data Grid is explicitly non-urgent and iterative; MCP/docs trail each phase; the generative-UI validator (Phase 8) builds early on Phase 0.4's slot contracts and extends coverage as components land, so nothing ships without a validatable schema.

## Resolved (no open questions)
1. **Naming** — all Sherpa-UI elements are `sherpa-*`; event strings standardise on unprefixed `noun-verb` (node-graph events migrate in Phase 5). ✅
2. **filter-bar** — fully **replaced** by `sherpa-quick-filter-toolbar`; filter-bar deprecated. ✅
3. **view-header** — **kept for legacy UI recreation only**; `sherpa-app-header` is the new baseline. ✅
4. **Treeview** — `sherpa-tree` primitive dropped into a container, no wrapper element. ✅
