# Figma → CSS Property Map — Sherpa UI

This document maps Figma variable names (Apex 2.0 collection) to their `--sherpa-*` CSS custom property equivalents, the CSS properties they apply to, and their resolved values in Light/Dark mode.

Use this alongside [FIGMA-VARIABLE-GRAPH.md](./FIGMA-VARIABLE-GRAPH.md).

---

## Naming convention

The `--sherpa-*` token name mirrors the Figma variable path with `/` replaced by `-`:

```
Figma:  surface/container/default         → CSS: --sherpa-surface-container-default
Figma:  border/control/primary/default    → CSS: --sherpa-border-control-primary-default
Figma:  content/default/body              → CSS: --sherpa-content-default-body
Figma:  elevation/tint/default            → CSS: --sherpa-elevation-tint-default
Figma:  border/rounding/base              → CSS: --sherpa-border-rounding-base
```

---

## Surface tokens → `background` / `background-color`

### Container backgrounds

| CSS token | Figma variable | Light | Dark | Use |
|---|---|---|---|---|
| `--sherpa-surface-container-default` | `surface/container/default` | #FFFFFF | #222222 | Primary panel/card bg |
| `--sherpa-surface-container-hover` | `surface/container/hover` | #FAFAFA | #2E2E33 | Container hover state |
| `--sherpa-surface-container-down` | `surface/container/down` | #D5D5D5 | #18191A | Container pressed state |
| `--sherpa-surface-container-secondary-default` | `surface/container/secondary/default` | #FDFDFD | #292A2E | Secondary panels |
| `--sherpa-surface-container-secondary-hover` | `surface/container/secondary/hover` | #E6E6E6 | #292A2E | |
| `--sherpa-surface-container-secondary-down` | — | #E3E3E3 | #18191A | |
| `--sherpa-surface-container-tertiary-default` | `surface/container/tertiary/default` | — | — | Tertiary nesting |
| `--sherpa-surface-container-active-default` | `surface/container/active/default` | #F8EBFF | #300561 | Active/selected container |
| `--sherpa-surface-container-active-hover` | `surface/container/active/hover` | — | — | |
| `--sherpa-surface-container-active-down` | `surface/container/active/down` | — | — | |
| `--sherpa-surface-container-inactive` | `surface/container/inactive` | — | — | Disabled container |
| `--sherpa-surface-container-elevated-default` | `surface/container/elevated/default` | — | — | Elevated panels (dialogs) |
| `--sherpa-surface-app-background-default` | `surface/app/background/default` | #FFFFFF | #18191A | Page/viewport bg |
| `--sherpa-surface-container-app` | — | — | — | App-level container |

### Control surfaces

| CSS token | Figma variable | Light | Dark | Use |
|---|---|---|---|---|
| `--sherpa-surface-control-default` | `surface/control/default` | #FFFFFF | #292A2E | Input/button bg |
| `--sherpa-surface-control-hover` | `surface/control/hover` | #FAFAFA | #2E2E33 | |
| `--sherpa-surface-control-down` | — | #F2F2F2 | #18191A | |
| `--sherpa-surface-control-inactive` | `surface/control/inactive` | — | — | Disabled control bg |
| `--sherpa-surface-control-primary-default` | `surface/control/primary/default` | #3C5EDD | #3C5EDD | Primary (accent) button bg |
| `--sherpa-surface-control-primary-hover` | `surface/control/primary/hover` | #173382 | #173382 | |
| `--sherpa-surface-control-primary-down` | `surface/control/primary/down` | #0F0F57 | #0F0F57 | |
| `--sherpa-surface-control-primary-subtle` | — | — | — | Subtle primary variant |
| `--sherpa-surface-control-secondary-default` | `surface/control/secondary/default` | — | — | Secondary button bg |
| `--sherpa-surface-control-secondary-hover` | `surface/control/secondary/hover` | — | — | |
| `--sherpa-surface-control-secondary-down` | — | — | — | |
| `--sherpa-surface-control-tertiary-default` | `surface/control/tertiary/default` | transparent | transparent | Ghost button bg |
| `--sherpa-surface-control-tertiary-hover` | — | — | — | |
| `--sherpa-surface-control-tertiary-down` | — | — | — | |
| `--sherpa-surface-control-tertiary-inactive` | — | — | — | |
| `--sherpa-surface-control-tertiary-on-color-default` | `surface/control/tertiary-on-color/default` | — | — | Ghost button on color bg |
| `--sherpa-surface-control-tertiary-on-color-down` | — | — | — | |
| `--sherpa-surface-control-tertiary-on-color-inactive` | — | — | — | |
| `--sherpa-surface-control-active-default` | `surface/control/active/default` | #F8EBFF | #8500CC | Active/AI toggle bg |
| `--sherpa-surface-control-active-hover` | `surface/control/active/hover` | #F2D6FF | #8500CC | |
| `--sherpa-surface-control-active-down` | `surface/control/active/down` | #E2ADFF | #130227 | |

