# Build rules: one sherpa-* component

How to build one component today, in order. Served as `sherpa://rules`. The
RULES are in `docs/PRINCIPLES.md`, by number; this doc gives the steps and the
recipes, and states no rule a second time. A check named here runs in a
sherpa-ui checkout.

---

## Rule 1 — reuse

Before you build a part, look for a component that already does it: run the
MCP's `list_components`, or `npm run map src/components` in a checkout.

- A count → `sherpa-badge` (Figma "Indicator (atom)", Type=count).
- A dismiss → an icon `sherpa-button`.
- A field, a chip, a menu → the real `sherpa-*` element, composed. A look-alike
  built from another component is a defect.

## The five files

| File | Written by |
|---|---|
| `sherpa-<name>.ts` | hand — lifecycle, events, attribute coordination. JS is the last resort |
| `sherpa-<name>.css` | hand — ALL presentation: variants, states, visibility |
| `sherpa-<name>.html` | hand — the shadow template, slots, structure |
| `sherpa-<name>.component.json` | generated: `node scripts/generate-component-spec.mjs <name>`. Never edit it |
| `sherpa-<name>.example.json` | hand — one example as a page writes it, its data, and when to use it (`T-a-component-ships-its-example`) |

## The class

```ts
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';

export class SherpaFoo extends SherpaElement {
  static override css = new URL('./sherpa-foo.css', import.meta.url);
  static override html = new URL('./sherpa-foo.html', import.meta.url);

  // The public attribute surface, DECLARED. Every key is observed.
  static override props = {
    'data-heading': { type: 'string', kind: 'content', to: '.title' },
    'data-status': { type: 'enum', kind: 'style', values: ['info', 'success', 'warning', 'critical', 'urgent'] },
  } as const;

  // Native attributes, and attributes the component handles itself.
  static override observed = ['disabled'];

  override onRender() { /* once: the shadow DOM is ready */ }
  override onConnect() { /* each time it is connected, after the first render; pair it with onDisconnect */ }
  override onDisconnect() { /* stop timers and observers */ }
  override onChange(name: string) { /* an attribute changed */ }
}
define('sherpa-foo', SherpaFoo);
```

- `onRender` runs once. Props are written BEFORE it, and `onChange` still fires
  after.
- A prop's `kind` matches the spec's: `content` (the base class writes the text
  into `to`), `style` (CSS selects on it, and it gets no JS branch),
  `visibility` (presence toggles a CSS rule), `behaviour` (only the component's
  JS reads it), `template` (it picks the template, and is in `variantAttrs`).
- `PropDef` options: `to`, `all` (every match), `accessor` (a boolean's JS
  property, `T-a-flag-brings-the-base-methods`), `as` (`'text'`, `'icon'` or
  `'attr'`, `T-icon-value-takes-two-forms`), `values`, `default`.
- An attribute more than one component declares is in the shared vocabulary in
  `sherpa-element.ts` (`T-the-shared-vocabulary-is-declared-once`). Spread it;
  do not declare it again.
- A `to` target never holds a `<slot>`. Put the text in a span beside the slot,
  and let CSS hide it on `:state(has-<slot>)` (`T-slot-guards-only-when-filled`).
- Keep a write by hand when it is not a plain attribute → text: a selector picked
  at run time, a text template, or a value from something other than the
  attribute.
- A form control sets `static formAssociated = true`; one whose control is
  inside sets `static delegatesFocus = true`. A component answers a button's
  `command` through `static commands` (`T-a-button-commands-by-markup`).
- The build carries each template and sheet inside the JS
  (`T-the-text-is-in-the-js`); a consumer's own files go through `useTemplate`,
  and `SherpaElement.reload(tag)` reloads them live (`T-a-templater-owns-the-files`).
- Reach for the doors on `SherpaElement` before you write the same thing again:
  PRINCIPLES, "The doors".

## The template

- Wrap the content in `<template id="default">`. Every element the component
  will ever show is there from the start (PRINCIPLES 17).
- A repeating item is a prototype, `<template class="…-tpl">`, with no id
  (`T-cloning-prototypes-have-no-id`). Another template is picked with
  `get templateId()`.
- The header comment has three blocks the generator reads: `Public API:`,
  `Slots:` and `Fires:`, one entry per line. A `Fires:` entry's first sentence is
  the event's meaning in the spec; the names come from the code.
- Every slot carries `data-accepts` (PRINCIPLES 12).

## The CSS

Visibility is a host attribute that CSS selects (PRINCIPLES 16):

```css
.icon { display: none; }
:host([data-icon-start]) .icon { display: inline-flex; }
```

- **Disabled:** `:host([disabled]) { cursor: not-allowed; pointer-events: none; }`,
  and the colour is a pin, `'&[disabled]': inactive`, in
  `scripts/figma-data/state-pins.yaml`. Then run
  `node scripts/project-tokens.mjs`. Never `opacity` (PRINCIPLES 3), and never a
  Theme colour: `lint:css` `theme-colour` counts Theme reads per component
  against a baseline that may only fall, and a new component's is 0.
- **Focus:** `box-shadow: var(--sherpa-focus-ring)`, with `outline: none`. Never
  write its value by hand. The ones that differ on purpose: `sherpa-button`,
  `sherpa-progress-step-tracker` and the `sherpa-select-card` tick;
  `sherpa-input-text` and `sherpa-pagination` route it through `--_border-focus`.
