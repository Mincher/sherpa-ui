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

interface Crumb { label: string; href?: string }
interface FilterChip { id: string; label: string; type?: string; active?: boolean; count?: number }

interface AppHeaderConfig {
  breadcrumb?: Crumb[];
  filters?: FilterChip[];
}

interface Populatable extends HTMLElement { populate?: (d: unknown) => void; rendered?: Promise<void> }

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
  static override observed = [
    'data-heading',
    'data-title',
    'data-icon',
    'data-ai-label',
    'data-notifications',
  ];

  override onRender(): void {
    this.#sync();
    // One listener per plain action — each just announces itself.
    for (const [sel, event] of ACTIONS) {
      this.$(sel)?.addEventListener('click', () => this.emit(event, {}));
    }
    // Re-dispatch a slotted breadcrumbs' selection as our own header event.
    this.addEventListener('breadcrumb-select', this.#onBreadcrumb as EventListener);
  }

  override onChange(): void {
    this.#sync();
  }

  /** populate({ breadcrumb, filters }) — feed the composed children. */
  protected override renderData(data: unknown): void {
    const cfg = (data ?? {}) as AppHeaderConfig;
    if (Array.isArray(cfg.breadcrumb)) this.#stamp('breadcrumbs', 'sherpa-breadcrumbs', cfg.breadcrumb);
    if (Array.isArray(cfg.filters)) this.#stamp('filters', 'sherpa-quick-filter-toolbar', cfg.filters);
  }

  /** Populate a consumer-slotted composed child (no structural createElement). */
  #stamp(slot: string, tag: string, data: unknown): void {
    const el = this.querySelector<Populatable>(`${tag}[slot="${slot}"]`);
    if (!el) return; // consumer must slot the empty host; we never create one
    const run = (): void => el.populate?.(data);
    if (el.rendered) void Promise.resolve(el.rendered).then(run);
    else queueMicrotask(run);
  }

  /* ── Sync data-* → DOM ──────────────────────────────────────────── */

  #sync(): void {
    const title = this.$('.title');
    if (title) title.textContent = this.dataset['heading'] ?? this.dataset['title'] ?? '';

    // The view icon is a Font Awesome class list; render it as an <i>, never as text.
    const icon = this.$('.view-icon');
    const glyph = this.dataset['icon'];
    if (icon) {
      if (glyph && /\bfa-/.test(glyph)) {
        const i = document.createElement('i');
        i.className = glyph;
        i.setAttribute('aria-hidden', 'true');
        icon.replaceChildren(i);
      } else {
        icon.textContent = glyph ?? '';
      }
    }

    const aiLabel = this.$('.ai-label');
    if (aiLabel) aiLabel.textContent = this.dataset['aiLabel'] ?? 'Ask N-zo';

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
