/**
 * sherpa-overlay-panel — a NON-modal panel on native <dialog>: on the right edge, fixed in a
 * panel area of the shell, or floating.
 *
 * `dialog.show()`, never `showModal()`: no backdrop, no focus trap, no
 * ESC-to-close, and the page behind stays interactive.
 *
 * @prop {boolean} open — whether the panel is open (delegates to <dialog>)
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { DialogSurface } from '../../core/ui/disclosure.js';
import { resizeByEdge } from '../../core/ui/edge-resize.js';
import { FLOAT_ATTRS, FloatBox, roomOf } from '../../core/ui/float-box.js';
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

/** The group's buttons, in order. */
const GROUP = ['minimise', 'float', 'pop', 'expand', 'external'] as const;

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
    // The body's own padding: `none` for content that fills it (a list). TRAP T-a-node-list-is-a-panels-content
    'data-padding': { type: 'enum', kind: 'style', values: ['none'] },
    'data-icon': { type: 'string', kind: 'content' },
    'data-collapsed': { type: 'boolean', kind: 'style' },
    'data-maximised': { type: 'boolean', kind: 'style' },
    'data-collapsible': { type: 'boolean', kind: 'style' },
    'data-dismissible': { type: 'boolean', kind: 'style' },
    'data-poppable': { type: 'boolean', kind: 'style' },
    // A fixed panel, in a panel area of the app shell: `start`, else the end. TRAP T-a-panel-pops-into-the-end-area
    'data-fixed': { type: 'string', kind: 'behaviour' },
    'data-floatable': { type: 'boolean', kind: 'style' },
    // Shrunk to a tab on its area's edge; pressed, it opens as it was. TRAP T-a-minimised-panel-is-a-tab
    'data-minimisable': { type: 'boolean', kind: 'style' },
    // Docked over the content, not in its room (a panel slotted in a layout; a window panel says it by no `data-fixed`).
    'data-overlay': { type: 'boolean', kind: 'behaviour' },
    // A tab opens its panel as a docked overlay while the pointer is on it. TRAP T-a-panel-peeks-from-its-tab
    'data-hover-open': { type: 'boolean', kind: 'style' },
    'data-minimised': { type: 'boolean', kind: 'behaviour' },
    // Written by the area it docks in: the one panel in front of several. TRAP T-an-area-with-two-panels-is-tabbed
    'data-current': { type: 'boolean', kind: 'style' },
    // Something changed while it was a tab: the tab is active and wears a mark.
    'data-updated': { type: 'boolean', kind: 'style' },
    // Lifted off its edge or its area, anywhere in the window. TRAP T-a-floating-panel-is-a-state
    'data-floating': { type: 'boolean', kind: 'behaviour' },
    'data-x': { type: 'number', kind: 'behaviour' },
    'data-y': { type: 'number', kind: 'behaviour' },
    'data-width': { type: 'number', kind: 'behaviour' },
    'data-height': { type: 'number', kind: 'behaviour' },
  } as const;
  static override observed = ['open', 'data-fixed', 'data-x', 'data-y', 'data-width', 'data-height'];

  /** The panels open now. They share the right edge, so opening one shuts the
   *  rest. TRAP T-one-overlay-panel-at-a-time */
  static #shown = new Set<SherpaOverlayPanel>();

  /** The native dialog the panel draws in, NON-modal. */
  #surface = new DialogSurface(this, () => this.$<HTMLDialogElement>('.root'), {
    open: (dialog) => {
      this.#place();
      if (!this.#home && !this.#slotted() && !this.hasAttribute('data-floating')) this.#takeTheEdge();
      // Opened floating, it comes to the front. TRAP T-a-pressed-panel-comes-to-the-front
      if (this.hasAttribute('data-floating')) this.#floatBox.raise();
      dialog.show();
      // The CONTAINER takes the focus, not its first control (the grip, in Chromium); Tab goes on to that.
      dialog.focus({ preventScroll: true });
      // A focusable separator must state its value: the width it is drawn at.
      this.$('.resize')?.setAttribute('aria-valuenow', String(Math.round(dialog.getBoundingClientRect().width)));
    },
    closed: () => {
      SherpaOverlayPanel.#shown.delete(this);
      const reason = this.#why;
      this.#why = 'reader';
      this.emit('panel-close', { reason });
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
    this.$('.minimise')?.addEventListener('button-click', this.#onMinimise);
    this.$('.tab-open')?.addEventListener('click', this.#onMinimise);
    // The pointer on the tab peeks the panel open and hides the tab; the pointer leaving the PANEL shuts it to the tab again.
    this.$('.tab')?.addEventListener('pointerenter', this.#onPeek);
    this.#floatBox.wire(this.$('.header'), this.$('.grip'), this.$('.corner'));
    this.#floatBox.draw();
    this.#syncGroup();
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
    SherpaOverlayPanel.#stack();
  }

  override onChange(name: string): void {
    if (name === 'open') {
      this.#surface.follow();
      SherpaOverlayPanel.#stack();
    } else if (name === 'data-fixed') this.#place();
    else if (name === 'data-minimised') this.#minimise();
    else if (name === 'data-overlay') this.#place();
    else if (name === 'data-floating') this.#float();
    else if (FLOAT_ATTRS.includes(name)) this.#floatBox.draw();
    else if (name !== 'data-maximised') {
      this.#syncHeader();
      // A new title while it is a tab is news. TRAP T-a-minimised-panel-is-a-tab
      if (name === 'data-heading') this.notify();
    }
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

  /** Say something changed: as a tab it turns active and wears a mark, until it is opened. */
  notify(): void {
    if (this.hasAttribute('data-minimised') && this.open) this.set('data-updated', true);
  }

  /** Tabs of the open minimised panels stack down the edge, in the order they were shrunk: one stack
   *  to a window, one to each layout a panel is slotted in. */
  static #stack(): void {
    const indexes = new Map<Element | null, number>();
    // The tabs stand under the header: where the shell's panel areas begin.
    const top = document.querySelector('sherpa-app-shell')?.shadowRoot?.querySelector('sherpa-layout-panels')?.getBoundingClientRect().top ?? 0;
    for (const panel of document.querySelectorAll<SherpaOverlayPanel>('sherpa-overlay-panel[data-minimised][open]')) {
      const room = panel.#slotted() ? panel.parentElement : null;
      const index = indexes.get(room) ?? 0;
      indexes.set(room, index + 1);
      panel.$<HTMLElement>('.tab')?.style.setProperty('--_tab-index', String(index));
      panel.$<HTMLElement>('.tab')?.style.setProperty('--_tab-top', `${Math.round(top)}px`);
    }
  }

  /** Why it is shutting: the reader's own choice, unless the page or a lost width says so. */
  #why: 'reader' | 'width' | 'page' = 'reader';

  /** Close it, and say why: `panel-close` reports it. */
  hide(reason: 'reader' | 'width' | 'page' = 'reader'): void {
    this.#why = reason;
    this.#surface.hide();
  }

  /** `hide()`, in the native <dialog>'s spelling. */
  close(): void {
    this.hide();
  }

  /** Where the panel sat before it popped in; null while it is out of the area. */
  #home: { parent: ParentNode; before: ChildNode | null } | null = null;

  /** The area it pops into: the one `data-fixed` last named, so Pop in goes back to it. */
  #dock: 'start' | 'end' = 'end';

  /** The area `data-fixed` names: `start`, else the end. */
  #side(): 'start' | 'end' {
    return this.getAttribute('data-fixed') === 'start' ? 'start' : 'end';
  }

  /** Is it slotted into a canvas's or a panel area's own slot: docked there by its markup, with no
   *  shell to pop into? TRAP T-a-panel-slotted-in-a-layout-is-docked-there */
  #slotted(): 'start' | 'end' | null {
    const host = this.parentElement;
    if (!host || (host.localName !== 'sherpa-layout-canvas' && host.localName !== 'sherpa-layout-panels')) return null;
    if (this.slot === 'panel' || this.slot === 'panel-start') return 'start';
    return this.slot === 'panel-end' ? 'end' : null;
  }

  /** Take the right edge: the other panels there shut. TRAP T-one-overlay-panel-at-a-time */
  #takeTheEdge(): void {
    // …but never one that HOLDS this one: a panel opened inside a panel sits over it. TODO 555
    for (const other of SherpaOverlayPanel.#shown) if (other !== this && !other.contains(this)) other.hide();
    SherpaOverlayPanel.#shown.add(this);
  }

  /** The shell whose area can take the panel: none, no room, or the host's own panel there says no. */
  #area(): Element | null {
    const shell = document.querySelector('sherpa-app-shell');
    if (!shell || shell.hasAttribute('data-no-room')) return null;
    const held = shell.querySelector(`:scope > [slot="panel-${this.#dock}"]`);
    return held && !(held instanceof SherpaOverlayPanel) ? null : shell;
  }

  /** Where the panel areas begin, in px: under the app header. Zero with no shell, or in a layout. */
  #top(): number {
    if (this.#slotted()) return 0;
    return Math.round(document.querySelector('sherpa-app-shell')?.shadowRoot?.querySelector('sherpa-layout-panels')?.getBoundingClientRect().top ?? 0);
  }

  /** Put the panel where `data-fixed` and the room say. TRAP T-a-panel-pops-into-the-end-area */
  #place = (): void => {
    if (!this.isConnected) return;
    // A panel on the window's edge, maximised or floating, stays under the header. TRAP T-a-panel-stays-under-the-app-header
    this.style.setProperty('--_top', `${this.#top()}px`);
    const floating = this.hasAttribute('data-floating');
    const minimised = this.hasAttribute('data-minimised');
    // Slotted into a layout: docked there by its slot, and floating or a tab in that layout's room.
    const layout = this.#slotted();
    this.toggleState('in-layout', !!layout);
    if (layout) {
      this.#dock = layout;
      this.toggleState('no-area', false);
      this.toggleState('tab-start', layout === 'start');
      const overlay = this.hasAttribute('data-overlay');
      this.toggleState('in-area', !floating && !minimised && !overlay);
      // Docked over the view, as an overlay, or peeking from its tab: the area has given its room back.
      this.toggleState('overlaid', ((overlay && !minimised) || this.hasState('peeking')) && !floating);
      this.toggleState('floating', floating);
      this.#syncPop();
      this.#floatBox.floated(floating);
      SherpaOverlayPanel.#shown.delete(this);
      return;
    }
    if (this.hasAttribute('data-fixed')) this.#dock = this.#side();
    const shell = this.#area();
    this.toggleState('no-area', !shell);
    this.toggleState('tab-start', this.#dock === 'start');
    // In the other area: out first. TRAP T-a-panel-pops-into-the-end-area
    if (this.#home && this.slot !== `panel-${this.#dock}`) this.#popOut();
    // Floating, a fixed panel leaves its area, as Pop out does: the area gives its room back.
    if (shell && this.hasAttribute('data-fixed') && !floating && !minimised) this.#popIn(shell);
    else this.#popOut();
    this.toggleState('in-area', !!this.#home);
    this.toggleState('floating', floating);
    this.#syncPop();
    this.#syncGroup();
    this.#floatBox.floated(floating);
    // …and leaves the right edge, as a fixed one does. TRAP T-one-overlay-panel-at-a-time
    if (floating || minimised) SherpaOverlayPanel.#shown.delete(this);
  };

  /** Shrink to a tab, or open as it was: the area gives its room back and takes it again. */
  #minimise(): void {
    const minimised = this.hasAttribute('data-minimised');
    // Opened for good (or shut): no longer a peek.
    if (!minimised && this.hasState('peeking')) this.#peek(false);
    this.toggleState('minimised', minimised);
    this.set('data-updated', false);
    this.#place();
    SherpaOverlayPanel.#stack();
    if (minimised) return;
    if (this.hasAttribute('data-floating')) this.#floatBox.raise();
    else if (!this.#home && !this.#slotted() && this.open) this.#takeTheEdge();
  }

  /** Float, or dock back where it came from: the right edge, or the fixed area. */
  #float(): void {
    const floating = this.hasAttribute('data-floating');
    if (floating) this.#lift();
    this.#place();
    if (!floating && !this.#home && !this.#slotted() && this.open && !this.hasAttribute('data-minimised')) this.#takeTheEdge();
  }

  /** Floating, in the window: its box, moved by the header bar and resized by the corner. TRAP T-a-floating-panel-is-a-state */
  readonly #floatBox: FloatBox = new FloatBox({
    el: this,
    box: () => this.$<HTMLElement>('.root'),
    // The window, or the layout it is slotted in.
    room: () => this.#slotted() ? roomOf(this) : ({ x: 0, y: this.#top(), width: document.documentElement.clientWidth, height: document.documentElement.clientHeight - this.#top() }),
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

  /** Into its area, with the place it left noted. The panels there share it, a tab each. TRAP T-an-area-with-two-panels-is-tabbed */
  #popIn(shell: Element): void {
    const parent = this.parentNode;
    if (this.#home || !parent) return;
    const slot = `panel-${this.#dock}`;
    SherpaOverlayPanel.#shown.delete(this);
    this.#home = { parent, before: this.nextSibling };
    this.slot = slot;
    moveInto(shell, this, null);
  }

  /** Back to the place it left, or the page's end if that has gone. */
  #popOut(): void {
    if (!this.#home) return;
    const { parent, before } = this.#home;
    this.#home = null;
    this.removeAttribute('slot');
    this.removeAttribute('data-current');
    const back = parent.isConnected ? parent : document.body;
    moveInto(back, this, before?.parentNode === back ? before : null);
    if (this.open && !this.hasAttribute('data-floating') && !this.hasAttribute('data-minimised')) this.#takeTheEdge();
  }

  /** The buttons of the one group, in order: the first and the last that show wear the group's ends, which
   *  :first-child and :last-child give a button that is hidden. TRAP T-a-minimised-panel-is-a-tab */
  #syncGroup(): void {
    // The same rules the CSS hides them by, read from the host: a computed style is not drawn yet at the first render.
    const has = (attr: string): boolean => this.hasAttribute(attr);
    const maximised = has('data-maximised');
    const visible: Record<(typeof GROUP)[number], boolean> = {
      minimise: has('data-minimisable') && !maximised,
      float: has('data-floatable') && !maximised,
      pop: has('data-poppable') && !maximised && !this.hasState('no-area') && !this.hasState('floating'),
      expand: has('data-expandable') && !this.hasState('in-area'),
      external: has('data-external'),
    };
    const shown = GROUP.filter((name) => visible[name]);
    for (const name of GROUP) {
      this.toggleState(`first-${name}`, shown[0] === name);
      this.toggleState(`last-${name}`, shown.at(-1) === name);
    }
  }

  /** Mirror the panel's attributes onto the composed header. */
  #syncHeader(): void {
    const header = this.$('.header');
    const title = this.$('.tab-title');
    if (title) title.textContent = this.getAttribute('data-heading') ?? '';
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
    this.#syncGroup();
    this.emit('panel-expand', { maximised });
  };

  /** Pop in, to the area it last left, or out; and report it: a press is the reader's choice, a lost room is not. */
  #onPop = (): void => {
    const side = this.#dock;
    // Slotted in a layout, it pops between FIXED (its area's room) and an OVERLAY on the content; on the window, in and out of the shell's area.
    if (this.#slotted()) {
      const fixed = this.hasAttribute('data-overlay');
      this.set('data-overlay', !fixed);
      this.emit('panel-pop', { fixed, side });
      return;
    }
    const fixed = !this.hasAttribute('data-fixed');
    this.set('data-fixed', fixed && (side === 'start' ? 'start' : true));
    this.emit('panel-pop', { fixed, side });
  };

  /** The Pop button says what a press does next: Pop in to the fixed state, or Pop out to the overlay. */
  #syncPop(): void {
    const fixed = this.#slotted() ? !this.hasAttribute('data-overlay') : this.hasAttribute('data-fixed');
    const pop = this.$('.pop');
    pop?.setAttribute('data-icon-start', fixed ? 'monitor-w-floating-window' : 'sidebar-flip');
    pop?.setAttribute('aria-label', fixed ? 'Pop out' : 'Pop in');
  }

  /** The pointer is on the tab: open the panel as a docked overlay, where the setting says. The tab is hidden while it shows. */
  #onPeek = (event: Event): void => {
    if (!this.hasAttribute('data-hover-open') || !this.hasAttribute('data-minimised') || !this.open) return;
    this.#peek(true);
    // The panel opens where the tab stood, so the pointer is on it; if it is not, there is nothing to leave from.
    const { clientX: x, clientY: y } = event as PointerEvent;
    requestAnimationFrame(() => {
      const box = this.$('.root')?.getBoundingClientRect();
      if (this.hasState('peeking') && box && (x < box.left || x > box.right || y < box.top || y > box.bottom)) this.#peek(false);
    });
  };

  /** Where the pointer was while the peek has run, and what hears it move. */
  #peekEnds: AbortController | undefined;

  /** The pointer moved while it peeks: out of the panel is back to the tab at once. A drag that began on it (its edge) is not a leaving. */
  #onPeekMove = (event: Event): void => {
    const { clientX: x, clientY: y, buttons } = event as PointerEvent;
    const box = this.$('.root')?.getBoundingClientRect();
    if (!buttons && box && (x < box.left || x > box.right || y < box.top || y > box.bottom)) this.#peek(false);
  };

  /** Show or shut the peek, and the Minimise button's words with it: while it peeks, a press keeps it open. */
  #peek(on: boolean): void {
    this.toggleState('peeking', on);
    this.#peekEnds?.abort();
    this.#peekEnds = undefined;
    if (on) {
      this.#peekEnds = new AbortController();
      this.on(document, 'pointermove', this.#onPeekMove, { while: this.#peekEnds.signal });
    }
    if (this.#slotted()) this.toggleState('overlaid', (on || (this.hasAttribute('data-overlay') && !this.hasAttribute('data-minimised'))) && !this.hasAttribute('data-floating'));
    const minimise = this.$('.minimise');
    minimise?.setAttribute('data-icon-start', on ? 'plus' : 'minus');
    minimise?.setAttribute('aria-label', on ? 'Keep open' : 'Minimise to a tab');
  }

  /** Float, or dock, and report it. TRAP T-a-floating-panel-is-a-state */
  #onFloat = (): void => {
    const floating = !this.hasAttribute('data-floating');
    this.set('data-floating', floating);
    this.emit('panel-float', { floating });
  };

  /** Minimise to a tab, or open the tab; and report it. TRAP T-a-minimised-panel-is-a-tab */
  #onMinimise = (): void => this.minimise();

  /** Is it a tab now? */
  get minimised(): boolean {
    return this.hasAttribute('data-minimised');
  }

  /** The side of the window it docks on: the area it sits in, or last sat in. */
  get side(): 'start' | 'end' {
    return this.#slotted() ?? this.#dock;
  }

  /** Has it a tab: on the edge, or in the row of an area that holds several open panels? */
  get tabbed(): boolean {
    if (this.minimised) return true;
    if (!this.#home && !this.#slotted()) return false;
    const mates = this.parentElement?.querySelectorAll<SherpaOverlayPanel>(`:scope > [slot="${this.slot}"]`) ?? [];
    return [...mates].filter((m) => m.open).length > 1;
  }

  /** Bring it to the front of the panels docked beside it in its area: the area hears it. TRAP T-an-area-with-two-panels-is-tabbed */
  front(): void {
    this.emit('panel-front');
  }

  /** Is it open, for the panel keys? */
  get shown(): boolean {
    return this.open;
  }

  /** Shrink to a tab (`on`), or open from it; with no word, the other of the two. The keys and the buttons come here. */
  minimise(on = !this.minimised): void {
    const minimised = on;
    if (minimised === this.minimised) return;
    // Docked with others in its area, one minimises them all. Floating, it is its own. TRAP T-an-area-with-two-panels-is-tabbed
    if (minimised && (this.#home || this.#slotted())) {
      const mates = this.parentElement?.querySelectorAll<SherpaOverlayPanel>(`:scope > [slot="${this.slot}"]`) ?? [];
      for (const mate of mates) {
        if (mate === this || !(mate instanceof SherpaOverlayPanel) || mate.hasAttribute('data-minimised')) continue;
        mate.set('data-minimised', true);
        mate.emit('panel-minimise', { minimised: true });
      }
    }
    this.set('data-minimised', minimised);
    this.emit('panel-minimise', { minimised });
  };

  /** The open-elsewhere button — the host decides where. */
  #onExternal = (): void => {
    this.emit('panel-external');
  };
}

define('sherpa-overlay-panel', SherpaOverlayPanel);
