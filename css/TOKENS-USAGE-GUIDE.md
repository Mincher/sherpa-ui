# Design Tokens Usage Guide

Complete guide to using and extending the Sherpa design token system.

> **Source of truth:** All tokens flow from `figma-tokens/` through
> [scripts/generate-css-tokens.js](../scripts/generate-css-tokens.js).
> The Figma → CSS contract is documented in
> [scripts/generate-css-tokens.md](../scripts/generate-css-tokens.md).
> Files marked _generated_ below are overwritten on every
> `npm run tokens:generate` — do not hand-edit them.

## Architecture at a Glance

```
  figma-tokens/                          (source of truth — DTCG + figma-variables.json)
        │
        ▼  scripts/generate-css-tokens.js   (npm run tokens:generate)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ @layer reset                                                         │
  │   reset.css                          box-sizing, fonts                │  hand
  │ @layer primitives                                                    │
  │   tokens/sherpa-primitives.css       --sherpa-core-* raw values       │  hand
  │ @layer alias                                                         │
  │   tokens/sherpa-alias.css            --sherpa-* semantic + font       │  generated
  │                                      composites + @property regs      │
  │ @layer platform                                                      │
  │   tokens/sherpa-platform.css         focus ring, z-index, color-      │  generated
  │                                      scheme contract per data-mode    │
  │ @layer theme                                                         │
  │   sherpa-theme-{default-slug}.css    full token surface              │  generated
  │                                      (light + nested dark + hc)       │  default = always loaded via @import
  │   sherpa-theme-{extended-slug}.css   diff-only against default       │  generated
  │                                      (load via <link> + data-theme)   │
  │ @layer density                                                       │
  │   sherpa-density-compact.css         [data-density] subtree overrides │  generated
  │   sherpa-density-comfortable.css                                     │  generated
  │ @layer status                                                        │
  │   sherpa-status.css                  [data-status] → --_status-* map  │  generated
  │ @layer components                                                    │
  │   components/index.css               light-DOM component overrides    │  hand
  │   components/**/*.css                Shadow DOM (adopted)             │  hand
  │ @layer utilities                                                     │
  │   sherpa-text-classes.css            sherpa-icon-classes.css         │  hand
  │   sherpa-motion-classes.css          sherpa-utility-classes.css      │  hand
  │   sherpa-app-classes.css                                             │  hand
  │   sherpa-data-viz-classes.css        .color-1 … .color-N             │  generated
  └──────────────────────────────────────────────────────────────────────┘
```

Layer order is established once in `index.css`:

```css
@layer reset, primitives, alias, platform, theme, density, status, components, utilities;
```

Later layers override earlier ones unconditionally. Within the **theme**
layer, the default theme is always present (imported by `index.css`); any
extended theme is appended via a runtime `<link>` and emits only the
properties that differ from the default — selectors are wrapped in
`:where(:root[data-theme="<slug>"])` so its diffs win on attribute match
without bumping specificity.

### Switching axes (CSS-only contract)

| Axis    | Attribute                               | Notes                                                               |
| ------- | --------------------------------------- | ------------------------------------------------------------------- |
| Theme   | `<html data-theme="…">`                 | Required for extended themes; default theme matches bare `:root`.    |
| Mode    | `<html data-mode="auto\|light\|dark\|hc">` | `auto` honours both `prefers-color-scheme` and `prefers-contrast`. |
| Density | `[data-density="compact\|base\|comfortable"]` | Applies to any subtree.                                       |
| Status  | `[data-status="critical\|info\|success\|warning\|urgent"]` | Maps to `--_status-*` private vars.            |

`ThemeManager` writes these attributes on `document.documentElement`; CSS
owns the visual cascade including `color-scheme`. JS never touches
`style.colorScheme` directly.

## Quick Start

### Import tokens in your CSS

