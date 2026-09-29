/**
 * sherpa-overlay-panel — a NON-modal floating panel on native <dialog>.
 *
 * `dialog.show()`, never `showModal()`: no backdrop, no focus trap, no
 * ESC-to-close, and the page behind stays interactive.
 *
 * @prop {boolean} open — whether the panel is open (delegates to <dialog>)
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { DialogSurface } from '../../core/ui/disclosure.js';
// Defined before the template stamps them.
import '../sherpa-container-header/sherpa-container-header.js';
import '../sherpa-container-footer/sherpa-container-footer.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaOverlayPanel extends SherpaElement {
  static override css = new URL('./sherpa-overlay-panel.css', import.meta.url);
  static override html = new URL('./sherpa-overlay-panel.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-expandable': { type: 'boolean', kind: 'style' },
    'data-external': { type: 'boolean', kind: 'style' },
  } as const;
  static override observed = ['data-heading', 'data-icon', 'data-collapsed', 'data-collapsible', 'data-dismissible', 'open'];

  /** The native dialog the panel draws in, NON-modal. */
  #surface = new DialogSurface(this, () => this.$<HTMLDialogElement>('.root'), {
    open: (dialog) => dialog.show(),
    closed: () => this.emit('panel-close'),
  });

  override onRender(): void {
    this.#syncHeader();
    if (this.hasAttribute('open')) this.#surface.show();
    this.#surface.listen();
    this.$('.header')?.addEventListener('header-collapse', this.#onCollapse);
    this.$('.header')?.addEventListener('header-dismiss', this.#onCloseClick);
    // `button-click`, not `click` — a disabled sherpa-button still gets raw clicks.
    this.$('.expand')?.addEventListener('button-click', this.#onExpand);
    this.$('.external')?.addEventListener('button-click', this.#onExternal);
  }

  override onChange(name: string): void {
    if (name === 'open') this.#surface.follow();
    else this.#syncHeader();
  }

  get open(): boolean {
    return this.#surface.open;
  }
  set open(value: boolean) {
    if (value) this.show();
    else this.hide();
  }

  /** Open as a non-modal floating panel (no backdrop, no focus trap). */
  show(): void {
    this.#surface.show();
  }

  /** Close it. */
  hide(): void {
    this.#surface.hide();
  }

  /** `hide()`, in the native <dialog>'s spelling. */
  close(): void {
    this.hide();
  }

  /** Mirror the panel's attributes onto the composed header. */
  #syncHeader(): void {
    const header = this.$('.header');
    if (!header) return;
    for (const name of ['data-heading', 'data-icon', 'data-collapsed', 'data-collapsible', 'data-dismissible'] as const) {
      const value = this.getAttribute(name);
      if (value == null) header.removeAttribute(name);
      else header.setAttribute(name, value);
    }
  }

  /** The close button. */
  #onCloseClick = (): void => {
    this.close();
  };

  /** Collapse or expand the panel, and report it. */
  #onCollapse = (): void => {
    const collapsed = !this.hasAttribute('data-collapsed');
    this.toggleAttribute('data-collapsed', collapsed);
    this.emit('panel-collapse', { collapsed });
  };

  /** The expand button — full screen is the host's to do. */
  #onExpand = (): void => {
    this.emit('panel-expand');
  };

  /** The open-elsewhere button — the host decides where. */
  #onExternal = (): void => {
    this.emit('panel-external');
  };
}

customElements.define('sherpa-overlay-panel', SherpaOverlayPanel);
