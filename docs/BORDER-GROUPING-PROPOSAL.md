# Border grouping — recommended structure

> **Status 2026-09-14: REBUILT as EXTENSIONS.** Will's call — position is the COLLECTION,
> modes stay Border's sizes. **15 extension collections**, one pin per node. The standalone
> `Group H` / `Group V` were an interim step and are deleted. See *Final structure* at the end.

Assessment of the Border collection and its `group-*` extensions, and the structure that
supports grouping items into **rows, columns and grids** with correct radius and width.

Written for: Will, deciding the Figma variable structure before rebuilding it.

All findings below were tested live in the Figma file with throwaway collections and probe
frames, then cleaned up. The *assessment* changed nothing; the **build** that followed is
recorded under *Migration status* at the end.

---

## What is there now

`Border` (8 variables × 7 size modes: `default 2xs xs sm lg xl none`) plus **13**
`group-*` extension collections, each mirroring all 8 variables × 7 modes:

```
group, group-left, group-right, group-top, group-bottom,
group-top-left, group-top-right, group-bottom-left, group-bottom-right,
group-row-left, group-row-right, group-column-top, group-column-bottom
```

**728 mode-cells across 13 collections**, chained up to **4 levels deep**:

```
group-top-left  →  group-left  →  group  →  Border
```

`group` itself halves every width (0.5 → 0.25) and squares every corner.

### The three problems

1. **It cannot express the most common case.** There is no `middle` — an item with
   neighbours on *both* sides. Every real toolbar, segmented control and grid is mostly
   middles.
2. **Position is enumerated, not derived.** 13 collections name 12 positions and still
   miss 4 of the 16 possible states. Adding grid support the same way needs 9 more.
3. **One pin per lineage.** Figma allows a node only **one** pin per collection lineage —
   verified: pinning `group` *replaced* the `Border` pin. So every `group-*` must
   re-declare all 7 size modes, which is where 728 cells comes from. Chaining deeper
   compounds it.

---

## The insight

A grouped item's borders are decided by **which edges it shares with a neighbour**. That
is two independent questions:

- **Horizontally** — is there a neighbour to my left? to my right?
- **Vertically** — is there a neighbour above? below?

Four states per axis: `solo`, `start`, `middle`, `end`.

**4 × 4 = 16 — every possible state.** A row is just *vertical = solo*. A column is
*horizontal = solo*. A grid cell is any combination. There is no separate row / column /
grid concept to model; they all fall out of two axes.

Corners follow with no extra data: **a corner is round only when both of its edges are
outer.**

| V ↓ H → | solo | start | middle | end |
|---|---|---|---|---|
| **solo** | ▢ all round | ◖ left round | ▭ square | ◗ right round |
| **start** | ◓ top round | ◜ top-left | top edge only | ◝ top-right |
| **middle** | ▭ square | left edge only | fully square | right edge only |
| **end** | ◒ bottom round | ◟ bottom-left | bottom edge only | ◞ bottom-right |

---

## Recommended structure

Replace all 13 `group-*` collections with **two**, one per axis:

```
Border                     (unchanged — 8 vars × 7 SIZE modes)
  └── Group H              4 modes: solo · start · middle · end
        └── Group V        4 modes: solo · start · middle · end
```

`Group H` aliases `Border`. `Group V` aliases `Group H`. A component pins **Border** for
its size and **Group H** / **Group V** for its position — three pins, three questions,
independent.

**64 cells across 2 collections, chain depth 1 each.** Down from 728 across 13.

### What each collection holds

`Group H` owns the horizontal edges and passes the rest through:

| variable | solo | start | middle | end |
|---|---|---|---|---|
| `border/left` | → Border | → Border | → Border | → Border |
| `border/right` | → Border | **0** | **0** | → Border |
| `border/top` `border/bottom` | → Border | → Border | → Border | → Border |
| `rounding/top-left` `rounding/bottom-left` | → Border | → Border | **0** | **0** |
| `rounding/top-right` `rounding/bottom-right` | → Border | **0** | **0** | → Border |

`Group V` has the same shape on the vertical axis, but **aliases `Group H`** rather than
`Border` — so a pass-through in V inherits whatever H decided:

