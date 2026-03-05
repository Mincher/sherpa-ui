/**
 * sherpa-input-text.js
 * Basic text input extending SherpaInputBase.
 *
 * @example
 *   <sherpa-input-text label="Name" placeholder="Enter your name"></sherpa-input-text>
 *   <sherpa-input-text label="Email" status="error" description="Invalid email"></sherpa-input-text>
 *
 * Attributes (inherited from SherpaInputBase):
 *   label, description, layout, status, disabled, readonly, required, name, value, placeholder
 *
 * @fires input — { value }
 * @fires change — { value }
 */

import { SherpaInputBase } from '../utilities/sherpa-input-base/sherpa-input-base.js';

export class SherpaInputText extends SherpaInputBase {

  static get cssUrl()  { return new URL('./sherpa-input-text.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-input-text.html', import.meta.url).href; }
}

customElements.define('sherpa-input-text', SherpaInputText);
