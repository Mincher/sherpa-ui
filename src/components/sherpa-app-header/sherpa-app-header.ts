/**
 * sherpa-app-header — the bar across the top of the app.
 *
 * CSS owns layout, badge and animation. This keeps title / icon / count in
 * sync and fires one event per action.
 */
import { DATA_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
import type { Populatable } from '../../core/ui/apply-state.js';
// Every action is a composed sherpa-button. TRAP T-header-actions-are-composed-buttons
import '../sherpa-button/sherpa-button.js';
import '../sherpa-badge/sherpa-badge.js';
import '../sherpa-menu/sherpa-menu.js';
import type { SherpaQuickFilterToolbar } from '../sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.js';

interface Crumb { label: string; href?: string }
interface FilterChip { id: string; label: string; type?: string; active?: boolean; count?: number }

interface AppHeaderConfig {
  breadcrumb?: Crumb[];
  filters?: FilterChip[];
  /** What the header's Add chip offers — VIEW-scope fields not yet on the bar. */
  available?: FilterChip[];
}


/** Each plain action button: its class → the event it fires. `as const`, so the spec reads each name. */
const ACTIONS = [
  ['.back', 'back-click'],
  ['.ai', 'ai-click'],
  ['.labs', 'labs-click'],
  ['.theme-toggle', 'theme-toggle'],
  ['.notif-btn', 'notifications-click'],
  ['.account', 'account-click'],
  ['.help', 'help-click'],
  ['.menu', 'menu-click'],
  // A phone's nav menu — the SHELL opens it. TRAP T-the-nav-is-a-menu-on-a-phone
  ['.nav-menu', 'nav-menu-request'],
] as const;

export class SherpaAppHeader extends SherpaElement {
  static override css = new URL('./sherpa-app-header.css', import.meta.url);
  static override html = new URL('./sherpa-app-header.html', import.meta.url);
  static override props = {
    'data-account': { type: 'boolean', kind: 'style' },
    'data-ai': { type: 'boolean', kind: 'style' },
    'data-back': { type: 'boolean', kind: 'style' },
    'data-help': { type: 'boolean', kind: 'style' },
    // A Context with no filter row: its page holds its filters. TODO 425
    'data-no-filters': { type: 'boolean', kind: 'style' },
    'data-labs': { type: 'boolean', kind: 'style' },
    'data-loading': { type: 'boolean', kind: 'style' },
    'data-menu': { type: 'boolean', kind: 'style' },
    'data-theme-toggle': { type: 'boolean', kind: 'style' },
    /* The mode on screen, so the theme button offers the OTHER: a moon in
       light, a sun in dark. Not `data-mode`, which would re-tint the header. */
    'data-theme-mode': { type: 'enum', kind: 'behaviour', values: ['light', 'dark'] },
    'data-heading': { type: 'string', kind: 'content' },
    'data-ai-label': { type: 'string', kind: 'content' },
    'data-ai-disabled': { type: 'boolean', kind: 'style' },
    'data-divider': { type: 'boolean', kind: 'style' },
    /* The notifications panel is OPEN. The header emits the intent and the
       host owns the panel, so the host says when it opened — a button that
       opens something and does not look open reads as broken.
       TRAP T-a-trigger-shows-what-it-opened */
    'data-notifications-open': { type: 'boolean', kind: 'style' },
    'data-icon': { type: 'string', kind: 'content' },
    'data-notifications': { type: 'number', kind: 'content' },
    // The View's own actions: ★ and Save, left of Ask N-zo. Will, TODOs 425 G9 and 428
    'data-view-actions': { type: 'boolean', kind: 'visibility' },
    // A host that owns the favourites lights the star. TRAP T-the-star-reports-it-does-not-decide
    'data-favourite': { type: 'boolean', kind: 'behaviour' },
    'data-locked': DATA_PROPS['data-locked'],
    // Delete view only on the reader's own View. TRAP T-a-saved-view-is-the-readers-own
    'data-custom-view': { type: 'boolean', kind: 'visibility' },
    // The View on screen is a graph: its words say so. TRAP T-a-graph-is-a-view-of-a-type
    'data-graph': { type: 'boolean', kind: 'content' },
    // …and a preset, read only: Save is off.
    'data-readonly': { type: 'boolean', kind: 'behaviour' },
    // …or a page's Query, whose edits are the page's own: no View actions.
    'data-query': { type: 'boolean', kind: 'visibility' },
  } as const;
  static override observed = ['data-theme-mode'];

  override onRender(): void {
    this.#sync();
    for (const [sel, event] of ACTIONS) {
      // `button-click`, not the native `click`.
      this.$(sel)?.addEventListener('button-click', () => this.emit(event));
    }
    this.$('.favourite')?.addEventListener('button-click', this.#onStar);
    // The View's own, REQUESTS a host may take over. Will, TODOs 425 G9 and 428
    this.$('.save')?.addEventListener('button-click', () => this.emit('view-save', undefined, { cancelable: true }));
    this.$('.view-menu')?.addEventListener('menu-select', this.#onViewMenu);
  }

  /**
   * The star REPORTS the intent; `data-favourite` is the answer, IN. Locked,
   * the header never lights it — the host's favourites list answers.
   * TRAP T-the-star-reports-it-does-not-decide
   */
  #onStar = (): void => {
    const on = !this.hasAttribute('data-favourite');
    if (!this.hasAttribute('data-locked')) this.set('data-favourite', on);
    this.emit('view-favorite', { favourite: on });
  };

  /** Save view as, or Delete view: requests a host may take over. */
  #onViewMenu = (event: Event): void => {
    const value = (event as CustomEvent).detail?.value;
    if (value === 'save-as') this.emit('view-save-as', undefined, { cancelable: true });
    else if (value === 'delete') this.emit('view-delete', undefined, { cancelable: true });
  };

  override onChange(): void {
    this.#sync();
  }

  /**
   * Tell the bell what the host did with the panel.
   *
   * `sherpa-button` draws `data-open` for a menu it OWNS; the notifications
   * panel lives in the host, so the host reports it back. A button that opens
   * something and does not look open reads as broken.
   * TRAP T-a-trigger-shows-what-it-opened
   */
  #syncOpen(): void {
    this.$('.notif-btn')?.toggleAttribute(
      'data-open', this.hasAttribute('data-notifications-open'),
    );
  }

  /** The bell, for a host's notifications panel to anchor to; the header itself
   *  before it renders. TRAP T-a-shadow-reach-is-a-missing-door */
  get notificationsAnchor(): HTMLElement {
    return this.$<HTMLElement>('.notif-btn') ?? this;
  }

  /** populate({ breadcrumb, filters, available }) — feed the composed children. */
  protected override renderData(data: unknown): Promise<void> | void {
    const cfg = (data ?? {}) as AppHeaderConfig;
    const waits: Promise<void>[] = [];
    if (Array.isArray(cfg.breadcrumb)) {
      waits.push(this.#stamp('breadcrumbs', 'sherpa-breadcrumbs', cfg.breadcrumb));
    }
    if (Array.isArray(cfg.filters)) {
      waits.push(
        this.#stamp('filters', 'sherpa-quick-filter-toolbar', cfg.filters)
          // AFTER the chips, so the Add menu is built over the bar it will add to.
          .then(() => this.available(cfg.available ?? [])),
      );
    } else if (Array.isArray(cfg.available)) {
      this.available(cfg.available);
    }
    // RETURNED, so `await populate(…)` settles once the chips exist.
    // TRAP T-populate-settles-after-render-data
    return waits.length ? Promise.all(waits).then(() => undefined) : undefined;
  }

  /* The header re-exposes the toolbar's surface so a saved view is not coupled
     to its tag name. TRAP T-header-owns-the-filter-bar-surface */

  /** The toolbar's picks, or `{}` when no toolbar is slotted. */
  get values(): Record<string, readonly string[]> {
    return this.#toolbar()?.values ?? {};
  }

  /** Set every filter chip. REPLACES the set, silently. */
  set values(next: Record<string, readonly string[]>) {
    const bar = this.#toolbar();
    if (bar) bar.values = next;
  }

  /**
   * available([...]) — what the header's Add chip offers.
   *
   * Without this the header's Add button is disabled and offers NOTHING, which
   * is what it did: only the component bar was ever given a list.
   * TRAP T-a-bar-offers-only-what-its-scope-holds
   */
  available(defs: readonly FilterChip[]): void {
    this.#toolbar()?.available?.([...defs]);
  }

  /** The filter bar in the header, if there is one. */
  #toolbar(): SherpaQuickFilterToolbar | null {
    return this.querySelector<SherpaQuickFilterToolbar>('sherpa-quick-filter-toolbar[slot="filters"]');
  }

  /** Populate a consumer-slotted composed child. */
  async #stamp(slot: string, tag: string, data: unknown): Promise<void> {
    const el = this.querySelector<Populatable>(`${tag}[slot="${slot}"]`);
    if (!el) return; // the consumer slots the empty host; we never create one
    // A child that has not upgraded yet has no `rendered` to wait on.
    if (!el.rendered) await new Promise<void>((res) => queueMicrotask(res));
    await Promise.resolve(el.rendered);
    await Promise.resolve(el.populate?.(data));
  }

  /** Write the badge, the open state, and Save off on a read-only View. */
  #sync(): void {
    this.#syncOpen();
    this.$('.save')?.toggleAttribute('disabled', this.hasAttribute('data-readonly'));

    // Stamped once there is a count; CSS shows/hides it via [data-notifications].
    const count = this.dataset['notifications'];
    const shown = count && count !== '0' ? count : '';
    const badge = this.stampOnce('template.notif-badge-tpl', !!shown);
    if (badge) badge.textContent = shown;
    if (count === '0') this.set('data-notifications', null);

  }

}

define('sherpa-app-header', SherpaAppHeader);
