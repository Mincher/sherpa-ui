# Component Definition Standard (`*.def.json`)

> One JSON file per component — the shared source of truth that can drive **both**
> the web component (TS / HTML / CSS) **and** the Figma component (nodes /
> variables / variants). Every definition, whether generated from code, read from
> Figma, or hand-authored, MUST follow this standard so all defs are consistent.

Location: `src/components/<name>/<name>.def.json` (beside the 3 component files).

---

## 1. How defs are produced

| Source | Tool | Fills |
|---|---|---|
| **Code** (TS/HTML/CSS) | `scripts/generate-defs.mjs` | props, templates, slots, parts, events, tokens, nesting |
| **Figma** (bridge read) | `scripts/merge-figma.mjs` | the `figma` block: variant axes, bool/text/instance props, mode pins |
| **Hand** (new component) | this document | everything, following the field rules below |

- Generated files carry `"generated": true`. The generator **overwrites** them.
- Enriched / hand-authored files carry `"generated": false`. The generator
  **never** overwrites them; `merge-figma.mjs` touches only their `figma` block,
  and only with `--force`.

Raw Figma read + the code↔Figma name map live in `scripts/figma-data/`.

---

## 2. Naming conventions (the rules all defs share)

### 2.1 Names differ between code and Figma — the map is authoritative

The code element name and the Figma page/node name are **often different**. Never
assume they match. The bridge is `scripts/figma-data/name-map.json`.

| Code (`sherpa-*`) | Figma page/node |
|---|---|
| `sherpa-list-item` | Menu List Item |
| `sherpa-chart-legend` | Legend Item |
| `sherpa-key-value-list` | Key Value Pair |
| `sherpa-barchart` / `sherpa-line-chart` / `sherpa-sparkline` | Data Field (Chart 2D) |
| `sherpa-calendar` | Grid |
| `sherpa-input-text` | Input |

Rules:
- **Code element name:** `sherpa-<kebab>` — always the `sherpa-` prefix.
- **Figma node name:** Title Case (`Menu List Item`). Figma **page** is
  `sherpa-<kebab>` or a `✅ <Name> · built <date>` marker.
- A new component adds its row to `name-map.json` with a `status` (below).

### 2.2 `status` — code/Figma coverage

| status | Meaning |
|---|---|
| `matched` | both a code component and a Figma component exist |
| `no-figma` | code only (backlog / utility: app-shell, data-grid, layout-grid, proposal-*) |
| `figma-only` | Figma only, no code yet (Banner, Chip, Select Card, Badge, Menu, View Header) — listed in `name-map.json → figmaOnly` |

### 2.3 Attributes (props)

- Public API = `data-*` (kebab). Native attrs stay bare (`disabled`, `name`,
  `value`, `hidden`, `required`, `readonly`).
- Reuse the shared vocabulary (`data-variant`, `data-size`, `data-status`,
  `data-active`, `data-selected`, `data-elevation`, `data-label`,
  `data-description`, `data-icon-start`, `data-icon-end`, `data-layout`,
  `data-type`, `data-open`, `data-dismissible`). Do not invent a synonym.
- Component-private state is `--_*` CSS custom properties, never a public `data-*`.

### 2.4 Events

- Unprefixed `noun-verb` (`tag-remove`, `page-change`, `list-item-click`). **No**
  `sherpa-` prefix. Native re-dispatch keeps the native name (`change`, `input`).
- Every event has a matching `@fires` in the TS JSDoc and appears in `events[]`.

### 2.5 Figma variant axes & props

- **Variant axis** = a visual/state fork the design picks (`Type`, `State`,
  `Size`, `Orientation`, `Layout`, `Value`). Read verbatim from Figma; do not
  rename to match code.
- **Boolean prop** = `hasX` / `isX` (`hasIcon`, `hasDismiss`, `isChecked`).
- **Text prop** = a text node value (`label`, `heading`, `value`).
- **Instance prop** = an instance-swap slot (`iconStart`, `leadingControl`).

### 2.6 Mode pins (extended collections)

