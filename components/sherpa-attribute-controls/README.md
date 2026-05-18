# sherpa-attribute-controls

Auto-generates interactive form controls from a target component's attributes. Automatically introspects JSDoc annotations, CSS patterns, or common naming conventions to determine control types and valid values. Supports grouping, presets, custom validators, and bidirectional synchronization.

## Features

- **Auto-introspection** via JSDoc, CSS, or naming patterns
- **Smart control generation** — switches, radio groups, selects, text/number inputs
- **Grouping strategies** — by prefix, by category, or flat layout
- **Preset configurations** — save and restore component states
- **Bidirectional sync** — watch target for external changes
- **Custom validators** — validate user input before applying
- **Excluded/read-only/disabled** attributes — fine-grained control
- **Accessible** — proper labels, ARIA attributes, keyboard navigation

## Basic Usage

### Simple Control Panel
```html
<sherpa-attribute-controls data-target="sherpa-button"></sherpa-attribute-controls>

<sherpa-button id="my-button">Click me</sherpa-button>

<script>
  document.querySelector('sherpa-attribute-controls').setTarget('#my-button');
</script>
```

### With Grouped Layout
```html
<sherpa-attribute-controls 
  data-target="sherpa-input-text"
  data-grouped
  data-grouping-strategy="by-category">
</sherpa-attribute-controls>

<sherpa-input-text data-label="Name" placeholder="Enter your name"></sherpa-input-text>
```

### With Presets
```html
<sherpa-attribute-controls 
  data-target=".my-button"
  data-presets='{
    "primary": { "data-variant": "primary", "data-size": "lg" },
    "secondary": { "data-variant": "secondary", "data-size": "md" }
  }'>
</sherpa-attribute-controls>

<sherpa-button class="my-button">Button</sherpa-button>

<script>
  // Apply preset
  await document.querySelector('sherpa-attribute-controls').applyPreset('primary');
</script>
```

### With Custom Validators
```javascript
const controls = document.querySelector('sherpa-attribute-controls');

// Validate that size is only xs or sm
controls.setValidator('data-size', (value) => {
  return ['xs', 'sm'].includes(value);
});

controls.addEventListener('control-error', (e) => {
  console.error(`Invalid value for ${e.detail.attribute}: ${e.detail.error}`);
});
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-target` | string | — | CSS selector for target component (required or use `setTarget()`) |
| `data-exclude` | string | — | Comma-separated attributes to exclude (e.g., `"role,aria-*"`) |
| `data-order` | string | — | Comma-separated attributes; render order |
| `data-readonly` | string | — | Comma-separated attributes (no edit) |
| `data-disabled` | string | — | Comma-separated attributes (hidden) |
| `data-grouped` | flag | — | Group controls by category or prefix |
| `data-grouping-strategy` | enum | `"auto"` | `"auto"`, `"none"`, `"by-prefix"`, `"by-category"` |
| `data-control-types` | string | — | Override control types: `"data-size:radio,data-variant:select"` |
| `data-labels` | string | — | JSON labels override: `'{"data-variant": "Style"}'` |
| `data-introspection-strategy` | enum | `"auto"` | `"auto"`, `"jsdoc"`, `"css"`, `"patterns"`, `"override"` |
| `data-presets` | string | — | JSON preset configurations |
| `data-observe-target` | flag | — | Watch target for external attribute changes |
| `data-debounce` | number | `50` | Debounce ms for attribute updates |
| `data-validate` | flag | — | Enable validation feedback |

## Introspection Strategies

### Auto (Default)
Tries introspection in this order: JSDoc → CSS → Patterns → Plaintext

### JSDoc
Extracts `@attr` tags from component's JSDoc:
```javascript
/**
 * @attr {enum} data-variant — primary | secondary | tertiary
 * @attr {boolean} disabled
 */
```

Supported types:
- `enum` — Radio/select controls with values extracted from description
- `boolean` — Switch control
- `string` — Text input
- `number` — Number input

### CSS
Analyzes component's CSS `:host([data-*])` selectors to determine attributes and values.

### Patterns
Uses common naming conventions:
- `data-variant` → select (primary, secondary, tertiary)
- `data-size` → radio (xs, sm, md, lg, xl)
- `data-status` → select (critical, warning, success, info)
- `disabled` → switch

### Override
Uses `data-control-types` attribute for explicit configuration:
```html
<sherpa-attribute-controls 
  data-target=".my-button"
  data-control-types="data-variant:select,data-size:radio,disabled:switch">
</sherpa-attribute-controls>
```

## Grouping Strategies

### None (Flat)
```html
<sherpa-attribute-controls data-grouping-strategy="none">
</sherpa-attribute-controls>
```
All controls in a single list.

### By-Prefix
```html
<sherpa-attribute-controls data-grouping-strategy="by-prefix">
</sherpa-attribute-controls>
```
Groups `data-icon-start`, `data-icon-end` under "Icon"; `data-label` under "Label".

