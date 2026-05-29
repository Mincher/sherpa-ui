# Playground → Enhanced Component Docs

> **Proposal:** Integrate playground features into existing docs system rather than building a separate tool

---

## Current Architecture (Correct Pattern)

### Root: `index.html`
```html
<div class="docs-shell">
  <sherpa-nav data-src-html="/docs/nav.html"></sherpa-nav>
  
  <sherpa-layout-view data-fill="parent" data-heading="Sherpa UI">
    <!-- Theme/mode/density controls -->
    <sherpa-input-select slot="header-actions">...</sherpa-input-select>
    
    <!-- Router outlet for component pages -->
    <main id="docs-outlet">
      <!-- Injected by router.js -->
    </main>
  </sherpa-layout-view>
</div>
```

### CSS: `docs.css`
```css
.docs-shell {
  height: 100dvh;
  --docs-nav-rail: 60px; /* Collapsed */
}

.docs-shell:has(#docs-nav-panel[data-pinned="true"]) {
  --docs-nav-rail: 320px; /* Pinned */
}

#docs-view {
  width: calc(100% - var(--docs-nav-rail));
  margin-inline-start: var(--docs-nav-rail);
}
```

### Component Pages: `demo/component-doc/component-doc.js`
- Loads metadata from `component-docs.json`
- Manages attribute state
- Renders demo instances
- Already has theme/mode/density controls

---

## What's Missing (Playground Features to Add)

### 1. **Live Code Editor**
**Current:** Static demos  
**Enhance:** Add `<textarea>` with live HTML editing  
**Location:** New section in component doc pages

### 2. **Attribute Controls**
**Current:** Metadata-driven but not interactive  
**Enhance:** Generate UI controls from schema (checkboxes, dropdowns, text inputs)  
**Location:** Already in `component-doc.js`, expand it

### 3. **API Documentation Display**
**Current:** Listed in component README  
**Enhance:** Auto-generate from schema, show in expandable sections  
**Location:** Component doc pages

### 4. **Shareable URLs**
**Current:** Router-based  
**Enhance:** Encode component state in URL params  
**Location:** Router integration

---

## Proposed Enhancement

### Component Doc Page Structure

```html
<!-- Injected into #docs-outlet by router -->
<div class="docs-page" data-component="sherpa-button">
  
  <!-- Header (existing) -->
  <sherpa-section-header data-label="Button">
    <sherpa-tag>control</sherpa-tag>
  </sherpa-section-header>

  <!-- Description (existing) -->
  <div class="docs-impl-notes">
    <p>Interactive button component...</p>
  </div>

  <!-- === NEW: Interactive Demo Section === -->
  <sherpa-container>
    <sherpa-container-header>Live Demo</sherpa-container-header>
    
    <!-- 2-column layout: Controls | Preview -->
    <div class="docs-demo-grid">
      
      <!-- Left: Attribute Controls (auto-generated) -->
      <div class="docs-demo-controls">
        <div class="control-group">
          <label>data-variant</label>
          <select data-attr="data-variant">
            <option>primary</option>
            <option>secondary</option>
            <option>ghost</option>
          </select>
        </div>
        <!-- More controls... -->
      </div>

      <!-- Right: Live Preview -->
      <div class="docs-demo-preview">
        <sherpa-button data-variant="primary">Click Me</sherpa-button>
      </div>
    </div>
  </sherpa-container>

  <!-- === NEW: Code Editor Section === -->
  <sherpa-container style="margin-top: 1rem;">
    <sherpa-container-header>
      HTML Code
      <sherpa-button slot="actions" data-size="sm" id="copy-code">
        <i slot="icon-before" class="fa-solid fa-copy"></i>
        Copy
      </sherpa-button>
    </sherpa-container-header>
    
    <textarea class="docs-code-editor">
<sherpa-button data-variant="primary">
  Click Me
</sherpa-button>
    </textarea>
  </sherpa-container>

  <!-- API Documentation (existing, enhanced) -->
  <sherpa-accordion class="docs-api-accordion">
    <!-- Auto-generated from schema -->
  </sherpa-accordion>

</div>
```

