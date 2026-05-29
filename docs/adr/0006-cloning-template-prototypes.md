# ADR-006: Cloning Template Prototypes Over `createElement` / `innerHTML`

**Status:** Accepted  
**Date:** 2024 (initial architecture)  
**Deciders:** Design System Team  
**Linked Requirements:** REQ-04

## Context

Components often need to render repeating structure:
- List items in `sherpa-list`
- Step indicators in `sherpa-stepper`
- Calendar days in `sherpa-input-date`
- Menu items in `sherpa-menu`

Building this structure via JavaScript (`document.createElement()` or `.innerHTML`) has several downsides:
- **Hidden from reviewers:** Structure is buried in JavaScript strings
- **Hard for AI agents:** LLMs can't see the rendered shape
- **Maintenance burden:** HTML strings are error-prone
- **Security risk:** `innerHTML` can introduce XSS if not careful

## Decision

Repeating structure **SHALL** be authored as `<template class="*-tpl">` in the component HTML and cloned per use in JavaScript.

### Pattern

**HTML Template (`.html`):**
```html
<div class="step-container"></div>

<!-- Cloning prototype (no id attribute) -->
<template class="step-item-tpl">
  <div class="step-item" role="tab">
    <div class="step-indicator"></div>
    <span class="step-label"></span>
  </div>
</template>
```

**JavaScript (`.js`):**
```javascript
const container = this.$('.step-container');
const template = this.$('template.step-item-tpl');

steps.forEach((step, index) => {
  const clone = template.content.cloneNode(true);
  const item = clone.querySelector('.step-item');
  const label = clone.querySelector('.step-label');
  
  label.textContent = step.label;
  item.dataset.index = index;
  
  container.appendChild(clone);
});
```

## Rationale

- **Template is single source of truth:** HTML file shows the rendered shape
- **Reviewable:** PR reviewers see structural changes in HTML, not JS strings
- **AI-friendly:** LLMs can analyze template structure
- **Safe:** No `innerHTML` string concatenation
- **Performant:** Native DOM cloning is faster than parsing strings

## Consequences

### Positive

- ✅ **Reviewable:** HTML shape visible in template file
- ✅ **Safe:** No XSS risk from string concatenation
- ✅ **Performant:** Browser-optimized cloning
- ✅ **Maintainable:** Easier to modify structure

### Negative

- ❌ **Extra step:** Requires explicit `cloneNode()` call in JS
- ❌ **Two-phase construction:** Template declares shape, JS populates data

## Implementation Notes

### Naming Convention

Cloning prototypes use `class="*-tpl"` (no `id` attribute):
- `class="step-item-tpl"` for step items
- `class="menu-item-tpl"` for menu items  
- `class="day-cell-tpl"` for calendar cells

**Rationale:** `SherpaElement` uses `template[id]` to find main templates. Cloning prototypes without `id` are ignored by the base class.

### Cloning Pattern

```javascript
// 1. Find template
const tpl = this.$('template.item-tpl');

// 2. Clone content (deep clone)
const clone = tpl.content.cloneNode(true);

// 3. Query cloned elements
const item = clone.querySelector('.item');

// 4. Populate with data
item.textContent = data.text;
item.dataset.id = data.id;

// 5. Append to container
container.appendChild(clone);
```

### Data-Driven Rendering

For components that render from data arrays:

```javascript
onRender() {
  const template = this.$('template.item-tpl');
  const container = this.$('.items-container');
  
  this.items.forEach(item => {
    const clone = template.content.cloneNode(true);
    this.populateItem(clone, item);
    container.appendChild(clone);
  });
}

populateItem(fragment, data) {
  const el = fragment.querySelector('.item');
  el.textContent = data.label;
  el.dataset.value = data.value;
}
```

## Alternative Considered

**Option: `createElement()` in JavaScript**

```javascript
// ❌ Rejected approach
const item = document.createElement('div');
item.className = 'step-item';
item.setAttribute('role', 'tab');

const indicator = document.createElement('div');
indicator.className = 'step-indicator';
item.appendChild(indicator);

const label = document.createElement('span');
label.className = 'step-label';
label.textContent = step.label;
item.appendChild(label);

container.appendChild(item);
```

**Why rejected:** Hides structure in JavaScript, harder to review and maintain.

## References

- [COMPONENT-TEMPLATE.md](../COMPONENT-TEMPLATE.md) — Cloning prototypes section
- [HTML Standard: Template Element](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element)
