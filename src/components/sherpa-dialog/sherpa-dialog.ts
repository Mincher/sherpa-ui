/**
 * sherpa-dialog — a modal surface backed by the native <dialog> element.
 *
 * The native `close` event does not cross the shadow boundary; it is re-dispatched composed.
 *
 * @prop {boolean} open — whether the dialog is open (delegates to <dialog>)
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

export class SherpaDialog extends SherpaElement {
  static override css = new URL('./sherpa-dialog.css', import.meta.url);
  static override html = new URL('./sherpa-dialog.html', import.meta.url);
  static override props = {
    'data-heading': { type: 'string', kind: 'content', to: '.heading-text' },
    'data-type': { type: 'enum', kind: 'style', values: ['modal', 'overlay'] },
  } as const;

  static override observed = ['open'];

  #dialog(): HTMLDialogElement | null {
    return this.$<HTMLDialogElement>('.root');
  }

  /** An overlay leaves the page beside it live, so it is never modal. */
  get #modal(): boolean {
    return this.dataset['type'] !== 'overlay';
  }

  override onRender(): void {
    const dialog = this.#dialog();
    if (!dialog) return;
    if (this.hasAttribute('open')) this.#showDialog(dialog);
    dialog.addEventListener('close', this.#onClose);
    // A non-modal <dialog> gets no ESC from the browser.
    this.addEventListener('keydown', this.#onKeydown);
  }

  override onDisconnect(): void {
    this.removeEventListener('keydown', this.#onKeydown);
  }

  override onChange(name: string): void {
    if (name === 'open') {
      if (this.hasAttribute('open')) this.show();
      else this.close();
    }
  }

  get open(): boolean {
    return this.#dialog()?.open ?? this.hasAttribute('open');
  }
  set open(value: boolean) {
    if (value) this.show();
    else this.close();
  }

  /** Open it: a modal goes to the top layer with a backdrop; an overlay stays in place. */
  show(): void {
    // The attribute FIRST: a closed overlay host is display:none, and cannot take focus.
    this.toggleAttribute('open', true);
    const dialog = this.#dialog();
    if (dialog && !dialog.open) this.#showDialog(dialog);
  }

  #showDialog(dialog: HTMLDialogElement): void {
    if (this.#modal) {
      dialog.showModal();
      return;
    }
    dialog.show();
    // show() moves no focus into SLOTTED content, and ESC is heard only from inside.
    if (!this.matches(':focus-within')) dialog.focus();
  }

  /**
   * Close it. `hide()` is Sherpa's verb across every component that opens;
   * `close()` is kept as an alias because this wraps a native <dialog>, whose
   * own method is close().
   * TRAP T-one-verb-proxies-to-the-native-one
   */
  hide(): void {
    const dialog = this.#dialog();
    if (dialog?.open) dialog.close();
    this.toggleAttribute('open', false);
  }

  /** @see hide — the native <dialog> spelling. */
  close(): void {
    this.hide();
  }

  #onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || this.#modal || !this.open) return;
    event.preventDefault();
    this.hide();
  };

  #onClose = (): void => {
    this.toggleAttribute('open', false);
    this.emit('close', {});
  };
}

customElements.define('sherpa-dialog', SherpaDialog);
