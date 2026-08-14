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

**Status:** flagged as a real component bug to fix in sherpa-button's Figma bindings +
its CSS (`content` should resolve via a control/status-aware chain, not `status-content`
directly). Until fixed, any component that nests a secondary Button under status
inherits the bug.

---

## Rule 5 — Icon-swap must target the intended glyph AND be verified

The dismiss button showed a **tick, not a cross**. The instance's default icon is a
tick; swapping to `cross` must (a) target the correct component (the `cross` set's
variant, not the set node), and (b) be **read back** to confirm. Screenshot is not
enough — assert the swapped instance's mainComponent name is `cross`.

---

## Rule 6 — Mode pins do NOT cascade into nested instances automatically

The status dot Tag didn't tint because a `Status` mode pinned on the **parent** does
not automatically drive a nested **instance's** own bound variables — the instance
resolves modes in its own context. To tint a nested instance by status, pin the
`Status` mode **on the instance** (or use a component whose default already reads the
inherited mode). Also: do not `resize()` an instance away from its component's natural
size (the dot was force-sized to 10px, overriding its real dimensions).

---

## The meta-lesson

The pipeline builds **structure** correctly (nodes, variants, nesting, scope-checked
binds). What it got wrong was **design-system fidelity**: which component to reuse,
binding text vars, the alias-through-status model, and mode inheritance. These are
ontology/knowledge concerns — encoded here and in the ontology so the next build is
right by construction.
