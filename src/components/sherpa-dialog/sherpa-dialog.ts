/**
 * sherpa-dialog — a modal surface backed by the native <dialog> element.
 *
 * The native `close` event does not cross the shadow boundary; it is reported as `dialog-close`.
 * `prompt()` and `confirm()` ask the question its own markup holds, and resolve its answer.
 *
 * @prop {boolean} open — whether the dialog is open (delegates to <dialog>)
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { DialogSurface } from '../../core/ui/disclosure.js';

export class SherpaDialog extends SherpaElement {
  static override css = new URL('./sherpa-dialog.css', import.meta.url);
  static override html = new URL('./sherpa-dialog.html', import.meta.url);
  // Opened and shut from markup: `<sherpa-button commandfor="id" command="--show">`.
  static override commands = { '--show': 'show', '--hide': 'hide' };
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
    // A non-modal <dialog> gets no ESC from the browser. On the host, so it
    // stays through a move: never removed. TRAP T-abort-controller-per-connect
    this.addEventListener('keydown', this.#onKeydown);
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

  /**
   * Ask for ONE value. Its first field shows `value`; its LAST footer button
   * answers with what the field holds, and any other button, or Escape, with
   * null. An empty answer keeps it open. TRAP T-a-dialog-answers-its-question
   */
  prompt(value = ''): Promise<string | null> {
    const field = this.querySelector<HTMLElement & { value: string }>('sherpa-input-text, input, textarea');
    if (field) field.value = value;
    const asked = this.#ask<string | null>(null, (done, signal) => {
      const commit = (): void => {
        const said = String(field?.value ?? '').trim();
        if (said) done(said);
        else field?.focus();
      };
      field?.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); }, { signal });
      return commit;
    });
    field?.focus();
    return asked;
  }

  /**
   * Ask yes or no. `words` go in its first paragraph and `action` on its LAST
   * footer button, critical when the ACTION is; what is not given stays as the
   * markup wrote it. True for the action, false for anything else.
   */
  confirm(ask: { heading?: string; words?: string; action?: string; critical?: boolean } = {}): Promise<boolean> {
    const action = this.#buttons().at(-1);
    if (ask.heading !== undefined) this.set('data-heading', ask.heading);
    const words = this.querySelector(':scope > p');
    if (words && ask.words !== undefined) words.textContent = ask.words;
    if (action && ask.action !== undefined) action.textContent = ask.action;
    if (action && ask.critical !== undefined) {
      if (ask.critical) action.dataset['status'] = 'critical';
      else delete action.dataset['status'];
    }
    return this.#ask(false, (done) => () => done(true));
  }

  /** Answers the question open now with its "no". */
  #settle: (() => void) | null = null;

  /** Its footer's buttons, in order. */
  #buttons(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>(':scope > [slot="footer"] sherpa-button, :scope > [slot="footer"] button')];
  }

  /** Open it on one question: the last button commits, anything else is `no`.
   *  A second question answers the first with its `no`. */
  #ask<T>(no: T, wire: (done: (value: T) => void, signal: AbortSignal) => () => void): Promise<T> {
    this.#settle?.();
    const stop = new AbortController();
    return new Promise<T>((resolve) => {
      const done = (value: T): void => {
        stop.abort();
        this.#settle = null;
        // Shut first: what the answer starts must not run under an open dialog.
        if (this.open) this.hide();
        resolve(value);
      };
      this.#settle = () => done(no);
      const commit = wire(done, stop.signal);
      const buttons = this.#buttons();
      // `click`, not `button-click`: a press on the host is a press too.
      buttons.at(-1)?.addEventListener('click', commit, { signal: stop.signal });
      for (const button of buttons.slice(0, -1)) button.addEventListener('click', () => done(no), { signal: stop.signal });
      this.addEventListener('dialog-close', () => done(no), { signal: stop.signal });
      this.show();
    });
  }

  /** Escape closes a non-modal dialog; a modal one closes itself. */
  #onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || this.#modal || !this.open) return;
    event.preventDefault();
    this.hide();
  };
}

define('sherpa-dialog', SherpaDialog);
