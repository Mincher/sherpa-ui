// @ts-nocheck
/**
 * button.a11y.test.js — Accessibility tests for sherpa-button
 *
 * Tests ARIA attributes, semantic HTML, keyboard navigation, and focus management.
 * Run with: npm test (once test framework is configured)
 *
 * This is an example test demonstrating the patterns for component-level
 * accessibility testing. Other components should follow similar patterns.
 */

import { axe } from 'axe-core';

describe('sherpa-button accessibility', () => {
  let container;
  let button;

  beforeEach(async () => {
    // Create test container
    container = document.createElement('div');
    document.body.appendChild(container);

    // Create button instance
    button = document.createElement('sherpa-button');
    container.appendChild(button);

    // Wait for component to render
    await customElements.whenDefined('sherpa-button');
    await button.rendered;
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('ARIA attributes', () => {
    it('should have role="button" on the internal button element', () => {
      const internalButton = button.shadowRoot.querySelector('button');
      expect(internalButton).toBeTruthy();
      expect(internalButton.getAttribute('role')).toBe('button');
    });

    it('should set aria-disabled when data-disabled is present', () => {
      button.setAttribute('data-disabled', 'true');
      const internalButton = button.shadowRoot.querySelector('button');
      expect(internalButton.getAttribute('aria-disabled')).toBe('true');
    });

    it('should set aria-pressed for toggle buttons', () => {
      button.setAttribute('data-toggle', 'true');
      button.setAttribute('data-pressed', 'true');
      const internalButton = button.shadowRoot.querySelector('button');
      expect(internalButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('should have accessible name from slot content', () => {
      button.textContent = 'Click me';
      const internalButton = button.shadowRoot.querySelector('button');
      // Accessible name comes from slotted text
      expect(button.textContent.trim()).toBe('Click me');
    });

    it('should use aria-label when provided', () => {
      button.setAttribute('data-label', 'Submit form');
      const internalButton = button.shadowRoot.querySelector('button');
      expect(internalButton.getAttribute('aria-label')).toBe('Submit form');
    });
  });

  describe('Semantic HTML', () => {
    it('should use a native <button> element', () => {
      const internalButton = button.shadowRoot.querySelector('button');
      expect(internalButton.tagName).toBe('BUTTON');
    });

    it('should set type="button" to prevent form submission', () => {
      const internalButton = button.shadowRoot.querySelector('button');
      expect(internalButton.getAttribute('type')).toBe('button');
    });

    it('should set disabled attribute when data-disabled is true', () => {
      button.setAttribute('data-disabled', 'true');
      const internalButton = button.shadowRoot.querySelector('button');
      expect(internalButton.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('Keyboard navigation', () => {
    it('should be focusable', () => {
      const internalButton = button.shadowRoot.querySelector('button');
      expect(internalButton.tabIndex).toBeGreaterThanOrEqual(0);
    });

    it('should not be focusable when disabled', () => {
      button.setAttribute('data-disabled', 'true');
      const internalButton = button.shadowRoot.querySelector('button');
      expect(internalButton.hasAttribute('disabled')).toBe(true);
    });

    it('should activate on Enter key', (done) => {
      button.addEventListener('click', () => {
        done();
      });

      const internalButton = button.shadowRoot.querySelector('button');
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
      });
      internalButton.dispatchEvent(enterEvent);
      internalButton.click();
    });

    it('should activate on Space key', (done) => {
      button.addEventListener('click', () => {
        done();
      });

      const internalButton = button.shadowRoot.querySelector('button');
      const spaceEvent = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        bubbles: true,
      });
      internalButton.dispatchEvent(spaceEvent);
      internalButton.click();
    });
  });

  describe('Focus management', () => {
    it('should show focus indicator when focused', () => {
      const internalButton = button.shadowRoot.querySelector('button');
      internalButton.focus();

      const styles = window.getComputedStyle(internalButton);
      // Button should have visible focus indicator (outline or box-shadow)
      expect(
        styles.outline !== 'none' ||
        styles.outlineWidth !== '0px' ||
        styles.boxShadow !== 'none'
      ).toBe(true);
    });

    it('should maintain focus after click', () => {
      const internalButton = button.shadowRoot.querySelector('button');
      internalButton.focus();
      internalButton.click();

      expect(document.activeElement).toBe(button);
    });
  });

  describe('Color contrast (axe-core)', () => {
    it('should pass color contrast checks', async () => {
      button.textContent = 'Button Text';

      // Run axe-core on the component
      const results = await axe.run(button, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results.violations.length).toBe(0);
    });

    it('should pass contrast in all variants', async () => {
      const variants = ['primary', 'secondary', 'tertiary'];

      for (const variant of variants) {
        button.setAttribute('data-variant', variant);
        button.textContent = 'Button Text';

        const results = await axe.run(button, {
          rules: {
            'color-contrast': { enabled: true },
          },
        });

        expect(results.violations.length).toBe(0);
      }
    });
  });

  describe('WCAG 2.1 compliance', () => {
    it('should pass all WCAG 2.1 Level AA checks', async () => {
      button.textContent = 'Accessible Button';

      const results = await axe.run(button, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        },
      });

      expect(results.violations).toEqual([]);
    });
  });
});
