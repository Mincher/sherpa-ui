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

  /** The panels open now. They share the right edge, so opening one shuts the
   *  rest. TRAP T-one-overlay-panel-at-a-time */
  static #shown = new Set<SherpaOverlayPanel>();

  /** The native dialog the panel draws in, NON-modal. */
  #surface = new DialogSurface(this, () => this.$<HTMLDialogElement>('.root'), {
    open: (dialog) => {
      for (const other of SherpaOverlayPanel.#shown) if (other !== this) other.hide();
      SherpaOverlayPanel.#shown.add(this);
      dialog.show();
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
    const edge = this.$<HTMLElement>('.resize');
    edge?.addEventListener('pointerdown', this.#onEdgeDown);
    edge?.addEventListener('keydown', this.#onEdgeKey);
  }

  /** How far one arrow key moves the left edge. */
  static readonly RESIZE_STEP = 16;

  /** Set the width, as the CSS clamps it, and report it. */
  #resizeTo(px: number, report: boolean): void {
    this.style.setProperty('--_width', `${Math.round(px)}px`);
    const root = this.$<HTMLElement>('.root');
    const width = Math.round(root?.getBoundingClientRect().width ?? px);
    // The CSS clamp is the truth: write back what it drew, so a key moves from there.
    this.style.setProperty('--_width', `${width}px`);
    this.$('.resize')?.setAttribute('aria-valuenow', String(width));
    if (report) this.emit('panel-resize', { width });
  }

  /** Drag the left edge: it moves as far as the pointer does, from where it was
   *  grabbed. TRAP T-an-overlay-panel-resizes-from-its-left-edge */
  #onEdgeDown = (event: PointerEvent): void => {
    const edge = event.currentTarget as HTMLElement;
    const start = this.$<HTMLElement>('.root')?.getBoundingClientRect().width ?? 0;
    const from = event.clientX;
    edge.setPointerCapture(event.pointerId);
    event.preventDefault();
    const move = (e: PointerEvent): void => this.#resizeTo(start + from - e.clientX, false);
    const up = (e: PointerEvent): void => {
      edge.removeEventListener('pointermove', move);
      edge.removeEventListener('pointerup', up);
      this.#resizeTo(start + from - e.clientX, true);
    };
    edge.addEventListener('pointermove', move);
    edge.addEventListener('pointerup', up);
  };

  /** ArrowLeft widens, ArrowRight narrows — the edge moves the way the key points. */
  #onEdgeKey = (event: KeyboardEvent): void => {
    const step = { ArrowLeft: 1, ArrowRight: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const now = this.$<HTMLElement>('.root')?.getBoundingClientRect().width ?? 0;
    this.#resizeTo(now + step * SherpaOverlayPanel.RESIZE_STEP, true);
  };

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
