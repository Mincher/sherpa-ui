# Figma Component Builder — authoring guide

`figma-component-builder.js` turns a **declarative spec** into a real Figma
component, so builds stop being ~80 lines of repeated plumbing (font loads,
token-by-name lookups, fill/stroke/padding/gap/radius binding, slots, props,
verify). Each token resolves **once, cached** → far less MCP/token cost per build.

## How to use it (one `figma_execute` call)

The figma-console sandbox is **fresh per call**, so the builder body + your spec
must travel together:

1. Paste the entire `SHERPA_BUILDER` function body into a `figma_execute`.
2. `const B = await SHERPA_BUILDER();`
3. `const result = await B.buildComponent(spec);`
4. `return { ...result };` — **always inspect `result.warnings`**.
5. For any `slotFrames` returned, call `figma_add_slot_property` (separate MCP
   calls — slot conversion isn't available inside the sandbox helper).

## Spec shape

```js
const spec = {
  name: 'Container Header',
  page: 'Container Header',        // must already exist
  replace: true,                   // delete existing same-named component first
  fonts: [['Inter','Regular'], ['Inter','Semi Bold']],
  description: 'sherpa-… JSDoc-style summary',
  root: {                          // the COMPONENT itself is this frame
    kind: 'frame',
    layout: { mode:'HORIZONTAL', align:'CENTER',
      gap:  { c:'Containers', v:'containers-space/gap-sm' },
      padding: { t:{c:'Containers',v:'containers-space/padding-small'}, b:{…}, l:{…}, r:{…} },
      width:440, sizingH:'FIXED', counter:'AUTO' },
    fill: null,                    // null = no fill; or {c,v} / {var,fallback}
    children: [ NODE, … ],
  },
  props: [
    { name:'title', type:'TEXT', default:'Header title', ref:'title' },
    { name:'hasIcon', type:'BOOLEAN', default:false, ref:'icon' },   // on:'visible' inferred
  ],
};
```

### NODE

```js
{ kind:'frame'|'text'|'icon'|'instance', name:'…',
  layout:{ mode, gap, padding, sizingH, sizingV, primary, counter, align, width, height, wrap, cols },
  fill:   {c,v} | {var,fallback} | null,
  stroke: { var:{c,v}, fallback, weight, sides:'top'|'all' },
  radius: {c,v}  |  { tl:{c,v}, tr, bl, br },
  effect: { kind:'shadow', elevationMode:'lg' },     // bound drop-shadow via Elevation
  modes:  [ ['Elevation','lg'], ['Containers','anchored-right'] ],
  text:   { value, style:'body/default/base', color:{c,v} },   // kind:'text'
  glyph:  'home', iconColor:{c,v},                              // kind:'icon' (Icons set name)
  swap:   'nodeId',                                            // kind:'instance'
  slot:   true, collapseEmpty:true,                            // convert frame → slot (do add_slot_property after)
  visible:false,
  children:[ … ],
}
```

`VAR = { c:'CollectionName', v:'prefixed/variable/name' }`

## Status-driven components (Banner, Callout, Message, Tag, …)

A status component must be **status-swappable via one mode pin**, not hardcoded to
one status. Bind the **generic Status vars** and pin a Status extension on the root:

```js
root: {
  kind:'frame',
  fill:   {c:'Status', v:'status-surface/subtle'},   // generic — resolves per pinned ext
  stroke: { var:{c:'Status', v:'status-border/default'}, weight:{c:'Alias',v:'border/width/sm'} },
  radius: {c:'Alias', v:'border/rounding/base'},
  modes:  [ ['info','filled'] ],   // pin the Status EXTENSION (info|critical|warning|success|urgent)
  …
}
```

Changing the pinned extension recolors surface + border + content together. Do NOT
bind `surface/status/info/subtle/default` (locks it to info). If the generic var you
need doesn't exist yet (e.g. there was no `status-surface/subtle` — only the strong
`status-surface/default`), **provision it first** with `provisionCollections`, adding
the var to the Status base + a `revalue` per extension.

**Don't forget stroke + radius.** Bordered/rounded components need BOTH `stroke`
(with `weight`) and `radius` on the root — easy to omit; the App Shell reference will
show them. Read the ref's stroke/strokeWeight/cornerRadius, not just fills.

