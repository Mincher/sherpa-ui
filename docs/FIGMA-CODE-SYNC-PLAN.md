# Figma ↔ Code Sync — Plan

The end goal: **edit on either side (Figma or code) and sync both ways.** Tokens,
CSS, HTML structure/content, and (via descriptions) TS/JS behaviour.

Finish **parity** first, then build the **sync** machinery.

---

## Phase A — Finish parity (components match Figma)

Token parity is **done**: every component var resolves through the projected layers,
laid out in `@layer core → display-mode → theme → layout → structure → style →
elevation → components` (the layer families mirror the Figma collections; component
partials are the final layer). Round-trip proven lossless (908 tokens, 0 diff).

What remains is **design parity** — some components were never checked against their
Figma render (the rebuild workflow only covered the scoped-collection families).

| Group | Status | Action |
|---|---|---|
| button, callout | ✅ verified vs Figma screenshot | done |
| container/control/select/input/header/nav/list/rich families | ⚠️ rebuilt from bindings, not screenshot-checked | screenshot-compare each, fix drift |
| charts (bar/line/donut/gauge), sparkline | ❓ no Figma binding entry (structural) | confirm they match Chart 2D / Donut / Gauge; dataviz skill |
| BACKLOG (app-shell, data-grid, proposal-*, scheduler-gone) | code ahead of Figma | leave; revisit when Figma builds them |
| calendar | ❓ Time Picker/Calendar in Figma | screenshot-check |

**Exit criteria:** each BUILT component screenshot-matches its Figma component
(surface/border/text model, spacing, states). Track in a checklist.

---

## Phase B — Two-way TOKEN sync (extend what exists)

Already have: `figma_export_tokens` (Figma→DTCG→CSS) + `figma_import_tokens`
(DTCG→Figma), round-trip lossless.

Build:
1. **Code→Figma leg for token edits.** When a token value changes in code, update
   `figma.tokens.json` (the DTCG canonical), then `figma_import_tokens` pushes just
   that delta to Figma (diff-aware merge already supported).
2. **A reconcile command.** Proposed, not built: `tokens:pull` (Figma→code,
   re-project) and `tokens:push` (code→Figma). Conflict policy = `ask`.
3. The projected CSS stops saying "edit in Figma only" — it becomes "edit the DTCG
   or Figma; both reconcile."

---

## Phase C — HTML structure/content sync

Map the Figma component ANATOMY ↔ the HTML template + data attributes.

- **Figma → HTML:** `figma_analyze_component_set` gives variant axes, slots
  (`preferredValues`), text/instance props. Project these into the component's
  `.html` template (slots, nodes) + the `data-*` API (variant axes → data-* enums).
- **HTML → Figma:** parse the component's `.html` (slots, structure) + `data-*`
  contract, and reconcile against the Figma component (add missing slots/props).
- Content differences = data attributes; structure = template nodes/slots. Two-way
  via a structure IR (like the composition-map schema already drafted).

---

## Phase D — TS/JS behaviour → Figma DESCRIPTIONS

Figma prototype interactions get in designers' way. Instead, sync the JS contract
to the **component-set + variant DESCRIPTIONS** (MCP-readable/writable).

- **Code → Figma:** parse the component's TS (`@fires` events, public methods,
  data-* API) into a structured Markdown block, write it to the Figma component's
  `description` via `figma_set_description`.
- **Figma → code:** read the description block back; it's the behaviour spec that
  informs/validates the TS (and docs, prototyping notes).
- The description becomes the shared behaviour contract — one structured block per
  component set, plus per-variant notes.

---

## Machinery (shared)

- **Canonical IR:** DTCG for tokens (have it); a composition-map / component schema
  for structure (drafted in `schema/`); a description block for behaviour.
- **Commands:** `tokens:pull/push`, `structure:pull/push`, `behaviour:push`.
- **Conflict policy:** `ask` by default; `figma-wins` / `code-wins` per run.
- **Guardrail:** every sync is dry-run-previewable before it writes.
