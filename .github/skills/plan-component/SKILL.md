---
name: plan-component
description: 'Before adding a component to a page or view; when the right component is not obvious; when composing a component for a specific use case; before calling query_component or generating markup.'
---

# Plan Component

**Ask first, generate second.** Run this skill before writing any component markup. Three rounds of targeted questions produce a spec you confirm before any code is written.

---

## Round 1 — Context (always ask, max 3 questions)

1. What is the purpose of this component — what should users be able to *do* with it?
2. Where will it appear? (inside a form/dialog / standalone on a page / inside a panel or container)
3. Is the data static (hardcoded) or dynamic (from an API or user input)?

**Skip a question if the user already answered it.** If context makes all three clear, skip to the component recommendation directly.

---

## Round 2 — Conditional specifics (ask only the relevant branch)

| If it's a… | Ask… |
|---|---|
| Display/data component (chart, metric, grid, list) | What shape is the data? How many items? Does it need filtering, pagination, or grouping? |
| Input component | What type of value (text, number, date, selection, boolean, file)? Any constraints (required, min/max, specific option list)? |
| Feedback/overlay (dialog, callout, toast, message) | What triggers it? Does the user need to confirm/dismiss, or does it auto-close? |
| Navigation (nav, tabs, breadcrumbs) | How many items? Is active state driven by URL routing or programmatic selection? |

---

## Round 3 — Variants and states (keep short)

- Which visual weight fits? (primary / secondary / subtle tertiary)
- Which status colours might be needed? (critical / warning / success / info — or none)
- Are there loading, empty, or error states to handle?

---

## Output: Component Spec

Before generating any markup, output a spec block and **wait for explicit confirmation**:

```
Recommended component: sherpa-data-grid
Template/variant: default (with data-show-pagination)
Key attributes: data-selectable, data-show-pagination, data-segment-field="status"
Composition: wrap in sherpa-container (data-col-span="12") inside sherpa-layout-grid
States needed: loading (data-loading on grid), empty (sherpa-empty-state in empty slot)
MCP call to confirm API: query_component('sherpa-data-grid')

Does this match what you're looking for? Confirm and I'll generate the markup.
```

Show the reasoning — which alternatives you ruled out and why. This makes the decision visible and correctable before any code is produced.

---

## After confirmation

1. Call `query_component('sherpa-tag')` to get the definitive attribute list
2. Call `get_component_examples('sherpa-tag')` to see proven patterns
3. Generate the markup
4. Run `validate_usage(html)` and fix every warning before returning the result