## Non-negotiable rules the builder encodes (learned the hard way)

- **Token names are collection-prefixed:** `containers-space/gap-sm`,
  `nav-item-surface`, `button-size/height`. Foundations (Apex 2.0, Alias, Icon,
  Elevation) are unprefixed (`content/default/heading`, `size`). Get one wrong and
  it lands in `warnings` as `MISSING VAR …` (silent hardcode → the #1 defect).
- **Always read `result.warnings`.** Empty = every token resolved. Any entry = a
  binding silently fell back to a raw value.
- **Fonts load at the top of the same call** (they don't persist across calls).
- **Nodes aren't extensible** — the builder never stashes state on a node.
- **Sizing (FILL/HUG) is applied after parenting + children exist** — handled
  automatically; just set `sizingH`/`sizingV` in `layout`.
- **Empty slots default to 100px and inflate the parent.** Mark `collapseEmpty:true`
  and, after `figma_add_slot_property`, set the frame `layoutSizingVertical='HUG'`
  + `resize(w,1)`.

## Provisioning collections / modes / extensions

The builder can also **create the variables a component needs** (not just consume
them). Call `B.provisionCollections(specs)` BEFORE `buildComponent` so the tokens
exist for `V()` to resolve.

```js
await B.provisionCollections([{
  name: 'Nav Container',
  modes: ['collapsed','hover','pinned','settings'],   // renames default → modes[0], adds rest
  vars: [
    { name:'nav-container-fill/default', type:'COLOR',
      byMode:{ collapsed:{alias:{c:'Apex 2.0',v:'surface/app/primary/default'}},
               settings:{alias:{c:'Apex 2.0',v:'surface/app/secondary/default'}} } },
    { name:'nav-container-size/width', type:'FLOAT',
      byMode:{ collapsed:40, hover:320, pinned:320, settings:320 } },
  ],
  extensions: [
    { name:'app-primary',
      revalue:[ { var:'containers-surface/default', alias:{c:'Apex 2.0',v:'surface/app/primary/default'} } ] },
  ],
}]);
```

- A `byMode` value is a raw number/string/bool, or `{ alias:{c,v} }` to bind to another variable.
- `type`: `COLOR` | `FLOAT` | `STRING` | `BOOLEAN`. Optional `scopes:[…]`.
- **Extensions** are created with `coll.extend(name)` (inherit the base's current modes) then `revalue` re-binds specific base vars within the extension. Encodes the variation-system order: extend → re-value (→ collapse base modes only if you added temp modes just for the extension).
- Idempotent-ish: existing collections/vars/extensions are **reused**, not duplicated (returns `{created, reused, warnings}`).
- Prefer this over hand-writing collection code — it applies the naming + gotchas from `docs/VARIATION-SYSTEM.md` (prefixed var names, alias-by-name, atomic-rollback ordering).

## Component descriptions = the source of truth (Markdown)

Every component MUST carry a **structured Markdown description** (Figma descriptions
are Markdown, fetchable via MCP/API — the canonical human+AI doc). Pass it as
`cfg.description`. The standard template:

```md
# Component Name
> One-line purpose.

**Use for:** … **Not for:** …

## Anatomy
structure — layout + named regions/slots

## Variants        (component sets only)
- **Axis:** option · option

## Properties
| Name | Type | Default/Notes |
| … | … | … |

## Tokens (& modes)
which collections/vars bind; any pinned modes/extensions (esp. status-driven)

## Composes         (compound components)
which atoms are instanced

## Notes
build date + follow-ups
```

Keep it **human-readable** (headings, bold labels, tables/bullets — not a raw token
dump; summarise collections, don't list all 40 vars). All 30 built components follow
this (applied 2026-08-10). Re-generate the facts from the live component (variants,
props, bound tokens, mode pins) rather than memory — memory drifts.

## What the builder does NOT do (do these as separate MCP calls)

- **Slot conversion** — `figma_add_slot_property` on each returned `slotFrame`.
- **INSTANCE_SWAP props** — `figma_add_component_property` + reference wiring.
- **combineAsVariants** — build each variant, then combine.
- **Screenshot verify** — always `figma_take_screenshot` after; cross-check the
  reported `height` against the render (stale-cache screenshots have bitten us).
