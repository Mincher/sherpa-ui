/**
 * @element sherpa-input-text
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
}

customElements.define('sherpa-input-text', SherpaInputText);