```css
@import "css/styles/index.css";

.my-component {
  background-color: var(--sherpa-surface-container-default);
  color: var(--sherpa-text-default-body);
  padding: var(--sherpa-space-default);
  border-radius: var(--sherpa-border-rounding-base);
  box-shadow: var(--sherpa-effects-shadow-200);
}
```

### Use tokens in JavaScript

```javascript
// Access token value at runtime
const color = getComputedStyle(document.documentElement)
  .getPropertyValue('--sherpa-color-brand-base');

// Switch mode (light / dark / auto)
document.documentElement.style.colorScheme = 'dark';     // forced dark
document.documentElement.style.colorScheme = 'light';    // forced light
document.documentElement.style.colorScheme = 'light dark'; // auto (OS pref)

// Switch theme (swap CSS file via <link id="sherpa-theme">)
const link = document.getElementById('sherpa-theme');
link.href = '/css/styles/sherpa-theme-data-protection.css';
```

---

## Token Categories

### 1. Color Tokens

**Namespace:** `--sherpa-color-*`, `--sherpa-surface-*`, `--sherpa-text-*`, `--sherpa-icon-*`

#### Brand Colors
```css
--sherpa-color-brand-base     /* Primary brand color */
--sherpa-color-brand-100      /* Light tint */
--sherpa-color-brand-900      /* Dark shade */
```

#### Status Colors
```css
--sherpa-color-success-*      /* Success/positive states */
--sherpa-color-error-*        /* Error/critical states */
--sherpa-color-warning-*      /* Warning states */
--sherpa-color-info-*         /* Info/neutral states */
```

#### Surface & Text
```css
--sherpa-surface-container-default
--sherpa-surface-container-hover
--sherpa-text-default-body
--sherpa-text-default-secondary
--sherpa-text-inactive-default
```

### 2. Spacing Tokens

**Namespace:** `--sherpa-space-*`

Base scale in `8px` increments:
```css
--sherpa-space-xs      /* 4px */
--sherpa-space-sm      /* 8px */
--sherpa-space-default /* 8px (common) */
--sherpa-space-md      /* 16px */
--sherpa-space-lg      /* 24px */
--sherpa-space-xl      /* 32px */
--sherpa-space-2xl     /* 48px */
```

### 3. Sizing Tokens

**Namespace:** `--sherpa-size-*`, `--sherpa-scale-*`

Common UI dimensions:
```css
--sherpa-size-sm       /* Small: 24px */
--sherpa-size-md       /* Medium: 32px */
--sherpa-size-lg       /* Large: 40px */
--sherpa-size-xl       /* Extra Large: 48px */
--sherpa-size-2xl      /* 2x Large: 64px */
```

### 4. Border & Rounding

**Namespace:** `--sherpa-border-rounding-*`, `--sherpa-border-width-*`

```css
--sherpa-border-rounding-none      /* 0px */
--sherpa-border-rounding-sm        /* 4px */
--sherpa-border-rounding-base      /* 8px (default) */
--sherpa-border-rounding-lg        /* 12px */
--sherpa-border-rounding-full      /* 9999px */

--sherpa-border-width-none         /* 0px */
--sherpa-border-width-xs           /* 1px */
--sherpa-border-width-sm           /* 2px */
--sherpa-border-width-base         /* 4px (default) */
--sherpa-border-width-lg           /* 6px */
```

### 5. Typography

**Namespace:** `--sherpa-fonts-*`, `--sherpa-text-*`

```css
--sherpa-fonts-scale-xs            /* Small text: 12px */
--sherpa-fonts-scale-sm            /* Small text: 14px */
--sherpa-fonts-scale-base          /* Body text: 14px */
--sherpa-fonts-scale-lg            /* Large text: 16px */

--sherpa-fonts-letter-spacing-base /* 0.1px */
--sherpa-fonts-context-default     /* System font stack */
```

### 6. Shadow & Elevation

**Namespace:** `--sherpa-effects-shadow-*`, `--sherpa-elevation-*`

