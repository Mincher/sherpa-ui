# Migrating from sherpa-node-header to sherpa-node-row

**Status:** `sherpa-node-header` is deprecated since v2.1.0 and will be removed in v3.0.0

---

## Why?

`sherpa-node-header` has been consolidated into the unified `sherpa-node-row` component with variant support. This reduces component count and simplifies the node API.

---

## Quick Migration

### Before (deprecated):
```html
<sherpa-node data-kind="source" data-node-id="src" data-x="40" data-y="60">
  <sherpa-node-header data-icon="fa-solid fa-database">
    Device telemetry
  </sherpa-node-header>
  <sherpa-node-row>
    <span>rows</span>
  </sherpa-node-row>
</sherpa-node>
```

### After (current):
```html
<sherpa-node data-kind="source" data-node-id="src" data-x="40" data-y="60">
  <sherpa-node-row data-variant="header" data-icon="fa-solid fa-database">
    Device telemetry
  </sherpa-node-row>
  <sherpa-node-row>
    <span>rows</span>
  </sherpa-node-row>
</sherpa-node>
```

**Change:** Add `data-variant="header"` and rename tag from `sherpa-node-header` to `sherpa-node-row`

---

## Attribute Compatibility

All attributes remain identical:

| Attribute | sherpa-node-header | sherpa-node-row (header) |
|-----------|-------------------|--------------------------|
| `data-icon` | ✅ | ✅ Same |
| `data-drill-down` | ✅ | ✅ Same |

**New requirement:** `data-variant="header"` attribute

---

## Slot Compatibility

All slots remain identical:

| Slot | sherpa-node-header | sherpa-node-row (header) |
|------|-------------------|--------------------------|
| `icon` | ✅ | ✅ Same |
| `title` | ✅ | ✅ Same |
| `actions` | ✅ | ✅ Same |
| `input-socket` | ✅ | ✅ Same |
| `output-socket` | ✅ | ✅ Same |

---

## Event Compatibility

All events remain identical:

| Event | sherpa-node-header | sherpa-node-row (header) |
|-------|-------------------|--------------------------|
| `sherpa-node-drilldown` | ✅ | ✅ Same |

---

## Search & Replace

Use this regex to migrate files:

### Find:
```regex
<sherpa-node-header
```

### Replace:
```
<sherpa-node-row data-variant="header"
```

### Find:
```regex
</sherpa-node-header>
```

### Replace:
```
</sherpa-node-row>
```

---

## Examples

### Example 1: Basic header
```html
<!-- Before -->
<sherpa-node-header data-icon="fa-solid fa-cube">
  Transform
</sherpa-node-header>

<!-- After -->
<sherpa-node-row data-variant="header" data-icon="fa-solid fa-cube">
  Transform
</sherpa-node-row>
```

### Example 2: With drill-down
```html
<!-- Before -->
<sherpa-node-header data-icon="fa-solid fa-folder" data-drill-down>
  Group Node
</sherpa-node-header>

<!-- After -->
<sherpa-node-row data-variant="header" data-icon="fa-solid fa-folder" data-drill-down>
  Group Node
</sherpa-node-row>
```

### Example 3: With custom slots
```html
<!-- Before -->
<sherpa-node-header>
  <svg slot="icon">...</svg>
  <span slot="title">Custom</span>
  <sherpa-button slot="actions" data-size="small" data-icon-start="&#xf013;"></sherpa-button>
</sherpa-node-header>

<!-- After -->
<sherpa-node-row data-variant="header">
  <svg slot="icon">...</svg>
  <span slot="title">Custom</span>
  <sherpa-button slot="actions" data-size="small" data-icon-start="&#xf013;"></sherpa-button>
</sherpa-node-row>
```

### Example 4: With sockets
```html
<!-- Before -->
<sherpa-node-header data-icon="fa-solid fa-filter">
  <sherpa-node-socket slot="input-socket" data-direction="input"></sherpa-node-socket>
  Filter
  <sherpa-node-socket slot="output-socket" data-direction="output"></sherpa-node-socket>
</sherpa-node-header>

<!-- After -->
<sherpa-node-row data-variant="header" data-icon="fa-solid fa-filter">
  <sherpa-node-socket slot="input-socket" data-direction="input"></sherpa-node-socket>
  Filter
  <sherpa-node-socket slot="output-socket" data-direction="output"></sherpa-node-socket>
</sherpa-node-row>
```

---

## TypeScript/JavaScript

If importing the component directly:

### Before:
```typescript
import '../sherpa-node-header/sherpa-node-header.js';
```

### After:
```typescript
import '../sherpa-node-row/sherpa-node-row.js';
```

---

## Why This Change?

1. **Consolidation** - Reduces node components from 5 to 4
2. **Consistency** - Single component handles both header and body rows via variants
3. **Maintainability** - Less duplicate code (header and row were 99% identical)
4. **Flexibility** - Easier to add new row variants in the future

---

## Timeline

- **v2.1.0** (June 2026) - `sherpa-node-header` deprecated, warnings in console
- **v2.2.0** - **v2.9.0** - Both components work (backward compatible)
- **v3.0.0** (TBD) - `sherpa-node-header` removed entirely

---

## Need Help?

- See [node-consolidation-analysis.md](../investigations/node-consolidation-analysis.md) for technical details
- Check [sherpa-node-row README](../../components/sherpa-node-row/README.md) for full API
- File issues: [GitHub Issues](https://github.com/n-able/sherpa-ui/issues)
