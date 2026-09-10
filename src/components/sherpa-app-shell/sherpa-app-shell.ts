/**
 * sherpa-app-shell — the boilerplate frame for an app or a view.
 *
 * The nav rail is an OVERLAY down the left edge at full height; the header +
 * content wrapper is inset past it. Matching the Figma App Shell, the nav and
 * header are PRE-COMPOSED — a <sherpa-nav> and <sherpa-app-header> ship as the
 * named-slot defaults; consumers drop view content in the default slot and can
 * replace either by slotting their own.
 *
 * The inset stays at the COLLAPSED rail width while the rail is collapsed or
 * hovered, so hovering reveals the rail over the content rather than reflowing the
 * page; it grows only when the rail is latched open (pinned/settings). CSS owns
 * that; this file's only job is to mirror the rail's state onto the host so the
 * CSS has something to key off.
 *
 * @attr {enum}    data-nav-state  collapsed | hover | default | pinned | settings
 *                                 (mirrored from the rail; drives the content inset)
 * @attr {boolean} data-no-header  drop the header row; content spans full height
 * @slot nav       replace the default <sherpa-nav>
 * @slot header    replace the default <sherpa-app-header>
 * @slot (default) the view content
 * @fires nothing — it re-broadcasts nothing; the rail's own events still bubble.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaAppShell extends SherpaElement {
  static override css = new URL('./sherpa-app-shell.css', import.meta.url);
  static override html = new URL('./sherpa-app-shell.html', import.meta.url);
  static override observed = ['data-nav-state', 'data-no-header'];

  override onRender(): void {
    // The rail owns its own state machine; the shell only needs to know which mode
    // it is in so the content inset can follow. nav-state-change bubbles out of the
    // rail (composed), so one listener covers the default rail and a slotted one.
    this.addEventListener('nav-state-change', this.#onNavState as EventListener);
    // Adopt the rail's starting mode (it sets itself to `collapsed` on first render).
    queueMicrotask(() => this.#adoptRailState());
  }

  #onNavState = (event: Event): void => {
    const state = (event as CustomEvent).detail?.state as string | undefined;
    if (state) this.dataset['navState'] = state;
  };

  /** Read the rail's current mode once, at startup. */
  #adoptRailState(): void {
    const rail =
      this.querySelector<HTMLElement>('[slot="nav"]') ??
      this.$<HTMLElement>('sherpa-nav') ??
      // A slotted rail may be nested inside a wrapper the consumer provided.
      this.querySelector<HTMLElement>('sherpa-nav');
    const state = rail?.dataset['navState'];
    if (state) this.dataset['navState'] = state;
  }
}

customElements.define('sherpa-app-shell', SherpaAppShell);
