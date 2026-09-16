# Sherpa-UI — Figma Design System (comprehensive reference)

Source of truth = the Figma file **Sherpa-UI** (`fileKey: UnBEepLWb6d7b9ykm33j2s`),
read live 2026-09-08. This document captures the whole variable + component model so it
can be referenced without re-querying Figma. When in doubt, re-read Figma; this is a
snapshot. (Companion: `docs/DESIGN-SYSTEM-REFERENCE.md` — the aliasing narrative; this
file is the structural inventory.)

---

## 0. The six primitives (the whole vocabulary)

The design system is the **interplay of six Figma primitives** — comprehensive, scalable,
robust because appearance is COMPOSED from them, not hard-coded per component:

1. **Components** — the building blocks (`sherpa-*`). §5.
2. **Variants** — discrete named states baked into a component SET; pick one row of an axis
   (`Type=`, `State=`, …). §5.
3. **Properties** — instance knobs that tune without switching variant: TEXT · BOOLEAN ·
   INSTANCE_SWAP · SLOT. §5.
4. **Variable collections** — the token groups (Primitives, Display Mode, Theme, Style,
   Structure, Elevation, Layout, Data Viz + the component ones). §1–4.
5. **Extensions** — collections that INHERIT a parent's modes and override values (Saturated,
   Transparent, snap-*, compact/comfortable, Calendar/App-Shell). §1.
6. **Modes** — the selectable columns within a collection you PIN to choose values (status,
   size, light/dark, breakpoint, palette, rail-state). §1, §6.

**How they combine:** a component's final appearance = its **variant** + its **properties**,
with colour/geometry/spacing/shadow resolved through whichever **collections / extensions /
modes** are pinned on it or an ancestor. Scalable because you add a MODE, not a variant;
robust because one mode pin recolours a whole component (and its subtree). §6 tabulates the
effect of applying each.

### The mental model in one paragraph

Everything resolves down a strict tier chain: **component-scoped** collections and
**role tiers** (Style/Structure/Elevation/Layout/Data Viz) alias **Theme** (the semantic
layer) which aliases **Display Mode** (named ramps + light/dark) which aliases
**Primitives** (raw values). A component's **look** is not a per-component variant — it
is composed by *applying collections/modes*: pin a **Style** status mode for status
colour, pick a **Style appearance extension** (Transparent/Saturated) for emphasis, pick
a **Structure** size mode for geometry, a **Display Mode** density extension for spacing,
an **Elevation** mode for shadow, a **Structure snap** extension for grouped corners.
Components stay dumb; the collections carry the meaning.

---

## 1. Collections (23) — the full inventory

