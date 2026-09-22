/**
 * sherpa-container-footer — the footer strip inside a container.
 *
 * No JS: CSS owns the alignment and hides the footer when nothing is slotted.
 *
 * Fires: nothing — slotted controls emit their own events.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

export class SherpaContainerFooter extends SherpaElement {
  static override css = new URL('./sherpa-container-footer.css', import.meta.url);
  static override html = new URL('./sherpa-container-footer.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-align': { type: 'enum', kind: 'style', values: ['between', 'end', 'start', 'stretch'] },
  } as const;
}

customElements.define('sherpa-container-footer', SherpaContainerFooter);
