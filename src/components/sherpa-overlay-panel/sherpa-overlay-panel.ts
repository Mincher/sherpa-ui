/**
 * sherpa-overlay-panel — a NON-modal panel on native <dialog>, in one of four MODES (`data-mode`): fixed in
 * a panel area, an overlay over the content, floating, or a tab on its area's edge. The AREA that holds it
 * writes the mode on every panel in it; a panel only ASKS (`panel-mode-change`).
 *
 * `dialog.show()`, never `showModal()`: no backdrop, no focus trap, no
 * ESC-to-close, and the page behind stays interactive.
 *
 * @prop {boolean} open — whether the panel is open (delegates to <dialog>)
 *
 * Map:
 * - PanelMode — The four modes of a panel.
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
import type { SherpaMenu } from '../sherpa-menu/sherpa-menu.js';

/** The four modes of a panel. Fixed, overlay and tab are of an area; floating is independent of it. */
export type PanelMode = 'fixed' | 'overlay' | 'floating' | 'tab';
const MODE_VALUES: readonly PanelMode[] = ['fixed', 'overlay', 'floating', 'tab'];
/** The hosts that dock a panel by its slot: a canvas, a panel area, the app shell. */
const HOSTS = ['sherpa-layout-canvas', 'sherpa-layout-panels', 'sherpa-app-shell'];

