# Token Namespaces Quick Reference

Always use `--sherpa-*` tokens with a hardcoded fallback. Never use `--core-*`.

```css
/* Pattern: */
property: var(--sherpa-namespace-modifier-state, fallback);
```

---

## Surface Tokens (`--sherpa-surface-*`)

| Token | Value / Notes |
|-------|---------------|
| `--sherpa-surface-page-default` | Page / body background |
| `--sherpa-surface-container-default` | Standard container / card background |
| `--sherpa-surface-container-subtle` | Subtle fill (lower emphasis) |
| `--sherpa-surface-container-strong` | Elevated container fill |
| `--sherpa-surface-control-primary-default` | Primary button / filled control fill |
| `--sherpa-surface-control-primary-hover` | Primary hover fill |
| `--sherpa-surface-control-primary-active` | Primary pressed / active fill |
| `--sherpa-surface-control-secondary-default` | Secondary control fill |
| `--sherpa-surface-control-inactive-default` | Disabled control fill |
| `--sherpa-surface-context-error-subtle-default` | `critical` status subtle fill |
| `--sherpa-surface-context-error-strong-default` | `critical` status strong fill |
| `--sherpa-surface-context-warning-subtle-default` | `warning` status subtle fill |
| `--sherpa-surface-context-success-subtle-default` | `success` status subtle fill |
| `--sherpa-surface-context-info-subtle-default` | `info` status subtle fill |

---

## Text Tokens (`--sherpa-text-*`)

| Token | Use |
|-------|-----|
| `--sherpa-text-default-body` | Primary body text |
| `--sherpa-text-default-label` | Labels and headings |
| `--sherpa-text-default-subtle` | Secondary / muted text |
| `--sherpa-text-default-on-color-body` | Text on colored (dark) surfaces |
| `--sherpa-text-inactive-default` | Disabled text |
| `--sherpa-text-context-error-default` | `critical` text |
| `--sherpa-text-context-warning-default` | `warning` text |
| `--sherpa-text-context-success-default` | `success` text |
| `--sherpa-text-context-info-default` | `info` text |

---

## Border Tokens (`--sherpa-border-*`)

### Color tokens

| Token | Use |
|-------|-----|
| `--sherpa-border-container-default` | Container / card border |
| `--sherpa-border-control-default` | Input / button border |
| `--sherpa-border-focus-default` | Focus ring color |
| `--sherpa-border-inactive-default` | Disabled border |
| `--sherpa-border-context-error-default` | `critical` state border |

### Radius tokens

| Token | Value |
|-------|-------|
| `--sherpa-border-rounding-none` | 0px |
| `--sherpa-border-rounding-sm` | 4px |
| `--sherpa-border-rounding-base` | 8px |
| `--sherpa-border-rounding-lg` | 12px |
| `--sherpa-border-rounding-full` | 9999px (pill) |

### Width tokens

| Token | Value |
|-------|-------|
| `--sherpa-border-width-xs` | 1px |
| `--sherpa-border-width-sm` | 2px |
| `--sherpa-border-width-base` | 4px |

---

## Spacing Tokens (`--sherpa-space-*`)

| Token | Value | Notes |
|-------|-------|-------|
| `--sherpa-space-3xs` | 2px | Borders / optical edge cases only |
| `--sherpa-space-2xs` | 4px | Tight inline gaps |
| `--sherpa-space-xs` | 8px | Small gaps, icon-to-label |
| `--sherpa-space-sm` | 12px | Compact padding |
| `--sherpa-space-default` | 16px | Standard padding |
| `--sherpa-space-md` | 16px | Alias of `default` |
| `--sherpa-space-lg` | 24px | Section spacing |
| `--sherpa-space-xl` | 32px | Large padding |
| `--sherpa-space-2xl` | 48px | Page section spacing |

**Forbidden literals:** 3, 5, 6, 7, 9, 10, 11, 13, 14, 15

---

## Sizing Tokens (`--sherpa-size-*`)

| Token | Value | Use for |
|-------|-------|---------|
| `--sherpa-size-xs` | 24px | 2x-small controls |
| `--sherpa-size-sm` | 28px | Small controls |
| `--sherpa-size-md` | 32px | Default control height |
| `--sherpa-size-lg` | 40px | Large controls |
| `--sherpa-size-xl` | 48px | X-large controls |
| `--sherpa-size-2xl` | 64px | Icon / avatar sizes |

---

## Typography Tokens (`--sherpa-fonts-*`)

### Scale (font size)

| Token | Value | Use for |
|-------|-------|---------|
| `--sherpa-fonts-scale-xs` | 10px | Captions, footnotes |
| `--sherpa-fonts-scale-sm` | 12px | Labels, secondary text |
| `--sherpa-fonts-scale-base` | 14px | Body text |
| `--sherpa-fonts-scale-md` | 14px | Alias of `base` |
| `--sherpa-fonts-scale-lg` | 16px | Section headings |
| `--sherpa-fonts-scale-xl` | 20px | Page headings |
| `--sherpa-fonts-scale-2xl` | 24px | Display text |

### Font family

| Token | Value |
|-------|-------|
| `--sherpa-fonts-context-default` | Open Sans (UI body font) |
| `--sherpa-fonts-context-brand` | Manrope (display / headings) |
| `--sherpa-fonts-context-monospaced` | Source Code Pro (code) |

---

## Icon Tokens (`--sherpa-icon-*`)

| Token | Use |
|-------|-----|
| `--sherpa-icon-default-default` | Primary icon color |
| `--sherpa-icon-default-subtle` | Muted / secondary icon color |
| `--sherpa-icon-default-on-color` | Icon on a colored (dark) surface |
| `--sherpa-icon-inactive-default` | Disabled icon color |

---

## Shadow Tokens (`--sherpa-shadow-*`)

| Token | Use |
|-------|-----|
| `--sherpa-shadow-default-sm` | Subtle card elevation |
| `--sherpa-shadow-default-md` | Dropdown / popover elevation |
| `--sherpa-shadow-default-lg` | Modal / dialog elevation |

Use via CSS custom function (Chromium 139+):
```css
box-shadow: --shadow-md(var(--sherpa-elevation-tint-default, #1a1a1f));
```

Or with the raw token directly:
```css
box-shadow: var(--sherpa-shadow-default-md, 0 4px 12px rgb(0 0 0 / 0.12));
```

---

## Status Private Variables

Set by `sherpa-status.css` on `[data-status="*"]` ancestors. Consume in component CSS via fallback chains:

| Variable | Description |
|----------|-------------|
| `--_status-surface` | Subtle status background fill |
| `--_status-surface-strong` | Strong status fill (for solid-background badges/buttons) |
| `--_status-border` | Status border color |
| `--_status-text` | Status text color |
| `--_status-text-on-color` | Text on strong status surface |
| `--_status-icon` | Status icon color |

```css
/* Fallback chain example: status → default */
background: var(--_status-surface-strong,
            var(--sherpa-surface-control-primary-default, #2855ef));
color:      var(--_status-text-on-color,
            var(--sherpa-text-default-on-color-body, #ffffff));
border-color: var(--_status-border,
              var(--sherpa-border-control-default, #c8cad0));
```
