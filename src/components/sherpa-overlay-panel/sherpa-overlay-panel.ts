/**
 * sherpa-overlay-panel — a NON-modal panel on native <dialog>: on the right edge, fixed in the
 * shell's end area, or floating.
 *
 * `dialog.show()`, never `showModal()`: no backdrop, no focus trap, no
 * ESC-to-close, and the page behind stays interactive.
 *
 * @prop {boolean} open — whether the panel is open (delegates to <dialog>)
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { DialogSurface } from '../../core/ui/disclosure.js';
import { resizeByEdge } from '../../core/ui/edge-resize.js';
import { FLOAT_ATTRS, FloatBox } from '../../core/ui/float-box.js';
// Defined before the template stamps them.
import '../sherpa-container-header/sherpa-container-header.js';
import '../sherpa-container-footer/sherpa-container-footer.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-group/sherpa-group.js';

/** Move a node and keep its focus. A browser with no `moveBefore` drops it on the way. */
function moveInto(parent: Node, node: ChildNode, before: ChildNode | null): void {
  if ('moveBefore' in parent) {
    (parent as ParentNode).moveBefore(node, before);
    return;
  }
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  parent.insertBefore(node, before);
  // After the slotchange: the shell's area is not drawn yet, and a hidden box takes no focus.
  if (active instanceof HTMLElement) queueMicrotask(() => (active as HTMLElement).focus());
}