### Status surfaces

| CSS token | Figma variable | Light | Dark | Use |
|---|---|---|---|---|
| `--sherpa-surface-context-error-subtle-default` | `surface/status/critical/subtle/default` | #FFF7F5 | #361C16 | Critical bg |
| `--sherpa-surface-context-error-subtle-hover` | `surface/status/critical/subtle/hover` | #FFD7CA | #601B0B | |
| `--sherpa-surface-context-error-subtle-down` | `surface/status/critical/subtle/down` | #F79780 | #F79780 | |
| `--sherpa-surface-context-error-strong-default` | `surface/status/critical/strong/default` | — | — | Solid critical surface |
| `--sherpa-surface-context-info-subtle-default` | `surface/status/info/subtle/default` | #F7FDFF | #3F4447 | Info bg |
| `--sherpa-surface-context-info-subtle-hover` | — | #D9F2FA | #F7FDFF | |
| `--sherpa-surface-context-info-subtle-down` | — | #B0E8FC | #B0E8FC | |
| `--sherpa-surface-context-info-strong-default` | `surface/status/info/strong/default` | — | — | |
| `--sherpa-surface-context-warning-subtle-default` | `surface/status/warning/subtle/default` | #FFFBF2 | #46391E | Warning bg |
| `--sherpa-surface-context-warning-subtle-hover` | — | #FDEED0 | #FFFBF2 | |
| `--sherpa-surface-context-warning-subtle-down` | — | #FDE0A6 | #FDE0A6 | |
| `--sherpa-surface-context-warning-strong-default` | `surface/status/warning/strong/default` | — | — | |
| `--sherpa-surface-context-success-subtle-default` | `surface/status/success/subtle/default` | #F0FFF8 | #142E22 | Success bg |
| `--sherpa-surface-context-success-subtle-hover` | — | #C1F7DD | #F0FFF8 | |
| `--sherpa-surface-context-success-subtle-down` | — | #74DDAA | #74DDAA | |
| `--sherpa-surface-context-success-strong-default` | `surface/status/success/strong/default` | — | — | |
| `--sherpa-surface-context-urgent-subtle-default` | `surface/status/urgent/subtle/default` | #FFECCB | #3E2816 | Urgent bg |
| `--sherpa-surface-context-urgent-strong-default` | `surface/status/urgent/strong/default` | — | — | |
| `--sherpa-surface-context-default-subtle-default` | `surface/status/default/subtle/default` | — | — | |
| `--sherpa-surface-context-default-strong-default` | `surface/status/default/strong/default` | — | — | |
| `--sherpa-surface-status-info-strong-default` | `surface/status/info/strong/default` | — | — | |
| `--sherpa-surface-status-urgent-strong-default` | `surface/status/urgent/strong/default` | — | — | |

### App shell surfaces

