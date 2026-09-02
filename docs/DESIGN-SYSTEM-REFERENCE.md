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

Aliasing always flows **downward** to more primitive tiers.

```
Component-scoped            Button · Switch · Input · Badge · Navigation
  (one component each)          ↓ alias
Shared abstractions         Container · Control · Content        ← the "look" foundations, consumed by MANY components
  (cross-component look)    Elevation · Snapping · Typography · Layout (Grid)   ← cross-cutting concerns
                                ↓ alias
Semantic intent             Style (Sherpa)   ← surface/*, content/*, border/*, status/*, elevation/*, data-viz/*
                                ↓ alias
Core                        Core             ← named ramps + scales (color/neutral/*, fonts/*, space/*, size/*, border/*)
                                ↓ alias
Primitives                  Primitives       ← raw hex, px, ms — never bound directly
```

**Key distinction:**
- **Container / Control / Content are NOT component-scoped.** They are shared abstractions for the
  *foundations of components* — the look of any wrapper (Container), any interactive control
  (Control), and any status-aware text (Content). Dozens of components consume them.
- **Component-scoped** means bound to and named for a *single* component: `Button::button-size`,
  `Switch::switch-*`, `Input::input-border`, `Badge::badge-*`, `Navigation::nav-*`. These exist only
  because that one component needs an axis (size, style, field-state) the shared abstractions don't provide.
- **Cross-cutting concerns** (Elevation, Snapping, Typography, Layout) apply to many components but
  aren't about "look tier" — they're orthogonal utilities (shadow, corner-snapping, type, grid).

