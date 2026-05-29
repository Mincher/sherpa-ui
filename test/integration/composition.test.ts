// @ts-nocheck
/**
 * Integration tests for component composition
 *
 * Tests:
 * - Slot validation and tier hierarchy
 * - Event bubbling through composed structures
 * - Component communication patterns
 */

import { expect } from '@esm-bundle/chai';
import {
  createFixture,
  shadowQuery,
  shadowQueryAll,
  waitForRender,
  click,
  oneEvent,
  getSlottedElements,
} from '../helpers/test-utils.js';

// Import components used in composition tests
import '../../components/sherpa-container/sherpa-container.js';
import '../../components/sherpa-button/sherpa-button.js';
import '../../components/sherpa-input-text/sherpa-input-text.js';
import '../../components/sherpa-toolbar/sherpa-toolbar.js';

describe('Component Composition', () => {
  describe('slot validation', () => {
    it('should accept valid slotted content', async () => {
      const el = await createFixture(`
        <sherpa-container>
          <div slot="header">Header Content</div>
          <div>Body Content</div>
          <div slot="footer">Footer Content</div>
        </sherpa-container>
      `);
      await waitForRender(3);

      const headerSlot = getSlottedElements(el, 'header');
      const defaultSlot = getSlottedElements(el, '');
      const footerSlot = getSlottedElements(el, 'footer');

      expect(headerSlot).to.have.lengthOf(1);
      expect(defaultSlot.length).to.be.greaterThan(0);
      expect(footerSlot).to.have.lengthOf(1);
    });

    it('should detect presence of slotted content with data-has-* attributes', async () => {
      const el = await createFixture(`
        <sherpa-container>
          <div slot="header">Header</div>
        </sherpa-container>
      `);
      await waitForRender(3);

      // SherpaElement sets data-has-{slotName} when slots have content
      expect(el.hasAttribute('data-has-header')).to.be.true;
    });

    it('should not set data-has-* attributes for empty slots', async () => {
      const el = await createFixture(`
        <sherpa-container>
          <div>Only body content, no header or footer</div>
        </sherpa-container>
      `);
      await waitForRender(3);

      expect(el.hasAttribute('data-has-footer')).to.be.false;
    });
  });

  describe('nested component structure', () => {
    it('should support container with multiple input components', async () => {
      const el = await createFixture(`
        <sherpa-container>
          <sherpa-input-text data-label="Name"></sherpa-input-text>
          <sherpa-input-text data-label="Email"></sherpa-input-text>
        </sherpa-container>
      `);
      await waitForRender();

      const inputs = el.querySelectorAll('sherpa-input-text');
      expect(inputs).to.have.lengthOf(2);
    });

    it('should support container with header toolbar and body content', async () => {
      const el = await createFixture(`
        <sherpa-container>
          <sherpa-toolbar slot="header">
            <sherpa-button>Action 1</sherpa-button>
            <sherpa-button>Action 2</sherpa-button>
          </sherpa-toolbar>
          <div>Main content</div>
        </sherpa-container>
      `);
      await waitForRender(3);

      const toolbar = el.querySelector('sherpa-toolbar');
      expect(toolbar).to.exist;

      const buttons = toolbar.querySelectorAll('sherpa-button');
      expect(buttons).to.have.lengthOf(2);
    });

    it('should support deeply nested component structures', async () => {
      const el = await createFixture(`
        <sherpa-container>
          <sherpa-container>
            <sherpa-input-text data-label="Nested Input"></sherpa-input-text>
          </sherpa-container>
        </sherpa-container>
      `);
      await waitForRender();

      const outerContainer = el;
      const innerContainer = el.querySelector('sherpa-container');
      const input = innerContainer.querySelector('sherpa-input-text');

      expect(outerContainer).to.exist;
      expect(innerContainer).to.exist;
      expect(input).to.exist;
    });
  });

  describe('event bubbling', () => {
    it('should bubble custom events through composed structures', async () => {
      const el = await createFixture(`
        <sherpa-container>
          <sherpa-button id="test-btn">Click Me</sherpa-button>
        </sherpa-container>
      `);
      await waitForRender(3);

      const container = el;
      const button = el.querySelector('sherpa-button');

      let eventCaught = false;
      container.addEventListener('click', () => {
        eventCaught = true;
      });

      const shadowButton = shadowQuery(button, 'button');
      await click(shadowButton);

      expect(eventCaught).to.be.true;
    });

    it('should bubble input events from nested inputs', async () => {
      const el = await createFixture(`
        <sherpa-container>
          <sherpa-input-text id="test-input"></sherpa-input-text>
        </sherpa-container>
      `);
      await waitForRender(3);

      const container = el;
      const input = el.querySelector('sherpa-input-text');

      const eventPromise = oneEvent(container, 'input');

      const nativeInput = shadowQuery(input, 'input');
      nativeInput.value = 'test';
      nativeInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

      const event = await eventPromise;
      expect(event).to.exist;
    });
  });

  describe('component communication', () => {
    it('should allow parent to query child components', async () => {
      const el = await createFixture(`
        <sherpa-container>
          <sherpa-input-text data-name="field1" data-value="value1"></sherpa-input-text>
          <sherpa-input-text data-name="field2" data-value="value2"></sherpa-input-text>
        </sherpa-container>
      `);
      await waitForRender();

      const inputs = el.querySelectorAll('sherpa-input-text');
      expect(inputs).to.have.lengthOf(2);

      // Parent can read child values
      expect(inputs[0].dataset.value).to.equal('value1');
      expect(inputs[1].dataset.value).to.equal('value2');
    });

    it('should allow parent to update child attributes', async () => {
      const el = await createFixture(`
        <sherpa-container>
          <sherpa-button data-variant="primary">Button</sherpa-button>
        </sherpa-container>
      `);
      await waitForRender();

      const button = el.querySelector('sherpa-button');
      expect(button.dataset.variant).to.equal('primary');

      // Parent updates child
      button.dataset.variant = 'secondary';
      await waitForRender();

      expect(button.dataset.variant).to.equal('secondary');
    });
  });

  describe('toolbar composition', () => {
    it('should compose toolbar with multiple buttons', async () => {
      const el = await createFixture(`
        <sherpa-toolbar>
          <sherpa-button>Save</sherpa-button>
          <sherpa-button>Cancel</sherpa-button>
          <sherpa-button>Delete</sherpa-button>
        </sherpa-toolbar>
      `);
      await waitForRender();

      const buttons = el.querySelectorAll('sherpa-button');
      expect(buttons).to.have.lengthOf(3);
    });

    it('should handle toolbar button clicks independently', async () => {
      const el = await createFixture(`
        <sherpa-toolbar>
          <sherpa-button id="btn1">Button 1</sherpa-button>
          <sherpa-button id="btn2">Button 2</sherpa-button>
        </sherpa-toolbar>
      `);
      await waitForRender(3);

      const btn1 = el.querySelector('#btn1');
      const btn2 = el.querySelector('#btn2');

      let btn1Clicked = false;
      let btn2Clicked = false;

      btn1.addEventListener('click', () => { btn1Clicked = true; });
      btn2.addEventListener('click', () => { btn2Clicked = true; });

      const shadowBtn1 = shadowQuery(btn1, 'button');
      await click(shadowBtn1);

      expect(btn1Clicked).to.be.true;
      expect(btn2Clicked).to.be.false;

      const shadowBtn2 = shadowQuery(btn2, 'button');
      await click(shadowBtn2);

      expect(btn2Clicked).to.be.true;
    });
  });

  describe('form composition', () => {
    it('should compose form with multiple input fields', async () => {
      const form = document.createElement('form');
      form.innerHTML = `
        <sherpa-input-text data-name="name" data-label="Name"></sherpa-input-text>
        <sherpa-input-text data-name="email" data-label="Email"></sherpa-input-text>
      `;
      document.body.appendChild(form);
      await waitForRender();

      const inputs = form.querySelectorAll('sherpa-input-text');
      expect(inputs).to.have.lengthOf(2);

      // Cleanup
      document.body.removeChild(form);
    });

    it('should allow programmatic form field updates', async () => {
      const form = document.createElement('form');
      form.innerHTML = `
        <sherpa-input-text data-name="username" data-value="oldvalue"></sherpa-input-text>
      `;
      document.body.appendChild(form);
      await waitForRender();

      const input = form.querySelector('sherpa-input-text');
      expect(input.dataset.value).to.equal('oldvalue');

      input.dataset.value = 'newvalue';
      await waitForRender();

      expect(input.dataset.value).to.equal('newvalue');

      // Cleanup
      document.body.removeChild(form);
    });
  });

  describe('slot wrapper visibility', () => {
    it('should show slot wrapper when slot has content', async () => {
      const el = await createFixture(`
        <sherpa-container>
          <div slot="header">Header Content</div>
        </sherpa-container>
      `);
      await waitForRender(3);

      // Wrappers with data-has-content should be shown
      expect(el.hasAttribute('data-has-header')).to.be.true;
    });

    it('should hide empty slot wrappers via CSS', async () => {
      const el = await createFixture(`
        <sherpa-container>
          <div>Body only, no header</div>
        </sherpa-container>
      `);
      await waitForRender(3);

      // Empty slots should not have data-has-* attributes
      expect(el.hasAttribute('data-has-header')).to.be.false;
    });
  });

  describe('multiple slot content', () => {
    it('should support multiple elements in same slot', async () => {
      const el = await createFixture(`
        <sherpa-toolbar>
          <sherpa-button>Button 1</sherpa-button>
          <sherpa-button>Button 2</sherpa-button>
          <sherpa-button>Button 3</sherpa-button>
        </sherpa-toolbar>
      `);
      await waitForRender();

      const defaultSlot = getSlottedElements(el, '');
      expect(defaultSlot.length).to.be.greaterThanOrEqual(3);
    });

    it('should maintain order of slotted elements', async () => {
      const el = await createFixture(`
        <sherpa-container>
          <div slot="header" id="first">First</div>
          <div slot="header" id="second">Second</div>
        </sherpa-container>
      `);
      await waitForRender();

      const headerElements = getSlottedElements(el, 'header');
      expect(headerElements[0].id).to.equal('first');
      expect(headerElements[1].id).to.equal('second');
    });
  });

  describe('dynamic composition updates', () => {
    it('should update when children are added dynamically', async () => {
      const el = await createFixture(`
        <sherpa-toolbar>
          <sherpa-button>Initial Button</sherpa-button>
        </sherpa-toolbar>
      `);
      await waitForRender();

      let buttons = el.querySelectorAll('sherpa-button');
      expect(buttons).to.have.lengthOf(1);

      // Add new button
      const newButton = document.createElement('sherpa-button');
      newButton.textContent = 'New Button';
      el.appendChild(newButton);
      await waitForRender();

      buttons = el.querySelectorAll('sherpa-button');
      expect(buttons).to.have.lengthOf(2);
    });

    it('should update when children are removed dynamically', async () => {
      const el = await createFixture(`
        <sherpa-toolbar>
          <sherpa-button id="btn1">Button 1</sherpa-button>
          <sherpa-button id="btn2">Button 2</sherpa-button>
        </sherpa-toolbar>
      `);
      await waitForRender();

      let buttons = el.querySelectorAll('sherpa-button');
      expect(buttons).to.have.lengthOf(2);

      // Remove button
      const btn1 = el.querySelector('#btn1');
      btn1.remove();
      await waitForRender();

      buttons = el.querySelectorAll('sherpa-button');
      expect(buttons).to.have.lengthOf(1);
    });
  });
});