```css
--sherpa-effects-shadow-100        /* Subtle shadow */
--sherpa-effects-shadow-200        /* Medium shadow (common) */
--sherpa-effects-shadow-300        /* Strong shadow */

--sherpa-elevation-offset-y-default    /* Vertical offset */
--sherpa-elevation-blur-default        /* Blur radius */
--sherpa-elevation-spread-default      /* Spread radius */
```

### 7. Motion & Animation

**Namespace:** `--sherpa-animation-*`, `--sherpa-duration-*`

```css
--sherpa-duration-fast             /* 100ms */
--sherpa-duration-base             /* 200ms (default) */
--sherpa-duration-slow             /* 300ms */
```

---

## Common Component Patterns

### Button
```css
.button {
  padding: var(--sherpa-space-default) var(--sherpa-space-md);
  background-color: var(--sherpa-surface-control-primary-default);
  color: var(--sherpa-text-default-on-color-heading);
  border-radius: var(--sherpa-border-rounding-base);
  border: var(--sherpa-border-width-xs) solid transparent;
  font-size: var(--sherpa-fonts-scale-base);
  transition: background-color 0.15s;
}

.button:hover {
  background-color: var(--sherpa-surface-control-primary-hover);
}
```

### Card
```css
.card {
  padding: var(--sherpa-space-md);
  background-color: var(--sherpa-surface-container-default);
  border: var(--sherpa-border-width-xs) solid var(--sherpa-border-control-secondary-default);
  border-radius: var(--sherpa-border-rounding-base);
  box-shadow: var(--sherpa-effects-shadow-200);
}
```

### Input Field
```css
.input {
  padding: var(--sherpa-space-sm) var(--sherpa-space-default);
  border: var(--sherpa-border-width-xs) solid var(--sherpa-border-control-secondary-default);
  border-radius: var(--sherpa-border-rounding-base);
  font-size: var(--sherpa-fonts-scale-base);
  color: var(--sherpa-text-default-body);
}

.input:focus {
  border-color: var(--sherpa-border-control-active-default);
  outline: none;
}
```

### Status Badge
```css
.badge.success {
  background-color: var(--sherpa-surface-context-success-subtle-default);
  color: var(--sherpa-text-context-success-default);
  padding: var(--sherpa-space-xs) var(--sherpa-space-sm);
  border-radius: var(--sherpa-border-rounding-sm);
  font-size: var(--sherpa-fonts-scale-xs);
}
```

---

## Theming & Dark Mode

### How It Works

Theme CSS files use the CSS `light-dark()` function for every colour that
differs between light and dark modes:

```css
/* Inside sherpa-theme-apex-2-core.css */
:root {
  color-scheme: light dark;
  --sherpa-surface-app-background-default: light-dark(
    var(--sherpa-color-neutral-0),
    var(--sherpa-core-color-basic-monochrome-950)
  );
}
```

The browser resolves `light-dark()` based on the computed `color-scheme`
property on the element.

### Mode Switching

Set `color-scheme` on `<html>` via JavaScript:

```javascript
// Auto (follow OS preference)
document.documentElement.style.colorScheme = 'light dark';

// Force light
document.documentElement.style.colorScheme = 'light';

// Force dark
document.documentElement.style.colorScheme = 'dark';
```

### Theme / Brand Switching

Themes are split into a **default theme (full surface) + per-theme diffs**:

- `sherpa-theme-{default-slug}.css` — the complete token surface. Always
  loaded via `@import` from `index.css`. The `apex-2-core` slug is the
  current default. Its bare-`:root` selectors apply when no `data-theme`
  attribute is set.
- `sherpa-theme-{extended-slug}.css` — only the properties whose value
  differs from the default. Loaded at runtime via a `<link id="sherpa-theme">`
  element. All selectors are wrapped in `:where(:root[data-theme="<slug>"])`,
  so the diffs apply only when `<html data-theme="<slug>">` matches.

