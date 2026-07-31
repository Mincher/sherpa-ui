# View definition — declarative JSON for a whole view

A **view definition** describes an entire view as data: a flat registry of elements, a layout
tree expressed by id references, the App Shell regions each element fills, and state-mediated
wiring between elements. It is the composition layer *on top of* the `populate()` data contract
(see `DATA-ENTRY.md`) — it says **what elements exist, how they nest, where their data comes
from, and how they affect each other**, and reuses `populate()` unchanged for the data itself.

Schema: [`schema/view-definition.schema.json`](../schema/view-definition.schema.json) (JSON Schema draft-07).

## Design principles

- **Identity is separate from layout.** Elements live in a flat `elements` map keyed by id; an
  element is *placed* by being referenced from a parent (`children` / `slots`) or a shell region.
  Re-ordering or re-parenting is editing a list of ids — never moving a subtree.
- **Raw tags, raw attrs — no registry, no translation.** `type` is the literal custom-element
  tag (`sherpa-metric`); `props` are literal attribute names (`data-status`, `disabled`).
- **The shell frame is implicit.** The App Shell always has `nav`, `app-header`, and body
  regions; that structure never varies, so you never redeclare `sherpa-app-shell`. A top-level
  `shell` map assigns element ids to those regions. Nav and header are then normal `elements` —
  first-class, `$state`-bindable, and wireable like anything else.
- **State is separate from structure.** A `state` blob holds values; elements bind to it with
  `{ "$state": "/pointer" }`. Cross-element effects flow **through** state (see wiring below) —
  no direct element-to-element references.
- **Theme is app-level, not in the view.** Theme / mode / density are owned by `ThemeManager`.

## Top-level shape

```jsonc
{
  "view": "component-sandbox",     // optional human label
  "root": "body",                  // element filling the shell body region
  "shell": { "nav": "mainNav", "header": "appHeader" },  // fill the fixed shell regions
  "state": { /* value blob, addressed by $state pointers */ },
  "elements": {
    "<id>": { "type": "sherpa-*", "props": {…}, "data": …, "slots": {…}, "children": [ … ], "writes": [ … ] }
  }
}
```

### `shell` — filling the implicit frame

`shell` is a small "region → element id" map. The shell is a given; you only say which element
fills each region:

```jsonc
"shell": {
  "nav": "mainNav",        // → sherpa-app-shell slot="nav"
  "header": "appHeader",   // → slot="app-header"
  "body": "layout"         // → default slot (defaults to `root` if omitted)
}
```

No `sherpa-app-shell` is declared anywhere — it's the frame the view lives in. `mainNav` /
`appHeader` are ordinary entries in `elements`.

### The element

| Field | Meaning |
|---|---|
| `type` | Literal custom-element tag, e.g. `"sherpa-container"`. |
| `props` | Literal attributes. `string`/`number` → `setAttribute(String(v))`; `true` → boolean (empty) attr; `false`/`null` → omitted. A `{ "$state": "/p" }` value binds the attribute to state. |
| `data` | The element's `populate()` payload (array / keyed object / HTML string / `{ $state }` / `{ src }`). Resolved, then `el.populate(...)`. |
| `slots` | Named-slot fills: `{ slotName → id \| [ids] }`. Regions this element exposes for the parent to fill. |
| `children` | Ids placed in this element's **default** slot only. |
| `writes` | State-mediated wiring: on an event, write into `state` (see below). |

### `slots` vs `children` — they are different things

- **`children`** are elements this element *renders in its default slot* — its own body content.
- **`slots`** fill *named regions the element exposes* (`header`, `footer`, `filters`). A slot is
  "space for a dynamic child element," not a child. Slot assignment lives on the parent that
  owns the slot — in exactly one place.

```jsonc
"tileGrid": {
  "type": "sherpa-container",
  "slots":    { "header": "gridHeader" },  // fills <slot name="header">
  "children": ["grid"]                     // default-slot body content
}
```

