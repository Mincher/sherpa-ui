# Sherpa-UI — variable collection audit (2026-09-14)

Full audit of every variable collection, extension and mode in the Figma file
(`UnBEepLWb6d7b9ykm33j2s`), cross-referenced against the projected `tokens.css`
and the component CSS that consumes it.

**Question asked:** what is actually used, what is inefficiently aliased, and what
can be simplified with opacity overlays or colour mixing.

**Method.** Every variable read via the plugin API. Node usage measured by walking
all 41,403 nodes across every page and collecting `boundVariables` (including per-paint
and per-effect bindings) plus `explicitVariableModes`. Extension collections read by
**bound probe** — they read back empty from `valuesByMode`, and `resolveForConsumer()`
returns `null`, so values were recovered by binding each variable to a paint on a
probe frame pinned to each mode and reading the resolved fill. Code usage measured by
static extraction of `var(--sherpa-*)` from every component `.css`/`.html`, then walking
the `tokens.css` alias graph back from the component consumers.

**Nothing in Figma was changed.** Probe frames were created and removed; two sweeps
confirmed zero strays.

**Verdict key:** 🔴 real waste, act on it · 🟡 worth a decision · ✅ correct as-is,
do not "fix"

**Ruling (Will, 2026-09-14) — modes carry meaning.** A mode axis exists to express a
real variation (light/dark, a status, a density, a breakpoint). A variable that does not
change across those modes is therefore **not automatically waste** — it may simply be
invariant under that particular variation, which is a fact about the design, not a defect.
The test is not "does every cell differ" but **"is the mode axis the right axis for this
collection, and does its NAME say what it is for"**. The same applies to extension
collections. §2 and §6 below are re-framed to that test.

---

## Scale

| | count |
|---|---|
| Collections | 24 (12 base + 12 extension) |
| Variables | 753 |
| Nodes scanned | 41,403 |
| Variables bound directly to a node | 142 |
| Variables live after walking alias chains | 264 |
| Tokens emitted by `tokens.css` | 530 |
| Tokens consumed by a component | 145 |

---

## Findings, ranked by size

### 1. 🔴 17,543 stale mode pins across 62 ghost collections

Nodes carry `explicitVariableModes` entries for **62 collections that no longer appear
in the file's collection list**. They still resolve by id — they are soft-deleted
shells, not dangling refs — but **55 of the 62 hold zero variables**.

