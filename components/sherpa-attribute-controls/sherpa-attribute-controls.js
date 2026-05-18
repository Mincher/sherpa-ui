/**
 * @element sherpa-attribute-controls
 * @category utility
 * @extends SherpaElement
 * @description Auto-generates interactive form controls from a target component's attributes.
 *   Introspects JSDoc, CSS selectors, or common naming patterns to determine control types
 *   and valid values. Supports grouping, presets, custom validators, and bidirectional sync.
 *
 * @attr {string}  [data-target]                  — CSS selector for target component (required)
 * @attr {string}  [data-exclude]                 — Comma-separated attributes to skip
 * @attr {string}  [data-order]                   — Comma-separated attributes; render order
 * @attr {string}  [data-readonly]                — Comma-separated attributes (no edit)
 * @attr {string}  [data-disabled]                — Comma-separated attributes (hide)
 * @attr {boolean} [data-grouped]                 — Group controls by category
 * @attr {enum}    [data-grouping-strategy]       — auto | none | by-prefix | by-category
 * @attr {string}  [data-control-types]          — "size:radio,variant:select,disabled:switch"
 * @attr {string}  [data-labels]                 — JSON override labels
 * @attr {enum}    [data-introspection-strategy]  — auto | jsdoc | css | patterns | override
 * @attr {string}  [data-presets]                — JSON preset configurations
 * @attr {boolean} [data-observe-target]         — Watch target for external changes
 * @attr {number}  [data-debounce=50]            — Debounce ms for updates
 * @attr {boolean} [data-validate]               — Enable validation feedback
 *
 * @fires controls-change
 *   bubbles: true, composed: true
 *   detail: { attribute, oldValue, newValue, timestamp, all }
 * @fires control-input
 *   bubbles: true, composed: true
 *   detail: { attribute, value, timestamp }
 * @fires target-found
 *   bubbles: true, composed: true
 *   detail: { target, attributes }
 * @fires target-not-found
 *   bubbles: true, composed: true
 *   detail: { selector, error }
 * @fires introspection-complete
 *   bubbles: true, composed: true
 *   detail: { count, strategy, attributes }
 * @fires control-error
 *   bubbles: true, composed: true
 *   detail: { attribute, value, error, strategy }
 * @fires target-changed
 *   bubbles: true, composed: true
 *   detail: { attribute, oldValue, newValue, source }
 *
 * @method setTarget(target)
 *   Resolve target component by selector or element reference.
 *   @param {string|HTMLElement} target — Selector or element
 *   @returns {Promise<HTMLElement>}
 *
 * @method refreshUI()
 *   Refresh control UI (use if target changed externally).
 *   @returns {Promise<void>}
 *
 * @method getControlState()
 *   Get all current attribute values.
 *   @returns {Object}
 *
 * @method setValues(values)
 *   Set multiple attributes at once.
 *   @param {Object} values — { attributeName: value, ... }
 *   @returns {Promise<void>}
 *
 * @method applyPreset(presetName)
 *   Activate a preset configuration.
 *   @param {string} presetName — Name of preset
 *   @returns {Promise<void>}
 *
 * @method setValidator(attribute, validator)
 *   Register custom validator for an attribute.
 *   @param {string} attribute — Attribute name
 *   @param {Function} validator — (value) => boolean
 *
 * @method setControlType(attribute, controlType, config)
 *   Override control type for an attribute.
 *   @param {string} attribute — Attribute name
 *   @param {string} controlType — "text" | "number" | "select" | "switch" | "radio"
 *   @param {Object} config — { values, labels, ... }
 *
 * @method getAttributeConfig(attribute)
 *   Get metadata about a discovered attribute.
 *   @param {string} attribute — Attribute name
 *   @returns {Object} — { type, values, label, ... }
 *
 * @prop {HTMLElement|null} targetComponent — Read-only: resolved target element
 * @prop {boolean} hasTarget — Read-only: is target found?
 * @prop {string|null} introspectionStrategy — Read-only: successful strategy
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaAttributeControls extends SherpaElement {
  static get cssUrl() {
    return new URL('./sherpa-attribute-controls.css', import.meta.url).href;
  }

  static get htmlUrl() {
    return new URL('./sherpa-attribute-controls.html', import.meta.url).href;
  }

  #targetComponent = null;
  #attributeConfigs = {}; // { attrName: { type, values, label, ... } }
  #controlElements = {}; // { attrName: HTMLElement }
  #validators = {}; // { attrName: Function }
  #debounceTimers = {}; // { attrName: timeoutId }
  #introspectionStrategy = null;
  #mutationObserver = null;

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'data-target',
      'data-grouped',
      'data-introspection-strategy',
      'data-observe-target',
    ];
  }

  get targetComponent() {
    return this.#targetComponent;
  }

  get hasTarget() {
    return this.#targetComponent !== null;
  }

  get introspectionStrategy() {
    return this.#introspectionStrategy;
  }

  onRender() {
    // Set ARIA attributes
    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'group');
    }
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', 'Component controls');
    }
  }

  async onConnect() {
    const targetSelector = this.dataset.target;
    if (targetSelector) {
      await this.setTarget(targetSelector);
    }
  }

  onDisconnect() {
    this.#stopObservingTarget();
  }

  onAttributeChanged(name, oldValue, newValue) {
    super.onAttributeChanged(name, oldValue, newValue);

    if (name === 'data-observe-target') {
      if (newValue !== null) {
        this.#startObservingTarget();
      } else {
        this.#stopObservingTarget();
      }
    }
  }

  // ============ Public API ============

  async setTarget(target) {
    try {
      // Accept selector string or element
      if (typeof target === 'string') {
        this.#targetComponent = document.querySelector(target);
        if (!this.#targetComponent) {
          throw new Error(`Target not found: ${target}`);
        }
      } else if (target instanceof HTMLElement) {
        this.#targetComponent = target;
      } else {
        throw new Error('Target must be selector string or HTMLElement');
      }

      // Introspect target
      await this.#introspectTarget();

      // Generate controls
      this.#generateControls();

      // Emit success event
      this.#emit('target-found', {
        target: this.#targetComponent,
        attributes: Object.keys(this.#attributeConfigs),
      });

      // Start observing if enabled
      if (this.hasAttribute('data-observe-target')) {
        this.#startObservingTarget();
      }

      return this.#targetComponent;
    } catch (err) {
      this.#emit('target-not-found', {
        selector: typeof target === 'string' ? target : '(element)',
        error: err.message,
      });
      throw err;
    }
  }

  async refreshUI() {
    if (!this.#targetComponent) return;
    this.#generateControls();
  }

  getControlState() {
    const state = {};
    for (const [attr, el] of Object.entries(this.#controlElements)) {
      state[attr] = this.#getControlValue(el);
    }
    return state;
  }

  async setValues(values) {
    if (!this.#targetComponent) return;

    for (const [attr, value] of Object.entries(values)) {
      this.#targetComponent.setAttribute(attr, String(value));
      const control = this.#controlElements[attr];
      if (control) {
        this.#setControlValue(control, value);
      }
    }
  }

  async applyPreset(presetName) {
    const presetsJson = this.dataset.presets;
    if (!presetsJson) return;

    try {
      const presets = JSON.parse(presetsJson);
      const preset = presets[presetName];
      if (!preset) {
        console.warn(`Preset not found: ${presetName}`);
        return;
      }

      await this.setValues(preset);
    } catch (err) {
      console.error('Failed to apply preset:', err);
    }
  }

  setValidator(attribute, validator) {
    this.#validators[attribute] = validator;
  }

  setControlType(attribute, controlType, config = {}) {
    if (!this.#attributeConfigs[attribute]) {
      this.#attributeConfigs[attribute] = {};
    }
    this.#attributeConfigs[attribute].type = controlType;
    Object.assign(this.#attributeConfigs[attribute], config);
  }

  getAttributeConfig(attribute) {
    return this.#attributeConfigs[attribute] || null;
  }

  // ============ Private Methods ============

  async #introspectTarget() {
    this.#attributeConfigs = {};
    this.#introspectionStrategy = null;

    const strategy = this.dataset.introspectionStrategy || 'auto';

    // Try strategies in order
    if (strategy === 'auto' || strategy === 'jsdoc') {
      if (await this.#introspectFromJSDoc()) return;
    }

    if (strategy === 'auto' || strategy === 'css') {
      if (await this.#introspectFromCSS()) return;
    }

    if (strategy === 'auto' || strategy === 'patterns') {
      if (await this.#introspectFromPatterns()) return;
    }

    if (strategy === 'auto' || strategy === 'override') {
      if (this.dataset.controlTypes) {
        this.#introspectFromOverride();
      }
    }

    // Fallback: plaintext controls
    if (Object.keys(this.#attributeConfigs).length === 0) {
      this.#introspectFromFallback();
    }

    this.#emit('introspection-complete', {
      count: Object.keys(this.#attributeConfigs).length,
      strategy: this.#introspectionStrategy,
      attributes: this.#attributeConfigs,
    });
  }

  async #introspectFromJSDoc() {
    // Try to extract @attr tags from component class JSDoc
    const component = this.#targetComponent.constructor;
    if (!component.__doc__) return false;

    const doc = component.__doc__;
    const attrRegex = /@attr\s+\{([^}]+)\}\s+([^\s]+)\s*—\s*(.+)/g;

    let match;
    while ((match = attrRegex.exec(doc))) {
      const [, type, name, desc] = match;
      const parsed = this.#parseJSDocType(type, desc);
      if (parsed) {
        this.#attributeConfigs[name] = {
          label: this.#normalizeLabel(name),
          description: desc.trim(),
          ...parsed,
        };
      }
    }

    if (Object.keys(this.#attributeConfigs).length > 0) {
      this.#introspectionStrategy = 'jsdoc';
      return true;
    }

    return false;
  }

  async #introspectFromCSS() {
    // Extract attribute selectors from component's shadow CSS
    // This is a simplified approach; ideally would parse actual CSS
    const computedStyle = getComputedStyle(this.#targetComponent);

    // Check for common attributes by trying them and seeing what CSS rules apply
    const commonAttrs = ['data-variant', 'data-size', 'data-status', 'disabled'];
    for (const attr of commonAttrs) {
      const values = this.#guessValuesFromAttr(attr);
      if (values.length > 0) {
        this.#attributeConfigs[attr] = {
          type: values.length <= 3 ? 'radio' : 'select',
          values,
          label: this.#normalizeLabel(attr),
        };
      }
    }

    if (Object.keys(this.#attributeConfigs).length > 0) {
      this.#introspectionStrategy = 'css';
      return true;
    }

    return false;
  }

  async #introspectFromPatterns() {
    // Use naming conventions to guess attribute configurations
    const patterns = {
      'data-variant': {
        type: 'select',
        values: ['primary', 'secondary', 'tertiary'],
      },
      'data-size': {
        type: 'radio',
        values: ['xs', 'sm', 'md', 'lg', 'xl'],
      },
      'data-status': {
        type: 'select',
        values: ['critical', 'warning', 'success', 'info'],
      },
      'data-layout': {
        type: 'select',
        values: ['horizontal', 'vertical', 'inline'],
      },
      'disabled': {
        type: 'switch',
      },
      'data-active': {
        type: 'switch',
      },
    };

    // Check observed attributes from target component
    const observedAttrs = this.#targetComponent.constructor.observedAttributes || [];

    for (const attr of observedAttrs) {
      if (patterns[attr]) {
        this.#attributeConfigs[attr] = {
          label: this.#normalizeLabel(attr),
          ...patterns[attr],
        };
      }
    }

    if (Object.keys(this.#attributeConfigs).length > 0) {
      this.#introspectionStrategy = 'patterns';
      return true;
    }

    return false;
  }

  #introspectFromOverride() {
    // Parse data-control-types attribute
    const controlTypes = this.dataset.controlTypes;
    if (!controlTypes) return;

    const pairs = controlTypes.split(',');
    for (const pair of pairs) {
      const [attr, type] = pair.trim().split(':');
      if (attr && type) {
        this.#attributeConfigs[attr] = {
          type: type.trim(),
          label: this.#normalizeLabel(attr),
        };
      }
    }

    this.#introspectionStrategy = 'override';
  }

  #introspectFromFallback() {
    // Generate plaintext controls for common attributes
    const attrs = this.#targetComponent.getAttribute ? ['disabled'] : [];

    for (const attr of attrs) {
      this.#attributeConfigs[attr] = {
        type: 'switch',
        label: this.#normalizeLabel(attr),
      };
    }

    this.#introspectionStrategy = 'fallback';
  }

  #parseJSDocType(typeStr, descStr) {
    typeStr = typeStr.trim().toLowerCase();

    if (typeStr === 'boolean') {
      return { type: 'switch' };
    }

    if (typeStr === 'enum') {
      // Extract values from description: "primary | secondary | tertiary"
      const matches = descStr.match(/(\w+)\s*(?:\||,)/g);
      if (matches) {
        const values = matches.map((m) => m.trim().replace(/[|,]$/, ''));
        return {
          type: values.length <= 3 ? 'radio' : 'select',
          values,
        };
      }
    }

    if (typeStr === 'string') {
      return { type: 'text' };
    }

    if (typeStr === 'number') {
      return { type: 'number' };
    }

    return null;
  }

  #guessValuesFromAttr(attr) {
    // Simplified: try to guess common values
    const valueMap = {
      'data-variant': ['primary', 'secondary', 'tertiary'],
      'data-size': ['xs', 'sm', 'md', 'lg', 'xl'],
      'data-status': ['critical', 'warning', 'success', 'info'],
    };

    return valueMap[attr] || [];
  }

  #normalizeLabel(attr) {
    return attr
      .replace(/^data-/, '')
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  #generateControls() {
    if (!this.#targetComponent) return;

    // Clear existing controls
    const controlsArea = this.$('[role="region"]');
    if (controlsArea) {
      controlsArea.innerHTML = '';
    }

    this.#controlElements = {};

    // Parse configuration
    const excluded = (this.dataset.exclude || '').split(',').map((s) => s.trim());
    const readonly = (this.dataset.readonly || '').split(',').map((s) => s.trim());
    const disabled = (this.dataset.disabled || '').split(',').map((s) => s.trim());
    const order = (this.dataset.order || '').split(',').map((s) => s.trim());

    // Filter and order attributes
    let attrs = Object.keys(this.#attributeConfigs).filter(
      (a) => !excluded.includes(a) && !disabled.includes(a)
    );

    // Reorder based on data-order
    attrs = [
      ...order.filter((a) => attrs.includes(a)),
      ...attrs.filter((a) => !order.includes(a)),
    ];

    // Apply labels override
    const labels = this.#parseLabels();

    // Generate controls (grouped or flat)
    if (this.hasAttribute('data-grouped')) {
      this.#generateGroupedControls(attrs, readonly, labels);
    } else {
      this.#generateFlatControls(attrs, readonly, labels);
    }
  }

  #generateFlatControls(attrs, readonly, labels) {
    const wrapper = document.createElement('div');
    wrapper.role = 'region';
    wrapper.className = 'controls-wrapper';

    for (const attr of attrs) {
      const config = this.#attributeConfigs[attr];
      const label = labels[attr] || config.label;
      const isReadonly = readonly.includes(attr);

      const control = this.#createControl(attr, config, label, isReadonly);
      if (control) {
        wrapper.appendChild(control);
        this.#controlElements[attr] = control;
      }
    }

    this.shadowRoot?.appendChild(wrapper);
  }

  #generateGroupedControls(attrs, readonly, labels) {
    const wrapper = document.createElement('div');
    wrapper.role = 'region';
    wrapper.className = 'controls-grouped';

    const groups = this.#groupAttributes(attrs);

    for (const [groupName, groupAttrs] of Object.entries(groups)) {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'control-group';

      const legend = document.createElement('legend');
      legend.textContent = groupName;
      legend.className = 'control-group-title';
      fieldset.appendChild(legend);

      const groupWrapper = document.createElement('div');
      groupWrapper.className = 'control-group-content';

      for (const attr of groupAttrs) {
        const config = this.#attributeConfigs[attr];
        const label = labels[attr] || config.label;
        const isReadonly = readonly.includes(attr);

        const control = this.#createControl(attr, config, label, isReadonly);
        if (control) {
          groupWrapper.appendChild(control);
          this.#controlElements[attr] = control;
        }
      }

      fieldset.appendChild(groupWrapper);
      wrapper.appendChild(fieldset);
    }

    this.shadowRoot?.appendChild(wrapper);
  }

  #createControl(attr, config, label, isReadonly) {
    const type = config.type || 'text';
    const controlWrapper = document.createElement('div');
    controlWrapper.className = 'control-item';
    controlWrapper.part = 'control-item';

    const labelEl = document.createElement('label');
    labelEl.className = 'control-label';
    labelEl.part = 'control-label';
    labelEl.textContent = label;

    let control;

    switch (type) {
      case 'switch':
        control = document.createElement('sherpa-switch');
        control.dataset.name = attr;
        if (isReadonly) control.disabled = true;
        control.checked = this.#targetComponent.hasAttribute(attr);
        control.addEventListener('change', (e) =>
          this.#onControlChange(attr, e.target.checked ? 'true' : 'false')
        );
        break;

      case 'radio':
        control = document.createElement('sherpa-input-radio-group');
        control.dataset.name = attr;
        if (isReadonly) control.disabled = true;
        const currentValue = this.#targetComponent.getAttribute(attr) || '';
        for (const value of config.values || []) {
          const option = document.createElement('sherpa-input-radio');
          option.value = value;
          option.dataset.label = value;
          option.checked = value === currentValue;
          control.appendChild(option);
        }
        control.addEventListener('change', (e) =>
          this.#onControlChange(attr, e.target.value)
        );
        break;

      case 'select':
        control = document.createElement('sherpa-input-select');
        control.dataset.name = attr;
        if (isReadonly) control.disabled = true;
        const currentSelect = this.#targetComponent.getAttribute(attr) || '';
        for (const value of config.values || []) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          option.selected = value === currentSelect;
          control.appendChild(option);
        }
        control.addEventListener('change', (e) =>
          this.#onControlChange(attr, e.target.value)
        );
        break;

      case 'number':
        control = document.createElement('sherpa-input-number');
        control.dataset.name = attr;
        if (isReadonly) control.disabled = true;
        control.value = this.#targetComponent.getAttribute(attr) || '';
        control.addEventListener('change', (e) => this.#onControlChange(attr, e.target.value));
        control.addEventListener('input', (e) => this.#onControlInput(attr, e.target.value));
        break;

      case 'text':
      default:
        control = document.createElement('sherpa-input-text');
        control.dataset.name = attr;
        if (isReadonly) control.disabled = true;
        control.value = this.#targetComponent.getAttribute(attr) || '';
        control.addEventListener('change', (e) => this.#onControlChange(attr, e.target.value));
        control.addEventListener('input', (e) => this.#onControlInput(attr, e.target.value));
        break;
    }

    if (control) {
      labelEl.htmlFor = `control-${attr}`;
      control.id = `control-${attr}`;

      controlWrapper.appendChild(labelEl);
      controlWrapper.appendChild(control);
    }

    return controlWrapper;
  }

  #groupAttributes(attrs) {
    const strategy = this.dataset.groupingStrategy || 'auto';

    if (strategy === 'none') {
      return { 'All': attrs };
    }

    if (strategy === 'by-prefix') {
      const groups = {};
      for (const attr of attrs) {
        const prefix = attr.replace(/^data-/, '').split('-')[0];
        const groupName = this.#normalizeLabel(prefix);
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(attr);
      }
      return groups;
    }

    // auto | by-category
    const categoryMap = {
      Sizing: ['data-size', 'width', 'height'],
      State: ['disabled', 'data-active', 'data-selected'],
      Appearance: ['data-variant', 'data-status', 'data-theme'],
      Content: ['data-label', 'data-placeholder', 'data-icon-start', 'data-icon-end'],
      Behavior: ['data-layout', 'data-mode'],
    };

    const groups = {};
    const uncategorized = [];

    for (const attr of attrs) {
      let found = false;
      for (const [category, patterns] of Object.entries(categoryMap)) {
        if (patterns.some((p) => attr.includes(p))) {
          if (!groups[category]) groups[category] = [];
          groups[category].push(attr);
          found = true;
          break;
        }
      }
      if (!found) uncategorized.push(attr);
    }

    if (uncategorized.length > 0) {
      groups['Other'] = uncategorized;
    }

    return groups;
  }

  #parseLabels() {
    const labelsJson = this.dataset.labels;
    if (!labelsJson) return {};

    try {
      return JSON.parse(labelsJson);
    } catch {
      console.error('Invalid data-labels JSON');
      return {};
    }
  }

  #onControlChange(attr, value) {
    const debounceMs = parseInt(this.dataset.debounce) || 50;

    // Cancel previous debounce
    if (this.#debounceTimers[attr]) {
      clearTimeout(this.#debounceTimers[attr]);
    }

    // Debounce attribute update
    this.#debounceTimers[attr] = setTimeout(() => {
      const oldValue = this.#targetComponent.getAttribute(attr);

      // Validate
      if (this.#validators[attr] && !this.#validators[attr](value)) {
        this.#emit('control-error', {
          attribute: attr,
          value,
          error: 'Validation failed',
          strategy: this.#introspectionStrategy,
        });
        return;
      }

      // Set attribute
      if (value === 'false') {
        this.#targetComponent.removeAttribute(attr);
      } else {
        this.#targetComponent.setAttribute(attr, value);
      }

      // Emit change event
      this.#emit('controls-change', {
        attribute: attr,
        oldValue,
        newValue: value,
        timestamp: Date.now(),
        all: this.getControlState(),
      });
    }, debounceMs);
  }

  #onControlInput(attr, value) {
    this.#emit('control-input', {
      attribute: attr,
      value,
      timestamp: Date.now(),
    });
  }

  #getControlValue(el) {
    if (!el) return null;
    const input = el.querySelector('[data-name]');
    if (!input) return null;

    if (input.tagName === 'SHERPA-SWITCH') {
      return input.checked ? 'true' : 'false';
    }
    return input.value || '';
  }

  #setControlValue(el, value) {
    const input = el.querySelector('[data-name]');
    if (!input) return;

    if (input.tagName === 'SHERPA-SWITCH') {
      input.checked = value === 'true' || value === true;
    } else {
      input.value = value;
    }
  }

  #startObservingTarget() {
    if (!this.#targetComponent) return;

    if (this.#mutationObserver) {
      this.#mutationObserver.disconnect();
    }

    this.#mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const attr = mutation.attributeName;
          const newValue = this.#targetComponent.getAttribute(attr);
          const oldValue = mutation.oldValue;

          this.#emit('target-changed', {
            attribute: attr,
            oldValue,
            newValue,
            source: 'external',
          });

          // Sync control
          const control = this.#controlElements[attr];
          if (control) {
            this.#setControlValue(control, newValue);
          }
        }
      }
    });

    this.#mutationObserver.observe(this.#targetComponent, {
      attributes: true,
      attributeOldValue: true,
    });
  }

  #stopObservingTarget() {
    if (this.#mutationObserver) {
      this.#mutationObserver.disconnect();
      this.#mutationObserver = null;
    }
  }

  #emit(name, detail) {
    this.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,
        composed: true,
        detail,
      })
    );
  }
}

customElements.define('sherpa-attribute-controls', SherpaAttributeControls);
