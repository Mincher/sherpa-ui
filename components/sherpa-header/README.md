# sherpa-header

Reusable header component with multiple template variants.

## Templates

| Type | Description | Key Slots |
|------|-------------|-----------|
| `container` | Dashboard container panel header | `heading`, `description`, `actions` |
| `menu` | Menu/popover header with optional search | `search`, `extra` |
| `dialog` | Modal dialog header with close button | `heading`, `description` |
| `section` | Section heading with optional divider | `heading`, `badge`, `description`, `actions` |
| `data-viz` | Data visualization header (uppercase title) | `filters`, `actions` |
| `card` | Pure slot passthrough | `heading`, default |

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | `section` | Template variant |
| `heading` | string | — | Title/heading text |
| `description` | string | — | Subtitle/description text |
| `heading-type` | string | `primary` | Section variant: primary, secondary, tertiary |
| `divider` | boolean | — | Show bottom divider (section) |
| `drag-handle` | boolean | — | Show drag handle (container) |
| `close-button` | boolean | — | Show close button (menu) |
| `close-label` | string | `Close` | Close button accessible label |
| `dismissible` | string | — | Whether close button is visible (dialog) |
| `search` | boolean | — | Show search field (menu) |
| `search-placeholder` | string | `Search` | Search field placeholder |
| `density` | string | — | compact, comfortable (section) |

## Events

| Event | Detail | Description |
|-------|--------|-------------|
| `header-close` | — | Close button clicked |
| `header-search` | `{ query }` | Search input changed |