### `data` — this *is* `populate()`

`data` is not a new mechanism. Whatever it resolves to is handed to `el.populate()`, which sniffs
the kind (see `DATA-ENTRY.md`):

```jsonc
"data": [ { "key": "Env", "value": "Prod" } ]   // 1-D collection (array)
"data": { "steps": [ … ] }                       // keyed collection
"data": "<dt>K</dt><dd>V</dd>"                    // template (HTML string)
"data": { "$state": "/gridData" }                // bound to state → populate(resolved)
"data": { "src": "/data/data-grid.json" }        // fetch, then populate (≡ data-src-json)
```

### Cross-element wiring — state-mediated

Elements affect each other **only through state**. An element `writes` a value into the `state`
blob on an event; any element whose `data`/`props` are bound to that pointer re-populate. There
are no direct element-to-element references.

```jsonc
"viewFilters": {
  "type": "sherpa-quick-filter-toolbar",
  "writes": [ { "on": "quick-filter-change", "to": "/filter", "value": "$detail" } ]
},
"grid": {
  "type": "sherpa-data-grid",
  "data": { "$state": "/filter" }   // re-populates when /filter changes
}
```

A `writes` rule is `{ on, to, value? }`: listen for `on`, write into `state` at pointer `to`.
`value` reads from the event — `"$detail"` writes the whole `event.detail`; `"$detail.route"`
writes one field; omit it to write the whole detail. The nav's `navitemclick` → scroll is the
same shape (`{ "on": "navitemclick", "to": "/activeRoute", "value": "$detail.route" }`), with a
view-level consumer reacting to `/activeRoute`.

This is why nav/header must live *inside* the definition: their events are the sources of these
state writes, and the definition is where the wiring is expressed.

## Worked example — the sandbox view, shell + wiring included

Real tags and attributes only.

```json
{
  "view": "component-sandbox",
  "root": "layout",
  "shell": { "nav": "mainNav", "header": "appHeader", "body": "layout" },
  "state": {
    "filter": null,
    "gridData": {
      "columns": [
        { "field": "name", "name": "Name", "type": "string" },
        { "field": "status", "name": "Status", "type": "string" }
      ],
      "rows": [
        { "name": "Alice Martin", "status": "Active" },
        { "name": "Bob Chen", "status": "Pending" }
      ]
    }
  },
  "elements": {
    "mainNav": {
      "type": "sherpa-nav",
      "props": { "data-src-html": "/sticker-sheet/nav.html", "data-active-target": "dashboard" },
      "writes": [ { "on": "navitemclick", "to": "/activeRoute", "value": "$detail.route" } ]
    },

    "appHeader": {
      "type": "sherpa-app-header",
      "props": { "data-label": "Component Sandbox", "data-show-favorite": true },
      "slots": { "filters": "viewFilters" }
    },
    "viewFilters": {
      "type": "sherpa-quick-filter-toolbar",
      "props": { "data-type": "view" },
      "data": { "$state": "/filterColumns" },
      "writes": [ { "on": "quick-filter-change", "to": "/filter", "value": "$detail" } ]
    },

    "layout": {
      "type": "sherpa-layout-grid",
      "props": { "data-pad": true, "data-row-height": "64px" },
      "slots": { "view-header": "viewHeader", "banner": "banner" },
      "children": ["tileKv", "tileGrid"]
    },
    "viewHeader": { "type": "sherpa-view-header", "props": { "data-label": "All components", "data-description": "A live gallery." } },
    "banner": { "type": "sherpa-message", "props": { "data-status": "info", "data-label": "Themeable sandbox", "data-value": "Every tile re-themes live." } },

    "tileKv": {
      "type": "sherpa-container",
      "props": { "data-col-span": 6, "data-row-span": 3 },
      "slots": { "header": "tileKvHeader" },
      "children": ["kv"]
    },
    "tileKvHeader": { "type": "sherpa-container-header", "props": { "data-title": "Key / value" } },
    "kv": {
      "type": "sherpa-key-value-list",
      "data": [
        { "key": "Environment", "value": "Production" },
        { "key": "Status", "value": "<sherpa-tag data-color=\"green\" data-label=\"Healthy\"></sherpa-tag>", "html": true }
      ]
    },

    "tileGrid": {
      "type": "sherpa-container",
      "props": { "data-col-span": 12, "data-row-span": 5 },
      "slots": { "header": "tileGridHeader" },
      "children": ["grid"]
    },
    "tileGridHeader": { "type": "sherpa-container-header", "props": { "data-title": "Data grid" } },
    "grid": {
      "type": "sherpa-data-grid",
      "props": { "data-selectable": true },
      "data": { "$state": "/gridData" }
    }
  }
}
```