export class SherpaOverlayPanel extends SherpaElement {
  // The floating box's sheet, shared with the node panel. TRAP T-a-floating-panel-is-a-state
  static override css = [new URL('../../core/sherpa-float.css', import.meta.url), new URL('./sherpa-overlay-panel.css', import.meta.url)];
  static override html = new URL('./sherpa-overlay-panel.html', import.meta.url);
  // Opened and shut from markup: `<sherpa-button commandfor="id" command="--show">`.
  static override commands = { '--show': 'show', '--hide': 'hide' };

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-expandable': { type: 'boolean', kind: 'style' },
    'data-external': { type: 'boolean', kind: 'style' },
    'data-heading': { type: 'string', kind: 'content' },
    'data-icon': { type: 'string', kind: 'content' },
    'data-collapsed': { type: 'boolean', kind: 'style' },
    'data-maximised': { type: 'boolean', kind: 'style' },
    'data-collapsible': { type: 'boolean', kind: 'style' },
    'data-dismissible': { type: 'boolean', kind: 'style' },
    'data-poppable': { type: 'boolean', kind: 'style' },
    // A fixed panel, in the app shell's end area. TRAP T-a-panel-pops-into-the-end-area
    'data-fixed': { type: 'boolean', kind: 'behaviour' },
    'data-floatable': { type: 'boolean', kind: 'style' },
    // Lifted off its edge or its area, anywhere in the window. TRAP T-a-floating-panel-is-a-state
    'data-floating': { type: 'boolean', kind: 'behaviour' },
    'data-x': { type: 'number', kind: 'behaviour' },
    'data-y': { type: 'number', kind: 'behaviour' },
    'data-width': { type: 'number', kind: 'behaviour' },
    'data-height': { type: 'number', kind: 'behaviour' },
  } as const;
  static override observed = ['open', 'data-x', 'data-y', 'data-width', 'data-height'];

  /** The panels open now. They share the right edge, so opening one shuts the
   *  rest. TRAP T-one-overlay-panel-at-a-time */
  static #shown = new Set<SherpaOverlayPanel>();

  /** The native dialog the panel draws in, NON-modal. */
  #surface = new DialogSurface(this, () => this.$<HTMLDialogElement>('.root'), {
    open: (dialog) => {
      this.#place();
      if (!this.#home && !this.hasAttribute('data-floating')) this.#takeTheEdge();
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
    this.$('.pop')?.addEventListener('button-click', this.#onPop);
    this.$('.float')?.addEventListener('button-click', this.#onFloat);
    this.#floatBox.wire(this.$('.header'), this.$('.grip'), this.$('.corner'));
    this.#floatBox.draw();
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
          // Its height too, as the corner's: one detail for one event.
          if (done) this.emit('panel-resize', { width, height: Math.round(this.$<HTMLElement>('.root')?.getBoundingClientRect().height ?? 0) });
        },
      });
    }
  }

  // Each connect: a move cancels what the last one listened to.
  override onConnect(): void {
    this.on(document, 'panel-room-change', this.#place);
    this.#place();
  }

  override onDisconnect(): void {
    SherpaOverlayPanel.#shown.delete(this);
  }

  override onChange(name: string): void {
    if (name === 'open') this.#surface.follow();
    else if (name === 'data-fixed') this.#place();
    else if (name === 'data-floating') this.#float();
    else if (FLOAT_ATTRS.includes(name)) this.#floatBox.draw();
    else if (name !== 'data-maximised') this.#syncHeader();
  }

  get open(): boolean {
    return this.#surface.open;
  }
  set open(value: boolean) {
    if (value) this.show();
    else this.hide();
  }

  /** Open it, non-modal (no backdrop, no focus trap). */
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

  /** Where the panel sat before it popped in; null while it is out of the area. */
  #home: { parent: ParentNode; before: ChildNode | null } | null = null;

  /** Take the right edge: the other panels there shut. TRAP T-one-overlay-panel-at-a-time */
  #takeTheEdge(): void {
    // …but never one that HOLDS this one: a panel opened inside a panel sits over it. TODO 555
    for (const other of SherpaOverlayPanel.#shown) if (other !== this && !other.contains(this)) other.hide();
    SherpaOverlayPanel.#shown.add(this);
  }

  /** The shell whose end area can take a panel: none, no room, or the host's own panel there says no. */
  #area(): Element | null {
    const shell = document.querySelector('sherpa-app-shell');
    if (!shell || shell.hasAttribute('data-no-room')) return null;
    const held = shell.querySelector(':scope > [slot="panel-end"]');
    return held && !(held instanceof SherpaOverlayPanel) ? null : shell;
  }

  /** Put the panel where `data-fixed` and the room say. TRAP T-a-panel-pops-into-the-end-area */
  #place = (): void => {
    if (!this.isConnected) return;
    const shell = this.#area();
    const floating = this.hasAttribute('data-floating');
    this.toggleState('no-area', !shell);
    // Floating, a fixed panel leaves its area, as Pop out does: the area gives its room back.
    if (shell && this.hasAttribute('data-fixed') && !floating) this.#popIn(shell);
    else this.#popOut();
    this.toggleState('in-area', !!this.#home);
    this.toggleState('floating', floating);
    // …and leaves the right edge, as a fixed one does. TRAP T-one-overlay-panel-at-a-time
    if (floating) SherpaOverlayPanel.#shown.delete(this);
  };

  /** Float, or dock back where it came from: the right edge, or the fixed area. */
  #float(): void {
    const floating = this.hasAttribute('data-floating');
    if (floating) this.#lift();
    this.#place();
    if (!floating && !this.#home && this.open) this.#takeTheEdge();
  }

  /** Floating, in the window: its box, moved by the header bar and resized by the corner. TRAP T-a-floating-panel-is-a-state */
  readonly #floatBox: FloatBox = new FloatBox({
    el: this,
    box: () => this.$<HTMLElement>('.root'),
    room: () => ({ x: 0, y: 0, width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }),
    free: () => this.hasAttribute('data-floating') && !this.hasAttribute('data-maximised'),
    set: (attr, value) => this.set(attr, value),
    num: (attr) => this.num(attr, NaN),
    toggleState: (name, on) => this.toggleState(name, on),
    moved: (at) => this.emit('panel-move', at),
    sized: (size) => this.emit('panel-resize', size),
  });

  /** The first float lifts it where it is drawn, 16px in on each side; a kept box stands. */
  #lift(): void {
    const drawn = this.$<HTMLElement>('.root')?.getBoundingClientRect();
    const inset = parseFloat(getComputedStyle(this).getPropertyValue('--sherpa-layout-grid-padding')) || 16;
    this.#floatBox.lift(drawn?.width ? drawn : this.#edgeBox(), inset);
  }

  /** Shut, it has no box: where it would draw on the right edge, by the CSS's own clamp. */
  #edgeBox(): { x: number; y: number; width: number; height: number } {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const asked = parseFloat(this.style.getPropertyValue('--_width')) || 40 * rem;
    const width = Math.min(Math.max(asked, Math.min(20 * rem, 0.92 * innerWidth)), 0.92 * innerWidth);
    return { x: innerWidth - width, y: 0, width, height: innerHeight };
  }

  /** Into the end area, with the place it left noted. One panel to an area. */
  #popIn(shell: Element): void {
    const parent = this.parentNode;
    if (this.#home || !parent) return;
    const held = shell.querySelector(':scope > [slot="panel-end"]');
    if (held !== this) held?.removeAttribute('data-fixed');
    SherpaOverlayPanel.#shown.delete(this);
    this.#home = { parent, before: this.nextSibling };
    this.slot = 'panel-end';
    moveInto(shell, this, null);
  }

  /** Back to the place it left, or the page's end if that has gone. */
  #popOut(): void {
    if (!this.#home) return;
    const { parent, before } = this.#home;
    this.#home = null;
    this.removeAttribute('slot');
    const back = parent.isConnected ? parent : document.body;
    moveInto(back, this, before?.parentNode === back ? before : null);
    if (this.open && !this.hasAttribute('data-floating')) this.#takeTheEdge();
  }

  /** Mirror the panel's attributes onto the composed header. */
  #syncHeader(): void {
    const header = this.$('.header');
    if (header) this.mirrorAttrs(header, ['data-heading', 'data-icon', 'data-collapsed', 'data-collapsible', 'data-dismissible']);
  }

  /** The close button. */
  #onCloseClick = (): void => {
    this.close();
  };

  /** Collapse or expand the panel, and report it. */
  #onCollapse = (): void => {
    const collapsed = !this.hasAttribute('data-collapsed');
    this.set('data-collapsed', collapsed);
    this.emit('panel-collapse', { collapsed });
  };

  /** The button says what a press does next: maximise, or back to a panel. */
  /** Maximise or minimise the panel, and report it. */
  #onExpand = (): void => {
    const maximised = !this.hasAttribute('data-maximised');
    this.set('data-maximised', maximised);
    this.emit('panel-expand', { maximised });
  };

  /** Pop in or out, and report it: a press is the reader's choice, a lost room is not. */
  #onPop = (): void => {
    const fixed = !this.hasAttribute('data-fixed');
    this.set('data-fixed', fixed);
    this.emit('panel-pop', { fixed });
  };

  /** Float, or dock, and report it. TRAP T-a-floating-panel-is-a-state */
  #onFloat = (): void => {
    const floating = !this.hasAttribute('data-floating');
    this.set('data-floating', floating);
    this.emit('panel-float', { floating });
  };

  /** The open-elsewhere button — the host decides where. */
  #onExternal = (): void => {
    this.emit('panel-external');
  };
}

define('sherpa-overlay-panel', SherpaOverlayPanel);
