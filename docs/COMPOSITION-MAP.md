# Composition map — one source of truth, two projections

**Status:** DRAFT for review (Phase 0 of the Figma⇄code compiler rework). No compiler is
built yet; this document + the two schemas are the design gate.

A **composition map** persists a composition of Sherpa components — a card, a chart, a whole
view — as a single serialisable file that can be **compiled into a Figma frame** *and* into a
**runnable Sherpa-UI view** (`renderView()` → DOM/HTML), and that the **Figma extractor emits**
when it reads a frame back out. It closes the gap the charts work exposed: today a composition
(the donut dashboard, a 2D chart template) exists only as an imperative `figma_execute` script
in a memory file — nothing persists it as data, so nothing can rebuild it in Figma *or* project
it to code.

## The two tiers

Component metadata splits into two tiers, each with **one authored source**:

| Tier | Authored in | Figma form | Code form |
|---|---|---|---|
| **Contract** (per component *type*) | **CSS primary** (`data-*` states/enums + `--*` API + pseudo-class interaction), **HTML** (slots), **JSDoc** (events/methods + a *generated* `@figma` summary) | `componentPropertyDefinitions` + Markdown description | the extracted contract (CSS-parser + `schema-parser.js`) |
| **Instance** (per *placement*) | **composition-map** | frame of instances + overrides + mode pins | `view-definition` → `renderView()` |

This document is mostly about the **instance tier** (the composition map). The **contract tier**
(the last major section) is now **multi-source with CSS primary** — it's what lets the instance tier
know that `data-variant`'s real enum is whatever the `:host([data-variant="…"])` rules declare, how
that projects to a Figma variant, and how to resolve a Figma instance back to `sherpa-*` + attrs
without guessing.

## One IR, many projections

```
   PRIMARY ▶  Figma frame ──[extract]──► composition-map.json ──[compile→code]──► view-definition ─► renderView ─► DOM/HTML

   SECONDARY (supported, not the driver — do not complicate the design to serve these):
     composition-map.json ──[compile→figma]──► Figma frame          (rebuild / persist)
     composition-map.json ◄──[round-trip check]──► verify a compile didn't drift
```

- **`composition-map.schema.json`** — the neutral **pivot** (the IR). Flat `nodes` registry +
  a `role` on every node. This is the source of truth that gets committed.
- **`figma-composition.schema.json`** — the **Figma-idiomatic** projection (node kinds, bound
  vars, mode pins, paint styles). Produced by `map→figma`; low-level target of the extractor.
- **`view-definition.schema.json`** — the **code-idiomatic** projection (existing, unchanged).
  Produced by `map→view-def`.

The two projection schemas are **deliberately not merged** (ratified: "two schemas + a mapping").
Each keeps its own world's concerns out of the other: the Figma spec never carries `$state`
wiring; the view-definition never carries paint-style ids. The map is the thin waist between them.

## Roles — the discriminator that routes each node

Every map node has a `role`. It is the single most important field: it tells the code projection
how to emit the node, and it is where the *pseudo-component* insight lives. Because the **primary
direction is Figma→code** (see §Direction), read the table as "what a designer put in Figma → what
the code projection makes of it."

| `role` | In Figma (what the designer built) | In code (what the projection emits) |
|---|---|---|
| `component` | a placed **design-system instance** of a `sherpa-*` main | a `<sherpa-*>` custom element (via its public API) |
| `pseudo` | **loose, editable layers** — deliberately NOT componentised, so designers reshape them freely (arc, bar, gridlines, spline) | a **real reusable code component/module** rendering the primitive via `codeHint` |
| `container` | an auto-layout / GRID frame | a layout element (`sherpa-layout-grid`) or `<div>` grid |
| `raw` | one-off geometry with no reusable nature | a `codeHint` literal (e.g. an SVG `path` `d`) — inline, not a module |

### Why `pseudo` exists (the key idea — the inversion)

The instinct to make a repeated mark into a component is **right for code and wrong for Figma**.

