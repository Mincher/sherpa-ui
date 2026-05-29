# Architectural Decision Records (ADRs)

This directory contains records of architectural decisions made for the Sherpa UI component library.

## What is an ADR?

An Architectural Decision Record (ADR) captures a significant architectural decision along with its context and consequences. Each ADR describes a choice that affects the structure, operation, or design of the system.

## When to Create an ADR

Create an ADR when making decisions about:

- **Core architectural patterns** (e.g., Shadow DOM, CSS cascade layers)
- **Build and tooling strategies** (e.g., bundler requirements, token generation)
- **Component design patterns** (e.g., multi-template support, slot composition)
- **API surface contracts** (e.g., data attribute patterns, event naming)
- **Technology choices** (e.g., constructable stylesheets vs link tags)
- **Breaking changes** or deprecations that impact consumers

## ADR Template

```markdown
# ADR-NNNN: [Short Title]

**Status:** [Proposed | Accepted | Deprecated | Superseded by ADR-XXXX]  
**Date:** YYYY-MM-DD  
**Authors:** Name(s)  
**Related:** [Links to related ADRs, issues, or specs]

## Context

What is the issue we're seeing that is motivating this decision or change? What constraints exist? What are we trying to solve?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

What becomes easier or more difficult to do because of this change?

### Positive

- Benefit 1
- Benefit 2

### Negative

- Tradeoff 1
- Tradeoff 2

### Neutral

- Consideration 1

## Alternatives Considered

What other approaches did we consider and why were they rejected?

### Alternative 1: [Name]
- **Description:** ...
- **Pros:** ...
- **Cons:** ...
- **Rejected because:** ...

## Implementation Notes

Any specific guidance for implementing this decision (optional).

## References

- [Links to relevant documentation, discussions, or resources]
```

## How to Create an ADR

1. Copy the template above
2. Create a new file: `docs/adr/NNNN-short-title.md`
   - Number sequentially (0001, 0002, etc.)
   - Use kebab-case for the title
3. Fill in all sections
4. Submit for review as part of your pull request
5. Link to the ADR from relevant documentation

## Approval Process

1. **Draft**: Create ADR in pull request
2. **Discussion**: Team reviews and discusses
3. **Revision**: Incorporate feedback
4. **Accepted**: Merge PR, update status to "Accepted"

## Index of ADRs

### Core Architecture

- [ADR-001: Web Components + Shadow DOM, No Framework](0001-web-components-shadow-dom.md) — Platform choice and framework independence
- [ADR-002: Three-File Split Per Component](0002-three-file-component-split.md) — Separation of HTML, CSS, and JS
- [ADR-008: Constructable Stylesheets Cached Per `cssUrl`](0008-constructable-stylesheets.md) — Memory-efficient CSS delivery

### Progressive Enhancement

- [ADR-003: CSS Owns Visibility via `:host([data-*])`](0003-css-owns-visibility.md) — Declarative visibility control
- [ADR-004: `data-*` Attribute Prefix Mandatory](0004-data-attribute-prefix.md) — Future-proof attribute naming
- [ADR-006: Cloning Template Prototypes](0006-cloning-template-prototypes.md) — Template-first DOM construction

### Design Tokens & Theming

- [ADR-005: Semantic Tokens Only in Component CSS](0005-semantic-tokens-only.md) — Theme portability
- [ADR-009: Consolidate Override Layers](0009-consolidate-override-layers.md) — Simplified CSS cascade architecture

### Event Architecture

- [ADR-007: Custom Events Bubble; Cross Shadow Only When Needed](0007-custom-events-bubble.md) — Event propagation policy

---

## Complete Index Table

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-web-components-shadow-dom.md) | Web Components + Shadow DOM, No Framework | Accepted | 2024 |
| [0002](0002-three-file-component-split.md) | Three-File Split Per Component | Accepted | 2024 |
| [0003](0003-css-owns-visibility.md) | CSS Owns Visibility via `:host([data-*])` | Accepted | 2024 |
| [0004](0004-data-attribute-prefix.md) | `data-*` Attribute Prefix Mandatory | Accepted | 2024 |
| [0005](0005-semantic-tokens-only.md) | Semantic Tokens Only in Component CSS | Accepted | 2024 |
| [0006](0006-cloning-template-prototypes.md) | Cloning Template Prototypes | Accepted | 2024 |
| [0007](0007-custom-events-bubble.md) | Custom Events Bubble; Cross Shadow Only When Needed | Accepted | 2024 |
| [0008](0008-constructable-stylesheets.md) | Constructable Stylesheets Cached Per `cssUrl` | Accepted | 2024 |
| [0009](0009-consolidate-override-layers.md) | Consolidate Override Layers (Density + Status → Overrides) | Accepted | 2026-05-28 |

## Resources

- [Michael Nygard's ADR article](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR GitHub organization](https://adr.github.io/)
- [Markdown Architectural Decision Records (MADR)](https://adr.github.io/madr/)
