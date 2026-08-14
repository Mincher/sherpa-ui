---
name: generate-sherpa-component
description: Generate a Sherpa-UI component the def-driven way — scaffold a *.def.json, author it, validate it against the design-system rules, compile it to TS/HTML/CSS, and (optionally) build it in Figma. Use whenever creating a new sherpa-* component or substantially changing an existing one's structure, props, slots, events, or tokens. Cites the generation MCP tools at every step and hands the Figma leg to build-figma-component.
disable-model-invocation: false
---

# Generate a Sherpa-UI component (def-first)

The **def** (`src/components/<name>/<name>.def.json`) is the hub. One JSON file drives
**both** the web component (TS / HTML / CSS) **and** the Figma component. You author the
def, validate it against the encoded design-system rules, compile it to code, and — if the
component needs a Figma twin — hand the def to the `build-figma-component` skill.

**Invoke this skill when:**
- creating a **new** `sherpa-*` component, or
- **substantially changing** an existing one — new/changed props, slots, events, nested
  children, or token bindings (anything that reshapes the def).

Trivial CSS tweaks or a copy edit don't need the full workflow. A shape change does.

**Do not improvise.** Every step below is a tool call. The tools encode the rules so the
component is right *by construction* — guessing a token, inventing a primitive, or binding
the wrong role is exactly what these tools exist to stop.

> Reference specs (read if a step is unclear):
> - `docs/GENERATION-TOOLING.md` — the workflow + the full MCP tool surface.
> - `docs/COMPONENT-DEFINITION-STANDARD.md` — every def field, naming rules, `kind`/`relationship` tables.
> - `docs/DEF-TO-FIGMA-BUILD-RULES.md` — the 9 build rules (summarised below).
> - `src/components/sherpa-tag/sherpa-tag.def.json` — a real, enriched def to copy the shape from.

---

## The workflow at a glance

```
        ┌─────────────────────────────────────────────┐
        │              <name>.def.json                 │  ← the hub
        └─────────────────────────────────────────────┘
   author ▲          │ validate           │ compile
          │          ▼                    ▼
      YOU write   design-system rules   code  +  Figma
                  (ontology, scopes,     (compile_def)  (build-figma skill)
                   bindings, reuse)
```

1. **DISCOVER** — `list_components` + `explain_token` / `token_for`. Find what to reuse, find the right tokens.
2. **AUTHOR** — `scaffold_def` then fill it: anatomy, props, slots, events, nested, tokens.
3. **VALIDATE** — `validate_def`, in a **loop**, until `ok`. Every error is a real defect.
4. **COMPILE CODE** — `compile_def` → TS/HTML/CSS, then hand-finish the CSS polish.
5. **BUILD FIGMA** *(optional)* — hand off to `build-figma-component`, feeding it the def.
6. **VERIFY** — `audit_component` + `check_bindings` on the built result.

---

## Step 1 — DISCOVER (never invent what already exists)

**Before authoring anything, learn the system.** This is Rule 1 (reuse) enforced at author
time — the cheapest place to catch it.

- [ ] `list_components` — read every existing component + its def summary. For **every leaf
      role** your component needs (a count, a dot, an avatar, a dismiss, a chip, a field,
      an icon…), check whether a component already does it. **Never invent a primitive when a
      component exists.**
  - count / number indicator → **Badge `Type=count`** (not a Tag with a number in it).
  - status dot → **Badge `Type=dot`** (not a collapsed Tag).
  - dismiss / close → an icon **Button** (`data-type="icon"`) — the shared pattern.
  - field, chip, avatar, menu item… → grep the list first. A look-alike built from the
    wrong component is a **defect**, not a shortcut.
- [ ] `get_component(name)` — for any component you'll **nest**, read its full def so you
      wire its real events and props (e.g. a nested Button emits `button-click`).
- [ ] `explain_token(token)` — for any token you're unsure of, read its purpose / role /
      whenNOT / caveat. `browse_ontology(role?, tier?)` lists tokens by role/tier.
- [ ] `token_for(property, value)` — the meticulous rule (Rule 9): given a property and the
      value you want, it returns **the token that RESOLVES to that value**. Use it for every
      geometry value (gap, padding, radius, stroke-width) and every colour. Do **not**
      eyeball a token name — `space/sm` resolves to `12`, it isn't literally "12".

