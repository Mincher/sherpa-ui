# Figma Variable → CSS Token Mapping

How every Figma variable collection lands in CSS. Generated from `figma.tokens.json`
via `scripts/project-tokens.mjs`. The CSS mirrors Figma's tier chain as `@layer`s.

| Figma tier | CSS layer | Selector | Prefix |
|---|---|---|---|
| Primitives | *(not compiled)* | — | resolved into Core |
| Core | `@layer core` | `:root` | `--sherpa-core-*` |
| Style (Sherpa) | `@layer style` | `:root` + `[data-mode="dark"]` | `--sherpa-*` (prefix dropped) |
| Overrides (Status, Color Sets, Grouping, Elevation, Control, Badge) | `@layer overrides` | `:root` + `[data-status]` | `--sherpa-<coll>-*` / `--_status-*` |
| Components (Container, Button, Input, Nav, Switch) | `@layer components` | per-component `:host` + `:host([data-*])` | `--sherpa-<comp>-*` |

---

## @layer core — Core tier (180 vars)

Figma `core` → `--sherpa-core-*` in `:root`. **Primitive references are resolved to
literal values** (Primitives never ships as CSS — it's reference-only).

```
--sherpa-core-color-*       (accent, brand, neutral, status ramps, tones)
--sherpa-core-space-*       (3xs..6xl, base, none, grouped)
--sherpa-core-size-*        (3xs..6xl)
--sherpa-core-border-rounding-*   (none, sm, base, lg, xl, 2xl, full)
--sherpa-core-border-width-*      (none, xs, sm, base, lg, xl, 2xl, 3xl)
--sherpa-core-fonts-scale-*       (2xs..14xl, base, sm, lg, xl)
--sherpa-core-fonts-weight-*      (300..900)
```

## @layer style — Style (Sherpa) semantic tier (244 vars, light + dark)

Figma `style-sherpa` → `--sherpa-*` (**collection prefix dropped** — this is THE
semantic layer). Light in `:root`; every var also has a **dark** value, re-pointed in
`:root[data-mode="dark"]` and `@media (prefers-color-scheme: dark)`.

```
--sherpa-app-{primary,secondary,tertiary}          the app canvas
--sherpa-content-{title,primary,secondary,tertiary,active,inactive,link}-{base,on-color,on-color-subtle,visited}
--sherpa-surface-{primary,secondary,tertiary}-{base,hover,down,inactive}
--sherpa-surface-interactive-{primary,secondary,tertiary}-{base,hover,down,inactive} + gradient stops
--sherpa-border-{primary,interactive}-*            neutral + interactive borders
--sherpa-status-{info,critical,warning,urgent,success}-color-{1..7}   the status ramps
--sherpa-data-viz-{categorical,sequential-*,divergent-*}-color-N      chart ramps
--sherpa-elevation-{tint,blur,offset,spread}-*     shadow parts
--sherpa-size-icon-{2xs..xl}
```

## @layer overrides

### Status → `[data-status]` cascade (`--_status-*`)

Figma `status` (9 vars, per status mode). An ancestor `[data-status]` emits private
custom props that inherit through shadow boundaries:

| Figma role | cascade var | is |
|---|---|---|
| `status-surface/default` | `--_status-surface` | box tint (color 1) |
| `status-border/default` | `--_status-border` | border (color 5 / 7 / 4) |
| `status-border/default` | `--_status-surface-strong` | badge / strong accent ink |
| `status-content/title` | `--_status-text` | heading ink on the tint |

Emitted as `[data-status="info|critical|warning|urgent|success"]` blocks.

### Shared override collections → `:root`

These are alias bases MULTIPLE components consume, so they stay global:

```
control-*      (19)  control-surface/border/content/space/radius — used by button/tag/switch/input
                     modes: primary, secondary, tertiary
color-sets-*   (9)   surface/border/content per colour — modes: violet…grey (11 hues)
grouping-*     (5)   grouping-radius/{top-left,…} + gap — modes: left/middle/right/top/bottom/isolated
elevation-*    (5)   elevation-shadow/{blur,color,offset-x/y,spread} — modes: sm/md/lg
badge-*        (3)   badge-surface/border/content — modes: accent, brand
```

### Convenience aliases → `:root`

Stable public names that don't map 1:1 to a single Figma var:

```
--sherpa-font-family-body / -mono    Typography is text-style-driven, not a flat var
--sherpa-shadow-sm / -md / -lg       composed from elevation offset/blur/spread/tint
--sherpa-categorical-1..11           → --sherpa-data-viz-categorical-color-N (chart JS bridge)
```

## @layer components — per-component partials (`<comp>.tokens.css`)

Component-scoped collections → each its own partial. Scoped vars at `:host`, variant
/ size modes as `:host([data-*])`. The component adopts the partial via `static tokens`.

| Component | Collection | Modes → attribute | Vars |
|---|---|---|---|
| `sherpa-container` | container (18) | `data-variant` = default/secondary/tertiary | `--sherpa-container-{surface,border,content,space}-*` |
| `sherpa-button` | button (6) | `data-size` = 2xs/xs/sm/md/xl/2xl/3xl | `--sherpa-button-{size,space,font}-*` |
| `sherpa-input-text` | input (5) | `data-state` = default/validation | `--sherpa-input-border-radius-*` |
| `sherpa-nav-item` | navigation (10) | `data-nav-state` = default/collapsed/hover/pinned/settings | `--sherpa-nav-*` |
| `sherpa-switch` | switch (12) | `data-variant` = standard/simple | `--sherpa-switch-{surface,content,size,radius}-*` |

## Not compiled

- **primitives** (360): raw values, resolved into Core. Reference-only in `figma.tokens.json`.
- **Extension collections** (border-only, brand, hero, monospaced, saturated,
  saturated-color-sets, calendar-day/month/year, comfortable, compact): 0 own vars —
  they inherit modes from their parent (density, typeface variants, per-status/per-hue
  saturated ramps). Wired when a component needs the extended mode.
- **typography** (6) / **layout-grid** (6): available in the DTCG; wired per-component
  (text styles, responsive grid) rather than as global flat tokens.

---

## Notes

- **Boolean component-property flags** (`hasValidation`, `hasLabel`,
  `nav-container-has-*`, `nav-container-is-maximised`) exist in the Figma collections
  but are Figma component PROPERTIES, not design tokens. The projector skips them
  (`typeof primary === 'boolean'`), so they never reach the CSS.
- The `navigation` collection (10 vars) currently lands in the `sherpa-nav-item`
  partial; it mixes nav-container geometry with nav-item state. Split if the nav
  components' scoping diverges.