Both files belong to `@layer theme`. The runtime `<link>` is later in source
order than the `@import`, so an extended theme overrides the default on a
per-property basis without bumping specificity.

```html
<!-- In the HTML <head>: default already imported by index.css; this swaps in an extended theme -->
<link id="sherpa-theme" rel="stylesheet"
      href="/css/styles/sherpa-theme-apex-2-purple.css">
<script>document.documentElement.dataset.theme = 'apex-2-purple';</script>
```

`ThemeManager.setTheme(slug)` automates both steps (link href + data-theme
attribute) and persists the choice to `localStorage`.

```javascript
// Switch to Data Protection theme
document.getElementById('sherpa-theme').href =
  '/css/styles/sherpa-theme-data-protection.css';
```

#### Theme-Scoped Brand Families

Some colour families are **only defined for specific themes** and intentionally
live in the theme files rather than the shared alias file:

| Family                     | Defined in                                |
| -------------------------- | ----------------------------------------- |
| `--sherpa-color-primary-cyan-*` | `sherpa-theme-classic.css` only          |
| `--sherpa-color-primary-blue-*` | `sherpa-theme-apex-2-core.css`, `sherpa-theme-data-protection.css` |

Do not consume these directly from component CSS unless the component is
theme-specific. Prefer the abstract `--sherpa-color-brand-*` semantic alias.
Configured via `THEME_SCOPED_FAMILIES` in
[scripts/generate-css-tokens.js](../scripts/generate-css-tokens.js).

Available theme files:
- `sherpa-theme-apex-2-core.css` — Apex 2.0 Core (default)
- `sherpa-theme-data-protection.css` — N-able Data Protection
- `sherpa-theme-classic.css` — Classic

---

## Extending Tokens

### Extract & Generate Tokens

When tokens change in Figma:

```bash
# 1. Pull latest variables from Figma (requires FIGMA_ACCESS_TOKEN)
npm run tokens:extract

# 2. Regenerate CSS from the updated JSON
npm run tokens:generate

# Or run both via build:
npm run build
```

This:
1. Fetches all variable collections from the Figma REST API
2. Writes `figma-tokens/figma-variables.json` with resolved values
3. Generates per-theme CSS files, alias tokens, status mappings, fonts, and component tokens

### Adding Custom Tokens

1. Define in Figma Tokens 2.0 (recommended for consistency)
2. Or add directly to appropriate CSS file in `css/styles/`:

```css
/* css/styles/custom.css */
:root {
  --sherpa-custom-brand-accent: #7c3aed;
  --sherpa-custom-spacing-huge: 64px;
}
```

3. Import in `css/styles/index.css` (regenerate build afterwards):

```css
@import "custom.css";
```

---

## Token Naming Convention

All design tokens follow the convention:

```
--sherpa-[category]-[semantic]-[state]
```

- **`apx`** - Design system namespace (Apex)
- **`category`** - Type of token (color, space, size, border, font, effect)
- **`semantic`** - Semantic meaning (surface, text, control, icon, brand, status)
- **`state`** - Optional state modifier (default, hover, active, disabled)

### Examples

```
--sherpa-surface-container-default        ← surface, container, default state
--sherpa-color-brand-base                 ← color, brand, base value
--sherpa-space-default                    ← spacing, default amount
--sherpa-border-control-active-default    ← border, control, active state, default
--sherpa-text-context-error-default       ← text, context, error, default
```

---

## Integration Points

### Component Libraries

Use tokens in all component CSS:

```css
/* components/sherpa-button/sherpa-button.css */
button {
  background: var(--sherpa-surface-control-primary-default);
  color: var(--sherpa-text-default-on-color-heading);
  padding: var(--sherpa-space-default);
}
```

### Design Applications

Export tokens for design tools:
- Figma Variables (source)
- Design tokens JSON
- Component style guides

### Documentation

