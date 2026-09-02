# Plan — DTCG-dialect Component Spec + Figma Naming Alignment

## Context
Sherpa-UI already sits on DTCG for tokens (figma.tokens.json → tokens.css). The
component contract (thin YAML) is strong on native-HTML/CSS/Figma-variable use but
loose: it doesn't share DTCG's grammar, doesn't declare extension tiers or Web-API
capabilities as first-class data, and isn't schema-validated. Goal: evolve the YAML
into a DTCG-dialect component spec, and realign Figma property/state/capability/event
names so one vocabulary spans Figma ↔ HTML/CSS ↔ YAML.

## Part 1 — The DTCG-dialect component spec

### 1.1 Core grammar (mirror DTCG)
- Adopt `$`-prefixed core keys: `$schema, $type, $name, $description, $extensions`.
- Component `$type` set (closed, small): `component, element, prop, variant, slot,
  state, capability, event`.
- Reference grammar identical to DTCG: `{path.to.thing}`. A component's tokens,
  variant→tier bindings, and state→token links all use `{ref}` — the single seam
  shared with the token file.
- Namespace Figma/runtime extras under `$extensions.sherpa` (figmaName, figmaNodeId,
  behaviour channel, oneToMany divergence) — portable core, namespaced extras.

### 1.2 New first-class blocks
- `element:` — the native element the component IS: `tag`, `attributes`,
  `provides:` (browser-owned behaviour JS must not re-implement), `stateCss:` (the
  `:checked`/`:disabled`/`:focus-visible` selectors that drive visuals).
- `capabilities:` — declared Web-API surface (ElementInternals/form-association,
  container-query, observers, etc.), so robustness is contract data, not implicit in .ts.
- `extends:` under `$extensions.sherpa` — names the extension-tier mechanism
  (Transparent/Saturated/snap/density) in the contract; `variant.$ref` binds a
  data-* variant to a Figma tier collection.
- `states:` — each state = a CSS selector + token refs (CSS-owned, JS-free).

### 1.3 Schema + tooling
- Publish `component.v1.json` JSON Schema (validation, autocomplete, CI check).
- Two resolvers, one contract: token DTCG → tokens.css; component spec → .ts/.html/.css.
  They touch ONLY through `{ref}` syntax; neither imports the other.
- A shared `{ref}` resolver that can walk both files.

### 1.4 Migration
- Convert existing thin YAML → *.component.yaml one component at a time, starting with
  a pilot (sherpa-switch is a good shape). Prove schema-valid + build + e2e green.
- Keep the semantic/lossless guard: expanded spec must round-trip to the same
  .ts/.html/.css.

## Part 2 — Figma naming alignment (rework property/state/capability/event names)

### 2.1 Principle
One name per concept across Figma variant props, HTML/CSS, and the YAML contract.
Prefer the HTML/CSS-native term where one exists; fall back to the ratified data-*
enum names.

### 2.2 Rename passes (each is a Figma write + a code/YAML sync)
- **Properties/variants** — align Figma component-property names to the data-* API
  (e.g. Figma `Style` variant → `data-style`; size axis → `data-size`). Reuse the
  standard enums (variant/size/status/type/layout); no synonyms.
- **States** — align Figma state names to CSS pseudo-class reality: `checked`/`on` →
  the `:checked`-driven state; `hover/active/focus/disabled` named to match
  `:hover/:active/:focus-visible/:disabled`. Extension/mode names (default, info,
  critical, …) already match `[data-status]` — verify, don't rename.
- **Capabilities** — introduce capability naming in Figma descriptions (via the
  behaviour/description channel) that matches the YAML `capabilities:` api names
  (ElementInternals, container-query, …). Figma can't model these structurally, so
  they live in the component description, mirrored into the spec.
- **Events** — align Figma-documented events to the ratified unprefixed `noun-verb`
  names (`change`, `*-click`, `*-change`, `*-select`); every event has a matching
  `@fires` in JSDoc and an `events:` entry in the spec. No `sherpa-` prefix.

### 2.3 Mechanics & safety
- Each rename: read Figma binding ground truth first; rename via the plugin API;
  re-export DTCG + re-read extensions; re-project; run build + e2e.
- Record any Figma-vs-code divergence in the component's own spec `$extensions.sherpa`
  divergence block (not only memory).
- Chunk Figma writes per-page/collection (all-pages findAll freezes); small batches.

## Verification
- `component.v1.json` validates every *.component.yaml.
- Round-trip guard: spec → generated files → byte-stable.
- Figma renames: re-projected tokens.css unchanged in value; full reforged e2e green;
  zero dangling var binds after each rename.
- One-vocabulary check: a script cross-references Figma prop/state/event names vs the
  YAML enums vs the data-* used in CSS — flags any name that isn't shared across all three.

## Rollout
1. Publish schema + `{ref}` resolver.
2. Pilot: convert sherpa-switch, prove green.
3. Convert components in the same groups used for the CSS rewrite.
4. Figma naming passes (properties → states → events → capabilities), each synced +
   verified before the next.

## Open decisions
- Is the component spec a private convention (own mini-standard) or do we chase any
  external DTCG-tool interop? (Recommended: private convention; interop is not a goal.)
- Where capability names live in Figma (description channel only vs a dedicated
  metadata collection).
- Whether to keep both thin YAML and the new spec during migration or hard-cut per
  component.