| CSS token | Figma variable | Light | Dark | Use |
|---|---|---|---|---|
| `--sherpa-surface-app-product-bar-bg` | `surface/app/product-bar/bg` | — | — | Product bar strip |
| `--sherpa-surface-app-product-bar-product-block` | `surface/app/product-bar/product-block` | #8500CC | #8500CC | Product identity block |
| `--sherpa-surface-app-product-bar-product-text` | `surface/app/product-bar/product-text` | — | — | |
| `--sherpa-surface-app-product-nav-bg` | `surface/app/product-nav/bg` | #FAFAFA | #2E2E33 | Nav sidebar bg |
| `--sherpa-surface-app-product-nav-hover` | `surface/app/product-nav/hover` | #FAFAFA | #2E2E33 | |
| `--sherpa-surface-app-product-nav-down` | `surface/app/product-nav/down` | #F2F2F2 | #18191A | |
| `--sherpa-surface-app-product-nav-active` | `surface/app/product-nav/active` | #F8EBFF | #8500CC | Active nav item |
| `--sherpa-surface-app-product-nav-sub-bg` | `surface/app/product-nav/sub-bg` | — | — | Sub-nav bg |
| `--sherpa-surface-app-product-nav-sub-active` | — | — | — | Active sub-nav item |
| `--sherpa-surface-app-product-nav-active-icon` | — | — | — | |
| `--sherpa-surface-app-product-nav-base-icon` | — | — | — | |
| `--sherpa-surface-app-product-nav-base-text` | — | — | — | |
| `--sherpa-surface-app-product-nav-text` | — | — | — | |

---

## Border tokens → `border-color` / `outline-color`

### Container borders

| CSS token | Figma variable | Light | Dark | CSS property |
|---|---|---|---|---|
| `--sherpa-border-container-default` | `border/container/default` | #D5D5D5 | #5C5C66 | `border-color` |
| `--sherpa-border-container-inactive` | `border/container/inactive` | #C0C0CC | #404047 | `border-color` (disabled) |
| `--sherpa-border-container-active` | `border/container/active` | — | — | `border-color` (selected) |
| `--sherpa-border-container-subtle` | — | — | — | Subtle dividers |

### Control borders

| CSS token | Figma variable | Light | Dark | CSS property |
|---|---|---|---|---|
| `--sherpa-border-control-default` | `border/control/default` | #B2B2BF | #505059 | `border-color` |
| `--sherpa-border-control-hover` | `border/control/hover` | #C0C0CC | #404047 | `border-color` |
| `--sherpa-border-control-inactive` | `border/control/inactive` | — | — | `border-color` |
| `--sherpa-border-control-primary-default` | `border/control/primary/default` | #3C5EDD | #3C5EDD | `border-color` |
| `--sherpa-border-control-primary-hover` | `border/control/primary/hover` | #173382 | #4C63E5 | `border-color` |
| `--sherpa-border-control-primary-down` | `border/control/primary/down` | #0F0F57 | #0F0F57 | `border-color` |
| `--sherpa-border-control-secondary-default` | `border/control/secondary/default` | #D5D5D5 | #5C5C66 | `border-color` |
| `--sherpa-border-control-secondary-hover` | `border/control/secondary/hover` | #C0C0CC | #404047 | `border-color` |
| `--sherpa-border-control-secondary-down` | — | #8D8D99 | #2E2E33 | `border-color` |
| `--sherpa-border-control-active-default` | `border/control/active/default` | #C046FF | #C046FF | `border-color` (AI/active) |
| `--sherpa-border-control-active-hover` | `border/control/active/hover` | #50007A | #E2ADFF | |
| `--sherpa-border-control-active-down` | `border/control/active/down` | #300561 | #D485FF | |

### Status borders

| CSS token | Figma variable | Light | Dark |
|---|---|---|---|
| `--sherpa-border-context-error-default` | `border/status/critical/default` | #BF2C09 | #DD2C01 |
| `--sherpa-border-context-info-default` | `border/status/info/default` | #07526F | #0079AA |
| `--sherpa-border-context-warning-default` | `border/status/warning/default` | #A77206 | #E39B07 |
| `--sherpa-border-context-success-default` | `border/status/success/default` | #058142 | #058142 |
| `--sherpa-border-context-urgent-default` | `border/status/urgent/default` | — | — |
| `--sherpa-border-context-brand-default` | `border/control/active/default` | #C046FF | #C046FF |
| `--sherpa-border-context-default-default` | `border/status/default/default` | — | — |
| `--sherpa-border-context-default-hover` | — | — | — |
| `--sherpa-border-context-default-down` | — | — | — |

