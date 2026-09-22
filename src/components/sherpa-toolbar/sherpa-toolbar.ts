/**
 * sherpa-toolbar — a horizontal strip of controls. Layout only, no behaviour:
 * a leading slot that stretches and a trailing slot that hugs its content.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaToolbar extends SherpaElement {
  static override css = new URL('./sherpa-toolbar.css', import.meta.url);
  static override html = new URL('./sherpa-toolbar.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-type': { type: 'enum', kind: 'style', values: ['bordered'] },
  } as const;
}

customElements.define('sherpa-toolbar', SherpaToolbar);