---

## Implementation Plan

### Phase 1: Enhance component-doc.js

**File:** `demo/component-doc/component-doc.js`

**Add:**
1. **Control Generator** — Read schema, create UI controls
   ```javascript
   function generateControls(attributes) {
     return attributes.map(attr => {
       if (attr.enumValues) return createSelect(attr);
       if (attr.type === 'boolean') return createCheckbox(attr);
       return createTextInput(attr);
     });
   }
   ```

2. **Live Preview Sync** — Update demo on control change
   ```javascript
   function updateDemo(attr, value) {
     componentEl.dataset[attr] = value;
     updateCodeEditor();
   }
   ```

3. **Code Editor** — Editable textarea with syntax highlighting
   ```javascript
   function initCodeEditor() {
     const editor = document.querySelector('.docs-code-editor');
     editor.addEventListener('input', debounce(updatePreview, 300));
   }
   ```

4. **URL State** — Encode/decode component state
   ```javascript
   function updateURL() {
     const params = new URLSearchParams();
     params.set('component', componentName);
     params.set('state', btoa(JSON.stringify(state)));
     history.replaceState(null, '', `?${params}`);
   }
   ```

### Phase 2: Update Component Doc Pages

**Template:** Add to each `components/*/component-doc.html`

```html
<!-- Live Demo Section -->
<sherpa-container data-demo-container>
  <sherpa-container-header>Live Demo</sherpa-container-header>
  <div class="docs-demo-grid">
    <div data-demo-controls></div>
    <div data-demo-preview></div>
  </div>
</sherpa-container>

<!-- Code Editor Section -->
<sherpa-container data-code-container>
  <sherpa-container-header>
    HTML Code
    <sherpa-button slot="actions" data-size="sm" data-copy-code>
      Copy
    </sherpa-button>
  </sherpa-container-header>
  <textarea data-code-editor></textarea>
</sherpa-container>
```

### Phase 3: Add CSS

**File:** `demo/component-doc/component-doc.css`

```css
.docs-demo-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1rem;
  padding: 1rem;
}

.docs-demo-preview {
  padding: 2rem;
  border: 1px solid var(--sherpa-color-border);
  border-radius: var(--sherpa-border-radius-md);
  background: var(--sherpa-color-surface);
}

.docs-code-editor {
  width: 100%;
  min-height: 200px;
  padding: 1rem;
  font-family: 'Source Code Pro', monospace;
  background: #1e1e1e;
  color: #d4d4d4;
  border: none;
}
```

---

## Benefits of This Approach

### 1. **Single System**
- One place for all component documentation
- Consistent navigation (existing sherpa-nav)
- Theme controls already integrated

### 2. **Progressive Enhancement**
- Docs work without JavaScript (static content)
- Interactive features layer on top
- Existing router/navigation preserved

### 3. **Proper Architecture**
- Follows Sherpa UI patterns (HTML-first, CSS-second, JS-last)
- Uses proper components (sherpa-layout-view, sherpa-container, etc.)
- Matches existing docs shell structure

### 4. **Less Code**
- Reuse existing metadata system
- Reuse existing theme/mode/density controls
- Reuse existing routing
- No duplicate navigation

### 5. **Better UX**
- No context switch between docs and playground
- Every component page gets interactive demo
- Consistent experience across all components

---

## Migration Path

1. **Delete** `playground/` directory
2. **Enhance** `demo/component-doc/component-doc.js` with:
   - Control generator
   - Live preview sync
   - Code editor
   - URL state management
3. **Update** component doc page templates with new sections
4. **Add** styles to `demo/component-doc/component-doc.css`
5. **Test** on sherpa-button, sherpa-calendar
6. **Roll out** to all component pages

---

## Result

Every component documentation page becomes an interactive playground:
- ✅ Browse components via existing nav
- ✅ See description, API reference
- ✅ **Interactive demo** with live controls
- ✅ **Code editor** with live preview
- ✅ **Shareable URLs** with component state
- ✅ Theme/mode/density controls
- ✅ Proper Sherpa UI architecture

**One system. Better together.** 🎯
