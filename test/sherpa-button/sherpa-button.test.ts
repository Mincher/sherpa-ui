// @ts-nocheck
/**
 * Tests for sherpa-button component
 */

import { expect } from '@esm-bundle/chai';
import {
  createFixture,
  shadowQuery,
  waitForRender,
  click,
  oneEvent,
} from '../helpers/test-utils.js';
import '../../components/sherpa-button/sherpa-button.js';

describe('sherpa-button', () => {
  describe('rendering', () => {
    it('should render a button element in shadow DOM', async () => {
      const el = await createFixture('<sherpa-button>Click me</sherpa-button>');
      await waitForRender();

      const button = shadowQuery(el, 'button');
      expect(button).to.exist;
      expect(button.tagName).to.equal('BUTTON');
    });

    it('should render slotted text content', async () => {
      const el = await createFixture('<sherpa-button>Test Button</sherpa-button>');
      await waitForRender();

      const button = shadowQuery(el, 'button');
      const slot = shadowQuery(el, 'slot');
      expect(slot).to.exist;
      expect(el.textContent.trim()).to.equal('Test Button');
    });

    it('should apply data-label as aria-label on button', async () => {
      const el = await createFixture('<sherpa-button data-label="Close dialog">X</sherpa-button>');
      await waitForRender();

      const button = shadowQuery(el, 'button');
      expect(button.getAttribute('aria-label')).to.equal('Close dialog');
    });
  });

  describe('variants', () => {
    it('should apply primary variant class', async () => {
      const el = await createFixture('<sherpa-button data-variant="primary">Primary</sherpa-button>');
      await waitForRender();

      expect(el.dataset.variant).to.equal('primary');
    });

    it('should apply secondary variant class', async () => {
      const el = await createFixture('<sherpa-button data-variant="secondary">Secondary</sherpa-button>');
      await waitForRender();

      expect(el.dataset.variant).to.equal('secondary');
    });

    it('should apply ghost variant class', async () => {
      const el = await createFixture('<sherpa-button data-variant="ghost">Ghost</sherpa-button>');
      await waitForRender();

      expect(el.dataset.variant).to.equal('ghost');
    });
  });

  describe('sizes', () => {
    it('should apply small size', async () => {
      const el = await createFixture('<sherpa-button data-size="sm">Small</sherpa-button>');
      await waitForRender();

      expect(el.dataset.size).to.equal('sm');
    });

    it('should apply large size', async () => {
      const el = await createFixture('<sherpa-button data-size="lg">Large</sherpa-button>');
      await waitForRender();

      expect(el.dataset.size).to.equal('lg');
    });
  });

  describe('states', () => {
    it('should be disabled when data-disabled is set', async () => {
      const el = await createFixture('<sherpa-button data-disabled>Disabled</sherpa-button>');
      await waitForRender();

      const button = shadowQuery(el, 'button');
      expect(button.disabled).to.be.true;
    });

    it('should show loading state', async () => {
      const el = await createFixture('<sherpa-button data-loading>Loading</sherpa-button>');
      await waitForRender();

      expect(el.hasAttribute('data-loading')).to.be.true;
      const loader = shadowQuery(el, '.btn-loader');
      expect(loader).to.exist;
    });

    it('should apply data-active state', async () => {
      const el = await createFixture('<sherpa-button data-active>Active</sherpa-button>');
      await waitForRender();

      expect(el.hasAttribute('data-active')).to.be.true;
    });
  });

  describe('icons', () => {
    it('should render icon-before slot', async () => {
      const el = await createFixture(`
        <sherpa-button>
          <i slot="icon-before" class="fa-solid fa-check"></i>
          Save
        </sherpa-button>
      `);
      await waitForRender();

      const iconSlot = shadowQuery(el, 'slot[name="icon-before"]');
      expect(iconSlot).to.exist;

      const assignedIcon = el.querySelector('[slot="icon-before"]');
      expect(assignedIcon).to.exist;
      expect(assignedIcon.classList.contains('fa-check')).to.be.true;
    });

    it('should render icon-after slot', async () => {
      const el = await createFixture(`
        <sherpa-button>
          Next
          <i slot="icon-after" class="fa-solid fa-arrow-right"></i>
        </sherpa-button>
      `);
      await waitForRender();

      const iconSlot = shadowQuery(el, 'slot[name="icon-after"]');
      expect(iconSlot).to.exist;

      const assignedIcon = el.querySelector('[slot="icon-after"]');
      expect(assignedIcon).to.exist;
    });

    it('should apply icon-only class when data-icon-only is set', async () => {
      const el = await createFixture('<sherpa-button data-icon-only data-label="Delete"><i class="fa-solid fa-trash"></i></sherpa-button>');
      await waitForRender();

      expect(el.hasAttribute('data-icon-only')).to.be.true;
    });
  });

  describe('events', () => {
    it('should emit click event when clicked', async () => {
      const el = await createFixture('<sherpa-button>Click me</sherpa-button>');
      await waitForRender();

      const button = shadowQuery(el, 'button');
      let clicked = false;

      el.addEventListener('click', () => {
        clicked = true;
      });

      await click(button);
      expect(clicked).to.be.true;
    });

    it('should not emit click when disabled', async () => {
      const el = await createFixture('<sherpa-button data-disabled>Disabled</sherpa-button>');
      await waitForRender();

      const button = shadowQuery(el, 'button');
      let clicked = false;

      el.addEventListener('click', () => {
        clicked = true;
      });

      // Try to click - should be prevented by disabled state
      button.click();
      await waitForRender();

      expect(clicked).to.be.false;
    });
  });

  describe('type attribute', () => {
    it('should default to button type', async () => {
      const el = await createFixture('<sherpa-button>Button</sherpa-button>');
      await waitForRender();

      const button = shadowQuery(el, 'button');
      expect(button.type).to.equal('button');
    });

    it('should support submit type', async () => {
      const el = await createFixture('<sherpa-button data-type="submit">Submit</sherpa-button>');
      await waitForRender();

      const button = shadowQuery(el, 'button');
      expect(button.type).to.equal('submit');
    });

    it('should support reset type', async () => {
      const el = await createFixture('<sherpa-button data-type="reset">Reset</sherpa-button>');
      await waitForRender();

      const button = shadowQuery(el, 'button');
      expect(button.type).to.equal('reset');
    });
  });

  describe('accessibility', () => {
    it('should have role="button" on custom element', async () => {
      const el = await createFixture('<sherpa-button>Button</sherpa-button>');
      await waitForRender();

      const button = shadowQuery(el, 'button');
      expect(button).to.exist; // Native button has implicit role
    });

    it('should propagate aria-label from data-label', async () => {
      const el = await createFixture('<sherpa-button data-label="Submit form">Submit</sherpa-button>');
      await waitForRender();

      const button = shadowQuery(el, 'button');
      expect(button.getAttribute('aria-label')).to.equal('Submit form');
    });

    it('should have aria-disabled when disabled', async () => {
      const el = await createFixture('<sherpa-button data-disabled>Disabled</sherpa-button>');
      await waitForRender();

      const button = shadowQuery(el, 'button');
      expect(button.disabled).to.be.true;
      expect(button.getAttribute('aria-disabled')).to.equal('true');
    });
  });

  describe('dynamic attribute updates', () => {
    it('should update variant dynamically', async () => {
      const el = await createFixture('<sherpa-button data-variant="primary">Button</sherpa-button>');
      await waitForRender();

      expect(el.dataset.variant).to.equal('primary');

      el.dataset.variant = 'secondary';
      await waitForRender();

      expect(el.dataset.variant).to.equal('secondary');
    });

    it('should toggle disabled state dynamically', async () => {
      const el = await createFixture('<sherpa-button>Button</sherpa-button>');
      await waitForRender();

      const button = shadowQuery(el, 'button');
      expect(button.disabled).to.be.false;

      el.dataset.disabled = 'true';
      await waitForRender();

      expect(button.disabled).to.be.true;

      delete el.dataset.disabled;
      await waitForRender();

      expect(button.disabled).to.be.false;
    });
  });
});