**Golden rule:** never bind `Primitives` or `Core` directly from a component. Bind a shared
abstraction (Container/Control/Content) or the component's own scoped collection; reach `Style
(Sherpa)` only for a genuine one-off semantic value.

---

## 2. Foundation collections

### Primitives — raw values (360 vars, 1 mode `value`)
The laboratory-grade layer. Raw hex colours (291), effects (28), border values (20), scale
steps (15), motion timings (6). **Never bound directly** — only aliased by Core.

### Core — named ramps & scales (180 vars, 1 mode `value`)
The named-token layer between raw and semantic. Colour ramps (`color/neutral/*`,
`color/basic/greyscale/*`, `color/brand/*`, `color/accent/*`, `color/extended/*`), font scale
(`fonts/scale/*`, `fonts/weight/*`), spacing (`space/*`), sizing (`size/*`), border
(`border/*`). Extensions **compact / comfortable** provide density variants of spacing/sizing.
Bound only via a semantic or component collection — not directly.

### Style (Sherpa) — the semantic intent layer (236 vars, modes `light` / `dark`)
**The most important layer.** Holds *intent*, and owns light/dark theming (every downstream
collection inherits theme from here). Variable groups:

| group | purpose |
|---|---|
| `surface/*` | semantic surfaces: `surface/interactive/{base,hover,down,primary,tertiary}`, `surface/{primary,secondary,tertiary}/base`, `surface/active/*`, `surface/inactive` |
| `content/*` | semantic text/icon ink per role & context: `content/{title,primary,secondary,tertiary}/{base,on-color,on-color-subtle}`, `content/link/*`, `content/inactive/*`, `content/active/base` |
| `border/*` | semantic borders: `border/interactive/*`, `border/primary`, `border/interactive/active` |
| `status/*` | the 5 status ramps × 6 steps (`status/{info,critical,warning,urgent,success}/color 1..6`). 1 = lightest tint, 6 = darkest ink. This is where status colour lives. |
| `elevation/*` | shadow tints (incl. status-tinted variants) |
| `data-viz/*` | 99 chart series colours (categorical + sequential + divergent ramps) |

**Ramp convention (status):** `color 2` = light surface tint · `color 4` = mid fill · `color 5`
= saturated bold fill / border · `color 6` = dark ink · `color 1` = light ink (on a fill).

---

## 3. Shared abstractions — the "look" foundations of components

**Not component-scoped.** These three abstract the look of a *kind* of thing — any control, any
wrapper, any status-aware text — and are consumed by dozens of components. They are the primary
collections a new component binds. Each abstracts one concern and aliases down to Style.

### Control — interactive-control look (23 vars, modes `default` · `cta` · `subtle`)
The look of an interactive control (button, tag, chip, input, select). **Modes = look-tier:**
- `default` — neutral (white surface, dark ink, grey border). *The default.*
- `cta` — the accent/primary call-to-action (accent fill, **light** ink).
- `subtle` — transparent/ghost (no fill, dark ink).

*(Selected/active state is not a Control mode — see the Container `active` note and `control-accent`.)*

| group | purpose |
|---|---|
| `control-surface/*` | control fill: `default/hover/down`. Aliases **Container** at `default`, Style accent/transparent at cta/subtle. |
| `control-border/*` | control stroke + `control-border/width` |
| `control-content/*` | **control text/icon ink per role** (`title/primary/secondary/tertiary/link`). Switches **dark → light per look-tier** (dark on default/subtle, light on the cta fill) AND tints with status via the container-content chain. **This is the universal text binding for all component text.** |
| `control-accent/*` | the accent fill used for the *content inside* a control that stays interactive while the container doesn't change — checkbox thumbs, radio fills, switch tracks. Has `default/hover/down`. |
| `control-space/*` | padding & gap presets |

### Container — wrapper/panel look + status (19 vars, modes below)
The look of a **wrapper/panel** (callout, card, panel, menu, list, dialog) and the **carrier of
status**. Status tinting for any component flows from here (the Container mode trickles into
instances). **Modes:**

| mode | meaning |
|---|---|
| `primary` (was passthrough) | the default neutral panel — **the default** |
| `secondary` · `tertiary` | quieter panel look-tiers |
| `info · critical · warning · urgent · success` | **status** — surface/border/content tint to the status ramp |
| `inactive` | disabled/greyed |
| `active` | selected (purple). *Rare on containers — usually a control concern (see §6).* |

| group | purpose |
|---|---|
| `container-surface/*` | panel fill: `default/hover/down`. Status modes → status ramp; look-tiers → neutral. |
| `container-border/*` | panel stroke + radius (per corner) + width |
| `container-content/*` | panel text/icon ink per role (`title/primary/secondary/tertiary`). Status modes → dark status ink; the source the Content and Control text chains resolve through. |
| `container-space/*` | padding & gap presets |

Extension **Saturated** — the bold filled variant: surface → status `color 5` (dark), content → light.
Pin it when a status container wants a solid fill instead of a subtle tint.

### Content — standalone text status (6 vars, modes `passthrough` · `status`)
For text that isn't inside a control but still needs status behaviour. **`status` (default) aliases
`Container::container-content/{role}`** so unpinned text follows whatever status container it sits in;
`passthrough` is neutral. Vars: `content/{title,primary,secondary,tertiary}` + `content/link/{base,visited}`.

---

## 4. Component-scoped collections

**Bound to and named for a single component.** These exist only because that one component needs an
axis the shared abstractions don't cover (a size scale, a style variant, a field state). A component
uses these *in addition to* Control/Container/Content, not instead of them.

### Button — button sizing (6 vars, modes `2xs·xs·sm·md·xl·2xl·3xl`)
Size-only axis for the Button component (and size-borrowing components like Chip). Groups:
`button-size` (height, icon), `button-space` (padding, gap), `button-font` (size, line-height).

### Switch — toggle look (12 vars, modes `standard` · `simple`)
Switch-specific: `switch-size`, `switch-surface` (track), `switch-content` (thumb/track ink),
`switch-radius`.

### Input — field state (5 vars, modes `default` · `validation`)
Input border state: `input-border/*`. `validation` mode = the error/validation border treatment.

### Badge — badge colour (3 vars, modes `default` · `brand` · `accent`)
Small count/dot badge. `badge-surface/border/content`. Modes = colour theme (neutral/brand purple/accent blue).

### Navigation — app-nav state (10 vars, modes `default·collapsed·hover·pinned·settings`)
Product-navigation shell state. Surfaces/sizes/spacing for the nav rail across its interaction states.

---

## 5. Cross-cutting utility collections

**Orthogonal concerns** that apply to many components but aren't about the look tier — a component
opts into them alongside its look collections.

### Elevation — drop shadow (5 vars, modes `passthrough·sm·md·lg`)
Variable-driven drop shadow: offset-x/y, blur, spread, colour. Default `passthrough` = no shadow.

### Snapping — grouped-corner radius (5 vars, modes `passthrough·*-edge·isolated·all-edges`)
Seamless-group corner rounding — which corners round when items sit in a segmented group.
`snapping-radius/{top-left,top-right,bottom-left,bottom-right}` + `snapping-space`.

### Typography — type styles (6 vars, size modes + weight/family extensions)
**Modes = size:** `H1·H2·H3·H4·H5·large·base·small·extra-small`. **Extensions = use-case → weight:**
`Hero` / `Mono` families each with `light·medium·semibold·bold·black` weight sub-extensions (Brand
is the default family on the base). One pin (a weight ext at a size mode) = full type style. Vars:
`size, line-height, letter-spacing, paragraph, weight, family`.

### Layout (Grid) — responsive breakpoints (6 vars, modes `mobile·tablet·desktop·wide`)
CSS-grid layout values per breakpoint. Extensions `Calendar Day` / `Calendar (Month-Year)` specialise it for the calendar grid.

---

## 6. How status & state tinting works (the mechanic)

- **Status trickles from the Container mode.** Pin a Container status mode on a component's root and
  it inherits into the instance — surface, border, and (via the chain) content all tint.
- **All component text binds `control-content/{role}`.** This one binding gives: (a) dark/light ink
  switching per Control look-tier (light on cta), and (b) status tinting, because control-content
  chains through `container-content` which is driven by the Container mode. This is the "Button pattern."
- **Active / inactive** are Container/Control state modes. **Practically they apply to CONTROLS and
  their content** (buttons, selects, inputs, menu items, and the text/icons within) — a wrapper/panel
  is rarely itself "active" or "inactive". Treat active/inactive as first-class on controls, edge cases
  on containers.
- **Aliasing direction:** Control → Container → Style → Core → Primitives. (Control is the leaf;
  Container is the broader source; both consume Style.)

---

## 7. Component catalogue

Type key: **Control** = interactive control · **Container** = wrapper/panel · **Composite** =
built from other components · **Display** = non-interactive presentation · **Data-viz** = charts.

### Controls (active/inactive/status are first-class)

| component | purpose | variants | key properties | collections |
|---|---|---|---|---|
| **Button** | Primary action control — label and/or icon. | Type: icon/label | hasIconStart, hasIconEnd, hasBadge | Button, Control, Badge, Typography |
| **Tag** | Small labelled marker (dot or full). | Type: dot/full | hasIcon, hasDismiss | Control, Container, Button, Typography |
| **Chip** | Compact interactive token (filter/selection). | — | hasDismiss | Control, Container, Button, Typography |
| **Switch** | On/off toggle. | Value: off/on × State: active/inactive | hasLabel | Switch, Control, Typography |
| **Select Checkbox** | Checkable option (box + label/description). | State: active/inactive | isChecked, isFilled, hasDescription | Control, Typography |
| **Select Radio** | Single-choice option. | State: active/inactive | isChecked, hasDescription | Control, Container, Typography |
| **Input** | Text field molecule (label + field + validation + helper). | Style: default/minimal | hasLabel, hasDescription, hasHelper, hasValidation, hasLeadingIcon, hasTrailingIcon | Input, Control, Container, Typography |
| **Slider** | Range/value selector (track + handle). | — | — | Control, Container, Input, Typography |
| **Select Group** | Grouped set of select options + validation. | — | hasDescription, hasValidation | Control, Typography |
| **Menu List Item** | One row of a menu/list — leading control/icon + content + trailing. | State: default/hover | hasLeadingControl, hasLeadingIcon, hasDragHandle, hasExpand, hasDescription | Control, Container, Button, Typography |
| **Tabs** | Tabbed navigation between views. | — | — | Control, Typography |
| **Breadcrumbs** | Hierarchical path navigation. | — | — | Control, Typography |
| **Pagination** | Page navigation (buttons + page input + results). | — | hasResults | Button, Control, Container, Input, Typography |
| **Quick Filter Chip** | Data/view filter chip with optional menu + badge. | State: default | hasMenu, hasIcon, hasContent, hasBadge | Control, Container, Badge, Button, Typography |

### Containers / wrappers (status is first-class; active/inactive are edge cases)

| component | purpose | variants | key properties | collections |
|---|---|---|---|---|
| **Container** | Base wrapper — default panel, dialog, panel, overlay-panel, accordion. | Type: default/dialog/panel/overlay-panel/accordion | expanded | Container, Control, Button, Badge, Typography |
| **Callout** | Inline contextual message with status surface + heading/body/action. | — | — | Container, Control, Typography |
| **Banner** | Full-width page-level status/announcement bar. | — | hasLink | Container, Control, Typography |
| **Toast** | Transient elevated status notification. | — | hasClose, hasAction | Container, Control, Typography |
| **Message** | Compact inline status row (icon + text + close). | — | hasClose | Container, Control, Typography |
| **Select Card** | Selectable card container. | — | — | Container, Control, Typography |
| **Menu** | Elevated floating list of menu items. | — | — | Container, Control, Button, Typography |
| **List** | Vertical stack of list items. | — | — | Container, Control, Button, Typography |
| **Container Header** | Header region for a container (title + actions + toggle). | — | hasDescription, hasIcon, hasToggle, dismissible, hasDragHandle | Container, Control, Button, Typography |
| **Container Footer** | Footer/action-bar region for a container. | Type: action-bar | — | Container, Control, Button, Badge, Typography |
| **Code Block** | Monospace code panel with optional header + line numbers. | — | hasHeader, hasLineNumbers | Container, Control, Button, Typography |
| **Tooltip** | Small floating hint. | — | — | Control, Typography |

### Composites / layouts (assembled from other components)

| component | purpose | collections |
|---|---|---|
| **Toolbar** | Horizontal bar of controls (buttons, inputs, filters). | Badge, Button, Container, Control, Input, Typography |
| **View Header** | Page/view header (title + actions + search). | Badge, Button, Container, Control, Input, Typography |
| **App Header** | Top-level application header (logo, search, notifications). hasNotifications, hasLoadingBar. | Badge, Button, Container, Control, Typography |
| **Navigation Section** | Product-nav group (heading + items), isMaximised. | Control, Typography (+ Navigation) |
| **Transfer List** | Dual-pane move-items-between-lists control. | Button, Container, Control, Typography |
| **Quick Filter Toolbar** | Data/view filter toolbar (row of quick-filter chips). | Badge, Button, Container, Control, Typography |
| **Prompt Composer** | AI prompt input area with leading actions. | Button, Container, Control, Typography |
| **Chat Message** | Chat bubble (sent/received) with optional avatar. | Control, Typography |
| **File Uploader** | Drop-zone + file-item list. | Badge, Button, Control, Typography |
| **Calendar (Grid)** | Month/year/day date grid. | Badge, Button, Container, Control, Layout (Grid), Typography |
| **Time Picker** | Time-selection menu (composed of menu items). | (composed) |
| **.Grid Cell** | One data-grid cell — Type sets treatment (Default/Primary/Numerical/Selection), content is a slot. | Container, Control, Typography |

### Display / feedback (non-interactive)

| component | purpose | variants | collections |
|---|---|---|---|
| **Badge** | Count or dot indicator. | Type: count/dot | Badge, Typography |
| **Loader** | Spinner/loading indicator. | Size: sm/md/lg | Style (Sherpa) |
| **Progress Bar** | Linear determinate progress. | — | Style (Sherpa) |
| **Progress Steps** | Stepper showing progress through stages. | — | Control, Style (Sherpa) |
| **Section Header** | Section title + optional divider/actions/description. | — | Control, Typography |
| **Empty State** | No-content placeholder (illustration + text + actions). | — | Control, Typography |
| **Metric** | KPI display (label + value + delta + sparkline slot). | — | Container, Control, Typography |
| **Key Value Pair** | Label→value pair row. | — | Control, Typography |
| **Chart Legend (Legend Item)** | Legend swatch + label + optional value. | — | Control, Typography |

### Data-viz (charts)

| component | purpose | collections |
|---|---|---|
| **Chart 2D (Data Field)** | 2D chart data field (vertical/horizontal). | Container, Style (Sherpa) |
| **Donut Chart** | Circular proportion chart. | Control, Style (Sherpa) |
| **Gauge Chart** | Radial gauge. | Container, Control, Style (Sherpa) |

---

## 8. Consistency rules (use when building new components)

1. **Text/icon → `Control::control-content/{role}`** (title/primary/secondary/tertiary/link). Never
   bind `Style::content/*` directly on a component — you'd lose status tinting + look-tier ink.
2. **Control surface → `Control::control-surface/*`**; **wrapper surface → `Container::container-surface/*`.**
3. **Status** comes from pinning the **Container** status mode on the root (it trickles). Don't hand-tint.
4. **Active / inactive** — set on **controls** (and their content), rarely on wrapper containers.
5. **Size** via the component's own collection modes (Button sizes), not hardcoded.
6. **Bind the lowest appropriate tier** — a component collection first; `Style (Sherpa)` only for a
   genuine one-off semantic value; never `Core`/`Primitives` directly.
7. **Accent content inside a static control** (checkbox thumb, radio fill, switch track) → `control-accent/*`.

---

*Generated from a live survey of the Sherpa-UI Figma file. Keep in sync as collections/components evolve.*
Sources for token-tier & naming conventions: [UXPin — Design Tokens Guide](https://www.uxpin.com/studio/blog/what-are-design-tokens/), [Design Token Architecture 2026](https://timgraf.com/ui/design-token-architecture-2026-the-strategic-blueprint-for-scalable-design-systems/), [Smart Interface Design Patterns — Naming Design Tokens](https://smart-interface-design-patterns.com/articles/naming-design-tokens/).