### Border geometry

| CSS token | Figma variable | Value | CSS property |
|---|---|---|---|
| `--sherpa-border-rounding-none` | `border/rounding/none` | 0px | `border-radius` |
| `--sherpa-border-rounding-sm` | `border/rounding/sm` | 2px | `border-radius` |
| `--sherpa-border-rounding-base` | `border/rounding/base` | 4px | `border-radius` |
| `--sherpa-border-rounding-lg` | `border/rounding/lg` | 8px | `border-radius` |
| `--sherpa-border-rounding-xl` | `border/rounding/xl` | 16px | `border-radius` |
| `--sherpa-border-rounding-2xl` | `border/rounding/2xl` | — | `border-radius` |
| `--sherpa-border-rounding-full` | `border/rounding/full` | 999px | `border-radius` |
| `--sherpa-border-width-none` | `border/width/none` | 0px | `border-width` |
| `--sherpa-border-width-xs` | `border/width/xs` | 0.25px | `border-width` |
| `--sherpa-border-width-sm` | `border/width/sm` | 0.5px | `border-width` |
| `--sherpa-border-width-base` | `border/width/base` | 1px | `border-width` |
| `--sherpa-border-width-lg` | `border/width/lg` | 2px | `border-width` |
| `--sherpa-border-width-xl` | `border/width/xl` | 4px | `border-width` |
| `--sherpa-border-width-2xl` | `border/width/2xl` | 8px | `border-width` |
| `--sherpa-border-width-3xl` | `border/width/3xl` | 12px | `border-width` |

---

## Content tokens → `color` (text and icon fills)

### Default text

| CSS token | Figma variable | Light | Dark | Use |
|---|---|---|---|---|
| `--sherpa-content-default-heading` | `content/default/heading` | #18191A | #FAFAFA | `h1`–`h5`, titles |
| `--sherpa-content-default-body` | `content/default/body` | #2E2E33 | #F2F2F2 | Body paragraphs |
| `--sherpa-content-default-label` | `content/default/label` | #18191A | #FAFAFA | Input labels, captions |
| `--sherpa-content-default-placeholder` | `content/default/placeholder` | #5C5C66 | #8D8D99 | Input placeholder |
| `--sherpa-content-default-secondary` | `content/default/secondary` | #404047 | #C0C0CC | Secondary/helper text |

### On-color text (text on coloured surfaces)

| CSS token | Figma variable | Light | Dark | Use |
|---|---|---|---|---|
| `--sherpa-content-default-on-color-heading` | `content/default/on-color/heading` | #FFFFFF | #FFFFFF | Text on primary/dark bg |
| `--sherpa-content-default-on-color-body` | `content/default/on-color/body` | #FAFAFA | #FFFFFF | |
| `--sherpa-content-default-on-color-label` | `content/default/on-color/label` | #FFFFFF | #FFFFFF | |
| `--sherpa-content-default-on-color-placeholder` | `content/default/on-color/placeholder` | #C0C0CC | #D5D5D5 | |
| `--sherpa-content-default-on-color-secondary` | — | #F2F2F2 | #F2F2F2 | |
| `--sherpa-content-default-on-color-subtle-heading` | `content/default/on-color-subtle/heading` | #18191A | #18191A | Text on subtle-tinted surface |
| `--sherpa-content-default-on-color-subtle-body` | `content/default/on-color-subtle/body` | #2E2E33 | #2E2E33 | |
| `--sherpa-content-default-on-color-subtle-label` | `content/default/on-color-subtle/label` | #18191A | #18191A | |

### Primary / accent text

