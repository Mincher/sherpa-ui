/**
 * sherpa-app-header — the bar across the top of the app.
 *
 * It has two rows — history and actions on top, then the view title with a
 * quick-filter toolbar — sitting above a loading bar. CSS handles the layout,
 * badge, and loading animation. JS keeps the title, icon, and notification
 * count in sync, toggles the favourite star, and fires the header's events.
 * The back, favourite, and export buttons each fire an event. If you slot in
 * a sherpa-breadcrumbs, its clicks come back out as breadcrumb-click.
 *
 * populate({ breadcrumb?, filters? }) is a shortcut: give it breadcrumb and
 * filter data and it fills in the breadcrumbs and quick-filter toolbar for you,
 * so you don't have to write that markup by hand.
 *
 * @fires back             — detail: {}
 * @fires favorite-toggle  — detail: { favorite }
 * @fires view-export      — detail: {}
 * @fires breadcrumb-click — detail: { index, label, href }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

interface Crumb { label: string; href?: string }
interface FilterChip { id: string; label: string; type?: string; active?: boolean; count?: number }

interface AppHeaderConfig {
  breadcrumb?: Crumb[];
  filters?: FilterChip[];
}

interface Populatable extends HTMLElement { populate?: (d: unknown) => void; rendered?: Promise<void> }

export class SherpaAppHeader extends SherpaElement {
  static override css = new URL('./sherpa-app-header.css', import.meta.url);
  static override html = new URL('./sherpa-app-header.html', import.meta.url);
  static override observed = ['data-heading', 'data-icon', 'data-notifications', 'data-favorite'];

  override onRender(): void {
    this.#sync();
    this.$('.back')?.addEventListener('click', this.#onBack);
    this.$('.favorite')?.addEventListener('click', this.#onFavorite);
    this.$('.export')?.addEventListener('click', this.#onExport);
    // Re-dispatch a slotted breadcrumbs' selection as our own header event.
    this.$('.breadcrumb')?.addEventListener('breadcrumb-select', this.#onBreadcrumb as EventListener);
  }

  override onChange(): void {
    this.#sync();
  }

  /** populate({ breadcrumb, filters }) — stamp the composed children. */
  protected override renderData(data: unknown): void {
    const cfg = (data ?? {}) as AppHeaderConfig;
    if (Array.isArray(cfg.breadcrumb)) this.#stamp('breadcrumb', 'sherpa-breadcrumbs', cfg.breadcrumb);
    if (Array.isArray(cfg.filters)) this.#stamp('filters', 'sherpa-quick-filter-toolbar', cfg.filters);
  }

  /** Create (or reuse) a composed child in a named slot and populate it. */
  #stamp(slot: string, tag: string, data: unknown): void {
    let el = this.querySelector<Populatable>(`${tag}[slot="${slot}"]`);
    if (!el) {
      el = document.createElement(tag) as Populatable;
      el.setAttribute('slot', slot);
      this.appendChild(el);
    }
    const run = (): void => el!.populate?.(data);
    if (el.rendered) void Promise.resolve(el.rendered).then(run);
    else queueMicrotask(run);
  }

  /* ── Sync data-* → DOM ──────────────────────────────────────────── */

  #sync(): void {
    const title = this.$('.title');
    if (title) title.textContent = this.dataset['heading'] ?? '';
    const icon = this.$('.view-icon');
    if (icon) icon.textContent = this.dataset['icon'] ?? '';

    // Notification count → badge text; CSS shows/hides via [data-notifications].
    const count = this.dataset['notifications'];
    const badge = this.$('.notif-badge');
    if (badge) badge.textContent = count && count !== '0' ? count : '';
    if (count === '0') this.removeAttribute('data-notifications');

    // Favourite reflects onto the star's aria-pressed.
    this.$('.favorite')?.setAttribute('aria-pressed', String(this.hasAttribute('data-favorite')));
  }

  /* ── Events ─────────────────────────────────────────────────────── */

  #onBack = (): void => { this.emit('back', {}); };

  #onFavorite = (): void => {
    const favorite = !this.hasAttribute('data-favorite');
    this.toggleAttribute('data-favorite', favorite);
    this.emit('favorite-toggle', { favorite });
  };

  #onExport = (): void => { this.emit('view-export', {}); };

  #onBreadcrumb = (event: Event): void => {
    const { index, label, href } = (event as CustomEvent).detail ?? {};
    this.emit('breadcrumb-click', { index, label, href });
  };
}

customElements.define('sherpa-app-header', SherpaAppHeader);