| variable | solo | start | middle | end |
|---|---|---|---|---|
| `border/top` | → Group H | → Group H | → Group H | → Group H |
| `border/bottom` | → Group H | **0** | **0** | → Group H |
| `border/left` `border/right` | → Group H | → Group H | → Group H | → Group H |
| `rounding/top-left` `rounding/top-right` | → Group H | → Group H | **0** | **0** |
| `rounding/bottom-left` `rounding/bottom-right` | → Group H | **0** | **0** | → Group H |

**Components bind to `Group V`** — the end of the chain. It resolves through H to Border,
so one binding picks up all three pins.

### Why the corner logic needs no extra work

A corner variable set to `0` in either axis stays `0`; set to pass-through in both, it
reaches Border's real radius. That is a logical AND, produced by aliasing alone.

**Verified live** (scratch collections, since removed) — `rounding/top-left` with V
chained to H chained to Border:

| | H = outer | H = inner |
|---|---|---|
| **V = outer** | **4** ✅ | 0 |
| **V = inner** | 0 | 0 |

Round only when both are outer. Exactly right, and it scales to all four corners.

### Why the size pin still works

Also verified live: a variable in a separate collection that aliases Border **tracks the
node's Border pin**.

| | `Border = 2xs` | `Border = default` | `Border = xl` |
|---|---|---|---|
| pass-through | 2 | 4 | 8 |
| `0` | 0 | 0 | 0 |

Size and position stay independent. Pin `Border = xl` and `Group H = middle`, and you get
xl widths with square left/right corners.

---

## Two decisions to make

### 1. Should a shared edge be halved, or should one side own it?  ✅ DECIDED: one side owns

Today's `group` halves every width (0.5 → 0.25) so two neighbours sum to one full border.
That is correct only when items sit **flush** — and `structure-space/snapped` is `0`, so
they do.

The alternative is **one side draws the full border, the other draws none** — `end` and
`middle` keep their left edge, `start` and `middle` drop their right edge. Advantages: the
drawn width always equals the token (no `0.25px` values, which fall below the sub-pixel
floor and which `lint:css` treats as stroke-only); and it survives a non-zero gap.

**Will's call: one side owns it** — this is what was built. Halving depends on two borders physically
overlapping. `0.25px` renders as 1 device pixel in a browser anyway — the same as a full
`0.5px` — so the halving is invisible in code while adding a value the grid rules have to
make an exception for.

### 2. Does `none` need to survive on the group axes?  ✅ DECIDED: no

`Border` has a `none` mode that zeroes all widths. Since the group collections alias
Border, `Border = none` already zeroes everything regardless of position. The group axes
do **not** need their own `none` — one less mode each.

---

## Migration

1. Build `Group H` (4 modes) aliasing `Border`.
2. Build `Group V` (4 modes) aliasing `Group H`.
3. Re-point components from the `group-*` collections to `Group V`.
4. Delete the 13 `group-*` collections **last** — and clear their pins the way that
   works: re-pin each node to the live parent, never `clearExplicitVariableModeForCollection`,
   which silently no-ops on a soft-deleted collection.
5. Re-project tokens. In CSS this lands as two attributes:
   `[data-group-h="middle"]` and `[data-group-v="start"]`.

⚠️ Bare `[data-*]` rules in `tokens.css` reach the document only, never a shadow root. A
component that groups its own children must set the custom properties in its own CSS — the
same idiom `sherpa-pagination` and `sherpa-calendar` already use for snapped button rows.

---

## What this replaces

| | now | proposed |
|---|---:|---:|
| collections | 13 | **2** |
| mode-cells | 728 | **64** |
| max chain depth | 4 | **1** |
| positions covered | 12 of 16 | **16 of 16** |
| `middle` state | ✗ | ✓ |
| grid support | needs 9 more collections | ✓ already |

---

## Migration status (2026-09-14)

**Built and verified.** Will chose **one side owns the shared edge** over halving.

| collection | id | modes |
|---|---|---|
| `Group H` | `VariableCollectionId:1192:29937` | `solo` `left` `mid` `right` |
| `Group V` | `VariableCollectionId:1192:29947` | `solo` `top` `mid` `bottom` |

Modes renamed 2026-09-14 so a pin reads as the POSITION it sets, not as an abstract
sequence position. `H=mid V=top` says "top-middle cell"; `start/middle/end` did not.

