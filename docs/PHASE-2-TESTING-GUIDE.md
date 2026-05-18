# Phase 2 CSS Modernization — Testing Guide

> **Status**: Phase 3 (Testing & Validation)  
> **Date**: May 18, 2026  
> **Scope**: 4 pilot components with CSS nesting refactor

---

## Overview

This guide validates that CSS nesting refactors maintain **100% functional parity** with the original flat CSS while reducing file sizes by 2.9%–54.7%.

### Pilot Components Tested

| Component | File | Reduction | Nested Selectors |
|-----------|------|-----------|------------------|
| sherpa-button | `components/sherpa-button/sherpa-button.css` | **54.7%** (702→318 lines) | 49 & |
| sherpa-card | `components/sherpa-card/sherpa-card.css` | **11.6%** (251→222 lines) | 32 & |
| sherpa-input-text | `components/sherpa-input-text/sherpa-input-text.css` | Structured with docs | 1 & |
| sherpa-switch | `components/sherpa-switch/sherpa-switch.css` | **2.9%** (102→99 lines) | 8 & |

---

## Phase 3: Testing Checklist

### ✅ Syntax Validation (Automated)

- [x] **Brace balance check** — All 4 files: balance = 0 ✓
- [x] **Import statements** — sherpa-input-text.css imports base correctly ✓
- [x] **CSS nesting syntax** — Valid & selectors under :host ✓
- [x] **No parse errors** — All files pass basic linting ✓

---

### 🌐 Browser Compatibility Testing (Manual - Local)

**Baseline browsers** (must support):
- Chrome 99+ (primary CSS nesting)
- Firefox 97+ (fallback graceful degradation)
- Safari 15.4+ (older browser support)
- Edge 99+ (Chromium-based)

#### Testing Environment Setup

```bash
# 1. Start dev server (adjust port as needed)
npm run dev
# or
python3 -m http.server 8000

# 2. Open each browser to:
# http://localhost:8000/demo/playground.html
```

#### Per Component: Visual & Functional Parity

**For each of [sherpa-button, sherpa-card, sherpa-input-text, sherpa-switch]:**

**Visual checks:**
- [ ] Component renders identically to design
- [ ] Colors match (primary, secondary, tertiary variants)
- [ ] Spacing/padding consistent (8px grid compliance)
- [ ] Shadows/elevations correct (card elevation levels)
- [ ] Border radius matches design tokens
- [ ] Typography sizes/weights correct

**State checks:**
- [ ] `:hover` state works (background/border change)
- [ ] `:active` state works (scale/color change)
- [ ] `:focus-visible` outline appears
- [ ] `:disabled` state renders correctly (no opacity on text)
- [ ] Data-attribute variants work (`data-size`, `data-variant`, `data-status`)

**Content checks:**
- [ ] Slot projection works (default, named slots)
- [ ] Text content displays correctly
- [ ] Icons render (Font Awesome via shadow CSS)
- [ ] Responsive behavior intact

**Mobile/Responsive:**
- [ ] Component resizes on viewport change
- [ ] No overflow or layout shifts
- [ ] Touch targets adequate (≥44px minimum)

---

### 📋 Component-Specific Test Cases

#### sherpa-button
```html
<!-- Variants: primary, secondary, tertiary -->
<sherpa-button data-variant="primary">Primary</sherpa-button>
<sherpa-button data-variant="secondary">Secondary</sherpa-button>

<!-- Sizes: x-small, small, large, 2x-large -->
<sherpa-button data-size="small">Small</sherpa-button>

<!-- Icon variants -->
<sherpa-button data-icon-start="fa-solid fa-plus">Add</sherpa-button>
<sherpa-button data-type="icon">🎯</sherpa-button>

<!-- States -->
<sherpa-button>Normal</sherpa-button>
<sherpa-button disabled>Disabled</sherpa-button>
<sherpa-button data-active="true">Active</sherpa-button>

<!-- With badge -->
<sherpa-button data-badge="5">Notifications</sherpa-button>
```

