# Sherpa-UI — The Variation System

How Sherpa represents variation in Figma: when to use **Variable Modes**, **Extended
Collections**, or **Component Variants**. This is the authoritative rule set. It exists
because the same concept (interaction state, especially) was being modelled three
different ways, which produced churn, collection sprawl, and an avoidable explosion of
component variants.

**One-line policy:** *Variation is data until it can't be. Model it with tokens (modes /
extensions) by default; promote it to a component variant only when a variable must drive
it or the node-tree itself must change.*

**Second policy (equal weight): keep the node tree lean.** Every mechanism choice is also
a layer-count choice. Layers that ship in *every* instance — whether or not they're
used — compound into file-wide performance cost. A correct-by-the-rules component can
still be a bad component if it drags dead layers. See Part 0.

---

## Part 0 — Layer complexity is a first-class constraint

Mechanism correctness and **layer economy** are two independent axes, and a good component
satisfies both. The mechanism rules (Parts 2–5) answer *"modes, extension, or variant?"*.
They do **not** answer *"how many nodes does each instance carry?"* — that is this part's
job, and it can override a mechanism choice.

**Why it matters:** a hidden layer is not free. It is authored, cloned into every instance,
walked on every render/selection, and counted in file size. Five hidden icon subtrees on
one input × thousands of inputs in a real product file = measurable slowdown. Modes and
extensions **cannot** fix this — they drive *values*, never structure; a mode cannot make a
layer exist or not. Only **structure** changes layer count.

**The rule — minimise always-present layers:**

1. **Do not pre-place N adornments and hide them.** If a component can show one of several
   optional sub-elements (icons, buttons, badges), do **not** bake all of them in as
   hidden layers toggled by booleans. That is the single most common source of bloat.
2. **Prefer one swappable slot over N pre-placed options.** A single instance-swap slot
   (leading / trailing) that the consumer points at the right glyph costs **one** subtree,
   not one-per-option. This is the default for "same position, different icon" families.
3. **Prefer empty slots + composition for optional structure.** A component with an empty
   slot carries **zero** layers for that region until something is dropped in. Best when the
   optional content is itself a component (an adornment, an action button, a stepper group).
4. **A boolean `hasX` is fine for a *single* always-relevant sub-element** (e.g. one
   `hasDescription` line) — the cost is one layer and it's usually shown. It becomes an
   anti-pattern when it's one of *many* mutually-exclusive pre-placed options.
5. **Count the resident layers, not just the variants.** When reviewing a component, ask:
   *how many nodes does a default instance carry that a given use won't need?* Drive that
   number toward zero.

**Interaction with the variant-minimisation rule:** these can pull in opposite directions —
avoiding variants can tempt you to pre-place-and-hide (bloat), while avoiding bloat can
tempt you toward more variants (matrix explosion). Resolve it with the mechanism hierarchy
*plus* the layer rule: **swap slots and empty slots satisfy both** — they neither add
variants nor carry dead layers. Reach for them first. Only when a swap/slot genuinely can't
express the difference do you fall back to a variant (structural) — and even then, keep the
per-variant tree minimal.

**Worked example — Input (2026-08-07).** The input family (search/date/time/select/number/
password) was first built as 7 variants (variant explosion), then collapsed to one
component with 5 pre-placed hidden adornment icons + 4 `hasX` booleans (layer bloat: 12
layers in the field, 10 of them dead in any given use). Both were wrong on a different
axis. Final form: **two swappable icon slots** (`icon-leading`, `icon-trailing`) + show/hide
booleans — the field dropped to 6 layers, types are reached by swapping the glyph, and no
per-type variants exist. Correct on *both* axes: no variant explosion, no dead layers.

---

## Part 1 — Reassessment of the current library

Snapshot (18 base collections + 15 extensions):

**Foundations (correct, leave alone)**
Primitives · Alias · Apex 2.0 (Light/Dark) · Density · Typeface · Icon · Elevation.

**Semantic look-tier collections (the strong pattern — keep)**
- `Controls` (modes Default/Active/Inactive) + exts primary/secondary/tertiary/tertiary-on-color
- `Status` (modes Filled/Outline) + exts info/critical/warning/urgent/success
- `Containers` (modes default/anchored-left/anchored-right) + exts primary/secondary/tertiary + app-primary/secondary/tertiary

**Component-scoped collections (inconsistent — the problem area)**

