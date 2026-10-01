/**
 * sherpa-app-shell — the boilerplate frame for an app and its Contexts.
 *
 * CSS owns the inset past the overlaying nav rail; this file only mirrors the
 * rail's state onto the host.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { resizeByEdge } from '../../core/ui/edge-resize.js';

/** The narrowest Context a panel area may leave: the layout grid's tablet breakpoint. */
const TABLET = 768;

export class SherpaAppShell extends SherpaElement {
  static override css = new URL('./sherpa-app-shell.css', import.meta.url);
  static override html = new URL('./sherpa-app-shell.html', import.meta.url);
  static override observed = [
    'data-nav-state', 'data-no-nav', 'data-no-header', 'data-panel-start-width', 'data-panel-end-width',
  ];

  /** The shell writes these itself, mirroring each panel's own `open`. */
  static override props = {
    'data-panel-start-open': { type: 'boolean', kind: 'visibility' },
    'data-panel-end-open': { type: 'boolean', kind: 'visibility' },
    // The body has no room for a panel area. TRAP T-the-panel-is-desktop-only
    'data-no-room': { type: 'boolean', kind: 'visibility' },
  } as const;

  override onRender(): void {
    // The event is composed, so one listener covers the default rail and a slotted one.
    this.addEventListener('nav-state-change', this.#onNavState as EventListener);
    // The header's phone menu button: the rail opens as a menu. TRAP T-the-nav-is-a-menu-on-a-phone
    this.addEventListener('nav-menu-request', () => {
      (this.#rail() as (HTMLElement & { openMenu?: () => void }) | null)?.openMenu?.();
    });
    // Deferred: the rail sets itself to `collapsed` on its own first render.
    queueMicrotask(() => this.#adoptRailState());

    /* A panel area follows its panel's own `open`: slotted but SHUT, it
       must take no room, or the Context never gets the width back.
       `::slotted()` cannot go inside `:has()`, so the shell mirrors the flag.
       TRAP T-the-shell-owns-the-panel-areas */
    for (const side of ['start', 'end'] as const) {
      this.$(`slot[name="panel-${side}"]`)
        ?.addEventListener('slotchange', () => this.#watchPanel(side));
      this.#watchPanel(side);
      this.#resizable(side);
      this.#askWidth(side);
    }
    this.#watchRoom();
  }

  /**
   * A panel area needs ROOM: the Context beside it keeps a tablet's width, so
   * the body must hold that and the area's min. By the body's own width — a
   * pinned nav takes room too. The shell hides the areas and REPORTS it; the
   * host shuts and reopens the panel. TRAP T-the-panel-is-desktop-only
   */
  #watchRoom(): void {
    const body = this.$<HTMLElement>('.body');
    if (!body || typeof ResizeObserver !== 'function') return;
    this.#roomWatch = new ResizeObserver(() => {
      // Settings covers the Context, so the room under it does not change.
      if (this.dataset['navState'] === 'settings') return;
      const min = parseFloat(getComputedStyle(this.$('.panel-start') ?? this).minInlineSize) || 0;
      const room = body.getBoundingClientRect().width >= min + TABLET;
      if (room !== this.hasAttribute('data-no-room')) return;
      this.set('data-no-room', !room);
      this.emit('panel-room-change', { room });
    });
    this.#roomWatch.observe(body);
  }

  /** Watches the body's width for room. */
  #roomWatch?: ResizeObserver;

  /**
   * An area's INNER edge resizes it: drag it, or the arrow keys, Home and End.
   * The shell draws the width live and REPORTS it on release — the host keeps
   * it, and hands it back in `data-panel-<side>-width`. Its CSS owns the clamp:
   * never under its min, never over 33% of the row. Will, TODO 146.
   * TRAP T-an-edge-resizes-its-box
   */
  #resizable(side: 'start' | 'end'): void {
    const edge = this.$<HTMLElement>(`.edge-${side}`);
    const area = (): HTMLElement | null => this.$<HTMLElement>(`.panel-${side}`);
    if (!edge) return;
    const drawn = (): number => area()?.getBoundingClientRect().width ?? 0;
    resizeByEdge(edge, {
      grows: side === 'start' ? 1 : -1,
      measure: drawn,
      min: () => parseFloat(getComputedStyle(area() ?? this).minInlineSize) || 0,
      // 33% of the row, as the CSS has it. Will's number.
      max: () => (this.$<HTMLElement>('.body')?.getBoundingClientRect().width ?? 0) * 0.33,
      apply: (px, done) => {
        this.style.setProperty(`--_asked-${side}`, `${Math.round(px)}px`);
        // What the clamp DREW is the width: a key moves from there.
        const width = Math.round(drawn());
        this.style.setProperty(`--_asked-${side}`, `${width}px`);
        if (done) this.emit('panel-area-resize', { side, width });
      },
    });
  }

  override onChange(name: string): void {
    if (name === 'data-panel-start-width') this.#askWidth('start');
    else if (name === 'data-panel-end-width') this.#askWidth('end');
  }

  /** The host's width for an area, in: none is the area's own. */
  #askWidth(side: 'start' | 'end'): void {
    const px = Number(this.getAttribute(`data-panel-${side}-width`));
    if (px > 0) this.style.setProperty(`--_asked-${side}`, `${px}px`);
    else this.style.removeProperty(`--_asked-${side}`);
  }

  /** Mirror one panel's `open` onto the host, and follow it. */
  #watchPanel(side: 'start' | 'end'): void {
    const slot = this.$<HTMLSlotElement>(`slot[name="panel-${side}"]`);
    const panel = slot?.assignedElements()[0];
    const flag = `data-panel-${side}-open`;
    const sync = (): void => {
      this.toggleAttribute(flag, !!panel?.hasAttribute('open'));
    };
    this.#panelWatch[side]?.disconnect();
    if (!panel) { this.removeAttribute(flag); return; }
    const observer = new MutationObserver(sync);
    observer.observe(panel, { attributes: true, attributeFilter: ['open'] });
    this.#panelWatch[side] = observer;
    sync();
  }

  /** Watches each side panel slot, to say whether it holds anything. */
  #panelWatch: { start?: MutationObserver; end?: MutationObserver } = {};

  override onDisconnect(): void {
    this.#panelWatch.start?.disconnect();
    this.#panelWatch.end?.disconnect();
    this.#roomWatch?.disconnect();
  }

  /** The nav changed state: mirror it, so the content can make room. */
  #onNavState = (event: Event): void => {
    if (this.hasAttribute('data-no-nav')) return;
    const state = (event as CustomEvent).detail?.state as string | undefined;
    if (state) this.dataset['navState'] = state;
  };

  /** The rail: slotted, the default, or inside a consumer's wrapper. */
  #rail(): HTMLElement | null {
    const slotted = this.querySelector<HTMLElement>('[slot="nav"]');
    return (slotted?.localName === 'sherpa-nav' ? slotted : slotted?.querySelector<HTMLElement>('sherpa-nav'))
      ?? this.$<HTMLElement>('sherpa-nav') ?? this.querySelector<HTMLElement>('sherpa-nav');
  }

  /** Read the rail's current mode once, at startup. */
  #adoptRailState(): void {
    if (this.hasAttribute('data-no-nav')) return;
    const state = this.#rail()?.dataset['navState'];
    if (state) this.dataset['navState'] = state;
  }
}

customElements.define('sherpa-app-shell', SherpaAppShell);
