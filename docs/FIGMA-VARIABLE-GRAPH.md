# Figma Variable Graph — Apex 2.0 Core

This document maps the full variable aliasing structure extracted from the Figma design file (branch `gfI2qK577EvUl4mdCt2BXP`). It is intended as a reference for AI agents and developers to understand which Figma variables correspond to which semantic roles, and how they chain to raw primitives.

---

## Collection inventory

| Collection | Modes | Variables | Purpose |
|---|---|---|---|
| **Primitives** | Value | 396 | Raw colour ramps, spacing scale, border radii/widths, effects, motion, typography primitives |
| **Alias** | Value | 175 | Semantic aliases — bridges Primitives to named roles (accent, brand, neutral, status, spacing) |
| **Apex 2.0** | Light / Dark | 352 | Themeable semantic tokens — the primary consumer API. All components reference this layer |
| **Classic** | Light / Dark | 352 | Alternate theme (not Apex 2.0 Purple) — parallel set of same variables |
| **Apex 2.0 (Purple)** | Light / Dark | 352 | Purple brand theme variant |
| **Apex 2.0 (Teal)** | Light / Dark | 352 | Teal brand theme variant |
| **Apex 2.0 (Blue)** | Light / Dark | 352 | Blue brand theme variant |
| **Density (Alias)** | Base / Compact / Comfortable | 14 | Space/size density overrides |
| **Layout** | Large / Medium / Small | 21 | Breakpoint-level layout tokens (future use) |
| **Status** | default / info / critical / warning / urgent / success | 35 | Status cascade — overrides surface/border/content on status-bearing ancestors |
| **-> tag (colors)** | purple / magenta / cyan / light-blue / blue / violet / orange / pink / rose / green / grey | 5 | Tag colour variants (surface, border, content per mode) |
| **-> tab (style)** | primary / secondary / product bar | 11 | Tab style variants |
| **-> button (size)** | base / large / small / x-small / 2x-small | 3 | Button size scale |
| **-> button-group (style)** | default / start / middle / end | 3 | Button group border-radius shaping |
| **-> switch** | default / simple | 11 | Switch style variants |
| **-> filter-bar (tbd)** | default / active / inactive | 3 | Filter bar state |
| **-> table-cell (variants)** | default / date-time / dropdown / edit | 6 | Table cell type variants |
| **-> navigation-menu v1** | maximised / minimised | 9 | Nav menu size |
| **-> navigation_v2** | Collapsed / Hover / Pinned / Settings | 16 | Nav v2 state |
| **-> quick-filter** | default / on-populated / off-populated / inactive-populated / inactive | 8 | Quick filter states |
| **-> quick-filter (AI)** | same 5 modes | 8 | AI quick filter states |
| **-> icon (size)** | Value | 5 | Icon size scale |
| **-> illustration (size)** | Mode 1 | 2 | Illustration size |

---

## Three-tier aliasing architecture

```
Primitives  ──────►  Alias  ──────►  Apex 2.0 (theme)
(raw values)        (semantic         (Light/Dark per
                     renames)          component use)
```

Components in Figma bind to **Apex 2.0** variables only. Apex 2.0 variables alias into **Alias** collection variables, which in turn alias into **Primitives**. Direct primitive bindings exist only in a small number of structural tokens.

---

## Primitives — category map

### Colour ramps

