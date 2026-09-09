# Sherpa-UI — Design System Reference

The single source of truth for **what every collection, mode, extension, variable group, and
component is for**. Use this to keep the system consistent as the library grows.

The system extends the standard **3-tier token architecture** (primitives → semantic → component)
with intent-based naming, adding a **shared-abstraction tier** between the semantic layer and the
few genuinely component-scoped collections. Raw values live at the bottom and are never bound
directly; a component binds the most specific collection that abstracts what it needs, and that
collection aliases downward through the tiers to the primitives.

---

## 1. Collection architecture (the tiers)

_(Verified 2026-09-07 from live bindings — every edge below is a real alias count.)_

Aliasing always flows **downward** to more primitive tiers — a strict layered DAG:

```
Component-scoped        Switch · Input · Navigation
  (one component each)      ↓ alias
Role / semantic tier    Style · Structure · Elevation · Layout · Data Viz
                            ↓ alias
Theme                   Theme            ← surface/* · border/* · content/* · size/* · weight/* ·
                                            font/* · padding/* · gap/* · elevation/* · data-viz/*
                            ↓ alias
Display Mode            Display Mode     ← the light/dark colour + scale ramp (color/*, fonts/*, space/*, size/*)
                            ↓ alias
Primitives              Primitives       ← raw hex, px, ms — never bound directly
```

**Key distinction:**
- **Theme** is the single semantic source — colour families, type, and shared spacing. It resolves
  through **Display Mode** (which owns light/dark) down to **Primitives**.
- **Style / Structure / Elevation / Layout / Data Viz** are the role tiers a component pins:
  Style = status look, Structure = size/geometry, Elevation = shadow, Layout = grid, Data Viz = series.
  They alias Theme (Structure/Layout also alias Display Mode directly for raw geometry).
- **Component-scoped** means bound to and named for a *single* component: `Button` (a `Structure`
  size extension), `Switch::switch-*`, `Input::hasValidation`, `Navigation::nav-*`. These exist only
  because that one component needs an axis (size, style, field-state) the role tiers don't provide.
- **Extensions inherit their parent's tier:** `Display Mode: compact/comfortable` → Primitives;
  `Style: Transparent/Saturated` → Theme; `Structure: snap-*` → Display Mode/Theme.

**Golden rule:** never bind `Primitives` or `Display Mode` directly from a component. Bind a role
tier (Style/Structure/Elevation) or the component's own scoped collection; reach `Theme` only for a
genuine one-off semantic value.

---

## 2. Foundation collections

_(Rewritten 2026-09-07 — the old separate "Core" and light/dark "Style (Sherpa)" layers are
gone; the named ramps and light/dark handling now live in one **Display Mode** collection.)_

### Primitives — raw values (245 vars, 1 mode `value`)
The laboratory-grade layer. Raw hex colours, effects, border values, scale steps, motion
timings. **Never bound directly** — only aliased by Display Mode.

### Display Mode — named ramps & scales + light/dark (163 vars, modes `light` / `dark`)
The named-token layer between raw and semantic, and the collection that **owns light/dark**
(every downstream collection inherits mode from here — components stay mode-agnostic). Colour
ramps (`color/neutral/*`, `color/basic/greyscale/*`, `color/brand/*`, `color/accent/*`,
`color/extended/*`, `color-transparent/*`), font scale (`fonts/scale/*`, `fonts/weight/*`),
spacing (`space/*`), sizing (`size/*`), border (`border/*`). Extensions **compact /
comfortable** provide density variants of spacing/sizing (see §5). Bound only via Theme, a
role tier, or a component collection — not directly.

> The **semantic layer is `Theme`** (single `Sherpa` mode) — surface / border / content /
> type / spacing families. It is documented in §3 alongside `Style`, the status role tier it
> feeds. A second named theme would be another mode / `[data-theme]` block on `Theme`.

**Range convention (Theme families):** each family is `base` + `+1..+4`. For **surfaces** the
range lightens (`base` = the family colour, `+1..+4` progressively lighter; `transparent` = the
family at 10%). For **content** (ink) the range is REVERSED — `base` = darkest ink, `+1..+4`
progressively lighter. The Saturated look tier picks the strong step; Transparent = the 10% step.

