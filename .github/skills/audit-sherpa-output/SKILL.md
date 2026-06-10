---
name: audit-sherpa-output
description: 'After generating any Sherpa UI; reviewing component HTML for correctness; auditing generated code; before submitting a PR containing Sherpa markup; quality-gate check on component usage.'
---

# Audit Sherpa Output

Run this quality gate after generating any Sherpa UI markup — before committing or submitting.

---

## Step 1 — Run `validate_usage`

Call the MCP tool with the full HTML fragment:

```
validate_usage(html)
```

It automatically checks for:
- **Unknown component tags** (error) — typos like `<sherpa-buton>`
- **Unknown or invalid-valued attributes** (error/warning) — attributes not in the component's schema
- **Self-closing custom elements** (error) — `<sherpa-x />` is illegal; custom elements require explicit closing tags
- **`<sherpa-button>text</sherpa-button>`** (warning) — text content is never rendered; use `data-label`
- **`<sherpa-progress-bar value="...">`** (warning) — native attr silently ignored; use `data-value`
- **`<sherpa-container-header data-label="...">`** (warning) — use `data-title` instead
- **`<sherpa-button class="input-action">`** (warning) — use a native `<button>` + `<i>` inside input shadow DOMs
- **`opacity` + `disabled`** (warning) — use inactive tokens per property instead

**Fix all errors. Treat warnings as errors for new code.**

---

## Step 2 — Pre-Submission Checklist

Work through this before every PR or code review:

```
□ Every <sherpa-button> uses data-label (no text content between tags)
□ No self-closing custom elements (<sherpa-x /> is illegal)
□ All custom attributes use the data- prefix (not bare names)
□ No element.style.display or classList toggling — CSS owns visibility via data-* selectors
□ No --core-* tokens used directly — always --sherpa-* with hardcoded fallback
□ No opacity for disabled — use inactive token per property
□ No :host:not() chained form — use :host(:not()) functional form
□ Focus indicators use box-shadow, not --focus-ring() (silent failure = invisible focus ring)
□ Events use bubbles: true; cross-shadow events also use composed: true
□ Toasts use SherpaToast static methods (.success(), .critical(), .warning(), .info())
□ Charts inside containers with explicit dimensions or container-type:size
□ Metric sparklines wired with setValues() or setData() after await el.rendered
```

---

## Common Warning → Fix

| `validate_usage` reports… | Fix |
|---|---|
| `has text content "..."` | Move text to `data-label="..."` attribute on `<sherpa-button>` |
| `uses native "value"` | Rename attribute to `data-value` on `<sherpa-progress-bar>` |
| `uses "data-label"` on container-header | Rename to `data-title` |
| `is self-closing` | Add explicit `</sherpa-x>` closing tag |
| `class="input-action"` | Replace `<sherpa-button>` with native `<button>` + `<i class="fa-solid fa-...">` |
| `Unknown attribute "foo"` | Call `query_component('sherpa-tag')` to see valid attribute names |
| `opacity` + `disabled` | Replace `opacity: 0.5` with `color: var(--sherpa-content-inactive-default, ...)` etc. |
