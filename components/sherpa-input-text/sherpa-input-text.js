/**
 * @element sherpa-input-text
 * @category input
 * @extends SherpaInputBase
 * @description Basic text input. Inherits label, description, helper, layout,
 *   validation, and value management from SherpaInputBase.
 *
 * @attr {string}  [data-label]       — Label text (inherited)
 * @attr {string}  [data-description]  — Description / error text (inherited)
 * @attr {string}  [data-helper]       — Helper text (inherited)
 * @attr {enum}    [data-layout]       — stacked | horizontal (inherited)
 * @attr {boolean} [disabled]          — Disabled state (inherited)
 * @attr {boolean} [readonly]          — Read-only state (inherited)
 * @attr {boolean} [required]          — Required constraint (inherited)
 * @attr {string}  [name]              — Form field name (inherited)
 * @attr {string}  [value]             — Current value (inherited)
 * @attr {string}  [placeholder]       — Placeholder text (inherited)
 * @attr {string}  [pattern]           — Validation regex (inherited)
 * @attr {number}  [minlength]         — Minimum character length (inherited)
 * @attr {number}  [maxlength]         — Maximum character length (inherited)
 * @attr {boolean} [novalidate]        — Disable built-in validation (inherited)
 * @attr {boolean} [data-multiline]    — Render as an auto-growing textarea
 *                                       that expands in height to fit its
 *                                       content. Newlines are preserved.
 *
 * @fires input
 *   bubbles: true, composed: true
 *   detail: { value: string }
 * @fires change
 *   bubbles: true, composed: true
 *   detail: { value: string }
 */

import { SherpaInputBase } from '../utilities/sherpa-input-base/sherpa-input-base.js';

export class SherpaInputText extends SherpaInputBase {

  static get cssUrl()  { return new URL('./sherpa-input-text.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-input-text.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-multiline'];
  }

  get templateId() {
    return this.hasAttribute('data-multiline') ? 'multiline' : 'default';
  }

  /*
   * No JS auto-grow: the CSS uses `field-sizing: content` (Baseline 2024+)
   * so the textarea expands natively as the user types. Per the project
   * evergreen-only policy, no fallback measurement is needed.
   */

  onAttributeChanged(name, oldValue, newValue) {
    super.onAttributeChanged(name, oldValue, newValue);
    if (name === 'data-multiline') {
      // Only swap templates after the initial render. The first
      // parser-driven attribute change fires before the shadow DOM
      // has been built, and the base #buildWrapper already picks the
      // correct template from `templateId`. We also skip when the
      // currently-rendered control already matches the desired tag,
      // to avoid clobbering freshly-applied values.
      const current = this.getInputElement();
      const wantTextarea = this.hasAttribute('data-multiline');
      const haveTextarea = current?.tagName === 'TEXTAREA';
      if (current && wantTextarea !== haveTextarea) {
        this.renderTemplate(this.templateId).then(() => {
          this.onInputRender();
          this.onInputConnect();
        });
      }
    }
  }
}

customElements.define('sherpa-input-text', SherpaInputText);
