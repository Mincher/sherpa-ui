# sherpa-footer

Reusable footer component with multiple template variants.

## Templates

| Type | Description | Key Slots |
|------|-------------|-----------|
| `action-bar` | Cancel + Apply button bar | `start` |
| `slot` | Pure slot passthrough | default |

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | `slot` | Template variant |
| `cancel-label` | string | `Cancel` | Cancel button text (action-bar) |
| `apply-label` | string | `Apply` | Apply button text (action-bar) |
| `show-cancel` | boolean | `true` | Show cancel button (action-bar) |
| `show-apply` | boolean | `true` | Show apply button (action-bar) |
| `apply-closes` | boolean | `true` | Whether apply auto-closes parent (action-bar) |

## Events

| Event | Detail | Description |
|-------|--------|-------------|
| `footer-cancel` | — | Cancel button clicked |
| `footer-apply` | `{ closes }` | Apply button clicked |