| Path prefix | Description | Notes |
|---|---|---|
| `color/basic/monochrome/*` | Pure black→white (0–1000) | Neutral backbone, no hue |
| `color/basic/greyscale/*` | Slightly blue-tinted grey (0–1000) | UI greyscale with cool cast |
| `color/basic/blue-green/*` | Blue-green (teal) ramp (0–1000) | Source for `color/info/*` |
| `color/basic/blue/*` | Blue ramp (0–1000) | Structural blue, not the accent |
| `color/basic/purple/*` | Purple ramp (0–1000) | Structural purple |
| `color/basic/pink/*` | Pink ramp (0–1000) | Extended palette |
| `color/basic/red/*` | Red ramp (0–1000, + 550/750) | Source for `color/critical/*` |
| `color/basic/orange/*` | Orange ramp (0–1000, + 350/450) | Source for `color/urgent/*` |
| `color/basic/yellow/*` | Yellow ramp (0–1000, + 550) | Extended palette |
| `color/basic/green/*` | Green ramp (0–1000, + 50/625/650) | Source for `color/success/*` |
| `color/basic/adlumin-blue/*` | Adlumin brand blue (0–1000) | Product-specific |
| `color/basic/transparent/*` | Transparent overlays (0–1000, all same hue) | Overlay tints |
| `color/extended/phlox/*` | Phlox purple (250–750) | Source for `color/brand/*` |
| `color/extended/razamatazz/*` | Deep magenta (200–700) | Tag / data-viz |
| `color/extended/cool-red/*` | Cool red (0–1000) | Extended palette |
| `color/extended/warm-yellow/*` | Warm yellow (0–1000) | Source for `color/warning/*` |
| `color/extended/warm-green/*` | Warm green (0–1000) | Extended palette |
| `color/extended/cool-green/*` | Cool green (0–1000) | Extended palette |
| `color/extended/turquoise/*` | Turquoise (250–750) | Tag / data-viz |
| `color/extended/electric-indigo/*` | Electric indigo (200–650) | Tag / data-viz |
| `color/extended/neon-blue/*` | Neon blue (200–800) | **Source for `color/accent/*`** — primary action colour |
| `color/extended/chrome-orange/*` | Chrome orange (200–650) | Tag / data-viz |
| `color/extended/slate/*` | Slate blue-grey (0–950) | Source for `color/tones/*` |
| `color/extended/deep-purple/*` | Deep purple (150–600) | Extended palette |
| `color/basic/greyscale/150` | Extra grey step | — |
| `data-viz/*` | Data visualisation palettes | categorical (11), divergent (3×11), sequential (11×5) |

### Spacing & scale

| Path prefix | Values | CSS equivalent |
|---|---|---|
| `scale/0–800` | 0–64px (steps: 0,25,50,100,150,200,250,300,350,400,500,600,700,800) | spacing scale |
| `effects/offset/0–900` | negative to large offsets | shadow offsets |
| `effects/spread/0–400` | — | box-shadow spread |
| `effects/blur/0–600` | — | box-shadow / filter blur |
| `effects/opacity/0–500` | 0–1 | opacity |

### Border

| Path prefix | Description |
|---|---|
| `border/radius/0–1000` | 0, 2, 4, 8, 16, 999px |
| `border/stroke/0–700` | 0, 0.25, 0.5, 1, 2, 4, 8, 12px |
| `border/dash/0–200` | dash array values |

### Motion & typography primitives

| Path prefix | Description |
|---|---|
| `motion/duration/0–500` | Animation durations |
| `typeface/open-sans/*` | Font family + weight definitions |
| `typeface/manrope/*` | Font family + weight definitions |
| `typeface/source-code-pro/*` | Mono font |
| `typeface/geist/*` | Geist sans |
| `typeface/geist-mono/*` | Geist mono |
| `typeface/inter/*` | Inter |
| `typeface/jetbrains-mono/*` | JetBrains mono |

---

## Alias collection — semantic renames

The **Alias** collection provides a stable semantic name layer. It has a single `Value` mode (mode-agnostic). All values are aliases into Primitives.

### Border geometry aliases