Output of this step: a shortlist of components to reuse (with their nesting relationship)
and the token you'll bind for each property.

---

## Step 2 — AUTHOR the def

- [ ] `scaffold_def(name, {category})` — get a starter def with the right shape. `name` is
      `sherpa-<kebab>` (always the prefix). `category` is one of `control` / `container` /
      `content` / `data` / `nav` / `chart`. The scaffold carries `"generated": false` — the
      generator will never auto-overwrite your work.
- [ ] Add the row to `scripts/figma-data/name-map.json` with a `status`
      (`no-figma` = code-only for now, `figma-only`, or `matched`).

Now fill it. Copy the shape from `sherpa-tag.def.json`. The field rules:

### anatomy
The node tree the component stamps. Each node: `el` / `class` / `part?` / `slot?` /
`children?`, and a `figma` node hint (`{ node: "FRAME"|"TEXT"|"INSTANCE", … }`). A nested
child appears as `{ component, relationship, … }` in the tree. The compiler builds HTML from
this — **all elements the component will ever show must exist here** (no `createElement`,
no structural `innerHTML`).

### props — the public API, each with a `kind`
Public API is `data-*` (kebab). Native attrs stay bare (`disabled`, `name`, `value`,
`hidden`, `required`, `readonly`). **Reuse the shared vocabulary** (`data-variant`,
`data-size`, `data-status`, `data-active`, `data-selected`, `data-elevation`, `data-label`,
`data-description`, `data-icon-start`, `data-icon-end`, `data-layout`, `data-type`,
`data-open`, `data-dismissible`) — do not invent a synonym for an existing concept.

Every prop declares a `kind` — the variant mechanism:

| `kind` | Realised as | Example |
|---|---|---|
| `style` | CSS class / attribute | `data-collapsed` |
| `content` | data attribute value | `data-status` |
| `visibility` | `--_has-*` display toggle | `data-icon` |
| `template` | swaps the HTML template (name it in `template`) | `data-removable` |

### slots
`{ name, accepts[], description }`. Every content-bearing slot declares a `data-accepts`
category allowlist (see `docs/SLOT-CONTRACTS.md`). Use a slot for app-supplied instances;
use a text prop when a slot only ever holds a label.

### events — unprefixed `noun-verb`
`{ name, bubbles, composed, cancelable, detail, trigger, default }`.
- Name is **unprefixed `noun-verb`** (`tag-remove`, `page-change`, `list-item-click`). **No
  `sherpa-` prefix.** Native re-dispatch keeps the native name (`change`, `input`).
- `bubbles: true`, `composed: true` when the event must reach app code.
- `cancelable: true` **and a `default` block** whenever the component takes a built-in action
  the app may want to veto — record `{ action, description, cancelableBy: "preventDefault" }`.
- `trigger` is what fires it: a native event (`{on, node}` — **native events are private**,
  recorded only as a trigger, never public API) or a child event
  (`{from:"child", component, event}`).
- Every event needs a matching `@fires` in the TS JSDoc (the MCP parses these).

### nested — `owned` vs `slotted`
`{ component, relationship }`:

| `relationship` | Meaning | Figma |
|---|---|---|
| `owned` | the parent ships the child inside its own template | INSTANCE inside the component |
| `slotted` | the app supplies the child via a `<slot>` | a slot, not an instance |

An `owned` child in the anatomy carries its config attrs and, if it re-emits, a `listen`
block (`{ event, action: "reemit", as }`) — see the Tag's owned dismiss Button.

### tokens — bind the token that RESOLVES to the value
`element.property → token`. A plain string is a `--sherpa-*` alias (written **without** the
`--sherpa-` prefix). A status-overridable property is an object:
```json
"pill.background": { "override": "status-surface", "fallback": "control-surface-default" }
```
`override` = the `--_status-*` custom property; `fallback` = the scoped token consumed with
it. Never `--core-*` in component CSS — always a semantic alias with a hardcoded fallback.
Use `token_for(property, value)` to pick each one (Step 1).

### figma block
Leave it to `merge-figma.mjs` once a Figma component exists. For a code-only component it
stays minimal; the build-figma skill and `merge-figma.mjs --force` fill it in later.

---

## Step 3 — VALIDATE (loop until clean) — MANDATORY GATE

