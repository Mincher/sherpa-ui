/**
 * sherpa-stack — a run of items in one direction, with a token gap.
 *
 * There is no JS. Every part of it is a [data-*] selector in the CSS: the
 * direction, the gap, the alignment, whether items wrap. The class exists only
 * to give the element a shadow root and its stylesheet.
 *
 * It is the vertical counterpart to sherpa-toolbar (the horizontal two-zone
 * strip). Before it, every app hand-wrote `display: flex; flex-direction:
 * column; gap: …` in its own stylesheet for a form, a settings page, a dialog
 * footer or a row of cards.
 *
 * @attr {enum}    data-direction  block (default) | inline
 * @attr {enum}    data-gap        none | sm | md | lg (default) | xl | 2xl
 * @attr {enum}    data-align      start | center | end | stretch (default) | between
 * @attr {boolean} data-wrap       inline only — items wrap and share the line
 * @attr {boolean} data-scroll     the run scrolls when taller than its room
 * @attr {boolean} data-measure    cap the width at a reading measure and centre it
 * @attr {boolean} data-fill       take the parent's height; the data-grow child gets the spare
 * @attr {boolean} data-grow       ON A CHILD — that item takes the spare space
 * @slot (default) the items
 * @fires nothing — it is a layout surface; slotted controls emit their own events.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaStack extends SherpaElement {
  static override css = new URL('./sherpa-stack.css', import.meta.url);
  static override html = new URL('./sherpa-stack.html', import.meta.url);
}

customElements.define('sherpa-stack', SherpaStack);
