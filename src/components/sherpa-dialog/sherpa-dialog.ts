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
  } as const;

  static override observed = ['open'];

  #dialog(): HTMLDialogElement | null {
    return this.$<HTMLDialogElement>('.root');
  }

  override onRender(): void {
    const dialog = this.#dialog();
    if (!dialog) return;
    if (this.hasAttribute('open')) dialog.showModal();
    dialog.addEventListener('close', this.#onClose);
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

  /** Open as a modal — top layer, backdrop, focus trap. */
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

  #onClose = (): void => {
    this.toggleAttribute('open', false);
    this.emit('close', {});
  };
}

customElements.define('sherpa-dialog', SherpaDialog);
