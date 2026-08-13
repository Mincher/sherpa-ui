/**
 * sherpa-container — the base card surface.
 *
 * Almost entirely declarative: variant, elevation, padding, state, and the
 * header/footer collapse are all CSS off data-* (the base class reflects
 * data-has-{slot} for slot presence). The one convenience is renderData(),
 * which lets a data-driven view set the loading/empty/error state via populate().
 */
import { SherpaElement } from '../../core/sherpa-element.js';

interface ContainerState {
  /** loading | empty | error | null (clears the overlay). */
  state?: 'loading' | 'empty' | 'error' | null;
}

export class SherpaContainer extends SherpaElement {
  static override css = new URL('./sherpa-container.css', import.meta.url);
  static override html = new URL('./sherpa-container.html', import.meta.url);

  /** populate({ state: 'loading' | 'empty' | 'error' | null }) toggles the overlay. */
  protected override renderData(data: unknown): void {
    const { state } = (data ?? {}) as ContainerState;
    if (state) this.setAttribute('data-state', state);
    else this.removeAttribute('data-state');
  }
}

customElements.define('sherpa-container', SherpaContainer);
