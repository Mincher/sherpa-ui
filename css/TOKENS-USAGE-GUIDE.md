# Design Tokens Usage Guide

Complete guide to using and extending the Apex design token system.

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

// Switch theme
document.documentElement.setAttribute('data-theme', 'dark');
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

### Automatic Theme Switching

Tokens use CSS `light-dark()` function for automatic theme support:

```css
/* Automatically switches based on prefers-color-scheme */
--sherpa-text-default-body: light-dark(#000000, #ffffff);
```

### Manual Theme Override

Force a specific theme:

```html
<!-- Force dark theme -->
<html data-theme="dark">
  ...
</html>
```

```css
/* CSS will respect data-theme attribute */
[data-theme="dark"] {
  color-scheme: dark;
}
```

---

## Extending Tokens

### Process Figma Tokens

When adding new tokens in Figma Tokens 2.0:

```bash
node scripts/process-figma-tokens.js
```

This:
1. Reads Figma token definitions from `figma-tokens/tokens 2.0/`
2. Processes primitives, aliases, themes, density, and status
3. Generates CSS files in `css/styles/`

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

1. **Always use tokens** — Never hardcode colors, spacing, or sizes
2. **Favor semantic tokens** — Use `--sherpa-surface-container-default` over `--sherpa-color-brand-base`
3. **Consistent naming** — Follow the naming convention for custom tokens
4. **Document custom tokens** — Add JSDoc comments explaining purpose
5. **Test theme switching** — Ensure all tokens work in light and dark modes
6. **Regenerate from source** — Don't edit CSS token files directly; process from Figma

---

## Troubleshooting

### Tokens not applying

1. Ensure `@import "css/styles/index.css"` is at top of stylesheet
2. Check for typos in token name (case-sensitive)
3. Verify CSS specificity isn't being overridden
4. Check browser DevTools for actual computed value

### Token value not found

1. Check `css/styles/` files for the token name
2. If missing, add to Figma Tokens 2.0 and run `npm run tokens:process`

### Theme not switching

1. Verify `data-theme` attribute is set on `<html>` element
2. Check `prefers-color-scheme` media query support
3. Clear browser cache (tokens may be cached)
4. Inspect computed style to see actual value

---

## Resources

- [Figma Design System](../figma-tokens/)
- [Component Reference](../components/README.md)
- [CSS Custom Properties Spec](https://www.w3.org/TR/css-variables-1/)
- [Design Tokens Format](https://v2.designtokens.org/)
