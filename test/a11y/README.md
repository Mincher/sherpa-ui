# Accessibility Testing Guide

> **Target:** WCAG 2.1 Level AA compliance
>
> **Tools:** axe-core (automated), pa11y (page-level), Manual testing (keyboard, screen reader)

---

## Quick Start

```bash
# Run automated accessibility tests on all demo pages
npm run test:a11y

# Test specific page
npm run test:a11y demo/sherpa-button.html

# Verbose output with warnings and notices
npm run test:a11y -- --verbose

# Test against WCAG AAA standard
npm run test:a11y -- --standard=WCAG2AAA
```

---

## Testing Strategy

Sherpa UI uses a three-tier accessibility testing approach:

### 1. Automated Testing (axe-core + pa11y)

**What it catches:**
- Missing ARIA labels
- Invalid ARIA attribute values
- Color contrast violations
- Semantic HTML issues
- Keyboard accessibility basics

**Limitations:**
- Cannot test keyboard navigation flows
- Cannot verify screen reader output
- Cannot assess cognitive accessibility
- Cannot test dynamic content changes

**Coverage:** ~30-40% of WCAG criteria

### 2. Component-Level Tests

Component-specific tests verify:
- ARIA attributes are correct
- Semantic HTML is used
- Keyboard navigation works
- Focus management is correct
- Color contrast meets WCAG AA (4.5:1 for normal text, 3:1 for large text)

**Example:** `test/a11y/button.a11y.test.js`

### 3. Manual Testing

Required for complete WCAG compliance:
- Screen reader testing (NVDA, JAWS, VoiceOver)
- Keyboard-only navigation
- Zoom and reflow testing
- Cognitive accessibility review

---

## Automated Testing

### Page-Level Testing (pa11y)

Tests all demo pages for WCAG 2.1 Level AA compliance:

```bash
npm run test:a11y
```

**Output:**
- Console report showing errors, warnings, and notices per page
- JSON report saved to `test/a11y/report.json`
- Exit code 0 (pass) or 1 (fail)

**Configuration:**
- Standard: WCAG2AA (configurable via `--standard=WCAG2AAA`)
- Runner: axe-core
- Timeout: 30 seconds
- Wait: 2 seconds (for component rendering)

### Component-Level Testing (axe-core)

Component tests should include:

```javascript
import { axe } from 'axe-core';

describe('sherpa-component accessibility', () => {
  it('should pass WCAG 2.1 AA checks', async () => {
    const component = document.createElement('sherpa-component');
    document.body.appendChild(component);
    await component.rendered;

    const results = await axe.run(component, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    });

    expect(results.violations).toEqual([]);
  });
});
```

---

## Manual Testing Checklist

### Keyboard Navigation

**All interactive components must support:**

- [ ] **Tab** — Focus next interactive element
- [ ] **Shift + Tab** — Focus previous interactive element
- [ ] **Enter** — Activate buttons/links
- [ ] **Space** — Activate buttons, toggle checkboxes
- [ ] **Escape** — Close dialogs, menus, popovers
- [ ] **Arrow keys** — Navigate within lists, menus, tabs, date pickers
- [ ] **Home/End** — Jump to first/last item (where applicable)

**Focus indicators:**
- [ ] Visible focus indicator on all interactive elements
- [ ] Focus indicator meets 3:1 contrast ratio (WCAG 2.1 AA)
- [ ] Focus order is logical and predictable
- [ ] Focus is not trapped (unless in modal dialog)

### Screen Reader Testing

**Test with:**
- **Windows:** NVDA (free) or JAWS (commercial)
- **macOS:** VoiceOver (built-in)
- **Mobile:** TalkBack (Android), VoiceOver (iOS)

**Verify:**
- [ ] All interactive elements are announced
- [ ] ARIA labels are correct and meaningful
- [ ] Component roles are announced (button, checkbox, dialog, etc.)
- [ ] Dynamic content changes are announced (aria-live regions)
- [ ] Error messages are announced
- [ ] Loading states are announced

### Visual Testing

**Zoom and reflow:**
- [ ] 200% zoom — content remains readable, no horizontal scrolling
- [ ] 400% zoom — content reflows without loss of information
- [ ] Text spacing adjustments work (line-height: 1.5, paragraph spacing: 2x font size)

**Color and contrast:**
- [ ] 4.5:1 contrast ratio for normal text (14px+)
- [ ] 3:1 contrast ratio for large text (18px+ or 14px+ bold)
- [ ] 3:1 contrast ratio for UI components and focus indicators
- [ ] Color is not the only means of conveying information

### Cognitive Accessibility

- [ ] Error messages are clear and suggest fixes
- [ ] Labels are descriptive
- [ ] Instructions are provided where needed
- [ ] Time limits can be extended or disabled
- [ ] Motion can be reduced (prefers-reduced-motion)

---

## WCAG 2.1 Level AA Compliance

### Perceivable

**1.1 Text Alternatives**
- [ ] All images have alt text
- [ ] Decorative images have empty alt (`alt=""`) or `aria-hidden="true"`
- [ ] Icons have accessible labels (aria-label or visually hidden text)