`Group H` aliases **Border**; `Group V` aliases **Group H**. Components bind the 8
stroke/radius properties to **Group V** — the end of the chain.

**The rule as built:** an item with a neighbour to its **right** drops its own right edge;
an item with a neighbour **below** drops its own bottom edge. The neighbour supplies it.
No halving, no `0.25px`.

### Verified

All 16 H × V positions probed live at `Border = default`:

| | H=solo | H=start | H=middle | H=end |
|---|---|---|---|---|
| **V=solo** | `4/4/4/4` | `4/0/0/4` | `0/0/0/0` | `0/4/4/0` |
| **V=start** | `4/4/0/0` | `4/0/0/0` | `0/0/0/0` | `0/4/0/0` |
| **V=middle** | `0/0/0/0` | `0/0/0/0` | `0/0/0/0` | `0/0/0/0` |
| **V=end** | `0/0/4/4` | `0/0/0/4` | `0/0/0/0` | `0/0/4/0` |

*(corners TL/TR/BR/BL — only genuinely outer corners round)*

Size stays independent: `Border=xl` + `H=start` → 2px edges, 8px left corners;
`Border=none` → 0 widths at every position.

Screenshot of the Button page test grid confirms it: outer corners round, inner corners
square, single borders between cells, no doubling and no gaps.

### How to set a cell — you pin BOTH axes

A cell's position is **two pins**, one per axis. That is the whole mechanism: 4 × 4 covers
all 16 positions, so nothing needs its own collection.

| grid cell | Group H | Group V |
|---|---|---|
| top-left | `left` | `top` |
| top-mid | `mid` | `top` |
| top-right | `right` | `top` |
| left-mid | `left` | `mid` |
| **mid** | `mid` | `mid` |
| right-mid | `right` | `mid` |
| bottom-left | `left` | `bottom` |
| bottom-mid | `mid` | `bottom` |
| bottom-right | `right` | `bottom` |

Simpler layouts leave the unused axis on `solo`:

| layout | Group H | Group V |
|---|---|---|
| **row** (items side by side) | `left` / `mid` / `right` | `solo` |
| **column** (items stacked) | `solo` | `top` / `mid` / `bottom` |
| **on its own** | `solo` | `solo` — fully rounded |

Verified live after the rename: all 9 grid cells and all 4 row states resolve correctly at
`Border = default`.

### The 3-step migration recipe

Per node — **all three steps or the node silently keeps its old look**:

1. **Re-pin to `Border`.** This is what clears the old `group-*` pin (same lineage).
   `clearExplicitVariableModeForCollection` no-ops on a soft-deleted collection.
2. **Pin `Group H` and `Group V`** to the mapped position.
3. **Rebind all 8 properties to `Group V`'s variables** — `strokeTopWeight` …
   `bottomRightRadius`. ⚠️ Without this the node stays bound to *Border's* variables and
   the H/V pins do nothing, because Group H/V are a **separate lineage** that does not
   override the Border binding.

### Old → new position map

| old collection | H | V |
|---|---|---|
| `group` | `middle` | `solo` |
| `group-left` · `group-row-left` | `start` | `solo` |
| `group-right` · `group-row-right` | `end` | `solo` |
| `group-top` · `group-column-top` | `solo` | `start` |
| `group-bottom` · `group-column-bottom` | `solo` | `end` |
| `group-top-left` | `start` | `start` |
| `group-top-right` | `end` | `start` |
| `group-bottom-left` | `start` | `end` |
| `group-bottom-right` | `end` | `end` |

### Done / outstanding

| | nodes |
|---|---:|
| ✅ Button page migrated | 12 |
| ✅ All 12 **positional** `group-*` collections — pins remaining | **0** |
| ⏳ plain `group` — still pinned, not yet migrated | **364** |

Remaining `group` pins by page: Quick Filter Toolbar 155, App Header 108, App Showcase 28,
Calendar 23, Quick Filter Chip 21, Slider 14, sherpa-app-shell 6, Menu 4, Headers 2,
Pagination 2, Containers 1.

⚠️ Mapping plain `group` → `H=middle V=solo` is the **literal** translation of what it did
(square all corners, drop the right edge). But `group` was applied to every item in a row,
including the ends — so after migrating, the first and last item of each row will need
`H=start` / `H=end` to get their outer corners back. **Do these pages by eye, not by
script.**