- **Responsive:** `:host { container: sherpa-foo / inline-size; }`, then
  `@container sherpa-foo (max-width: 200px) { … }` (PRINCIPLES 5).
- **Colour** binds the Style name Figma binds: `var(--sherpa-style-surface-base)`.
  `base`, `+1` and `+2` are default, hover and down. A state (on, current, open)
  is a pin in `state-pins.yaml`, never a colour rule. A pin works at any depth.
  The `--_status-*` names are the old door (PRINCIPLES 8).
- **Tokens** read `var(--sherpa-x, <its value>)` (PRINCIPLES 20). The cascade
  layers, in order: core, display-mode, theme, layout, structure, border, style,
  elevation, components. Four collections are projected into the component that
  owns them: `structure` into `sherpa-button.css`, `input` into
  `sherpa-input-text.css`, `navigation` into `sherpa-nav.css` and
  `sherpa-nav-item.css`, `switch` into `sherpa-switch.css`.
- **The grids:** 4px for spacing, 2px for text (`T-the-grid-is-two-grids`).
  `lint:css` exempts borders, 1px and below, `999px`, and a px inside
  `var(--token, 12px)`. A drawn glyph opts out with `/* off-grid-ok */`.
- **Shared sheets** are adopted by every shadow root: `sherpa-base.css`,
  `sherpa-typography.css`, `sherpa-grouping.css` (`.sherpa-group*`,
  `.sherpa-border-edges`, `.sherpa-border-corners` — never write the per-edge
  chain), `sherpa-icon.css`, `sherpa-group-positions.css`,
  `sherpa-style-modes.css`, `sherpa-anchor.css` (`.sherpa-tip`, `.sherpa-anchor`,
  `.sherpa-anchor-point`) and `sherpa-motion.css`. A family sheet is listed first in a
  component's `static css`: the chart frame, chart axes, chart segments and
  container regions sheets in `src/core/`.

## Events

- `this.emit(name, detail)` sets `bubbles` and `composed`. Only a component's
  own events leave it (PRINCIPLES 18).
- A name is `noun-verb`. A re-dispatched native event keeps its native name.
- An `@fires` tag does nothing. A `document.dispatchEvent` broadcast is the one
  case where `bubbles` does not matter.

## What the generator reads

- Events: what the code emits — `emit()`, `new CustomEvent`, `new Event` — and
  each `Fires:` entry's meaning (`T-an-event-name-is-not-always-a-literal`,
  `T-a-constructed-event-is-not-a-dispatched-one`). An event's detail is typed
  by TypeScript's checker (`T-a-detail-is-typed-by-the-checker`).
- Props: a bare (non-`data-*`) `Public API:` name must be used in the code
  (`T-a-bare-name-must-be-used-not-mentioned`). A default is read where the
  header marks it — `md (default)` — and kept only if it is a value of the type.
- Anatomy has three forms: `root`, `roots` (two or more sibling roots) and
  `byTemplate` (templates that are different trees). A composed child is a node
  whose `el` is a `sherpa-*` tag.
- `npm run spec:check` has three halves: validate, round-trip and fresh.
  `node scripts/resync-figma.mjs --check` reports drift from Figma.

## Figma

Names as exported on 2026-09-09; confirm them in the file before a build.

- **Rule 2 — text binds variables.** Every text node binds Theme
  `content/{font, size, line-height, weight, letter-spacing, paragraph-spacing}`
  and a content fill. Never a raw font value.
- **Rule 2a — a role's text style is canonical.** A new variant reuses the text
  style the default variant gives each role (label, value, description); a
  variant changes arrangement, not a role's type. In CSS, style a role in one
  place and let every template inherit it.
- **Rules 3 and 4 are retired.** A colour binds the Style name Figma binds
  (PRINCIPLES 8).
- **Rule 5 — verify an icon swap** by its main component's name, not a screenshot.
- **Rule 6 — a Button keeps its Structure bindings** (`height`, `icon-size`,
  `structure-space/padding` and `gap`, `structure-font/size` and `line-height`)
  and is sized by the Structure mode: 2xs, xs, sm, default, lg, xl. Never HUG it,
  and never give it a raw px.
- **Rule 7 — a mode pin does not reach a nested instance's own bindings.** Pin
  the mode on the instance itself, and never resize an instance away from its
  natural size.
- **Rule 8 — every property binds the variable that resolves to its value.** The
  scale is Display Mode's `space/*`, `border/rounding/*` and `border/width/*`.
  Bind a stroke only where a stroke exists, skip an off-scale value, and never
  touch an instance's internals. The MCP's `token_for` and `check_bindings`, and
  `scripts/audit-bindings.mjs`, do it.
- An override collection is keyed by its parent's mode ids
  (`T-an-override-collection-is-keyed-by-its-parent`).

## Check it

In a checkout: `npm run type-check`, `npm run lint`, `npm run lint:css`,
`npm run spec:check`, `npm run check:props`, `npm run check:ownership`,
`npm run check:traps`, `npm run check:map`, `npm run check:size` and
`npm run test:a11y`. Then `npm run manifest` and `npm run reference`.

## With the MCP

`list_components` → `scaffold_def` → `validate_def` → `compile_def` → finish
the three files by hand → the spec generator → write `.example.json`.