These are leftovers from the Typography / Hero / Mono deletions and the superseded
`Structure: snap-*` set (replaced by today's `snap-*` collections under Border).

Biggest offenders:

| ghost collection | vars | nodes pinned |
|---|---:|---:|
| `default (base)` | 0 | 2,869 |
| `Structure: snap-passthrough` | 8 | 2,250 |
| `label` | 0 | 1,426 |
| `monospaced` | 0 | 949 |
| `mono` | 0 | 940 |
| `Mono` | 0 | 940 |
| `Brand` | 0 | 813 |
| `default (sm)` | 0 | 785 |
| `body-sm` | 0 | 779 |
| `small (Brand)` | 0 | 779 |

Only **17** of the 79 pinned collections are live.

**Why it matters:** every pin is stored per node. This is the single largest source of
file bloat found, and it silently survives collection deletion.

**Fix:** sweep `explicitVariableModes` and strip keys whose collection is not in the
local collection list. Do it as one scripted pass; it touches many nodes, so take a
version snapshot first.

---

### 1b. The snap pins — what actually has to move

Of §1's ghost pins, the snap-related ones were measured separately, because those are the
ones that carried real behaviour. **3,563 nodes hold an old snap pin.** They split four ways:

| bucket | nodes | action |
|---|---:|---|
| `snap-passthrough` pin | 2,250 | **delete** — probed against plain Structure on all 8 variables: byte-identical. It overrides nothing; the name is literal |
| old snap pin **and** a new Border pin already present | 752 | **delete the old one** — the node is already migrated, the old pin is litter |
| old snap pin **only**, a real edge | 385 | **migrate** to the matching new collection |
| `Snapping` (the oldest generation, 0 vars, 7 modes) | 176 | **delete** — pre-dates both later generations |

So only **385 pins genuinely need moving**; the other 3,178 are pure deletion.

**Migration map.** Old and new collections share identical mode names, so it is one-to-one
by name (the new ones add a `none` mode that has no old equivalent):

| old (ghost) | → new | nodes |
|---|---|---:|
| `Structure: snap-all-edges` | `snap-all-edges` `1181:28767` | 310 |
| `Structure: snap-right-edge` | `snap-right-edge` `1181:28764` | 42 |
| `Structure: snap-left-edge` | `snap-left-edge` `1181:28761` | 31 |
| `Structure: snap-bottom-edge` | `snap-bottom-edge` `1181:28758` | 1 |
| `Structure: snap-top-edge` | `snap-top-edge` `1181:28755` | 1 |

Modes map by name: `default→default`, `2xs→2xs`, `xs→xs`, `sm→sm`, `lg→lg`, `xl→xl`.

This matches the Structure/Border split: snapping is a **border** concern (which corners
are rounded), so the pin belongs on Border, not Structure.

**Dry run (2026-09-14, writes nothing) — confirms the plan:**

```
wouldMigrate                  385
wouldDelete_passthrough      2250
wouldDelete_alreadyMigrated   752
wouldDelete_oldestSnapping    176
unmappedCount                   0   ← every old mode has a new equivalent
```

`unmappedCount: 0` is the gate. If it is ever non-zero, stop — a node is pinned to a mode
with no counterpart and would silently lose its snapping.

#### DONE — executed 2026-09-14

| step | result |
|---|---|
| Migrate real snap pins onto the new Border `snap-*` collections | **385 → 0 unmigrated** |
| Clear the 6 ghost `Structure: snap-*` collections off nodes | **3,374 pins cleared, 0 errors** |
| Geometry verification | **1,028 snapped nodes checked, 1,028 correct, 0 mismatches** |
| Ghost pins file-wide | 17,507 → **14,120** |

**The method that worked (Will's call).** `clearExplicitVariableModeForCollection()`
**silently no-ops** against a soft-deleted collection — it throws nothing and returns
nothing, but the pin stays. A loop over it reports total success and changes nothing.
Verified by control test: the same call on a *live* collection clears correctly.
`explicitVariableModes` has no setter, so the map cannot be rewritten either.

The fix is not to delete anything. **Re-pin the node to the ghost's live PARENT**
(`Structure: snap-left-edge` → plain `Structure`, matching mode by name) and Figma
drops the stale extension pin by itself. One write, no destructive `remove()`.

⚠️ **Still outstanding: `Snapping` — 176 pins.** This one is a **standalone collection,
not an extension** (no `parentModeId` on any mode), so there is no parent to re-pin to and
the clear call no-ops. It holds **0 variables**, so it controls nothing — confirmed on a
node pinned to `Snapping: left-edge` whose radii read `4,4,4,4`, fully rounded. Inert
litter. Removing it needs either `collection.remove()` or a manual delete in the Figma UI.

---

### 2. 🟡 Extensions carry variables outside their own purpose

Every extension cell was probed and compared against its parent in the matching parent
mode. Under the ruling above, an identical cell is only a defect when the variable has
**nothing to do with what the extension is for**. Read the table as *"how much of this
extension is about its own subject"*, not as a waste percentage.

| extension | parent | cells | real overrides | identical | fully-redundant vars |
|---|---|---:|---:|---:|---:|
| `compact` | Display Mode | 238 | 46 | **192 (81%)** | **96 / 119** |
| `comfortable` | Display Mode | 238 | 44 | **194 (82%)** | **97 / 119** |
| `Transparent` | Style | 96 | 33 | 63 (66%) | 7 / 12 |
| `Saturated` | Style | 96 | 42 | 54 (56%) | 4 / 12 |
| `snap-top-edge` | Border | 56 | 14 | 42 (75%) | 6 / 8 |
| `snap-bottom-edge` | Border | 56 | 14 | 42 (75%) | 6 / 8 |
| `snap-left-edge` | Border | 56 | 14 | 42 (75%) | 6 / 8 |
| `snap-right-edge` | Border | 56 | 14 | 42 (75%) | 6 / 8 |
| `snap-all-edges` | Border | 56 | 28 | 28 (50%) | 4 / 8 |
| `Calendar D` | Layout | 28 | 12 | 16 (57%) | 4 / 7 |
| `Calendar M/Y` | **Calendar D** | 28 | 8 | 20 (71%) | 5 / 7 |
| `App Shell` | Layout | 28 | 16 | 12 (43%) | 3 / 7 |
| **total** | | **1,032** | **285** | **747 (72%)** | |

**`compact` / `comfortable` — the name says density, so density is the subject.**
Each changes exactly the ~23 `size/*` and `space/*` variables. That is correct and
complete: density *is* sizing and spacing. The problem is that each collection also
carries **96 / 97 variables that have nothing to do with density** — every `color/*`,
`fonts/scale/*`, `border/rounding/*` and `border/width/*` — inherited wholesale because
the extension was made from the full Display Mode set. Those are the ones to drop: not
because they fail to differ, but because **density is not their axis**.

Spot-verified independently: under `compact`, `size/md` 20 → 16 and `space/xs` 8 → 4
(real), while `border/rounding/base` 4 → 4 and `fonts/scale/base` 14 → 14 (redundant).

Also never overridden anywhere in the Layout family: `breakpoint`,
`layout-grid/row-height`, `layout-grid/max-width`.

And in all five snap collections, the four `border/*` **width** variables are untouched
in every mode — 140 cells of pure noise. Each snap collection correctly zeroes only the
`rounding/*` corners on its own edge.

**Note:** `Calendar M/Y` extends **`Calendar D`**, not Layout — it is a second-level
extension. Comparing it against Layout gives a wrong answer.

**Mode names — do they say what they are for?**

| collection | modes | verdict |
|---|---|---|
| `Display Mode` | `light` / `dark` | ✅ exact |
| `compact` / `comfortable` | `light` / `dark` | 🟡 the COLLECTION names the density, the MODES name the display mode they inherit. Correct mechanically, but reading `compact → dark` alone does not say "compact density, dark display" |
| `Transparent` / `Saturated` | status names | ✅ the collection names the look tier, the modes name the status |
| `snap-*-edge` | `default/2xs/xs/sm/lg/xl/none` | ✅ collection names the edge, modes name the border size |
| `Calendar D`, `Calendar M/Y`, `App Shell` | breakpoints | ✅ |
| `Elevation` | `passthrough`/`sm`/`md`/`lg` | ✅ `passthrough` reads as "inherit, add nothing" |
| `Structure` | `default/2xs/xs/sm/lg/xl` | ✅ t-shirt sizing |
| `Switch` | `standard` / `simple` | ✅ |
| `Input` | `default` / `validation` | 🟡 the axis is right, but the collection holds a single boolean with 0 binds |
| `Theme` | `Sherpa` | ✅ names the theme; a second theme would be a second mode |
| `Primitives` | `value` | ✅ no variation by design |

**Fix:** trim `compact` / `comfortable` to the `size/*` + `space/*` rows that density
actually owns. Removes ~190 variables that are not about density, and changes no
rendered value.

---

### 3. 🔴 224 of 232 `COMPOSE_COLOR` wrappers are 100% opaque

Every colour in **Display Mode** (all 51) is stored as a `VARIABLE_EXPRESSION` /
`COMPOSE_COLOR` pairing a hue primitive with an opacity primitive.

| opacity used | cells |
|---|---:|
| `effects/opacity/1000` = 100% | **224** |
| `effects/opacity/300` = 30% | 8 |

The only 8 that carry a real alpha are `Style/style-surface/shadow` across its 8 status
modes. The other **224 compose a colour with "fully opaque"** — an extra indirection
that changes nothing.

This is also the construct that your DTCG export silently flattens (it drops composed
alpha), which is why shadows once went opaque and needed the `$extensions.opacity` +
`withOpacity()` repair in the projector.

**Fix:** where opacity is 100%, alias the hue primitive directly. Keep `COMPOSE_COLOR`
only for the 8 shadow cells that genuinely need alpha — and they are the ones the
projector already special-cases.

---

### 4. 🟡 Data-viz ramps: 111 hardcoded hex values, none consumed

`Theme/data-viz/*` holds 138 steps across 15 families.

| family group | steps | hardcoded literals |
|---|---:|---:|
| 12 × `sequential/*` | 132 | 111 |
| 3 × `divergent/*` | 6 | 0 (aliased) |
| `categorical` | 11 | 0 (aliased) |

Each sequential ramp is 10–11 raw hex literals anchored by a single alias. They project
into `tokens.css` as **121 sequential + 6 divergent** flat hex declarations, and **not
one is consumed by any component.**

Charts reach colour only through the 11 public `--sherpa-data-viz-series-*` names, which
`sherpa-barchart`, `sherpa-line-chart` and `sherpa-chart-legend` build at runtime
(`--sherpa-data-viz-series-${n}`). Those 11 are genuinely live — a static scan cannot see
them, so do **not** treat them as dead. They alias `categorical`, which is correctly
fully aliased.

**This is the clearest colour-mix candidate in the file.** A sequential ramp is one hue
at stepped lightness — exactly what `color-mix()` generates. The system already ships
25 `color-mix(in oklab, …)` declarations for hover/down states, so the pattern is proven
in production.

**Options:** (a) generate each ramp from two endpoint tokens with `color-mix()`, replacing
~111 stored values with 24; or (b) stop projecting the unused ramps until a component
needs them, and keep the Figma values as the design record.

---

### 5. 🟡 385 emitted tokens with no consumer

`tokens.css` emits 530 tokens. Walking the alias graph back from actual component
consumers, **354 have no path to any component**.

| orphan family | count |
|---|---:|
| `theme-data-*` (the ramps in §4) | 137 |
| `theme-content-*` | 52 |
| `display-mode-*` | 48 |
| `theme-surface-*` | 39 |
| `theme-border-*` | 29 |
| everything else | 49 |

Some of this is deliberate — `layout-*` is documented as kept for future use, and
Primitives are reference-only by design (the projector inlines them as literals and
never emits them). The `theme-content`/`theme-surface`/`theme-border` orphans are the
+3/+4 ends of the range scales, which exist so a designer can reach for them.

**Decide per family**, not wholesale. The ramps in §4 are the only group large enough
to matter on their own.

---

### 6. 🟡 Variables carrying a mode axis that is not their axis

| collection | modes | variable | value |
|---|---:|---|---|
| Style | 8 | `style-border/width` | `border/width/sm` in all 8 |
| Style | 8 | `style-content/secondary` | `content/body/+1` in all 8 |
| Structure | 6 | `structure-font/weight` | `fonts/weight/400` in all 6 |
| Structure | 6 | `structure-space/snapped` | `space/none` in all 6 |
| Layout | 4 | `layout-grid/padding` | `space/base` in all 4 |
| Layout | 4 | `layout-grid/gap-horizontal` | `space/base` in all 4 |
| Layout | 4 | `layout-grid/gap-vertical` | `space/base` in all 4 |
| Navigation | 5 | `nav-item-tier-2`, `nav-item-tier-3` | identical in all 5 |
| Switch | 2 | `switch-size/padding` | `space/3xs` in both |

Judge each against its collection's purpose, not against the count:

- `style-border/width` sits in **Style**, whose axis is *status*. A border width does not
  vary by status, so the axis is wrong for it — it belongs in **Border**, which is what
  that collection is for.
- `style-content/secondary` likewise never varies by status.
- `layout-grid/padding` and the two `gap-*` sit in **Layout**, whose axis is *breakpoint*.
  If padding and gap genuinely should not change between mobile and wide, they belong in
  Display Mode / Structure instead.
- `nav-item-tier-2` / `-3` sit in **Navigation**, whose axis is *nav state*. Indent depth
  does not vary by nav state — only `tier-1` does (`space/xs` → `space/2xs` when collapsed).

✅ **Correct, leave alone:**

- `structure-space/snapped` = `space/none` in all 6 modes. A snapped edge is a hard `0`,
  flush. The design, not drift — and it is in the right collection.
- `structure-font/weight` = 400 across the size modes. Weight legitimately does not change
  with size; the axis is right, the value is simply invariant under it.
- The 75 invariant variables in **Display Mode**. Its axis is *light/dark*, and geometry
  (spacing, sizes, radii, font scale) must not change between them. Invariance here is the
  correct answer, not a defect.

---

### 7. ✅ RESOLVED — border edges moved onto custom borders

*(was: "four identical border-edge variables, 0 binds")*

The audit read `Border/border/{top,bottom,left,right}` as dead because **Button was their
only consumer** — Will's worked example of the intended pattern. Every other component was
still binding all four stroke weights to `Style/style-border/width`, a single status-axis
token, which meant **snapping could not affect border visibility at all**.

**The pattern (from Button, `11:2455`):**

| property | bind to |
|---|---|
| `strokeTopWeight` | `Border/border/top` |
| `strokeBottomWeight` | `Border/border/bottom` |
| `strokeLeftWeight` | `Border/border/left` |
| `strokeRightWeight` | `Border/border/right` |
| `strokes[0]` colour | `Style/style-border/base` or `+1` — **stays on Style** |
| the 4 corner radii | `Border/rounding/{corner}` |

Width comes from **Border**, colour stays on **Style**. `Style/style-border/width` is
retired for containers.

**Converted 2026-09-14 — 17 source nodes across 12 components:**
Tag (×2 variants), Container, Dialog, Overlay Panel, Panel, Accordion,
Container Header (×2 dividers), Toast, List, Calendar Cell (×6 states/frames).

Instances inherit, so this reached **282 further nodes** without touching them — including
all 147 `Calendar Cell` instances inside Calendar.

**Verification — the capability that did not exist before:**

| component | base | `Border: none` | `Border: xl` |
|---|---|---|---|
| Tag, Container, Dialog, Overlay Panel, Panel, Accordion, Toast, List, Calendar Cell | `0.5` all edges | **`0` all edges** | **`2` all edges** |

And on a converted Container, `snap-left-edge` now yields radii `0,4,4,0` — left corners
flat, right corners round — while the border stays drawn. Snapping and border visibility
are finally on the same axis.

Screenshots after conversion: Container and Calendar render unchanged.

⚠️ **One node deliberately left on `style-border/width`:** `Metric › line` (`465:62309`),
a **VECTOR** — the sparkline stroke. Vectors have no per-edge weights (`strokeTopWeight`
is not settable; the API throws *"object is not extensible"*), and a drawn mark has no
edges to snap. Correct as-is, not an oversight.

---

### 7b. 🟡 The four border-edge variables still hold identical values

Now heavily bound (§7), but `Border/border/top`, `/bottom`, `/left`, `/right` still have
**byte-identical mode maps** across all 7 Border modes, and none of the five snap
extensions overrides any of them — snapping changes `rounding/*`, never the widths.

In code they are consumed unevenly: `--sherpa-border-top` in 9 files, `-bottom` in 2,
`-right` in 2, **`-left` in 0**.

Per-edge control is the right API and §7 now depends on it, so **keep all four**. The open
question is only whether the four need independent *values* or should alias one width
variable. Worth deciding when a design first needs a genuinely asymmetric border — a
bottom-only rule on a header, say.

---

### 8. 🟡 Dead in both Figma and code

| collection | variable | note |
|---|---|---|
| `Input` | `hasValidation` | the collection's **only** variable, 0 binds — dead collection |
| `Switch` | `hasLabel` | 0 binds |
| `Navigation` | `headerState` | 0 binds |
| `Navigation` | `nav-container-setting-button` | 0 binds |
| `Navigation` | `nav-container-pin-button` | 0 binds |
| `Style` | `style-content/tertiary` | 0 binds in Figma; **is** consumed in code |
| `Layout` | `layout-grid/columns`, `/row-height`, `/max-width` | 0 binds |
| `Data Viz` | `series/4` … `series/11` | 0 binds in Figma; **live in code** via runtime names |

⚠️ The last two rows are why the code cross-reference was necessary. `style-content/tertiary`
and `series/4..11` look dead in Figma and are **not**. Do not delete on a Figma-only read.

---

## ✅ What is already correct — do not change

- **Alias depth.** Maximum chain depth is **2**. Zero chains of 3+. The
  Primitives → Display Mode → Theme → Style hierarchy is clean.
- **Hardcoded colours outside Primitives: only 24**, and 22 of those are the data-viz
  ramp steps in §4. No stray hex drift in the semantic tiers.
- **Dark mode.** 44 of 51 Display Mode colours re-point between light and dark, matching
  the 44 re-points in `tokens.css` exactly. The 7 that do not are `neutral/fixed/*` (fixed
  by name) plus `accent/color 3` and `tones/color 3` — the **ramp midpoints**, which stay
  put while the ends invert. Correct, not drift.
- **`categorical` and `divergent` data-viz** are fully aliased.
- **The five snap collections** each zero exactly the corners on their own edge.
- **Saturated is not expressible as an alpha of Transparent.** Its hues are genuinely
  darker (`#2b34b4` vs `#e8e8f6` for default). Only `active` and `inactive` share a hue.
  Do not collapse these two tiers.

---

## Recommended order

1. **Migrate the 385 real snap pins onto Border, then strip every ghost pin** (§1b, §1).
   Ordered this way deliberately: migrate first so nothing loses its snapping, then the
   remaining 17,158 pins are safe to delete outright. Biggest win, no design change.
2. **Trim `compact` / `comfortable`** to the `size/*` + `space/*` rows density owns (§2).
   Removes ~190 variables that are not about density; changes no rendered value.
3. **Unwrap the 224 fully-opaque `COMPOSE_COLOR` cells** (§3). Removes an indirection
   that the DTCG export mishandles anyway.
4. **Decide the data-viz ramps** (§4) — `color-mix()` generation, or stop projecting them.
5. Then the smaller items: §6 wrong-axis variables, §7 border edges, §8 dead variables.

Steps 1–3 change **no rendered value anywhere**. They are pure removal of redundancy.

**Before any of it:** take a Figma version snapshot. Step 1 touches thousands of nodes and
there is no undo across a plugin batch.

---

## Traps for whoever does the work

- **Extension overrides read back empty.** `valuesByMode` is empty and
  `resolveForConsumer()` returns `null` for extension collections. Use a bound probe:
  bind the variable to a paint on a frame pinned to the mode, then read `fills[0].color`.
- **`COMPOSE_COLOR` breaks naive comparison.** Stringifying a value to compare modes turns
  every expression into `"[object Object]"`, so everything looks identical. Compare
  expressions structurally — recurse into `expressionArguments`. This mistake made all 51
  Display Mode colours look mode-invariant on the first pass.
- **`Calendar M/Y` extends `Calendar D`**, not Layout.
- **Runtime-built token names are invisible to grep.** `--sherpa-data-viz-series-${n}` means
  all 11 series are live. Check the `.ts` before calling a token dead.
- **A Figma-only read will tell you live tokens are dead.** §8 has two examples.

---

# Dangling-reference sweep — CODE side (2026-09-15)

**Rule (Will):** a pin or bind that points at something which no longer exists gets
**repointed to the current equivalent**, not just deleted.

Static sweep of every component `.css`/`.html` plus `src/core/sherpa-base.css` for
`var(--sherpa-*)` names that `tokens.css` never emits.

29 looked dangling; **21 were false positives** — component-scoped tokens
(`--sherpa-button-*`, `--sherpa-switch-*`, `--sherpa-navigation-*`) that the projector
inlines into each component's own `sherpa:tokens` region rather than into `tokens.css`.
Check the component's own file before calling one dead.

**7 genuinely dangling, all repointed:**

| dead reference | repointed to | why |
|---|---|---|
| `--sherpa-theme-elevation-offset-x-base` | `display-mode-size-2xs` (8px) | see below |
| `--sherpa-theme-elevation-offset-y-base` | `display-mode-size-2xs` (8px) | " |
| `--sherpa-theme-elevation-blur-base` | `display-mode-size-sm` (16px) | " |
| `--sherpa-theme-elevation-spread-base` | literal `-4px` | " |
| `--sherpa-core-fonts-scale-lg` | `display-mode-fonts-scale-lg` | same value (16px), current name |
| `--sherpa-content-primary-base` | `theme-content-body-base` | the canonical default ink (#0C0B11); 34 components already use it |
| `--sherpa-display-mode-size-base` ×4 | `display-mode-size-sm` | fallback was 16px, and `size-sm` **is** 16px (`size-md` is 20px — the wrong pick) |

⚠️ **The elevation four are the interesting case.** The obvious repoint is
`--sherpa-elevation-{offset-x,offset-y,blur,spread}` — but those resolve to the
`passthrough` step, **`0px`**, at `:root`. The `[data-elevation="md"]` block that gives
them real values is a bare attribute selector in `tokens.css`, which reaches the DOCUMENT
only and never crosses a shadow boundary. Repointing would have silently **flattened the
tooltip's shadow to nothing** while looking correct in the source.

Spelled the `md` values out from Display Mode primitives instead (8/8/16/-4), mirroring
`[data-elevation="md"]` exactly — the same idiom `sherpa-menu` already uses. Same trap as
[[sherpa-datasnap-not-in-shadow]].

**Remaining "dangling": 1**, and it is a false positive —
`--sherpa-data-viz-series-N` appears only in a comment in `sherpa-chart-legend.css`
describing the runtime pattern (`--sherpa-data-viz-series-${n}`). Not code.

Verified: lint 0/0, type-check clean, **401 tests passing**.

