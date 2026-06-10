---
name: regenerate-view
description: 'Regenerate a prototype view; rebuild a view from scratch after spec changes; start the prototype over; recreate the view entirely.'
---

# Regenerate View

Wipe and recreate a prototype view file from the current spec. Use this when the spec has changed significantly, or when you want a clean slate rather than incremental patches.

This skill runs in **consumer projects** that have sherpa-ui installed as a dependency.

---

## Step 1 — Read the spec and existing file

Read both:
- `specs/{featureName}.spec.md` — understand what has changed
- `prototypes/{featureName}/{viewName}.html` — understand what exists

---

## Step 2 — Confirm the regeneration

State clearly what will happen and **wait for explicit user confirmation**:

> "This will replace `prototypes/device-management/device-list.html` entirely. The existing file will be overwritten. The new version will use the `list-view` pattern with data-grid + filter-bar (matching spec v2 which added the status filter column). Proceed?"

Do not overwrite without explicit confirmation.

---

## Step 3 — Generate

Call the MCP prompt:

```
spec_prototype({ specContent, featureName, viewName, mode: 'regenerate' })
```

---

## Step 4 — Write the file

Overwrite `prototypes/{featureName}/{viewName}.html` with the new output.

Follow all [prototype file conventions](../prototype-view/SKILL.md) from the prototype-view skill.

---

## Step 5 — Summarise structural changes

Report what is structurally different from the previous version:

> "Regenerated. Key changes from the previous prototype:
> - Added status filter to filter-bar (spec v2 requirement)
> - Switched from 5 seed rows to 8 (covers all status variants)
> - Dialog now uses medium size (was small — spec updated field count)"
