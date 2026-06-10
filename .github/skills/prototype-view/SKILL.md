---
name: prototype-view
description: 'Generate a prototype view from a Sherpa spec; build a prototype from spec; prototype this feature; create a Sherpa prototype view.'
---

# Prototype View

Generate a self-contained prototype HTML file for a view defined in a feature spec. Prototypes use real Sherpa components, hardcoded seed data, and minimal wiring JS — no build step, just open in a browser.

This skill runs in **consumer projects** that have sherpa-ui installed as a dependency.

---

## Before generating

1. **Read the spec** — `specs/{featureName}.spec.md`
2. **Confirm the view is defined** in the spec's Views section
3. **Warn if status is `draft`** — "This spec is still in draft; the prototype is provisional"
4. **State your plan and confirm** before generating:

> "I'll build a `list-view` layout with `sherpa-data-grid` + `sherpa-filter-bar`, an Add flow wired to a dialog, and seed data for 5 devices — confirm?"

---

## Generating

Call the MCP prompt:

```
spec_prototype({ specContent, featureName, viewName, mode: 'generate' })
```

Then write the output to `prototypes/{featureName}/{viewName}.html`.

---

## Prototype file conventions

Every prototype HTML file must follow these rules:

### 1. Self-contained
Loads sherpa-ui directly — no build step needed:

```html
<link rel="stylesheet" href="../../node_modules/sherpa-ui/css/styles/index.css">
<script type="module">
  import '../../node_modules/sherpa-ui/dist/index.js';
  // component wiring...
</script>
```

Path is relative from `prototypes/{featureName}/`. Adjust depth if the consumer uses a different structure.

### 2. Prototype banner
A top bar that does NOT affect sherpa layout — inline styles only:

```html
<div style="
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  background: #1a1a2e; color: #fff; font-family: monospace;
  font-size: 12px; padding: 6px 16px; display: flex; align-items: center; gap: 12px;
">
  <span style="background:#e63946;color:#fff;padding:2px 8px;border-radius:3px;font-weight:bold;">PROTOTYPE</span>
  <span>Device Management › Device List</span>
  <span style="opacity:0.6;">spec v1 · device-management.spec.md</span>
</div>
<div style="height: 32px;"></div><!-- spacer for fixed banner -->
```

### 3. Real Sherpa components — correct attributes and tokens
No mock-ups. Use `query_component('sherpa-tag')` if uncertain about attribute names.

### 4. Hardcoded seed data
Realistic placeholder data — not "foo", "bar", "test". Wire grids and charts with `setData()` / `setValues()`.

For multiple views in a feature, extract shared seed data to `_seed.js`:

```js
// prototypes/device-management/_seed.js
export const DEVICES = [
  { id: 1, name: 'WS-001', type: 'Workstation', status: 'active', lastSeen: '2026-06-10' },
  { id: 2, name: 'SRV-007', type: 'Server', status: 'critical', lastSeen: '2026-06-08' },
];
```

Then import: `import { DEVICES } from './_seed.js';`

### 5. `<template>` elements for repeated content
Clone via `cloneNode(true)` — never use `createElement()`:

```html
<template id="device-row-tpl">
  <tr><td class="name"></td><td class="status"></td></tr>
</template>
```

### 6. Minimal JS
Wire open/close and basic navigation only. Mark real API call locations:

```js
saveBtn.addEventListener('button-click', () => {
  // TODO: POST /api/devices with FormManager.read(form)
  dialog.removeAttribute('data-open');
  SherpaToast.success('Device saved');
  refreshDataset(grid);
});
```

No `fetch()` calls. No real validation beyond what Sherpa inputs provide natively.

---

## After writing

List remaining un-prototyped views from the spec:

> "Prototype written to `prototypes/device-management/device-list.html`. Still to prototype from the spec: Device Detail, Settings."
