/**
 * sherpa-loader — a spinning "please wait" indicator. CSS owns the whole look;
 * the only JS is the screen-reader role, so it announces itself when it appears.
 */
import { SHARED_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';

export class SherpaLoader extends SherpaElement {
  static override css = new URL('./sherpa-loader.css', import.meta.url);
  static override html = new URL('./sherpa-loader.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-orientation': SHARED_PROPS['data-orientation'],
    'data-panel': { type: 'boolean', kind: 'style' },
    'data-size': SHARED_PROPS['data-size'],
  } as const;

  override onRender(): void {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'status');
    if (!this.hasAttribute('aria-live')) this.setAttribute('aria-live', 'polite');
  }
}

customElements.define('sherpa-loader', SherpaLoader);
