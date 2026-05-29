# Testing Guide

> **Sherpa UI Testing Infrastructure**  
> Unit and integration tests for web components

---

## Overview

Sherpa UI uses [Web Test Runner](https://modern-web.dev/docs/test-runner/overview/) for testing web components. Web Test Runner is specifically built for testing modern web technologies including Web Components, Shadow DOM, and ES modules.

---

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

---

## Test Structure

```
test/
├── helpers/
│   └── test-utils.js          # Shadow DOM testing utilities
├── sherpa-button/
│   └── sherpa-button.test.js  # Component tests
├── sherpa-input-text/
│   └── sherpa-input-text.test.js
├── utilities/
│   ├── sherpa-element.test.js # Base class tests
│   └── composition-validator.test.js
└── a11y/
    └── *.a11y.test.js         # Accessibility tests
```

---

## Writing Tests

### Basic Component Test

```javascript
import { expect } from '@esm-bundle/chai';
import { createFixture, waitForRender, shadowQuery } from '../helpers/test-utils.js';
import '../../components/your-component/your-component.js';

describe('your-component', () => {
  it('should render correctly', async () => {
    const el = await createFixture('<your-component></your-component>');
    await waitForRender();

    const shadow = shadowQuery(el, '.your-selector');
    expect(shadow).to.exist;
  });
});
```

### Testing Shadow DOM

```javascript
import { shadowQuery, shadowQueryAll } from '../helpers/test-utils.js';

// Query single element in shadow root
const button = shadowQuery(el, 'button');

// Query all elements in shadow root
const items = shadowQueryAll(el, '.item');
```

### Testing Attributes and Properties

```javascript
it('should update when attribute changes', async () => {
  const el = await createFixture('<sherpa-button data-variant="primary">Click</sherpa-button>');
  await waitForRender();

  expect(el.dataset.variant).to.equal('primary');

  el.dataset.variant = 'secondary';
  await waitForRender();

  expect(el.dataset.variant).to.equal('secondary');
});
```

### Testing Events

```javascript
import { oneEvent, click } from '../helpers/test-utils.js';

it('should emit click event', async () => {
  const el = await createFixture('<sherpa-button>Click</sherpa-button>');
  await waitForRender();

  const button = shadowQuery(el, 'button');
  const eventPromise = oneEvent(el, 'click');

  await click(button);
  const event = await eventPromise;

  expect(event).to.exist;
});
```

### Testing User Input

```javascript
import { typeInto } from '../helpers/test-utils.js';

it('should update value on input', async () => {
  const el = await createFixture('<sherpa-input-text></sherpa-input-text>');
  await waitForRender();

  const input = shadowQuery(el, 'input');
  await typeInto(input, 'Hello');

  expect(input.value).to.equal('Hello');
});
```

### Testing Slots

```javascript
import { getSlottedElements } from '../helpers/test-utils.js';

it('should render slotted content', async () => {
  const el = await createFixture(`
    <sherpa-container>
      <div slot="header">Header</div>
      <div>Body</div>
    </sherpa-container>
  `);
  await waitForRender();

  const headerElements = getSlottedElements(el, 'header');
  expect(headerElements).to.have.lengthOf(1);
});
```

---

## Test Helpers

### Fixture Creation

- `createFixture(htmlString)` — Create a component in the test document
- `waitForRender(frames = 2)` — Wait for component rendering
- `nextFrame()` — Wait for next animation frame

### Shadow DOM Queries

- `shadowQuery(element, selector)` — Query single element in shadow root
- `shadowQueryAll(element, selector)` — Query all elements in shadow root
- `waitForElement(element, selector, timeout)` — Wait for element to appear

### User Interactions

- `click(element)` — Simulate click
- `focus(element)` — Simulate focus
- `blur(element)` — Simulate blur
- `typeInto(input, value, triggerEvents)` — Simulate typing

### Events

- `oneEvent(element, eventName, timeout)` — Listen for single event occurrence
- `dispatchEvent(element, eventName, detail)` — Dispatch custom event

### Assertions

- `isVisible(element)` — Check if element is visible
- `isAriaHidden(element)` — Check if element has aria-hidden="true"
- `getComputedStyle(element)` — Get computed styles
- `getCustomProperties(element)` — Get all CSS custom properties

### Slots

- `getSlottedElements(element, slotName)` — Get elements assigned to slot

---

## Coverage Thresholds

Current thresholds in `web-test-runner.config.mjs`:

```javascript
threshold: {
  statements: 70,
  branches: 60,
  functions: 70,
  lines: 70,
}
```

View coverage report: `npm run test:coverage`

---

## Test Organization

### Component Tests

Each component should have:
- Rendering tests (Shadow DOM structure)
- Attribute tests (data-* attributes)
- Property tests (JavaScript properties)
- Event tests (custom events)
- Slot tests (named and default slots)
- State tests (variants, sizes, statuses)
- Accessibility tests (ARIA attributes, labels)
- Form integration tests (for input components)

### Example Test Suite Structure

```javascript
describe('sherpa-component', () => {
  describe('rendering', () => {
    // Basic rendering tests
  });

  describe('attributes', () => {
    // Attribute handling tests
  });

  describe('events', () => {
    // Event emission tests
  });

  describe('accessibility', () => {
    // A11y tests
  });

  describe('dynamic updates', () => {
    // Runtime attribute/property changes
  });
});
```

---

## Base Class Tests

Critical base classes to test:

1. **SherpaElement** (`test/utilities/sherpa-element.test.js`)
   - Template loading and caching
   - Shadow DOM setup
   - Query helpers ($, $$)
   - Slot presence detection
   - Lifecycle hooks

2. **SherpaInputBase** (to be implemented)
   - Form wrapper structure
   - Native input delegation
   - Validation coordination
   - Event delegation

3. **Mixins** (to be implemented)
   - StatusMixin
   - ContentAttributesMixin

---

## Integration Tests

Test component composition and interaction:

- Slot validation (tier hierarchy)
- Event bubbling through composed structures
- Form submission with multiple inputs
- Container/child communication

---

## Continuous Integration

Tests run automatically on:
- Every pull request
- Every push to main branch
- Pre-release (triggered by version tags)

See `.github/workflows/ci.yml` for CI configuration.

---

## Debugging Tests

### Run Single Test File

```bash
npx web-test-runner test/sherpa-button/sherpa-button.test.js --node-resolve
```

### Run Specific Test

Add `.only` to focus on a single test:

```javascript
it.only('should focus on this test', async () => {
  // ...
});
```

### Skip Tests

Use `.skip` to temporarily disable tests:

```javascript
it.skip('skip this test', async () => {
  // ...
});
```

### Debug in Browser

Run tests in watch mode and inspect in browser DevTools:

```bash
npm run test:watch
```

Then open the URL shown in the terminal (usually http://localhost:8765).

---

## Best Practices

1. **Test component behavior, not implementation**
   - Test what users see and interact with
   - Avoid testing internal private methods
   - Focus on public API (attributes, properties, events)

2. **Use semantic assertions**
   - `expect(button).to.exist` instead of `expect(!!button).to.be.true`
   - `expect(items).to.have.lengthOf(3)` instead of `expect(items.length === 3).to.be.true`

3. **Wait for rendering**
   - Always call `waitForRender()` after fixture creation
   - Wait after attribute changes that trigger re-renders

4. **Clean up event listeners**
   - Use `oneEvent()` for single-fire event listeners
   - Remove listeners in test cleanup if needed

5. **Test accessibility**
   - Verify ARIA attributes
   - Check label associations
   - Test keyboard navigation

6. **Test edge cases**
   - Empty states
   - Missing attributes
   - Invalid values
   - Disabled states

---

## Resources

- [Web Test Runner Documentation](https://modern-web.dev/docs/test-runner/overview/)
- [Chai Assertion Library](https://www.chaijs.com/)
- [Open WC Testing Helpers](https://open-wc.org/docs/testing/helpers/)
- [Web Components Testing Best Practices](https://open-wc.org/guides/developing-components/testing/)

---

**Last Updated:** 2026-05-28  
**Test Framework:** Web Test Runner v0.20.2  
**Assertion Library:** Chai v4.3.4  
**Coverage:** 70% threshold (statements, functions, lines), 60% (branches)