| CSS token | Figma variable | Light | Dark | Use |
|---|---|---|---|---|
| `--sherpa-content-primary-default` | `content/primary/default` | #3C5EDD | #B4BDFC | Links, primary actions text |
| `--sherpa-content-primary-on-color` | `content/primary/on-color` | #D4D9FF | #D4D9FF | Accent text on dark bg |
| `--sherpa-content-primary-on-color-subtle` | `content/primary/on-color-subtle` | #3C5EDD | #3C5EDD | |
| `--sherpa-content-active-base` | `content/active/base` | — | — | AI/active indicator text |
| `--sherpa-content-inactive-default` | `content/inactive/default` | — | — | Disabled/inactive text |
| `--sherpa-content-inactive-on-color` | `content/inactive/on-color` | — | — | |

### Status text

| CSS token | Figma variable | Light | Dark | Use |
|---|---|---|---|---|
| `--sherpa-content-context-error-default` | `content/status/critical/default` | #9B2509 | #F47253 | Error/critical text |
| `--sherpa-content-context-error-on-color-subtle` | `content/status/critical/on-color-subtle` | — | — | Error text on subtle surface |
| `--sherpa-content-context-warning-default` | `content/status/warning/default` | #E39B07 | #FFAE0B | Warning text |
| `--sherpa-content-context-warning-on-color-subtle` | `content/status/warning/on-color-subtle` | — | — | |
| `--sherpa-content-context-success-default` | `content/status/success/default` | #058142 | #01A753 | Success text |
| `--sherpa-content-context-success-on-color-subtle` | `content/status/success/on-color-subtle` | — | — | |
| `--sherpa-content-context-urgent-default` | `content/status/urgent/default` | — | — | Urgent text |
| `--sherpa-content-context-urgent-on-color-subtle` | `content/status/urgent/on-color-subtle` | — | — | |
| `--sherpa-content-context-info-default` | `content/status/info/default` | — | — | Info text |
| `--sherpa-content-context-info-on-color-subtle` | `content/status/info/on-color-subtle` | — | — | |

---

## Elevation tokens → `box-shadow`

| CSS token | Figma variable | Resolved value |
|---|---|---|
| `--sherpa-elevation-tint-default` | `elevation/tint/default` | `rgba(55,47,79,0.20)` |
| `--sherpa-elevation-offset-y-default` | `elevation/offset/y/default` | 4px |
| `--sherpa-elevation-offset-y-large` | `elevation/offset/y/large` | 8px |
| `--sherpa-elevation-offset-x-default` | `elevation/offset/x/default` | 4px |
| `--sherpa-elevation-offset-x-large` | `elevation/offset/x/large` | 8px |
| `--sherpa-elevation-blur-default` | `elevation/blur/default` | 12px |
| `--sherpa-elevation-blur-large` | `elevation/blur/large` | 16px |
| `--sherpa-elevation-spread-default` | `elevation/spread/default` | -2px |
| `--sherpa-elevation-spread-large` | `elevation/spread/large` | 2px |

**Composed shadow helpers** (defined in `sherpa-platform.css`):

| CSS token | Composition | Use |
|---|---|---|
| `--sherpa-shadow-default-sm` | offset(2,2) blur(8) spread(-4) tint | Small drop shadow |
| `--sherpa-shadow-default-md` | offset(4,4) blur(12) spread(-2) tint | Default panel shadow |
| `--sherpa-shadow-default-lg` | offset(8,8) blur(16) spread(2) tint | Dialog / elevated shadow |

---

## Spacing tokens → `padding` / `gap` / `margin`

Aliases from the `Alias` collection's `space/*` and `size/*` paths:

