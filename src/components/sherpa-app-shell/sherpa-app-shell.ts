/**
 * sherpa-app-shell — the boilerplate frame for an app or a view.
 *
 * CSS owns the inset past the overlaying nav rail; this file only mirrors the
 * rail's state onto the host.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaAppShell extends SherpaElement {
  static override css = new URL('./sherpa-app-shell.css', import.meta.url);
  static override html = new URL('./sherpa-app-shell.html', import.meta.url);
  static override observed = ['data-nav-state', 'data-no-nav', 'data-no-header'];

  override onRender(): void {
    // The event is composed, so one listener covers the default rail and a slotted one.
    this.addEventListener('nav-state-change', this.#onNavState as EventListener);
    // Deferred: the rail sets itself to `collapsed` on its own first render.
    queueMicrotask(() => this.#adoptRailState());
  }

  #onNavState = (event: Event): void => {
    if (this.hasAttribute('data-no-nav')) return;
    const state = (event as CustomEvent).detail?.state as string | undefined;
    if (state) this.dataset['navState'] = state;
  };

  /** Read the rail's current mode once, at startup. */
  #adoptRailState(): void {
    if (this.hasAttribute('data-no-nav')) return;
    const rail =
      this.querySelector<HTMLElement>('[slot="nav"]') ??
      this.$<HTMLElement>('sherpa-nav') ??
      // A slotted rail may sit inside a consumer's wrapper.
      this.querySelector<HTMLElement>('sherpa-nav');
    const state = rail?.dataset['navState'];
    if (state) this.dataset['navState'] = state;
  }
}

customElements.define('sherpa-app-shell', SherpaAppShell);
