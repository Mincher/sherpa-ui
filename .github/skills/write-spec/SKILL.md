---
name: write-spec
description: 'Start a new Sherpa UI feature spec; ideate a new screen or view; capture requirements before prototyping; plan a Sherpa feature from scratch.'
---

# Write Spec

Produce a versioned spec document for a Sherpa UI feature. The spec drives prototype generation — write it first, prototype from it second.

This skill runs in **consumer projects** that have sherpa-ui installed as a dependency.

---

## Step 1 — Call the MCP prompt

```
spec_ideate({ featureName: 'device-management', context: '...' })
```

Provide any context already known (e.g. "admin panel for managing network devices, list + detail views").

---

## Step 2 — Follow the three Q&A rounds

The prompt will guide you through three rounds. Do not compress or skip unless the user has already answered.

**Round 1 — Purpose & Users** (always ask):
1. What problem does this feature solve, and who uses it?
2. What are the 1–3 most important things users can *do* here?
3. Which views/screens does this feature need? (list briefly)

**Round 2 — Views & Navigation** (per view named in Round 1):
- What data does this view show? What shape? (single record / list of N / KPI snapshot)
- What are the primary actions on this view?
- Does this view link to or open other views in this feature?

**Round 3 — Interactions & Edge Cases**:
- Are any actions multi-step (wizard/dialog) or immediate (single click)?
- What happens when there's no data, or data can't be loaded?
- Anything explicitly out of scope for this first prototype?

---

## Step 3 — Show the spec draft and confirm

Produce the complete spec in this format:

```markdown
---
title: {Feature Name}
status: draft
version: 1
---

## Summary
One paragraph describing what the feature does and the problem it solves.

## Views

### {View Name}
- Purpose: ...
- Key components: ...
- Primary actions: ...
- Empty state: ...

## Interactions

### {Flow Name}
- Trigger: ...
- Steps: ...
- On success: ...
- On cancel: ...

## Out of Scope

## Open Questions
```

**Do not write the file until the user explicitly confirms the spec.**

---

## Step 4 — Write the file

Write to `specs/{featureName}.spec.md` in the consumer's project root.

Use kebab-case for the filename: "Device Management" → `device-management.spec.md`.

---

## Step 5 — Offer the next step

After writing, ask:

> "Ready to prototype `{first view name}`? I'll use the `prototype-view` skill."

---

## Spec evolution

When requirements change, update the spec file directly:
- Increment `version` in the frontmatter
- Change `status` from `draft` → `review` → `approved` as the team reviews
- Resolve Open Questions by moving answers into the relevant Views or Interactions section
