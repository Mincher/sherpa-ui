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
import { resizeByEdge } from '../../core/ui/edge-resize.js';
// Defined before the template stamps them.
import '../sherpa-container-header/sherpa-container-header.js';
import '../sherpa-container-footer/sherpa-container-footer.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-group/sherpa-group.js';

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

  /** The panels open now. They share the right edge, so opening one shuts the
   *  rest. TRAP T-one-overlay-panel-at-a-time */
  static #shown = new Set<SherpaOverlayPanel>();

  /** The native dialog the panel draws in, NON-modal. */
  #surface = new DialogSurface(this, () => this.$<HTMLDialogElement>('.root'), {
    open: (dialog) => {
      for (const other of SherpaOverlayPanel.#shown) if (other !== this) other.hide();
      SherpaOverlayPanel.#shown.add(this);
      dialog.show();
      // A focusable separator must state its value: the width it is drawn at.
      this.$('.resize')?.setAttribute('aria-valuenow', String(Math.round(dialog.getBoundingClientRect().width)));
    },
    closed: () => {
      SherpaOverlayPanel.#shown.delete(this);
      this.emit('panel-close');
    },
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
    /* The LEFT edge: dragged, it moves as far as the pointer does, and
       ArrowLeft widens. TRAP T-an-overlay-panel-resizes-from-its-left-edge
       TRAP T-an-edge-resizes-its-box */
    const edge = this.$<HTMLElement>('.resize');
    const drawn = (): number => this.$<HTMLElement>('.root')?.getBoundingClientRect().width ?? 0;
    const rem = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    if (edge) {
      resizeByEdge(edge, {
        grows: -1,
        measure: drawn,
        // The CSS clamp: `clamp(min(20rem, 92vw), …, 92vw)`.
        min: () => Math.min(20 * rem(), 0.92 * innerWidth),
        max: () => 0.92 * innerWidth,
        apply: (px, done) => {
          this.style.setProperty('--_width', `${Math.round(px)}px`);
          // The CSS clamp is the truth: write back what it drew, so a key moves from there.
          const width = Math.round(drawn());
          this.style.setProperty('--_width', `${width}px`);
          if (done) this.emit('panel-resize', { width });
        },
      });
    }
  }

  override onDisconnect(): void {
    SherpaOverlayPanel.#shown.delete(this);
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
