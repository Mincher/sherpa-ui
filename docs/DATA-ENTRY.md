# Data entry — the one way to populate a component

Sherpa components display three kinds of content, in order of preference:

1. **Attributes** — `data-label`, `data-value`, `data-icon-start`, … for single scalar
   fields. Set them in HTML; CSS and the component react. *Most* components need nothing more.
2. **Slotted light-DOM** — author real child elements for composition (a dialog footer's
   buttons, a tab's panel, a container's body). The component projects them via `<slot>`.
3. **`populate(data)`** — the single canonical method for **collection** components whose
   content is built from data (grid rows, legend items, steps, tags, crumbs, key/value pairs,
   transfer-list options).

If a component only needs (1) or (2), it has no data method — and that's correct. Don't add one.

---

## `populate()` — one method, two kinds, two call forms

`populate()` lives on `SherpaElement`, so **every** component has it. It resolves the *kind* of
the incoming value and dispatches to one override point. There are only **two kinds**:

- **`template`** — a precompiled HTML string, injected as-is.
- **`collection`** — structured data. An **array** is the 1-D case; a **keyed JSON definition**
  (`{ rows, columns }`, `{ steps }`, `{ nodes }`) is the structured case; a **single object**
  is the 1-item case. All three flow through the component's data renderer.

> An array is just a 1-D collection — there is no separate "array" kind. This is why
> **data-grid, tree and metric are not exceptions**: their `{rows, columns}` / `{nodes}`
> payloads are simply the *keyed* shape of a collection, handled by the same method.

### Two call forms

```js
el.populate(data);            // kind is sniffed from the value (the 95% case)
el.populate(kind, data);      // kind is forced — 'template' | 'collection'
```

The sniffer (`detectKind`) is total: an HTML string → `template`; anything else → `collection`.
Use the explicit two-arg form only to override a guess — e.g. force an HTML-looking string to be
treated as data, or disambiguate a hand-built object:

```js
el.populate(items);                       // sniffed → collection
el.populate('<dt>K</dt><dd>V</dd>');      // sniffed → template
el.populate('collection', maybeAmbiguous); // forced
el.populate('template', trustedHtml);      // forced
```

### Free JSON-URL loading

The base class wires `data-src-json` → `populate()` automatically (`onJsonData` default). So:

```html
<sherpa-progress-step-tracker data-src-json="/data/steps.json"></sherpa-progress-step-tracker>
```

fetches the file and hands the parsed value to `populate()`, which sniffs and routes it. **No
component fetches its own JSON.** Because `populate()` and `data-src-json` share one path, a
component's renderer should accept the shape its JSON files use — where the JSON is wrapped
(`{ steps: [...] }`), the renderer accepts both the wrapper and the bare array.

---

## Implementing a collection component

A component does **not** define its own `populate()`. It overrides the dispatch hooks:

```ts
class SherpaThing extends SherpaElement {
  /** Structured data (array | keyed object | single record). The common case. */
  protected override renderData(source: unknown): void {
    const items = Array.isArray(source) ? source : (source as { items?: [] }).items ?? [];
    this.renderInto('.list', '.item-tpl', items);   // bind via the template binder
  }

  /** Optional: precompiled HTML. Defaults to renderData(html) if omitted. */
  protected override renderTemplateSource(html: string): void {
    const target = this.$('.list');
    if (target) target.innerHTML = html;
  }
}
```

- `renderData(data, meta)` — the single hook the dispatcher calls for `collection` data.
  `meta.shape` (`'array' | 'keyed' | 'record'`) tells you which shape arrived, if you branch.
- `renderTemplateSource(html)` — the hook for `template`. Override when the component has a
  dedicated HTML-injection target; otherwise it degrades to `renderData`.

Both hooks default to no-ops on `SherpaElement`, so non-data components inherit safely.

### Collection keys

An object is treated as a **keyed collection** (not a single record) when it owns any of these
properties (see `COLLECTION_KEYS` in `sherpa-template.ts`):

`rows`, `columns`, `nodes`, `edges`, `steps`, `items`, `options`, `sections`, `series`, `data`.

Extend that list when a new keyed payload needs recognising by the sniffer.

---

## Migration status

Every data-bearing component (except the node-graph family) is now on the unified dispatcher —
`populate(json)` fully configures + presents it. So an element JSON node's `data` field reaches
any of them uniformly.

| Component | `data` shape | Notes |
|---|---|---|
| key-value-list, breadcrumbs | array or HTML string | `renderData` + `renderTemplateSource` |
| transfer-list, chart-legend | array | |
| progress-step-tracker | array or `{ steps }` | |
| nav-section | `[{ label, items }]` | |
| tree | node forest array | serialises to `data-nodes` |
| input-select | options array (flat or grouped) | `setOptions` is the impl; `renderData` delegates |
| sparkline | number array | serialises to `data-values` |
| button (menu) | items array / sections / `{ items, options }` | `renderData` → `setMenuItems` |
| donut / line / bar chart | array or content-config object | `renderData` → async `setData` pipeline |
| data-grid | `{ rows, columns, … }` | `renderData` drives the sort/segment/aggregate pipeline |
| metric | `{ name, summary, config }` | cascade pipeline; feeds nested sparkline |
| quick-filter-toolbar | `{ columns, rows? }` wrapper | two-arg setter needs a wrapper object |
| nav | `data-src-html` template | server-rendered HTML, not JSON — stays as-is |

**Removed:** the node-graph family has been deleted and will be rebuilt from scratch; its
populate shape is out of scope until then. See `docs/DEPRECATIONS.md`.

Each component's populate shape is documented in a machine-readable `@data` JSDoc tag, which the
MCP parses into the component schema so generated JSON carries the right `data`.

### Deprecated aliases

Pre-unification setters remain as thin `@deprecated` aliases that call `populate()`; removed in
3.0.0 (see `DEPRECATIONS.md`): `setOptions` (transfer-list), `setItems` (chart-legend),
`setSteps` (progress-step-tracker), `setSections` (nav-section), `setNodes` (tree),
`setValues` (sparkline). Charts, data-grid and metric keep `setData` as the (non-deprecated)
async pipeline impl that `renderData` delegates to.

---

## Template completeness

For `populate(data)` to render correctly, the component's `<template>` prototype must **bind
every field the data carries** — a field present in the data but absent from the template is
silently dropped. When authoring a `*-tpl` prototype:

- Every displayable field has a `data-bind` / `data-bind-html` / `data-bind-attr` marker.
- Optional/conditional branches use `data-bind-if`.
- Repeating sub-lists use `data-bind-each` over an inner `<template>`.
- All elements the row can ever show exist in the template from the start (no `createElement`).

See `components/utilities/sherpa-template/sherpa-template.ts` for the full binding reference.