---

## 3. The semantic "look" foundations — `Theme` + `Style`

_(Rewritten 2026-09-07 from live Figma. The old Control/Container/Content collections were
consolidated away — there is no `control-*` / `container-*` / cta model any more.)_

Two collections carry the look of every component: **`Theme`** is the semantic source
(the named colour/type/geometry values), and **`Style`** is the status-aware role tier a
component actually pins. Everything a component binds resolves through one of these.

### Theme — the semantic source (single mode `Sherpa`)
The big semantic layer. Colour families as `<group>/<family>/{base, +1..+4, transparent}`
ranges (`+1..+4` = progressively lighter surfaces / darker ink), plus type and shared spacing.
Families: `default · accent · active · info · warning · urgent · critical · success`.

| group | purpose |
|---|---|
| `surface/<family>/{base,+1..+4,transparent}` | panel / control fill per family; `transparent` = the family at 10% (the SUBTLE look). |
| `border/<family>/{base,+1..+4}` | stroke per family. |
| `content/<status>/{base,+1..+4}` | text/icon ink per status (`body · info · warning · urgent · critical · success · active · link`); ramp REVERSED vs surface (base = darkest ink). |
| `content/{size,line-height,letter-spacing}/<step>`, `content/weight/*`, `content/font/*`, `content/paragraph-spacing` | typography (see §5). |
| `padding/*`, `gap/*`, `size/icon/*`, `elevation/*`, `data-viz/*` | shared spacing, icon sizes, shadow geometry, and the data-viz source colours. |

Interactive `hover` / `down` are NOT stored — the projector DERIVES them with `color-mix`
toward `currentColor` (hover = 8% ink, down = 16% ink), correct in both light and dark.

### Style — status + look role tier (12 vars, 8 modes)
The status-aware roles a component pins. **Modes = status:** `default · info · critical ·
warning · urgent · success · active · inactive`. Pin one mode on a component's root and
**every Style role re-resolves for that status**, so the whole component recolours from one
pin. Each role aliases a `Theme` family (e.g. `style-surface/base` → `surface/<family>/base`;
`active` → `surface/active/base`, `inactive` → `surface/default/+2`).

| role | purpose |
|---|---|
| `style-surface/{base, base +1, base +2, shadow}` | surface fill steps + the surface shadow. |
| `style-border/{base, base +1, width}` | stroke + width. |
| `style-content/{base, secondary, tertiary, inverse}` | text/icon ink per hierarchy; `inverse` = light ink on a saturated fill. |
| `style-indicator/accent` | the accent mark (checkbox tick, radio dot, switch track, focus). |

**Look tiers = `Style` extensions.** `Style: Transparent` (the family at 10% — the ghost/subtle
look) and `Style: Saturated` (the strong solid fill, light ink) each inherit the 8 status modes
and re-point the same roles. A component opts in with `data-look="transparent"|"saturated"`;
`data-look` composes with `data-status`.

The projector maps Style's roles to the `--_status-*` cascade contract components consume:
`--_status-surface`, `--_status-surface-strong`, `--_status-border`, `--_status-text`,
`--_status-text-on-color`, `--_status-icon` (see §6).

---

## 4. Component-scoped collections

**Bound to and named for a single component.** These exist only because that one component needs an
axis the role tiers (Style/Structure/…) don't cover (a style variant, a field state, a shell state).
A component uses these *in addition to* Style/Structure/Theme, not instead of them.

_(Button no longer has its own collection — it pins a `Structure` size extension. The old Badge
collection was removed.)_

### Switch — toggle geometry (7 vars, modes `standard` · `simple`)
Switch-specific geometry: `switch-size/{height, padding, width, thumb}`, `switch-radius/{track,
thumb}`, plus the `hasLabel` visibility flag. Colour comes from Style/Theme like any component.

### Input — field state (1 var, modes `default` · `validation`)
`hasValidation` — the visibility flag for the error/validation affordance. `validation` mode turns it on.

