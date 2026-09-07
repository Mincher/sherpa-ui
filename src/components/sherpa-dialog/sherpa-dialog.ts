/**
 * sherpa-dialog — a modal surface backed by the native <dialog> element.
 *
 * Native-first (naming standard D2/D12): showModal() gives us modality, the
 * ::backdrop, a focus-trap, ESC-to-close and the top layer for free. This file
 * only opens/closes the dialog, keeps the `open` attribute in sync, renders the
 * optional data-heading, and re-dispatches the native `close` event as a
 * composed one (the native close does not cross the shadow boundary).
 *
 * @element sherpa-dialog
 * @attr {string}  data-heading — convenience header label (a slotted [slot=header] overrides it)
 * @attr {boolean} open         — read reflects dialog.open; set → showModal()/close()
 * @attr {enum}    data-status  — status colour cascade (critical | warning | success | info | urgent)
 *
 * @fires close — the dialog closed (ESC, backdrop, close()). bubbles + composed. detail: { }
 *
 * @prop {boolean} open — whether the dialog is open (delegates to <dialog>)
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaDialog extends SherpaElement {
  static override css = new URL('./sherpa-dialog.css', import.meta.url);
  static override html = new URL('./sherpa-dialog.html', import.meta.url);
  static override observed = ['data-heading', 'open'];

  #dialog(): HTMLDialogElement | null {
    return this.$<HTMLDialogElement>('.root');
  }

  override onRender(): void {
    const dialog = this.#dialog();
    if (!dialog) return;
    this.#syncHeading();
    if (this.hasAttribute('open')) dialog.showModal();
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

  /** Open as a modal (top layer, backdrop, focus trap). */
  show(): void {
    const dialog = this.#dialog();
    if (dialog && !dialog.open) dialog.showModal();
    this.toggleAttribute('open', true);
  }

  /** Close the dialog. */
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

customElements.define('sherpa-dialog', SherpaDialog);
