/**
 * sherpa-container-footer — the footer strip inside a container.
 *
 * One row of actions: whatever you slot in — buttons, links — sits on a single
 * line, and data-align sets how they spread across it. There's no JS behaviour;
 * CSS handles the alignment and hides the footer when it's empty.
 *
 * @element sherpa-container-footer
 * @attr {enum} data-align — start | end (default) | between
 *
 * @slot (default) — footer action controls (reflects data-has-content)
 *
 * Fires: nothing — slotted controls emit their own events.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaContainerFooter extends SherpaElement {
  static override css = new URL('./sherpa-container-footer.css', import.meta.url);
  static override html = new URL('./sherpa-container-footer.html', import.meta.url);
}

customElements.define('sherpa-container-footer', SherpaContainerFooter);
