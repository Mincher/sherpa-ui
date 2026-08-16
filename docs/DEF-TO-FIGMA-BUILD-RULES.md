# def → Figma Build Rules (lessons from the proofs)

> Hard rules for building a component in Figma from a def. Each was learned from a
> real defect in the alert-card / pill-counter proofs. The build-figma skill's
> gates catch *structural* faults; these catch *design-system* faults.

---

## Rule 1 — Reuse the existing component; never invent a primitive

Before building a sub-part, **search the Figma file for a component that already does
it**. The alert-card wrongly used a Tag for a count and a Tag for a status dot — when
**Badge** already exists with exactly `Type=count` and `Type=dot`.

- A count indicator → **Badge `Type=count`** (not a Tag with a number).
- A status dot → **Badge `Type=dot`** (not a collapsed Tag).
- A dismiss → an icon **Button** (already the shared pattern).

Checklist: for every leaf role (count, dot, avatar, chip, dismiss, field…), grep the
component list first. Inventing a look-alike from a different component is a defect.

---

## Rule 2 — Text MUST bind variables; never raw font values

The alert-card set raw `fontSize`/`fontFamily`/`fontWeight` on its text — **zero
Typography bindings**. **This file has NO local text styles** (`getLocalTextStylesAsync`
= 0) — text is styled by binding **Typography variables directly**. Every text node
must bind all six + a fill (the pattern the real Tag/Button use):

```js
node.setBoundVariable('fontSize',       V('Typography','size'));
node.setBoundVariable('lineHeight',     V('Typography','line-height'));
node.setBoundVariable('letterSpacing',  V('Typography','letter-spacing'));
node.setBoundVariable('paragraphSpacing',V('Typography','paragraph'));
node.setBoundVariable('fontFamily',     V('Typography','family'));
node.setBoundVariable('fontWeight',     V('Typography','weight'));
bindFill(node, V('Style (Sherpa)','content/title/base'), {…});  // per role
```

Size/weight vary by text style via the **Typography mode** (h1…h5, default/emphasised/
light × sizes) — pin the Typography mode on the text node/frame for the intended style.
Never literal font numerics. Gate: read back `boundVariables` (fontSize/fontFamily/…)
and `fills[0].boundVariables` on every TEXT node.

### Rule 2a — A ROLE's text style is canonical; reuse it, never re-invent it per variant

A **role** (a field's label, its placeholder/value, a description, a helper) has ONE
canonical text style — a specific Typography mode + a specific content fill. When you add
a **new variant** of a component (e.g. a "minimal" Input), its label/value/etc. must reuse
the **same** mode + fill the existing/default variant already uses for that role. A variant
changes *arrangement* (layout, which parts show, borders), **not** the typography of a role.

Concrete failure (Input minimal variant, 2026-08-16): the minimal field's label was given
`content/secondary` + no mode pin and its placeholder `content/secondary`, when the field's
canonical roles are **label → Typography `emphasised/sm` + `content/label/base`** and
**placeholder/value → Typography `default/base` + `content/tertiary/base`**. Result: the
same role looked different across two variants of one component.

How to get it right:
- **Read the default/existing variant's text node first** and copy its Typography mode +
  fill for each role. In Figma the fastest correct move is `minimalLabel.fills =
  defaultLabel.fills` (carries the bound variable byref) + pin the same Typography mode.
- In **code**, style by role in ONE place (`.label {…}`, `.control {…}`) and let every
  template/variant inherit it. Do **not** add per-variant `font-size`/`font-weight`/`color`
  overrides — a variant rule should only touch layout (`flex-direction`, `gap`, `flex`,
  borders). If you're writing `font-*` or a content `color` inside a `.variant-x .role`
  selector, stop — you're diverging a role's style.
- Gate: read back the new variant's per-role fill + Typography mode and assert they EQUAL
  the default variant's for the same role.

Canonical field-role text styles (Input, reuse everywhere a field appears):
| role | Typography mode | fill |
|---|---|---|
| label | `emphasised/sm` | `content/label/base` |
| description | `default/sm` | `content/secondary/base` |
| value / placeholder | `default/base` | `content/tertiary/base` |
| validation message | `default/sm` | status/critical text |

---

## Rule 3 — Status containers bind container-* tokens that alias THROUGH status

A status-tinted **container** should bind its own `container-surface/*` /
`container-border/*` tokens and let those resolve to the status colour via the mode
cascade — **not** bind `status-surface/*` directly. (The real Callout binds
`status-surface` directly today; that is the *current* state, but the intended model
is container tokens that alias through status, so the container's own semantics stay
intact and only the tint changes.) A **control** (button/tag) is the exception — it
binds `status-*` because status IS its surface.

Rule of thumb: bind the **nearest component-scoped token** (`container-*`, `control-*`),
which aliases upward through Status — do not reach past it to `status-*` unless the
component has no scoped token for that property.

---

## Rule 4 — Content colour must flip with the look tier (the Button bug)

**Confirmed defect in shipped sherpa-button:** a secondary/tertiary Button placed in a
`Status` context renders **light text on a light surface** — unreadable. Cause: the
button label binds **`status-content/primary`** directly. Under a status pin that
token resolves to the on-color (light) ink meant for text *on a saturated fill* — but
a secondary button has a *light* surface, so the text vanishes.

The label must bind a **control-aware** content token that flips with the Control look
tier: on a filled (primary) surface → on-color/light ink; on a light (secondary/
tertiary) surface → dark ink. Binding `status-content/*` straight bypasses that flip.

**FIXED (Figma side).** Root cause was a **Figma⇄code DIVERGENCE**:
- **CSS** (`sherpa-button.css`) was already correct — it has NO status handling; each
  variant sets `--_content` per look tier (secondary → `control-content-default` = dark).
  A button's label colour is status-INDEPENDENT in code, flipping only by variant.
- **Figma** had wired the label/icon to `status-content/primary` (status-dependent),
  which broke under a status pin on a light secondary surface.

Fix: repointed the Button's default-state label + icons from `status-content/primary`
→ **`control-content/default`**, which resolves correctly per Control mode (light
on-color on a filled primary; dark on a light secondary/tertiary). Verified: secondary/
primary/tertiary buttons in a Status=info context all read correctly. Now Figma matches
the CSS: button label colour flips by look tier, not by status.

**Lesson:** a button's TEXT is not status-tinted — only its SURFACE/BORDER are (and
only for a filled primary in a status context). Bind control-content, never
status-content, for control labels. This is a case the two-way sync must reconcile:
the CSS was the correct source of truth.