**Test checklist:**
- [ ] All 3 variants render with correct colors
- [ ] All 4 sizes render with correct heights/padding
- [ ] Icon-only (type="icon") is square
- [ ] Icon start/end display correctly
- [ ] Disabled has no opacity; uses inactive tokens
- [ ] Active state shows pressed styling
- [ ] Badge pill displays correctly
- [ ] On hover: background/border change
- [ ] On active: transform scale 0.99 (or button-press visual)

---

#### sherpa-card
```html
<!-- Elevations: none, sm (default), md, lg -->
<sherpa-card data-elevation="sm">Default elevation</sherpa-card>
<sherpa-card data-elevation="lg">High elevation</sherpa-card>

<!-- Interactive -->
<sherpa-card data-interactive="true">Click me</sherpa-card>

<!-- Selected -->
<sherpa-card data-selected="true">Selected state</sherpa-card>

<!-- With header -->
<sherpa-card data-label="Card Title">
  <slot name="header">Custom header</slot>
  Main content
</sherpa-card>

<!-- Selectable (radio indicator) -->
<sherpa-card data-selectable="true">
  Content with selection radio
</sherpa-card>
```

**Test checklist:**
- [ ] Elevation shadows correct (4 levels)
- [ ] Interactive card shows cursor pointer
- [ ] Interactive card hover changes background + border
- [ ] Interactive card active shows scale 0.99
- [ ] Selected state: purple border + light purple background
- [ ] Header row displays label correctly
- [ ] Selectable cards show radio indicator
- [ ] Radio fills on selection
- [ ] Focus outline visible
- [ ] Disabled state: grayed out (no opacity)

---

#### sherpa-input-text
```html
<!-- Single line (default) -->
<sherpa-input-text data-label="Name"></sherpa-input-text>

<!-- Multiline textarea -->
<sherpa-input-text data-multiline="true" data-label="Comments"></sherpa-input-text>

<!-- With helper text -->
<sherpa-input-text data-helper="e.g., john@example.com"></sherpa-input-text>

<!-- Disabled -->
<sherpa-input-text disabled data-label="Readonly"></sherpa-input-text>

<!-- Invalid state -->
<sherpa-input-text data-status="critical" data-label="Error field"></sherpa-input-text>
```

**Test checklist:**
- [ ] Text input renders as single line
- [ ] Textarea (multiline) auto-grows with content
- [ ] Multiline has `resize: none` (no manual resize chrome)
- [ ] Focus outline appears (blue border)
- [ ] Disabled state renders (grayed, not-allowed cursor)
- [ ] Helper text displays below input
- [ ] Status colors apply (critical = red border/background)
- [ ] Placeholder text works
- [ ] Value can be entered/cleared

---

#### sherpa-switch
```html
<!-- Default off state -->
<sherpa-switch data-state="off">Off</sherpa-switch>

<!-- On state -->
<sherpa-switch data-state="on">On</sherpa-switch>

<!-- Compact variant (rounded) -->
<sherpa-switch data-style="compact" data-state="on">On</sherpa-switch>

<!-- Disabled -->
<sherpa-switch disabled>Disabled</sherpa-switch>
```

**Test checklist:**
- [ ] OFF state: gray track, knob on right, black label
- [ ] ON state: green track, knob on left, white label
- [ ] Compact style has rounded track (border-radius: 999px)
- [ ] Knob slides smoothly on state change
- [ ] Disabled state: grayed track + knob, no pointer events
- [ ] Transition duration ~150ms smooth
- [ ] Hover state shows cursor pointer
- [ ] Focus outline visible

---

### 🔍 Console & Network Checks

**Open DevTools (F12) for each browser:**

- [ ] **Console**: No errors or warnings related to CSS
- [ ] **Sources**: All `.css` files load (green status)
- [ ] **Network**: No 404 on CSS imports
- [ ] **Computed Styles**: Verify final computed values match design
- [ ] **Shadows**: Shadow DOM properly encapsulated