### By-Category
```html
<sherpa-attribute-controls data-grouping-strategy="by-category">
</sherpa-attribute-controls>
```
Pre-defined categories: Sizing, State, Appearance, Content, Behavior, Other.

## JavaScript API

### Properties

```javascript
// Resolved target element (read-only)
controls.targetComponent;
// → HTMLElement

// Is target found? (read-only)
controls.hasTarget;
// → boolean

// Successful introspection strategy (read-only)
controls.introspectionStrategy;
// → "jsdoc" | "css" | "patterns" | "override" | null
```

### Methods

```javascript
// Resolve target by selector or element
await controls.setTarget('sherpa-button#primary');

// Refresh control UI
await controls.refreshUI();

// Get all current attribute values
const state = controls.getControlState();
// → { 'data-variant': 'primary', 'data-size': 'lg', ... }

// Set multiple attributes
await controls.setValues({
  'data-variant': 'secondary',
  'data-size': 'md'
});

// Apply preset configuration
await controls.applyPreset('secondary');

// Register custom validator
controls.setValidator('data-size', (value) => {
  return ['xs', 'sm'].includes(value);
});

// Override control type for attribute
controls.setControlType('data-color', 'select', {
  values: ['red', 'blue', 'green']
});

// Get attribute configuration
const config = controls.getAttributeConfig('data-variant');
// → { type: 'select', values: [...], label: '...' }
```

### Events

#### `controls-change`
Fired when an attribute value changes:
```javascript
controls.addEventListener('controls-change', (e) => {
  console.log(`${e.detail.attribute} = ${e.detail.newValue}`);
  console.log('All:', e.detail.all); // Complete state
});
```

#### `control-input`
Fired on real-time input (before debounce/apply):
```javascript
controls.addEventListener('control-input', (e) => {
  console.log(`User typing: ${e.detail.value}`);
});
```

#### `target-found`
Fired when target is successfully resolved:
```javascript
controls.addEventListener('target-found', (e) => {
  console.log('Target found with attributes:', e.detail.attributes);
});
```

#### `target-not-found`
Fired when target selector fails:
```javascript
controls.addEventListener('target-not-found', (e) => {
  console.error(`Target not found: ${e.detail.error}`);
});
```

#### `introspection-complete`
Fired after attribute introspection:
```javascript
controls.addEventListener('introspection-complete', (e) => {
  console.log(`Discovered ${e.detail.count} attributes via ${e.detail.strategy}`);
});
```

#### `control-error`
Fired if validation fails:
```javascript
controls.addEventListener('control-error', (e) => {
  console.error(`${e.detail.attribute}: ${e.detail.error}`);
});
```

#### `target-changed`
Fired when target's attributes change externally (if `data-observe-target`):
```javascript
controls.addEventListener('target-changed', (e) => {
  console.log(`${e.detail.attribute} changed externally: ${e.detail.oldValue} → ${e.detail.newValue}`);
});
```

## CSS Parts

Use `::part()` for custom styling:

```css
sherpa-attribute-controls::part(control-item) { /* Control wrapper */ }
sherpa-attribute-controls::part(control-label) { /* Labels */ }
```

## Examples

### Documentation Playground
```html
<div class="docs-example">
  <div class="controls-sidebar">
    <sherpa-attribute-controls 
      data-target=".component-preview"
      data-grouped
      data-observe-target>
    </sherpa-attribute-controls>
  </div>

  <div class="component-preview">
    <sherpa-button data-variant="primary">Click me</sherpa-button>
  </div>
</div>
```

### Storybook-Style Knobs
```javascript
const controls = document.querySelector('sherpa-attribute-controls');

controls.addEventListener('controls-change', (e) => {
  // Update URL for sharing
  const url = new URL(window.location);
  url.searchParams.set(e.detail.attribute, e.detail.newValue);
  window.history.replaceState({}, '', url);
});

// Load preset from URL
const preset = new URL(window.location).searchParams.get('preset');
if (preset) {
  await controls.applyPreset(preset);
}
```

### Multi-Component Layout
```html
<sherpa-attribute-controls 
  data-target="#button-1"
  data-exclude="role,tabindex">
</sherpa-attribute-controls>

<sherpa-attribute-controls 
  data-target="#button-2"
  data-exclude="role,tabindex">
</sherpa-attribute-controls>

<sherpa-button id="button-1">Button 1</sherpa-button>
<sherpa-button id="button-2">Button 2</sherpa-button>
```

## Accessibility

- **Labels:** Every control has a proper `<label>`
- **ARIA:** Region role with aria-label
- **Keyboard:** All controls keyboard-accessible
- **Screen Readers:** Attribute names announced; groups use `<legend>`
- **Validation:** Error states with `aria-invalid`

## Browser Support

- Chrome 99+
- Firefox 97+
- Safari 15.4+
- Edge 99+

## Related

- [sherpa-code-block](../sherpa-code-block/) — Syntax-highlighted code display
- [Sherpa UI Components](../README.md)
- [Design System](../../css/TOKENS-USAGE-GUIDE.md)
