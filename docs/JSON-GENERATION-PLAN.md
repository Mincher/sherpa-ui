# Plan — every component configurable + populated from JSON

**Goal:** deliver a JSON element definition to `populate()` from any source (human, code, AI
agent, MCP) and have the component's properties **and** data configured + presented correctly.
The MCP returns **JSON only** (no HTML generation, no round-trip equivalence).

**Scope reality (from the 74-component survey):** most components are already JSON-ready. The
real work is ~13 components + the MCP JSON surface.

| Bucket | Count | State | Work |
|---|---|---|---|
| A — attribute-only | 30 | JSON-ready via `props` | none |
| B — slot/composition | 26 | JSON-ready via `slots`/`children` | none |
| C — `renderData()` migrated | 5 | JSON-ready via `data` | none (exemplars) |
| **D — legacy setter only** | **8** | needs `renderData()` | **mechanical wrap + alias** |
| **E — special** | **5** | needs a design decision | **case-by-case** |

`renderElement(node)` already renders A/B/C correctly (162 tests green). So "generate any
component from JSON" is blocked only by D, E, and the MCP not emitting JSON yet.

---

## The `@data` JSDoc tag (enabler for the MCP)

To let the MCP emit an accurate `data` payload, add a machine-readable tag parallel to `@attr`,
parsed by `mcp-server/lib/schema-parser.js`:

```
@data {array}  [{ key, value, type?, status?, html? }]   — Pairs to render
@data {object} { rows: [...], columns: [...] }            — Grid pipeline config
```

`{array}` / `{object}` / `{string}` = the populate kind; the text = the shape. Attribute-only
components have no `@data`. The MCP exposes this in `query_component` and uses it to shape
generated JSON. This is the single new authoring convention; everything else is code.

---

## Batch 1 — MCP JSON generation (the actual unlock)

Without this, nothing downstream is usable by an agent.

1. **`generateComponentJSON(schema, attrs, slots, data)`** in `mcp-server/lib/generators.js` —
   emits an `ElementNode`: `{ type, props, data?, slots?, children? }`. Only known attrs; boolean
   attrs as `true`; icon names left as icon tokens (JSON carries raw values, not entities).
2. **`schema-parser.js`**: parse `@data` into `schema.data = { kind, shape }`.
3. **`generate_component` tool** (`mcp-server/tools/component.js`): return JSON (drop HTML output).
   Update the tool description so agents know it returns an `ElementNode` for `renderElement()` /
   `populate()`.
4. **Verify:** MCP unit check — generate JSON for button/container/key-value/data-grid, assert it
   validates against `schema/element-node.schema.json`.

**Risk:** low — additive to the MCP; no component code touched.

---

## Batch 2 — Bucket D migrations (8, mechanical)

Copy the migrated-exemplar pattern (chart-legend/step-tracker): move the setter body into
`protected override renderData(source)`, keep the old name as a `@deprecated` thin alias, add
`@data`. Clean up dead code in each while there.

| # | component | shape | notes |
|---|---|---|---|
| 2.1 | sherpa-nav-section | array `[{label, items}]` | `setSections` → alias |
| 2.2 | sherpa-tree | array (node forest) | `setNodes` → alias; keep `data-nodes` serialisation |
| 2.3 | sherpa-input-select | array `[{value,label,…}]` | `setOptions` → alias; `setNodes` (hierarchical) stays a secondary method |
| 2.4 | sherpa-sparkline | number array | `setValues` → alias; `data-values` attr still works |
| 2.5 | sherpa-button (menu) | array or grouped `[{heading,items}]` | `setMenuItems(items, opts)` → `renderData` handles items; `opts` stays 2nd arg on the alias |
| 2.6 | sherpa-donut-chart | array `[{label,value,color?}]` or cascade | `setData` → alias; branch on `_fromCascade` inside `renderData` |
| 2.7 | sherpa-line-chart | keyed `{labels, series}` or cascade | `setData` → alias |
| 2.8 | sherpa-barchart | keyed content config | `setData` → alias |

**Verify each:** an E2E test that builds the component via `renderElement({type, data})` and
asserts the rendered output — same harness as `render-element.spec.ts`.

**Risk:** low-medium. Charts (2.6–2.8) have a cascade branch; `renderData` must preserve it, not
bypass it. Each is independently testable.

---

## Batch 3 — Bucket E (5, design-led)

These do **not** get a mechanical wrap. Proposed handling per component:

| component | proposal |
|---|---|
| **sherpa-data-grid** | `renderData({rows, columns, …})` routes into the existing `setData` **pipeline** (sort/segment/aggregate) — not a plain bind. `setData` stays as the pipeline impl; `renderData` is the public front door. Verify sorting/segmenting still fire. |
| **sherpa-metric** | `renderData({name, summary, config})` → existing cascade path; the nested sparkline keeps getting `setValues` internally. Two-stage populate preserved. |
| **sherpa-quick-filter-toolbar** | `setAvailableColumns(columns, rows)` is two-arg. Define a JSON convention: `data: { columns: [...], rows: [...] }`, and `renderData` destructures it. Documents the wrapper. |
| **sherpa-node-canvas** | Imperative graph (`addNode`/`addEdge`), no single collection. Define `data: { nodes: [...], edges: [...] }` → `renderData` replays it through the imperative API. Larger; node-graph also carries the legacy `sherpa-*` event prefix (out of scope here). |
| **sherpa-node** | Data-driven via `data-bind` template + attrs; `populate(record)` binds one record to its field template. `renderData` = bind a single record. |

**Recommendation:** do data-grid + metric + quick-filter-toolbar in this batch (they're the
common data surfaces); **defer node-canvas + node** to the node-graph hardening phase (they're a
different paradigm and higher-risk). Flag that split for your call.

**Risk:** medium. Pipeline/cascade preservation is the thing to verify, per component.

---

## Batch 4 — Docs + close-out

1. Update `docs/DATA-ENTRY.md` migration table (D/E now on `renderData`).
2. `docs/VIEW-DEFINITION.md` + `element-node.schema.json` already current; add `@data`-derived
   `data` shapes to the per-component MCP schema output.
3. Full suite + lint + suppression check green.
4. Update `DEPRECATIONS.md` with the new setter aliases.

---

## Sequencing & sign-off points

- **Batch 1 first** — it's the unlock and is component-agnostic. After it, an agent can already
  generate JSON for the 56 A/B components + the 5 C components (61/74) correctly.
- **Batch 2** brings 8 more to 69/74, all mechanical.
- **Batch 3** covers the hard data surfaces; **node-canvas/node deferred** unless you want them in.
- Each batch is independently shippable with its own green tests.

**Open decisions for you:**
1. **Node-graph (node-canvas + node) — in this effort or deferred** to node-graph hardening?
   (Recommend defer.)
2. **`@data` tag** — accept this as the new authoring convention? (It's the only new convention.)
3. Batch order — as above, or MCP last (do component migrations first)? (Recommend MCP first so
   the JSON surface exists to test migrations against.)