Reference tokens in:
- Component READMEs
- Design system documentation
- Storybook component stories
- Architecture overview ([docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)) for high-level context

### Styling Workflow

1. **Global baseline** — Load [css/style.css](style.css) after tokens to apply resets, typography, and layout primitives that also consume token variables.
2. **Component scopes** — Keep component-specific styling inside each Shadow DOM stylesheet (e.g., [components/sherpa-button/sherpa-button.css](../components/sherpa-button/sherpa-button.css)) and map every color, spacing, and motion value back to tokens.
3. **Container queries & responsiveness** — Prefer logical properties and token-based breakpoints inside component CSS; shared mixins can live alongside tokens if needed.
4. **Overrides** — Apply view-level overrides through custom properties on host elements instead of editing generated token files.

---

## Best Practices

1. **Always use tokens** — Never hardcode colors, spacing, or sizes.
2. **Favor semantic tokens** — Use `--sherpa-surface-container-default` over
   `--sherpa-color-brand-base`. Never reference `--sherpa-core-*` primitives
   from component CSS.
3. **Always provide a hardcoded fallback** —
   `var(--sherpa-space-sm, 12px)` not `var(--sherpa-space-sm)`. This guarantees
   graceful degradation when a token is missing or a theme fails to load.
   Run `npm run css:fallbacks` to inject literal fallbacks across all
   component CSS automatically (uses
   [scripts/inject-css-fallbacks.js](../scripts/inject-css-fallbacks.js)).
   Use `npm run css:fallbacks:check` to dry-run.
4. **Consistent naming** — Follow the naming convention for custom tokens.
5. **Document custom tokens** — Add JSDoc comments explaining purpose.
6. **Test theme switching** — Verify all tokens work across every theme × mode.
7. **Regenerate from source** — Don't edit generated CSS files directly;
   change tokens in Figma and run `npm run tokens:generate`.

## Where Do I Add a New Token?

```
Is the value the same across all themes?
├── YES → Is it a raw design value (color hex, px scale)?
│         ├── YES → Add to figma-tokens primitives.
│         │        Output: tokens/sherpa-primitives.css (--sherpa-core-*).
│         └── NO  → Is it a font composite or status mapping?
│                   └── YES or NO → figma-tokens alias → tokens/sherpa-alias.css
│                                  (font composites and [data-status]
│                                  mapping are appended to the same file)
└── NO  → Is it a brand colour family scoped to specific themes?
          ├── YES → Add prefix to THEME_SCOPED_FAMILIES in
          │        scripts/generate-css-tokens.js, then add the tokens to
          │        each owning theme's DTCG folder.
          └── NO  → Add to each theme's DTCG folder.
                   Output: sherpa-theme-{default-slug}.css carries the full
                   surface; extended themes emit only the diffs against it
                   (computed automatically).
```

After any change: `npm run tokens:generate` — never hand-edit the generated
files.

---

## Troubleshooting

### Tokens not applying

1. Ensure `@import "css/styles/index.css"` is at top of stylesheet
2. Check for typos in token name (case-sensitive)
3. Verify CSS specificity isn't being overridden
4. Check browser DevTools for actual computed value

### Token value not found

1. Check `css/styles/` files for the token name
2. If missing, add to Figma and run `npm run tokens:extract && npm run tokens:generate`

### Theme not switching

1. Verify `<style id="sherpa-theme">` exists in `<head>` with the correct `@import` URL
2. Confirm `color-scheme` is set on `<html>` (`light dark` for auto, `light` or `dark` for forced)
3. Clear browser cache (CSS files may be cached)
4. Inspect computed style to see actual `light-dark()` resolved value

---

## Resources

- [Figma Design System](../figma-tokens/)
- [Component Reference](../components/README.md)
- [CSS Custom Properties Spec](https://www.w3.org/TR/css-variables-1/)
- [Design Tokens Format](https://v2.designtokens.org/)