/** The two button groups, in order. */
const DOCKS = ['dock-overlay', 'dock-fixed', 'float'] as const;
const MODES = ['minimise', 'expand', 'external'] as const;
const GROUPS = ['custom', 'docks', 'modes', 'overflow', 'close'] as const;

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
    // A search row in the header, the header's full width: the panel owns the input and says `panel-search`. TRAP T-a-panel-owns-its-search-row
    'data-searchable': { type: 'boolean', kind: 'behaviour' },
    'data-search-placeholder': { type: 'string', kind: 'behaviour' },
    'data-icon': { type: 'string', kind: 'content' },
    'data-collapsed': { type: 'boolean', kind: 'style' },
    'data-maximised': { type: 'boolean', kind: 'style' },
    'data-collapsible': { type: 'boolean', kind: 'style' },
    'data-dismissible': { type: 'boolean', kind: 'style' },
    // The ONE orientation of a panel: the area it docks to, `start` or else `end`; overlaid out of its area it stays on that edge. TRAP T-an-overlaid-panel-keeps-its-side
    'data-side': { type: 'enum', kind: 'behaviour', values: ['start', 'end'] },
    // The ONE mode: fixed (flat in its area's room), overlay (over the content), floating (off its area, anywhere in its room) or tab
    // (on its area's edge). None is fixed in an area, an overlay on the window's edge where there is none. TRAP T-a-panel-has-four-modes
    'data-mode': { type: 'enum', kind: 'behaviour', values: ['fixed', 'overlay', 'floating', 'tab'] },
    'data-floatable': { type: 'boolean', kind: 'style' },
    // Shrunk to a tab on its area's edge; pressed, it opens as it was. TRAP T-a-minimised-panel-is-a-tab
    'data-minimisable': { type: 'boolean', kind: 'style' },
    // A tab opens its panel as a docked overlay while the pointer is on it. TRAP T-a-panel-peeks-from-its-tab
    'data-hover-open': { type: 'boolean', kind: 'style' },
    // Something changed while it was a tab: the tab is active and wears a mark.
    'data-updated': { type: 'boolean', kind: 'style' },
    'data-x': { type: 'number', kind: 'behaviour' },
    'data-y': { type: 'number', kind: 'behaviour' },
    'data-width': { type: 'number', kind: 'behaviour' },
    'data-height': { type: 'number', kind: 'behaviour' },
  } as const;
  static override observed = ['open', 'data-search-placeholder', 'data-side', 'data-mode', 'data-x', 'data-y', 'data-width', 'data-height'];

  /** The native dialog the panel draws in, NON-modal. */
  #surface = new DialogSurface(this, () => this.$<HTMLDialogElement>('.root'), {
    open: (dialog) => {
      this.#place();
      // Opened floating, it comes to the front. TRAP T-a-pressed-panel-comes-to-the-front
      if (this.#mode() === 'floating') this.#floatBox.raise();
      dialog.show();
      // The CONTAINER takes the focus, not its first control (the grip, in Chromium); Tab goes on to that.
      dialog.focus({ preventScroll: true });
      // A focusable separator must state its value: the width it is drawn at.
      this.$('.resize')?.setAttribute('aria-valuenow', String(Math.round(dialog.getBoundingClientRect().width)));
    },
    closed: () => {
      const reason = this.#why;
      this.#why = 'reader';
      this.emit('panel-close', { reason });
    },
  });

  override onRender(): void {
    this.#syncHeader();
    this.#syncSearch();
    this.#watchShown();
    if (this.hasAttribute('open')) this.#surface.show();
    this.#surface.listen();
    this.$('.header')?.addEventListener('header-collapse', this.#onCollapse);
    this.$('.header')?.addEventListener('header-dismiss', this.#onCloseClick);
    // `button-click`, not `click` — a disabled sherpa-button still gets raw clicks.
    this.$('.expand')?.addEventListener('button-click', this.#onExpand);
    this.$('.external')?.addEventListener('button-click', this.#onExternal);
    this.$('.dock-overlay')?.addEventListener('button-click', () => this.#onDock('overlay'));
    this.$('.dock-fixed')?.addEventListener('button-click', () => this.#onDock('fixed'));
    this.$('.float')?.addEventListener('button-click', this.#onFloat);
    this.$('.minimise')?.addEventListener('button-click', this.#onMinimiseButton);
    // A tap (or a click) on the tab shows its panel as a docked overlay, as a hover does; the docking button then docks it where it was.
    this.$('.tab-open')?.addEventListener('click', this.#onTab);
    // The pointer on the tab peeks the panel open and hides the tab; the pointer leaving the PANEL shuts it to the tab again.
    this.$('.tab')?.addEventListener('pointerenter', this.#onPeek);
    this.#floatBox.wire(this.$('.header'), this.$('.grip'), this.$('.corner'));
    this.#floatBox.draw();
    // Attributes put on it before this first render (a kept state, handed back as it connects) raised no change: read them now.
    this.#last = this.#mode();
    if (this.#last === 'fixed' || this.#last === 'overlay') this.#docked = this.#last;
    this.toggleState('minimised', this.#last === 'tab');
    this.#place();
    SherpaOverlayPanel.#stack();
    // At load the shell's areas have no box yet: stack again once they have one, so a tab starts at its area's corner.
    for (let i = 1; i <= 30; i++) setTimeout(() => SherpaOverlayPanel.#stack(), i * 50);
    this.#syncGroup();
    this.$('.fold')?.addEventListener('button-click', () => this.$<SherpaMenu>('.fold-menu')?.show?.(this.$('.fold') as HTMLElement));
    this.$('.fold-menu')?.addEventListener('menu-select', this.#onFoldPick);
    // The header narrows: a group folds into the ⋮ before the title is cut short. TRAP T-a-panel-folds-its-groups-into-the-more-menu
    let frame = 0;
    const watch = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; this.#fit(); });
    });
    watch.observe(this.$('.root') ?? this);
    this.signal.addEventListener('abort', () => watch.disconnect(), { once: true });
    /* The LEFT edge: dragged, it moves as far as the pointer does, and
       ArrowLeft widens. TRAP T-an-overlay-panel-resizes-from-its-left-edge
       TRAP T-an-edge-resizes-its-box */
    const edge = this.$<HTMLElement>('.resize');
    const drawn = (): number => this.$<HTMLElement>('.root')?.getBoundingClientRect().width ?? 0;
    const room = (): number => (this.#slotted() ? roomOf(this).width : innerWidth);
    const rem = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    if (edge) {
      resizeByEdge(edge, {
        // On the left edge, pulling out grows it; on the right edge (a panel docked at the start), pushing out does. TRAP T-an-overlay-panel-resizes-from-its-left-edge
        grows: () => (this.hasState('at-start') ? 1 : -1),
        measure: drawn,
        // The CSS clamp: `clamp(min(20rem, 92vw), …, 92vw)`.
        // Docked, no more than a third of its room.
        min: () => Math.min(20 * rem(), 0.33 * room()),
        max: () => 0.33 * room(),
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
    this.on(window, 'resize', () => SherpaOverlayPanel.#stack());
    this.#place();
  }

  override onDisconnect(): void {
    SherpaOverlayPanel.#stack();
  }

  override onChange(name: string): void {
    if (name === 'open') {
      this.#surface.follow();
      SherpaOverlayPanel.#stack();
    } else if (name === 'data-searchable' || name === 'data-search-placeholder') this.#syncSearch();
    else if (name === 'data-side') this.#place();
    else if (name === 'data-mode') this.#onMode();
    else if (FLOAT_ATTRS.includes(name)) this.#floatBox.draw();
    else if (name !== 'data-maximised') {
      this.#syncHeader();
      // A new title while it is a tab is news. TRAP T-a-minimised-panel-is-a-tab
      if (name === 'data-heading') this.notify();
    }
  }

  /** Which header slots show a control: a clone the content has `hidden` is none. TRAP T-a-panel-divides-only-between-shown-groups */
  #syncShown = (): void => {
    const shows = (...slots: string[]): boolean => slots.some((slot) => [...this.children].some((c) => c.getAttribute('slot') === slot && !c.hasAttribute('hidden')));
    this.toggleState('shows-actions', shows('actions'));
    this.toggleState('shows-end', shows('actions-end'));
    this.toggleState('shows-overflow', shows('overflow'));
    this.#syncGroup();
  };

  /** Follow its direct children, so a clone hidden or shown is read. */
  #watchShown(): void {
    const watch = new MutationObserver(() => { follow(); this.#syncShown(); });
    // A direct child's own `hidden` or `slot`, as children come.
    const follow = (): void => {
      watch.observe(this, { childList: true });
      for (const child of this.children) watch.observe(child, { attributes: true, attributeFilter: ['hidden', 'slot'] });
    };
    follow();
    this.#syncShown();
    this.signal.addEventListener('abort', () => watch.disconnect(), { once: true });
  }

  /** The search row, stamped the first time `data-searchable` shows it. */
  #syncSearch(): void {
    const input = this.stampOnce<HTMLElement & { value: string }>('template.search-tpl', this.hasAttribute('data-searchable'));
    if (!input) return;
    const said = this.getAttribute('data-search-placeholder') ?? 'Search';
    input.setAttribute('placeholder', said);
    input.setAttribute('aria-label', said);
    if (this.#searchWired.has(input)) return;
    this.#searchWired.add(input);
    for (const type of ['input', 'change']) input.addEventListener(type, this.#onSearch);
    input.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape' && input.value) { event.stopPropagation(); this.search = ''; }
    });
  }
  /** The search rows already heard. */
  #searchWired = new WeakSet<Element>();
  /** The text `panel-search` last said. */
  #searched = '';

  /** The row's text changed: say it, once per change. */
  #onSearch = (event: Event): void => {
    const value = (event.target as HTMLElement & { value?: string }).value ?? '';
    if (value === this.#searched) return;
    this.#searched = value;
    this.emit('panel-search', { value });
  };

  /** What the search row holds. Set, it types it and says `panel-search`. */
  get search(): string {
    return this.$<HTMLElement & { value: string }>('.search')?.value ?? '';
  }
  set search(value: string) {
    const input = this.$<HTMLElement & { value: string }>('.search');
    if (input) input.value = value;
    if (value !== this.#searched) { this.#searched = value; this.emit('panel-search', { value }); }
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
    if (this.#mode() === 'tab' && this.open) this.set('data-updated', true);
  }

  /** Tabs of the open minimised panels stack down the edge, in the order they were shrunk: one stack
   *  to a window, one to each layout a panel is slotted in. */
  static #stack(): void {
    // The tabs stand under the header: where the shell's panel areas begin.
    const layout = document.querySelector('sherpa-app-shell')?.shadowRoot?.querySelector('sherpa-layout-panels');
    const top = layout?.getBoundingClientRect().top ?? 0;
    // The shell's areas have no box until it has drawn: tabs wait, so none shows at the window's corner.
    const shell = document.querySelector('sherpa-app-shell');
    const ready = !shell || (!!layout && (top > 0 || shell.hasAttribute('data-no-header')));
    // One control group of tabs for each side of each room: a lone tab is solo, several are stitched by the group's positions.
    const groups = new Map<Element | null, Record<'start' | 'end', SherpaOverlayPanel[]>>();
    for (const panel of document.querySelectorAll<SherpaOverlayPanel>('sherpa-overlay-panel[data-mode="tab"][open]')) {
      const room = panel.#slotted() ? panel.parentElement : null;
      const sides = groups.get(room) ?? { start: [], end: [] };
      groups.set(room, sides);
      sides[panel.hasState('tab-start') ? 'start' : 'end'].push(panel);
    }
    for (const sides of groups.values()) {
      for (const group of Object.values(sides)) {
        group.forEach((panel, index) => {
          const tab = panel.$<HTMLElement>('.tab');
          tab?.style.setProperty('--_tab-index', String(index));
          tab?.style.setProperty('--_tab-top', `${Math.round(top)}px`);
          tab?.toggleAttribute('data-stacked', ready || panel.#hosted());
        });
      }
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

  /** The area it docks to: the one `data-side` names. */
  #dock: 'start' | 'end' = 'end';

  /** The area `data-side` names: `start`, else the end. The one orientation of a panel, in every host. */
  #side(): 'start' | 'end' {
    return this.getAttribute('data-side') === 'start' ? 'start' : 'end';
  }

  /** Is it a child of a host that docks it by its slot: a canvas, a panel area, the app shell? TRAP T-a-panel-slotted-in-a-layout-is-docked-there */
  #hosted(): boolean {
    const host = this.parentElement;
    return !!host && HOSTS.includes(host.localName);
  }

  /** The side of the host it docks on, or none where it has no host: then it is independent, at the window's edge. */
  #slotted(): 'start' | 'end' | null {
    return this.#hosted() ? this.#side() : null;
  }

  /** Its mode, whole: the attribute, or its default. Fixed and overlay are of an area, so with no host a panel is an overlay on the
   *  window's edge. */
  #mode(): PanelMode {
    const said = this.getAttribute('data-mode') as PanelMode | null;
    const mode = said && MODE_VALUES.includes(said) ? said : 'fixed';
    return this.#hosted() || mode === 'floating' || mode === 'tab' ? mode : 'overlay';
  }

  /** What it was before it became a tab: where a tab opens to. */
  #was: PanelMode | undefined;
  /** The last docked mode it had: where a float docks back to. */
  #docked: 'fixed' | 'overlay' | undefined;
  /** The mode it had the last time it looked. */
  #last: PanelMode | undefined;

  /** The mode it opens to from a tab, as it was. */
  get was(): PanelMode {
    return this.#was ?? this.#dockMode();
  }
  set was(mode: PanelMode) {
    if (MODE_VALUES.includes(mode)) this.#was = mode;
  }

  /** The docked mode a float goes back to: the last it had, else fixed in an area, an overlay without one. */
  #dockMode(): 'fixed' | 'overlay' {
    return this.#docked ?? (this.#hosted() ? 'fixed' : 'overlay');
  }

  /** Put the panel where its host, its side and its mode say: its slot, and its states. TRAP T-a-panel-slotted-in-a-layout-is-docked-there */
  #place = (): void => {
    if (!this.isConnected) return;
    const mode = this.#mode();
    const hosted = this.#hosted();
    this.#dock = this.#side();
    this.toggleState('in-layout', hosted);
    this.toggleState('tab-start', this.#dock === 'start');
    if (hosted) {
      // A floating panel is out of its area, in the host's float layer; a tab that was floating stays there too.
      const want = mode === 'floating' || (mode === 'tab' && this.#was === 'floating') ? 'panel-float' : `panel-${this.#dock}`;
      if (this.slot !== want) this.slot = want;
    } else if (this.slot) this.removeAttribute('slot');
    this.toggleState('in-area', hosted && mode === 'fixed');
    // Docked over the view, as an overlay, or peeking from its tab: the area has given its room back.
    this.toggleState('overlaid', hosted && (mode === 'overlay' || this.hasState('peeking')));
    this.toggleState('floating', mode === 'floating');
    this.#syncSide();
    this.#syncPop();
    this.#syncGroup();
    this.#floatBox.floated(mode === 'floating');
  };

  /** Its mode changed (by the area, or by itself where it has none): follow it. */
  #onMode(): void {
    const mode = this.#mode();
    const prev = this.#last;
    this.#last = mode;
    if (mode === prev) return;
    if (mode === 'fixed' || mode === 'overlay') this.#docked = mode;
    if (mode === 'tab' && prev && prev !== 'tab') this.#was = prev;
    // Opened for good (or shut): no longer a peek.
    if (prev === 'tab' && mode !== 'tab') {
      if (this.hasState('peeking')) this.#peek(false);
      this.set('data-updated', false);
    }
    this.toggleState('minimised', mode === 'tab');
    this.#syncGroup();
    // The first float lifts it where it is drawn.
    if (mode === 'floating' && prev !== undefined && prev !== 'tab') this.#lift();
    this.#place();
    SherpaOverlayPanel.#stack();
    if (mode === 'floating') this.#floatBox.raise();
  }

  /** Ask for a mode: `panel-mode-change` goes up, and the area that holds the panel writes it on every panel in it. Nobody
   *  answering, a panel with no area is its own. TRAP T-a-panel-has-four-modes */
  requestMode(mode: PanelMode): void {
    if (this.emit('panel-mode-change', { mode }, { cancelable: true })) this.set('data-mode', mode);
  }

  /** Floating, in its room: its box, moved by the header bar and resized by the corner. TRAP T-a-floating-panel-is-a-state */
  readonly #floatBox: FloatBox = new FloatBox({
    el: this,
    box: () => this.$<HTMLElement>('.root'),
    // The window, or the layout it is slotted in.
    room: () => this.#slotted() ? roomOf(this) : ({ x: 0, y: 0, width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }),
    free: () => this.#mode() === 'floating' && !this.hasAttribute('data-maximised'),
    set: (attr, value) => this.set(attr, value),
    num: (attr) => this.num(attr, NaN),
    toggleState: (name, on) => this.toggleState(name, on),
    moved: (at) => this.emit('panel-move', at),
    // The areas it floats over hear where the pointer is, and light up. TRAP T-a-dragged-panel-docks-where-the-area-lights-up
    dragged: (pointer, phase) => this.emit('panel-drag', { ...pointer, phase }),
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

  /** The buttons of the two groups: the first and the last that show wear the group's ends, which :first-child and
   *  :last-child give a button that is hidden. A divider stands after each group that shows, while a later one does too.
   *  TRAP T-a-minimised-panel-is-a-tab */
  #syncGroup(): void {
    // The same rules the CSS hides them by, read from the host: a computed style is not drawn yet at the first render.
    const has = (attr: string): boolean => this.hasAttribute(attr);
    const maximised = has('data-maximised');
    const docked = this.#hosted() && !maximised && !this.hasState('floating');
    const visible: Record<string, boolean> = {
      'dock-overlay': docked,
      'dock-fixed': docked,
      float: has('data-floatable') && !maximised,
      // A tab already: Minimise has nothing to do. Will, 2026-11-10
      minimise: has('data-minimisable') && !maximised && !this.hasState('minimised'),
      expand: has('data-expandable') && !this.hasState('in-area'),
      external: has('data-external'),
    };
    for (const group of [DOCKS, MODES]) {
      const shown = group.filter((name) => visible[name]);
      for (const name of group) {
        this.toggleState(`first-${name}`, shown[0] === name);
        this.toggleState(`last-${name}`, shown.at(-1) === name);
      }
    }
    const on: Record<(typeof GROUPS)[number], boolean> = {
      custom: this.hasState('shows-actions') || this.hasState('shows-end'),
      docks: DOCKS.some((name) => visible[name]),
      modes: MODES.some((name) => visible[name]),
      overflow: this.hasState('shows-overflow') || this.hasState('folded'),
      close: has('data-dismissible') || has('data-collapsible'),
    };
    GROUPS.forEach((group, i) => this.toggleState(`divide-${group}`, on[group] && GROUPS.slice(i + 1).some((later) => on[later])));
  }

  /** The least room a title is left, in px, before a group folds. */
  static readonly #TITLE_MIN = 112;

  /** What each group holds, as the controls a reader can press: the folded rows of the more menu. */
  #folded = new Map<string, HTMLElement>();

  /** Fold the groups into the more menu, the modes first, then the docks, then the content's own, until the title has room. */
  #fit(): void {
    const header = this.$('.header');
    const title = header?.shadowRoot?.querySelector<HTMLElement>('.title');
    if (!header || !title || !this.open) return;
    const order = ['modes', 'docks', 'custom'] as const;
    for (const group of order) this.toggleState(`fold-${group}`, false);
    this.toggleState('folded', false);
    const tight = (): boolean => title.clientWidth < Math.min(title.scrollWidth, SherpaOverlayPanel.#TITLE_MIN);
    const was = [...this.#folded.keys()].join();
    const rows = new Map<string, HTMLElement>();
    for (const group of order) {
      if (!tight()) break;
      const controls = this.#controlsOf(group);
      if (!controls.length) continue;
      this.toggleState(`fold-${group}`, true);
      this.toggleState('folded', true);
      for (const control of controls) rows.set(`${group}:${rows.size}`, control);
    }
    this.#folded = rows;
    this.#syncGroup();
    if (was === [...rows.keys()].join()) return;
    // The menu is loaded the first time something folds: a panel that never narrows never pays for it.
    if (rows.size) void import('../sherpa-menu/sherpa-menu.js');
    this.$<SherpaMenu>('.fold-menu')?.hide?.();
    this.$<SherpaMenu>('.fold-menu')?.items?.([...rows].map(([value, control]) => ({
      value,
      label: control.getAttribute('aria-label') ?? control.textContent?.trim() ?? control.getAttribute('title') ?? value,
    })));
  }

  /** The controls of a group that show: a button hidden by its flag, or a clone the content hides, is none. */
  #controlsOf(group: 'modes' | 'docks' | 'custom'): HTMLElement[] {
    if (group === 'custom') return [...this.children].filter((c): c is HTMLElement => c instanceof HTMLElement && ['actions', 'actions-end'].includes(c.getAttribute('slot') ?? '') && !c.hasAttribute('hidden'));
    return [...(this.$(`.${group}`)?.children ?? [])].filter((c): c is HTMLElement => c instanceof HTMLElement && getComputedStyle(c).display !== 'none');
  }

  /** A folded row was chosen: press the control it stands for, as a reader would. */
  #onFoldPick = (event: Event): void => {
    const control = this.#folded.get((event as CustomEvent<{ value: string }>).detail.value);
    this.$<SherpaMenu>('.fold-menu')?.hide?.();
    (control?.shadowRoot?.querySelector<HTMLElement>('button') ?? control)?.click();
  };

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

  /** Is it docked FIXED (flat, in its area's room) and not an overlay on the content? */
  #isFixed(): boolean {
    return this.#mode() === 'fixed';
  }

  /** Is it a floating box now? A floating panel that is a tab is a tab: its hover shows an overlay, whatever it was last open as.
   *  TRAP T-a-panel-peeks-from-its-tab */
  #floats(): boolean {
    return this.#mode() === 'floating';
  }

  /** Its mode in one word: `floating`, a `tab`, a tab `hover`ed open as a docked overlay, `overlay` or `fixed`. A fixed panel is never hovered:
   *  a hover opens it over the content. */
  get dockState(): 'floating' | 'tab' | 'hover' | 'overlay' | 'fixed' {
    const mode = this.#mode();
    if (mode === 'tab') return this.hasState('peeking') ? 'hover' : 'tab';
    return mode;
  }

  /** The Fixed or Overlay button: ask the area. A press is the reader's choice, a lost room is not. TRAP T-a-panel-has-four-modes */
  #onDock = (mode: 'fixed' | 'overlay'): void => {
    // The other docked box is as wide as this one: the width is the reader's, not the state's.
    this.#matchWidth(mode === 'fixed');
    this.requestMode(mode);
  };

  /** Hand the width it is drawn at to the state it is going to: an overlay's own, or its area's. */
  #matchWidth(toFixed: boolean): void {
    const width = Math.round((this.hasState('peeking') || !this.#isFixed() ? this.$('.root') : this)?.getBoundingClientRect().width ?? 0);
    if (!width) return;
    if (!toFixed) {
      this.style.setProperty('--_width', `${width}px`);
      return;
    }
    const side = this.#dock;
    const host = this.#hosted() ? this.parentElement : null;
    if (!host) return;
    // The area is the card and its inset on both sides. TODO 871
    const inset = 2 * (parseFloat(getComputedStyle(this).getPropertyValue('--sherpa-display-mode-space-xs')) || 8);
    // Every host keeps a width for each side.
    const attr = `data-panel-${side}-width`;
    host.setAttribute(attr, String(width + inset));
    host.dispatchEvent(new CustomEvent('panel-area-resize', { detail: { side, width: width + inset }, bubbles: false }));
  }

  /** Is the box drawn at the START of its room (a panel docked at the start side, or peeking there)? Its resize edge is then the right one. */
  #syncSide(): void {
    const start = this.#dock === 'start' && (!!this.#slotted() || this.hasState('peeking'));
    this.toggleState('at-start', start);
  }

  /** The dock button of the state it is in is off: a press there says nothing. A tab shown on hover is in neither. */
  #syncPop(): void {
    const fixed = this.#isFixed();
    const peeking = this.hasState('peeking');
    this.$('.dock-overlay')?.toggleAttribute('disabled', !fixed && !peeking);
    this.$('.dock-fixed')?.toggleAttribute('disabled', fixed && !peeking);
  }

  /** The pointer is on the tab: open the panel as a docked overlay, where the setting says. The tab is hidden while it shows. */
  #onPeek = (event: Event): void => {
    // A finger does not hover: on a touch screen a tab is tapped (`#onTab`).
    if ((event as PointerEvent).pointerType === 'touch') return;
    if (!this.hasAttribute('data-hover-open') || this.#mode() !== 'tab' || !this.open) return;
    this.#peek(true);
    // The panel opens where the tab stood, so the pointer is on it; if it is not, there is nothing to leave from.
    const { clientX: x, clientY: y } = event as PointerEvent;
    requestAnimationFrame(() => {
      const box = this.$('.root')?.getBoundingClientRect();
      // A pointer event with no place (0, 0) says nothing of where the pointer is.
      if (this.hasState('peeking') && box && (x || y) && (x < box.left || x > box.right || y < box.top || y > box.bottom)) this.#peek(false);
    });
  };

  /** The tab was pressed: its panel shows as a docked overlay until the pointer leaves it or a press lands outside. */
  #onTab = (): void => {
    if (this.#mode() === 'tab' && this.open && !this.hasState('peeking')) this.#peek(true);
  };

  /** A press outside a peeking panel, or Escape, ends the peek: the way out for a touch screen, which has no leaving. */
  #onPeekPress = (event: Event): void => {
    if (this.#floats()) return;
    const away = event.type === 'keydown' ? (event as KeyboardEvent).key === 'Escape' : !event.composedPath().includes(this);
    if (away) this.#peek(false);
  };

  /** What hears the pointer move, press and key while the peek has run. */
  #peekEnds: AbortController | undefined;

  /** The pointer moved while it peeks: out of the panel is back to the tab at once. A drag that began on it (its edge) is not a leaving. */
  #onPeekMove = (event: Event): void => {
    if (this.#floats()) return;
    const { clientX: x, clientY: y, buttons, pointerType } = event as PointerEvent;
    const box = this.$('.root')?.getBoundingClientRect();
    // A finger leaves by pressing outside, not by moving.
    if (pointerType !== 'touch' && !buttons && box && (x < box.left || x > box.right || y < box.top || y > box.bottom)) this.#peek(false);
  };

  /** Show or shut the peek, and the Minimise button's words with it: while it peeks, a press keeps it open. */
  #peek(on: boolean): void {
    this.toggleState('peeking', on);
    this.#syncSide();
    this.#peekEnds?.abort();
    this.#peekEnds = undefined;
    if (on) {
      this.#peekEnds = new AbortController();
      this.on(document, 'pointermove', this.#onPeekMove, { while: this.#peekEnds.signal });
      this.on(document, 'pointerdown', this.#onPeekPress, { while: this.#peekEnds.signal });
      this.on(document, 'keydown', this.#onPeekPress, { while: this.#peekEnds.signal });
    }
    if (this.#slotted()) this.toggleState('overlaid', on || this.#mode() === 'overlay');
    this.#syncPop();
  }

  /** Float, or dock back where it came from: the area's own mode. TRAP T-a-floating-panel-is-a-state */
  #onFloat = (): void => {
    // Floated from a panel shown on hover, it stays: a floating panel is no peek, and nothing of the peek (its leaving, its outside press) ends it.
    this.requestMode(this.#floats() ? this.#dockMode() : 'floating');
  };

  /** The Minimise button: a panel shown on hover is already a tab, so it goes back to it; otherwise the panel shrinks to one. TRAP T-a-minimised-panel-is-a-tab */
  #onMinimiseButton = (): void => {
    if (this.hasState('peeking')) this.#peek(false);
    else this.minimise();
  };

  /** Is it a tab now? */
  get minimised(): boolean {
    return this.#mode() === 'tab';
  }

  /** Its mode, whole. */
  get mode(): PanelMode {
    return this.#mode();
  }

  /** The side of the window it docks on: the area it sits in, or last sat in. */
  get side(): 'start' | 'end' {
    return this.#side();
  }

  /** Is it open, for the panel keys? */
  get shown(): boolean {
    return this.open;
  }

  /** Shrink to a tab (`on`), or open from it as it was; with no word, the other of the two. The keys and the buttons come here.
   *  The area mirrors it on the panel beside this one. TRAP T-an-area-holds-two-panels-stacked */
  minimise(on = !this.minimised): void {
    if (on === this.minimised) return;
    this.requestMode(on ? 'tab' : this.was);
  }

  /** The open-elsewhere button — the host decides where. */
  #onExternal = (): void => {
    this.emit('panel-external');
  };
}

define('sherpa-overlay-panel', SherpaOverlayPanel);