### Navigation — app-nav state (14 vars, modes `default·collapsed·hover·pinned·settings`)
Product-navigation shell state. `nav-surface/default`, `nav-layout/{width,padding}`,
`nav-shadow/{offset-x,offset-y,blur,spread}`, plus visibility flags (`isExpanded`,
`isHiddenCollapsed`, `isHiddenExpanded`, `hasSearchInput`, `nav-container-*`) across the rail's
interaction states.

---

## 5. Cross-cutting utility collections

**Orthogonal concerns** that apply to many components but aren't about the look tier — a component
opts into them alongside its look collections.

### Elevation — drop shadow (5 vars, modes `passthrough·sm·md·lg`)
Variable-driven drop shadow: offset-x/y, blur, spread, colour. Default `passthrough` = no shadow.

### Snapping — grouped-corner radius (`Structure` extensions)
Seamless-group corner rounding — which corners round when items sit in a segmented group.
Five `Structure: snap-<edge>` extension collections (`right-edge · left-edge · top-edge ·
bottom-edge · all-edges`) each override the four `structure-rounding/{top-left, top-right,
bottom-left, bottom-right}` corners. No pin = the rounded base. Projected as `[data-snap]`
blocks in `@layer structure`.

### Typography — type styles (flat vars inside `Theme`, 2026-09-07)
No standalone Typography collection any more — it was folded into `Theme`'s `content/`
group as **flat vars** (the old size-mode axis was flattened; there is no mode pin). Per
step (`base · h1–h5 · large · small · xs`): `content/size/<step>`, `content/line-height/
<step>`, `content/letter-spacing/<step>`. Plus the step-independent weight ramp
`content/weight/{light,regular,medium,semibold,bold,black}`, `content/paragraph-spacing`,
and the three families `content/font/{body, hero, monospaced}` (body/hero = Inter, mono =
JetBrains Mono). The projector emits these as `--sherpa-font-*` atoms + the `.sherpa-text-*`
role classes (body/hero/mono × each step) in `@layer theme`.

### Layout (Grid) — responsive breakpoints (6 vars, modes `mobile·tablet·desktop·wide`)
CSS-grid layout values per breakpoint. Extensions `Calendar Day` / `Calendar (Month-Year)` specialise it for the calendar grid.

---

## 6. How status & state tinting works (the mechanic)

_(Re-derived 2026-09-07 from live Figma bindings after the collection overhaul — the old
Container/Control collections were consolidated away.)_

- **Status is the `Style` collection's mode.** `Style` has **8 modes**: `default · info ·
  critical · warning · urgent · success · active · inactive`. Pin a Style mode on a
  component's root and every Style role re-resolves for that status, so the whole
  component recolours from one pin. Roles: `style-surface/{base, base +1, base +2, shadow}`,
  `style-border/{base, base +1, width}`, `style-content/{base, secondary, tertiary,
  inverse}`, `style-indicator/accent`.
- **Style roles alias `Theme`, not raw colour.** e.g. `style-surface/base` → `surface/
  <family>/base` (default/active status pick the matching Theme family; `inactive` →
  `surface/default/+2`). So status tinting rides the same Theme → Display Mode → Primitives
  chain as everything else — no per-status colour lives in Style.
- **Look tiers are `Style` extensions.** `Style: Transparent` and `Style: Saturated`
  inherit the 8 status modes and re-point the same roles (transparent = the tier at 10%,
  saturated = the strong fill). A component opts in with `data-look`; `data-look` +
  `data-status` compose.
- **Active / inactive** are two of the Style modes. **Practically they apply to CONTROLS and
  their content** (buttons, selects, inputs, menu items, and the text/icons within) — a
  wrapper/panel is rarely itself "active" or "inactive".

### Aliasing direction (verified from live bindings 2026-09-07)

A strict layered DAG — every edge below is a real alias count from the file:

```
components (Switch·Navigation·Input)
   → Style / Structure / Elevation / Data Viz      (the "semantic role" tier)
      → Theme                                       (surface/border/content/size/weight/font)
         → Display Mode                             (light/dark colour + scale ramp)
            → Primitives                            (raw values — the root)
