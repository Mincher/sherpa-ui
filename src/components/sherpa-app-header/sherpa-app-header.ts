/**
 * sherpa-app-header — the bar across the top of the app.
 *
 * Two rows over a loading bar, matching the Figma App Header (150:3690):
 *   row 1  back + breadcrumbs  ‖  Ask N-zo · chat · labs · theme · notifications ·
 *          account · help · menu (with 1×16 dividers between the groups)
 *   row 2  view icon + title  ·  the embedded quick-filter toolbar
 *
 * CSS owns the layout, which buttons show, the badge and the loading animation.
 * This file keeps the title / icon / count in sync, latches the favourite star,
 * and fires one event per action.
 *
 * populate({ breadcrumb?, filters? }) is a shortcut: slot the empty hosts in the
 * light DOM (<sherpa-breadcrumbs slot="breadcrumbs">, <sherpa-quick-filter-toolbar
 * slot="filters">) and populate() feeds them their data.
 *
 * @element sherpa-app-header
 * @attr {string}  data-heading       the view title (data-title is accepted too)
 * @attr {string}  data-icon          view icon — an FA class list
 * @attr {boolean} data-back          show the back button
 * @attr {boolean} data-ai            show the "Ask N-zo" button
 * @attr {string}  data-ai-label      its label (default "Ask N-zo")
 * @attr {boolean} data-labs          show the labs (beaker) button
 * @attr {boolean} data-theme-toggle  show the light/dark button
 * @attr {string}  data-notifications unread count — shows the bell + badge
 * @attr {boolean} data-account       show the account button
 * @attr {boolean} data-help          show the support (headset) button
 * @attr {boolean} data-menu          show the app-switcher button
 * @attr {boolean} data-loading       run the loading bar
 *
 * @fires back-click         — detail: {}
 * @fires ai-click           — detail: {}
 * @fires labs-click         — detail: {}
 * @fires theme-toggle       — detail: {}
 * @fires notifications-open — detail: {}
 * @fires account-click      — detail: {}
 * @fires help-click         — detail: {}
 * @fires menu-click         — detail: {}
 * @fires breadcrumb-click   — detail: { index, label, href }
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import type { Populatable } from '../../core/render-element.js';
// Every action is a composed sherpa-button, exactly as Figma instances them, so
// it must be defined. The header used to hand-roll eight plain <button> elements
// with ~50 lines of CSS re-implementing the component — which is precisely how
// the two drifted apart.
import '../sherpa-button/sherpa-button.js';

interface Crumb { label: string; href?: string }
interface FilterChip { id: string; label: string; type?: string; active?: boolean; count?: number }

interface AppHeaderConfig {
  breadcrumb?: Crumb[];
  filters?: FilterChip[];
}


/** Every plain action button: its class → the event it fires.
 *
 * In FIGMA'S ORDER (App Header 150:3690 `Actions` slot), so the list reads like
 * the bar does. There is no chat button — the code had invented one. */
const ACTIONS: ReadonlyArray<readonly [string, string]> = [
  ['.back', 'back-click'],
  ['.ai', 'ai-click'],
  ['.labs', 'labs-click'],
  ['.theme-toggle', 'theme-toggle'],
  ['.notif-btn', 'notifications-open'],
  ['.account', 'account-click'],
  ['.help', 'help-click'],
  ['.menu', 'menu-click'],
];

export class SherpaAppHeader extends SherpaElement {
  static override css = new URL('./sherpa-app-header.css', import.meta.url);
  static override html = new URL('./sherpa-app-header.html', import.meta.url);
  static override props = {
    // data-title is the legacy alias for data-heading.
    'data-heading': { type: 'string', kind: 'content', to: '.title', fallbackAttr: 'data-title' },
    'data-ai-label': { type: 'string', kind: 'content', to: '.ai-label', default: 'Ask N-zo' },
  } as const;

  static override observed = [
    'data-icon',
    'data-notifications',
  ];

