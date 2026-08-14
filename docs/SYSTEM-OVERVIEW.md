# Sherpa-UI System Overview

> The Figma ⇄ code pipeline and the design-system ontology, end to end. Read this
> first; it links out to the detailed docs.

Sherpa-UI is a zero-dependency Web Component library whose design system lives in a
Figma file (`UnBEepLWb6d7b9ykm33j2s`). The goal: **one source of truth per concern,
synced both ways, with a queryable understanding layer over the whole thing.**

---

## 1. The four legs of the pipeline

Each leg has a script and is proven on real components.

| Leg | Script | What it does | Status |
|---|---|---|---|
| **code → def** | `scripts/generate-defs.mjs` | reads a component's 3 files (TS/HTML/CSS) → `<name>.def.json` (props, templates, slots, parts, events, tokens, nesting) | ✅ 51 defs |
| **Figma → def** | `scripts/merge-figma.mjs` | reads the Figma component via the bridge → injects the real `figma` block (variant axes, bool/text/instance props, mode pins) | ✅ 45 matched |
| **def → code** | `scripts/compile-def.mjs` | reconstructs TS/HTML/CSS from a def (needs `anatomy`) — a **scaffolder**, not a byte-replicator | ✅ proven (tag) |
| **def → Figma** | `figma_execute` (build-figma skill) | builds the Figma component from a def — nodes, variants, scope-checked variable bindings | ✅ proven (tag + fictitious) |

The **def** (`src/components/<name>/<name>.def.json`) is the shared IR that drives
both sides. See **[COMPONENT-DEFINITION-STANDARD.md](./COMPONENT-DEFINITION-STANDARD.md)**
for its shape and the naming rules every def follows.

### Names differ between code and Figma

`sherpa-list-item` ↔ **Menu List Item**, `sherpa-calendar` ↔ **Grid**,
`sherpa-barchart` ↔ **Data Field**. The authoritative map is
`scripts/figma-data/name-map.json` (`status`: matched / no-figma / figma-only).

---

## 2. Variable scopes — the fill/border bug and its fix

**The bug:** 846/908 Figma vars were unscoped (`ALL_SCOPES`), so a **border** variable
could be picked for a **surface fill**. Fixed by setting `variable.scopes` so the
picker only offers correctly-typed vars.

**The rule module:** `scripts/lib/scope-rules.mjs` — the single source of scope truth.
It encodes 8 corrections made against the live file after human review, and reproduces
the live scopes with **0 diffs**. The deep rule:

> **Scope follows USAGE, not the name's segments.**

Key corrections (full list in the module header): `*-border/*` is always a stroke even
when the name has a fill word (`control-border/accent`); `content/*` semantic ramp is
text-only but component `*-content/*` inks icons too; `status/color N` palette steps
stay open (the *consumer* carries the scope); Core::color + Primitives are fully
permissive (reference ramps).

**The guardrail:** `scripts/lib/token-resolver.mjs` — `resolveChecked(var, property)`
refuses a bind whose Figma property doesn't match the var's scope. Binding a
`[STROKE_COLOR]` var as a fill throws. So the bug **cannot recur through the pipeline**.

Snapshot of live scopes: `scripts/figma-data/scope-snapshot.json`.

---

## 3. The design-system ontology — the understanding layer

A queryable description of what every variable, collection, mode, and extension is
**for** — not just its name. "An MCP for understanding the design system, not tools."

**The engine:** purpose derives from the **usage graph** (what consumes a var), not the
opaque name. `status/info/color 1` means nothing by name; but it's consumed by
`status-surface/default`, so it **is** the info surface fill.

**Where it lives (both, synced):**

| Home | Form | File / surface |
|---|---|---|
| Repo | full | `docs/ontology/tokens.json` (548 vars) + `docs/ontology/structure.json` (collections, extensions, modes) |
| Figma | short | collection descriptions (28) + variable descriptions (548), written live |
| MCP | queryable | `explain_token`, `browse_ontology`, `sherpa://ontology/{id}` |

**Query it (MCP):** `explain_token("heading")` → resolves the synonym to `content/title`,
gives purpose + when-to-use + when-NOT + aliasedFrom + consumedBy + seeAlso. The
**synonym bridge** (`heading`→`title`, `bg`→`surface`, `stroke`→`border`) means a wrong
word still lands on the right token.

**Build/regenerate:** `scripts/build-ontology.mjs` (reads `variable-graph.json` +
`scope-rules.mjs` → `tokens.json`). Source graph: `scripts/figma-data/variable-graph.json`.

**Note:** Figma modes have no description field — mode purposes live in
`structure.json → modes` and are summarised on each collection description.

Design + shape: **[DESIGN-SYSTEM-ONTOLOGY.md](./DESIGN-SYSTEM-ONTOLOGY.md)**.

---

## 4. The variable architecture (tiers)

```
Primitives (raw, FOUNDATION)  →  Core (named ramps)  →  Style (Sherpa) (semantic, light/dark)
   →  component collections (Control, Status, Container, Button, Switch, Input,
      Navigation, Badge)  +  override collections (Elevation, Color Sets, Snapping,
      Layout Grid, Data Viz, Typography)  +  extensions (Saturated, Border Only,
      brand/mono/hero, density, Calendar Day/Month/Year)
```

**Prefer the lowest semantic/component tier.** But **Primitives are a bindable
foundation layer** on both sides — bind them directly where no semantic token fits
(e.g. a 3px radius the Core scale skips: `border/radius/150`). The ontology covers
all 908 vars including Primitives (`tier: foundation`); an audit found 182 such
foundation binds, all legitimate. Details: `docs/FIGMA-VARIABLE-GRAPH.md`,
`docs/FIGMA-CSS-PROPERTY-MAP.md`.

---

## 5. Where to go next

The two-way SYNC machinery (edit either side, reconcile) is planned but not built:
**[FIGMA-CODE-SYNC-PLAN.md](./FIGMA-CODE-SYNC-PLAN.md)** (Phases B–D). The four legs and
the ontology are the foundation it builds on.

## 6. File map

| Concern | Files |
|---|---|
| Component defs | `src/components/*/*.def.json` |
| Pipeline scripts | `scripts/{generate-defs, merge-figma, compile-def, build-ontology}.mjs` |
| Shared libs | `scripts/lib/{scope-rules, token-resolver}.mjs` |
| Figma source data | `scripts/figma-data/{name-map, figma-read, variable-graph, scope-snapshot}.json` |
| Ontology | `docs/ontology/{tokens, structure}.json` |
| MCP ontology | `mcp-server/tools/ontology.js`, `sherpa://ontology/{id}` |
| Standards | `docs/{COMPONENT-DEFINITION-STANDARD, DESIGN-SYSTEM-ONTOLOGY, FIGMA-CODE-SYNC-PLAN}.md` |