**1.3 Adaptable**
- [ ] Semantic HTML used (headings, lists, tables, forms)
- [ ] ARIA landmarks used (main, nav, complementary)
- [ ] Reading order matches visual order

**1.4 Distinguishable**
- [ ] Color contrast meets 4.5:1 for normal text, 3:1 for large text
- [ ] Text can be resized to 200% without loss of content
- [ ] Images of text are avoided (use actual text)

### Operable

**2.1 Keyboard Accessible**
- [ ] All functionality available via keyboard
- [ ] No keyboard traps
- [ ] Focus indicators are visible

**2.4 Navigable**
- [ ] Skip links provided (skip to main content)
- [ ] Page titles are descriptive
- [ ] Focus order is logical
- [ ] Link text is descriptive (avoid "click here")

### Understandable

**3.1 Readable**
- [ ] Page language is set (`<html lang="en">`)
- [ ] Language changes are marked (`<span lang="es">`)

**3.2 Predictable**
- [ ] Navigation is consistent across pages
- [ ] Components behave predictably
- [ ] No unexpected context changes

**3.3 Input Assistance**
- [ ] Form labels are provided
- [ ] Error messages are clear
- [ ] Error prevention for critical actions

### Robust

**4.1 Compatible**
- [ ] Valid HTML (no parsing errors)
- [ ] ARIA used correctly
- [ ] Component names, roles, and values are accessible

---

## Common Accessibility Patterns

### Buttons

```html
<!-- Good -->
<sherpa-button>Save Changes</sherpa-button>

<!-- Icon-only button -->
<sherpa-button data-label="Close dialog">
  <i class="fa fa-times"></i>
</sherpa-button>

<!-- Toggle button -->
<sherpa-button data-toggle="true" data-pressed="false">
  Mute
</sherpa-button>
```

### Form Inputs

```html
<!-- Good -->
<sherpa-input-text
  data-label="Email address"
  data-required="true"
  data-error="Please enter a valid email">
</sherpa-input-text>

<!-- With help text -->
<sherpa-input-password
  data-label="Password"
  data-hint="Must be at least 8 characters">
</sherpa-input-password>
```

### Dialogs

```html
<!-- Modal dialog -->
<sherpa-dialog
  data-modal="true"
  data-label="Confirm deletion"
  data-open="true">
  <p>Are you sure you want to delete this item?</p>
  <sherpa-button slot="actions" data-variant="primary">Delete</sherpa-button>
  <sherpa-button slot="actions">Cancel</sherpa-button>
</sherpa-dialog>
```

**Requirements:**
- [ ] Focus moves to dialog when opened
- [ ] Focus is trapped within dialog (Tab cycles within)
- [ ] Escape key closes dialog
- [ ] Focus returns to trigger element when closed
- [ ] aria-modal="true" set
- [ ] Descriptive aria-label or aria-labelledby

### Lists

```html
<!-- Good -->
<sherpa-list data-label="Notification settings">
  <sherpa-list-item>
    <sherpa-switch>Email notifications</sherpa-switch>
  </sherpa-list-item>
  <sherpa-list-item>
    <sherpa-switch>SMS notifications</sherpa-switch>
  </sherpa-list-item>
</sherpa-list>
```

---

## Resources

### WCAG 2.1 Guidelines
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [Understanding WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/)
- [How to Meet WCAG](https://www.w3.org/WAI/WCAG21/quickref/)

### Tools
- [axe DevTools](https://www.deque.com/axe/devtools/) — Browser extension
- [WAVE](https://wave.webaim.org/) — Web accessibility evaluation tool
- [Color Contrast Analyzer](https://www.tpgi.com/color-contrast-checker/) — Desktop app

### Screen Readers
- [NVDA](https://www.nvaccess.org/) — Free, Windows
- [JAWS](https://www.freedomscientific.com/products/software/jaws/) — Commercial, Windows
- VoiceOver — Built-in, macOS/iOS
- TalkBack — Built-in, Android

### Testing Guides
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [Keyboard Accessibility](https://webaim.org/techniques/keyboard/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

---

## Continuous Integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Run accessibility tests
  run: npm run test:a11y
```

This ensures all pull requests are tested for accessibility violations before merging.

---

## Reporting Issues

When filing accessibility issues, include:

1. **Component:** Which component has the issue
2. **WCAG criterion:** Which guideline is violated (e.g., 1.4.3 Contrast)
3. **Severity:** Error, Warning, or Notice
4. **Steps to reproduce:** How to trigger the violation
5. **Expected behavior:** What should happen
6. **Actual behavior:** What currently happens
7. **Impact:** Who is affected (screen reader users, keyboard users, etc.)

---

## Next Steps

1. **Run automated tests:** `npm run test:a11y`
2. **Fix violations:** Address errors first, then warnings
3. **Write component tests:** Add a11y tests for new components
4. **Manual testing:** Test with keyboard and screen reader
5. **Document patterns:** Update this guide with new patterns

---

**Last updated:** 2026-05-28
**Target compliance:** WCAG 2.1 Level AA
**Test coverage:** Automated (40%) + Manual (60%) = 100%
