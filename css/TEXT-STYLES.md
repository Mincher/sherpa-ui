# Text Style Utility Classes

Consolidated text styling system for all components. These utility classes replace individual component-specific text styling properties with a consistent, token-based system.

## Typography Tokens

### Font Families
- `--sherpa-fonts-context-default` → Open Sans (default UI font)
- `--sherpa-fonts-context-brand` → Manrope (brand/display font)
- `--sherpa-fonts-context-monospaced` → Source Code Pro (code/technical values)

### Font Scales
- `--sherpa-fonts-scale-xs`: 10px
- `--sherpa-fonts-scale-sm`: 12px
- `--sherpa-fonts-scale-base`: 14px
- `--sherpa-fonts-scale-lg`: 16px
- `--sherpa-fonts-scale-xl`: 20px
- `--sherpa-fonts-scale-2xl`: 24px
- `--sherpa-fonts-scale-3xl`: 28px
- And larger scales up to 14xl (72px)

### Letter Spacing
- `--sherpa-fonts-letter-spacing-tight`: -0.02px
- `--sherpa-fonts-letter-spacing-base`: 0.1px
- `--sherpa-fonts-letter-spacing-wide`: 0.5px
- `--sherpa-fonts-letter-spacing-wider`: 1px

## Utility Classes

### Font Family

```css
.font-default   /* Open Sans - default UI */
.font-brand     /* Manrope - display/headings */
.font-mono      /* Source Code Pro - code */
```

### Headings

```css
.text-heading-lg   /* 16px, 600 weight - page titles, view headers */
.text-heading-md   /* 14px, 600 weight - section headers */
.text-heading-sm   /* 12px, 600 weight - subsection headings */
.text-title-component  /* 12px, 600, uppercase, tracked - data-viz titles */
```

**Example:**
```html
<h1 class="text-heading-lg">View Title</h1>
<h2 class="text-heading-md">Section Header</h2>
<div class="text-title-component">Chart Title</div>
```

### Body Text

```css
.text-body      /* 14px, 400 weight - default body text */
.text-body-sm   /* 12px, 400 weight - smaller body text */
.text-body-xs   /* 10px, 400 weight - captions, footnotes */
```

**Example:**
```html
<p class="text-body">This is normal body text.</p>
<p class="text-body-sm">This is smaller body text.</p>
```

### Labels

```css
.text-label             /* 12px, 600 weight - form labels, control labels */
.text-label-subheader   /* 12px, 600, uppercase - section subheaders */
.text-label-group       /* 12px, 600, uppercase, tracked - group labels */
.text-nav-item          /* 14px, 500 weight - navigation items */
```

**Example:**
```html
<label class="text-label">Field Label</label>
<div class="text-label-subheader">Group Header</div>
```

### Display / Metrics

```css
.text-display-3xl    /* 28px, brand font - large metric values */
.text-display-2xl    /* 24px, brand font - medium metric values */
.text-metric-delta   /* 12px, 600 weight - metric change indicators */
```

**Example:**
```html
<div class="text-display-3xl">42,592</div>
<div class="text-metric-delta">+12.5%</div>
```

### Monospace

```css
.text-mono   /* 12px, Source Code Pro - code, technical values */
```

**Example:**
```html
<div class="text-mono">{ "value": 123 }</div>
```

### Font Weight

```css
.font-light      /* 300 */
.font-normal     /* 400 */
.font-medium     /* 500 */
.font-semibold   /* 600 */
.font-bold       /* 700 */
```

### Text Transform

```css
.uppercase       /* TEXT TRANSFORM */
.lowercase       /* text transform */
.capitalize      /* Text Transform */
.normal-case     /* reset transform */
```

### Text Truncation

```css
.truncate        /* Ellipsis overflow */
.text-wrap       /* Allow wrapping */
.text-nowrap     /* Prevent wrapping */
```

## Migration Guide

### Before (Component-specific CSS)

```css
.my-component-title {
  font-family: var(--sherpa-fonts-context-default);
  font-size: var(--sherpa-fonts-scale-base);
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.1px;
}
```

### After (Utility class)

```html
<div class="text-heading-md">My Component Title</div>
```

Or combine utilities:

```html
<div class="font-default font-semibold uppercase">Custom Styling</div>
```

## Component Integration

Components should:
1. **Remove** component-specific font properties (font-family, font-size, font-weight, line-height, letter-spacing)
2. **Add** appropriate text utility classes to HTML templates
3. **Keep** component-specific spacing, colors, and layout properties

### Example: Updating a Component

**Before** (`sherpa-card.html`):
```html
<div class="card-title">Card Title</div>
```

**Before** (`sherpa-card.css`):
```css
.card-title {
  font-family: var(--sherpa-fonts-context-default);
  font-size: var(--sherpa-fonts-scale-base);
  font-weight: 600;
  line-height: 1.4;
  /* Keep these: */
  margin-bottom: 8px;
  color: var(--card-title-color);
}
```

**After** (`sherpa-card.html`):
```html
<div class="card-title text-heading-md">Card Title</div>
```

**After** (`sherpa-card.css`):
```css
.card-title {
  /* Removed font properties */
  /* Keep component-specific: */
  margin-bottom: 8px;
  color: var(--card-title-color);
}
```

## Text Color Tokens

Use these tokens for text colors (not part of the text-styles section in style.css):
- `--sherpa-text-default-body` - Primary body text
- `--sherpa-text-default-secondary` - Secondary/muted text
- `--sherpa-text-primary-default` - Primary brand color text
- `--sherpa-text-context-success-default` - Success status text
- `--sherpa-text-context-error-default` - Error status text
- `--sherpa-text-context-warning-default` - Warning status text
- And many more in `color-tokens.css`

## Legacy Classes

The `.content-title` class is maintained for backwards compatibility but new code should use `.text-title-component` instead.
