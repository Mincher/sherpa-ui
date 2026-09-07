/**
 * sherpa-container — the base card that other things sit inside.
 *
 * CSS handles almost everything: the style, shadow, padding, state, and whether
 * the header and footer show. The one helper is renderData(), which lets a
 * data-driven view flip the card into its loading state.
 *
 * The empty and error overlays are SLOT-DRIVEN (ratified D6): the base class
 * reflects named-slot presence as data-has-{slot} on the host, so slotting
 * content into [slot="empty"] or [slot="error"] shows that overlay through CSS
 * (:host([data-has-empty]) …). No public data-state attribute — the app owns the
 * empty/error content by slotting it. Only loading stays an explicit state attr
 * (data-loading, the ratified boolean-verb form).
 */
import { SherpaElement } from '../../core/sherpa-element.js';

interface ContainerState {
  /**
   * loading toggles the built-in loading overlay (data-loading).
   * null clears it. empty and error are NOT set here — they are slot-driven:
   * slot content into [slot="empty"] / [slot="error"] to show those overlays.
   */
  state?: 'loading' | null;
}

export class SherpaContainer extends SherpaElement {
  static override css = new URL('./sherpa-container.css', import.meta.url);
  static override html = new URL('./sherpa-container.html', import.meta.url);

  /**
   * populate({ state: 'loading' | null }) toggles the loading overlay.
   * loading is the ratified boolean-verb attr (data-loading). The empty and
   * error overlays are slot-driven (D6): the consumer slots content into
   * [slot="empty"] / [slot="error"] and CSS shows the overlay via data-has-*.
   * Passing state:'empty'|'error' is a no-op — use the slots instead.
   */
  protected override renderData(data: unknown): void {
    const { state } = (data ?? {}) as ContainerState;
    this.removeAttribute('data-loading');
    if (state === 'loading') this.setAttribute('data-loading', '');
  }
}

customElements.define('sherpa-container', SherpaContainer);
