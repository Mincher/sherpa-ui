/**
 * sherpa-container — the base card that other things sit inside.
 *
 * CSS handles almost everything: the style, shadow, padding, state, and whether
 * the header and footer show. The one helper is renderData(), which lets a
 * data-driven view flip the card into a loading, empty, or error state.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

interface ContainerState {
  /** loading | empty | error | null (clears the overlay). */
  state?: 'loading' | 'empty' | 'error' | null;
}

export class SherpaContainer extends SherpaElement {
  static override css = new URL('./sherpa-container.css', import.meta.url);
  static override html = new URL('./sherpa-container.html', import.meta.url);

  /** populate({ state: 'loading' | 'empty' | 'error' | null }) toggles the overlay.
   *  loading is the ratified boolean-verb attr (data-loading); empty/error remain on
   *  data-state pending the slot-driven (:has()) overlay refactor (D6 — deferred). */
  protected override renderData(data: unknown): void {
    const { state } = (data ?? {}) as ContainerState;
    // Clear both channels first, then set the one that applies.
    this.removeAttribute('data-loading');
    this.removeAttribute('data-state');
    if (state === 'loading') this.setAttribute('data-loading', '');
    else if (state) this.setAttribute('data-state', state);
  }
}

customElements.define('sherpa-container', SherpaContainer);