| CSS token | Figma variable | Value | Use |
|---|---|---|---|
| `--sherpa-space-3xs` | `space/3xs` | 2px | Tightest gap |
| `--sherpa-space-2xs` | `space/2xs` | 4px | Dense gap |
| `--sherpa-space-xs` | `space/xs` | 6px | Inline padding |
| `--sherpa-space-sm` | `space/sm` | 8px | Compact padding |
| `--sherpa-space-default` | `space/default` | 12px | Default gap |
| `--sherpa-space-base` | `space/base` | 12px | Default padding |
| `--sherpa-space-md` | `space/md` | 16px | Standard padding |
| `--sherpa-space-lg` | `space/lg` | 20px | Generous padding |
| `--sherpa-space-xl` | `space/xl` | 24px | Large padding |
| `--sherpa-space-2xl` | `space/2xl` | 32px | Very large padding |
| `--sherpa-space-3xl` | `space/3xl` | 48px | — |
| `--sherpa-size-3xs` | `size/3xs` | — | Icon/control XS size |
| `--sherpa-size-2xs` | `size/2xs` | — | |
| `--sherpa-size-xs` | `size/xs` | — | |
| `--sherpa-size-sm` | `size/sm` | — | |
| `--sherpa-size-md` | `size/md` | — | Base control height |
| `--sherpa-size-lg` | `size/lg` | — | |
| `--sherpa-size-xl` | `size/xl` | — | |
| `--sherpa-size-2xl` | `size/2xl` | — | |
| `--sherpa-size-3xl` | `size/3xl` | — | |
| `--sherpa-size-4xl` | `size/4xl` | — | |
| `--sherpa-size-6xl` | `size/6xl` | — | |

---

## Typography tokens → `font-size` / `line-height`

| CSS token | Figma variable | Notes |
|---|---|---|
| `--sherpa-type-h1-size` | `type/h1/size` | |
| `--sherpa-type-h1-line-height` | `type/h1/line-height` | |
| `--sherpa-type-h2-size` | `type/h2/size` | |
| `--sherpa-type-h2-line-height` | `type/h2/line-height` | |
| `--sherpa-type-h3-size` | `type/h3/size` | |
| `--sherpa-type-h3-line-height` | `type/h3/line-height` | |
| `--sherpa-type-h4-size` | `type/h4/size` | |
| `--sherpa-type-h4-line-height` | `type/h4/line-height` | |
| `--sherpa-type-h5-size` | `type/h5/size` | |
| `--sherpa-type-h5-line-height` | `type/h5/line-height` | |
| `--sherpa-type-lg-size` | `type/lg/size` | |
| `--sherpa-type-lg-line-height` | `type/lg/line-height` | |
| `--sherpa-type-base-size` | `type/base/size` | |
| `--sherpa-type-base-line-height` | `type/base/line-height` | |
| `--sherpa-type-sm-size` | `type/sm/size` | |
| `--sherpa-type-sm-line-height` | `type/sm/line-height` | |
| `--sherpa-type-xs-size` | `type/xs/size` | |
| `--sherpa-type-xs-line-height` | `type/xs/line-height` | |
| `--sherpa-font-weight-regular` | `fonts/context/brand/weight/regular` | |
| `--sherpa-font-weight-medium` | — | |
| `--sherpa-font-weight-semibold` | `fonts/context/brand/weight/semibold` | |
| `--sherpa-font-weight-bold` | `fonts/context/brand/weight/bold` | |

---

## Colour ramp tokens → direct colour access

These are the raw semantic ramp stops exposed as CSS custom properties. Use these only when the semantic surface/border/content tokens don't cover the use-case (e.g. data visualisation, status badges, custom illustrations).

### Accent (primary action — blue #3C5EDD)
`--sherpa-color-accent-100` through `--sherpa-color-accent-1000` + `--sherpa-color-accent-base`

### Brand (AI/active — purple #C046FF)
`--sherpa-color-brand-100` through `--sherpa-color-brand-1000` + `--sherpa-color-brand-base`

### Status ramps
- `--sherpa-color-critical-100` through `-1000`
- `--sherpa-color-warning-100` through `-1000`
- `--sherpa-color-urgent-100` through `-1000`
- `--sherpa-color-success-100` through `-1000`
- `--sherpa-color-info-100` through `-1000`

### Neutral
`--sherpa-color-neutral-0` through `--sherpa-color-neutral-1000`

### Tones (blue-tinted grey — for subtle UI chrome)
`--sherpa-color-tones-100` through `--sherpa-color-tones-1000`

---

## Motion tokens → `transition-duration` / `animation-duration`

