---
name: patch-view
description: 'Patch a prototype view; update part of a view without regenerating; make a targeted edit to the prototype; change something specific in the prototype.'
---

# Patch View

Make a targeted edit to an existing prototype file without touching the rest of it. Use this for small, well-scoped changes — adding a field to a dialog, swapping a component variant, updating seed data, adjusting layout.

For sweeping structural changes, use `regenerate-view` instead.

This skill runs in **consumer projects** that have sherpa-ui installed as a dependency.

---

## Step 1 — Read both files

Read:
- `prototypes/{featureName}/{viewName}.html` — understand the current structure
- `specs/{featureName}.spec.md` — confirm the patch is within spec scope

---

## Step 2 — Confirm scope before editing

State exactly what will change and what will stay untouched — **wait for confirmation**:

> "I'll add a `sherpa-input-date-range` field to the Add Device dialog, between the Port and Notes fields. Everything else in the file — the grid, filter-bar, seed data, prototype banner — stays untouched. Proceed?"

If the patch would touch more than ~20% of the file, suggest `regenerate-view` instead.

---

## Step 3 — Get component-correct guidance

Call the MCP prompt to ensure the added/changed markup uses correct attributes:

```
spec_prototype({ specContent, featureName, viewName, mode: 'patch', patchRequest: 'add date-range field to Add dialog' })
```

---

## Step 4 — Apply with Edit tool

Use the Edit tool with targeted `old_string` / `new_string` replacements — not a full file rewrite.

Check that the edit doesn't break surrounding elements (unclosed tags, mismatched nesting, duplicate IDs).

---

## Step 5 — Quick attribute check

Run `validate_usage` on just the changed section:

```
validate_usage(changedSectionHtml)
```

Fix any warnings before returning.

---

## When NOT to use this skill

Use `regenerate-view` instead when:
- The spec version has changed and multiple sections need updating
- The layout pattern itself needs to change (e.g. list-view → view-with-rails)
- More than ~20% of the file would be touched
