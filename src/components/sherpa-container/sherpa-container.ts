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
  static override tokens = new URL('./sherpa-container.tokens.css', import.meta.url);
  static override html = new URL('./sherpa-container.html', import.meta.url);

  /** populate({ state: 'loading' | 'empty' | 'error' | null }) toggles the overlay. */
  protected override renderData(data: unknown): void {
    const { state } = (data ?? {}) as ContainerState;
    if (state) this.setAttribute('data-state', state);
    else this.removeAttribute('data-state');
  }
}

customElements.define('sherpa-container', SherpaContainer);
