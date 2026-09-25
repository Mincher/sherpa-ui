/**
 * sherpa-app-shell — the boilerplate frame for an app and its Contexts.
 *
 * CSS owns the inset past the overlaying nav rail; this file only mirrors the
 * rail's state onto the host.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

export class SherpaAppShell extends SherpaElement {
  static override css = new URL('./sherpa-app-shell.css', import.meta.url);
  static override html = new URL('./sherpa-app-shell.html', import.meta.url);
  static override observed = ['data-nav-state', 'data-no-nav', 'data-no-header'];

  /** The shell writes these itself, mirroring each panel's own `data-open`. */
  static override props = {
    'data-panel-start-open': { type: 'boolean', kind: 'visibility' },
    'data-panel-end-open': { type: 'boolean', kind: 'visibility' },
  } as const;

  override onRender(): void {
    // The event is composed, so one listener covers the default rail and a slotted one.
    this.addEventListener('nav-state-change', this.#onNavState as EventListener);
    // Deferred: the rail sets itself to `collapsed` on its own first render.
    queueMicrotask(() => this.#adoptRailState());

    /* A panel area follows its panel's own `data-open`: slotted but SHUT, it
       must take no room, or the Context never gets the width back.
       `::slotted()` cannot go inside `:has()`, so the shell mirrors the flag.
       TRAP T-the-shell-owns-the-panel-areas */
    for (const side of ['start', 'end'] as const) {
      this.$(`slot[name="panel-${side}"]`)
        ?.addEventListener('slotchange', () => this.#watchPanel(side));
      this.#watchPanel(side);
    }
  }

  /** Mirror one panel's `data-open` onto the host, and follow it. */
  #watchPanel(side: 'start' | 'end'): void {
    const slot = this.$<HTMLSlotElement>(`slot[name="panel-${side}"]`);
    const panel = slot?.assignedElements()[0];
    const flag = `data-panel-${side}-open`;
    const sync = (): void => {
      this.toggleAttribute(flag, !!panel?.hasAttribute('data-open'));
    };
    this.#panelWatch[side]?.disconnect();
    if (!panel) { this.removeAttribute(flag); return; }
    const observer = new MutationObserver(sync);
    observer.observe(panel, { attributes: true, attributeFilter: ['data-open'] });
    this.#panelWatch[side] = observer;
    sync();
  }

  /** Watches each side panel slot, to say whether it holds anything. */
  #panelWatch: { start?: MutationObserver; end?: MutationObserver } = {};

  override onDisconnect(): void {
    this.#panelWatch.start?.disconnect();
    this.#panelWatch.end?.disconnect();
  }

  /** The nav changed state: mirror it, so the content can make room. */
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
