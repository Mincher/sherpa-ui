# Node Component Consolidation Analysis

**Date:** June 4, 2026  
**Status:** Partial — deprecation of `sherpa-node-header` in favour of `sherpa-node-row data-variant="header"` is decided and documented; 5 example usages in `sherpa-node-canvas.examples.html` still need updating; v3.0 removal timeline not formalised  
**Investigation:** Phase 1, Priority 1.2  
**Goal:** Reduce node component count by consolidating `sherpa-node-header` into `sherpa-node-row`

---

## Current State

### Component Inventory

**1. `sherpa-node`** (668 lines TypeScript)
- Main node container component
- Handles: positioning, selection, subtype picker, template system
- Slots: header, default (rows), footer
- Complex logic for conditional row visibility and template swapping

**2. `sherpa-node-canvas`** (1,723 lines TypeScript)
- Flow diagram canvas container
- Manages: connections, drag-drop, zoom/pan, layout
- Most complex component in the node system

**3. `sherpa-node-row`** (104 lines TypeScript)
- **Unified row component** with variants
- `data-variant="header"` - 48px header row
- `data-variant="body"` - Body content row (default)
- Handles both cases with single component

**4. `sherpa-node-header`** (99 lines TypeScript)
- ⚠️ **DEPRECATED** in favor of `sherpa-node-row data-variant="header"`
- Maintained for backward compatibility only
- Documentation explicitly says: "Use `<sherpa-node-row data-variant="header">` instead"

**5. `sherpa-node-socket`** (187 lines TypeScript)
- Connection point primitive
- Data-driven: direction (in/out), variant, status, connection count
- Pure presentational, emits high-level events

---

## Key Finding: sherpa-node-header IS ALREADY DEPRECATED

From `sherpa-node-header.ts` line 2-6:

```typescript
/**
 * @deprecated Use <sherpa-node-row data-variant="header"> instead.
 * This component is maintained for backward compatibility but new code
 * should use the unified sherpa-node-row component with data-variant="header".
 */
```

### Consolidation Status

**✅ ALREADY DONE:** The consolidation decision was made previously!

- `sherpa-node-row` with `data-variant="header"` replaces `sherpa-node-header`
- Both components share identical implementation (99 vs 104 lines, nearly same code)
- `sherpa-node-row` is the future, `sherpa-node-header` is legacy

---

## Usage Analysis

### sherpa-node-header Usage (5 files):

1. `components/sherpa-node-header/sherpa-node-header.html` - Component's own template
2. `components/sherpa-node-header/sherpa-node-header.examples.html` - Examples file
3. `components/sherpa-node-canvas/sherpa-node-canvas.examples.html` - **5 uses** in canvas examples

### sherpa-node-row Usage:

1. `components/sherpa-node/sherpa-node.examples.html` - 9 uses (all variants)
2. `components/sherpa-node/sherpa-node.html` - Mentioned in slot documentation
3. New code uses `sherpa-node-row` exclusively

### Migration Path

**Only 1 file needs updating:** `components/sherpa-node-canvas/sherpa-node-canvas.examples.html`

Change:
```html
<sherpa-node-header data-icon="fa-solid fa-database">Device telemetry</sherpa-node-header>
```

To:
```html
<sherpa-node-row data-variant="header" data-icon="fa-solid fa-database">Device telemetry</sherpa-node-row>
```

---

## Recommended Actions

### Immediate (Phase 1):

1. ✅ **Update canvas examples** - Replace 5 `sherpa-node-header` uses with `sherpa-node-row`
2. ✅ **Mark for removal** - Add removal timeline to deprecation notice
3. ✅ **Document migration** - Create migration guide for external consumers

### Future (Phase 2 - Breaking Change):

4. ⚠️ **Remove sherpa-node-header** entirely (Sherpa v3.0)
   - Delete `components/sherpa-node-header/` directory
   - Remove from component exports
   - Add to CHANGELOG as breaking change

---

## Code Comparison: sherpa-node-header vs sherpa-node-row

Both components are **functionally identical** for header use:

| Feature | node-header | node-row (header variant) |
|---------|-------------|---------------------------|
| Line count | 99 lines | 104 lines |
| Icon support | ✅ `data-icon` | ✅ `data-icon` |
| Drill-down button | ✅ `data-drill-down` | ✅ `data-drill-down` |
| Slots | icon, title, actions, sockets | icon, title, actions, sockets |
| Events | `sherpa-node-drilldown` | `sherpa-node-drilldown` |
| CSS tokens | sherpa-node-tokens.css | sherpa-node-tokens.css |
| Implementation | Identical logic | Identical logic |

**Difference:** `sherpa-node-row` also handles body rows (`data-variant="body"`), making it more versatile.

---

## Node-Socket Analysis

### Should sherpa-node-socket be consolidated?

**Answer: NO**

**Reasons:**

1. **Different concern** - Socket is a connection primitive, not a layout component
2. **Reusable** - Sockets are slotted into rows, not part of row structure
3. **Complex logic** - 187 lines handling connection states, multi-input, flow-active
4. **Used across variants** - Appears in headers, body rows, and group nodes
5. **Low coupling** - Sockets don't depend on row implementation

