# Architectural Decision Records (ADR)

This directory contains Architectural Decision Records (ADRs) for Sherpa UI. Each ADR captures a significant architectural decision, its context, and its consequences.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its context and consequences. ADRs help us understand why certain architectural choices were made and track the evolution of our system architecture over time.

## When to Create an ADR

Create an ADR when you make a significant architectural decision, such as:

- Choosing a fundamental technology or pattern (e.g., Shadow DOM, Web Components)
- Defining system-wide conventions (e.g., data attribute API, progressive enhancement)
- Making trade-offs that affect the entire system (e.g., no bundler requirement)
- Establishing constraints or guidelines (e.g., composition tier system)

## ADR Template

Use this template for new ADRs:

```markdown
# ADR-XXXX: [Short Title]

**Status:** [Proposed | Accepted | Deprecated | Superseded by ADR-YYYY]  
**Date:** YYYY-MM-DD  
**Deciders:** [List of people involved in the decision]  
**Tags:** [relevant, tags, here]

## Context

What is the issue that we're seeing that is motivating this decision or change?

## Decision

What is the change that we're actually proposing or doing?

## Consequences

### Positive

What becomes easier or better as a result of this decision?

### Negative

What becomes harder or worse as a result of this decision?

### Neutral

What remains the same or has trade-offs?

## Alternatives Considered

What other options were considered and why were they not chosen?

## References

Links to related documents, discussions, or resources.
```

## ADR Lifecycle

- **Proposed:** Decision is under discussion
- **Accepted:** Decision has been approved and should be followed
- **Deprecated:** Decision is no longer recommended but may still be in use
- **Superseded:** Decision has been replaced by a newer ADR

## ADR Numbering

ADRs are numbered sequentially using the format `XXXX` (four digits with leading zeros):
- `0001-shadow-dom-encapsulation.md`
- `0002-constructable-stylesheets.md`
- etc.

## How to Create an ADR

1. **Copy the template** above into a new file
2. **Number it sequentially** (check existing ADRs for the next available number)
3. **Fill in all sections** with as much detail as needed
4. **Submit for review** via pull request
5. **Update status** to "Accepted" once approved
6. **Update this index** below

## Process

1. **Draft:** Write the ADR using the template
2. **Discuss:** Share with the team for feedback
3. **Review:** Address feedback and reach consensus
4. **Accept:** Merge the ADR with "Accepted" status
5. **Reference:** Link to the ADR from relevant documentation

---

## Index of ADRs

### Active Decisions

| Number | Title | Date | Status | Tags |
|--------|-------|------|--------|------|
| 0001 | [Shadow DOM Encapsulation](0001-shadow-dom-encapsulation.md) | TBD | Proposed | architecture, encapsulation |
| 0002 | [Constructable Stylesheets](0002-constructable-stylesheets.md) | TBD | Proposed | performance, css |
| 0003 | [Progressive Enhancement Philosophy](0003-progressive-enhancement-philosophy.md) | TBD | Proposed | architecture, html-first |
| 0004 | [Data Attribute API Pattern](0004-data-attribute-api-pattern.md) | TBD | Proposed | api, conventions |
| 0005 | [Composition Tier System](0005-composition-tier-system.md) | TBD | Proposed | architecture, composition |
| 0006 | [Multi-Template Pattern](0006-multi-template-pattern.md) | TBD | Proposed | templates, patterns |
| 0007 | [No Bundler Requirement](0007-no-bundler-requirement.md) | TBD | Proposed | architecture, modules |
| 0008 | [Figma as Token Source of Truth](0008-figma-token-source-of-truth.md) | TBD | Proposed | design-tokens, workflow |

### Deprecated Decisions

_None yet_

### Superseded Decisions

_None yet_

---

## Resources

- [Architectural Decision Records (ADR) - Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR GitHub Organization](https://adr.github.io/)
- [When Should I Write an Architecture Decision Record](https://engineering.atspotify.com/2020/04/when-should-i-write-an-architecture-decision-record/)

---

**Last Updated:** 2026-05-28