| Alias variable | Primitive target | Value |
|---|---|---|
| `border/rounding/none` | `border/radius/0` | 0px |
| `border/rounding/sm` | `border/radius/100` | 2px |
| `border/rounding/base` | `border/radius/200` | 4px |
| `border/rounding/lg` | `border/radius/300` | 8px |
| `border/rounding/xl` | `border/radius/400` | 16px |
| `border/rounding/full` | `border/radius/1000` | 999px |
| `border/width/none` | `border/stroke/0` | 0px |
| `border/width/xs` | `border/stroke/100` | 0.25px |
| `border/width/sm` | `border/stroke/200` | 0.5px |
| `border/width/base` | `border/stroke/300` | 1px |
| `border/width/lg` | `border/stroke/400` | 2px |
| `border/width/xl` | `border/stroke/500` | 4px |
| `border/width/2xl` | `border/stroke/600` | 8px |
| `border/width/3xl` | `border/stroke/700` | 12px |

### Semantic colour ramps (Alias)

These give status/role names to the basic/extended primitive ramps:

| Alias ramp | Source primitive ramp | Resolved base hex |
|---|---|---|
| `color/info/100–1000` | `color/basic/blue-green/0–1000` | #F7FDFF → #0C303E |
| `color/warning/100–1000` | `color/extended/warm-yellow/0–1000` | #FFFBF2 → #805500 |
| `color/urgent/100–1000` | `color/basic/orange/0–1000` | #FFECCB → #673106 |
| `color/critical/100–1000` | `color/basic/red/0–1000` | #FFF7F5 → #48180D |
| `color/success/100–1000` | `color/basic/green/0–1000` | #F0FFF8 → #004F26 |
| `color/neutral/0–1000` | `color/basic/monochrome/0` + `greyscale/*` | #FFFFFF → #18191A |
| `color/tones/100–1000` | `color/extended/slate/*` + `monochrome/950` | #EAEEFE → #18191A |
| `color/accent/100–1000` | `color/basic/blue/0–300` + `extended/neon-blue/*` | #E4E6FF → #0B0B3D |
| `color/accent/base` | `color/extended/neon-blue/550` | **#3C5EDD** |
| `color/brand/100–1000` | `color/extended/phlox/250–1000` | #F8EBFF → #130227 |
| `color/brand/base` | `color/extended/phlox/500` | **#C046FF** |

