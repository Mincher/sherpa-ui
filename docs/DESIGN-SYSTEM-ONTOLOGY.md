# Design-System Ontology

> A queryable description layer for the **whole** design system — every variable,
> group, mode, collection, component, property, and event, with its **purpose**,
> not just its name. "An MCP for understanding the design system, not tools."
>
> Names like `content/heading`, `status/info/color 1` are descriptive but thin —
> they don't say *when* to use one over another, or what a step in a ramp is *for*.
> The ontology carries that meaning so translation (Figma ↔ code) is **correct**,
> not guessed.

---

## 1. The core insight — purpose comes from the alias graph, not the name

`status/info/color 1` is an opaque name. But trace what **consumes** it:

```
Style::status/info/color 1  ←aliased by←  Status::status-surface/default
Style::status/info/color 5  ←aliased by←  Status::status-border/default
```

So `color 1` **is** the status surface fill; `color 5` **is** the status border.
The consumer's role reveals the ramp step's purpose — mechanically, from the
variable graph. This is the ontology's engine: **derive purpose from consumption**,
then let a human enrich the prose.

This same trace produced the correct Figma **scopes** (color 1 → `FRAME_FILL`,
color 5 → `STROKE_COLOR`) — proving the ontology and the scope-fix are the same
knowledge.

---

## 2. Source of truth — both, synced

- **Repo (full form):** `docs/ontology/*.json` — the rich, version-controlled
  ontology. More than Figma's description field can hold.
- **Figma (short form):** each variable/collection/mode carries a one-line
  `description` (the purpose sentence + scope). Pushed from the repo.
- They **reconcile** like tokens: `ontology:pull` (Figma → repo) /
  `ontology:push` (repo → Figma). Repo wins on the full form; Figma holds the
  human-facing short form.

---

## 3. The entry shape (per variable)

```json
{
  "id": "Style (Sherpa)::status/info/color 1",
  "kind": "variable",
  "tier": "style",
  "resolvedType": "COLOR",
  "purpose": "The surface fill behind an info-status component (callout, tag, message).",
  "whenToUse": "As the background of a status-tinted container or control.",
  "whenNOT": "Never for a border (use color 5 / status-border) or text (use status-content).",
  "role": "surface",
  "scope": ["FRAME_FILL", "SHAPE_FILL"],
  "aliasedFrom": "Core::color/info/100",
  "consumedBy": ["Status::status-surface/default"],
  "modes": { "light": "info/100", "dark": "info/1100" },
  "seeAlso": ["Style::status/info/color 5", "Status::status-surface/default"]
}
```

Field purposes:

| Field | What it answers |
|---|---|
| `purpose` | one sentence: what this IS |
| `whenToUse` / `whenNOT` | the translation guardrails (the thin-name problem) |
| `role` | `surface` / `border` / `content` / `space` / `radius` / `size` / `effect` |
| `scope` | the Figma scope (also enforced on the variable) |
| `aliasedFrom` | the tier below it resolves to |
| `consumedBy` | who aliases it (the purpose evidence) |
| `modes` | per-mode values (light/dark, status, size) |
| `seeAlso` | the sibling you probably meant instead |

Groups, modes, collections, components, properties, events get analogous entries
(a `kind` discriminator) in later passes — tokens first.

---

## 4. How it's built (mostly mechanical)

1. **Read the variable graph** from Figma (name, type, scope, valuesByMode, aliases).
2. **Derive `role` + `scope`** from name + consumer (§1). Already done for scopes.
3. **Derive `consumedBy` / `aliasedFrom`** from the alias graph.
4. **Generate `purpose` / `whenToUse` / `whenNOT`** from `role` + `tier` +
   consumer (templated, then human-refined for the ambiguous 158).
5. **Write** the repo ontology; **push** the short form to Figma descriptions.

The ambiguous cases (`color N` ramps, `app/primary`) are exactly where the
mechanical derivation is thinnest — those get human prose, everything else is
generated.

---

## 5. Served via MCP

A `sherpa://ontology/{id}` resource + an `explain(variable|token|component)` tool:
ask "what is `content/heading` for, and when not?" → get `purpose` + `whenNOT` +
`seeAlso`. This is the "understanding" layer alongside the existing tool MCP.