| Collection | Holds | Verdict |
|---|---|---|
| `Nav Item` | surface/content/icon over Default/Active/Inactive **modes** | ✅ correct — state as modes |
| `Button` | 4 size vars over size **modes** | ✅ correct — size as modes |
| `Tag` | fill/border/content/size over default/outlined **modes** | ⚠ "outlined" is a look tier — should be a Tag *extension* or a Status-style axis, not a mode of the scoped collection |
| `Nav Container` | 14 vars, state as **4 extensions** (collapsed/hover/pinned/settings) | ⚠ state modelled as extensions — inconsistent with the mode canon, but justified (see §4, it's the one variable-driven multi-property state machine) |
| `Switch` | 15 state-colour vars (fill/active, fill/inactive, text/active…) flat, state expressed in **12 variants** | ❌ worst offender — state baked into both flat vars AND variants |
| `Checkbox` / `Radio` | now **3 variants** each (State axis) | ❌ freshly over-inflated — state should cascade via Controls modes |
| `Callout` / `Accordion` | geometry only | ✅ fine |

**The core defect:** interaction **state** is modelled as *modes* (Controls, Nav Item),
*extensions* (Nav Container), and *variants* (Switch, Checkbox, Radio) — three mechanisms
for one concept. No rule existed, so every component was solved ad-hoc. The recent pass
made this worse by adding state **variants** to Checkbox/Radio/Switch that met neither
condition for a variant.

---

## Part 2 — The three mechanisms

| | Variable Mode | Extended Collection | Component Variant |
|---|---|---|---|
| **Is** | a values column on a collection | a child collection re-valuing inherited vars | a distinct node-tree in a set |
| **Add-a-value cost** | one value | one override | author a whole tree |
| **Combinatorial?** | No (orthogonal, free at render) | No (pin one) | **Yes** — axes multiply |
| **Variable-bindable?** | **No** (mode pins are static) | **No** (extension pins are static) | **Yes** — a variant property is the *only* variable-drivable variation |
| **Cascades through nesting?** | Yes | Yes | No |

Two load-bearing facts (verified this build):
1. `setExplicitVariableModeForCollection` takes a literal mode id — **modes and extension
   pins can never be bound to a variable.**
2. **A VARIANT property is the only variation a variable can drive** (via
   `setProperties({Axis: createVariableAlias(v)})`).

Therefore the pivotal question for any variation is: **"must a *variable* switch this?"**
If no → it's a mode or an extension. If yes → it must be a variant.

---

## Part 3 — The decision rule (canonical)

Ask in order; stop at the first match.

1. **Global rendering context** (light/dark/HC, density) → **Mode** on a foundation
   collection. Never variants/extensions. (Apex 2.0 gets no new modes beyond theme.)
2. **A re-usable look tier** that re-values shared tokens the same way for many
   components (control look primary/secondary…, status info/critical…, container/app
   surfaces) → **Extended Collection**. New tier = one extension, never N variants.
3. **Interaction / selection state** (default/active/inactive, hover/pressed) →
   **Mode** (the Controls cascade). Default answer. Zero variants; inherits for free.
4. **Size / density step** → **Mode** on the component's scoped collection.
5. **The variation must be driven by another variable** (component A's state follows
   collection/component B's value) → **Component Variant**, smallest possible axis, bind
   the variant property to the driver. *This is the only case that forces a variant.*
6. **Genuine structural / content / layout difference** no token can express (Label vs
   Icon-only; Full vs Dot; a slot that appears or not) → **Component Variant**.

Reach the end with no match → you need a token binding with a fallback, not a new axis.

---

## Part 4 — Rules for interaction STATE (the canon)

**State is a Variable Mode by default.** Every interactive control expresses
default/active/inactive/hover/… through the **Controls mode cascade** (or its own scoped
collection's Default/Active/Inactive modes if it overrides). It carries **zero state
variants** and inherits state for free.

**Promote state to a variant only when a variable must drive it (rule 5).** Add a single
`State` variant axis, and bind that property to the driver variable. Keep the axis minimal
(the states actually needed), and do not add a second variant axis for it.

**Extensions-for-state is allowed only for a multi-property state machine that (a) varies
many properties at once and (b) is switched as a unit per instance** — e.g. `Nav
Container` (collapsed/hover/pinned/settings each re-value width + shadow + labels +
surface together). This is a deliberate exception, not a pattern to copy for simple
controls. A plain control's active state is a *mode*, never four extensions.

---

## Part 4b — Naming standards (modes, extensions, size scales)

Standardised 2026-08-07. Renaming a mode or collection **preserves its ID**, so all
aliases and node bindings follow automatically — these are safe to enforce retroactively.

- **Mode names: `lowercase-kebab`.** `default`, `active`, `inactive`, `light`, `dark`,
  `compact`, `filled`, `outline`, `anchored-left`. No Title Case, no `Mode 1`. Single-mode
  collections use `value`.
- **Extension collection names: `lowercase-kebab`.** `primary`, `tertiary-on-color`,
  `app-primary`, `collapsed`, `settings`, `outlined`, `info`, `critical`.
- **Interaction-state modes are exactly `default` / `active` / `inactive`** (a control
  that overrides state via its own scoped collection uses these three, matching Controls).
- **Size steps: the abbreviated t-shirt scale** — `2xs` `xs` `sm` `md` `lg` `xl` `2xl`,
  with `base` as the neutral default step and `none` for zero. Matches the Alias
  `space/*` and `size/*` token scale. Do **not** spell out (`x-small`, `large`).
- **Status modes: `filled` / `outline`.** **Anchor modes: `default` / `anchored-left` /
  `anchored-right`.** **Elevation modes: `none` / `sm` / `md` / `lg`.**

### Variable names *within* a collection

- **Background colour term by tier:** semantic-tier collections (Controls, Containers,
  Status) use **`surface`**; component-scoped collections (Tag, Switch, Nav, …) use
  **`fill`**. One term per tier — never mix within a tier.
- **`/default` suffix rule:** a colour leaf gets a state suffix (`/default`, `/hover`,
  `/down`, …) when its state is expressed by **name siblings** *or* it is a single-value
  leaf (`tag-fill/default`, `controls-border/default`). A variable whose state lives in a
  **mode axis** (e.g. `nav-item-surface`, resolved by the Nav Item default/active/inactive
  modes) stays **bare** — the mode *is* the state; a `/default` name would double-encode
  it. **Rule: state is encoded once — in the name OR in a mode, never both.**
- **Prefix:** post-Apex collections prefix vars with the kebab collection name merged into
  the first segment (`nav-item-surface`, `button-size/height`). Foundations
  (Primitives/Alias/Apex 2.0/Density/Typeface/Icon/Elevation) stay unprefixed.

## Part 5 — Rules for component-scoped collections

**Create a component collection only when the component has:**
- values it must **override** from Controls/Containers/Status in one or more modes, or
- an **enum axis best modelled as modes** (size steps, a component-specific state set).

**A component collection MAY hold:** size/space/geometry values; component-specific
overrides of inherited semantic tokens; a scoped state axis *as modes*.

**A component collection MUST NOT:**
- **duplicate a look tier** that already exists as an extension (bind/pin the extension
  instead — don't re-declare primary/secondary surfaces locally);
- **hold flat per-state colour variables** like `fill/active` + `fill/inactive` side by
  side (that's state — put it on a Default/Active/Inactive **mode** axis so one variable
  carries all states);
- **exist for a component that only consumes** foundation/semantic tokens unchanged (no
  collection needed — bind directly).

**Naming:** post-Apex collections prefix vars with the collection name
(`nav-item-surface`, `button-size/height`). Foundations stay unprefixed.

---

## Part 5b — When NOT to build a component (composition over creation)

The atomic components (Container, List Item, Button, Input, Tag …) are the vocabulary.
Many "components" people expect to build are really just **an existing container holding
existing atoms** — a specific composition, not new structure. Do **not** build a bespoke
component for these; assemble them from what exists.

**Test:** *Can this be built by putting existing components inside an existing container,
with no new node structure of its own?* If yes → it is a **composition (a pattern /
template)**, not a component. Building it as its own component duplicates structure and
creates a second thing to maintain in lockstep with its parts.

**The list family are all Container + List Item:**

| "Component" | Really is |
|---|---|
| **List** | a Container holding a vertical stack of List Items |
| **Menu** | a Container (elevated, via Elevation mode) holding List Items + dividers |
| **Overlay Item** | a List Item (or a List Item inside a floating Container) |
| **Select Group / dropdown results** | a Menu = Container + List Items |
| **Transfer List** | two Lists (Containers + List Items) side by side |
| **Key Value List** | a Container + List Items (label = key, trailing = value) |
| **Tree** | a Container + List Items with indent (indent via wrapper padding, as Nav does) |

None of these need a new component. They differ only by **which container variant /
elevation is pinned** and **what is stacked inside** — both consumer choices. Build them as
**patterns/examples** (a composed instance on the page for reference), or leave them to be
assembled in product files. Reserve a real component only if a genuinely new node structure
or a variable-driven behaviour emerges that Container + List Item can't express.

**BUT — componentise recurring, codebase-mirrored compositions.** A composition still
earns its own component when it is a **named, recurring unit that also exists as a component
in the codebase** (`sherpa-list`, `sherpa-menu`, `sherpa-tree`). Wrapping it makes it
instantiable in one drop instead of hand-assembled every time — the same reason Toolbar is a
component despite being a slotted Container. The rule is about *one-offs vs recurring units*,
not about forbidding composition-based components:

- **One-off arrangement** (a specific screen's particular row of stuff) → compose inline,
  no component.
- **Recurring, named, codebase-backed unit** (List, Menu, Tree, …) → **build it as a
  component** whose internal structure IS the composition (a Container that stacks List Item
  instances / exposes a content slot). It reuses the atoms internally; it does not
  re-implement them.

**Consequence for the backlog:** List / Menu / Tree / Select Group / Transfer List / Key
Value List / Overlay Item **are** build targets — but each is built *by composing* Container
+ List Item (stack them, or expose a slot the consumer fills with List Items), never by
re-drawing rows. The component is a thin, instantiable wrapper over the atoms.

---

## Part 6 — Remediation (COMPLETED 2026-08-07)

The misfits identified in the reassessment have been fixed. Recorded here as the
worked precedents for the canon.

1. **Switch — DONE.** Dropped the redundant `Interaction=default/active/inactive` variant
   axis (**12 → 4 variants**: Style × State-On/Off). Those 8 variants only pinned a
   Controls mode, so interaction state now cascades via Controls modes for free. The
   `switch-fill/active|inactive`, `switch-text/*` vars **stay** — they drive the **On/Off
   toggle** (a legitimate structural variant, rule 6), which is *not* interaction state.
2. **Checkbox / Radio — DONE.** Reverted from `State` variant sets back to single
   components (**3 variants → 1 each**). Active/inactive cascade via Controls modes +
   `isChecked`/`isFilled` booleans.
3. **Button — DONE (kept as the sanctioned rule-5 exception).** Button retains a minimal
   `State`=default/active/inactive variant axis *because* it is variable-driven — the nav
   gear/pin buttons bind that property to a Nav Container driver var. This is the
   canonical rule-5 case, documented here so it reads as intentional, not a misfit. (Chose
   this over a separate nav header-button component to avoid churn.) Cleaned a stray
   `Contents` mode pin off the Label variants.
4. **Tag `outlined` — DONE.** The scoped `outlined` *mode* is now an `outlined`
   **extension** of the Tag collection (re-values `tag-content` → neutral, `tag-size/icon`
   → sm). Tag base is a single `Value` mode. Look tiers are extensions, per §3 rule 2.
5. **Nav Container — left as-is.** The sanctioned rule-5 multi-property state machine
   (collapsed/hover/pinned/settings as extensions). Documented exception; do not copy for
   simple controls.

**Build gotcha worth remembering:** `collection.extend()` inherits the parent's *current*
modes, and a figma_execute script is **atomic** — a single script that renamed/removed
modes *and* called `extend()` silently rolled back on a mid-script throw. Working order:
`extend()` first → re-value the extension → *then* collapse the base modes.

---

## Quick reference

```
Theme / density                      → Mode (foundation)
Reusable look tier (re-values tokens)→ Extended Collection
Interaction / selection state        → Mode (Controls cascade)      ← DEFAULT for state
Size / density step                  → Mode (scoped collection)
Multi-property state switched as unit → Extension (Nav Container only, documented)
State must be VARIABLE-DRIVEN         → Component Variant (minimal axis)  ← only forced case
Structural / content / layout change → Component Variant

When unsure: it's a mode. Variants are the exception, not the rule.

THEN check layer economy (Part 0):
  Optional sub-element, 1 of several  → ONE swappable slot (not N hidden layers)
  Optional structure / component      → EMPTY slot + composition (0 resident layers)
  Single always-shown sub-element     → hasX boolean is fine
  Never pre-place-and-hide N options.  Drive dead layers toward zero.
```