```

- **Display Mode → Primitives** (184). The ramp resolves raw values per light/dark.
- **Theme → Display Mode** (168) + a few **Theme → Primitives** (28, non-colour constants).
- **Style → Theme** (80) + **Style → Display Mode** (16).
- **Structure → Display Mode** (60) + **Structure → Theme** (6). **Layout → Display Mode** (16).
- **Elevation → Theme** (16) + **Elevation → Style** (4). **Data Viz → Theme** (138).
- **Components:** Switch → Display Mode/Primitives; Navigation → Theme/Style/Elevation.
- **Extensions inherit their parent's tier:** `Display Mode: compact/comfortable` → Primitives;
  `Style: Transparent/Saturated` → Theme/Display Mode; `Structure: snap-*` → Display Mode/Theme.

This DAG is exactly the CSS `@layer` order (`core → display-mode → theme → layout →
structure → style → elevation → components`) — later layers consume earlier ones, never
the reverse.

---

## 7. Component catalogue

Type key: **Control** = interactive control · **Container** = wrapper/panel · **Composite** =
built from other components · **Display** = non-interactive presentation · **Data-viz** = charts.

### Controls (active/inactive/status are first-class)

| component | purpose | variants | key properties | collections |
|---|---|---|---|---|
| **Button** | Primary action control — label and/or icon. | Type: icon/label | hasIconStart, hasIconEnd, hasBadge | Style, Theme |
| **Tag** | Small labelled marker (dot or full). | Type: dot/full | hasIcon, hasDismiss | Style, Theme |
| **Chip** | Compact interactive token (filter/selection). | — | hasDismiss | Style, Theme |
| **Switch** | On/off toggle. | Value: off/on × State: active/inactive | hasLabel | Switch, Style, Theme |
| **Select Checkbox** | Checkable option (box + label/description). | State: active/inactive | isChecked, isFilled, hasDescription | Style, Theme |
| **Select Radio** | Single-choice option. | State: active/inactive | isChecked, hasDescription | Style, Theme |
| **Input** | Text field molecule (label + field + validation + helper). | Style: default/minimal | hasLabel, hasDescription, hasHelper, hasValidation, hasLeadingIcon, hasTrailingIcon | Input, Style, Theme |
| **Slider** | Range/value selector (track + handle). | — | — | Style, Input, Theme |
| **Select Group** | Grouped set of select options + validation. | — | hasDescription, hasValidation | Style, Theme |
| **Menu List Item** | One row of a menu/list — leading control/icon + content + trailing. | State: default/hover | hasLeadingControl, hasLeadingIcon, hasDragHandle, hasExpand, hasDescription | Style, Theme |
| **Tabs** | Tabbed navigation between views. | — | — | Style, Theme |
| **Breadcrumbs** | Hierarchical path navigation. | — | — | Style, Theme |
| **Pagination** | Page navigation (buttons + page input + results). | — | hasResults | Style, Input, Theme |
| **Quick Filter Chip** | Data/view filter chip with optional menu + badge. | State: default | hasMenu, hasIcon, hasContent, hasBadge | Style, Theme |

### Containers / wrappers (status is first-class; active/inactive are edge cases)

| component | purpose | variants | key properties | collections |
|---|---|---|---|---|
| **Container** | Base wrapper — default panel, dialog, panel, overlay-panel, accordion. | Type: default/dialog/panel/overlay-panel/accordion | expanded | Style, Theme |
| **Callout** | Inline contextual message with status surface + heading/body/action. | — | — | Style, Theme |
| **Banner** | Full-width page-level status/announcement bar. | — | hasLink | Style, Theme |
| **Toast** | Transient elevated status notification. | — | hasClose, hasAction | Style, Theme |
| **Message** | Compact inline status row (icon + text + close). | — | hasClose | Style, Theme |
| **Select Card** | Selectable card container. | — | — | Style, Theme |
| **Menu** | Elevated floating list of menu items. | — | — | Style, Theme |
| **List** | Vertical stack of list items. | — | — | Style, Theme |
| **Container Header** | Header region for a container (title + actions + toggle). | — | hasDescription, hasIcon, hasToggle, dismissible, hasDragHandle | Style, Theme |
| **Container Footer** | Footer/action-bar region for a container. | Type: action-bar | — | Style, Theme |
| **Code Block** | Monospace code panel with optional header + line numbers. | — | hasHeader, hasLineNumbers | Style, Theme |
| **Tooltip** | Small floating hint. | — | — | Style, Theme |

### Composites / layouts (assembled from other components)

| component | purpose | collections |
|---|---|---|
| **Toolbar** | Horizontal bar of controls (buttons, inputs, filters). | Style, Input, Theme |
| **View Header** | Page/view header (title + actions + search). | Style, Input, Theme |
| **App Header** | Top-level application header (logo, search, notifications). hasNotifications, hasLoadingBar. | Style, Theme |
| **Navigation Section** | Product-nav group (heading + items), isMaximised. | Style, Theme (+ Navigation) |
| **Transfer List** | Dual-pane move-items-between-lists control. | Style, Theme |
| **Quick Filter Toolbar** | Data/view filter toolbar (row of quick-filter chips). | Style, Theme |
| **Prompt Composer** | AI prompt input area with leading actions. | Style, Theme |
| **Chat Message** | Chat bubble (sent/received) with optional avatar. | Style, Theme |
| **File Uploader** | Drop-zone + file-item list. | Style, Theme |
| **Calendar (Grid)** | Month/year/day date grid. | Style, Layout, Theme |
| **Time Picker** | Time-selection menu (composed of menu items). | (composed) |
| **.Grid Cell** | One data-grid cell — Type sets treatment (Default/Primary/Numerical/Selection), content is a slot. | Style, Theme |

### Display / feedback (non-interactive)

| component | purpose | variants | collections |
|---|---|---|---|
| **Badge** | Count or dot indicator. | Type: count/dot | Theme |
| **Loader** | Spinner/loading indicator. | Size: sm/md/lg | Theme |
| **Progress Bar** | Linear determinate progress. | — | Theme |
| **Progress Steps** | Stepper showing progress through stages. | — | Style, Theme |
| **Section Header** | Section title + optional divider/actions/description. | — | Style, Theme |
| **Empty State** | No-content placeholder (illustration + text + actions). | — | Style, Theme |
| **Metric** | KPI display (label + value + delta + sparkline slot). | — | Style, Theme |
| **Key Value Pair** | Label→value pair row. | — | Style, Theme |
| **Chart Legend (Legend Item)** | Legend swatch + label + optional value. | — | Style, Theme |

### Data-viz (charts)

| component | purpose | collections |
|---|---|---|
| **Chart 2D (Data Field)** | 2D chart data field (vertical/horizontal). | Style, Theme |
| **Donut Chart** | Circular proportion chart. | Style, Theme |
| **Gauge Chart** | Radial gauge. | Style, Theme |

---

## 8. Consistency rules (use when building new components)

1. **Text/icon → `Style::style-content/{base,secondary,tertiary,inverse}`** — not a Theme
   `content/*` family directly, so the ink follows status + look-tier (`inverse` on saturated fills).
2. **Surface → `Style::style-surface/*`**; **stroke → `Style::style-border/*`**. One Style pin recolours all.
3. **Status** comes from pinning a **`Style` status mode** on the root (`data-status` at runtime). Don't hand-tint.
4. **Look tier** — opt a control into ghost/solid via `Style: Transparent` / `Style: Saturated`
   (`data-look`); it composes with status.
5. **Size / geometry → `Structure`** (size modes 2xs–xl); `height`, `icon-size`, per-corner
   `structure-rounding/*`, `structure-space/*`. Never hardcode. Button pins a `Structure` size extension.
6. **Bind the lowest appropriate tier** — the component's own scoped collection or a role tier
   (Style/Structure/Elevation) first; `Theme` only for a genuine one-off; never `Display Mode`/`Primitives`.
7. **Accent mark inside a static control** (checkbox tick, radio dot, switch track) → `Style::style-indicator/accent`.

---

*Generated from a live survey of the Sherpa-UI Figma file. Keep in sync as collections/components evolve.*
Sources for token-tier & naming conventions: [UXPin — Design Tokens Guide](https://www.uxpin.com/studio/blog/what-are-design-tokens/), [Design Token Architecture 2026](https://timgraf.com/ui/design-token-architecture-2026-the-strategic-blueprint-for-scalable-design-systems/), [Smart Interface Design Patterns — Naming Design Tokens](https://smart-interface-design-patterns.com/articles/naming-design-tokens/).
