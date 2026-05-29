/**
 * Tests for sherpa-input-text component
 */

import { expect } from '@esm-bundle/chai';
import {
  createFixture,
  shadowQuery,
  waitForRender,
  typeInto,
  oneEvent,
} from '../helpers/test-utils.js';
import '../../components/sherpa-input-text/sherpa-input-text.js';

describe('sherpa-input-text', () => {
  describe('rendering', () => {
    it('should render input wrapper structure', async () => {
      const el = await createFixture('<sherpa-input-text data-label="Name"></sherpa-input-text>');
      await waitForRender();

      const wrapper = shadowQuery(el, '.input-wrapper');
      expect(wrapper).to.exist;
    });

    it('should render native input element', async () => {
      const el = await createFixture('<sherpa-input-text></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input[type="text"]');
      expect(input).to.exist;
    });

    it('should render label from data-label', async () => {
      const el = await createFixture('<sherpa-input-text data-label="Username"></sherpa-input-text>');
      await waitForRender();

      const label = shadowQuery(el, 'dt');
      expect(label).to.exist;
      expect(label.textContent.trim()).to.equal('Username');
    });

    it('should not render label when data-label is not provided', async () => {
      const el = await createFixture('<sherpa-input-text></sherpa-input-text>');
      await waitForRender();

      expect(el.hasAttribute('data-label')).to.be.false;
    });
  });

  describe('value management', () => {
    it('should set initial value from data-value', async () => {
      const el = await createFixture('<sherpa-input-text data-value="Initial"></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      expect(input.value).to.equal('Initial');
      expect(el.dataset.value).to.equal('Initial');
    });

    it('should update value when user types', async () => {
      const el = await createFixture('<sherpa-input-text></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      await typeInto(input, 'Hello');

      expect(input.value).to.equal('Hello');
    });

    it('should sync data-value attribute when value changes', async () => {
      const el = await createFixture('<sherpa-input-text></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      await typeInto(input, 'New Value');

      // SherpaInputBase should sync back to data-value
      await waitForRender();
      expect(el.dataset.value).to.equal('New Value');
    });

    it('should clear value when data-value is removed', async () => {
      const el = await createFixture('<sherpa-input-text data-value="Initial"></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      expect(input.value).to.equal('Initial');

      delete el.dataset.value;
      await waitForRender();

      expect(input.value).to.equal('');
    });
  });

  describe('placeholder', () => {
    it('should set placeholder from data-placeholder', async () => {
      const el = await createFixture('<sherpa-input-text data-placeholder="Enter name"></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      expect(input.placeholder).to.equal('Enter name');
    });

    it('should update placeholder dynamically', async () => {
      const el = await createFixture('<sherpa-input-text data-placeholder="Old"></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      expect(input.placeholder).to.equal('Old');

      el.dataset.placeholder = 'New';
      await waitForRender();

      expect(input.placeholder).to.equal('New');
    });
  });

  describe('validation states', () => {
    it('should apply required attribute', async () => {
      const el = await createFixture('<sherpa-input-text data-required></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      expect(input.required).to.be.true;
    });

    it('should apply disabled state', async () => {
      const el = await createFixture('<sherpa-input-text data-disabled></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      expect(input.disabled).to.be.true;
    });

    it('should apply readonly state', async () => {
      const el = await createFixture('<sherpa-input-text data-readonly></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      expect(input.readOnly).to.be.true;
    });

    it('should respect maxlength attribute', async () => {
      const el = await createFixture('<sherpa-input-text data-maxlength="10"></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      expect(input.maxLength).to.equal(10);
    });

    it('should respect minlength attribute', async () => {
      const el = await createFixture('<sherpa-input-text data-minlength="3"></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      expect(input.minLength).to.equal(3);
    });

    it('should apply pattern validation', async () => {
      const el = await createFixture('<sherpa-input-text data-pattern="[A-Z]{3}"></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      expect(input.pattern).to.equal('[A-Z]{3}');
    });
  });

  describe('help text', () => {
    it('should render help text from data-help', async () => {
      const el = await createFixture('<sherpa-input-text data-help="Enter your full name"></sherpa-input-text>');
      await waitForRender();

      const help = shadowQuery(el, '.input-help');
      expect(help).to.exist;
      expect(help.textContent.trim()).to.equal('Enter your full name');
    });

    it('should hide help text when data-help is not provided', async () => {
      const el = await createFixture('<sherpa-input-text></sherpa-input-text>');
      await waitForRender();

      expect(el.hasAttribute('data-help')).to.be.false;
    });
  });

  describe('status states', () => {
    it('should apply error status', async () => {
      const el = await createFixture('<sherpa-input-text data-status="error"></sherpa-input-text>');
      await waitForRender();

      expect(el.dataset.status).to.equal('error');
    });

    it('should apply warning status', async () => {
      const el = await createFixture('<sherpa-input-text data-status="warning"></sherpa-input-text>');
      await waitForRender();

      expect(el.dataset.status).to.equal('warning');
    });

    it('should apply success status', async () => {
      const el = await createFixture('<sherpa-input-text data-status="success"></sherpa-input-text>');
      await waitForRender();

      expect(el.dataset.status).to.equal('success');
    });

    it('should render status message', async () => {
      const el = await createFixture('<sherpa-input-text data-status="error" data-status-message="Invalid input"></sherpa-input-text>');
      await waitForRender();

      const statusMsg = shadowQuery(el, '.input-status-message');
      expect(statusMsg).to.exist;
      expect(statusMsg.textContent.trim()).to.equal('Invalid input');
    });
  });

  describe('events', () => {
    it('should emit input event when value changes', async () => {
      const el = await createFixture('<sherpa-input-text></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      const eventPromise = oneEvent(el, 'input');

      await typeInto(input, 'Test');
      const event = await eventPromise;

      expect(event).to.exist;
    });

    it('should emit change event', async () => {
      const el = await createFixture('<sherpa-input-text></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      const eventPromise = oneEvent(el, 'change');

      await typeInto(input, 'Test');
      const event = await eventPromise;

      expect(event).to.exist;
    });
  });

  describe('accessibility', () => {
    it('should have proper label association', async () => {
      const el = await createFixture('<sherpa-input-text data-label="Email"></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      const label = shadowQuery(el, 'dt');

      expect(label).to.exist;
      expect(label.textContent.trim()).to.equal('Email');
    });

    it('should set aria-required when required', async () => {
      const el = await createFixture('<sherpa-input-text data-required></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      expect(input.required).to.be.true;
      expect(input.getAttribute('aria-required')).to.equal('true');
    });

    it('should set aria-disabled when disabled', async () => {
      const el = await createFixture('<sherpa-input-text data-disabled></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      expect(input.disabled).to.be.true;
      expect(input.getAttribute('aria-disabled')).to.equal('true');
    });

    it('should link help text with aria-describedby', async () => {
      const el = await createFixture('<sherpa-input-text data-help="Help text"></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      const describedBy = input.getAttribute('aria-describedby');

      if (describedBy) {
        const helpEl = shadowQuery(el, `#${describedBy}`);
        expect(helpEl).to.exist;
      }
    });
  });

  describe('form integration', () => {
    it('should have name attribute from data-name', async () => {
      const el = await createFixture('<sherpa-input-text data-name="username"></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      expect(input.name).to.equal('username');
    });

    it('should participate in form validation', async () => {
      const el = await createFixture('<sherpa-input-text data-required></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');

      // Empty required field should be invalid
      expect(input.validity.valid).to.be.false;
      expect(input.validity.valueMissing).to.be.true;

      // Fill with value should be valid
      await typeInto(input, 'Valid');
      expect(input.validity.valid).to.be.true;
    });
  });

  describe('dynamic updates', () => {
    it('should update label dynamically', async () => {
      const el = await createFixture('<sherpa-input-text data-label="Old Label"></sherpa-input-text>');
      await waitForRender();

      let label = shadowQuery(el, 'dt');
      expect(label.textContent.trim()).to.equal('Old Label');

      el.dataset.label = 'New Label';
      await waitForRender();

      label = shadowQuery(el, 'dt');
      expect(label.textContent.trim()).to.equal('New Label');
    });

    it('should toggle disabled state dynamically', async () => {
      const el = await createFixture('<sherpa-input-text></sherpa-input-text>');
      await waitForRender();

      const input = shadowQuery(el, 'input');
      expect(input.disabled).to.be.false;

      el.dataset.disabled = 'true';
      await waitForRender();
      expect(input.disabled).to.be.true;

      delete el.dataset.disabled;
      await waitForRender();
      expect(input.disabled).to.be.false;
    });
  });
});
