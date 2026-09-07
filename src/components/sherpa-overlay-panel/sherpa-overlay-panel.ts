/**
 * sherpa-overlay-panel — a NON-modal floating panel on native <dialog>.
 *
 * Native-first (naming standard D2/D12): opened with dialog.show() (not
 * showModal()), so it floats in the top layer WITHOUT a backdrop, focus-trap or
 * ESC-to-close — the page behind stays interactive. Chosen over the Popover API
 * because it shares sherpa-dialog's exact structure + imperative show()/close()
 * lifecycle (the only difference being show vs showModal). This file opens/closes
 * the dialog, keeps `open` in sync, renders the optional data-heading, and
 * re-dispatches the native `close` event as a composed one.
 *
 * @element sherpa-overlay-panel
 * @attr {string}  data-heading — convenience header label (a slotted [slot=header] overrides it)
 * @attr {boolean} open         — read reflects dialog.open; set → show()/close()
 * @attr {enum}    data-status  — status colour cascade (critical | warning | success | info | urgent)
 *
 * @fires close — the panel closed (close()). bubbles + composed. detail: { }
 *
 * @prop {boolean} open — whether the panel is open (delegates to <dialog>)
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaOverlayPanel extends SherpaElement {
  static override css = new URL('./sherpa-overlay-panel.css', import.meta.url);
  static override html = new URL('./sherpa-overlay-panel.html', import.meta.url);
  static override observed = ['data-heading', 'open'];

  #dialog(): HTMLDialogElement | null {
    return this.$<HTMLDialogElement>('.root');
  }

  override onRender(): void {
    const dialog = this.#dialog();
    if (!dialog) return;
    this.#syncHeading();
    if (this.hasAttribute('open')) dialog.show();
    dialog.addEventListener('close', this.#onClose);
  }

  override onChange(name: string): void {
    if (name === 'data-heading') this.#syncHeading();
    else if (name === 'open') {
      if (this.hasAttribute('open')) this.show();
      else this.close();
    }
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get open(): boolean {
    return this.#dialog()?.open ?? this.hasAttribute('open');
  }
  set open(value: boolean) {
    if (value) this.show();
    else this.close();
  }

  /** Open as a non-modal floating panel (no backdrop, no focus trap). */
  show(): void {
    const dialog = this.#dialog();
    if (dialog && !dialog.open) dialog.show();
    this.toggleAttribute('open', true);
  }

  /** Close the panel. */
  close(): void {
    const dialog = this.#dialog();
    if (dialog?.open) dialog.close();
    this.toggleAttribute('open', false);
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  #syncHeading(): void {
    const label = this.$('.heading-text');
    if (label) label.textContent = this.dataset.heading ?? '';
  }

  #onClose = (): void => {
    this.toggleAttribute('open', false);
    this.emit('close', {});
  };
}

customElements.define('sherpa-overlay-panel', SherpaOverlayPanel);