  override onRender(): void {
    this.#sync();
    // One listener per plain action — each just announces itself.
    for (const [sel, event] of ACTIONS) {
      // `button-click`, not the native `click`. sherpa-button suppresses its own
      // event when disabled, where a raw click listener would still fire on the
      // host element — the actions are composed sherpa-buttons now, so the
      // component's event is the honest signal.
      this.$(sel)?.addEventListener('button-click', () => this.emit(event, {}));
    }
    // Re-dispatch a slotted breadcrumbs' selection as our own header event.
    this.addEventListener('breadcrumb-select', this.#onBreadcrumb as EventListener);
  }

  override onChange(): void {
    this.#sync();
  }

  /** populate({ breadcrumb, filters }) — feed the composed children. */
  protected override renderData(data: unknown): Promise<void> | void {
    const cfg = (data ?? {}) as AppHeaderConfig;
    const waits: Promise<void>[] = [];
    if (Array.isArray(cfg.breadcrumb)) {
      waits.push(this.#stamp('breadcrumbs', 'sherpa-breadcrumbs', cfg.breadcrumb));
    }
    if (Array.isArray(cfg.filters)) {
      waits.push(this.#stamp('filters', 'sherpa-quick-filter-toolbar', cfg.filters));
    }
    // RETURNED, so `await header.populate(…)` settles once the CHIPS exist.
    // The base class's contract is that populate() settles when the data is in
    // the DOM — but this header's data lands in slotted CHILDREN, and stamping
    // them was fire-and-forget. A caller that repopulated the bar and then set
    // the chips wrote into a toolbar that had not rebuilt them yet, and the
    // write silently went nowhere.
    return waits.length ? Promise.all(waits).then(() => undefined) : undefined;
  }

  /* ── The filter bar, reachable ─────────────────────────────────────
     The toolbar is slotted in the LIGHT DOM, so a host CAN reach it with a
     querySelector. It should not have to: the header is what a view holds a
     reference to, and a saved view that must know the toolbar's tag name to
     set a filter is a view coupled to this header's internals.

     PARITY. Anything a reader can click here, a caller must be able to call —
     a saved view, a deep link, a test, an agent with no pointer. */

  /** The toolbar's picks, or `{}` when no toolbar is slotted. */
  get values(): Record<string, readonly string[]> {
    return this.#toolbar()?.values ?? {};
  }

  /**
   * Set every filter chip — `{ region: ['emea'] }`.
   *
   * REPLACES the set: a chip the caller does not name is switched off, because
   * a view definition is a whole statement about the bar, not a patch on
   * whatever was showing before it.
   *
   * Silent, like the toolbar's own setter: the caller already knows.
   */
  set values(next: Record<string, readonly string[]>) {
    const bar = this.#toolbar();
    if (bar) bar.values = next;
  }

  #toolbar(): (HTMLElement & { values: Record<string, readonly string[]> }) | null {
    return this.querySelector('sherpa-quick-filter-toolbar[slot="filters"]');
  }

  /** Populate a consumer-slotted composed child (no structural createElement). */
  async #stamp(slot: string, tag: string, data: unknown): Promise<void> {
    const el = this.querySelector<Populatable>(`${tag}[slot="${slot}"]`);
    if (!el) return; // consumer must slot the empty host; we never create one
    // A child that has not upgraded yet has no `rendered` to wait on, so give
    // the custom-element registry a turn first.
    if (!el.rendered) await new Promise<void>((res) => queueMicrotask(res));
    await Promise.resolve(el.rendered);
    await Promise.resolve(el.populate?.(data));
  }

  /* ── Sync data-* → DOM ──────────────────────────────────────────── */

  #sync(): void {
    // A Font Awesome class list becomes CLASSES, a raw character becomes TEXT —
    // one policy, in the base class, rather than a copy here.
    const icon = this.$('.view-icon');
    if (icon) this.writeIcon(icon, this.dataset['icon'] ?? '');

    // Notification count → badge text; CSS shows/hides via [data-notifications].
    const count = this.dataset['notifications'];
    const badge = this.$('.notif-badge');
    if (badge) badge.textContent = count && count !== '0' ? count : '';
    if (count === '0') this.removeAttribute('data-notifications');

  }

  /* ── Events ─────────────────────────────────────────────────────── */

  #onBreadcrumb = (event: Event): void => {
    const { index, label, href } = (event as CustomEvent).detail ?? {};
    this.emit('breadcrumb-click', { index, label, href });
  };
}

customElements.define('sherpa-app-header', SherpaAppHeader);
