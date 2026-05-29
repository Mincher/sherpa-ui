# ADR-002: Three-File Split Per Component

**Status:** Accepted  
**Date:** 2024 (initial architecture)  
**Deciders:** Design System Team  
**Linked Requirements:** REQ-01, REQ-21

## Context

Mixing structure (HTML), presentation (CSS), and behavior (JavaScript) in a single file makes it difficult to:
- Enforce separation of concerns
- Review changes to specific layers
- Detect layer violations (e.g., JS manipulating styles directly)
- Enable AI agents to understand component architecture

## Decision

Each component lives in `components/<tag>/<tag>.{html,css,js}`:
- **`.html`** — Template structure, slots, semantic elements
- **`.css`** — All presentation (styles, variants, states, visibility)
- **`.js`** — Data, lifecycle, events, attribute coordination

## Rationale

Forces **single responsibility per file**:
- HTML owns structure and accessibility
- CSS owns all visual presentation
- JavaScript owns data and behavior

Makes layer-violation reviews trivial:
- PR touching `.css` should not modify `.js`
- Changes to visibility should be in `.css`, not `.js`

## Consequences

### Positive

- ✅ **Clear ownership:** Each layer has a single file
- ✅ **Easy code review:** Changes are scoped to one concern
- ✅ **Enforces progressive enhancement:** HTML and CSS work before JS loads
- ✅ **AI-friendly:** Clear separation helps LLMs understand architecture

### Negative

- ❌ **File management:** Three files to keep in sync per component
- ❌ **Coordination overhead:** Cross-layer changes require editing multiple files

## Implementation Notes

### File Structure
```
components/
└── sherpa-button/
    ├── sherpa-button.html   # Template
    ├── sherpa-button.css    # Styles
    └── sherpa-button.js     # Behavior
```

### Layer Responsibilities

**HTML Layer (`.html`):**
- Structure via semantic elements
- Content projection via `<slot>`
- Multi-template variants via `<template id="...">`
- Cloning prototypes for repeating structure

**CSS Layer (`.css`):**
- All visual styling
- Variants via `:host([data-variant])`
- Visibility via `:host([data-*])` attribute selectors
- Responsive behavior via container queries

**JavaScript Layer (`.js`):**
- Lifecycle hooks (`onRender`, `onConnect`, etc.)
- Event handling and dispatch
- Attribute observation and coordination
- Data fetching and state management

## References

- [CSS-FILE-TEMPLATE.md](../CSS-FILE-TEMPLATE.md)
- [COMPONENT-TEMPLATE.md](../COMPONENT-TEMPLATE.md)
- [.github/instructions/copilot-instructions.md](../../.github/instructions/copilot-instructions.md)
