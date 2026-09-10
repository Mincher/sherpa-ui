# Handover — the Figma side

How the Figma file is organised, how to read it reliably, and what is currently
wrong with it.

See [HANDOVER.md](HANDOVER.md) for code traps.
Deeper reference already exists in [DESIGN-SYSTEM-FIGMA-REFERENCE.md](DESIGN-SYSTEM-FIGMA-REFERENCE.md),
[VARIATION-SYSTEM.md](VARIATION-SYSTEM.md) and [VARIABLE-TOKEN-MAP.md](VARIABLE-TOKEN-MAP.md).

---

## 1. Access

File key `UnBEepLWb6d7b9ykm33j2s` ("Sherpa-UI"), reached through the
**figma-console** MCP via `figma_execute` (Plugin API JS, async).

Every call must start with `await figma.loadAllPagesAsync()` — dynamic page access
is on and nodes are otherwise unreachable.

Two API notes that waste time if forgotten:

- `node.mainComponent` **throws** under dynamic-page access. Use
  `await node.getMainComponentAsync()`.
- Scripts are **atomic**: a thrown error changes nothing. Fix and retry rather
  than blind-retrying.

---

## 2. READING values reliably — this is the important part

**Never infer a token mapping from a name.** Read `boundVariables`.

### The extension-override problem

An extension collection's overrides **write fine and read back EMPTY** through
`valuesByMode`, and NULL through `resolveForConsumer` on a bare variable. So
`figma.tokens.json` / `figma.extensions.json` go stale *silently*.

The reliable read is the **bound-probe**: make (or find) a node bound to the
variable, pin it to the extension × mode you care about, then read what it
actually paints.

```js
// What does this variable ACTUALLY resolve to for this consumer?
const res = someVar.resolveForConsumer(nodeBoundToIt);
```

This is how the group-cell's `style-surface/dark` was resolved: the variable is
not in the projected set, but the node paints `#e8e8f6`, which is exactly
`style-surface/base +1`. **Probe the paint, not the name.**

### Diffing a token sync

Dump the base collections, then diff in Python **ignoring hex case** — on the last
sync 139 of 147 "differences" were case only. Probe extensions separately.

---

## 3. The variation model

Three mechanisms, and they are not interchangeable:

| Mechanism | Use for | Notes |
|---|---|---|
| **Modes** | Mutually exclusive states of one axis | Status (8 modes on Style), Display light/dark, Control active/inactive |
| **Extensions** | An override layer over a parent collection | Density, look-tiers (Saturated/Transparent), Button sizes, Snapping |
| **Variants** | Component structure that differs | Becomes CSS classes + HTML templates, never JS |

An extension inherits its parent's modes and **cannot add one**. Both a mode pin
and an extension pin trickle to children, but an extension is only ONE override
layer — one pin per collection lineage.

### How a mode pin lands in CSS

A mode pin projects as a `[data-*]` selector, and **a selector only applies where
it is written**. `tokens.css` is light-DOM only. So:

- Custom properties inherit into a shadow root ✅
- `[data-status]` set on an element *inside* a shadow root ❌ — the cascade block
  in `tokens.css` never matches it

When a component needs a status colour on an inner element, name the target token
directly. The chart legend's status swatches are the worked example.

### Cascade layers = Figma collection families

```
core → display-mode → theme → layout → structure → style → elevation → components
```

Each layer owns its base values plus its own mode/extension blocks. Re-projected
by `scripts/project-tokens.mjs`. **Never hand-edit `tokens.css`.**

---

## 4. Composition rules learned from building

- **A chart is composed from atoms in a GRID.** Figma's own Chart 2D page says
  so: a Chart Axis + a row of Data Fields + a Chart Legend. There is no single
  chart component. The code's chart layout follows this, which is what finally
  fixed the axis alignment.
- **Mode pins do NOT cascade into nested instances.** A pin on a parent does not
  reach a component instance inside it.
- **Reuse the existing atom.** Badge, not a new Tag. Skip nested instances where
  a flat structure will do.
- **Instance-sublayer writes are silently discarded.** To change something inside
  an instance, change the main component or use component properties.
- Text: bind a TEXT STYLE (which carries the family/weight bindings), then bind
  the fill separately. Setting a raw `fontSize` over a style drops the binding.
- `layoutMode: 'GRID'` needs HUG tracks or it crushes flex children.
- Big variable batches **freeze the plugin**. Write in small batches.

---

## 5. Open flags — wrong in Figma, not blocking code

| Flag | Detail |
|---|---|
| Data Viz series 2–10 **DANGLING** | A colour rename left these bindings broken. Flagged, never fixed. |
| Chart Legend binds deleted collections | `Typography::` and `Snapping::` no longer exist |
| Pagination Input Field hugs its content | 89px, off-grid |
| No transparent +1/+2 semantic alias | The grid's focused row reaches for the `display-mode` var directly. It is mode-aware, so behaviour is right; only the alias is missing. |
| Grid Cell group variant binds `style-surface/dark` | Not one of the four projected `style-surface` vars. Probed: paints `#e8e8f6` = `style-surface/base +1`, which the code uses. |

### Resolved, needs no action

- **Header-cell Divider rectangles** have `width` bound to `scale/0` and no fill,
  so they render invisible on canvas. Will has confirmed this is a **deliberate
  workaround** to make the auto-layout behave. Code draws them at
  `border-width/sm` in `style-border/base`. No Figma change wanted.

---

## 6. Building a component in Figma

Use the `/build-figma-component` skill — it exists because ad-hoc builds drifted
(wrong page, silent `combineAsVariants` failures, hardcoded values). Its verify
gates are mandatory; each one catches a failure that has actually happened.

The one that bites hardest: **`primaryAxisSizingMode` / `counterAxisSizingMode`
are relative to `layoutMode`, not to width/height.** Getting them backwards
produces a component frozen at 10px tall that clips its content. Almost every
component wants fixed width + hug height:

```js
// VERTICAL
node.counterAxisSizingMode = 'FIXED'; node.resize(360, node.height);
node.primaryAxisSizingMode  = 'AUTO';
```

`resize()` resets sizing modes to FIXED, so call it BEFORE setting them.
