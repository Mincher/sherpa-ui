/**
 * sherpa-overlay-panel — a NON-modal floating panel on native <dialog>.
 *
 * `dialog.show()`, never `showModal()`: no backdrop, no focus trap, no
 * ESC-to-close, and the page behind stays interactive. Figma "Overlay Panel"
 * (node 1003:33705).
 *
 * @prop {boolean} open — whether the panel is open (delegates to <dialog>)
 */
import { SherpaElement } from '../../core/sherpa-element.js';
// Side-effect imports: these elements must be defined before the template stamps them.
import '../sherpa-container-header/sherpa-container-header.js';
import '../sherpa-container-footer/sherpa-container-footer.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaOverlayPanel extends SherpaElement {
  static override css = new URL('./sherpa-overlay-panel.css', import.meta.url);
  static override html = new URL('./sherpa-overlay-panel.html', import.meta.url);
  // Title and icon are mirrored onto the composed header, not written here.
  static override observed = ['data-heading', 'data-icon', 'data-collapsed', 'data-collapsible', 'data-dismissible', 'open'];

  #dialog(): HTMLDialogElement | null {
    return this.$<HTMLDialogElement>('.root');
  }

  override onRender(): void {
    const dialog = this.#dialog();
    if (!dialog) return;
    this.#syncHeader();
    if (this.hasAttribute('open')) dialog.show();
    dialog.addEventListener('close', this.#onClose);
    // The header owns collapse and close; re-emit under the panel's own names.
    this.$('.header')?.addEventListener('header-collapse', this.#onCollapse);
    this.$('.header')?.addEventListener('header-dismiss', this.#onCloseClick);
    // `button-click`, not `click` — a disabled sherpa-button still gets raw clicks.
    this.$('.expand')?.addEventListener('button-click', this.#onExpand);
    this.$('.external')?.addEventListener('button-click', this.#onExternal);
  }

  override onChange(name: string): void {
    if (name !== 'open') this.#syncHeader();
    if (name === 'open') {
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

  /** Mirror the panel's attributes onto the composed header, through its public API. */
  #syncHeader(): void {
    const header = this.$('.header');
    if (!header) return;
    // A straight forward — same names both sides, never a rename in flight.
    for (const name of ['data-heading', 'data-icon', 'data-collapsed', 'data-collapsible', 'data-dismissible'] as const) {
      const value = this.getAttribute(name);
      if (value == null) header.removeAttribute(name);
      else header.setAttribute(name, value);
    }
  }

  #onClose = (): void => {
    this.toggleAttribute('open', false);
    this.emit('close', {});
  };

  #onCloseClick = (): void => {
    this.close();
  };

  #onCollapse = (): void => {
    const collapsed = !this.hasAttribute('data-collapsed');
    this.toggleAttribute('data-collapsed', collapsed);
    this.emit('panel-collapse', { collapsed });
  };

  #onExpand = (): void => {
    this.emit('panel-expand', {});
  };

  #onExternal = (): void => {
    this.emit('panel-external', {});
  };
}

customElements.define('sherpa-overlay-panel', SherpaOverlayPanel);
