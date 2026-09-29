/**
 * sherpa-dialog — a modal surface backed by the native <dialog> element.
 *
 * The native `close` event does not cross the shadow boundary; it is reported as `dialog-close`.
 *
 * @prop {boolean} open — whether the dialog is open (delegates to <dialog>)
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { DialogSurface } from '../../core/ui/disclosure.js';

export class SherpaDialog extends SherpaElement {
  static override css = new URL('./sherpa-dialog.css', import.meta.url);
  static override html = new URL('./sherpa-dialog.html', import.meta.url);
  static override props = {
    'data-heading': { type: 'string', kind: 'content', to: '.heading-text' },
    'data-type': { type: 'enum', kind: 'style', values: ['modal', 'overlay'] },
  } as const;

  static override observed = ['open'];

  /** The native dialog behind `open`. */
  #surface = new DialogSurface(this, () => this.$<HTMLDialogElement>('.root'), {
    open: (dialog) => this.#showDialog(dialog),
    closed: () => this.emit('dialog-close'),
  });

  /** An overlay leaves the page beside it live, so it is never modal. */
  get #modal(): boolean {
    return this.dataset['type'] !== 'overlay';
  }

  override onRender(): void {
    if (this.hasAttribute('open')) this.#surface.show();
    this.#surface.listen();
    // A non-modal <dialog> gets no ESC from the browser.
    this.addEventListener('keydown', this.#onKeydown);
  }

  override onDisconnect(): void {
    this.removeEventListener('keydown', this.#onKeydown);
  }

  override onChange(name: string): void {
    if (name === 'open') this.#surface.follow();
  }

  get open(): boolean {
    return this.#surface.open;
  }
  set open(value: boolean) {
    if (value) this.show();
    else this.hide();
  }

  /** Open it: a modal goes to the top layer with a backdrop; an overlay stays in place. */
  show(): void {
    this.#surface.show();
  }

  /** Open it modal, or as a plain dialog. */
  #showDialog(dialog: HTMLDialogElement): void {
    if (this.#modal) {
      dialog.showModal();
      return;
    }
    dialog.show();
    // show() moves no focus into SLOTTED content, and ESC is heard only from inside.
    if (!this.matches(':focus-within')) dialog.focus();
  }

  /** Close it. */
  hide(): void {
    this.#surface.hide();
  }

  /** `hide()`, in the native <dialog>'s spelling. */
  close(): void {
    this.hide();
  }

  /** Escape closes a non-modal dialog; a modal one closes itself. */
  #onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || this.#modal || !this.open) return;
    event.preventDefault();
    this.hide();
  };
}

customElements.define('sherpa-dialog', SherpaDialog);