**Quick checks:**
```javascript
// In DevTools Console:

// Check computed color for button
const btn = document.querySelector('sherpa-button');
const computed = window.getComputedStyle(btn);
console.log('Background:', computed.background);
console.log('Color:', computed.color);

// Verify nesting compiled correctly (CSS nesting should be native in modern browsers)
console.log('Component shadow CSS present:', btn.shadowRoot?.styleSheets.length > 0);
```

---

### 🚀 Performance & Build Checks

**File size verification:**

```bash
# Before → After size comparison
ls -lh components/sherpa-button/sherpa-button.css
ls -lh components/sherpa-card/sherpa-card.css
ls -lh components/sherpa-input-text/sherpa-input-text.css
ls -lh components/sherpa-switch/sherpa-switch.css

# Verify no increase from original
```

**Expected results:**
- sherpa-button: 702 → 318 bytes (54.7% reduction) ✓
- sherpa-card: 251 → 222 bytes (11.6% reduction) ✓
- sherpa-input-text: structured with docs ✓
- sherpa-switch: 102 → 99 bytes (2.9% reduction) ✓

---

### 📊 Test Results Template

Use this template to document testing:

```markdown
## Browser: [Chrome/Firefox/Safari/Edge] v[version]

### Visual Tests
- sherpa-button: ✓ PASS / ✗ FAIL (notes)
- sherpa-card: ✓ PASS / ✗ FAIL (notes)
- sherpa-input-text: ✓ PASS / ✗ FAIL (notes)
- sherpa-switch: ✓ PASS / ✗ FAIL (notes)

### State Tests
- Hover/Active/Focus: ✓ PASS / ✗ FAIL
- Disabled state: ✓ PASS / ✗ FAIL
- Data-attribute variants: ✓ PASS / ✗ FAIL

### Issues Found
- [Issue 1]: [Description] → [Resolution]
- [Issue 2]: [Description] → [Resolution]

### Console Errors
- [Error 1]: [Description]
- [Error 2]: [Description]
```

---

## Phase 3 Success Criteria

✅ **All tests pass** when:

1. **CSS Syntax Valid** — All 4 files parse without errors
2. **Visual Parity** — Components render identically to originals
3. **All States Work** — Hover, active, focus, disabled, variants all functional
4. **No Console Errors** — Clean DevTools output
5. **Responsive** — Works across browser sizes
6. **Performance** — File size reductions maintained
7. **Functional Parity** — 100% feature equivalence

---

## Regression Testing (Post-Refactor)

### Automated (if available)
```bash
# Run component tests (if test suite exists)
npm run test:components
# or
npm run lint:css
```

### Manual (Required)
See **Component-Specific Test Cases** section above.

---

## Next Steps (Phase 4)

After Phase 3 validation:

1. **PostCSS Build Integration** (if needed for pre-Chrome-112 support)
   - Configure nesting flattening for older browsers
   - Verify build output matches browser support

2. **Rollout to Remaining 76 Components**
   - Apply identical nesting pattern
   - Batch refactor by category (inputs, containers, data-viz, etc.)

3. **Implementation Review**
   - Code review CSS nesting patterns
   - Validate design system token usage
   - Check cascade layer compliance

---

## Resources

- **CSS Nesting Spec**: https://drafts.csswg.org/css-nesting/
- **Browser Support**: caniuse.com (search "CSS Nesting")
- **@supports Fallbacks**: `/css/styles/sherpa-feature-detection.css`
- **Pattern Reference**: `/css/styles/sherpa-patterns.css`

---

## Questions / Issues?

Document findings in this format:

```
**Issue**: [Brief description]
**Component**: [sherpa-button | sherpa-card | sherpa-input-text | sherpa-switch]
**Browser**: [Chrome XX | Firefox XX | Safari XX | Edge XX]
**Screenshot/Reproduction**: [Steps to reproduce]
**Fix Applied**: [Resolution or workaround]
```