What this shows:

- **Nav and header are in `elements`** and assigned to shell regions via `shell` — no
  `sherpa-app-shell` redeclaration.
- **`viewFilters` → `grid` is wired through state.** The filter writes `/filter`; a data source
  keyed on `/filter` (or the grid's own `$state`) re-populates. No element references another.
- **`slots` vs `children` are clean.** Every named-slot fill (`view-header`, `banner`, `header`,
  `filters`) is in a `slots` map on its owner; `children` is default-slot content only.

## Reference renderer (illustrative — not yet shipped)

~50 lines, reusing `populate()` verbatim. The shell is created once; `shell` region ids are
slotted into it; `writes` become event listeners that patch state; `$state` consumers re-populate
on change.

```js
function renderView(def, mount) {
  const state = structuredClone(def.state ?? {});
  const bound = [];  // { el, apply } for each $state consumer, replayed on change

  const resolve = (v) =>
    v && typeof v === 'object' && '$state' in v ? pointer(state, v.$state) : v;

  function build(id) {
    const spec = def.elements[id];
    const el = document.createElement(spec.type);

    for (const [k, v] of Object.entries(spec.props ?? {})) {
      const val = resolve(v);
      if (val === true) el.setAttribute(k, '');
      else if (val !== false && val != null) el.setAttribute(k, String(val));
    }
    for (const cid of spec.children ?? []) el.appendChild(build(cid));
    for (const [slot, ref] of Object.entries(spec.slots ?? {}))
      for (const rid of [].concat(ref)) { const c = build(rid); c.slot = slot; el.appendChild(c); }

    if (spec.data !== undefined) {
      const apply = () => {
        const d = spec.data;
        if (d && d.src) fetch(d.src).then(r => r.json()).then(x => el.populate(x));
        else el.populate(resolve(d));                 // ← the unified dispatcher
      };
      Promise.resolve(el.rendered).then(apply);
      if (spec.data.$state) bound.push({ ptr: spec.data.$state, apply });
    }

    for (const w of spec.writes ?? [])
      el.addEventListener(w.on, (e) => {
        setPointer(state, w.to, readDetail(e, w.value));   // patch state
        bound.filter(b => b.ptr === w.to).forEach(b => b.apply());  // re-populate consumers
      });

    return el;
  }

  const shell = document.createElement('sherpa-app-shell');
  const R = def.shell ?? {};
  if (R.nav)    { const n = build(R.nav);    n.slot = 'nav';        shell.appendChild(n); }
  if (R.header) { const h = build(R.header); h.slot = 'app-header'; shell.appendChild(h); }
  shell.appendChild(build(R.body ?? def.root));   // default slot
  mount.replaceChildren(shell);
}
```

`pointer` / `setPointer` are standard JSON-Pointer get/set; `readDetail(e, "$detail.route")`
reads from `event.detail`.

## Status

Spec + schema only. No renderer is shipped — `renderView()` above is illustrative. The element
`data` contract is live today via `populate()`; the view layer (shell region-fill, slots, and
state-mediated wiring) is the next build step, pending sign-off on this shape.
