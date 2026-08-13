/**
 * sherpa-nav-item — a single navigation row.
 *
 * A standalone item for consumers assembling a custom nav by hand (the reforged
 * sherpa-nav stamps its own rows internally). The host is the interactive row:
 * leading icon (data-icon), a label (data-label), and an optional trailing badge
 * (data-badge) or slotted trailing content. Set data-href to render a link.
 *
 * A trivial "promo" variant renders a larger CTA-style row with an icon, a
 * heading (data-label) and a description (data-description).
 *
 * All presentation is CSS off data-*; JS only writes the text fields, mirrors
 * the href onto the inner anchor, and emits the click event.
 *
 * Public API:
 *   data-icon        leading icon glyph
 *   data-label       label / heading text
 *   data-badge       trailing badge / count text
 *   data-description promo description (promo variant only)
 *   data-active      active / current state
 *   data-href        render the row as a link
 *   data-variant     "promo" for the CTA row
 *   disabled         disabled state
 *
 * @fires nav-item-click — detail: { label, href }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaNavItem extends SherpaElement {
  static override css = new URL('./sherpa-nav-item.css', import.meta.url);
  static override html = new URL('./sherpa-nav-item.html', import.meta.url);
  static override observed = [
    'data-icon',
    'data-label',
    'data-badge',
    'data-description',
    'data-href',
  ];

  protected override get templateId(): string {
    return this.dataset['variant'] === 'promo' ? 'promo' : 'default';
  }

  override onRender(): void {
    this.#sync();
    this.addEventListener('click', this.#onClick);
    this.addEventListener('keydown', this.#onKeyDown);
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
  }

  override onChange(): void {
    this.#sync();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get active(): boolean {
    return this.hasAttribute('data-active');
  }
  set active(v: boolean) {
    this.toggleAttribute('data-active', v);
  }

  /* ── Sync attribute state into the template ───────────────────── */

  #sync(): void {
    const promo = this.dataset['variant'] === 'promo';

    const icon = this.$(promo ? '.promo-icon' : '.icon');
    if (icon) icon.textContent = this.dataset['icon'] ?? '';

    const label = this.$(promo ? '.promo-heading' : '.label');
    if (label) label.textContent = this.dataset['label'] ?? '';

    if (promo) {
      const desc = this.$('.promo-description');
      if (desc) desc.textContent = this.dataset['description'] ?? '';
    } else {
      const badge = this.$('.badge');
      if (badge) badge.textContent = this.dataset['badge'] ?? '';
    }

    const anchor = this.$<HTMLAnchorElement>(promo ? '.promo' : '.row');
    if (anchor) {
      const href = this.dataset['href'];
      if (href) anchor.setAttribute('href', href);
      else anchor.removeAttribute('href');
    }
  }

  /* ── Interaction ──────────────────────────────────────────────── */

  #activate(): void {
    if (this.hasAttribute('disabled')) return;
    this.emit('nav-item-click', {
      label: this.dataset['label'] ?? '',
      href: this.dataset['href'] ?? null,
    });
  }

  #onClick = (): void => {
    this.#activate();
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (this.hasAttribute('disabled')) return;
    event.preventDefault();
    this.#activate();
  };
}

customElements.define('sherpa-nav-item', SherpaNavItem);
