/**
 * sherpa-container-footer — the footer bar for a container's `footer` slot.
 *
 * A single actions row: whatever is slotted (buttons, links) laid out on one
 * line, with data-align controlling their horizontal distribution. It's a pure
 * surface — no JS behaviour beyond the base class; alignment and the appear-when-
 * filled behaviour are CSS off data-* and the base class's data-has-content
 * reflection.
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