- [ ] `validate_def(def)` → `{ ok, errors[], warnings[] }`.
- [ ] **If `!ok`: fix every error, then re-run. Repeat until `ok`.** Do not compile a def
      that still has errors. Do not "work around" a validator error — it is a real defect.

The validator enforces the same 9 rules the Figma build does. Its errors encode real bugs:

- **wrong-role token** — e.g. a control label bound to `status-content` instead of
  `control-content`. This is the shipped Button light-on-light bug (Rule 4): under a status
  pin, `status-content` resolves to on-color (light) ink meant for a saturated fill, so the
  label vanishes on a light secondary surface. The validator catches it before it ships.
- **unbound property** — a geometry value with a raw number where a token resolves to it
  (Rule 9).
- **scope violation** — a fill token used where a stroke is needed, or vice versa (Rule 9
  scopes).
- **didn't reuse** — a hand-rolled primitive where a component already exists (Rule 1).
- **malformed event / nesting** — missing `default` on a cancelable event, an `owned` child
  with no config, a bad `relationship`.

Treat every error as "the design system is telling you this is wrong." Fix the def, not the
validator.

---

## Step 4 — COMPILE CODE

- [ ] `compile_def(def)` → `{ ts, html, css }`. This reconstructs the three component files
      from the def's anatomy + props + tokens.
- [ ] Write them to `src/components/<name>/`.

**The compiler is a scaffolder, not a replicator.** It gets structure, the public API,
behaviour wiring, and the token map right — but hand-written CSS still owns the **polish**:
literal hex fallbacks, edge-case rules (`:host([data-collapsed])`, `.close:hover`),
`white-space`, transitions, container queries. Compiled output is a **correct, working
component**, structurally identical to hand-written — then you hand-finish the CSS. Do not
expect byte-for-byte reproduction of a hand-tuned file; that would bloat the def into a
second copy of the CSS.

- [ ] Hand-finish the CSS per the house rules (see project `CLAUDE.md`): `:host(:not(…))`
      functional form (never chained), CSS owns all visibility, focus rings use the explicit
      `box-shadow` fallback pattern (never `outline: --focus-ring()`), no `opacity` for
      disabled, no viewport `@media` inside component CSS (use `@container`).
- [ ] `npm run type-check` and `npm run lint:css` to confirm it's clean.

---

## Step 5 — BUILD IN FIGMA *(optional — only if the component needs a Figma twin)*

Skip this for a pure code / utility component (`status: no-figma`). Otherwise:

- [ ] **Invoke the `build-figma-component` skill**, and feed it this def as the build spec.
      That skill owns the Plugin-API mechanics, page placement, variant sets, and its own
      mandatory verify gates (A–F). Do not freehand the Figma build — the def tells it the
      anatomy, props (variant axes / booleans / text / instance), events, and the token to
      bind for every property.

The def maps onto the build skill like this:

| def field | build-figma uses it for |
|---|---|
| `anatomy` | the Figma node tree (FRAME / TEXT / INSTANCE per `figma` hint) |
| `props[].kind` + `figma` | variant axes, `hasX`/`isX` booleans, text props, instance-swap slots |
| `nested` (`owned`) | INSTANCEs of existing components (Rule 1 reuse) |
| `tokens` | which variable to bind for each element property |
| `figma.modePins` | which collection modes to pin for the default look/status/elevation |