**Key distinction:** `accent` (blue #3C5EDD) = primary actions. `brand` (purple #C046FF) = AI/active/quick-filter.

---

## Apex 2.0 — semantic token map

Apex 2.0 is the component-facing layer. All variables have Light and Dark mode values and alias into the Alias collection (or directly into Primitives for a few structural tokens).

### Surface tokens

#### Container surfaces

| Token | Light | Dark | Primitive chain |
|---|---|---|---|
| `surface/container/default` | #FFFFFF | #222222 | neutral/0 → monochrome/0 |
| `surface/container/hover` | #FAFAFA | #2E2E33 | monochrome/50 → neutral/900 |
| `surface/container/down` | #D5D5D5 | #18191A | neutral/400 → neutral/1000 |
| `surface/container/secondary/default` | #FDFDFD | #292A2E | monochrome/25 → monochrome/900 |
| `surface/container/secondary/hover` | #E6E6E6 | #292A2E | monochrome/250 → tones/900 |
| `surface/container/secondary/down` | #E3E3E3 | #18191A | monochrome/300 → tones/1000 |
| `surface/container/tertiary/default` | — | — | — |
| `surface/container/active/default` | #F8EBFF | #300561 | brand/100 → brand/900 |
| `surface/container/active/hover` | — | — | — |
| `surface/container/active/down` | — | — | — |
| `surface/container/inactive` | — | — | — |
| `surface/container/elevated/default` | — | — | — |
| `surface/container/elevated/overlay` | #2E2E3380 | #2E2E3380 | transparent/1000 |
| `surface/app/background/default` | #FFFFFF | #18191A | neutral/0 → monochrome/950 |
| `surface/app/product-bar/bg` | — | — | — |
| `surface/app/product-bar/product-block` | #8500CC | #8500CC | brand/700 |
| `surface/app/product-nav/bg` | #FAFAFA | #2E2E33 | neutral/200 → neutral/900 |
| `surface/app/product-nav/hover` | #FAFAFA | #2E2E33 | neutral/200 → neutral/900 |
| `surface/app/product-nav/down` | #F2F2F2 | #18191A | neutral/300 → neutral/1000 |
| `surface/app/product-nav/active` | #F8EBFF | #8500CC | brand/100 → brand/700 |
| `surface/app/product-nav/sub-bg` | — | — | — |

#### Control surfaces

| Token | Light | Dark |
|---|---|---|
| `surface/control/default` | #FFFFFF | #292A2E |
| `surface/control/hover` | #FAFAFA | #2E2E33 |
| `surface/control/down` | #F2F2F2 | #18191A |
| `surface/control/primary/default` | #3C5EDD | #3C5EDD |
| `surface/control/primary/hover` | #173382 | #173382 |
| `surface/control/primary/down` | #0F0F57 | #0F0F57 |
| `surface/control/secondary/default` | — | — |
| `surface/control/secondary/hover` | — | — |
| `surface/control/secondary/down` | — | — |
| `surface/control/tertiary/default` | — | — |
| `surface/control/tertiary/hover` | — | — |
| `surface/control/tertiary/down` | — | — |
| `surface/control/tertiary-on-color/default` | — | — |
| `surface/control/active/default` | #F8EBFF | #8500CC |
| `surface/control/active/hover` | #F2D6FF | #8500CC |
| `surface/control/active/down` | #E2ADFF | #130227 |
| `surface/control/inactive` | — | — |
| `surface/control/secondary/inactive` | — | — |

#### Status surfaces (subtle)

| Token | Light | Dark |
|---|---|---|
| `surface/status/critical/subtle/default` | #FFF7F5 | #361C16 |
| `surface/status/critical/subtle/hover` | #FFD7CA | #601B0B |
| `surface/status/critical/subtle/down` | #F79780 | #F79780 |
| `surface/status/critical/strong/default` | — | — |
| `surface/status/info/subtle/default` | #F7FDFF | #3F4447 |
| `surface/status/info/subtle/hover` | #D9F2FA | #F7FDFF |
| `surface/status/info/subtle/down` | #B0E8FC | #B0E8FC |
| `surface/status/info/strong/default` | — | — |
| `surface/status/warning/subtle/default` | #FFFBF2 | #46391E |
| `surface/status/warning/subtle/hover` | #FDEED0 | #FFFBF2 |
| `surface/status/warning/subtle/down` | #FDE0A6 | #FDE0A6 |
| `surface/status/warning/strong/default` | — | — |
| `surface/status/success/subtle/default` | #F0FFF8 | #142E22 |
| `surface/status/success/subtle/hover` | #C1F7DD | #F0FFF8 |
| `surface/status/success/subtle/down` | #74DDAA | #74DDAA |
| `surface/status/success/strong/default` | — | — |
| `surface/status/urgent/subtle/default` | #FFECCB | #3E2816 |
| `surface/status/urgent/strong/default` | — | — |
| `surface/status/default/subtle/default` | — | — |
| `surface/status/default/strong/default` | — | — |

### Border tokens

| Token | Light | Dark |
|---|---|---|
| `border/container/default` | #D5D5D5 | #5C5C66 |
| `border/container/inactive` | #C0C0CC | #404047 |
| `border/container/active` | — | — |
| `border/control/default` | #B2B2BF | #505059 |
| `border/control/hover` | #C0C0CC | #404047 |
| `border/control/down` | #8D8D99 | #2E2E33 |
| `border/control/inactive` | — | — |
| `border/control/primary/default` | #3C5EDD | #3C5EDD |
| `border/control/primary/hover` | #173382 | #4C63E5 |
| `border/control/primary/down` | #0F0F57 | #0F0F57 |
| `border/control/secondary/default` | #D5D5D5 | #5C5C66 |
| `border/control/secondary/hover` | #C0C0CC | #404047 |
| `border/control/secondary/down` | #8D8D99 | #2E2E33 |
| `border/control/tertiary/default` | transparent | transparent |
| `border/control/tertiary/hover` | #FFFFFF | #2E2E33 |
| `border/control/tertiary/down` | #FFFFFF | #18191A |
| `border/control/active/default` | #C046FF | #C046FF |
| `border/control/active/hover` | #50007A | #E2ADFF |
| `border/control/active/down` | #300561 | #D485FF |
| `border/status/critical/default` | #BF2C09 | #DD2C01 |
| `border/status/info/default` | #07526F | #0079AA |
| `border/status/warning/default` | #A77206 | #E39B07 |
| `border/status/success/default` | #058142 | #058142 |
| `border/status/urgent/default` | — | — |
| `border/status/default/default` | — | — |

### Content (text/icon fill) tokens

| Token | Light | Dark |
|---|---|---|
| `content/default/heading` | #18191A | #FAFAFA |
| `content/default/body` | #2E2E33 | #F2F2F2 |
| `content/default/label` | #18191A | #FAFAFA |
| `content/default/placeholder` | #5C5C66 | #8D8D99 |
| `content/default/secondary` | #404047 | #C0C0CC |
| `content/default/on-color/heading` | #FFFFFF | #FFFFFF |
| `content/default/on-color/body` | #FAFAFA | #FFFFFF |
| `content/default/on-color/label` | #FFFFFF | #FFFFFF |
| `content/default/on-color/placeholder` | #C0C0CC | #D5D5D5 |
| `content/default/on-color/secondary` | #F2F2F2 | #F2F2F2 |
| `content/default/on-color-subtle/heading` | #18191A | #18191A |
| `content/default/on-color-subtle/body` | #2E2E33 | #2E2E33 |
| `content/default/on-color-subtle/label` | #18191A | #18191A |
| `content/default/on-color-subtle/placeholder` | #8D8D99 | #8D8D99 |
| `content/default/on-color-subtle/secondary` | #5C5C66 | #404047 |
| `content/primary/default` | #3C5EDD | #B4BDFC |
| `content/primary/on-color` | #D4D9FF | #D4D9FF |
| `content/primary/on-color-subtle` | #3C5EDD | #3C5EDD |
| `content/primary/hover` | — | — |
| `content/inactive/default` | — | — |
| `content/inactive/on-color` | — | — |
| `content/inactive/on-color-subtle` | — | — |
| `content/active/base` | — | — |
| `content/status/critical/default` | #9B2509 | #F47253 |
| `content/status/critical/on-color` | — | — |
| `content/status/critical/on-color-subtle` | — | — |
| `content/status/warning/default` | #E39B07 | #FFAE0B |
| `content/status/warning/on-color` | — | — |
| `content/status/success/default` | #058142 | #01A753 |
| `content/status/success/on-color` | — | — |
| `content/status/urgent/default` | — | — |
| `content/status/info/default` | — | — |
| `content/app/product-bar/default` | — | — |
| `content/app/product-nav/default` | — | — |

### Elevation tokens

| Token | Light | Dark | Notes |
|---|---|---|---|
| `elevation/tint/default` | #372F4F33 | #2E2E3333 | 20% opacity shadow tint |
| `elevation/tint/success` | #004F2633 | #004F2633 | |
| `elevation/tint/warning` | #80550033 | #80550033 | |
| `elevation/tint/critical` | #601B0B33 | #601B0B33 | |
| `elevation/tint/info` | #0C303E33 | #0C303E33 | |
| `elevation/tint/urgent` | — | — | |
| `elevation/tint/focus` | — | — | |
| `elevation/offset/y/small` | 2px | 2px | effects/offset/500 |
| `elevation/offset/y/default` | 4px | 4px | effects/offset/600 |
| `elevation/offset/y/large` | 8px | 8px | effects/offset/700 |
| `elevation/offset/y/sunken` | 4px | 4px | |
| `elevation/offset/x/small` | 2px | 2px | |
| `elevation/offset/x/default` | 4px | 4px | |
| `elevation/offset/x/large` | 8px | 8px | |
| `elevation/offset/x/sunken` | −4px | −4px | inset |
| `elevation/blur/small` | 8px | 8px | |
| `elevation/blur/default` | 12px | 12px | |
| `elevation/blur/large` | 16px | 16px | |
| `elevation/blur/sunken` | 4px | 4px | |
| `elevation/spread/small` | −4px | −4px | |
| `elevation/spread/default` | −2px | −2px | |
| `elevation/spread/large` | 2px | 2px | |
| `elevation/spread/sunken` | 4px | 4px | |

---

## Component-scoped collections

These are mode-switched collections where the mode is set by a component property or ancestor context (not light/dark theme).

### Status — `Status` collection

Modes: `default | info | critical | warning | urgent | success`

Sets 35 variables used for the status cascade. Key variables:
- `surface/control/default` — fills for the status-tinted control background
- `surface/control/hover / down`
- `icon/default` — icon colour for the status mode
- `fill/default`, `border/default`, `content/default`
- `shadow/default`, `shadow/status`

### Tag colours — `-> tag (colors)` collection

Modes: `purple | magenta | cyan | light-blue | blue | violet | orange | pink | rose | green | grey`

5 variables per mode:
- `surface/color/default` — tag background fill
- `surface/color/hover`
- `surface/color/down`
- `surface/subtle/default` — subtle (outline) variant background
- `border/default` — tag border

### Quick filter — `-> quick-filter` and `-> quick-filter (AI)`

Modes: `default | on-populated | off-populated | inactive-populated | inactive`

8 variables per mode covering fill, border, content, and icon states.

### Button size — `-> button (size)`

Modes: `base | large | small | x-small | 2x-small`

3 variables: `control/size`, `padding`, `spacing`

### Switch — `-> switch`

Modes: `default | simple`

11 variables: track fill, thumb fill, border, content, icon per state.

---

## Alias chain reference — key tokens

| What you use in CSS (`--sherpa-*`) | Apex 2.0 token | Alias token | Primitive |
|---|---|---|---|
| Primary action surface | `surface/control/primary/default` | `color/accent/base` | `color/extended/neon-blue/550` = **#3C5EDD** |
| Primary action border | `border/control/primary/default` | `color/accent/base` | **#3C5EDD** |
| Container bg | `surface/container/default` | `color/neutral/0` | `color/basic/monochrome/0` = **#FFFFFF** |
| App background | `surface/app/background/default` | `color/neutral/0` | **#FFFFFF** |
| Body text | `content/default/body` | `color/neutral/900` | `color/basic/greyscale/1000` = **#2E2E33** |
| Heading text | `content/default/heading` | `color/neutral/1000` | `color/basic/monochrome/950` = **#18191A** |
| Placeholder text | `content/default/placeholder` | `color/neutral/700` | `color/basic/greyscale/700` = **#5C5C66** |
| Secondary text | `content/default/secondary` | `color/neutral/800` | `color/basic/greyscale/900` = **#404047** |
| Default border | `border/container/default` | `color/neutral/400` | `color/basic/monochrome/400` = **#D5D5D5** |
| Control border | `border/control/default` | — | `color/basic/greyscale/500` = **#B2B2BF** |
| Brand/AI active | `border/control/active/default` | `color/brand/base` | `color/extended/phlox/500` = **#C046FF** |
| Active surface | `surface/control/active/default` | `color/brand/100` | `color/extended/phlox/250` = **#F8EBFF** |
| Critical border | `border/status/critical/default` | `color/critical/700` | `color/basic/red/600` = **#BF2C09** |
| Critical text | `content/status/critical/default` | `color/critical/800` | `color/basic/red/700` = **#9B2509** |
| Success border | `border/status/success/default` | `color/success/700` | `color/basic/green/700` = **#058142** |
| Warning text | `content/status/warning/default` | `color/warning/800` | `color/extended/warm-yellow/800` = **#E39B07** |
