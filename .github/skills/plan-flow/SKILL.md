---
name: plan-flow
description: 'Before designing a CRUD workflow, multi-step form, or any user flow spanning multiple interactions; before calling generate_flow; when an Add, Edit, Delete, or wizard flow is needed.'
---

# Plan Flow

**Gather everything first, then generate.** Three rounds of questions produce a flow spec you confirm before any FlowManager/FormManager code is written.

---

## Round 1 — Flow type and scope (always ask)

1. What entity is being acted on? (e.g. "user", "device", "order" — give the singular noun)
2. Which operations are needed? (add / edit / delete / bulk-delete / clone / import / export — pick all that apply)
3. Is this a single-step dialog or a multi-step wizard?

**Skip questions the user already answered.**

---

## Round 2 — Fields (for add/edit flows)

For each field, ask: name, data type, required or optional.

Then ask:
- Are any fields conditional? (e.g. show "VLAN ID" only when Type = "Server")
- Any complex inputs? (file upload, date range, multi-select with many options)

Confirm the field list back before proceeding:

> "So the form has: Name (required text), Type (required select), Port (optional number, 1–65535), Notes (optional textarea) — correct?"

---

## Round 3 — Validation and feedback

- Client-side validation only, or does save need to hit an API first?
- On success: close dialog + toast + refresh grid? Or navigate somewhere?
- On error: keep dialog open with inline error callout, or close and show error toast?
- Delete flow: needs a separate confirmation dialog with a warning callout?

---

## Output: Flow Spec

Before generating, output a spec and **wait for explicit confirmation**:

```
Entity: Device
Operations: Add + Edit (shared dialog), Delete (separate confirm dialog)
Dialog size: medium (4+ fields)
Fields:
  - name        (text, required)
  - type        (select, required) — options: Workstation | Server | Network
  - port        (number, optional, 1–65535)
  - notes       (textarea, optional)
Conditional: port is shown only when type = "Server"
Validation: client-side required + range checks; POST to API on save
On success: close dialog → SherpaToast.success('Device saved') → refreshDataset()
On error: keep dialog open → sherpa-callout[data-status="critical"] inside dialog
Delete: confirm dialog with sherpa-callout[data-status="warning"] → SherpaToast.success on confirm
MCP call: generate_flow({ flowType: "add", entityName: "Device", fields: [...] })

Ready to generate FlowManager + FormManager wiring and full HTML — confirm?
```

---

## After confirmation

1. Call `generate_flow(...)` MCP tool to get the base HTML and JS wiring
2. Extend with conditional field logic if needed
3. Wire all dialog open/close with `el.setAttribute('data-open', '')` / `el.removeAttribute('data-open')`
4. Confirm `SherpaToast.success()` / `SherpaToast.critical()` on flow completion/error
5. Call `refreshDataset()` after successful mutations to re-dispatch `datasetfiltered`
6. Run `validate_usage(html)` and fix every warning before returning
