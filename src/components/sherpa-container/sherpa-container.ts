/**
 * sherpa-container — the base card that other things sit inside.
 *
 * CSS owns style, padding, state and header/footer visibility.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

interface ContainerState {
  /** Only loading is settable. empty/error are slot-driven, not state. */
  state?: 'loading' | null;
}

export class SherpaContainer extends SherpaElement {
  static override css = new URL('./sherpa-container.css', import.meta.url);
  static override html = new URL('./sherpa-container.html', import.meta.url);

  /**
   * Toggles the loading overlay. state:'empty'|'error' is a NO-OP — those
   * overlays show from slot presence (data-has-empty / data-has-error), so
   * slot content into [slot="empty"] / [slot="error"] instead.
   */
  protected override renderData(data: unknown): void {
    const { state } = (data ?? {}) as ContainerState;
    this.removeAttribute('data-loading');
    if (state === 'loading') this.setAttribute('data-loading', '');
  }
}

customElements.define('sherpa-container', SherpaContainer);
