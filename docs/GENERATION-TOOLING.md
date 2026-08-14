# Generation Tooling — the def-driven AI workflow

> How an AI generates a Sherpa component. The **def** (`<name>.def.json`) is the
> hub; tools compile it both ways (code ⇄ Figma) and validate it against the
> design-system rules we've encoded. One coherent surface.

---

## The workflow

```
        ┌─────────────────────────────────────────────┐
        │              <name>.def.json                 │  ← the hub
        └─────────────────────────────────────────────┘
   write/edit ▲          │ validate          │ compile
              │          ▼                   ▼
         AI author   design-system rules   code  +  Figma
                     (ontology, scopes,
                      bindings, reuse)
```

1. **Author** a def (AI writes JSON, or `generate-defs` reads existing code).
2. **Validate** it — `validate_def` checks every rule: right tokens (ontology
   roles), scopes respected, no raw values where a token exists, existing
   components reused, events/nesting well-formed.
3. **Compile** — `compile_def` → TS/HTML/CSS; the build-figma skill → Figma.
4. **Audit** — `audit_component` re-checks the built result against the ontology
   + binding rules.

Everything an AI needs to get it right is a tool call away — no guessing.

---

## The shared library (`scripts/lib/generation/`)

Pure, dependency-light modules. The MCP tools and the skills BOTH import these —
one implementation, two surfaces.

| Module | Exports | Purpose |
|---|---|---|
| `validate-def.mjs` | `validateDef(def, {ontology, nameMap})` → `{ok, errors[], warnings[]}` | check a def against every rule |
| `compile-def.mjs` | `compileDef(def)` → `{ts, html, css}` | def → code (moved from scripts/) |
| `audit.mjs` | `auditBindings`, `auditOntology` | the binding + ontology audits |
| `resolve.mjs` | `tokenForValue`, `roleForToken`, `scopeAllows` | the resolution primitives |
| `data.mjs` | `loadOntology`, `loadNameMap`, `loadGraph` | cached loaders |

Rules the validator enforces (from `docs/DEF-TO-FIGMA-BUILD-RULES.md`):
1. reuse existing component (name-map / component list)
2. text binds Typography vars + a content colour
3. status containers bind container-* (alias through status), controls bind status-*
4. control labels bind control-content (not status-content) — the button bug
5. icon-swap verified
6. buttons bind Button size vars
7. mode pins don't cascade to instances
8. every geometry property binds a variable if a token resolves to its value
9. scopes respected (a fill token can't be a stroke)

---

## The MCP tools (clean surface)

Grouped by verb. Each is thin — it calls the shared lib.

**Discover** (understand the system)
- `list_components` — every component + its def summary
- `explain_token(token)` — purpose/role/whenNOT/caveat (ontology)
- `browse_ontology(role?, tier?)` — tokens by role/tier
- `get_component(name)` — the full def + code + Figma binding shape

**Generate** (make a component)
- `scaffold_def(name, {category, ...})` — a starter def with the right shape
- `validate_def(def)` — run every rule; returns errors + fixes
- `compile_def(def)` — → {ts, html, css}
- `token_for(property, value)` — which token to bind for a value (the meticulous rule)

**Verify** (check the result)
- `audit_component(name)` — bindings + ontology accuracy for a built component
- `check_bindings(name)` — the "every property uses a variable" audit

**Resources**: `sherpa://def/{name}`, `sherpa://ontology/{id}`,
`sherpa://component/{name}/{ts|html|css}`, `sherpa://rules` (the build rules).

---

## The skill

`generate-sherpa-component` — orchestrates the workflow: given a component idea,
scaffold → author the def → validate (loop until clean) → compile → (optionally)
build in Figma via `build-figma-component` → audit. It cites the MCP tools at each
step, so an AI follows a paved path instead of improvising.