**Architectural principle:**
- `sherpa-node-row` = **Layout** (header or body structure)
- `sherpa-node-socket` = **Data** (connection point with state)

These are orthogonal concerns and should remain separate.

---

## Final Component Count After Consolidation

### Before (Current):
- sherpa-node (668 lines)
- sherpa-node-canvas (1,723 lines)
- **sherpa-node-header (99 lines) ← DEPRECATED**
- sherpa-node-row (104 lines)
- sherpa-node-socket (187 lines)
- **Total: 5 components**

### After (Phase 1):
- sherpa-node (668 lines)
- sherpa-node-canvas (1,723 lines)
- **sherpa-node-header (99 lines) ← STILL EXISTS** (backward compat)
- sherpa-node-row (104 lines) ← PRIMARY
- sherpa-node-socket (187 lines)
- **Total: 5 components** (but node-header is legacy-only)

### After (Phase 2 - Sherpa v3.0):
- sherpa-node (668 lines)
- sherpa-node-canvas (1,723 lines)
- sherpa-node-row (104 lines)
- sherpa-node-socket (187 lines)
- **Total: 4 components** ✅

---

## Immediate Action Plan

### Step 1: Update Examples (Today)

Replace `sherpa-node-header` in canvas examples:

```bash
# File: components/sherpa-node-canvas/sherpa-node-canvas.examples.html
# 5 replacements
```

### Step 2: Enhanced Deprecation Notice (Today)

Update `sherpa-node-header.ts` deprecation comment:

```typescript
/**
 * @deprecated since v2.1.0 — Will be removed in v3.0.0
 * 
 * Use <sherpa-node-row data-variant="header"> instead.
 * This component is maintained for backward compatibility only.
 * 
 * Migration:
 *   <sherpa-node-header data-icon="fa-home">Title</sherpa-node-header>
 *   →
 *   <sherpa-node-row data-variant="header" data-icon="fa-home">Title</sherpa-node-row>
 */
```

### Step 3: Create Migration Guide (Today)

Add `docs/migrations/node-header-to-node-row.md`:

```markdown
# Migrating from sherpa-node-header to sherpa-node-row

## Why?

sherpa-node-header is deprecated in favor of the unified sherpa-node-row component.

## Migration

Replace:
  <sherpa-node-header data-icon="fa-icon">Label</sherpa-node-header>

With:
  <sherpa-node-row data-variant="header" data-icon="fa-icon">Label</sherpa-node-row>

All attributes and slots remain the same.
```

### Step 4: Add CHANGELOG Entry (Today)

```markdown
## [2.1.0] - 2026-06-04

### Deprecated
- `sherpa-node-header` - Use `<sherpa-node-row data-variant="header">` instead. 
  Will be removed in v3.0.0. See migration guide: docs/migrations/node-header-to-node-row.md
```

---

## Summary

### Your Original Question:
> "Do we need a node-header component for example?"

### Answer: **NO - It's already deprecated!**

**What happened:**
- Node header was consolidated into `sherpa-node-row` with variants
- `sherpa-node-header` exists only for backward compatibility
- New code already uses `sherpa-node-row data-variant="header"`
- Migration is 99% complete (only examples still use old component)

**What's left:**
1. Update 5 example uses in canvas
2. Document deprecation timeline (removal in v3.0)
3. Create migration guide for external users
4. Remove component entirely in next major version

**Component reduction:**
- **Now:** 5 node components (1 deprecated)
- **Soon:** 4 node components (after v3.0 breaking change)

---

## Broader Node System Observations

### Component Architecture (Final):

```
┌────────────────────────────────────────┐
│ sherpa-node-canvas                     │
│  └─ Contains multiple sherpa-node      │
│       └─ sherpa-node                   │
│            ├─ sherpa-node-row (header) │
│            ├─ sherpa-node-row (body)   │
│            │    └─ sherpa-node-socket  │
│            └─ sherpa-node-row (body)   │
│                 └─ sherpa-node-socket  │
└────────────────────────────────────────┘
```

### Consolidation Opportunities Exhausted

**No further consolidation recommended:**

1. **sherpa-node** - Complex controller, handles subtype/template system
2. **sherpa-node-canvas** - Complex container, handles connections/layout
3. **sherpa-node-row** - Layout primitive with 2 variants (header/body)
4. **sherpa-node-socket** - Data primitive for connections

Each component has a distinct responsibility. Further consolidation would:
- Mix concerns (layout + data + control logic)
- Reduce reusability
- Increase complexity
- Hurt maintainability

### Architectural Principle Validated

**Composition over consolidation** applies here:
- `sherpa-node` = composition of `sherpa-node-row` components
- `sherpa-node-row` = container for `sherpa-node-socket` (via slots)
- Each layer has clear responsibility

This is **good architecture**, not fragmentation.

---

**End of Analysis**  
Status: Consolidation already done (header→row), cleanup phase remains  
Next: Complete deprecation migration, update examples, document timeline