**Re-state the design-system rules for the build leg** (they are what the build skill's
structural gates *don't* catch):

- **Reuse the existing component** — nest Badge / Button / etc. as INSTANCEs; never rebuild a
  primitive (Rule 1).
- **Every property binds a variable** — bind the token that resolves to the value; no raw
  numbers, no raw font values. Text binds all six Typography vars + a content fill (Rules 2, 9).
- **Buttons bind the Button size vars** — a nested Button's `height` → `Button::button-size/height`,
  padding/gap/icon → the Button collection; then set size by **pinning the Button mode**
  (`2xs`…`3xl`). Never HUG a button's height or hard-set a pixel height — that severs the size
  system (Rule 7).
- **Control labels bind `control-content`, not `status-content`** — a button/tag's text flips
  by *look tier*, not status (Rule 4).
- **Status containers bind `container-*` that alias THROUGH status** — bind the nearest
  component-scoped token, don't reach past it to `status-*` (Rule 3).
- **Pin Status on the nested instance** — a Status mode on the parent does **not** cascade
  into a nested instance's own bound variables (Rule 8).
- **Verify the icon swap** — assert the swapped instance's `mainComponent` name is the
  intended glyph (e.g. `cross`, not `tick`); a screenshot alone is not proof (Rule 5).
- **Screenshot and judge it as a designer** — the build skill's Gate E: no phantom bar, no
  clipped text, two-tone status icons render, status colour actually shows.

When `build-figma-component` finishes, run `merge-figma.mjs --force` to fill this def's
`figma` block from the built component, and point `name-map.json` at it (`status: matched`).

---

## Step 6 — VERIFY the result — MANDATORY GATE

- [ ] `audit_component(name)` — re-checks the **built** result against the ontology + binding
      rules (the same checks, applied to reality rather than the def).
- [ ] `check_bindings(name)` — the "every property uses a variable" audit (Rule 9). A value
      with a raw number where a token resolves = a violation to fix.
- [ ] Fix anything they flag, then re-run. Green = the component matches the ontology and
      every property is bound.

---

## The 9 rules at a glance

The design-system rules the validator + audits enforce (full detail:
`docs/DEF-TO-FIGMA-BUILD-RULES.md`). Keep these front-of-mind while authoring.
The doc's rule numbers run 1–5 then 7–9 (there is no Rule 6) — eight rules, listed here
by the doc's own numbering so a citation matches:

| Rule | The rule | The defect it prevents |
|---|---|---|
| 1 | **Reuse the existing component; never invent a primitive** | alert-card used a Tag for a count when **Badge `Type=count`** exists |
| 2 | **Text binds Typography variables** (6 vars + a content fill) — never raw font values | alert-card set raw `fontSize`/`fontFamily`/`fontWeight`, zero Typography bindings |
| 3 | **Status containers bind `container-*` that alias THROUGH status**; controls bind `status-*` | a container reaching past its scoped token to `status-surface` directly |
| 4 | **Control labels bind `control-content`, not `status-content`** — text flips by look tier | shipped Button = light text on a light secondary surface under a status pin |
| 5 | **Icon-swap targets the intended glyph AND is read back** | the dismiss button showed a **tick, not a cross** |
| 7 | **Buttons ALWAYS bind the Button size variables** so the size mode (2xs…3xl) drives them | a HUG'd button dropped its `height` bind → the size mode did nothing |
| 8 | **Mode pins do NOT cascade into nested instances** — pin Status on the instance | a nested status dot didn't tint because Status was pinned on the parent only |
| 9 | **Every property binds the token that resolves to its value** (scopes respected — a fill token can't be a stroke) | raw numbers instead of the scoped/Core token that resolves to them |

---

## Quick reference — the generation MCP tools

**Discover**
- `list_components` — every component + def summary (reuse check, Rule 1)
- `get_component(name)` — full def + code + Figma binding shape for a component you'll nest
- `explain_token(token)` — purpose / role / whenNOT / caveat
- `browse_ontology(role?, tier?)` — tokens by role/tier
- `token_for(property, value)` — the token that RESOLVES to a value (Rule 9)

**Generate**
- `scaffold_def(name, {category})` — starter def with the right shape
- `validate_def(def)` — run every rule; returns errors + fixes (loop until `ok`)
- `compile_def(def)` — → `{ ts, html, css }`

**Verify**
- `audit_component(name)` — bindings + ontology accuracy for the built component
- `check_bindings(name)` — the "every property uses a variable" audit

**Resources**: `sherpa://def/{name}`, `sherpa://ontology/{id}`,
`sherpa://component/{name}/{ts|html|css}`, `sherpa://rules` (the build rules).

---

## Definition of done

- [ ] `<name>.def.json` exists, `"generated": false`, row added to `name-map.json`.
- [ ] `validate_def` returns `ok` (loop was run to clean).
- [ ] `compile_def` output written to `src/components/<name>/`, CSS hand-finished, `type-check`
      + `lint:css` clean.
- [ ] *(if a Figma twin was needed)* `build-figma-component` completed its gates, `figma`
      block merged, `name-map.json` = `matched`.
- [ ] `audit_component` + `check_bindings` green.
