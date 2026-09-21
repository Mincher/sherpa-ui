/** sherpa-container — the base card. CSS owns style, padding and state. */
import { SherpaElement } from '../../core/sherpa-element.js';

interface ContainerState {
  /** Only loading is settable. empty/error are slot-driven, not state. */
  state?: 'loading' | null;
}

export class SherpaContainer extends SherpaElement {
  static override css = new URL('./sherpa-container.css', import.meta.url);
  static override html = new URL('./sherpa-container.html', import.meta.url);

  /** Toggles the loading overlay. 'empty'/'error' are a NO-OP — slot them instead. */
  protected override renderData(data: unknown): void {
    const { state } = (data ?? {}) as ContainerState;
    this.removeAttribute('data-loading');
    if (state === 'loading') this.setAttribute('data-loading', '');
  }
}

customElements.define('sherpa-container', SherpaContainer);