**The 13 old collections are still present and now hold only the 364 `group` pins.** Delete
them once that count reaches 0.

---

## COMPLETE — 2026-09-14

| step | result |
|---|---|
| Button page migrated | 12 nodes |
| 12 positional `group-*` collections deleted | 0 pins first, variables unchanged |
| Plain `group` migrated | **364 nodes**, 0 errors |
| `group` collection deleted | variables unchanged (769) |
| Earlier-generation ghosts migrated | **675 more pins** (`group-row-mid` 315, `group-row-right` 354, +6 others) |
| **Total pins moved** | **1,051** |
| Border-family collections | **13 → 2** |

Positions now in use — all 15 combinations, including the full 3×3 grid:
`H=left/mid/right × V=solo/top/mid/bottom`, plus `H=solo × V=top/mid/bottom` for columns.

### A second bug found and fixed on the way

`structure-space/snapped` was a **literal `-0.5` in every Structure mode**, while the
exported `figma.tokens.json` and `tokens.css` both said `{display-mode.space.none}` = 0.
**The live Figma file had drifted from its own export.**

That `-0.5` was a deliberate negative overlap for the *halved* border model — two
neighbours each drew a half border and were pulled together to make one. Under
one-side-owns it would have pulled neighbours a half-pixel into each other.

Re-pointed the variable to alias `Display Mode/space/none`. All **341** frames bound to it
went to `0` automatically — no node edits needed. A further **4** unbound `Inputs` frames
at `-1` were bound properly and are now `0`.

⚠️ Earlier in the session I reported this variable as "aliasing space/none, resolves to 0".
That was **wrong** — a probe read it through a different resolution path. The variable
itself held `-0.5`. Read `valuesByMode` directly before trusting a probe on a FLOAT.

### Left alone, deliberately

- **`Snapping`** — 176 ghost pins, 0 variables, inert. A **standalone** collection (no
  `parentModeId`), so there is no parent to re-pin to and `clear…` no-ops on it. Needs a
  manual delete in the Figma UI.
- **Calendar's `gridRowGap: 2`** — the white notches across a selected date range come from
  the grid's own row gap, not from borders. Pre-existing, and a Calendar design question.

---

## Why Group H / Group V are STANDALONE, not Border extensions

Asked 2026-09-14: should they be extended collections of `Border` rather than unique ones?

**They cannot be, and the reason is the same constraint that broke the original 13.**

**One pin per lineage.** A node holds exactly one mode pin per collection lineage. Proven
live with a real extension — pinning `Transparent` (an extension of `Style`) on a node that
already had a `Style` pin **wiped the Style pin**; only `Transparent` survived.

So if `Group H` extended `Border`, pinning a position would destroy the size pin. To keep
both, every extension must re-declare all its parent's modes:

| | modes | cells |
|---|---:|---:|
| `Group H` as extension = 7 sizes × 4 positions | 28 | 224 |
| `Group V` as extension = 7 sizes × 4 H × 4 V | 112 | 896 |
| **total** | **140** | **1,120** |
| **standalone (as built)** | **8** | **64** |

**18× larger** — and it re-creates exactly the combinatorial blow-up that made the original
13 collections unworkable. It would also be worse than what was there before (728 cells),
because it adds the `mid` states the old set was missing.

**Standalone is what makes the two axes independent.** Verified: a node holds
`Border=xl` + `Group H=mid` + `Group V=top` **simultaneously** — three pins, three separate
questions. Size and both position axes compose freely, which is the entire point.

The collections still *behave* as a hierarchy where it matters: `Group H` **aliases**
`Border`, `Group V` **aliases** `Group H`. Values flow down the chain exactly as an
extension would. Only the **pinning** is independent — and that is the part that has to be.

**Conclusion: keep them standalone.** "Extension" is the right mental model for how the
values inherit; it is the wrong mechanism for how the pins are applied.

### Follow-up: "extensions can extend extensions, so consolidate under Border"

True that they chain — `Calendar M/Y` → `Calendar D` → `Layout` exists in this file. But
chaining does **not** lift the pin limit, and there is a second blocker:

**1. Chained extensions still replace each other.** Tested on that real three-level chain:
pinning `Layout=desktop`, then `Calendar D=tablet`, then `Calendar M/Y=mobile` left
**one pin** — each wiped the last.

