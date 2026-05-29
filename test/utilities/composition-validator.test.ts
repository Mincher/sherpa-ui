// @ts-nocheck
/**
 * composition-validator.test.js
 *
 * Tests for the composition validator utility.
 * Run with: npm test (once test framework is configured)
 */

import { CompositionValidator, validateSlot, validateComponent } from '../../components/utilities/composition-validator.js';
import { COMPONENT_CATEGORIES, COMPONENT_TIERS } from '../../components/utilities/component-categories.js';

describe('CompositionValidator', () => {
  let testHost;

  beforeEach(() => {
    // Create test host element
    testHost = document.createElement('div');
    document.body.appendChild(testHost);
    CompositionValidator.clearWarnings();
    CompositionValidator.disable();
  });

  afterEach(() => {
    document.body.removeChild(testHost);
    CompositionValidator.disable();
  });

  describe('enable / disable', () => {
    it('should enable validation', () => {
      CompositionValidator.enable({ devModeOnly: false });
      expect(CompositionValidator.enabled).toBe(true);
    });

    it('should enable strict mode', () => {
      CompositionValidator.enable({ strict: true, devModeOnly: false });
      expect(CompositionValidator.strictMode).toBe(true);
    });

    it('should disable validation', () => {
      CompositionValidator.enable({ devModeOnly: false });
      CompositionValidator.disable();
      expect(CompositionValidator.enabled).toBe(false);
    });
  });

  describe('Tier validation', () => {
    it('should reject lower-tier child in higher-tier host', () => {
      // Create mock component (tier 4 button containing tier 2 container)
      const button = document.createElement('sherpa-button');
      button.attachShadow({ mode: 'open' });

      const slot = document.createElement('slot');
      button.shadowRoot.appendChild(slot);

      const container = document.createElement('sherpa-container');
      button.appendChild(container);

      testHost.appendChild(button);

      // Button is tier 4, container is tier 2 (lower tier = more page-level)
      // This should be rejected
      const violations = validateSlot(slot, button);

      expect(violations.length).toBe(1);
      expect(violations[0].type).toBe('tier');
      expect(violations[0].message).toContain('cannot be slotted into');
    });

    it('should allow higher-tier child in lower-tier host', () => {
      // Create mock component (tier 2 container holding tier 4 button)
      const container = document.createElement('sherpa-container');
      container.attachShadow({ mode: 'open' });

      const slot = document.createElement('slot');
      container.shadowRoot.appendChild(slot);

      const button = document.createElement('sherpa-button');
      container.appendChild(button);

      testHost.appendChild(container);

      // Container is tier 2, button is tier 4 (higher tier)
      // This should be allowed
      const violations = validateSlot(slot, container);

      expect(violations.length).toBe(0);
    });

    it('should allow same-tier children', () => {
      // Create mock component (tier 4 button containing tier 4 switch)
      const button = document.createElement('sherpa-button');
      button.attachShadow({ mode: 'open' });

      const slot = document.createElement('slot');
      button.shadowRoot.appendChild(slot);

      const switchEl = document.createElement('sherpa-switch');
      button.appendChild(switchEl);

      testHost.appendChild(button);

      const violations = validateSlot(slot, button);

      expect(violations.length).toBe(0);
    });
  });

  describe('Role validation (data-accepts)', () => {
    it('should reject child with wrong role', () => {
      const container = document.createElement('sherpa-container');
      container.attachShadow({ mode: 'open' });

      const slot = document.createElement('slot');
      slot.setAttribute('data-accepts', 'control');
      container.shadowRoot.appendChild(slot);

      // Add a display component (wrong role)
      const metric = document.createElement('sherpa-metric');
      container.appendChild(metric);

      testHost.appendChild(container);

      const violations = validateSlot(slot, container);

      expect(violations.length).toBe(1);
      expect(violations[0].type).toBe('role');
      expect(violations[0].message).toContain('not allowed');
    });

    it('should allow child with correct role', () => {
      const container = document.createElement('sherpa-container');
      container.attachShadow({ mode: 'open' });

      const slot = document.createElement('slot');
      slot.setAttribute('data-accepts', 'control');
      container.shadowRoot.appendChild(slot);

      const button = document.createElement('sherpa-button');
      container.appendChild(button);

      testHost.appendChild(container);

      const violations = validateSlot(slot, container);

      expect(violations.length).toBe(0);
    });

    it('should allow multiple roles', () => {
      const container = document.createElement('sherpa-container');
      container.attachShadow({ mode: 'open' });

      const slot = document.createElement('slot');
      slot.setAttribute('data-accepts', 'control,input');
      container.shadowRoot.appendChild(slot);

      const button = document.createElement('sherpa-button');
      const input = document.createElement('sherpa-input-text');
      container.appendChild(button);
      container.appendChild(input);

      testHost.appendChild(container);

      const violations = validateSlot(slot, container);

      expect(violations.length).toBe(0);
    });

    it('should reject non-sherpa elements without html in accepts', () => {
      const container = document.createElement('sherpa-container');
      container.attachShadow({ mode: 'open' });

      const slot = document.createElement('slot');
      slot.setAttribute('data-accepts', 'control');
      container.shadowRoot.appendChild(slot);

      const div = document.createElement('div');
      container.appendChild(div);

      testHost.appendChild(container);

      const violations = validateSlot(slot, container);

      expect(violations.length).toBe(1);
      expect(violations[0].type).toBe('role');
      expect(violations[0].message).toContain('non-sherpa element');
    });

    it('should allow non-sherpa elements with html in accepts', () => {
      const container = document.createElement('sherpa-container');
      container.attachShadow({ mode: 'open' });

      const slot = document.createElement('slot');
      slot.setAttribute('data-accepts', 'control,html');
      container.shadowRoot.appendChild(slot);

      const div = document.createElement('div');
      container.appendChild(div);

      testHost.appendChild(container);

      const violations = validateSlot(slot, container);

      expect(violations.length).toBe(0);
    });
  });

  describe('Strict mode', () => {
    it('should flag rejected elements with data-slot-rejected in strict mode', () => {
      CompositionValidator.enable({ strict: true, devModeOnly: false });

      const button = document.createElement('sherpa-button');
      button.attachShadow({ mode: 'open' });

      const slot = document.createElement('slot');
      button.shadowRoot.appendChild(slot);

      const container = document.createElement('sherpa-container');
      button.appendChild(container);

      testHost.appendChild(button);

      CompositionValidator.validate(button);

      expect(container.getAttribute('data-slot-rejected')).toBe('true');
    });

    it('should not flag elements when strict mode is off', () => {
      CompositionValidator.enable({ strict: false, devModeOnly: false });

      const button = document.createElement('sherpa-button');
      button.attachShadow({ mode: 'open' });

      const slot = document.createElement('slot');
      button.shadowRoot.appendChild(slot);

      const container = document.createElement('sherpa-container');
      button.appendChild(container);

      testHost.appendChild(button);

      CompositionValidator.validate(button);

      expect(container.hasAttribute('data-slot-rejected')).toBe(false);
    });
  });

  describe('Error messages', () => {
    it('should provide helpful tier violation message', () => {
      const button = document.createElement('sherpa-button');
      button.attachShadow({ mode: 'open' });

      const slot = document.createElement('slot');
      button.shadowRoot.appendChild(slot);

      const container = document.createElement('sherpa-container');
      button.appendChild(container);

      testHost.appendChild(button);

      const violations = validateSlot(slot, button);

      expect(violations[0].message).toContain('Tier rule');
      expect(violations[0].message).toContain('Fix:');
    });

    it('should provide helpful role violation message', () => {
      const container = document.createElement('sherpa-container');
      container.attachShadow({ mode: 'open' });

      const slot = document.createElement('slot');
      slot.setAttribute('data-accepts', 'control');
      container.shadowRoot.appendChild(slot);

      const metric = document.createElement('sherpa-metric');
      container.appendChild(metric);

      testHost.appendChild(container);

      const violations = validateSlot(slot, container);

      expect(violations[0].message).toContain('Slot accepts: control');
      expect(violations[0].message).toContain('Fix:');
    });
  });
});