---

## Rule 5 — Icon-swap must target the intended glyph AND be verified

The dismiss button showed a **tick, not a cross**. The instance's default icon is a
tick; swapping to `cross` must (a) target the correct component (the `cross` set's
variant, not the set node), and (b) be **read back** to confirm. Screenshot is not
enough — assert the swapped instance's mainComponent name is `cross`.

---

## Rule 6 — A Button ALWAYS binds the Button size variables (size mode must work)

The alert-card's nested action/dismiss buttons were force-set to HUG/auto vertical
sizing, which **dropped the `height` binding to `Button::button-size/height`**. Once a
button's height (or padding/gap/icon) is not bound to the Button collection, its **size
mode (2xs…3xl) can no longer drive it** — pinning `Button = sm` does nothing.

Rule: a Button instance's geometry MUST stay bound to the Button size collection:

| Property | Bind to |
|---|---|
| height | `Button::button-size/height` (vertical sizing = FIXED, so the var drives it) |
| paddingLeft/Right | `Button::button-space/padding` |
| itemSpacing (gap) | `Button::button-space/gap` |
| icon width | `Button::button-size/icon` |
| label fontSize/lineHeight | `Button::button-font/size` / `button-font/line-height` |

Then set the size by **pinning the Button collection mode** (`2xs`/`xs`/`sm`/`md`/`xl`/
`2xl`/`3xl`) on the instance — the bound vars re-value per mode and the button resizes.
NEVER HUG a button's height or hard-set a pixel height; that severs the size system.
Gate: read back `instance.boundVariables.height` points at `Button::button-size/height`
AND the Button collection is mode-pinned to the intended size.

---

## Rule 7 — Mode pins do NOT cascade into nested instances automatically

The status dot Tag didn't tint because a `Status` mode pinned on the **parent** does
not automatically drive a nested **instance's** own bound variables — the instance
resolves modes in its own context. To tint a nested instance by status, pin the
`Status` mode **on the instance** (or use a component whose default already reads the
inherited mode). Also: do not `resize()` an instance away from its component's natural
size (the dot was force-sized to 10px, overriding its real dimensions).

---

## Rule 8 — EVERY property binds a variable if a relevant one exists

The discipline rule. A component's geometry — gap, padding, radius, stroke-width —
must **bind the token that resolves to its value**, never a raw number. Component
definition and creation must be meticulous about this.

Resolution (source of truth: `scripts/audit-bindings.mjs`):
- Map by **resolved pixel value**, not a name (semantic tokens are aliased —
  `space/sm` resolves to 12, it isn't literally "12").
- Prefer the component's **own scoped token** (`Button::button-space/*`,
  `Container::container-space/*`); else the **Core** scale (`space/*`,
  `border/rounding/*`, `border/width/*`).

Safety (a naive value-match over-binds ~13×, so these are mandatory):
- Bind stroke-width **only where a stroke paint actually exists** — never on a
  strokeless layout frame.
- **Skip off-scale values** (radius 1, radius 5 have no token — leave them; they
  are a scale gap or intentional, not a violation).
- Never touch **instance internals** — they inherit from their main component.

Audit: `scripts/audit-bindings.mjs` holds the value→token maps + `shouldBind()`.
A full pass over the built components found **297 real violations** (down from a
naive 4131 of false positives) and bound **245** cleanly (0 errors, 0 visual
change — the tokens resolve to the same pixels). After the pass: **0 remaining**.

---

## The meta-lesson

The pipeline builds **structure** correctly (nodes, variants, nesting, scope-checked
binds). What it got wrong was **design-system fidelity**: which component to reuse,
binding text vars, the alias-through-status model, and mode inheritance. These are
ontology/knowledge concerns — encoded here and in the ontology so the next build is
right by construction.