**2. An extension's modes are LOCKED.** `collection.extend(name)` mirrors the parent's
modes exactly and the child cannot change them:

| attempt on an extension | result |
|---|---|
| `addMode('extra')` | **throws** — `not a function` |
| `renameMode(...)` | **throws** — `not a function` |
| `removeMode(...)` | **throws** — `not a function` |

So an extension of `Border` always has exactly Border's 7 **size** modes
(`default 2xs xs sm lg xl none`). It can never hold `solo/left/mid/right`. Each child mode
is hard-wired to one parent mode (`M/Y mobile` → `Cal D mobile` → `Layout mobile`), which
is why one pin carries the chain — but only that one fixed combination.

To express "xl **and** mid" you would need a mode per combination, and the API cannot add
modes to an extension at all. The 140-mode / 1,120-cell figure above is therefore not just
expensive — it is **not buildable by extension**; those modes would have to be authored by
hand in the UI as plain collections, which is what standalone already is.

**Conclusion stands: Group H and Group V must be standalone collections that ALIAS Border.**

---

# FINAL STRUCTURE — extensions, 2026-09-14

**Will's correction, and it was right.** I kept trying to put positions in *modes*, which an
extension cannot do. Put the position in the **collection** and let the modes stay Border's
sizes, and extensions work exactly as intended.

```
Border  (8 vars × 7 size modes)
├── group-h-left        ── group-left-top · group-left-mid · group-left-bottom
├── group-h-mid         ── group-mid-top · group-mid-mid · group-mid-bottom
├── group-h-right       ── group-right-top · group-right-mid · group-right-bottom
├── group-v-top
├── group-v-mid
└── group-v-bottom
```

**15 collections. One pin per node.** A node pins `group-left-top` and gets position *and*
size from that single pin — the size mode carries through the chain.

| use | pin |
|---|---|
| row | `group-h-left` / `-mid` / `-right` |
| column | `group-v-top` / `-mid` / `-bottom` |
| grid cell | `group-{left,mid,right}-{top,mid,bottom}` |
| not grouped | no pin — plain `Border` |

### Why this works where my earlier attempt did not

An extension **inherits its parent's modes and cannot change them** — `addMode`,
`renameMode`, `removeMode` all throw. So an extension can never hold `solo/left/mid/right`.

But it does not need to. The **override** is per collection, applied across every inherited
mode. `group-h-left` overrides `border/right` → 0 and the two right corners → 0, in all 7
size modes. Pin it at `xl` and you get `T2 L2` with `tl8` — position from the collection,
size from the mode.

### Verified

All 9 grid cells at `Border = default`:

| | left | mid | right |
|---|---|---|---|
| **top** | `4/0/0/0` | `0/0/0/0` | `0/4/0/0` |
| **mid** | `0/0/0/0` | `0/0/0/0` | `0/0/0/0` |
| **bottom** | `0/0/0/4` | `0/0/0/0` | `0/0/4/0` |

Only the four true outer corners round. Size flows through: `group-h-left` at `xl` gives
`T2 R0 B2 L2`, corners `8/0/0/8`.

A real 3×3 grid built from these rendered correctly — single dividers, outer corners round.

### Migration

| step | result |
|---|---|
| 15 extension collections built | `extend()` + per-mode overrides |
| Nodes migrated off `Group H`/`Group V` | **1,052** |
| Old pins cleared | **1,052 → 0** |
| `Group H` / `Group V` deleted | variables **769 → 753** (back to the original count) |
| New group ghosts created | **0** |

⚠️ The new collections are a **different lineage** from the old standalone pair, so the new
pin did *not* displace the old one — both coexisted until the old was cleared explicitly.
`clearExplicitVariableModeForCollection` works here because the collections were still live
at the time; clear BEFORE deleting, never after.

⚠️ The 32-second bridge timeout caps a single `figma_execute`. 1,052 nodes needed chunks of
~400.

### Not mine

A button on the Button test grid renders red. It carries `Saturated: critical` — a **Style**
pin of Will's, pre-existing (only 2 nodes file-wide). It was masked before because the old
`group` collection replaced the Border pin; now the pins sit in separate lineages and the
colour shows. Nothing to fix.