| Collection | Modes | Vars | Kind |
|---|---|---|---|
| **Primitives** | value | 245 | utility (root; never bound directly) |
| **Display Mode** | light · dark | 164 | utility (named ramps + owns light/dark) |
| **Theme** | Sherpa | 339 | utility (the semantic layer) |
| **Structure** | default · 2xs · xs · sm · lg · xl | 11 | utility (anchor sizing/geometry) |
| **Style** | default · info · critical · warning · urgent · success · active · inactive | 12 | utility (status + appearance look) |
| **Elevation** | passthrough · sm · md · lg · inset | 5 | utility (shadow) |
| **Layout** | mobile · tablet · desktop · wide | 7 | utility (responsive grid) |
| **Data Viz** | categorical · sequential/* (11) · divergent/* (3) | 11 | utility (chart series) |
| **Switch** | standard · simple | 7 | component (Switch) |
| **Navigation** | default · collapsed · hover · pinned · settings | 14 | component (Nav) |
| **Input** | default · validation | 1 | component (Input) |
| Display Mode: compact | light · dark | 164 | **extension** of Display Mode (density) |
| Display Mode: comfortable | light · dark | 164 | **extension** of Display Mode (density) |
| Style: Transparent | (8 status modes) | 12 | **extension** of Style (appearance) |
| Style: Saturated | (8 status modes) | 12 | **extension** of Style (appearance) |
| Structure: snap-right-edge | (6 size modes) | 11 | **extension** of Structure |
| Structure: snap-all-edges | (6 size modes) | 11 | **extension** of Structure |
| Structure: snap-left-edge | (6 size modes) | 11 | **extension** of Structure |
| Structure: snap-bottom-edge | (6 size modes) | 11 | **extension** of Structure |
| Structure: snap-top-edge | (6 size modes) | 11 | **extension** of Structure |
| Layout: Calendar D | (4 breakpoints) | 7 | **extension** of Layout |
| Layout: Calendar M/Y | (4 breakpoints) | 7 | **extension** of Layout |
| Layout: App Shell | (4 breakpoints) | 7 | **extension** of Layout |

**Extension lineage (verified via parentModeId):** compact/comfortable → Display Mode
`light`; Transparent/Saturated → Style `default`; snap-* → Structure `default`;
Calendar/App-Shell → Layout `mobile`. An extension INHERITS its parent's modes + vars and
overrides values; it cannot add modes. Pinning an extension mode on a node swaps the whole
family for that node's subtree.

### Utility vs component-specific
- **Utility (shared, consumed by many):** Primitives, Display Mode, Theme, Structure,
  Style, Elevation, Layout, Data Viz + all their extensions.
- **Component-specific (named for one component):** Switch (`switch-*`), Navigation
  (`nav-*`), Input (`hasValidation`). Everything else composes from the utility tiers —
  there is deliberately NO per-component colour/variant collection (Button, Tag, etc. have
  none; that's the point).

---

## 2. The tiers (aliasing flows DOWN)

```
component-scoped (Switch · Navigation · Input)
   → role tiers: Style · Structure · Elevation · Layout · Data Viz
      → Theme            (surface/* border/* content/* size/* weight/* font/* padding/* gap/* elevation/* data-viz/*)
         → Display Mode  (color/* ramps, color-transparent/*, fonts/scale, fonts/weight, space/*, size/*, border/*; light+dark)
            → Primitives (color/basic, color/extended, scale/*, border/*, effects/*, motion/*)
```
Golden rule: a component binds a role tier or its own scoped collection — never Primitives
or Display Mode directly. Reach Theme only for a genuine one-off.

---

## 3. Utility collections in detail

### Primitives (245, mode `value`)
Raw values, never bound directly. Groups: `color/basic` (88), `color/extended` (88),
`scale/*` (16 steps 0–800), `border/{radius,stroke,dash}`, `effects/{opacity,offset,spread,blur}`,
`motion/duration` (6).

### Display Mode (164, modes `light`/`dark`) — the named layer + owns light/dark
Groups: `color/{neutral,brand,accent,info,warning,urgent,critical,success,tones}` (5 each),
`color-transparent/*` (same families @ alpha), `color/app`, `fonts/scale` (20: 2xs…14xl),
`fonts/weight` (6: 300–900), `space/*` (none…6xl), `size/*` (none…6xl), `border/{rounding,width}`.
Components stay mode-agnostic; light/dark is resolved HERE. **Density extensions**
(compact/comfortable) override the space/size subset.

### Theme (339, mode `Sherpa`) — the semantic layer
- **surface/`<family>`/{base,+1,+2,+3,+4,transparent}** — panel/control fills. Families:
  default · accent · active · info · warning · urgent · critical · success. `+1..+4` step
  lighter; `transparent` = family @10% (the SUBTLE look).
- **border/`<family>`/{base,+1..+4}** — strokes, same families.
- **content/`<status>`/{base,+1..+4}** — ink per status (body · info · warning · urgent ·
  critical · success · active · link). Ramp REVERSED vs surface (base = darkest ink).
- **content/{size,line-height,letter-spacing}/`<step>`** (9 steps: base·h1–h5·large·small·xs),
  **content/weight/**{light,regular,medium,semibold,bold,black}, **content/paragraph-spacing**,
  **content/font/**{body,hero,monospaced} — the TYPOGRAPHY (folded in from the old Typography
  collection; flat vars, no modes).
- **padding/**{none,xs,sm,md,lg}, **gap/**{sm,md,lg,xl} — shared spacing.
- **size/icon/**{2xs…xl} — icon sizes. **elevation/**{blur,offset,spread} — shadow geometry.
- **data-viz/**{categorical(11),sequential(11 ramps),divergent(3)} — chart source colours.

### Style (12, 8 status modes) — status + appearance ("the look")
Roles a component pins: `style-surface/{base,base +1,base +2,shadow}`,
`style-border/{base,base +1,width}`, `style-content/{base,secondary,tertiary,inverse}`,
`style-indicator/accent`. Each aliases a Theme family. **Modes = status**
(default/info/critical/warning/urgent/success/active/inactive): one pin recolours the
whole component. **Appearance = the two extensions:**
- **Style: Transparent** = the ghost/subtle appearance (family @ ~10%).
- **Style: Saturated** = the strong solid-fill appearance (bold fill, light ink).
- default (no extension) = the neutral appearance.
Projected to CSS as the `--_status-*` cascade + `[data-look="transparent"|"saturated"]`
+ `[data-status="…"]` (see §6).

### Structure (11, 6 size modes) — anchor geometry
`height`, `icon-size`, `structure-space/{padding,gap}`, `structure-font/{size,line-height,weight}`,
`structure-rounding/{top-left,top-right,bottom-left,bottom-right}`. Modes = SIZE
(default·2xs·xs·sm·lg·xl). Snap extensions override the 4 rounding corners for grouped edges.

### Elevation (5, modes passthrough·sm·md·lg·inset)
`offset-x`, `offset-y`, `blur`, `spread`, `color`. Pin a mode → a drop shadow; passthrough = none; inset = inner.

### Layout (7, modes mobile·tablet·desktop·wide) — responsive grid
`layout-grid/{columns,padding,gap-horizontal,gap-vertical,row-height,max-width}`, `breakpoint`.
Extensions specialise it: Calendar D, Calendar M/Y, App Shell.

### Data Viz (11, mode = palette)
`series/1..11`. Modes select the palette: categorical (default), 11 sequential ramps, 3
divergent. Pin a palette mode → the 11 series vars re-resolve.

---

## 4. Component-specific collections
- **Switch** (7): `switch-size/{height,width,thumb,padding}`, `switch-radius/{track,thumb}`,
  `hasLabel`. Modes: standard · simple.
- **Navigation** (14): `nav-surface/default`, `nav-layout/{width,padding}`,
  `nav-shadow/{offset-x,offset-y,blur,spread}`, + visibility booleans (isExpanded,
  isHiddenCollapsed, isHiddenExpanded, hasSearchInput) + string slots (nav-container-*).
  Modes = rail state: default · collapsed · hover · pinned · settings.
- **Input** (1): `hasValidation`. Modes: default · validation.

---

## 5. Components (65) — variants AND properties

**Two independent mechanisms — any component (COMPONENT or COMPONENT_SET) can use either
or both:**
- **Variants** = discrete named states baked into a COMPONENT_SET; you *pick one row* of an
  axis. Axis names are capitalised (`Type=`, `State=`, `Value=`, `Orientation=`, `Variant=`,
  `Size=`). Detected as `componentPropertyDefinitions[x].type === 'VARIANT'`.
- **Properties** = adjustable knobs on an *instance* that tune it WITHOUT switching variant.
  Four types: **TEXT** (a string, e.g. `label`), **BOOLEAN** (a toggle, e.g. `hasIcon`),
  **INSTANCE_SWAP** (swap a nested instance, e.g. `iconStart`), **SLOT** (an exposed
  content region, e.g. `content`). Named lowerCamel/kebab (label, hasIcon, right-actions).

A single COMPONENT (no set) still has properties, and a component with variants also has
properties — the two are orthogonal. Below, **V:** = variant axes (pick one), **P:** =
instance properties (tune). `SET` = COMPONENT_SET, `C` = single COMPONENT.

### Controls
- **Button** SET — V: Type=icon\|label, State=Default · P: label(T), hasIconStart(B),
  hasIconEnd(B), hasBadge(B), iconStart(swap), iconEnd(swap). NB emphasis is NOT a variant —
  it's the Style appearance (Saturated=primary / default=secondary / Transparent=tertiary).
- **Tag** SET — V: Type=dot\|full · P: label(T), hasIcon(B), hasDismiss(B).
- **Chip** C — V: — · P: label(T), hasIcon(B), hasDismiss(B).  (a plain component with props, no variants)
- **Switch** SET — V: Value=off\|on · P: hasLabel(B).
- **Checkbox (Atom)** C — P: isChecked(B). **Select Checkbox** C — P: label(T), description(T), hasDescription(B).
- **Radio (Atom)** C — P: isChecked(B). **Select Radio** C — P: label(T), description(T), hasDescription(B).
- **Fieldset** C — P: legend(T), description(T), hasDescription(B), validation(T), hasValidation(B), options(SLOT).
- **Slider** C — P: label(T), fill(SLOT), fill-secondary(SLOT).
- **Pagination** C — P: pageSize(T), currentPage(T), totalPages(T), hasResults(B).
- **Filter Chip (atom / Quick Filter Chip)** SET — V: State=default · P: hasMenu(B), hasIcon(B), hasIndicator(B), label(T), hasLabel(B).
- **Filter Toolbar (Quick Filter Toolbar)** SET — V: Type=data\|view · P: content(SLOT), right-actions(SLOT).

### Containers / surfaces
- **Container** C · **Dialog** C · **Overlay Panel** C · **Panel** C — P: hasHeader(B), hasFooter(B), content(SLOT).
- **Accordion** C — P: hasHeader(B), content(SLOT).
- **Container Header** SET — V: Variant=default\|accordion\|Panel · P: heading(T), hasDragHandle(B),
  hasActions(B), actions(SLOT), hasIcon(B), metadata(SLOT), hasMetadata(B).
- **Container Footer** SET — V: Type=action-bar · P: content(SLOT), left(SLOT), right(SLOT).
- **Select Card** C — (no variants, no props — state is behavioural).

### Feedback / messaging
- **Callout** C — P: heading(T). **Banner** C — P: message(T), hasLink(B).
- **Toast** C — P: heading(T), value(T), hasClose(B), hasAction(B).
- **Section Header** C — P: heading(T), description(T), hasDivider(B), hasActions(B), hasDescription(B), Actions(SLOT).
- **Empty State** C — P: heading(T), description(T), hasSmallPrint(B), hasActions(B).
- **Tooltip (atom)** C — P: label(T).
- **Chat Message** SET — V: Type=assistant\|user\|system · P: name(T), timestamp(T), message(T), hasAvatar(B).
- **Prompt Composer** C — P: placeholder(T), hasLeadingActions(B).
- **Loading Spinner (atom)** SET — V: Size=lg\|md\|sm · P: label(T), hasLabel(B).
- **Progress Bar (atom)** C — P: fill(SLOT).
- **Progress Steps** C — P: Content(SLOT). **Progress Step (atom)** C — P: hasInput(B), hasOutput(B). **Connector (atom)** C — none.
- **Indicator (atom / "Badge")** SET — V: Type=count\|dot · P: none.

### Navigation / lists / structure
- **Breadcrumbs** C — none. **Tab Group (Tabs)** C — P: tablist(SLOT). **Tab** C — none.
- **Menu List Item** C — P: trailing(SLOT), label(T), description(T), hasDescription(B),
  hasLeadingIcon(B), hasDragHandle(B), leadingControl(swap), hasLeadingControl(B), hasLeading(B), hasExpand(B).
- **List** C — none. **Menu** C — none. **Toolbar** C — P: leading(SLOT), trailing(SLOT).
  **View Header** C — P: left(SLOT), right(SLOT).
- **Key Value Pair** C — P: key(T), value(T).
- **Navigation Item** C — P: hasIcon(B), hasIndicator(B), isMaximised(B), content(SLOT).
- **Navigation Section/default** C — P: isMaximised(B). **Primary Navigation** C — P: content(SLOT).
- **App Header** C — P: hasNotifications(B), hasLoadingBar(B), loading-bar(SLOT), Actions(SLOT), History(SLOT), Title Row(SLOT).
- **Grid Cell** SET — V: Type=cell\|header\|group\|filter · P: Content(SLOT), hasCheckbox(B), hasActions(B).

### Charts / data / misc
- **Metric** C — P: label(T), value(T), delta(T), Sparkline(SLOT).
- **Chart Legend** C — P: Content(SLOT). **Legend Item** C — P: label(T), value(T), hasValue(B).
- **Data Field** SET — V: Orientation=vertical\|horizontal · P: Content(SLOT).
- **Chart Axis** SET — V: Orientation=vertical\|horizontal · P: Content(SLOT), Content2(SLOT).
- **Donut Chart** C — P: Segments(SLOT). **Gauge Chart** C — P: Arcs(SLOT).
- **Transfer List** C — none. **File Uploader** C — none. **File Item** C — none.
- **Calendar** SET — V: Type=single\|range · P: content(SLOT), header(SLOT), hasTime(B).
  **Calendar Button** SET — V: State=default\|today\|selected-range · P: label(T). **time-clock** C — none.
- **Time Picker** — two variants exist: one C (no props) + one C — P: value(T).
- **Icon** C — P: glyph(INSTANCE_SWAP). (icon library; sized via Structure/Theme size/icon.)
- **Code Block** C — P: hasHeader(B), hasLineNumbers(B), language(T).

**Property-type legend:** T=TEXT · B=BOOLEAN · swap=INSTANCE_SWAP · SLOT=exposed content region.

---

## 6. How applying a collection/mode/extension affects a component

| Apply | Effect | CSS projection |
|---|---|---|
| **Style status mode** (info/critical/…) | recolours surface+border+content+indicator to that status | `[data-status="…"]` → `--_status-*` cascade |
| **Style: Saturated** appearance | strong solid fill + light ink ("primary") | `[data-look="saturated"]` |
| **Style: Transparent** appearance | ghost / subtle (family @10%) ("tertiary") | `[data-look="transparent"]` |
| (no Style extension) | neutral surface + grey border + dark ink ("secondary"/default) | default `--_status-*` fallbacks |
| **Structure size mode** (2xs…xl) | height, padding, gap, font size/lh, corner radius scale | `[data-size="…"]` |
| **Structure snap-*** extension | overrides the 4 corner radii for grouped/segmented edges | `[data-snap="right|all|left|top|bottom"]` |
| **Display Mode dark** | whole ramp re-resolves for dark | `:root[data-mode="dark"]` / prefers-color-scheme |
| **Display Mode density** (compact/comfortable) | tightens/loosens space+size | `[data-density="compact|comfortable"]` |
| **Elevation mode** (sm/md/lg/inset) | applies a drop/inner shadow | `[data-elevation="…"]` |
| **Layout breakpoint** | grid columns/gap/max-width per viewport | `.sherpa-view` grid + breakpoints |
| **Data Viz palette mode** | series/1..11 re-resolve to that palette | categorical vars / per-chart |

Emphasis is COMPOSED, not a variant: `data-look` (appearance) × `data-status` (colour)
compose — e.g. `data-look="saturated" data-status="critical"` = a bold red button.

---

## 7. Naming conventions, scales, standards

- **Element names:** every custom element is `sherpa-*`. Public API via `data-*`; native
  attrs (disabled/name/value/hidden/required/readonly) stay unprefixed. Component-private
  CSS state is `--_*`.
- **Events:** unprefixed `noun-verb` (button-click, page-change, item-expand), bubbles+composed.
  Native re-dispatches keep the native name (change, input, close, toggle). Every emitted
  event has a matching TS `@fires`.
- **Variable naming:** `<group>/<family>/<step>` in Theme; role tiers prefix with their
  concern (`style-*`, `structure-*`, `nav-*`, `switch-*`, `layout-grid/*`). Steps: `base` +
  `+1..+4` (surfaces lighten; content ink darkens at base). Sizes: none·3xs·2xs·xs·sm·md·
  lg·xl·2xl…6xl. Type steps: base·h1–h5·large·small·xs. Status set (8): default·info·
  critical·warning·urgent·success·active·inactive.
- **Appearance ↔ old variant names:** default = "secondary", Saturated = "primary",
  Transparent = "tertiary". Use appearance (data-look), not primary/secondary/tertiary.
- **Scale:** 8px grid (4px text sub-grid; 2px/1px edge cases). Radius rounding scale
  none·sm·base·lg·xl·2xl·full. Font scale 2xs(10)·xs·sm·base(14)·lg(16)·xl(20)·2xl(24)…
- **Colour tokens always with a hardcoded fallback:** `var(--sherpa-*, #hex)`. Never bind
  `--core-*`/Primitives/Display Mode directly from a component.
- **Progressive enhancement:** native HTML+CSS first, JS last. CSS owns all visibility/state
  (JS sets `data-*`; CSS selects `:host([data-*])`). No createElement for structure (cloning
  prototypes). Disabled uses inactive tokens per property, never opacity.
- **Density/mode axes** live on `<html>` (data-mode, data-theme, data-density); status/look/
  size/snap/elevation live on the component or an ancestor.

---

## 8. Things to note (gotchas + specifics)

- **Icons** are a component library (`Icon`, glyph swap); used by INSTANCE, sized by binding
  width/height to `content/size/*` (so an icon matches neighbouring text). NOT an icon font.
- **Charts** keep raw marks; series colour = Data Viz palette. Chart components expose SLOTs
  (Segments/Arcs/Content) the data fills.
- **Atoms vs composed:** several components are `(atom)` building blocks (Checkbox/Radio atom,
  Indicator atom, Progress Step atom, Connector atom, Loading Spinner atom, Tooltip atom,
  Filter Chip atom) used only inside a parent — excluded from the public catalog.
- **Two files share the plugin:** the bridge may have "[Apex 2.0] Core" active, not Sherpa-UI.
  To screenshot a Sherpa node, first `setCurrentPageAsync` + select it via `figma_execute`
  (fileKey UnBEepLWb6d7b9ykm33j2s), then the screenshot tool resolves it.
- **Extensions can't add modes** — they inherit the parent's mode set and override values.
- **The Theme collection carries typography now** (content/size, /line-height, /letter-spacing,
  /weight, /font) — the old Typography/Hero/Mono collections were deleted.
- **Look-tier appearance is the #1 thing code got wrong historically** — components invented a
  `data-variant` primary/secondary/tertiary instead of using the shared appearance
  (data-look). The Figma truth: emphasis is an appearance mode, not a component variant.
- **Snap extensions** re-point only the 4 rounding corners; the base rounding lives in Structure.
- **Calendar/App-Shell/Calendar-D/M-Y** are Layout extensions specialising the responsive grid.

---

## 9. Component descriptions (from Figma, markdown) — ⚠️ MAY BE STALE

Every component/set carries a markdown **description** in Figma (fetch via `figma_execute`
→ `node.description`, or MCP component tools). They hold the designer's intent: behaviour,
tokens, events, composition. **They are NOT kept in lockstep with the variable structure** —
cross-check every claim against §1–§8 above (live) before trusting it. Known drifts already
visible: Button desc says "Controls extension" + "Button collection" + "7 sizes 2xs…3xl" —
those collections were REMOVED (look = Style Transparent/Saturated; sizes = Structure
2xs·xs·sm·lg·xl). Tag/Switch/Menu-List-Item say "Control/Controls" (now Style). Indicator
desc says "Badge collection default/brand/accent modes" — no such collection now. Treat the
descriptions as intent + event/behaviour reference, the structure sections as truth.

**Naming note:** descriptions use the OLD emphasis names primary/secondary/tertiary/
tertiary-on-color. Map: primary=Saturated, secondary=default, tertiary/tertiary-on-color=
Transparent. Code events in descriptions sometimes differ from the ratified noun-verb set
(e.g. desc "list-item-click" vs code "item-click", "card-select" vs "change") — the code's
`@fires` is authoritative for event NAMES; the description is authoritative for what
interactions/behaviours EXIST.

### Per-component intent (condensed from the live descriptions)

- **Button** — action control; look via appearance (primary=Saturated/secondary=default/
  tertiary(+on-color)=Transparent); size via Structure. Surface/border/content bind Style +
  resolve through the appearance ext; corners group-aware (snap); label font shrinks on small sizes.
- **Tag** — status/metadata pill. Type=full (icon+label+dismiss) | dot (status dot). Fill/
  border/content bind Style; content/inverse for dark label on light fill. Dismiss = xs icon Button.
- **Switch** — binary toggle, optional inline ON/OFF label. ON track = success green (scoped),
  OFF neutral. Click/Space/Enter → `change`. active/inactive = enabled/disabled.
- **Checkbox (Atom)** [sub] — bare 16×16 box+tick, isChecked. Use inside rows; labelled = Select Checkbox.
- **Select Checkbox** — Atom + label + optional description. hasDescription. State from the atom.
- **Radio (Atom)** [sub] — bare box+dot, isChecked. Labelled = Select Radio.
- **Select Radio** — Atom + label + optional description.
- **Fieldset (Select Group)** — groups selectable controls; selecting bubbles a group `change`;
  hasValidation shows error. Composes Select Checkbox/Radio.
- **Loading Spinner (atom)** [sub] — indeterminate track ring + accent arc, optional label. Unknown-duration.
- **Progress Bar (atom)** [sub] — determinate; full-width track + a fill SLOT resized to the value
  (slot pattern because Figma can't bind fill-width to a var). Track rounded-full.
- **Pagination** — results + spacer + info + pager (tertiary icon Buttons). Prev/next/first/last +
  page-size select → `page-change`. Composes Input (page size) + Button.
- **Menu List Item** [sub] — high-reuse GRID row: leading | content | trailing. Hover highlights,
  click/Enter → `list-item-click` (code: item-click). Composed by List, Menu, Tree, Transfer List,
  Time Picker, Select Group. Corners group-aware.
- **Select Card** — selectable gallery card + radio-select footer; card-click + card-select
  (code: change). Distinct from a Container tier.
- **Banner** — full-width status banner: message + optional link. Info+Subtle default; pin a Status.
- **Chip** — status-tinted pill: icon + label + dismiss Button. Dismiss removes the chip.
- **Key Value Pair** — key label + value; stack in a Key Value List (definition-list row).
- **Slider** — label + [track + value-input]; drag/type → `input` live, `change` on release. Slot/fill like Progress Bar.
- **File Uploader** — dashed drop-zone + details + actions. file-add / file-remove / file-clear /
  file-upload-start. Dashed border IS the affordance. Pairs with File Item.
- **File Item** [sub] — icon + name/size + status line + dismiss. States Ready/Uploading/Uploaded/Failed/Invalid via status text+token.
- **Progress Steps** — horizontal stepper, states Complete/Current/Inactive. step-click navigates, step-change advances.
- **Indicator (atom / "Badge")** [sub] — small overlay indicator; Type=count|dot; bound drop shadow.
  Overlay on bell/avatar/nav to signal unread. (desc's "Badge collection" no longer exists.)
- **Filter Chip (atom / Quick Filter Chip)** [sub] — filter chip; state active/default/inactive;
  hasMenu=chevron. quick-filter-click (body), -menu-open (chevron), -dismiss (×), -ai-accept. Brand purple.
- **Filter Toolbar (Quick Filter Toolbar)** — Type=view|data; content (chips) + right-actions.
  Emits toolbar filter-change/clear, container-filter-change, global-filter-change (broadcast); view scope
  adds view-menu-open/view-change/view-save/view-favorite/data-refresh/ai-filter-request.
- **Container** — inline card. **Dialog** — modal (native <dialog> showModal). **Overlay Panel** —
  non-modal floating (native <dialog>/popover). **Panel** — side/inline. **Accordion** — disclosure
  (native <details>/<summary>). All split out of a former Container Type set.
- **Container Header** — title bar; shared skeleton heading row + metadata slot. Default (title +
  desc-in-metadata + actions) | Panel (link-style title, right actions group: nav chevrons · view/
  expand/pop-out · close as Transparent icon-buttons w/ snapping, + bottom metadata row) | accordion.
- **Container Footer** — Type=action-bar; left+right slots, top divider. footer-cancel/footer-apply;
  repopulate slots per context (e.g. Today/Close+Apply on Calendar).
- **Callout** — subtle-status Container. 2-col GRID: icon column (spans rows) | content (heading,
  body, action). Optional toggle expands; callout-toggle, callout-dismiss. Info+Subtle default.
- **Toast** — elevated status notification (Elevation md pinned). Auto/close → `close`; action button → `action`. Transient.
- **Tab Group (Tabs)** — tablist + baseline divider + panel. Click/arrows → `tab-change`; lazy → `tab-load`.
  Active = brand/content-active (PURPLE) — intentional (a tab is a surface, not a control).
- **Tooltip (atom)** [sub] — dark bubble + white text + ONE rotatable pointer wedge + shadow; 9-slice; no per-side variants.
- **Section Header** — heading + description (fill) + actions (right) + optional divider. Neutral.
- **Empty State** — centred: illustration box + heading + description + actions + optional small-print. Neutral. Zero-data/first-run.
- **Breadcrumbs** — link crumbs + chevron separators + current (non-link). breadcrumb-click.
- **Toolbar** — one row, Leading + Trailing (fill) slots. Layer-economy exemplar. Composes Button + Input.
- **List** — stacks Menu List Item instances + hairline dividers; bordered rounded surface. Never re-draws rows.
- **Menu** — elevated floating Container of Menu List Item rows (Elevation md). Plain/checkbox/submenu rows.
- **Metric** — label + coloured card (value + trend + sparkline); Status-driven; one Status pin recolours the card. Composes Sparkline.
- **View Header** — Breadcrumbs + [back + title + context-controls + page-actions]. view-header-back,
  edit-mode-change, favorite-toggle, view-export. Composes Breadcrumbs + Button + Input.
- **Code Block** — mono panel: optional header (language + copy) + line-number gutter + body.
  code-copied, code-highlight-error, code-language-detected. hasHeader/hasLineNumbers toggle chrome.
- **Legend Item** [sub] — swatch + series label + optional value; click → legend-item-click; swatch binds series colour.
- **Chart Legend** — row of Legend Item swatches keyed to a chart's series (Data Viz categorical). Composes Legend Item.
- **Data Field** [sub] — one category slot of a 2D chart; Orientation vertical|horizontal; Content slot =
  gridlines + marks bound to Data Viz series/N.
- **Chart Axis** [sub] — value axis; Orientation vertical|horizontal; labels bind content/tertiary; extend the grid.
- **Donut Chart** — part-to-whole ring; Segments SLOT (ELLIPSE arcData innerRadius 0.7, contiguous from -90°,
  no gaps). Colour = Data Viz categorical (transparent fill + solid stroke). Centre value+label. Slice N → Categorical N.
- **Gauge Chart** — 180° value arc; Arcs SLOT (track + segment arcs + needle). Multi-segment: default 4 status
  threshold bands (success→warning→urgent→critical, ELLIPSE arcData innerRadius 0.82). Colour via Status threshold OR Categorical.
- **Transfer List** — two Lists + move controls; moving items → transfer-change. Composes List / Menu List Item.
- **Chat Message** — Type=received/sent (code: assistant|user|system); bubble corners group-aware; hasAvatar. Display-only.
- **Prompt Composer** — AI prompt input, brand purple; Enter/send → prompt-submit when non-empty. Composes Input + Button.
- **Calendar** — header + Grid + footer; Type=single|range; hasTime = clock + time inputs. Day click →
  datetime-change; range needs two clicks → range-select; footer datetime-submit/close. Buttons = Calendar Button; footer = Container Footer.
- **Calendar Button** [sub] — built from Button (detached); State default/today/active/inactive. today =
  accent border ring, no fill; active = active surface, no border; inactive = active surface + placeholder. Corners group-aware (range caps).
- **Time Picker** — time value control (value prop). Analog clock + grouped time inputs live in Calendar hasTime. Composes Menu List Item rows.
- **Navigation Item** [sub] — icon + content (label + optional Tag + trailing chevron) + Indicator; hasIcon, hasIndicator, isMaximised.
- **Navigation Section/default** [sub] — a SECTION label + rule divider; isMaximised hides the label on a collapsed rail.
- **Primary Navigation (Product Navigation v2)** — the nav panel; content slot = Section + Item clusters.
  States collapsed(40px rail)/expanded(320px shadow)/pinned(320px inline)/settings.
- **App Header** — hasNotifications (bell+badge), hasLoadingBar (slot). Back/favorite/breadcrumbs/export.
  Events (desc): view-header-back, favorite-toggle, breadcrumb-click, view-export. Composes Button + Badge + loading-bar slot.
- **Grid Cell** [sub] — atomic Data Grid cell; Type=cell|header|group|filter; hasCheckbox (selection/select-all),
  hasActions (sort+menu); Content SLOT. Description carries a `behaviour` block for the parent data-grid:
  column-pinning (data-pin=left|right|none), sticky-header, horizontal/vertical scroll.

### The `behaviour` block convention
Some descriptions embed a fenced ```behaviour block — runtime behaviour Figma can't model
(e.g. Grid Cell's column-pinning / sticky-header / scroll). These map to `@behaviour` JSDoc +
TODO stubs in code. Treat them as the spec for behaviour the visuals can't express.

---

# Merged from DESIGN-SYSTEM-REFERENCE.md (2026-09-16)

That doc restated this one's collection inventory, tier model and component
catalogue in shorter form — two answers to one question. These two sections
were the half that was NOT a restatement, so they moved here and the rest
was deleted.

## 10. How status & state tinting works (the mechanic)

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

## 11. Consistency rules (use when building new components)

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