| CSS token | Figma variable | Value | Use |
|---|---|---|---|
| `--sherpa-motion-duration-fast` | `motion/duration/100` | ~100ms | Micro interactions |
| `--sherpa-motion-duration-base` | `motion/duration/200` | ~200ms | Default transitions |
| `--sherpa-motion-duration-slow` | `motion/duration/300` | ~300ms | Panel open/close |
| `--sherpa-motion-easing-default` | — | ease | Standard easing |

---

## Component-scoped variable collections

These collections are applied via CSS cascade by setting a `data-*` attribute on the component host. They override the semantic tokens above.

### Status cascade — `[data-status]`

Setting `data-status="critical|warning|success|info|urgent"` on any ancestor activates the **Status** Figma collection mode. The following `--_status-*` CSS custom properties are emitted and inherit through Shadow DOM:

| Status CSS var | Maps to |
|---|---|
| `--_status-surface` | `surface/control/default` in that mode |
| `--_status-surface-strong` | `surface/control/down` in that mode |
| `--_status-border` | `border/default` in that mode |
| `--_status-text` | `content/default` in that mode |
| `--_status-text-on-color` | `content/default/on-color` |
| `--_status-icon` | `icon/default` in that mode |

Component CSS then consumes these via fallback chains:
```css
background: var(--_status-surface, var(--sherpa-surface-control-primary-default, #3c5edd));
```

### Tag colours — `[data-color]`

Used by `sherpa-tag`. The tag colour collection exposes:
- `surface/color/default` → tag background
- `surface/color/hover` → hover background
- `surface/subtle/default` → outline variant background
- `border/default` → tag border

### Button sizes — `[data-size]`

Used by `sherpa-button`. The button size collection exposes:
- `control/size` → height
- `padding` → horizontal padding
- `spacing` → gap between icon and label

### Quick filter states

Used by `sherpa-quick-filter` and `sherpa-quick-filter-ai`. Modes map to data states:
- `default` → `[data-state="default"]`
- `on-populated` → `[data-active][data-populated]`
- `off-populated` → `[data-populated]`
- `inactive` → `[disabled]`

---

## Key CSS authoring patterns

### Semantic token usage (required)
```css
/* ✅ Correct — semantic token with hardcoded fallback */
background: var(--sherpa-surface-container-default, #ffffff);
color: var(--sherpa-content-default-body, #2e2e33);
border-color: var(--sherpa-border-container-default, #d5d5d5);

/* ❌ Wrong — direct primitive */
background: var(--core-color-basic-monochrome-0);
```

### State variants via host attributes
```css
:host { background: var(--sherpa-surface-control-default, #fff); }
:host(:hover) { background: var(--sherpa-surface-control-hover, #fafafa); }
:host(:active) { background: var(--sherpa-surface-control-down, #f2f2f2); }
:host([disabled]) {
  background: var(--sherpa-surface-container-inactive, #f2f2f2);
  color: var(--sherpa-content-inactive-default, #5c5c66);
  border-color: var(--sherpa-border-container-inactive, #c0c0cc);
}
```

### Focus ring (never use `--focus-ring()` CSS function)
```css
:host(:focus-visible) {
  outline: none;
  box-shadow: 0 0 0 2px var(--sherpa-border-control-primary-default, #3c5edd);
}
```

### Active/AI state (brand purple)
```css
:host([data-active]) {
  background: var(--sherpa-surface-control-active-default, #f8ebff);
  border-color: var(--sherpa-border-control-active-default, #c046ff);
  color: var(--sherpa-content-active-base, #c046ff);
}
```

### Primary button
```css
:host([data-variant="primary"]) {
  background: var(--sherpa-surface-control-primary-default, #3c5edd);
  border-color: var(--sherpa-border-control-primary-default, #3c5edd);
  color: var(--sherpa-content-default-on-color-label, #ffffff);
}
:host([data-variant="primary"]:hover) {
  background: var(--sherpa-surface-control-primary-hover, #173382);
}
:host([data-variant="primary"]:active) {
  background: var(--sherpa-surface-control-primary-down, #0f0f57);
}
```