- **In Figma, componentising a mark *fights* the designer.** A gridline set is something you want to
  grab and reshape in place — change the row count, drag a vertex. Wrapping it in a component forces
  detach/override friction for no benefit. (The charts work already learned this: *"Gridlines — NOT
  a component (over-engineering); just a plain GRID frame… designer changes gridRowCount and edits
  it in place."*) So the default Figma posture, for **every** role, is: **don't componentise in
  Figma unless explicitly asked.** Keep the design loose and designer-friendly.
- **In code, the same mark *should* be one reusable module.** You don't re-author arc-drawing for
  every donut; gridlines are one component, not copy-pasted per chart. DRY belongs here.

`role: pseudo` encodes exactly this inversion: **"loose layers in Figma; one reusable component in
code."** The code projection reads the node's `codeHint` (`svg-arc`, `grid-lines`, …) and emits a
call to the corresponding reusable module — not a per-node copy. Its styling — the Categorical
Transparent/N fill + Solid/N stroke, per-side stroke weight — is read from the loose layers'
`figma.styleRef` / `figma.boundVars` and mapped to CSS classes/variables. One node, correctly
different in each world: raw where humans edit it, DRY where machines run it.

## Direction — this is primarily Figma → code

The purpose of the system is **creating usable web components from the design system in Figma**.
So the load-bearing path is **Figma → map → code**: read what designers naturally build, emit clean,
DRY Sherpa-UI code. Everything is optimised for that.

- **The Figma side is not something we push structure *into*.** The compiler doesn't force
  components, slots, or a canonical hierarchy onto the design. It reads the design mostly as-is:
  placed design-system instances (`component`), loose editable layers (`pseudo`/`raw`), and
  layout frames (`container`). **Default posture: don't componentise in Figma unless asked.** The
  intelligence lives in the *code projection*, not in constraining the designer.
- **`code → Figma` and full round-trip are SECONDARY.** The pivot IR *supports* both, and they're
  genuinely useful (persisting a composition, rebuilding it, verifying nothing drifted). But we do
  **not** complicate the schema or burden the Figma side to make a pixel-perfect round-trip work.
  If a choice trades round-trip fidelity for a cleaner Figma→code result or a friendlier design,
  we take the cleaner result.

This reprioritises the Phase-4 gate: the **real** gate is *"does the Figma composition produce a
correct, usable web component?"* — not *"does it round-trip identically?"*. Round-trip identity is
a **verification aid**, not the product.

## What survives the Figma → code compile (the honest boundary)

- **`component` nodes** — full public-API state (`props`/`slots`/`data`), because the contract tier
  defines the exact attr↔property mapping. This is the highest-fidelity path.
- **`pseudo` nodes** — recognised as a reusable code module + its parameters (`codeHint.params`)
  and styling (`styleRef` → CSS). The *code* is DRY and correct; the Figma layers stay loose.
- **`container` layout** — mode, tracks, gaps, spans, and overlay positioning (see §Layout).
- **`raw` nodes** — a one-off literal (`codeHint`, e.g. an SVG path). An escape hatch, not a
  guarantee of anything reusable.

**Out of scope (never in the map):**
- Theme / mode / density — app-level, owned by `ThemeManager`; correctly excluded (same as
  view-definition today).
- Free-form Figma art with no component/pseudo/reusable nature and no code counterpart.

**Round-trip check** (Phase 4, a verification aid — not a hard gate): `figma → map → code` produces
a correct component (the real gate); optionally `map → figma` rebuilds a recognisable composition
and `map`'s `component` nodes each resolve to a real `sherpa-*` whose JSDoc contract covers every
`prop` used (contract-agreement drift, reported not blocked).

## Layout — deliberately small

`layout` is **structural only** — it maps cleanly to *both* Figma auto-layout/GRID and CSS
grid/flex, and nothing more. Presentation (colour, elevation, type) is **not** in `layout`: on the
code side it comes from tokens/CSS keyed off `data-*`; on the Figma side from bound variables and
mode pins (`figma.modePins` / `figma.boundVars`). Keeping `layout` thin is what stops the map from
becoming a doomed universal style language. If a value can't be expressed as "structure" it belongs
in the component's contract (code) or in `figma` hints (Figma), not in `layout`.

## Prototyping / wiring

A node's `wires` project **both** ways from one declaration:
- **Code** → view-definition `writes` (an event writes to a `$state` pointer; consumers bound to
  that pointer re-populate). This is the existing state-mediated wiring, unchanged.
- **Figma** → a prototype-reaction *stub* on the instance (the `@fires` event → a documented
  interaction). Figma can't run the real handler, but the reaction names the real event, so the
  prototype and the code agree on the vocabulary.

`wires[].on` must be a **real `@fires` event** of that component — validated against the contract;
a typo or a removed event is caught as drift (warn).

---

# Contract tier — CSS is the primary source; JSDoc summarises it

**Correcting an earlier draft:** this section first said "JSDoc is the single source of component
metadata." That is wrong for a CSS-first, progressive-enhancement system, and the codebase proves
it. A component's real contract — its states, variants, style hooks, and interaction — lives
**mostly in the CSS**, keyed off `data-*` attributes. JSDoc `@attr` only *describes* the JS-facing
API, and it demonstrably **lags and under-reports** the CSS.

### The evidence (why CSS must be primary)

Audited across the 68 components:

- **483 `@attr` lines, but only 1 `@cssprop` and 0 `@state`** — while CSS defines **177 private
  custom properties** and a real cross-component protocol (`--_status-*`, consumed by 16 files;
  `--_cg-*`, the component-group contract).
- **Every sampled component drifts, always in the same direction — CSS is ahead of `@attr`:**
  `sherpa-tag` styles **10 `data-color` values** in CSS with **zero `@attr` lines** for `data-color`;
  `sherpa-button` implements a whole `data-variant="ai"` variant absent from `@attr`;
  `sherpa-barchart` has **11 CSS-styled attributes with no `@attr`**, including the entire
  `data-color-index="1..11"` palette.
- **Interaction is 100% CSS pseudo-class-driven and undocumented in JSDoc** — `:hover`,
  `:focus-visible`, `:checked`, `:user-invalid` (native validation with no JS), `[popover]` +
  `@starting-style` (menus). No `@state` tags exist anywhere.

So treating JSDoc as the contract would **systematically miss real states and mis-state enums**.
This is just the progressive-enhancement thesis applied to the contract itself: **if JS is the last
resort, the JS docstring cannot be the primary contract.**

### The corrected model — a multi-source contract, CSS primary

| Surface | Authoritative for | The contract it declares |
|---|---|---|
| **CSS** (`.css`) — **primary** | styling + interaction (the bulk) | `data-*` attrs **and their enum values** (parsed from `:host([data-*="…"])` selectors), the `--*` custom-property style API, pseudo-class interaction |
| **HTML** (`.html`) | structure | slots, `data-accepts` allowlists, cloning prototypes |
| **JSDoc/TS** (`.ts`) | the JS *last resort* + **a summary** | `@fires`, `@method`, JS-only `@prop`, prose `@description` — **and a generated `@figma` summary of the CSS-declared contract** |

**Source-of-truth rule (ratified): CSS wins; JSDoc supplements + warns.** The contract extractor
reads state/enum/custom-prop facts from **CSS as authoritative** (the machinery is a small addition
to the existing `css-parser.js` — parse enum values out of selector strings, index `var()` uses).
JSDoc adds only what CSS can't express (events, methods, JS props, prose). A disagreement — a CSS
enum missing from `@attr`, or an `@attr` enum with no CSS rule — is a **drift warning**, never a
block (matches the warn-don't-block policy). JSDoc is a *mirror of the CSS truth*, not an
independent authority.

## The `@figma` projection annotation — authored in CSS, summarised in JSDoc

Each styling `data-*` needs a rule for **how it manifests in Figma** (an enum axis? a boolean prop?
a mode-pin? an instance-only override?), because code `data-*` and Figma component properties aren't
1:1 (code enums are open strings selected by CSS; Figma variants are a fixed matrix; some attrs like
`data-icon-start` can't be an axis at all).

**The projection rule is authored in the CSS, beside the rules it projects** — the truth lives with
the truth — **and summarised into JSDoc `@figma` (generated from the CSS, not hand-authored)** so
there's one readable roll-up for humans and the MCP:

```css
/* sherpa-button.css — the projection annotation sits with the selectors that define the state */
/* @figma:variant */
:host([data-variant="secondary"]) { … }
:host([data-variant="tertiary"])  { … }
:host([data-variant="ai"])        { … }   /* the extractor reads the enum FROM these selectors */

/* @figma:mode:Status */
:host([data-status]) { … }

/* @figma:instance  (a per-placement value, never a variant axis) */
:host([data-icon-start]) .icon-start { … }
```

```
// sherpa-button.ts — GENERATED summary block (mirror of the CSS; regenerated, not hand-edited)
@figma variant  data-variant = secondary | tertiary | ai        (from CSS)
@figma mode     data-status  → Status extension                 (from CSS)
@figma instance data-icon-start
@figma interaction  @fires button-click
```

The **enum values come from the CSS selectors**, not a hand-copied `@attr` — which removes the drift
class entirely (the CSS *is* the enum). `@fires`/`@method` stay hand-authored in JSDoc (JS can't be
read from CSS); their `@figma:interaction` projection is the exception that legitimately originates
in JSDoc.

**Projection rules** (`@figma:<rule>`):

| rule | meaning | Figma manifestation |
|---|---|---|
| `variant` | an enum axis of the component set | a variant property `Axis = a \| b \| c` |
| `boolean` | a boolean toggle | a boolean component property `hasX`/`isX` |
| `text` | free text shown in the component | a text component property |
| `instance` | per-placement value, not an axis | an instance override only (no property def) |
| `mode:<Collection>` | how the attr manifests **in Figma only** — pins a variable mode/extension | `setExplicitVariableModeForCollection` (status, snapping, series colour) |
| `doc` | documentation-only (e.g. a method) | appears in the description, no property |
| `interaction` (on `@fires`) | a real event | a prototype-reaction stub + a documented interaction |

**Default when the annotation is omitted** (be forgiving): infer the projection from the CSS shape —
a `data-*` with **enumerated values** in selectors → `variant`; a **bare boolean** `data-*` (no
`="value"`) → `boolean`; a `data-*` used as a **presence hook** for content (`data-icon-start`) →
`instance`; `@fires` → `interaction`. An explicit `/* @figma:… */` always wins; the annotation
exists precisely for the cases inference gets wrong (`data-status` is enumerated but must be
`mode:Status`, not a `variant`; `data-icon-start` looks like it could be an axis but must be
`instance`).

### `@figma:mode` records the FIGMA mechanism only — code is unchanged (ratified)

`@figma:mode:<Collection>` is the sharpest asymmetry in the system, so be exact about it. An attr
like `data-status="critical"` projects to **two genuinely different mechanisms**, and the annotation
records only the Figma one:

- **Code** — `data-status` stays the **CSS-cascade override** it is today (the inherited
  `--_status-*` custom properties; see `sherpa-status-override-model`). It is *not* a token swap and
  the code projection introduces **no new mode mechanism**. The attr is set; CSS does the rest.
- **Figma** — the same attr projects to a **Status extension mode-pin**
  (`setExplicitVariableModeForCollection`). `@figma:mode:Status` records *this half*.

So `mode` is a **projection rule, not an equivalence**: it tells the Figma compiler what to pin and
tells the extractor how to map a Figma mode-pin back to an attr — without which status/series-colour
couldn't round-trip at all. It never implies the code side adopts Figma's mode concept. Series
colour works identically: `@figma:mode:Data Viz Sets` ↔ a CSS class / custom-property on the code
mark. (This is why the map's `figma.modePins` is under the **Figma-only** `figma` hints, never in
the neutral fields.)

## Drift policy — warn, don't block (ratified)

The contract now has **three representations of the same facts**, and CSS is the referee. A **drift
validator** runs a three-way check with **CSS as the source of truth**:

```
        CSS (truth)  ─────►  JSDoc @figma summary  ─────►  Figma variants/props
         │  the enum,          the generated mirror          the projected axes
         │  the states,        (should equal CSS)            (should equal the projection)
         └──────────────── all three should agree ───────────────────────┘
```

It **reports, never gates** — surfaced in CI and via the MCP, matching the current soak-phase
posture (`SherpaElement.strictSlots = false`). Reported drift includes:

- a `data-*` enum in **CSS** with no matching value in the **JSDoc `@figma` summary** (the summary
  is stale — regenerate it) — *this is the most common case today* (e.g. tag's 10 `data-color`s);
- a `data-*` enum in CSS with no matching **Figma** variant option (or vice-versa);
- an `@attr`/`@figma` summary value with **no CSS rule** (documented-but-unimplemented);
- a `@fires` event not present as a Figma interaction (or vice-versa);
- a composition `prop` whose attr isn't in the component's **CSS** contract;
- a Figma component property with no CSS/`@figma` counterpart.

No exemption bureaucracy; a report artifact (like the token diff report) plus MCP warnings. Teams
act on it; nothing is blocked. Because CSS is authoritative, the fix for most drift is **regenerate
the JSDoc `@figma` summary from the CSS**, not hand-edit `@attr`.

---

## Phase 0 decisions (resolved 2026-08-13 with Will)

**Framing correction (2026-08-13):** the `pseudo` role and the overall direction were initially
written inverted. Corrected to: **primarily Figma→code**; `pseudo` = **loose layers in Figma, a
reusable module in code** (not "a Figma component inlined in code"); **don't componentise in Figma
unless asked**. See §Direction and §Roles above — this section's four decisions post-date that fix.

The four gate questions are settled:

1. **`role` set — the four stand: `component` / `pseudo` / `container` / `raw`.** No `text` role.
   Text is never a standalone composed node — it's a component prop (`data-label`), a component's
   `data` payload, or literal content inside a `pseudo`/`raw` via `codeHint:html`. A `text` role
   would re-express what the contract tier already owns, reintroducing exactly the redundancy this
   rework removes. The four are orthogonal.

2. **Status / series colour — Figma-only mode-pin; code stays the pure CSS-override model.**
   `@figma:mode:<Collection>` records how the attr manifests in Figma; the code side keeps its
   `--_status-*` cascade override untouched and gains no mode mechanism. See the "@figma:mode
   records the Figma mechanism only" note above. (Rejected: a symmetric neutral mode concept —
   it would add a code mechanism parallel to the existing override, the redundancy we're removing.)

3. **`layout` gets `positioning` + `constraints` in the NEUTRAL map.** Overlay marks (chart
   gridlines/vectors that fill a plot area with `absolute` + `stretch`/`scale`) are **structural**,
   not Figma-only decoration — the entire 2D-chart architecture depends on them, and in code they're
   the same idea (an SVG layer `position:absolute; inset:0` over a `position:relative` plot,
   `preserveAspectRatio`). Structure lives in the neutral map, so a chart can round-trip. Added to
   `composition-map.schema.json` `layout.positioning` / `layout.constraints`.

4. **`codeHint.kind` — open registry, seeded with the known chart primitives.** `kind` is an open
   string (not a closed enum): a new mark type is a renderer addition, not a schema change, and an
   unknown kind is a validator *warning* (missing renderer), matching the warn-don't-block policy.
   Seeded set (transcribed from marks already built imperatively, not speculative):
   `svg-arc` · `svg-trapezoid` · `svg-polyline` · `svg-rect` · `grid-lines` · `svg-path` · `html`.
   This doc is the registry of record.

**Contract-tier correction (2026-08-13):** the contract tier was initially "JSDoc is canonical."
Corrected — the codebase audit proved CSS is the real (and often only) contract source:

5. **CSS is the PRIMARY contract source; JSDoc summarises it.** State/enum/custom-prop facts are read
   from CSS (`:host([data-*="…"])` selectors, `--*` API, pseudo-class interaction) as authoritative;
   JSDoc adds only events/methods/JS-props + prose, plus a **generated `@figma` summary** of the CSS
   contract. **CSS wins; JSDoc supplements + warns** on disagreement (warn-don't-block). Evidence:
   483 `@attr` vs 1 `@cssprop`/0 `@state`; every sampled component's CSS is ahead of `@attr`
   (tag: 10 `data-color`s / 0 `@attr`; button `data-variant="ai"`; barchart 11 undocumented attrs).
   The extractor is a small addition to the existing `css-parser.js` (parse enum values from
   selectors, index `var()` uses).

6. **The `@figma` projection rule is authored IN CSS (beside the selectors), summarised in JSDoc.**
   Truth lives with truth; the JSDoc `@figma` block is a generated mirror, not hand-authored. Enum
   values come from the CSS selectors, killing the drift class. The Figma→code compiler's job for a
   `component` node therefore shrinks to **emitting the right `data-*` surface** — CSS is the styling
   engine; the compiler writes HTML data attributes, it does not generate styles.
