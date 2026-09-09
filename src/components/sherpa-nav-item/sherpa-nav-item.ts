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
 * Expandable items (data-expandable) grow a trailing chevron caret. Clicking it
 * fires item-expand and toggles data-expanded, which CSS rotates the caret from.
 *
 * Public API:
 *   data-icon        leading icon glyph
 *   data-label       label / heading text
 *   data-badge       trailing badge / count text
 *   data-status-dot  render the trailing chip as a small success/online dot
 *   data-expandable  show a trailing expand chevron
 *   data-expanded    expanded state — rotates the chevron (toggled on chevron click)
 *   data-description promo description (promo variant only)
 *   data-current     current item in the nav set
 *   data-href        render the row as a link
 *   data-variant     "promo" for the CTA row
 *   disabled         disabled state
 *
 * @tier sub-component
 * @fires item-click — detail: { label, href }
 * @fires item-expand — detail: { expanded }
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
    'data-current',
  ];

  protected override get templateId(): string {
    return this.dataset['variant'] === 'promo' ? 'promo' : 'default';
  }

  override onRender(): void {
    this.#sync();
    // The activation target is a native <button>/<a href>, so it is focusable and
    // Enter/Space-activatable on its own — JS only listens for the resulting click.
    this.addEventListener('click', this.#onClick);
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

  get expanded(): boolean {
    return this.hasAttribute('data-expanded');
  }
  set expanded(v: boolean) {
    this.toggleAttribute('data-expanded', v);
  }

  /* ── Sync attribute state into the template ───────────────────── */

  #sync(): void {
    const promo = this.dataset['variant'] === 'promo';

    // Both the <button> and the <a href> row carry the icon/label — write to both.
    const setAll = (sel: string, text: string): void => {
      for (const el of this.$$(sel)) el.textContent = text;
    };
    setAll(promo ? '.promo-icon' : '.icon', this.dataset['icon'] ?? '');
    setAll(promo ? '.promo-heading' : '.label', this.dataset['label'] ?? '');

    if (promo) {
      setAll('.promo-description', this.dataset['description'] ?? '');
    } else {
      const badge = this.$('.badge');
      if (badge) badge.textContent = this.dataset['badge'] ?? '';
    }

    // The <a href> row is a real link when data-href is set; CSS shows it in
    // place of the <button> row via :host([data-href]).
    const link = this.$<HTMLAnchorElement>(promo ? '.promo-link' : '.row-link');
    if (link) {
      const href = this.dataset['href'];
      if (href) link.setAttribute('href', href);
      else link.removeAttribute('href');
    }

    // The current row carries aria-current="page" on its activation target.
    const current = this.hasAttribute('data-current');
    for (const el of this.$$(promo ? '.promo' : '.row')) {
      if (current) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
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

  #toggleExpand(): void {
    if (this.hasAttribute('disabled')) return;
    const expanded = !this.hasAttribute('data-expanded');
    this.toggleAttribute('data-expanded', expanded);
    this.emit('item-expand', { expanded });
  }

  #onClick = (event: MouseEvent): void => {
    // A click on the trailing expand chevron toggles expansion, not navigation.
    if (
      this.hasAttribute('data-expandable') &&
      (event.target as Element | null)?.closest('.expand')
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.#toggleExpand();
      return;
    }
    this.#activate();
  };
}

customElements.define('sherpa-nav-item', SherpaNavItem);
