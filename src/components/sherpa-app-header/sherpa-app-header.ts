/**
 * sherpa-app-header — the top application header bar.
 *
 * Rebuilt to match the Figma "App Header": two rows (history + actions, then
 * view details with an embedded quick-filter toolbar) over a loading bar.
 *
 * Mostly declarative — CSS owns the layout, region collapse, badge, and loading
 * animation off data-* + slot presence. JS mirrors the title/icon/notification
 * count, toggles the favourite state, and wires the header's own events. A
 * back / favourite / export control each emits a header event; a slotted
 * sherpa-breadcrumbs re-dispatches its selection as breadcrumb-click.
 *
 * populate({ breadcrumb?, filters? }) is a convenience: it stamps a
 * sherpa-breadcrumbs into the breadcrumb slot and a sherpa-quick-filter-toolbar
 * into the filters slot, so the common case needs no hand-authored markup.
 *
 * @fires view-header-back — detail: {}
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
  static override observed = ['data-title', 'data-icon', 'data-notifications', 'data-favorite'];

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
    if (title) title.textContent = this.dataset['title'] ?? '';
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

  #onBack = (): void => { this.emit('view-header-back', {}); };

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