A component pins a collection **mode** to fix its default look/status/elevation.
Recorded as `figma.modePins`. Examples from the file:
`Toast → {Status: info, Elevation: md}`, `Menu → {Container: default, Elevation: md}`,
`Callout/Banner/Message → {Status: info}`, `Input/Metric → {Status: passthrough}`.
Empty `{}` is meaningful — the component inherits the cascade (e.g. Tag pins
nothing; status comes from `[data-status]`).

---

## 3. Field reference

Top-level:

| Field | Purpose |
|---|---|
| `$schema` | the def schema version |
| `generated` | `true` = generator-owned; `false` = hand-enriched (never auto-overwritten) |
| `name` | code element name (`sherpa-*`) |
| `figmaName` | Figma node name (from the map) |
| `category` | role: `control` / `container` / `content` / `data` / `nav` / `chart` |
| `description` | one line |
| `anatomy` | node tree (enriched defs only): `el`/`class`/`part`/`slot`/`children`, each with a `figma` node hint |
| `props` | the `data-*` / native public API. Each: `name`, `type`, `kind`, `values?`, `default?`, `description`, `figma?` |
| `templates` | template ids the component stamps |
| `slots` | `{ name, accepts[], description }` |
| `parts` | exposed `::part()` names |
| `nested` | child components: `{ component, relationship }` |
| `events` | see below |
| `overrides` | how consumers customise (they never edit source — see §5) |
| `tokens` | element.property → token (string alias, or `{ override, fallback }` for status) |
| `figma` | the Figma block (from `merge-figma.mjs`) — see §2.5–2.6 |

`props[].kind` — the variant mechanism, per prop:

| kind | Realised as | Example |
|---|---|---|
| `style` | CSS class / attribute | `data-collapsed` |
| `content` | data attribute value | `data-status` |
| `visibility` | `--_has-*` display toggle | `data-icon` |
| `template` | swaps the HTML template | `data-removable` |

`nested[].relationship`:

| relationship | Meaning | Figma |
|---|---|---|
| `owned` | the parent ships the child inside its own template | INSTANCE inside the component |
| `slotted` | the app supplies the child via a `<slot>` | a slot, not an instance |

`events[]`:

| Field | Purpose |
|---|---|
| `name` | the Sherpa event name (`noun-verb`) |
| `bubbles` / `composed` | always `true` / `true` when crossing shadow to app code |
| `cancelable` | `true` if the app can `preventDefault()` |
| `detail` | payload shape |
| `trigger` | what fires it — a native event (`{on, node}`) or a child event (`{from:"child", component, event}`). **Native events are private** — recorded only as a trigger, never public API. |
| `default` | the built-in action + how to cancel it (`{action, cancelableBy}`) |

---

## 4. `tokens` block

`element.property → token`. A plain string is a `--sherpa-*` alias (write the
name without the `--sherpa-` prefix). A status-overridable property is an object:

```json
"pill.background": { "override": "status-surface", "fallback": "control-surface-default" }
```

`override` = the `--_status-*` custom property (consumed with the fallback).
Follows the 3-tier token architecture: never `--core-*` directly; always a
semantic alias with a hardcoded fallback in the CSS itself.

---

## 5. `overrides` — how consumers customise

Library consumers **do not edit source**. Five paths, recorded per component:

| Path | How |
|---|---|
| `listen` | add an event listener, act in app code (most common) |
| `cancel` | for a cancelable event, `preventDefault()` in the listener |
| `subclass` | `extends` the class, override a handler, `define` a new tag |
| `attributes` | set `data-*` / native attrs — the public API, no override needed |
| `styling` | `::part(name)` on exposed parts, or set public `--sherpa-*` tokens |

---

## 6. Authoring a NEW def (outside Figma)

1. Add the row to `name-map.json` (`status: no-figma` or `figma-only`).
2. Write `<name>.def.json` with `"generated": false`.
3. Follow every rule above: `sherpa-*` name, `data-*` API + shared vocabulary,
   `noun-verb` events, `hasX`/`isX` bools, `kind` per prop, `relationship` per
   nested child, token aliases with fallbacks.
4. If/when a Figma component is built, add it to `figma-read.json`, point the map
   at it, and run `merge-figma.mjs --force` to fill the `figma` block.
