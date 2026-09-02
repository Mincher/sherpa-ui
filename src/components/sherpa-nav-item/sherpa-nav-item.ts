/**
 * sherpa-nav-item — one row in a navigation menu.
 *
 * Use this when you're building a nav by hand (sherpa-nav makes its own rows).
 * Each row has a leading icon (data-icon), a label (data-label), and an optional
 * badge (data-badge) or your own trailing content. Set data-href to make it a link.
 *
 * The "promo" style makes a bigger call-to-action row with an icon, a heading
 * (data-label), and a description (data-description).
 *
 * CSS handles the look; JS writes the text, sets the link, and fires the click.
 *
 * Public API:
 *   data-icon        leading icon glyph
 *   data-label       label / heading text
 *   data-badge       trailing badge / count text
 *   data-description promo description (promo variant only)
 *   data-current     current item in the nav set
 *   data-href        render the row as a link
 *   data-variant     "promo" for the CTA row
 *   disabled         disabled state
 *
 * @tier sub-component
 * @fires item-click — detail: { label, href }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaNavItem extends SherpaElement {
  static override tier = 'sub-component' as const;
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

  get current(): boolean {
    return this.hasAttribute('data-current');
  }
  set current(v: boolean) {
    this.toggleAttribute('data-current', v);
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
    this.emit('item-click', {
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
