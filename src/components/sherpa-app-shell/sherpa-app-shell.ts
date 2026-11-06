/**
 * sherpa-app-shell — the boilerplate frame for an app and its Contexts.
 *
 * CSS owns the inset past the overlaying nav rail; this file mirrors the rail's
 * state onto the host, and hands its body, the panel-area layout, the widths and the room.
 */
import { SHARED_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
import type { SherpaNav } from '../sherpa-nav/sherpa-nav.js';
// Defined before the template stamps it: the body's panel areas.
import type { SherpaLayoutPanels } from '../sherpa-layout-panels/sherpa-layout-panels.js';
import '../sherpa-layout-panels/sherpa-layout-panels.js';
import { panelKeys } from '../../core/ui/panel-keys.js';

/** The narrowest Context a panel area may leave: where the layout grid's tablet band begins (`@container sherpa-context (min-width: 728px)`). A wider
 *  rail (Increased nav sizing) still leaves a laptop's 1280px room for the panel. TRAP T-the-panel-is-desktop-only */
const TABLET = 728;

export class SherpaAppShell extends SherpaElement {
  static override css = new URL('./sherpa-app-shell.css', import.meta.url);
  static override html = new URL('./sherpa-app-shell.html', import.meta.url);

  static override props = {
    // The body has no room for a panel area. TRAP T-the-panel-is-desktop-only
    'data-no-room': { type: 'boolean', kind: 'visibility' },
    'data-nav-state': { type: 'enum', kind: 'style', values: ['collapsed', 'hover', 'default', 'pinned', 'settings'] },
    'data-no-nav': { type: 'boolean', kind: 'style' },
    'data-scroll-shadow': SHARED_PROPS['data-scroll-shadow'],
    'data-no-header': { type: 'boolean', kind: 'style' },
    'data-panel-start-width': { type: 'string', kind: 'behaviour' },
    'data-panel-end-width': { type: 'string', kind: 'behaviour' },
  } as const;
  static override observed = ['data-panel-start-width', 'data-panel-end-width'];

  /** What its body's layout hears from the host. */
  static #handed = ['data-no-room', 'data-panel-start-width', 'data-panel-end-width'] as const;

  override onRender(): void {
    // The event is composed, so one listener covers the default rail and a slotted one.
    this.addEventListener('nav-state-change', this.#onNavState as EventListener);
    // The header's phone menu button: the rail opens as a menu. TRAP T-the-nav-is-a-menu-on-a-phone
    this.addEventListener('nav-menu-request', () => {
      this.#rail()?.openMenu?.();
    });
    // Deferred, so a state the page writes in this turn is read; none is collapsed.
    queueMicrotask(() => this.#adoptRailState());

    /* The panel areas are the layout's: the shell hands it the widths and the room, and
       reports an area's resize as its own. TRAP T-the-shell-owns-the-panel-areas */
    const layout = this.#layout();
    if (layout) {
      this.mirrorAttrs(layout, SherpaAppShell.#handed);
      layout.addEventListener('panel-area-resize', this.#onAreaResize);
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
      const min = this.#layout()?.areaMin() ?? 0;
      const room = body.getBoundingClientRect().width >= min + TABLET;
      if (room !== this.hasAttribute('data-no-room')) return;
      this.set('data-no-room', !room);
      this.emit('panel-room-change', { room });
    });
    this.#roomWatch.observe(body);
  }

  /** Watches the body's width for room. */
  #roomWatch?: ResizeObserver;

  /** The body: the panel-area layout. */
  #layout(): SherpaLayoutPanels | null {
    return this.$<SherpaLayoutPanels>('.body');
  }

  override onChange(name: string): void {
    const layout = this.#layout();
    if (layout && (SherpaAppShell.#handed as readonly string[]).includes(name)) this.mirrorAttrs(layout, [name]);
  }

  /** An area's edge was let go: the shell's own report, and the layout's goes no further. */
  #onAreaResize = (event: Event): void => {
    event.stopPropagation();
    this.emit('panel-area-resize', (event as CustomEvent<{ side: 'start' | 'end'; width: number }>).detail);
  };

  // The panel keys, for as long as the shell is in the page. TRAP T-the-panel-keys-are-shift-and-a-number
  override onConnect(): void {
    panelKeys((target, type, handler) => this.on(target, type, handler));
  }

  override onDisconnect(): void {
    this.#roomWatch?.disconnect();
  }

  /** The nav changed state: mirror it, so the content can make room. */
  #onNavState = (event: Event): void => {
    if (this.hasAttribute('data-no-nav')) return;
    const state = (event as CustomEvent).detail?.state as string | undefined;
    if (state) this.set('data-nav-state', state);
  };

  /** The rail: slotted, the default, or inside a consumer's wrapper. */
  #rail(): SherpaNav | null {
    const slotted = this.querySelector<SherpaNav>('[slot="nav"]');
    return (slotted?.localName === 'sherpa-nav' ? slotted : slotted?.querySelector<SherpaNav>('sherpa-nav'))
      ?? this.$<SherpaNav>('sherpa-nav') ?? this.querySelector<SherpaNav>('sherpa-nav');
  }

  /** Read the rail's current mode once, at startup. */
  #adoptRailState(): void {
    if (this.hasAttribute('data-no-nav')) return;
    const state = this.#rail()?.dataset['navState'];
    if (state) this.set('data-nav-state', state);
  }
}

define('sherpa-app-shell', SherpaAppShell);
