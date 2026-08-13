/**
 * sherpa-dialog — a modal built on the native <dialog> element.
 *
 * data-open (a reflected boolean) is the single switch: setting it calls
 * dialog.showModal(); removing it calls dialog.close(). The native element
 * provides the focus trap, ::backdrop, and Escape-to-close — so JS only bridges
 * data-open ↔ the element's open state and emits dialog-open / dialog-close. A
 * close button and a backdrop click also close it. The open() / close() methods
 * and the `open` property are thin wrappers over data-open.
 *
 * @element sherpa-dialog
 * @attr {boolean} data-open        — present = modal shown
 * @attr {string}  data-label       — title text (or use the `title` slot)
 * @attr {enum}    data-size        — sm | md (default) | lg | full
 * @attr {enum}    data-dismissible — "false" hides the close button
 *
 * @slot (default) — the dialog body
 * @slot title     — custom title content (overrides data-label)
 * @slot footer    — footer actions
 *
 * @fires dialog-open  — bubbles + composed. detail: {}
 * @fires dialog-close — bubbles + composed. detail: {}
 *
 * @prop {boolean} open — open state (read/write)
 * @method open()  — show the modal
 * @method close() — dismiss the modal
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaDialog extends SherpaElement {
  static override css = new URL('./sherpa-dialog.css', import.meta.url);
  static override html = new URL('./sherpa-dialog.html', import.meta.url);
  static override observed = ['data-open', 'data-label'];

  override onRender(): void {
    this.#syncTitle();

    const dialog = this.#dialog();
    // Native <dialog> fires "close" on close()/Escape — reflect that back to
    // data-open (without re-triggering close) and emit dialog-close.
    dialog?.addEventListener('close', this.#onNativeClose);
    // A click landing on the <dialog> itself (not its content box) is the backdrop.
    dialog?.addEventListener('click', this.#onBackdropClick);
    this.$('.close')?.addEventListener('click', this.#onCloseButton);
  }

  override onConnect(): void {
    // data-open set before the element connected — open now that the DOM exists.
    if (this.hasAttribute('data-open')) this.#show();
  }

  override onChange(name: string, _old: string | null, value: string | null): void {
    if (name === 'data-open') {
      if (value !== null) this.#show();
      else this.#hide();
    } else if (name === 'data-label') {
      this.#syncTitle();
    }
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get open(): boolean {
    return this.hasAttribute('data-open');
  }
  set open(value: boolean) {
    this.toggleAttribute('data-open', value);
  }

  /**
   * Show the modal (idempotent). Named show() because `open` is already a
   * boolean property — a method and accessor can't share the key `open`.
   */
  show(): void {
    this.setAttribute('data-open', '');
  }
  /** Dismiss the modal (idempotent). */
  close(): void {
    this.removeAttribute('data-open');
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  #dialog(): HTMLDialogElement | null {
    return this.$<HTMLDialogElement>('.dialog');
  }

  #syncTitle(): void {
    const el = this.$('.title-text');
    if (el) el.textContent = this.dataset['label'] ?? '';
  }

  #show(): void {
    const dialog = this.#dialog();
    if (dialog && !dialog.open) {
      dialog.showModal();
      this.emit('dialog-open', {});
    }
  }

  #hide(): void {
    const dialog = this.#dialog();
    if (dialog?.open) dialog.close(); // fires the native "close" → #onNativeClose
  }

  #onNativeClose = (): void => {
    // The element is already closed; drop data-open without recursing, and notify.
    if (this.hasAttribute('data-open')) this.removeAttribute('data-open');
    this.emit('dialog-close', {});
  };

  #onBackdropClick = (event: MouseEvent): void => {
    if (event.target === this.#dialog()) this.#dialog()?.close();
  };

  #onCloseButton = (): void => {
    this.#dialog()?.close();
  };
}

customElements.define('sherpa-dialog', SherpaDialog);
