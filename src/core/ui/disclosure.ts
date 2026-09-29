/**
 * disclosure.ts — a helper a component that opens over a native <dialog> may
 * IMPORT: its `open`, its verbs and its close report. Never a base class — a
 * component extends SherpaElement alone.
 *
 * Map:
 * - DialogSurface — A native <dialog> behind a host's `open`: its verbs, its attribute and its close, once.
 * - .open — Is it open?
 * - .show — Open it.
 * - .hide — Close it.
 * - .follow — Follow the host's `open` attribute.
 * - .listen — Hear the native close, however it closed.
 */

/** How a host opens its dialog, and what it says once the dialog has closed. */
interface SurfaceOptions {
  /** Open it — modal, or in place. */
  open(dialog: HTMLDialogElement): void;
  /** It closed, however it closed. */
  closed(): void;
}

/**
 * A native <dialog> behind a host's `open`: its verbs, its attribute and its
 * close, once — so two components that open cannot drift apart.
 * `hide()` is Sherpa's verb; a host keeps `close()` as its alias.
 * TRAP T-one-verb-proxies-to-the-native-one
 */
export class DialogSurface {
  /** The component whose `open` this is. */
  readonly #host: HTMLElement;
  /** Its native dialog, read when needed: it exists only once rendered. */
  readonly #dialog: () => HTMLDialogElement | null;
  /** How it opens, and what it says on close. */
  readonly #options: SurfaceOptions;

  constructor(host: HTMLElement, dialog: () => HTMLDialogElement | null, options: SurfaceOptions) {
    this.#host = host;
    this.#dialog = dialog;
    this.#options = options;
  }

  /** Is it open? The dialog's answer, or the attribute before it renders. */
  get open(): boolean {
    return this.#dialog()?.open ?? this.#host.hasAttribute('open');
  }

  /** Open it. The attribute FIRST: a closed host is display:none, and cannot take focus. */
  show(): void {
    this.#host.toggleAttribute('open', true);
    const dialog = this.#dialog();
    if (dialog && !dialog.open) this.#options.open(dialog);
  }

  /** Close it. */
  hide(): void {
    const dialog = this.#dialog();
    if (dialog?.open) dialog.close();
    this.#host.toggleAttribute('open', false);
  }

  /** Follow the host's `open` attribute. */
  follow(): void {
    if (this.#host.hasAttribute('open')) this.show();
    else this.hide();
  }

  /** Hear the native close, however it closed. */
  listen(): void {
    this.#dialog()?.addEventListener('close', () => {
      /* LATE. The native event is queued, so a dialog opened again in between
         is open when it lands, and writing `open` off shut it again.
         TRAP T-a-reopened-dialog-hears-a-late-close */
      if (this.#dialog()?.open) return;
      this.#host.toggleAttribute('open', false);
      this.#options.closed();
    });
  }
}
