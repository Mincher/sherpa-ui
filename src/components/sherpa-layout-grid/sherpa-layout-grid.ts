/**
 * sherpa-layout-grid — a responsive CSS-grid container for dashboard tiles.
 *
 * Slotted children flow into a grid whose column count comes from data-cols
 * (or the --maxColCount custom property) and whose row height comes from
 * data-row-height (or --row-height). Children declare their footprint with
 * data-col-span / data-row-span, honoured by CSS (::slotted).
 *
 * JS is thin: it only mirrors the two length-ish attributes onto the private
 * custom properties the CSS reads — it never touches visibility or layout
 * directly. Everything else is pure CSS off data-*.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaLayoutGrid extends SherpaElement {
  static override css = new URL('./sherpa-layout-grid.css', import.meta.url);
  static override html = new URL('./sherpa-layout-grid.html', import.meta.url);
  static override observed = ['data-cols', 'data-row-height'];

  override onRender(): void {
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  /** Mirror data-cols / data-row-height onto the private props the CSS consumes. */
  #sync(): void {
    const cols = this.dataset['cols'];
    if (cols) this.style.setProperty('--maxColCount', cols);
    else this.style.removeProperty('--maxColCount');

    const rowHeight = this.dataset['rowHeight'];
    if (rowHeight) this.style.setProperty('--row-height', rowHeight);
    else this.style.removeProperty('--row-height');
  }
}

customElements.define('sherpa-layout-grid', SherpaLayoutGrid);
